from urllib.parse import urlparse, parse_qs, unquote
import html
import json
import os
import re
from datetime import date, datetime
from html.parser import HTMLParser
from typing import Any, Literal

import requests
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import SavedTrip
from ai_service import generate_ai_itinerary
from demo_itinerary import generate_demo_itinerary
from openai import RateLimitError

load_dotenv()
SERPAPI_KEY = os.getenv("SERPAPI_KEY")

# Create database tables automatically if they don't exist.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SkyPlan AI API",
    description="Backend API for flight search and trip planning",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Pydantic request models
# ---------------------------------------------------------------------------

class FlightSearch(BaseModel):
    origin: str = Field(min_length=1, max_length=100)
    destination: str = Field(min_length=1, max_length=100)
    departure_date: str
    return_date: str | None = None
    trip_type: Literal["round", "oneway"] = "round"
    passengers: int = Field(default=1, ge=1, le=9)

    # Optional filters; existing frontend requests remain compatible.
    airline: str | None = None
    max_stops: int | None = Field(default=None, ge=0, le=5)
    sort_by: Literal[
        "recommended",
        "price_low",
        "price_high",
        "duration",
    ] = "recommended"


class BookingOptionsRequest(BaseModel):
    booking_token: str | None = None
    departure_token: str | None = None
    departure_id: str | None = None
    arrival_id: str | None = None
    outbound_date: str | None = None
    return_date: str | None = None


class ResolveBookingRequest(BaseModel):
    booking_url: str
    post_data: str | None = None


class ItineraryRequest(BaseModel):
    destination: str = Field(min_length=1, max_length=100)
    days: int = Field(ge=1, le=30)
    budget: float = Field(gt=0)
    travel_style: str = Field(min_length=1, max_length=100)


class SaveTripRequest(BaseModel):
    destination: str = Field(min_length=1, max_length=100)
    days: int = Field(ge=1, le=30)
    budget: float = Field(gt=0)
    travel_style: str = Field(min_length=1, max_length=100)
    itinerary: list[dict[str, Any]]


class TripUpdate(BaseModel):
    destination: str = Field(min_length=1, max_length=100)
    days: int = Field(ge=1, le=30)
    budget: float = Field(gt=0)
    travel_style: str = Field(min_length=1, max_length=100)


# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

def build_itinerary(days: int, budget: float):
    daily_budget = round(budget / days, 2)

    activities = [
        {
            "morning": "Explore popular attractions and landmarks.",
            "afternoon": "Visit a cultural site or local museum.",
            "evening": "Enjoy a walk and try local food.",
        },
        {
            "morning": "Discover nature spots or scenic locations.",
            "afternoon": "Explore local markets and shopping areas.",
            "evening": "Enjoy a relaxed evening at a popular area.",
        },
        {
            "morning": "Visit another well-known attraction.",
            "afternoon": "Choose an activity based on your interests.",
            "evening": "Explore the neighbourhood and local cuisine.",
        },
        {
            "morning": "Take a sightseeing trip.",
            "afternoon": "Discover local culture and landmarks.",
            "evening": "Enjoy free time or a relaxing activity.",
        },
    ]

    itinerary = []

    for day in range(1, days + 1):
        activity = activities[(day - 1) % len(activities)]

        itinerary.append({
            "day": day,
            "morning": activity["morning"],
            "afternoon": activity["afternoon"],
            "evening": activity["evening"],
            "estimated_budget": daily_budget,
        })

    return itinerary


def airport_code(value: str) -> str:
    """Convert a common airport/city label into an IATA airport code."""
    value = value.strip()

    # Accept labels such as "Kochi (COK)" or "Kochi - COK".
    match = re.search(r"\b([A-Z]{3})\b", value)
    if match:
        return match.group(1)

    airports = {
        "kochi": "COK",
        "cochin": "COK",
        "bengaluru": "BLR",
        "bangalore": "BLR",
        "mumbai": "BOM",
        "delhi": "DEL",
        "new delhi": "DEL",
        "chennai": "MAA",
        "hyderabad": "HYD",
        "kolkata": "CCU",
        "goa": "GOI",
        "dubai": "DXB",
        "singapore": "SIN",
        "london": "LHR",
        "paris": "CDG",
        "bali": "DPS",
        "denpasar": "DPS",
        "abu dhabi": "AUH",
        "doha": "DOH",
        "kuala lumpur": "KUL",
        "bangkok": "BKK",
        "new york": "JFK",
        "tokyo": "HND",
    }

    code = airports.get(value.casefold())
    if not code:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Could not identify the airport for '{value}'. "
                "Use an IATA airport code, for example COK or DXB."
            ),
        )

    return code


def format_flight_time(value: str | None) -> str:
    """Extract the displayed time from a SerpApi airport timestamp."""
    if not value:
        return "N/A"

    try:
        return datetime.fromisoformat(value).strftime("%H:%M")
    except ValueError:
        return value


def format_duration(minutes: int | None) -> str:
    if minutes is None:
        return "N/A"

    hours, remaining_minutes = divmod(int(minutes), 60)

    if hours:
        return f"{hours}h {remaining_minutes}m"

    return f"{remaining_minutes}m"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
def home():
    return {
        "message": "Welcome to SkyPlan AI API",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}


@app.post("/api/flights/search")
def search_flights(request: FlightSearch):
    origin = request.origin.strip()
    destination = request.destination.strip()

    if not origin or not destination:
        raise HTTPException(
            status_code=400,
            detail="Origin and destination are required.",
        )

    if origin.casefold() == destination.casefold():
        raise HTTPException(
            status_code=400,
            detail="Departure and destination must be different.",
        )

    try:
        departure = date.fromisoformat(request.departure_date)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=400,
            detail="Departure date must use YYYY-MM-DD format.",
        )

    if departure < date.today():
        raise HTTPException(
            status_code=400,
            detail="Departure date cannot be in the past.",
        )

    returning = None

    if request.trip_type == "round":
        if not request.return_date:
            raise HTTPException(
                status_code=400,
                detail="A return date is required for a round trip.",
            )

        try:
            returning = date.fromisoformat(request.return_date)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400,
                detail="Return date must use YYYY-MM-DD format.",
            )

        if returning < departure:
            raise HTTPException(
                status_code=400,
                detail="Return date cannot be before departure date.",
            )

    if not SERPAPI_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "SerpApi is not configured. Check SERPAPI_KEY "
                "in backend/.env and restart the backend."
            ),
        )

    departure_id = airport_code(origin)
    arrival_id = airport_code(destination)

    params = {
        "engine": "google_flights",
        "api_key": SERPAPI_KEY,
        "departure_id": departure_id,
        "arrival_id": arrival_id,
        "outbound_date": departure.isoformat(),
        "type": "1" if request.trip_type == "round" else "2",
        "adults": request.passengers,
        "currency": "INR",
        "hl": "en",
        "gl": "in",
    }

    if returning:
        params["return_date"] = returning.isoformat()

    try:
        response = requests.get(
            "https://serpapi.com/search",
            params=params,
            timeout=45,
        )
        response.raise_for_status()
        data = response.json()
        print("SERPAPI HTTP STATUS:", response.status_code)
        print("SERPAPI SEARCH ERROR:", data.get("error"))
        print("SERPAPI SEARCH PARAMETERS:", data.get("search_parameters"))

    except requests.Timeout:
        raise HTTPException(
            status_code=504,
            detail="The flight provider request timed out. Please try again.",
        )

    except requests.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else 502
        print("SERPAPI HTTP STATUS:", status)
        raise HTTPException(
            status_code=502,
            detail="The flight-search provider returned an HTTP error.",
        )

    except requests.RequestException as exc:
        print("SERPAPI REQUEST ERROR:", str(exc))
        raise HTTPException(
            status_code=502,
            detail="Could not connect to the flight-search provider.",
        )

    except ValueError:
        raise HTTPException(
            status_code=502,
            detail="The flight provider returned an invalid response.",
        )

    print("SERPAPI FLIGHT KEYS:", list(data.keys()))

    if data.get("error"):
        raise HTTPException(
            status_code=502,
            detail=str(data["error"]),
        )

    itineraries = (
        data.get("best_flights") or []
    ) + (
        data.get("other_flights") or []
    )

    if itineraries:
        print("FIRST FLIGHT KEYS:", list(itineraries[0].keys()))
        print("BOOKING TOKEN EXISTS:", bool(itineraries[0].get("booking_token")))
        print("DEPARTURE TOKEN EXISTS:", bool(itineraries[0].get("departure_token")))
    else:
        print("NO FLIGHTS FOUND IN PROVIDER RESPONSE")

    results = []

    for itinerary in itineraries:
        segments = itinerary.get("flights") or []

        if not segments:
            continue

        first_segment = segments[0]
        last_segment = segments[-1]

        airline_names = list(dict.fromkeys(
            segment.get("airline", "Unknown airline")
            for segment in segments
        ))

        flight_numbers = [
            segment.get("flight_number", "")
            for segment in segments
            if segment.get("flight_number")
        ]

        stop_count = max(0, len(segments) - 1)

        if stop_count == 0:
            stops_label = "Non-stop"
        elif stop_count == 1:
            stops_label = "1 stop"
        else:
            stops_label = f"{stop_count} stops"

        raw_price = itinerary.get("price")

        if raw_price is None:
            continue

        try:
            price = float(raw_price)
        except (ValueError, TypeError):
            continue

        results.append({
            "airline": " / ".join(airline_names),
            "code": " / ".join(flight_numbers) or "N/A",
            "departure": format_flight_time(
                first_segment.get("departure_airport", {}).get("time")
            ),
            "arrival": format_flight_time(
                last_segment.get("arrival_airport", {}).get("time")
            ),
            "duration": format_duration(
                itinerary.get("total_duration")
            ),
            "price": price,
            "stops": stops_label,
            "booking_token": itinerary.get("booking_token"),
            "departure_token": itinerary.get("departure_token"),
        })

    # Apply the existing frontend's filters.
    if request.airline and request.airline.strip():
        airline_filter = request.airline.strip().casefold()
        results = [
            flight for flight in results
            if airline_filter in flight["airline"].casefold()
        ]

    if request.max_stops is not None:
        results = [
            flight for flight in results
            if (
                0 if flight["stops"] == "Non-stop"
                else int(flight["stops"].split()[0])
            ) <= request.max_stops
        ]

    def duration_minutes(duration: str) -> int:
        match = re.fullmatch(
            r"(?:(\d+)h)?\s*(?:(\d+)m)?",
            duration.strip(),
        )
        if not match:
            return 10**9

        hours = int(match.group(1) or 0)
        minutes = int(match.group(2) or 0)
        return hours * 60 + minutes

    if request.sort_by == "price_low":
        results.sort(key=lambda flight: flight["price"])
    elif request.sort_by == "price_high":
        results.sort(
            key=lambda flight: flight["price"],
            reverse=True,
        )
    elif request.sort_by == "duration":
        results.sort(
            key=lambda flight: duration_minutes(flight["duration"])
        )

    return {
        "origin": origin,
        "destination": destination,
        "departure_date": request.departure_date,
        "return_date": (
            request.return_date if returning else None
        ),
        "trip_type": request.trip_type,
        "passengers": request.passengers,
        "total_results": len(results),
        "results": results,
        "demo": False,
        "source": "SerpApi Google Flights",
        "currency": "INR",
        "message": (
            "Results retrieved from the flight-search provider. "
            "Prices and availability may change."
        ),
    }


@app.post("/api/flights/booking-options")
def get_flight_booking_options(request: BookingOptionsRequest):
    if not SERPAPI_KEY:
        raise HTTPException(
            status_code=503,
            detail="Flight-search provider is not configured.",
        )

    has_booking = bool(request.booking_token and request.booking_token.strip())
    has_departure = bool(request.departure_token and request.departure_token.strip())

    if not has_booking and not has_departure:
        raise HTTPException(
            status_code=400,
            detail="Provide either booking_token (for booking options) or departure_token (for return flights).",
        )

    if has_booking and has_departure:
        raise HTTPException(
            status_code=400,
            detail="Provide exactly one of booking_token or departure_token, not both.",
        )

    # Stage 1: retrieve return-flight choices using departure_token.
    if has_departure:
        if not request.departure_id or not request.arrival_id:
            raise HTTPException(
                status_code=400,
                detail="Departure and arrival airport IDs are required.",
            )

        if not request.outbound_date:
            raise HTTPException(
                status_code=400,
                detail="Outbound date is required.",
            )

        try:
            outbound_date = date.fromisoformat(request.outbound_date)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Outbound date must use YYYY-MM-DD format.",
            )

        if not request.return_date:
            raise HTTPException(
                status_code=400,
                detail="Return date is required for round-trip flights.",
            )

        params = {
            "engine": "google_flights",
            "api_key": SERPAPI_KEY,
            "departure_token": request.departure_token,
            "departure_id": airport_code(request.departure_id),
            "arrival_id": airport_code(request.arrival_id),
            "outbound_date": outbound_date.isoformat(),
            "return_date": request.return_date,
            "type": "1",
            "currency": "INR",
            "hl": "en",
            "gl": "in",
        }

        print("ROUND TRIP DEBUG:")
        print("Departure token length:", len(request.departure_token or ""))
        print("Departure airport:", params.get("departure_id"))
        print("Arrival airport:", params.get("arrival_id"))
        print("Outbound date:", params.get("outbound_date"))
        print("Return date:", params.get("return_date"))

    # Stage 2: retrieve booking options for a selected itinerary.
    else:
        if not request.outbound_date:
            raise HTTPException(
                status_code=400,
                detail="Outbound date is missing from the booking request.",
            )

        try:
            outbound_date = date.fromisoformat(request.outbound_date)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400,
                detail="Outbound date must use YYYY-MM-DD format.",
            )

        if not request.departure_id or not request.arrival_id:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Departure and arrival airport IDs are required "
                    "to retrieve booking options."
                ),
            )

        params = {
            "engine": "google_flights",
            "api_key": SERPAPI_KEY,
            "booking_token": request.booking_token,
            "departure_id": airport_code(request.departure_id),
            "arrival_id": airport_code(request.arrival_id),
            "outbound_date": outbound_date.isoformat(),
            "type": "1" if request.return_date else "2",
            "currency": "INR",
            "hl": "en",
            "gl": "in",
        }
        if request.return_date:
            params["return_date"] = request.return_date

    # Both stages share the same provider request.
    try:
        print("SERPAPI PARAM KEYS:", sorted(params.keys()))
        response = requests.get(
            "https://serpapi.com/search",
            params=params,
            timeout=45,
        )
        response.raise_for_status()

        data = response.json()
        print("SERPAPI RESPONSE KEYS:", list(data.keys()))
        print("SERPAPI ERROR:", data.get("error"))

    except requests.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Flight provider timed out. Please try again.",
        )

    except requests.HTTPError as exc:
        status = (
            exc.response.status_code
            if exc.response is not None
            else 502
        )

        try:
            error_body = (
                exc.response.json()
                if exc.response is not None
                else {}
            )
            provider_error = error_body.get(
                "error",
                "Unknown provider error",
            )
        except ValueError:
            provider_error = "Invalid error response from provider."

        print("SERPAPI HTTP STATUS:", status)
        print("SERPAPI ERROR:", provider_error)

        raise HTTPException(
            status_code=502,
            detail=f"Flight provider returned HTTP {status}: {provider_error}",
        )

    except requests.RequestException as exc:
        print("SERPAPI REQUEST ERROR:", str(exc))
        raise HTTPException(
            status_code=502,
            detail="Could not connect to the flight provider.",
        )

    except ValueError:
        raise HTTPException(
            status_code=502,
            detail="Flight provider returned invalid JSON.",
        )

    if data.get("error"):
        raise HTTPException(
            status_code=502,
            detail=str(data["error"]),
        )

    # Stage 1 response: show return flights.
    if has_departure:
        itineraries = (
            (data.get("best_flights") or [])
            + (data.get("other_flights") or [])
        )

        return_flights = []

        for itinerary in itineraries:
            segments = itinerary.get("flights") or []
            if not segments:
                continue

            first_segment = segments[0]
            last_segment = segments[-1]

            print("RETURN ITINERARY KEYS:", list(itinerary.keys()))
            print(
                "BOOKING TOKEN PRESENT:",
                bool(itinerary.get("booking_token"))
            )

            try:
                price = float(itinerary["price"])
            except (KeyError, TypeError, ValueError):
                price = None

            return_flights.append({
                "airline": " / ".join(dict.fromkeys(
                    segment.get("airline", "Unknown airline")
                    for segment in segments
                )),
                "code": " / ".join(
                    segment.get("flight_number", "")
                    for segment in segments
                    if segment.get("flight_number")
                ) or "N/A",
                "departure": format_flight_time(
                    first_segment.get("departure_airport", {}).get("time")
                ),
                "arrival": format_flight_time(
                    last_segment.get("arrival_airport", {}).get("time")
                ),
                "duration": format_duration(
                    itinerary.get("total_duration")
                ),
                "price": price,
                "booking_token": itinerary.get("booking_token"),
                "departure_token": itinerary.get("departure_token"),
                "stops": (
                    "Non-stop"
                    if len(segments) == 1
                    else f"{len(segments) - 1} stop(s)"
                ),
            })

        return {
            "stage": "select_return_flight",
            "return_flights": return_flights,
            "total_results": len(return_flights),
            "message": (
                "Choose a return flight to continue."
                if return_flights
                else "No return-flight options were returned."
            ),
        }

    # Stage 2 response: show booking providers.
    options = []

    for option in data.get("booking_options", []):
        for ticket_type in ("together", "departing"):
            ticket = option.get(ticket_type) or {}

            if not ticket:
                continue

            booking_request = ticket.get("booking_request") or {}

            raw_price = ticket.get("price")
            try:
                price = float(raw_price) if raw_price is not None else None
            except (TypeError, ValueError):
                price = None

            booking_url = (
                ticket.get("booking_url")
                or ticket.get("url")
                or booking_request.get("url")
            )

            options.append({
                "provider": ticket.get("book_with") or "Booking provider",
                "price": price,
                "currency": "INR",
                "ticket_type": (
                    "Separate tickets"
                    if option.get("separate_tickets")
                    else "Combined ticket"
                ),
                "booking_request": booking_request or None,
                "booking_url": booking_url,
                "booking_post_data": booking_request.get("post_data"),
                "booking_phone": ticket.get("booking_phone"),
                "direct_booking_available": bool(booking_url),
            })

            # Use the combined ticket when available; otherwise use
            # the departing ticket as a fallback.
            if ticket_type == "together":
                break

    return {
        "stage": "booking_options",
        "booking_options": options,
        "total_options": len(options),
        "message": (
            "Booking options retrieved. Prices and availability may change."
            if options
            else "No booking options were returned for this flight."
        ),
    }


@app.post("/api/flights/resolve-booking")
def resolve_flight_booking(request: ResolveBookingRequest):
    booking_url = request.booking_url
    post_data = request.post_data

    if not isinstance(booking_url, str) or not booking_url:
        raise HTTPException(
            status_code=400,
            detail="Booking URL is missing.",
        )

    # The initial URL must be the expected Google Flights endpoint.
    parsed_url = urlparse(booking_url)

    if (
        parsed_url.scheme != "https"
        or parsed_url.hostname != "www.google.com"
        or parsed_url.path != "/travel/clk/f"
    ):
        raise HTTPException(
            status_code=400,
            detail="Unsupported Google Flights booking URL.",
        )

    if not isinstance(post_data, str) or not post_data:
        raise HTTPException(
            status_code=400,
            detail="Booking request data is missing.",
        )

    try:
        response = requests.post(
            booking_url,
            data=post_data,
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36"
                ),
            },
            allow_redirects=False,
            timeout=30,
        )

    except requests.Timeout:
        raise HTTPException(
            status_code=504,
            detail="The booking provider took too long to respond.",
        )

    except requests.RequestException as exc:
        print("BOOKING RESOLVER REQUEST ERROR:", str(exc))
        raise HTTPException(
            status_code=502,
            detail="Could not resolve the booking link.",
        )

    print("BOOKING RESOLVER HTTP STATUS:", response.status_code)
    print("BOOKING RESOLVER LOCATION:", response.headers.get("Location"))

    destination_url = response.headers.get("Location")
    form_action = None
    form_fields = {}

    # Some providers use an HTML meta-refresh redirect.
    if not destination_url and response.status_code == 200:

        class BookingHTMLParser(HTMLParser):
            def __init__(self):
                super().__init__()
                self.destination = None
                self.form_action = None
                self.form_fields = {}
                self.inside_redirect_form = False

            def handle_starttag(self, tag, attrs):
                attributes = dict(attrs)

                if tag.lower() == "meta":
                    if (
                        attributes.get("http-equiv", "").lower()
                        == "refresh"
                    ):
                        content = attributes.get("content", "")
                        match = re.search(
                            r"url\s*=\s*['\"]?(.+?)['\"]?\s*$",
                            content,
                            re.IGNORECASE,
                        )
                        if match:
                            self.destination = html.unescape(
                                match.group(1).strip().strip("'\"")
                            )

                elif tag.lower() == "form" and self.form_action is None:
                    action = attributes.get("action", "")
                    if action:
                        self.form_action = html.unescape(action)
                        self.inside_redirect_form = True

                elif (
                    tag.lower() == "input"
                    and self.inside_redirect_form
                ):
                    name = attributes.get("name")
                    value = attributes.get("value", "")

                    if name:
                        self.form_fields[name] = html.unescape(value)

            def handle_endtag(self, tag):
                if tag.lower() == "form":
                    self.inside_redirect_form = False

        parser = BookingHTMLParser()
        parser.feed(response.text)

        destination_url = parser.destination
        form_action = parser.form_action
        form_fields = parser.form_fields

    # An HTTP redirect can also return a relative destination.
    if destination_url:
        destination_url = requests.compat.urljoin(
            booking_url,
            destination_url,
        )

    allowed_booking_domains = (
        "airindia.com",
        "airindiaexpress.in",
        "easemytrip.com",
        "makemytrip.com",
        "goibibo.com",
        "yatra.com",
        "gotogate.com",
        "omanair.com",
        "spicejet.com",
        "paytm.com",
        "cleartrip.com",
    )

    def is_allowed_booking_url(url: str) -> bool:
        parsed = urlparse(url)
        hostname = (parsed.hostname or "").lower()

        return (
            parsed.scheme == "https"
            and bool(hostname)
            and parsed.username is None
            and parsed.password is None
            and any(
                hostname == domain or hostname.endswith("." + domain)
                for domain in allowed_booking_domains
            )
        )

    # Some Cleartrip links use an ad-tracking wrapper.
    if destination_url:
        destination = urlparse(destination_url)

        if (
            destination.scheme == "https"
            and destination.hostname
            and destination.hostname.lower() == "d.adx.io"
        ):
            wrapped_values = parse_qs(destination.query).get("xu", [])

            if wrapped_values:
                unwrapped_url = unquote(wrapped_values[0])
                if is_allowed_booking_url(unwrapped_url):
                    destination_url = unwrapped_url

    # SpiceJet may require an HTML form POST rather than a normal link.
    if form_action:
        form_action = requests.compat.urljoin(
            booking_url,
            form_action,
        )

        if is_allowed_booking_url(form_action):
            return {
                "type": "form",
                "provider": "SpiceJet",
                "form_action": form_action,
                "form_method": "POST",
                "form_fields": form_fields,
                "message": (
                    "This provider requires a form submission. "
                    "The frontend must submit the returned form fields."
                ),
            }

    if not destination_url:
        raise HTTPException(
            status_code=502,
            detail=(
                "The provider did not return a usable booking destination. "
                "Check the backend logs for its response format."
            ),
        )

    if not is_allowed_booking_url(destination_url):
        raise HTTPException(
            status_code=502,
            detail="The provider returned an unsupported booking destination.",
        )

    return {
        "type": "redirect",
        "url": destination_url,
    }


@app.post("/api/itinerary")
def create_itinerary(request: ItineraryRequest):
    destination = request.destination.strip()
    travel_style = request.travel_style.strip()

    if not destination:
        raise HTTPException(
            status_code=422,
            detail="Please enter a destination.",
        )

    if not travel_style:
        raise HTTPException(
            status_code=422,
            detail="Please select a travel style.",
        )

    def make_demo():
        return generate_demo_itinerary(
            destination=destination,
            days=request.days,
            budget=request.budget,
            travel_style=travel_style,
        )

    try:
        return generate_ai_itinerary(
            destination=destination,
            days=request.days,
            budget=request.budget,
            travel_style=travel_style,
        )

    except RateLimitError as exc:
        # Do not repeatedly retry an exhausted API credit balance.
        print(f"OpenAI quota/rate error: {exc}")
        return make_demo()

    except RuntimeError as exc:
        # A missing API key or another expected AI-service failure.
        print(f"AI service unavailable: {exc}")
        return make_demo()

    except Exception as exc:
        # Keep the application usable when the external AI service fails.
        print(f"AI provider error: {type(exc).__name__}: {exc}")
        return make_demo()


@app.post("/api/trips")
def save_trip(
    request: SaveTripRequest,
    db: Session = Depends(get_db),
):
    trip = SavedTrip(
        destination=request.destination.strip(),
        days=request.days,
        budget=request.budget,
        travel_style=request.travel_style,
        itinerary_json=json.dumps(request.itinerary),
    )

    db.add(trip)
    db.commit()
    db.refresh(trip)

    return {
        "message": "Trip saved successfully",
        "trip_id": trip.id,
    }


@app.get("/api/trips")
def get_saved_trips(db: Session = Depends(get_db)):
    trips = (
        db.query(SavedTrip)
        .order_by(SavedTrip.created_at.desc())
        .all()
    )

    return [
        {
            "id": trip.id,
            "destination": trip.destination,
            "days": trip.days,
            "budget": trip.budget,
            "travel_style": trip.travel_style,
            "itinerary": json.loads(trip.itinerary_json),
            "created_at": trip.created_at.isoformat(),
        }
        for trip in trips
    ]


@app.delete("/api/trips/{trip_id}")
def delete_trip(
    trip_id: int,
    db: Session = Depends(get_db),
):
    trip = (
        db.query(SavedTrip)
        .filter(SavedTrip.id == trip_id)
        .first()
    )

    if trip is None:
        raise HTTPException(
            status_code=404,
            detail="Saved trip not found in database.",
        )

    db.delete(trip)
    db.commit()

    return {
        "message": "Trip deleted successfully",
        "trip_id": trip_id,
    }


@app.put("/api/trips/{trip_id}")
def update_trip(
    trip_id: int,
    trip_data: TripUpdate,
    db: Session = Depends(get_db),
):
    saved_trip = (
        db.query(SavedTrip)
        .filter(SavedTrip.id == trip_id)
        .first()
    )

    if saved_trip is None:
        raise HTTPException(
            status_code=404,
            detail="Saved trip not found.",
        )

    destination = trip_data.destination.strip()
    travel_style = trip_data.travel_style.strip()

    if not destination or not travel_style:
        raise HTTPException(
            status_code=400,
            detail="Destination and travel style cannot be empty.",
        )

    # Generate a new itinerary matching the updated duration and budget.
    new_itinerary = build_itinerary(
        days=trip_data.days,
        budget=trip_data.budget,
    )

    saved_trip.destination = destination
    saved_trip.days = trip_data.days
    saved_trip.budget = trip_data.budget
    saved_trip.travel_style = travel_style
    saved_trip.itinerary_json = json.dumps(new_itinerary)

    try:
        db.commit()
        db.refresh(saved_trip)
    except Exception as error:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not update the saved trip.",
        ) from error

    return {
        "message": "Trip and itinerary updated successfully.",
        "trip_id": saved_trip.id,
        "destination": saved_trip.destination,
        "days": saved_trip.days,
        "budget": saved_trip.budget,
        "travel_style": saved_trip.travel_style,
        "itinerary": new_itinerary,
    }
