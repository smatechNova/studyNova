from datetime import date, timedelta
import sqlite3

from app.domain.study_planner import build_study_plan
from app.schemas import (
    AccountDeletionRequestCreate,
    AccountDeletionReviewRequest,
    AccountRecoveryRequestCreate,
    AccountRecoveryReviewRequest,
    AccountSignInRequest,
    CheckInRequest,
    ParentAccountCreate,
    ParentStudentLinkCreate,
    StudentAccountCreate,
    StudyPlanRequest,
    StudyReminderSettingsUpdate,
    StudySessionCompletionRequest,
    SubjectInput,
    TesterFeedbackCreate as FeedbackCreate,
    TesterFeedbackReviewRequest as FeedbackReviewRequest,
    TopicInput,
)
from app.storage import StudyPlanStore


def test_study_plan_store_links_parent_and_student_accounts(tmp_path) -> None:
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

    link = store.link_parent_student(ParentStudentLinkCreate(parent_id=parent.id, student_id=student.id))
    family = store.latest_family()

    assert link is not None
    assert family.link is not None
    assert family.parent is not None
    assert family.student is not None
    assert family.parent.id == parent.id
    assert family.student.id == student.id
    assert family.student.name == "Alliyah Olaniyan"


def test_study_plan_store_rejects_missing_account_link(tmp_path) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))

    link = store.link_parent_student(
        ParentStudentLinkCreate(parent_id="missing-parent", student_id="missing-student")
    )

    assert link is None


def test_study_plan_store_reuses_existing_accounts(tmp_path) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    student_payload = StudentAccountCreate(
        login_id="alliyah@example.com",
        access_code="1234",
        name="Alliyah Olaniyan",
        class_level="SS2 Science",
        age=15,
        school_name="StudyNova School",
    )
    parent_payload = ParentAccountCreate(
        name="Mrs Olaniyan",
        contact="080 1234 5678",
        access_code="4321",
        relationship="Mother",
    )

    first_student = store.create_student_account(student_payload)
    first_parent = store.create_parent_account(parent_payload)
    second_student = store.create_student_account(
        StudentAccountCreate(
            login_id="alliyah@example.com",
            access_code="1234",
            name="  alliyah   olaniyan ",
            class_level="ss2 science",
            age=15,
            school_name="studynova school",
        )
    )
    second_parent = store.create_parent_account(
        ParentAccountCreate(
            name="Mrs A. Olaniyan",
            contact="08012345678",
            access_code="4321",
            relationship="Guardian",
        )
    )

    assert second_student.id == first_student.id
    assert second_parent.id == first_parent.id


def test_study_plan_store_lists_multiple_students_for_one_parent(tmp_path) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    parent = store.create_parent_account(
        ParentAccountCreate(
            name="Mrs Olaniyan",
            contact="08012345678",
            access_code="4321",
            relationship="Mother",
        )
    )
    first_student = store.create_student_account(
        StudentAccountCreate(
            login_id="alliyah@example.com",
            access_code="1234",
            name="Alliyah Olaniyan",
            class_level="SS2 Science",
            age=15,
            school_name="",
        )
    )
    second_student = store.create_student_account(
        StudentAccountCreate(
            login_id="aminah@example.com",
            access_code="5678",
            name="Aminah Olaniyan",
            class_level="JSS3",
            age=13,
            school_name="",
        )
    )

    store.link_parent_student(ParentStudentLinkCreate(parent_id=parent.id, student_id=first_student.id))
    store.link_parent_student(ParentStudentLinkCreate(parent_id=parent.id, student_id=second_student.id))

    family = store.parent_family(parent.id)
    latest_parent_family = store.latest_parent_family()

    assert family.parent is not None
    assert family.parent.id == parent.id
    assert {student.id for student in family.students} == {first_student.id, second_student.id}
    assert len(family.links) == 2
    assert latest_parent_family.parent is not None
    assert latest_parent_family.parent.id == parent.id
    assert {student.id for student in latest_parent_family.students} == {first_student.id, second_student.id}


def test_study_plan_store_signs_in_by_role_and_login_id(tmp_path) -> None:
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

    student_session = store.sign_in(
        AccountSignInRequest(role="student", login_id="alliyah@example.com", access_code="1234")
    )
    parent_session = store.sign_in(AccountSignInRequest(role="parent", login_id="080 1234 5678", access_code="4321"))
    rejected_session = store.sign_in(
        AccountSignInRequest(role="student", login_id="alliyah@example.com", access_code="9999")
    )

    assert student_session is not None
    assert student_session.role == "student"
    assert student_session.student is not None
    assert student_session.student.id == student.id
    assert parent_session is not None
    assert parent_session.role == "parent"
    assert parent_session.parent is not None
    assert parent_session.parent.id == parent.id
    assert [linked_student.id for linked_student in parent_session.students] == [student.id]
    assert rejected_session is None


def test_study_plan_store_records_account_recovery_request_privately(tmp_path) -> None:
    database_path = tmp_path / "studynova.sqlite3"
    store = StudyPlanStore(str(database_path))
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

    receipt = store.create_account_recovery_request(
        AccountRecoveryRequestCreate(
            role="student",
            login_id="ALLIYAH@example.com",
            contact="parent@example.com",
            note="Forgot the access code.",
        )
    )
    missing_receipt = store.create_account_recovery_request(
        AccountRecoveryRequestCreate(
            role="student",
            login_id="missing@example.com",
            contact="parent@example.com",
        )
    )

    assert receipt.status == "received"
    assert missing_receipt.status == "received"
    assert "exposing account details" in receipt.message

    with sqlite3.connect(database_path) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            """
            select role, login_id, contact, note, matched_account_id, status, reviewed_at, admin_note
            from account_recovery_requests
            order by created_at asc
            """
        ).fetchall()

    assert [row["matched_account_id"] for row in rows] == [student.id, None]
    assert rows[0]["note"] == "Forgot the access code."
    assert rows[0]["status"] == "open"
    assert rows[0]["reviewed_at"] is None
    assert rows[0]["admin_note"] == ""

    recovery_requests = store.account_recovery_requests()
    assert len(recovery_requests) == 2
    assert recovery_requests[0].matched_account is False
    assert recovery_requests[1].matched_account is True
    assert recovery_requests[1].status == "open"

    reviewed_request = store.review_account_recovery_request(
        recovery_requests[1].id,
        AccountRecoveryReviewRequest(admin_note="Called parent and confirmed the account."),
    )

    assert reviewed_request is not None
    assert reviewed_request.status == "reviewed"
    assert reviewed_request.admin_note == "Called parent and confirmed the account."
    assert reviewed_request.reviewed_at is not None


def test_study_plan_store_records_and_reviews_tester_feedback(tmp_path) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))

    receipt = store.create_tester_feedback(
        FeedbackCreate(
            tester_name="Abeeb",
            contact="tester@example.com",
            role="parent",
            device_model="Redmi Note 12",
            android_version="Android 14",
            category="parent",
            rating=4,
            what_worked="Parent dashboard showed the latest recall note.",
            what_failed="I was not sure how to find the invite code.",
            improvement="Add a shorter parent linking guide.",
            recommend=True,
            message="Useful for exam preparation.",
        )
    )

    feedback_items = store.tester_feedback_requests()
    reviewed_feedback = store.review_tester_feedback(
        receipt.id,
        FeedbackReviewRequest(status="reviewed", admin_note="Add linking copy to next build."),
    )

    assert receipt.status == "received"
    assert feedback_items[0].id == receipt.id
    assert feedback_items[0].status == "open"
    assert feedback_items[0].rating == 4
    assert feedback_items[0].recommend is True
    assert reviewed_feedback is not None
    assert reviewed_feedback.status == "reviewed"
    assert reviewed_feedback.reviewed_at is not None
    assert reviewed_feedback.admin_note == "Add linking copy to next build."


def test_study_plan_store_completes_student_account_deletion_with_scoped_cleanup(tmp_path) -> None:
    database_path = tmp_path / "studynova.sqlite3"
    store = StudyPlanStore(str(database_path))
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
            contact="parent@example.com",
            access_code="4321",
            relationship="Mother",
        )
    )
    link = store.link_parent_student(ParentStudentLinkCreate(parent_id=parent.id, student_id=student.id))
    invite = store.create_parent_invite_code(student.id)
    plan_request = StudyPlanRequest(
        student_profile={"name": "Alliyah Olaniyan", "class_level": "SS2", "age": 15},
        exam_start_date=date.today() + timedelta(days=7),
        exam_end_date=date.today() + timedelta(days=10),
        available_daily_minutes=90,
        subjects=[
            SubjectInput(
                name="Mathematics",
                topics=[TopicInput(name="Algebra", pages=10, priority=5, resource_type="Textbook")],
            )
        ],
    )
    saved_plan = store.save(build_study_plan(plan_request), student_id=student.id, setup_payload=plan_request)
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
            recall_note="I can explain the study session before deletion.",
            confidence=4,
        ),
    )
    store.upsert_reminder_settings(saved_plan.id, StudyReminderSettingsUpdate(reminder_time="19:30"))
    store.create_check_in(
        CheckInRequest(
            student_id=student.id,
            study_date=date.today(),
            minutes_completed=30,
            sessions_completed=1,
            sessions_planned=1,
            note="Completed one session.",
        )
    )

    receipt = store.create_account_deletion_request(
        "student",
        student.id,
        AccountDeletionRequestCreate(
            contact="parent@example.com",
            reason="No longer using the test account.",
            confirmation="DELETE",
        ),
    )
    duplicate_receipt = store.create_account_deletion_request(
        "student",
        student.id,
        AccountDeletionRequestCreate(
            contact="parent@example.com",
            reason="Second request.",
            confirmation="DELETE",
        ),
    )

    assert link is not None
    assert invite is not None
    assert receipt is not None
    assert duplicate_receipt is not None
    assert duplicate_receipt.id == receipt.id
    assert store.parent_family(parent.id).students[0].id == student.id
    assert store.progress(saved_plan.id) is not None

    deletion_requests = store.account_deletion_requests()
    assert len(deletion_requests) == 1
    assert deletion_requests[0].role == "student"
    assert deletion_requests[0].account_label == "Alliyah Olaniyan"
    assert deletion_requests[0].login_id == "alliyah@example.com"
    assert deletion_requests[0].status == "pending"

    reviewed_request = store.review_account_deletion_request(
        deletion_requests[0].id,
        AccountDeletionReviewRequest(status="reviewed", admin_note="Verified parent contact."),
    )

    assert reviewed_request is not None
    assert reviewed_request.status == "reviewed"
    assert reviewed_request.completed_at is None
    assert store.student_account_by_id(student.id) is not None
    assert store.parent_family(parent.id).students[0].id == student.id

    completed_request = store.review_account_deletion_request(
        deletion_requests[0].id,
        AccountDeletionReviewRequest(status="completed", admin_note="Completed after manual data removal."),
    )

    assert completed_request is not None
    assert completed_request.status == "completed"
    assert completed_request.completed_at is not None
    assert store.student_account_by_id(student.id) is None
    assert store.parent_account_by_id(parent.id) is not None
    assert store.parent_family(parent.id).students == []
    assert store.student_family(student.id).student is None
    assert store.latest(student_id=student.id) is None
    assert store.progress(saved_plan.id) is None

    idempotent_request = store.review_account_deletion_request(
        deletion_requests[0].id,
        AccountDeletionReviewRequest(status="completed", admin_note="Repeated support click."),
    )

    assert idempotent_request is not None
    assert idempotent_request.status == "completed"

    with sqlite3.connect(database_path) as connection:
        tables = {
            "saved_study_plans": ("student_id", student.id),
            "study_session_completions": ("plan_id", saved_plan.id),
            "study_reminder_settings": ("plan_id", saved_plan.id),
            "study_check_ins": ("student_id", student.id),
            "parent_student_links": ("student_id", student.id),
            "parent_invite_codes": ("student_id", student.id),
        }
        counts = {
            table: connection.execute(f"select count(*) from {table} where {column} = ?", (value,)).fetchone()[0]
            for table, (column, value) in tables.items()
        }

    assert counts == {
        "saved_study_plans": 0,
        "study_session_completions": 0,
        "study_reminder_settings": 0,
        "study_check_ins": 0,
        "parent_student_links": 0,
        "parent_invite_codes": 0,
    }


def test_study_plan_store_completes_parent_account_deletion_without_deleting_students(tmp_path) -> None:
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
            contact="parent@example.com",
            access_code="4321",
            relationship="Mother",
        )
    )
    link = store.link_parent_student(ParentStudentLinkCreate(parent_id=parent.id, student_id=student.id))
    receipt = store.create_account_deletion_request(
        "parent",
        parent.id,
        AccountDeletionRequestCreate(
            contact="parent@example.com",
            reason="Parent no longer wants monitoring access.",
            confirmation="DELETE",
        ),
    )

    assert link is not None
    assert receipt is not None
    assert store.student_family(student.id).parent is not None

    completed_request = store.review_account_deletion_request(
        receipt.id,
        AccountDeletionReviewRequest(status="completed", admin_note="Parent request verified."),
    )

    assert completed_request is not None
    assert completed_request.status == "completed"
    assert store.parent_account_by_id(parent.id) is None
    assert store.student_account_by_id(student.id) is not None
    assert store.student_family(student.id).parent is None


def test_study_plan_store_reports_health_and_creates_backup(tmp_path) -> None:
    database_path = tmp_path / "studynova.sqlite3"
    backup_path = tmp_path / "backups"
    store = StudyPlanStore(str(database_path))
    store.create_student_account(
        StudentAccountCreate(
            login_id="alliyah@example.com",
            access_code="1234",
            name="Alliyah Olaniyan",
            class_level="SS2 Science",
            age=15,
            school_name="",
        )
    )

    health = store.storage_health(str(backup_path), production=True)
    backup = store.create_backup(str(backup_path))

    assert health.database_exists is True
    assert health.database_size_bytes > 0
    assert health.production_ready is True
    assert backup.filename.startswith("studynova-")
    assert backup.size_bytes > 0
    assert store.list_backups(str(backup_path))[0].filename == backup.filename

    with sqlite3.connect(backup.backup_path) as connection:
        row = connection.execute("select count(*) from student_accounts").fetchone()

    assert row is not None
    assert row[0] == 1


def test_study_plan_store_binds_firebase_identity_by_role(tmp_path) -> None:
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
            contact="parent@example.com",
            access_code="4321",
            relationship="Mother",
        )
    )
    store.link_parent_student(ParentStudentLinkCreate(parent_id=parent.id, student_id=student.id))

    student_session = store.firebase_sign_in("student", "firebase-student-1", "alliyah@example.com")
    parent_session = store.firebase_sign_in("parent", "firebase-parent-1", "parent@example.com")
    blocked_parent_session = store.firebase_sign_in("parent", "firebase-student-1", "alliyah@example.com")
    blocked_student_session = store.firebase_sign_in("student", "firebase-parent-1", "parent@example.com")

    assert student_session is not None
    assert student_session.student is not None
    assert student_session.student.id == student.id
    assert student_session.student.auth_uid == "firebase-student-1"
    assert parent_session is not None
    assert parent_session.parent is not None
    assert parent_session.parent.id == parent.id
    assert parent_session.parent.auth_uid == "firebase-parent-1"
    assert [linked_student.id for linked_student in parent_session.students] == [student.id]
    assert blocked_parent_session is None
    assert blocked_student_session is None
