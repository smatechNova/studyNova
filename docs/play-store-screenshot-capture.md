# StudyNova Play Store Screenshot Capture Plan

Last updated: June 2, 2026

Use this plan to capture polished Play Store screenshots without exposing real student, parent, or school data.

## Demo Mode

StudyNova includes a safe in-app demo mode for screenshots. It uses local sample data only:

- Student: Alliyah Olaniyan
- Parent/guardian: Mrs Adewale
- School: StudyNova Demo School
- Subjects: Mathematics, English, Biology
- Progress: sample completed sessions, recall notes, missed sessions, reminders, and weekly digest

Demo routes:

```text
/student?demo=student
/parent?demo=parent
```

The home screen also includes a "Play Store screenshots" panel with Student demo and Parent demo buttons.

Demo mode rules:

- Do not store demo sign-in sessions.
- Do not call account creation, parent invite, deletion, reminder, completion, or rebalance APIs.
- Do not show real phone numbers, emails, student names, parent names, or school names.
- Do not use real student recall notes in screenshots.

## Capture Setup

Use a real Android device or Android emulator in portrait mode.

Recommended phone setup:

- Resolution: 1080 x 1920 or higher
- Font size: default
- Display size: default
- Battery: above 50%
- Remove notification banners before capture
- Keep browser tabs and developer overlays out of screenshots
- Capture both light and dark theme screens

Run the app locally for screenshots:

```powershell
npm run mobile
```

For Expo Go on a phone, use the tunnel flow that works for the current environment. Keep the backend running only when testing real app flows. Demo screenshots do not require the backend.

## Screenshot Set

Capture at least these 8 portrait screenshots.

| Order | Route or screen | What to show | Suggested tagline |
| --- | --- | --- | --- |
| 1 | Home screen | Student and parent paths, StudyNova identity | Choose student or parent |
| 2 | Student setup, Profile or Exam step | Guided setup with clean required fields | Build a plan from exam dates |
| 3 | Student setup, Subjects step | Subject library/editor with topics and pages | Organize subjects clearly |
| 4 | `/student?demo=student` generated hero | Total reading, daily time, countdown | Know what to study each day |
| 5 | Student timetable proof panel | Completed session, recall note, confidence | Track study proof, not guesses |
| 6 | Student catch-up/reminders area | Missed sessions, reminders, rebalance context | Stay on pace with reminders |
| 7 | `/parent?demo=parent` dashboard | Weekly review, missed sessions, latest proof | Help parents monitor progress |
| 8 | Dark theme student or parent screen | Visual polish and accessible dark UI | Study comfortably in dark mode |

## Capture Notes

- Frame each screenshot around one clear product story.
- Avoid tiny text and unnecessary scrolling clutter.
- Do not include the device keyboard unless the screenshot is specifically about input.
- Do not show browser address bars in final Play Store screenshots.
- Use screenshots from the native Android experience for the final public listing, not Expo web.
- Keep taglines short if a designer adds them later.

## Feature Graphic Handoff

Required size: 1024 x 500 px.

Recommended composition:

- Left: StudyNova name and short value line, "Plan smarter. Study steadier."
- Center: phone mockup with the generated student timetable.
- Right: small parent progress card showing completed sessions and missed-session alert.
- Palette: royal blue `#2563EB`, teal `#14B8A6`, green `#047857`, amber `#F59E0B`, light background `#F8FAFC`, deep navy text `#102A43`.

Do not include:

- Real school branding
- Real student data
- Pricing, awards, "best app," "#1," or download calls to action
- Large blocks of text

## Final Privacy Review

Before uploading screenshots:

1. Confirm all visible names are demo names.
2. Confirm no private phone number, email, access code, or invite code is visible.
3. Confirm no browser URL, Codespace URL, localhost URL, or developer overlay is visible.
4. Confirm screenshots match features that exist in the app.
5. Confirm parent screenshots do not imply parents can edit student accounts or access another student's private dashboard.
