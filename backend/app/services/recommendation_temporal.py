from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone


KOREA_TIMEZONE = timezone(timedelta(hours=9), name="Asia/Seoul")


@dataclass(frozen=True)
class RecommendationTemporalContext:
    current_date: date
    year: int
    month: int
    season: str


def get_current_date() -> date:
    """Return the trusted server-side calendar date for the Korean MVP."""
    return datetime.now(KOREA_TIMEZONE).date()


def season_for_month(month: int) -> str:
    if month not in range(1, 13):
        raise ValueError("month must be between 1 and 12")
    if month in (3, 4, 5):
        return "봄"
    if month in (6, 7, 8):
        return "여름"
    if month in (9, 10, 11):
        return "가을"
    return "겨울"


def build_temporal_context(current_date: date) -> RecommendationTemporalContext:
    return RecommendationTemporalContext(
        current_date=current_date,
        year=current_date.year,
        month=current_date.month,
        season=season_for_month(current_date.month),
    )
