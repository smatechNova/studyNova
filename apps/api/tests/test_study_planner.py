from datetime import date, timedelta

from app.domain.study_planner import build_study_plan
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
    assert plan.metadata.required_daily_minutes > 0
    assert len(plan.subject_distribution) == 2
    assert sum(item.estimated_minutes for item in plan.subject_distribution) == plan.metadata.total_study_minutes


def test_build_study_plan_includes_study_sessions() -> None:
    plan = build_study_plan(_sample_request())
    first_day = plan.schedule[0]

    assert first_day.total_minutes <= 180
    assert any(session.kind == "study" for session in first_day.sessions)
    assert all(session.minutes > 0 for session in first_day.sessions)
