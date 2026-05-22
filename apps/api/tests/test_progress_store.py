from datetime import date, timedelta

from app.domain.study_planner import build_study_plan
from app.schemas import (
    CheckInRequest,
    ParentAccountCreate,
    ParentStudentLinkCreate,
    StudentAccountCreate,
    StudyReminderSettingsUpdate,
    StudyPlanRequest,
    StudySessionCompletionRequest,
    SubjectInput,
    TopicInput,
)
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


def test_study_plan_progress_reports_missed_sessions(tmp_path) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    plan = build_study_plan(_sample_request())
    plan.schedule[0].study_date = date.today() - timedelta(days=1)
    saved_plan = store.save(plan)
    first_day = saved_plan.plan.schedule[0]
    first_session = first_day.sessions[0]

    store.complete_session(
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
            recall_note="I can explain the core idea from the first session.",
            confidence=4,
        ),
    )
    progress = store.progress(saved_plan.id)

    assert progress is not None
    assert progress.missed_sessions_count == len(first_day.sessions) - 1
    assert progress.missed_minutes == sum(session.minutes for session in first_day.sessions[1:])
    assert progress.daily[0].status == "missed"
    assert progress.daily[0].missed_sessions == len(first_day.sessions) - 1
    assert all(session.days_overdue == 1 for session in progress.missed_sessions)


def test_study_plan_store_persists_reminder_settings(tmp_path) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    saved_plan = store.save(build_study_plan(_sample_request()))

    default_settings = store.reminder_settings(saved_plan.id)
    updated_settings = store.upsert_reminder_settings(
        saved_plan.id,
        StudyReminderSettingsUpdate(
            reminders_enabled=True,
            reminder_time="19:30",
            reminder_minutes_before=30,
            missed_session_alerts_enabled=True,
            missed_session_followup_time="21:00",
            parent_alerts_enabled=False,
        ),
    )

    assert default_settings is not None
    assert default_settings.reminder_time == "18:00"
    assert updated_settings is not None
    assert updated_settings.reminder_time == "19:30"
    assert updated_settings.reminder_minutes_before == 30
    assert updated_settings.parent_alerts_enabled is False
    assert store.reminder_settings(saved_plan.id) == updated_settings


def test_study_plan_store_persists_check_ins_for_parent_summary(tmp_path) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    student = store.create_student_account(
        StudentAccountCreate(
            login_id="alliyah@example.com",
            access_code="1234",
            name="Alliyah Olaniyan",
            class_level="SS2 Science",
            age=15,
            school_name="",
        )
    )
    parent = store.create_parent_account(
        ParentAccountCreate(
            name="Mrs Olaniyan",
            contact="08012345678",
            access_code="4321",
            relationship="Mother",
        )
    )
    store.link_parent_student(ParentStudentLinkCreate(parent_id=parent.id, student_id=student.id))

    yesterday = date.today() - timedelta(days=1)
    today = date.today()
    first_check_in = store.create_check_in(
        CheckInRequest(
            student_id=student.id,
            study_date=yesterday,
            minutes_completed=30,
            sessions_completed=1,
            sessions_planned=2,
            note="Reviewed yesterday's algebra practice.",
        )
    )
    second_check_in = store.create_check_in(
        CheckInRequest(
            student_id=student.id,
            study_date=today,
            minutes_completed=45,
            sessions_completed=2,
            sessions_planned=2,
            note="Finished today's reading and recall note.",
        )
    )

    summary = store.parent_progress_summary(parent.id, student.id)

    assert first_check_in.saved is True
    assert second_check_in.saved is True
    assert summary is not None
    assert summary.total_minutes == 75
    assert summary.completion_rate == 75
    assert summary.streak_days == 2
    assert summary.latest_note == "Finished today's reading and recall note."


def test_study_plan_store_rejects_unlinked_parent_summary(tmp_path) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    student = store.create_student_account(
        StudentAccountCreate(
            login_id="alliyah@example.com",
            access_code="1234",
            name="Alliyah Olaniyan",
            class_level="SS2 Science",
            age=15,
            school_name="",
        )
    )
    parent = store.create_parent_account(
        ParentAccountCreate(
            name="Mrs Olaniyan",
            contact="08012345678",
            access_code="4321",
            relationship="Mother",
        )
    )

    assert store.parent_progress_summary(parent.id, student.id) is None
