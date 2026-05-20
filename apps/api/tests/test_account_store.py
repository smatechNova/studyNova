from app.schemas import AccountSignInRequest, ParentAccountCreate, ParentStudentLinkCreate, StudentAccountCreate
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
