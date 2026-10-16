import { ExamAreaIdle } from "@/components/ExamAreaIdle";

export default function ExamAreaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ExamAreaIdle />
      {children}
    </>
  );
}
