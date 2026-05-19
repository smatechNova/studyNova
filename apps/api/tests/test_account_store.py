from app.schemas import ParentAccountCreate, ParentStudentLinkCreate, StudentAccountCreate
from app.storage import StudyPlanStore


def test_study_plan_store_links_parent_and_student_accounts(tmp_path) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    student = store.create_student_account(
        StudentAccountCreate(
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
