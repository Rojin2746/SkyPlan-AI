from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from database import Base

class SavedTrip(Base):
    __tablename__ = "saved_trips"

    id = Column(Integer, primary_key=True, index=True)
    destination = Column(String(100), nullable=False)
    days = Column(Integer, nullable=False)
    budget = Column(Float, nullable=False)
    travel_style = Column(String(100), nullable=False)
    itinerary_json = Column(Text, nullable=False)
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
    )
