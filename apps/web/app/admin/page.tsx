import Link from "next/link";

const ACTIONS = [
  {
    href: "/admin/courses/new",
    title: "สร้างรายวิชาใหม่",
    desc: "เพิ่มรายวิชา รหัสวิชา และภาคการศึกษา",
    icon: "add_business",
  },
  {
    href: "/admin/exams/new",
    title: "สร้างแบบทดสอบ / ข้อสอบ",
    desc: "ตั้งค่าโหมดล็อกหน้าจอ คำถาม และตัวเลือกคำตอบ",
    icon: "post_add",
  },
  {
    href: "/admin/materials/upload",
    title: "อัพโหลดเอกสารประกอบการเรียน",
    desc: "สไลด์ วิดีโอ หรือเอกสารสำหรับรายวิชา",
    icon: "upload_file",
  },
];

export default function AdminHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-semibold text-on-surface">ระบบหลังบ้าน (Admin / Content Management)</h1>
        <p className="text-xs text-outline mt-1">
          สำหรับผู้สอนและผู้ดูแลระบบ ใช้เพิ่มรายวิชา ข้อสอบ และเอกสารประกอบการเรียนได้ตลอดเวลา
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group bg-surface-container border border-outline-variant/30 rounded-xl p-5 hover:border-primary/50 transition-colors flex flex-col gap-3"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-xl">{action.icon}</span>
            </div>
            <div>
              <h2 className="text-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                {action.title}
              </h2>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed">{action.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
