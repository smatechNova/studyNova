from datetime import date, timedelta
from math import ceil

import pytest
from fastapi import HTTPException

from app.domain.study_planner import build_rebalanced_study_plan, build_study_plan
from app.schemas import StudyPlanRequest, SubjectInput, TopicInput


def _sample_request() -> StudyPlanRequest:
    return StudyPlanRequest(
        student_profile={"name": "Alliyah", "class_level": "SS2", "age": 15},
        exam_start_date=date.today() + timedelta(days=30),
        exam_end_date=date.today() + timedelta(days=35),
        available_daily_minutes=180,
        study_strength_note="I read faster in the morning.",
        subjects=[
            SubjectInput(
                name="Mathematics",
                topics=[
                    TopicInput(name="Algebra", pages=25, priority=5, resource_type="Textbook"),
                    TopicInput(name="Geometry", pages=18, priority=4, resource_type="Class notes"),
                ],
            ),
            SubjectInput(
                name="English",
                topics=[
                    TopicInput(name="Comprehension", pages=15, priority=3),
                    TopicInput(name="Essay Writing", pages=10, priority=4),
                ],
            ),
        ],
    )


def test_build_study_plan_returns_balanced_metadata() -> None:
    plan = build_study_plan(_sample_request())

    assert plan.metadata.student_name == "Alliyah"
    assert plan.metadata.class_level == "SS2"
    assert plan.metadata.days_until_exam == 30
    assert plan.metadata.exam_end_date == date.today() + timedelta(days=35)
    assert "Textbook" in plan.metadata.resources_used
    assert plan.metadata.total_study_minutes > 0
    assert plan.metadata.average_daily_minutes == ceil(plan.metadata.total_study_minutes / 30)
    assert plan.metadata.required_daily_minutes > 0
    assert len(plan.subject_distribution) == 2
    assert sum(item.estimated_minutes for item in plan.subject_distribution) == plan.metadata.total_study_minutes


def test_build_study_plan_includes_study_sessions() -> None:
    plan = build_study_plan(_sample_request())
    first_day = plan.schedule[0]

    assert len(plan.schedule) == 30
    assert first_day.total_minutes <= 180
    assert any(session.kind == "study" for session in first_day.sessions)
    assert all(session.minutes > 0 for session in first_day.sessions)


def test_build_study_plan_fills_flex_days_with_practice() -> None:
    plan = build_study_plan(_sample_request())
    sessions = [session for day in plan.schedule for session in day.sessions]

    assert all(day.total_minutes > 0 for day in plan.schedule)
    assert any(session.kind == "practice" for session in sessions)
    assert any(session.resource_type == "Past questions" for session in sessions)
    assert any(session.topic.startswith("Weak-area study:") for session in sessions)


def test_build_study_plan_rejects_app_error_text_as_topic() -> None:
    payload = _sample_request()
    payload.subjects[0].topics[0].name = "Could not generate the plan. Check the API connection and exam dates."

    with pytest.raises(HTTPException) as exc_info:
        build_study_plan(payload)

    assert exc_info.value.status_code == 422
    assert "real topic" in str(exc_info.value.detail)


def test_rebalanced_study_plan_moves_missed_sessions_to_remaining_days() -> None:
    plan = build_study_plan(_sample_request())
    today = date.today() + timedelta(days=3)
    first_day = plan.schedule[0]
    completed_keys = {f"{first_day.study_date}:0"}
    original_sessions = [session for day in plan.schedule for session in day.sessions]
    completed_session = first_day.sessions[0]

    rebalanced = build_rebalanced_study_plan(plan, completed_keys, today=today)
    rescheduled_sessions = [session for day in rebalanced.schedule for session in day.sessions]

    assert len(rebalanced.schedule) == (plan.metadata.exam_start_date - today).days
    assert all(day.study_date >= today for day in rebalanced.schedule)
    assert rebalanced.metadata.recommendation.startswith("Plan rebalanced after missed sessions.")
    assert len(rescheduled_sessions) == len(original_sessions) - 1
    assert rebalanced.metadata.total_study_minutes == (
        sum(session.minutes for session in original_sessions) - completed_session.minutes
    )
    assert any(day.study_date == today and day.sessions for day in rebalanced.schedule)


def test_rebalanced_study_plan_warns_when_recovery_is_unrealistic() -> None:
    payload = _sample_request()
    payload.exam_start_date = date.today() + timedelta(days=6)
    payload.exam_end_date = date.today() + timedelta(days=8)
    payload.available_daily_minutes = 30
    payload.subjects[0].topics[0].pages = 120
    plan = build_study_plan(payload)

    rebalanced = build_rebalanced_study_plan(plan, set(), today=date.today() + timedelta(days=3))

    assert rebalanced.metadata.status == "behind"
    assert rebalanced.metadata.daily_gap_minutes > 0
    assert "above the student's available time" in rebalanced.metadata.recommendation
