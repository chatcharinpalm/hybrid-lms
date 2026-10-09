import { redirect } from "next/navigation";

// The old demo dashboard showed made-up modules and stats; students start at
// the exam center, which lists their real courses and exams.
export default function DashboardPage() {
  redirect("/exams");
}
