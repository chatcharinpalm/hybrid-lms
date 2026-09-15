// Demo dashboard laid out per the approved Stitch template (course_overview) —
// two-column proportions (8/4 on large screens), stacking to one column on
// mobile. Wire the summary cards + roadmap to real aggregation endpoints
// once the gradebook and attendance analytics APIs are built out.

const SUMMARY_CARDS = [
  { label: "Attendance Rate", value: "94%", icon: "co_present", barColor: "bg-secondary", width: "94%" },
  { label: "Lab Sandbox Hours", value: "34.5", suffix: "/ 40 ชม.", icon: "terminal", barColor: "bg-primary", width: "86%" },
  { label: "Exam Average", value: "88", suffix: "/ 100", icon: "military_tech", barColor: "bg-tertiary", width: "88%" },
  { label: "Next Exam Countdown", value: "04", suffix: "วัน", icon: "event_upcoming", barColor: "bg-error", width: "30%" },
];

const ROADMAP = [
  { code: "MOD-01", title: "Enterprise TCP/IP Stack & Packet Analysis", state: "done" as const, score: "100/100" },
  { code: "MOD-02", title: "VLSM, Subnet Design & Dynamic Routing", state: "done" as const, score: "95/100" },
  {
    code: "MOD-03",
    title: "Next-Gen Firewall, DMZ Design & Intrusion Prevention",
    state: "active" as const,
    note: "กำหนดส่งแล็บอีก 2 วัน",
  },
  { code: "MOD-04", title: "Ethical Hacking & Penetration Testing", state: "locked" as const, note: "สัปดาห์ที่ 9-10" },
];

const NOTICES = [
  {
    tag: "SERVER MAINTENANCE",
    tagClass: "bg-error/15 text-error border-error/30",
    title: "ปิดปรับปรุงระบบ Lab Pods คืนนี้",
    time: "วันนี้ 09:30 น.",
  },
  {
    tag: "ASSIGNMENT DEADLINE",
    tagClass: "bg-primary/15 text-primary border-primary/30",
    title: "กำหนดส่งรายงาน Lab 4: SDN Mininet",
    time: "เมื่อวานนี้",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="bg-surface-container border border-outline-variant/30 rounded-xl p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 text-xs text-secondary font-medium px-2 py-0.5 rounded bg-secondary/10 border border-secondary/30">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              เปิดการเรียนการสอน
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-on-surface tracking-tight">
              ยินดีต้อนรับสู่ Hybrid LMS
            </h1>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              ติดตามความคืบหน้าการเรียน การเข้าเรียนแบบผสมผสาน (ออนไลน์ &amp; ออนไซต์) และศูนย์สอบที่มีระบบป้องกันการทุจริต
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {SUMMARY_CARDS.map((card) => (
          <div
            key={card.label}
            className="bg-surface-container border border-outline-variant/30 rounded-xl p-5 hover:border-outline-variant/60 transition-colors"
          >
            <div className="flex items-center justify-between text-on-surface-variant mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">{card.label}</span>
              <span className="material-symbols-outlined text-[20px]">{card.icon}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-on-surface">{card.value}</span>
              {card.suffix && <span className="text-xs text-on-surface-variant font-mono">{card.suffix}</span>}
            </div>
            <div className="w-full bg-surface-container-lowest h-1.5 rounded-full mt-3 overflow-hidden">
              <div className={`${card.barColor} h-full rounded-full`} style={{ width: card.width }} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main column — curriculum roadmap (8/12) */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-surface-container border border-outline-variant/30 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-on-surface">แผนการเรียนรู้ (Curriculum Roadmap)</h2>
                <p className="text-xs text-outline mt-0.5">ติดตามความคืบหน้ารายบทเรียนและสถานะการปลดล็อก Sandbox</p>
              </div>
              <span className="text-xs font-mono text-on-surface-variant bg-surface-container-lowest px-2.5 py-1 rounded border border-outline-variant/30 shrink-0">
                2 / 4 สำเร็จ
              </span>
            </div>

            <div className="space-y-2.5 pt-1">
              {ROADMAP.map((mod) => (
                <div
                  key={mod.code}
                  className={`p-3.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
                    mod.state === "active"
                      ? "bg-surface-container-lowest border-primary/40"
                      : mod.state === "locked"
                        ? "bg-surface-container-lowest/40 border-outline-variant/40 opacity-60"
                        : "bg-surface-container-lowest/60 border-outline-variant/70"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`material-symbols-outlined text-[20px] shrink-0 ${
                        mod.state === "done"
                          ? "text-secondary"
                          : mod.state === "active"
                            ? "text-primary"
                            : "text-outline"
                      }`}
                    >
                      {mod.state === "done" ? "check_circle" : mod.state === "active" ? "shield" : "lock"}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-outline">{mod.code}</span>
                        <span className="text-xs font-semibold text-on-surface truncate">{mod.title}</span>
                      </div>
                      {mod.note && <p className="text-[11px] text-outline mt-0.5">{mod.note}</p>}
                    </div>
                  </div>
                  {mod.score && (
                    <span className="font-mono text-xs font-semibold text-on-surface shrink-0">{mod.score}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side column — QR + notices (4/12) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-surface-container border border-outline-variant/30 rounded-xl p-5 text-center flex flex-col items-center">
            <div className="w-full flex items-center justify-between mb-4 pb-3 border-b border-outline-variant/30">
              <span className="text-xs font-semibold text-on-surface">เช็คชื่อ Onsite วันนี้</span>
              <span className="text-[11px] text-outline font-mono">ห้อง 402</span>
            </div>
            <div className="bg-white p-3.5 rounded-lg shadow-sm border border-outline-variant/20">
              <svg className="w-32 h-32 text-surface" fill="currentColor" viewBox="0 0 100 100">
                <path d="M10 10h30v30H10V10zm6 6v18h18V16H16zm4 4h10v10H20V20zm40-10h30v30H60V10zm6 6v18h18V16H66zm4 4h10v10H70V20zM10 60h30v30H10V60zm6 6v18h18V66H16zm4 4h10v10H20V70zm45-10h5v10h-5v-10zm10 0h15v5H75v-5zm0 10h10v10H75V80zm-15 10h10v10H60V90zm20 0h10v10H80V90zm-10-15h5v5h-5v-5zm-5-5h5v5h-5v-5zm20 0h5v5h-5v-5z" />
              </svg>
            </div>
            <a
              href="/attendance"
              className="mt-3.5 text-xs font-medium text-primary hover:opacity-80 transition-opacity inline-flex items-center gap-1"
            >
              ไปหน้าเช็คชื่อ
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </a>
          </div>

          <div className="bg-surface-container border border-outline-variant/30 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
              <h2 className="text-sm font-bold text-on-surface">ประกาศสำคัญ</h2>
              <span className="material-symbols-outlined text-outline text-[18px]">campaign</span>
            </div>
            {NOTICES.map((n) => (
              <div key={n.title} className="p-3 rounded-lg bg-surface-container-lowest border border-outline-variant/30 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${n.tagClass}`}>{n.tag}</span>
                  <span className="text-[11px] font-mono text-outline shrink-0">{n.time}</span>
                </div>
                <h4 className="text-xs font-semibold text-on-surface">{n.title}</h4>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
