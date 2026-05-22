from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from math import ceil

from fastapi import HTTPException

from app.schemas import (
    DailyPlan,
    PlanMetadata,
    PlanSession,
    SubjectDistribution,
    StudyPlanRequest,
    StudyPlanResponse,
)


@dataclass
class TopicWork:
    subject: str
    topic: str
    resource_type: str
    estimated_minutes: int
    priority: int
    remaining_minutes: int


REVISION_OFFSETS = (1, 3, 7)
REVISION_SESSION_MINUTES = 20
PRACTICE_SESSION_MINUTES = 30
BLOCKED_CONTENT_PHRASES = (
    "could not generate the plan",
    "api connection and exam dates",
    "study plan request failed",
)


def build_study_plan(payload: StudyPlanRequest) -> StudyPlanResponse:
    today = date.today()
    exam_start_date = payload.exam_start_date or payload.exam_date
    if exam_start_date is None:
        raise HTTPException(status_code=422, detail="Exam start date is required.")
    if exam_start_date <= today:
        raise HTTPException(status_code=422, detail="Exam start date must be in the future.")
    if payload.exam_end_date is not None and payload.exam_end_date < exam_start_date:
        raise HTTPException(status_code=422, detail="Exam end date cannot be before the start date.")

    _validate_study_content(payload)
    work_items = _flatten_work(payload)
    if not work_items:
        raise HTTPException(status_code=422, detail="At least one subject topic is required.")

    total_minutes = sum(item.estimated_minutes for item in work_items)
    days_until_exam = max(1, (exam_start_date - today).days)
    average_daily_minutes = ceil(total_minutes / days_until_exam)
    revision_buffer_days = _revision_buffer(days_until_exam)
    first_pass_days = max(1, days_until_exam - revision_buffer_days)
    required_daily_minutes = ceil(total_minutes / first_pass_days)
    daily_gap_minutes = max(0, required_daily_minutes - payload.available_daily_minutes)

    status = _status(required_daily_minutes, payload.available_daily_minutes)
    schedule = _build_schedule(payload, work_items, today, days_until_exam, exam_start_date)

    return StudyPlanResponse(
        metadata=PlanMetadata(
            student_name=_student_name(payload),
            class_level=payload.student_profile.class_level if payload.student_profile else "",
            exam_date=exam_start_date,
            exam_start_date=exam_start_date,
            exam_end_date=payload.exam_end_date,
            days_until_exam=days_until_exam,
            total_study_minutes=total_minutes,
            average_daily_minutes=average_daily_minutes,
            required_daily_minutes=required_daily_minutes,
            available_daily_minutes=payload.available_daily_minutes,
            daily_gap_minutes=daily_gap_minutes,
            status=status,
            recommendation=_recommendation(
                status,
                required_daily_minutes,
                daily_gap_minutes,
                payload.study_strength_note,
            ),
            resources_used=sorted({item.resource_type for item in work_items}),
            study_strength_note=payload.study_strength_note,
        ),
        subject_distribution=_subject_distribution(work_items, total_minutes),
        schedule=schedule,
    )


def build_rebalanced_study_plan(
    plan: StudyPlanResponse,
    completed_session_keys: set[str],
    today: date | None = None,
) -> StudyPlanResponse:
    current_date = today or date.today()
    exam_start_date = plan.metadata.exam_start_date
    if exam_start_date <= current_date:
        raise HTTPException(status_code=422, detail="Exam start date has passed. Create a new plan.")

    remaining_sessions: list[tuple[date, int, PlanSession]] = []
    missed_session_count = 0
    for daily_plan in plan.schedule:
        for index, session in enumerate(daily_plan.sessions):
            session_key = f"{daily_plan.study_date.isoformat()}:{index}"
            if session_key in completed_session_keys:
                continue

            remaining_sessions.append((daily_plan.study_date, index, session))
            if daily_plan.study_date < current_date:
                missed_session_count += 1

    if not remaining_sessions:
        raise HTTPException(status_code=422, detail="There are no unfinished sessions to rebalance.")
    if missed_session_count == 0:
        raise HTTPException(status_code=422, detail="There are no missed sessions to rebalance yet.")

    remaining_sessions.sort(key=lambda item: (item[0], item[1]))
    days_until_exam = max(1, (exam_start_date - current_date).days)
    total_minutes = sum(session.minutes for _date, _index, session in remaining_sessions)
    required_daily_minutes = ceil(total_minutes / days_until_exam)
    available_daily_minutes = plan.metadata.available_daily_minutes
    daily_gap_minutes = max(0, required_daily_minutes - available_daily_minutes)
    daily_planning_limit = max(available_daily_minutes, required_daily_minutes)
    status = _status(required_daily_minutes, available_daily_minutes)
    schedule = _build_rebalanced_schedule(
        remaining_sessions,
        current_date,
        days_until_exam,
        daily_planning_limit,
    )

    return StudyPlanResponse(
        metadata=PlanMetadata(
            student_name=plan.metadata.student_name,
            class_level=plan.metadata.class_level,
            exam_date=exam_start_date,
            exam_start_date=exam_start_date,
            exam_end_date=plan.metadata.exam_end_date,
            days_until_exam=days_until_exam,
            total_study_minutes=total_minutes,
            average_daily_minutes=ceil(total_minutes / days_until_exam),
            required_daily_minutes=required_daily_minutes,
            available_daily_minutes=available_daily_minutes,
            daily_gap_minutes=daily_gap_minutes,
            status=status,
            recommendation=_rebalanced_recommendation(
                missed_session_count,
                days_until_exam,
                daily_gap_minutes,
                required_daily_minutes,
                status,
            ),
            resources_used=sorted({session.resource_type for _date, _index, session in remaining_sessions}),
            study_strength_note=plan.metadata.study_strength_note,
        ),
        subject_distribution=_session_subject_distribution(remaining_sessions, total_minutes),
        schedule=schedule,
    )


def _validate_study_content(payload: StudyPlanRequest) -> None:
    if _contains_blocked_content(payload.study_strength_note):
        raise HTTPException(status_code=422, detail="Study strength note should describe how the student studies.")

    for subject in payload.subjects:
        if _contains_blocked_content(subject.name):
            raise HTTPException(status_code=422, detail="Subject name looks like an app message. Enter a real subject.")

        for topic in subject.topics:
            if _contains_blocked_content(topic.name):
                raise HTTPException(status_code=422, detail="Topic name looks like an app message. Enter a real topic.")


def _contains_blocked_content(value: str) -> bool:
    normalized = value.strip().lower()
    return any(phrase in normalized for phrase in BLOCKED_CONTENT_PHRASES)


def _student_name(payload: StudyPlanRequest) -> str:
    if payload.student_profile and payload.student_profile.name.strip():
        return payload.student_profile.name
    return payload.student_name or "Student"


def _flatten_work(payload: StudyPlanRequest) -> list[TopicWork]:
    work_items: list[TopicWork] = []
    for subject in payload.subjects:
        for topic in subject.topics:
            priority_multiplier = 1 + max(topic.priority - 3, 0) * 0.12
            estimated_minutes = max(
                payload.session_minutes // 2,
                ceil(topic.pages * payload.minutes_per_page * priority_multiplier),
            )
            work_items.append(
                TopicWork(
                    subject=subject.name,
                    topic=topic.name,
                    resource_type=topic.resource_type,
                    estimated_minutes=estimated_minutes,
                    priority=topic.priority,
                    remaining_minutes=estimated_minutes,
                )
            )
    return work_items


def _revision_buffer(days_until_exam: int) -> int:
    if days_until_exam <= 7:
        return 1
    if days_until_exam <= 21:
        return 3
    return min(7, max(4, round(days_until_exam * 0.18)))


def _status(required_daily_minutes: int, available_daily_minutes: int) -> str:
    if required_daily_minutes <= available_daily_minutes:
        return "on_track"
    if required_daily_minutes <= round(available_daily_minutes * 1.25):
        return "tight"
    return "behind"


def _recommendation(
    status: str,
    required_daily_minutes: int,
    daily_gap_minutes: int,
    study_strength_note: str,
) -> str:
    if status == "on_track":
        base = f"Study about {required_daily_minutes} minutes daily and keep revision sessions consistent."
    elif status == "tight":
        base = f"The plan is close. Add about {daily_gap_minutes} minutes daily or reduce low-priority workload."
    else:
        base = f"You are short by about {daily_gap_minutes} minutes daily. Extend study time or move the exam target."

    if study_strength_note.strip():
        return f"{base} Use your study strength note while checking whether the pace still feels realistic."
    return base


def _subject_distribution(
    work_items: list[TopicWork],
    total_minutes: int,
) -> list[SubjectDistribution]:
    subject_minutes: dict[str, int] = defaultdict(int)
    for item in work_items:
        subject_minutes[item.subject] += item.estimated_minutes

    return [
        SubjectDistribution(
            subject=subject,
            estimated_minutes=minutes,
            percentage=round((minutes / total_minutes) * 100, 1),
        )
        for subject, minutes in sorted(subject_minutes.items())
    ]


def _session_subject_distribution(
    sessions: list[tuple[date, int, PlanSession]],
    total_minutes: int,
) -> list[SubjectDistribution]:
    subject_minutes: dict[str, int] = defaultdict(int)
    for _study_date, _index, session in sessions:
        subject_minutes[session.subject] += session.minutes

    return [
        SubjectDistribution(
            subject=subject,
            estimated_minutes=minutes,
            percentage=round((minutes / total_minutes) * 100, 1),
        )
        for subject, minutes in sorted(subject_minutes.items())
    ]


def _rebalanced_recommendation(
    missed_session_count: int,
    days_until_exam: int,
    daily_gap_minutes: int,
    required_daily_minutes: int,
    status: str,
) -> str:
    base = (
        "Plan rebalanced after missed sessions. "
        f"{missed_session_count} missed sessions were moved into the remaining "
        f"{days_until_exam} study days."
    )
    if status == "behind":
        return (
            f"{base} The recovery pace needs about {required_daily_minutes} minutes daily, "
            "which is above the student's available time."
        )
    if status == "tight":
        return f"{base} Add about {daily_gap_minutes} minutes daily or keep sessions very focused."
    return f"{base} The student can recover within the current daily study time."


def _build_rebalanced_schedule(
    remaining_sessions: list[tuple[date, int, PlanSession]],
    today: date,
    days_until_exam: int,
    daily_planning_limit: int,
) -> list[DailyPlan]:
    queue = [session.model_copy() for _study_date, _index, session in remaining_sessions]
    schedule: list[DailyPlan] = []

    for offset in range(days_until_exam):
        plan_date = today + timedelta(days=offset)
        minutes_left = daily_planning_limit
        sessions: list[PlanSession] = []

        while queue:
            next_session = queue[0]
            if sessions and next_session.minutes > minutes_left:
                break

            sessions.append(queue.pop(0))
            minutes_left -= next_session.minutes
            if minutes_left <= 0:
                break

        schedule.append(
            DailyPlan(
                study_date=plan_date,
                total_minutes=sum(session.minutes for session in sessions),
                sessions=sessions,
            )
        )

    while queue:
        schedule[-1].sessions.append(queue.pop(0))
        schedule[-1].total_minutes = sum(session.minutes for session in schedule[-1].sessions)

    return schedule


def _build_schedule(
    payload: StudyPlanRequest,
    work_items: list[TopicWork],
    today: date,
    days_until_exam: int,
    exam_start_date: date,
) -> list[DailyPlan]:
    subject_queues: dict[str, list[TopicWork]] = defaultdict(list)
    for item in sorted(work_items, key=lambda entry: (-entry.priority, entry.subject, entry.topic)):
        subject_queues[item.subject].append(item)

    revision_due: dict[date, list[tuple[str, str]]] = defaultdict(list)
    schedule: list[DailyPlan] = []
    preview_days = days_until_exam

    for offset in range(preview_days):
        plan_date = today + timedelta(days=offset)
        minutes_left = payload.available_daily_minutes
        sessions: list[PlanSession] = []

        for subject, topic in list(revision_due.get(plan_date, [])):
            if minutes_left < REVISION_SESSION_MINUTES:
                break
            source_item = _find_topic(work_items, subject, topic)
            sessions.append(
                PlanSession(
                    kind="revision",
                    subject=subject,
                    topic=topic,
                    resource_type=source_item.resource_type if source_item else "Textbook",
                    minutes=REVISION_SESSION_MINUTES,
                    break_after_minutes=payload.break_minutes,
                )
            )
            minutes_left -= REVISION_SESSION_MINUTES

        while minutes_left >= max(20, payload.session_minutes // 2):
            next_item = _pick_next_topic(subject_queues)
            if next_item is None:
                break

            minutes = min(payload.session_minutes, next_item.remaining_minutes, minutes_left)
            sessions.append(
                PlanSession(
                    kind="study",
                    subject=next_item.subject,
                    topic=next_item.topic,
                    resource_type=next_item.resource_type,
                    minutes=minutes,
                    break_after_minutes=payload.break_minutes,
                )
            )
            minutes_left -= minutes
            next_item.remaining_minutes -= minutes

            if next_item.remaining_minutes <= 0:
                subject_queues[next_item.subject].pop(0)
                for revision_offset in REVISION_OFFSETS:
                    due_date = plan_date + timedelta(days=revision_offset)
                    if due_date < exam_start_date:
                        revision_due[due_date].append((next_item.subject, next_item.topic))

        if not sessions:
            sessions = _build_flex_sessions(payload, work_items, offset)

        total_minutes = sum(session.minutes for session in sessions)
        schedule.append(
            DailyPlan(
                study_date=plan_date,
                total_minutes=total_minutes,
                sessions=sessions,
            )
        )

    return schedule


def _build_flex_sessions(
    payload: StudyPlanRequest,
    work_items: list[TopicWork],
    offset: int,
) -> list[PlanSession]:
    sessions: list[PlanSession] = []
    minutes_left = payload.available_daily_minutes
    if not work_items or minutes_left < REVISION_SESSION_MINUTES:
        return sessions

    first_item = work_items[offset % len(work_items)]
    first_mode = "revision" if offset % 2 == 0 else "study"
    second_mode = "practice" if offset % 2 == 0 else "revision"
    sessions.append(_flex_session(first_item, payload, minutes_left, first_mode))
    minutes_left -= sessions[-1].minutes

    if minutes_left >= REVISION_SESSION_MINUTES:
        second_item = work_items[(offset + 1) % len(work_items)]
        sessions.append(_flex_session(second_item, payload, minutes_left, second_mode))

    return sessions


def _flex_session(
    item: TopicWork,
    payload: StudyPlanRequest,
    minutes_left: int,
    mode: str,
) -> PlanSession:
    if mode == "revision":
        return PlanSession(
            kind="revision",
            subject=item.subject,
            topic=f"Quick revision: {item.topic}",
            resource_type=item.resource_type,
            minutes=min(REVISION_SESSION_MINUTES, minutes_left),
            break_after_minutes=payload.break_minutes,
        )

    return PlanSession(
        kind="practice" if mode == "practice" else "study",
        subject=item.subject,
        topic=f"Past questions: {item.topic}" if mode == "practice" else f"Weak-area study: {item.topic}",
        resource_type="Past questions" if mode == "practice" else item.resource_type,
        minutes=min(PRACTICE_SESSION_MINUTES, minutes_left),
        break_after_minutes=payload.break_minutes,
    )


def _find_topic(work_items: list[TopicWork], subject: str, topic: str) -> TopicWork | None:
    for item in work_items:
        if item.subject == subject and item.topic == topic:
            return item
    return None


def _pick_next_topic(subject_queues: dict[str, list[TopicWork]]) -> TopicWork | None:
    active_subjects = [
        (subject, sum(item.remaining_minutes for item in queue))
        for subject, queue in subject_queues.items()
        if queue
    ]
    if not active_subjects:
        return None

    subject, _remaining = max(active_subjects, key=lambda entry: entry[1])
    return subject_queues[subject][0]
