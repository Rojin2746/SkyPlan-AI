from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Literal
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException
from database import Base, engine, get_db
from models import SavedTrip
from ai_service import generate_ai_itinerary
from demo_itinerary import generate_demo_itinerary
from openai import RateLimitError
import os
import re
import requests

from dotenv import load_dotenv
from datetime import date, datetime

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

# Sample flight data for testing.
# These are NOT live flight prices.
FLIGHTS = [
    {
        "airline": "IndiGo",
        "code": "6E 204",
        "departure": "06:15",
        "arrival": "08:50",
        "duration": "2h 35m",
        "price": 4299,
        "stops": "Non-stop",
    },
    {
        "airline": "Air India",
        "code": "AI 672",
        "departure": "10:30",
        "arrival": "13:05",
        "duration": "2h 35m",
        "price": 5180,
        "stops": "Non-stop",
    },
    {
        "airline": "Akasa Air",
        "code": "QP 1384",
        "departure": "16:45",
        "arrival": "19:30",
        "duration": "2h 45m",
        "price": 4760,
        "stops": "Non-stop",
    },
]



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
    booking_token: str = Field(min_length=1, max_length=10000)

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
class ItineraryRequest(BaseModel):
    destination: str = Field(min_length=1, max_length=100)
    days: int = Field(ge=1, le=30)
    budget: float = Field(gt=0)
    travel_style: str = Field(min_length=1, max_length=100)

from pydantic import BaseModel, Field
from typing import Any

class SaveTripRequest(BaseModel):
    destination: str = Field(min_length=1, max_length=100)
    days: int = Field(ge=1, le=30)
    budget: float = Field(gt=0)
    travel_style: str = Field(min_length=1, max_length=100)
    itinerary: list[dict[str, Any]]

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

    except requests.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Flight search timed out. Please try again.",
        )

    except requests.RequestException:
        raise HTTPException(
            status_code=502,
            detail="Could not contact the flight-search service.",
        )

    except ValueError:
        raise HTTPException(
            status_code=502,
            detail="The flight-search service returned an invalid response.",
        )

    if data.get("error"):
        # Do not return the API key or the full request URL to the frontend.
        raise HTTPException(
            status_code=502,
            detail="The flight-search provider returned an error. "
                   "Check your SerpApi account and search parameters.",
        )

    itineraries = (
        data.get("best_flights") or []
    ) + (
        data.get("other_flights") or []
    )

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

    params = {
        "engine": "google_flights",
        "api_key": SERPAPI_KEY,
        "booking_token": request.booking_token,
        "currency": "INR",
        "hl": "en",
        "gl": "in",
    }

    try:
        response = requests.get(
            "https://serpapi.com/search",
            params=params,
            timeout=45,
        )
        response.raise_for_status()
        data = response.json()

    except requests.Timeout:
        raise HTTPException(
            status_code=504,
            detail="Retrieving booking options timed out. Please try again.",
        )

    except requests.RequestException:
        raise HTTPException(
            status_code=502,
            detail="Could not retrieve booking options from the provider.",
        )

    except ValueError:
        raise HTTPException(
            status_code=502,
            detail="The provider returned an invalid response.",
        )

    if data.get("error"):
        raise HTTPException(
            status_code=502,
            detail="The provider could not retrieve booking options for this flight.",
        )

    options = []

    for option in data.get("booking_options", []):
        # Some options offer one combined ticket; others offer separate tickets.
        for ticket_type in ("together", "departing"):
            ticket = option.get(ticket_type) or {}

            if not ticket:
                continue

            booking_request = ticket.get("booking_request") or {}

            options.append({
                "provider": ticket.get("book_with", "Booking provider"),
                "price": ticket.get("price"),
                "currency": "INR",
                "ticket_type": (
                    "Separate tickets" if option.get("separate_tickets")
                    else "Combined ticket"
                ),
                "booking_request": booking_request or None,
                "booking_phone": ticket.get("booking_phone"),
            })

            # Avoid duplicate combined-ticket entries.
            if ticket_type == "together":
                break

    return {
        "booking_options": options,
        "total_options": len(options),
        "message": (
            "Booking options retrieved. Prices and availability may change."
            if options
            else "No booking options were returned for this flight."
        ),
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
        result = generate_demo_itinerary(
            destination=destination,
            days=request.days,
            budget=request.budget,
            travel_style=travel_style,
        )
        return result

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


import json


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




class TripUpdate(BaseModel):
    destination: str = Field(min_length=1, max_length=100)
    days: int = Field(ge=1, le=30)
    budget: float = Field(gt=0)
    travel_style: str = Field(min_length=1, max_length=100)


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
