
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Store the database inside the backend folder.
BASE_DIR = Path(__file__).resolve().parent
DATABASE_URL = f"sqlite:///{BASE_DIR / 'skyplan.db'}"

# Connect Python to SQLite.
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)

# Create database sessions.
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Base class for database tables.
Base = declarative_base()


# Provide a database session to API endpoints.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
