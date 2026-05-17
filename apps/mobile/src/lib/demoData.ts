import type { StudyPlanRequest } from "@/types";

const examDate = new Date();
examDate.setDate(examDate.getDate() + 30);

export const demoStudyPlanRequest: StudyPlanRequest = {
  student_profile: {
    name: "Alliyah",
    class_level: "SS2",
    age: 15,
    parent_name: "Mrs Adewale",
    parent_contact: "08000000000"
  },
  exam_start_date: examDate.toISOString().slice(0, 10),
  exam_end_date: examDate.toISOString().slice(0, 10),
  available_daily_minutes: 180,
  minutes_per_page: 5,
  session_minutes: 45,
  break_minutes: 10,
  study_strength_note: "I read faster in the morning.",
  subjects: [
    {
      name: "Mathematics",
      topics: [
        { name: "Algebra", pages: 25, priority: 5, resource_type: "Textbook" },
        { name: "Geometry", pages: 18, priority: 4, resource_type: "Class notes" }
      ]
    },
    {
      name: "English",
      topics: [
        { name: "Comprehension", pages: 15, priority: 3, resource_type: "Class notes" },
        { name: "Essay Writing", pages: 10, priority: 4, resource_type: "Notebook" }
      ]
    },
    {
      name: "Biology",
      topics: [
        { name: "Cell Structure", pages: 20, priority: 4, resource_type: "Textbook" },
        { name: "Nutrition", pages: 12, priority: 3, resource_type: "Online notes" }
      ]
    }
  ]
};
