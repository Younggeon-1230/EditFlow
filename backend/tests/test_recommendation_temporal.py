import json
from datetime import date

import pytest

from app.schemas.content_idea_recommendation import ContentIdeaRecommendationRequest
from app.services.content_idea_recommendations import build_recommendation_prompt
from app.services.recommendation_temporal import (
    KOREA_TIMEZONE,
    build_temporal_context,
    season_for_month,
)


@pytest.mark.parametrize(
    ("month", "expected_season"),
    [
        (1, "겨울"),
        (2, "겨울"),
        (3, "봄"),
        (4, "봄"),
        (5, "봄"),
        (6, "여름"),
        (8, "여름"),
        (9, "가을"),
        (11, "가을"),
        (12, "겨울"),
    ],
)
def test_season_for_month_boundaries(month: int, expected_season: str) -> None:
    assert season_for_month(month) == expected_season


@pytest.mark.parametrize("month", [0, 13])
def test_season_for_month_rejects_invalid_month(month: int) -> None:
    with pytest.raises(ValueError):
        season_for_month(month)


def test_temporal_context_uses_fixed_date_and_korean_timezone_policy() -> None:
    context = build_temporal_context(date(2026, 9, 1))

    assert context.current_date == date(2026, 9, 1)
    assert context.year == 2026
    assert context.month == 9
    assert context.season == "가을"
    assert KOREA_TIMEZONE.utcoffset(None).total_seconds() == 9 * 60 * 60
    assert KOREA_TIMEZONE.tzname(None) == "Asia/Seoul"


@pytest.mark.parametrize(
    ("current_date", "expected_season"),
    [
        (date(2026, 1, 15), "겨울"),
        (date(2026, 4, 10), "봄"),
        (date(2026, 6, 20), "여름"),
        (date(2026, 9, 1), "가을"),
        (date(2026, 12, 20), "겨울"),
    ],
)
def test_temporal_context_accepts_fixed_test_dates(
    current_date: date,
    expected_season: str,
) -> None:
    assert build_temporal_context(current_date).season == expected_season


def test_prompt_contains_trusted_temporal_policy_without_changing_user_input() -> None:
    reference_context = (
        "선택한 콘텐츠 장르: 지식/정보/교육\n"
        "선택한 세부 관심사: 역사/교양\n\n"
        "사용자 추가 설명:\n초보자가 이해하기 쉽게"
    )
    request = ContentIdeaRecommendationRequest(
        topic="역사 콘텐츠",
        reference_context=reference_context,
        recommendation_count=5,
    )

    prompt = build_recommendation_prompt(
        request,
        current_date=date(2026, 6, 20),
    )

    assert "현재 날짜 2026-06-20" in prompt.developer
    assert "현재 연도 2026년" in prompt.developer
    assert "현재 월 6월" in prompt.developer
    assert "현재 계절 여름" in prompt.developer
    assert "evergreen" in prompt.developer
    assert "1~2개 정도만 시기성 소재" in prompt.developer
    assert "계절성을 억지로 넣지 마세요" in prompt.developer
    assert "역사적 사건의 날짜와 사실을 추측하거나 만들지 말고" in prompt.developer
    assert "최신 뉴스·현재 진행 중인 이벤트" in prompt.developer
    assert "검색량·증가율·트렌드 수치를 지어내지 말고" in prompt.developer

    user_payload = json.loads(prompt.user)["untrusted_user_input"]
    assert user_payload["reference_context"] == reference_context
    assert user_payload == request.model_dump(mode="json")
