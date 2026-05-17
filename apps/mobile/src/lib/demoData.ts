import type { StudyPlanRequest } from "@/types";

const examDate = new Date();
examDate.setDate(examDate.getDate() + 30);

export const demoStudyPlanRequest: StudyPlanRequest = {
  student_name: "Alliyah",
  exam_date: examDate.toISOString().slice(0, 10),
  available_daily_minutes: 180,
  minutes_per_page: 5,
  session_minutes: 45,
  break_minutes: 10,
  subjects: [
    {
      name: "Mathematics",
      topics: [
        { name: "Algebra", pages: 25, priority: 5 },
        { name: "Geometry", pages: 18, priority: 4 }
      ]
    },
    {
      name: "English",
      topics: [
        { name: "Comprehension", pages: 15, priority: 3 },
        { name: "Essay Writing", pages: 10, priority: 4 }
      ]
    },
    {
      name: "Biology",
      topics: [
        { name: "Cell Structure", pages: 20, priority: 4 },
        { name: "Nutrition", pages: 12, priority: 3 }
      ]
    }
  ]
};

