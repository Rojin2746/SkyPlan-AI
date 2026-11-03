import json
import os

from dotenv import load_dotenv
from openai import OpenAI

# Load the private API key from backend/.env
load_dotenv()

API_KEY = os.getenv("OPENAI_API_KEY")
MODEL_NAME = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

client = OpenAI(api_key=API_KEY) if API_KEY else None


def generate_ai_itinerary(
    destination: str,
    days: int,
    budget: float,
    travel_style: str,
) -> dict:
    """Generate a destination-specific itinerary using OpenAI."""

    if client is None:
        raise RuntimeError(
            "OPENAI_API_KEY is missing. Check backend/.env."
        )

    daily_budget = round(budget / days, 2)

    system_message = (
        "You are SkyPlan AI, a helpful travel itinerary planner.\n\n"
        "Create practical, destination-specific travel suggestions.\n"
        "Respect the traveler's budget and travel style.\n"
        "Provide morning, afternoon, and evening activities for each day.\n"
        "Avoid repeating activities unnecessarily.\n"
        "Do not claim that prices, opening hours, or bookings are verified live.\n\n"
        "Return a JSON object in this exact format:\n"
        '{\n'
        '  "itinerary": [\n'
        '    {\n'
        '      "day": 1,\n'
        '      "morning": "Activity and explanation",\n'
        '      "afternoon": "Activity and explanation",\n'
        '      "evening": "Activity and explanation"\n'
        '    }\n'
        '  ]\n'
        '}\n\n'
        "Return exactly the requested number of days.\n"
        "Use consecutive day numbers starting at 1.\n"
        "All activity fields must be strings."
    )

    user_message = (
        f"Return the itinerary as a JSON object.\n"
        f"Destination: {destination}\n"
        f"Number of days: {days}\n"
        f"Total budget: {budget}\n"
        f"Approximate daily budget: {daily_budget}\n"
        f"Travel style: {travel_style}\n\n"
        f"Generate the itinerary."
    )

    response = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
        response_format={"type": "json_object"},
    )

    raw_text = response.choices[0].message.content or ""

    if not raw_text:
        raise RuntimeError("The AI returned an empty response.")

    try:
        result = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise RuntimeError("The AI returned invalid JSON.") from exc

    days_data = result.get("itinerary")

    if not isinstance(days_data, list) or len(days_data) != days:
        raise RuntimeError(
            "The AI returned an itinerary with an incorrect number of days."
        )

    itinerary = []

    for index, item in enumerate(days_data, start=1):
        if not isinstance(item, dict):
            raise RuntimeError("The AI returned an invalid itinerary day.")

        itinerary.append(
            {
                "day": index,
                "morning": str(item.get("morning", "")),
                "afternoon": str(item.get("afternoon", "")),
                "evening": str(item.get("evening", "")),
                "estimated_budget": daily_budget,
            }
        )

    return {
        "destination": destination,
        "days": days,
        "total_budget": budget,
        "travel_style": travel_style,
        "daily_budget": daily_budget,
        "itinerary": itinerary,
        "demo": False,
        "ai_generated": True,
    }
