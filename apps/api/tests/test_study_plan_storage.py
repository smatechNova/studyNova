from datetime import date, timedelta

from app.domain.study_planner import build_study_plan
from app.schemas import StudyPlanRequest, SubjectInput, TopicInput
from app.storage import StudyPlanStore


def _request(student_name: str, pages: int) -> StudyPlanRequest:
    return StudyPlanRequest(
        student_profile={
            "name": student_name,
            "class_level": "SS2",
            "age": 15,
            "parent_name": "Mrs Olaniyan",
            "parent_contact": "08012345678",
        },
        exam_start_date=date.today() + timedelta(days=30),
        exam_end_date=date.today() + timedelta(days=35),
        available_daily_minutes=180,
        minutes_per_page=5,
        session_minutes=45,
        break_minutes=10,
        study_strength_note="I understand faster when I summarize each page.",
        subjects=[
            SubjectInput(
                name="Mathematics",
                topics=[TopicInput(name="Algebra", pages=pages, resource_type="Textbook")],
            )
        ],
    )


def test_store_keeps_setup_payload_with_saved_plan(tmp_path) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.db"))
    payload = _request("Alliyah", 25)
    plan = build_study_plan(payload)

    saved = store.save(plan, student_id="student-1", setup_payload=payload)
    latest = store.latest(student_id="student-1")

    assert latest is not None
    assert latest.id == saved.id
    assert latest.setup_payload is not None
    assert latest.setup_payload.student_profile is not None
    assert latest.setup_payload.student_profile.name == "Alliyah"
    assert latest.setup_payload.subjects[0].topics[0].pages == 25


def test_store_returns_plan_history_newest_first(tmp_path) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.db"))
    first_payload = _request("Alliyah", 20)
    second_payload = _request("Alliyah", 30)

    first = store.save(build_study_plan(first_payload), student_id="student-1", setup_payload=first_payload)
    second = store.save(build_study_plan(second_payload), student_id="student-1", setup_payload=second_payload)

    history = store.history(student_id="student-1")

    assert [item.id for item in history] == [second.id, first.id]
    assert history[0].setup_payload is not None
    assert history[0].setup_payload.subjects[0].topics[0].pages == 30
