from datetime import date, timedelta

from app.domain.study_planner import build_study_plan
from app.schemas import StudyPlanRequest, StudySessionCompletionRequest, SubjectInput, TopicInput
from app.storage import StudyPlanStore


def _sample_request() -> StudyPlanRequest:
    return StudyPlanRequest(
        student_profile={"name": "Alliyah", "class_level": "SS2", "age": 15},
        exam_start_date=date.today() + timedelta(days=14),
        exam_end_date=date.today() + timedelta(days=18),
        available_daily_minutes=120,
        subjects=[
            SubjectInput(
                name="Mathematics",
                topics=[
                    TopicInput(name="Algebra", pages=12, priority=5, resource_type="Textbook"),
                    TopicInput(name="Geometry", pages=10, priority=4, resource_type="Class notes"),
                ],
            )
        ],
    )


def test_study_plan_store_tracks_session_progress(tmp_path) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    saved_plan = store.save(build_study_plan(_sample_request()))
    first_day = saved_plan.plan.schedule[0]
    first_session = first_day.sessions[0]

    empty_progress = store.progress(saved_plan.id)

    assert empty_progress is not None
    assert empty_progress.completed_sessions == 0
    assert empty_progress.completed_minutes == 0

    completion = store.complete_session(
        saved_plan.id,
        StudySessionCompletionRequest(
            session_key=f"{first_day.study_date}:0",
            study_date=first_day.study_date,
            kind=first_session.kind,
            subject=first_session.subject,
            topic=first_session.topic,
            resource_type=first_session.resource_type,
            minutes_planned=first_session.minutes,
            minutes_completed=first_session.minutes,
            recall_note="I can explain the main steps from this session.",
            confidence=4,
        ),
    )
    progress = store.progress(saved_plan.id)

    assert completion.plan_id == saved_plan.id
    assert progress is not None
    assert progress.completed_sessions == 1
    assert progress.completed_minutes == first_session.minutes
    assert f"{first_day.study_date}:0" in progress.completed_session_keys
    assert progress.daily[0].completed_sessions == 1

    assert store.delete_completion(saved_plan.id, f"{first_day.study_date}:0") is True
    reset_progress = store.progress(saved_plan.id)

    assert reset_progress is not None
    assert reset_progress.completed_sessions == 0
