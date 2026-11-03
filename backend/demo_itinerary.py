
def generate_demo_itinerary(
    destination: str,
    days: int,
    budget: float,
    travel_style: str,
) -> dict:
    """Generate a local sample itinerary without an external AI service."""

    destination = destination.strip()
    daily_budget = round(budget / days, 2)

    activities = [
        (
            "Explore a popular local landmark",
            "Visit a museum, garden, or cultural attraction",
            "Enjoy an evening walk around a lively neighbourhood",
        ),
        (
            "Discover a scenic viewpoint or historic site",
            "Explore a local market or shopping district",
            "Relax at a public park or waterfront",
        ),
        (
            "Visit another well-known attraction",
            "Explore the destination at your own pace",
            "Enjoy local food and a relaxed evening",
        ),
    ]

    itinerary = []

    for day_number in range(1, days + 1):
        morning, afternoon, evening = activities[
            (day_number - 1) % len(activities)
        ]

        itinerary.append(
            {
                "day": day_number,
                "morning": f"{morning} in {destination}.",
                "afternoon": f"{afternoon} in {destination}.",
                "evening": f"{evening} in {destination}.",
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
        "demo": True,
        "ai_generated": False,
        "message": (
            "Local demo itinerary. Activities and prices are not "
            "verified in real time."
        ),
    }
