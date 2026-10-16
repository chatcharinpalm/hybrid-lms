import { apiFetch } from "@/lib/api";

export const VIOLATION_TRANSLATION: Record<string, string> = {
  TAB_HIDDEN: "สลับแท็บ / ย่อหน้าต่าง",
  WINDOW_BLUR: "คลิกออกนอกหน้าต่างสอบ",
  FULLSCREEN_EXIT: "ออกจากโหมดเต็มหน้าจอ",
  COPY_ATTEMPT: "พยายามคัดลอกข้อความ (Copy)",
  PASTE_ATTEMPT: "พยายามวางข้อความ (Paste)",
  CUT_ATTEMPT: "พยายามตัดข้อความ (Cut)",
  CONTEXT_MENU_ATTEMPT: "เปิดเมนูคลิกขวา",
  DEVTOOLS_SHORTCUT: "พยายามเปิด DevTools / F12",
  PRINT_SCREEN: "พยายามจับภาพหน้าจอ",
  MULTIPLE_DISPLAYS_DETECTED: "ต่อจอภาพหลายจอ",
};

export const ENDED_REASON_TH: Record<string, string> = {
  STUDENT: "ผู้สอบกดส่งเอง",
  TIMEOUT: "หมดเวลา",
  VIOLATIONS: "โกงครบกำหนด",
  ADMIN_FORCED: "ผู้คุมสอบสั่งส่ง",
  EXAM_CLOSED: "ปิดห้องสอบ",
};

export const AUDIT_ACTION_TH: Record<string, string> = {
  EXAM_OPEN: "เปิดห้องสอบ",
  EXAM_CLOSED: "ปิดห้องสอบ",
  ATTEMPT_FORCE_SUBMIT: "บังคับส่ง",
  ATTEMPT_RESET: "รีเซ็ตให้สอบใหม่",
  ATTEMPT_FORGIVE_VIOLATIONS: "ล้างการโกง",
  ATTEMPT_ADD_TIME: "เพิ่มเวลา",
  ATTEMPT_MESSAGE: "ส่งข้อความเตือน",
};

const STATUS_TH: Record<string, string> = {
  NOT_STARTED: "ยังไม่เริ่ม",
  IN_PROGRESS: "กำลังสอบ",
  SUBMITTED: "ส่งแล้ว",
  AUTO_SUBMITTED: "ส่งอัตโนมัติ",
};

export interface ExportStudent {
  studentId: string;
  fullName: string;
  studentCode: string;
  section: string | null;
  seatNumber: number | null;
  status: string;
  endedReason: string | null;
  attemptId: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  answeredCount: number;
  totalQuestions: number;
  violationCount: number;
  scorePoints: number | null;
  scorePercent: number | null;
  passed: boolean | null;
  violations: Array<{ id: string; type: string; occurredAt: string; detail: any }>;
}

export interface ExportAudit {
  action: string;
  actorName: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

interface SheetRow {
  number: number;
  paperNumber: number | null;
  prompt: string;
  chosen: { code: string | null; label: string } | null;
  correct: { code: string | null; label: string } | null;
  isCorrect: boolean | null;
}

/** Loads one exam's record (every room) and downloads it — for pages without the live monitor's data. */
export async function exportExamExcelById(examId: string, onProgress?: (done: number, total: number) => void) {
  const [proctor, audit] = await Promise.all([
    apiFetch<{
      exam: { title: string; totalQuestions: number; maxViolations: number };
      students: ExportStudent[];
    }>(`/api/exams/${examId}/proctor`),
    apiFetch<ExportAudit[]>(`/api/exams/${examId}/audit`).catch(() => [] as ExportAudit[]),
  ]);
  await exportExamExcel({
    examTitle: proctor.exam.title,
    totalQuestions: proctor.exam.totalQuestions,
    maxViolations: proctor.exam.maxViolations,
    roomLabel: "ทุกห้อง",
    students: proctor.students,
    audit,
    onProgress,
  });
}

/** Excel stores dates without a zone; shift so the cell shows Thai wall-clock time, not UTC. */
const localDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000);
};

/**
 * Builds the exam record workbook (results, every student's answers, rule breaks,
 * proctor actions) in the browser and downloads it.
 */
export async function exportExamExcel(opts: {
  examTitle: string;
  totalQuestions: number;
  maxViolations: number;
  roomLabel: string;
  students: ExportStudent[];
  audit: ExportAudit[];
  onProgress?: (done: number, total: number) => void;
}) {
  // Grouped by room, then by seat number (as on the sign-in sheet), so each room reads as its own block (or sheet).
  const roomOf = (s: ExportStudent) => s.section?.trim() || "ไม่ระบุห้อง";
  const students = [...opts.students].sort(
    (a, b) =>
      roomOf(a).localeCompare(roomOf(b), "th") ||
      (a.seatNumber ?? 9999) - (b.seatNumber ?? 9999) ||
      a.studentCode.localeCompare(b.studentCode)
  );
  const rooms = [...new Set(students.map(roomOf))];
  const inRoom = (room: string) => students.filter((s) => roomOf(s) === room);

  // Each student's answer sheet, a few at a time so a full class doesn't flood the API.
  const sheets = new Map<string, SheetRow[]>();
  const withAttempt = students.filter((s) => s.attemptId);
  let done = 0;
  for (let i = 0; i < withAttempt.length; i += 5) {
    await Promise.all(
      withAttempt.slice(i, i + 5).map(async (s) => {
        const sheet = await apiFetch<{ rows: SheetRow[] }>(`/api/exams/attempts/${s.attemptId}/answer-sheet`);
        sheets.set(s.studentId, sheet.rows);
        opts.onProgress?.(++done, withAttempt.length);
      })
    );
  }

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const font = { name: "TH SarabunPSK", size: 14 };
  // Only long text columns wrap; short ones (room, code, dates) stay on one line.
  const style = (ws: import("exceljs").Worksheet, headerRow: number, wrapCols: number[] = []) => {
    ws.eachRow((row, n) => {
      row.eachCell({ includeEmpty: true }, (c) => {
        c.font = { ...font, bold: n <= headerRow };
        c.alignment = { vertical: "top", wrapText: wrapCols.includes(Number(c.col)) };
        if (n === headerRow) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E2F3" } };
          c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
        }
        if (n >= headerRow)
          c.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
      });
    });
    ws.views = [{ state: "frozen", ySplit: headerRow }];
  };
  const title = (ws: import("exceljs").Worksheet, text: string, cols: number, room = opts.roomLabel) => {
    ws.addRow([`${opts.examTitle} — ${text}`]);
    ws.addRow([`ห้อง: ${room} · ส่งออกเมื่อ ${new Date().toLocaleString("th-TH")}`]);
    ws.mergeCells(1, 1, 1, cols);
    ws.mergeCells(2, 1, 2, cols);
  };
  /** A coloured "ห้อง …" bar across the sheet before each room's rows (only when the export has several rooms). */
  const roomBars = new Map<import("exceljs").Worksheet, number[]>();
  const roomBar = (ws: import("exceljs").Worksheet, room: string, cols: number) => {
    if (rooms.length < 2) return;
    const row = ws.addRow([`ห้อง ${room} (${inRoom(room).length} คน)`]);
    ws.mergeCells(row.number, 1, row.number, cols);
    roomBars.set(ws, [...(roomBars.get(ws) ?? []), row.number]);
  };
  const paintRoomBars = (ws: import("exceljs").Worksheet) => {
    for (const n of roomBars.get(ws) ?? []) {
      const c = ws.getRow(n).getCell(1);
      c.font = { ...font, size: 16, bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2F5597" } };
      c.alignment = { vertical: "middle", horizontal: "left" };
    }
  };
  const who = (s: ExportStudent) => [roomOf(s), s.seatNumber ?? "", s.studentCode, s.fullName];
  const dateFmt = "dd/mm/yyyy hh:mm:ss";
  const isDone = (s: ExportStudent) => s.status === "SUBMITTED" || s.status === "AUTO_SUBMITTED";
  const stats = (list: ExportStudent[]) => {
    const scored = list.filter((s) => s.scorePoints !== null).map((s) => s.scorePoints!);
    return {
      n: list.length,
      attempted: list.filter((s) => s.attemptId).length,
      done: list.filter(isDone).length,
      passed: list.filter((s) => s.passed === true).length,
      avg: scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 100) / 100 : null,
      max: scored.length ? Math.max(...scored) : null,
      min: scored.length ? Math.min(...scored) : null,
    };
  };
  // Sheet names: at most 31 characters, none of \ / ? * [ ] :
  const sheetName = (t: string) => t.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);

  // 0) Several rooms: one line per room up front.
  if (rooms.length > 1) {
    const ws = wb.addWorksheet("สรุปแยกห้อง");
    const header = ["ห้อง", "จำนวนนักศึกษา", "เข้าสอบ", "ส่งแล้ว", "ผ่าน", "คะแนนเฉลี่ย", "คะแนนสูงสุด", "คะแนนต่ำสุด"];
    title(ws, "สรุปผลสอบแยกตามห้อง", header.length);
    ws.addRow(header);
    for (const room of [...rooms, null]) {
      const t = stats(room ? inRoom(room) : students);
      const row = ws.addRow([room ?? "รวมทุกห้อง", t.n, t.attempted, t.done, t.passed, t.avg, t.max, t.min]);
      if (!room) row.font = { ...font, bold: true };
    }
    [22, 14, 10, 10, 10, 13, 13, 13].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    style(ws, 3);
    ws.lastRow!.eachCell((c) => (c.font = { ...font, bold: true }));
  }

  // 1) Results, one row per student — a sheet of its own for each room.
  for (const room of rooms.length > 1 ? rooms : [null]) {
    const list = room ? inRoom(room) : students;
    const ws = wb.addWorksheet(sheetName(room ? `ผลสอบ ${room}` : "สรุปผลสอบ"));
    const header = [
      "ห้อง", "เลขที่", "รหัสนักศึกษา", "ชื่อ-สกุล", "สถานะ", "เหตุที่จบการสอบ", "เวลาเริ่ม", "เวลาส่ง",
      "ใช้เวลา (นาที)", "ตอบแล้ว", "คะแนน", "คะแนนเต็ม", "ร้อยละ", "ผล", "ทุจริต (ครั้ง)",
    ];
    title(ws, "สรุปผลสอบ", header.length, room ?? opts.roomLabel);
    ws.addRow(header);
    for (const s of list) {
      const mins =
        s.startedAt && s.submittedAt
          ? Math.round((new Date(s.submittedAt).getTime() - new Date(s.startedAt).getTime()) / 6000) / 10
          : null;
      ws.addRow([
        ...who(s),
        STATUS_TH[s.status] ?? s.status,
        s.endedReason ? ENDED_REASON_TH[s.endedReason] ?? s.endedReason : "",
        localDate(s.startedAt),
        localDate(s.submittedAt),
        mins,
        s.attemptId ? s.answeredCount : null,
        s.scorePoints,
        s.totalQuestions,
        s.scorePercent,
        s.passed === null ? "" : s.passed ? "ผ่าน" : "ไม่ผ่าน",
        s.attemptId ? s.violationCount : null,
      ]);
    }
    const t = stats(list);
    ws.addRow([]);
    ws.addRow(["", "", "", "จำนวนนักศึกษา", t.n]);
    ws.addRow(["", "", "", "เข้าสอบ", t.attempted]);
    ws.addRow(["", "", "", "ส่งแล้ว", t.done]);
    if (t.avg !== null) {
      ws.addRow(["", "", "", "คะแนนเฉลี่ย", t.avg]);
      ws.addRow(["", "", "", "คะแนนสูงสุด", t.max]);
      ws.addRow(["", "", "", "คะแนนต่ำสุด", t.min]);
    }
    ws.getColumn(7).numFmt = dateFmt;
    ws.getColumn(8).numFmt = dateFmt;
    [16, 7, 18, 32, 13, 18, 20, 20, 10, 9, 8, 10, 8, 9, 10].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    style(ws, 3, [4, 6]);
  }

  // Questions in the teacher's paper order (each student saw them shuffled).
  const questions = new Map<number, string>();
  for (const rows of sheets.values())
    for (const r of rows) questions.set(r.paperNumber ?? r.number, r.prompt);
  const qNums = [...questions.keys()].sort((a, b) => a - b);

  // 2) Right/wrong grid: students × questions, with the class's correct count per question.
  {
    const ws = wb.addWorksheet("ถูก-ผิดรายข้อ");
    const header = ["ห้อง", "เลขที่", "รหัสนักศึกษา", "ชื่อ-สกุล", ...qNums.map((q) => `ข้อ ${q}`), "รวมถูก"];
    title(ws, "ถูก (✓) / ผิด (✗) / ไม่ตอบ (-) แยกตามข้อในกระดาษต้นฉบับ", header.length);
    ws.addRow(header);
    const rightPerQ = new Map<number, number>();
    for (const room of rooms) {
      if (!inRoom(room).some((s) => sheets.has(s.studentId))) continue;
      roomBar(ws, room, header.length);
      for (const s of inRoom(room)) {
        const rows = sheets.get(s.studentId);
        if (!rows) continue;
        const byQ = new Map(rows.map((r) => [r.paperNumber ?? r.number, r]));
        const marks = qNums.map((q) => {
          const r = byQ.get(q);
          if (r?.isCorrect) rightPerQ.set(q, (rightPerQ.get(q) ?? 0) + 1);
          return r?.isCorrect === true ? "✓" : r?.isCorrect === false ? "✗" : "-";
        });
        ws.addRow([...who(s), ...marks, rows.filter((r) => r.isCorrect).length]);
      }
    }
    ws.addRow(["", "", "", "จำนวนคนที่ตอบถูก", ...qNums.map((q) => rightPerQ.get(q) ?? 0), ""]);
    [16, 7, 18, 32].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    for (let c = 5; c <= 5 + qNums.length; c++) ws.getColumn(c).width = 6;
    style(ws, 3);
    const bars = roomBars.get(ws) ?? [];
    ws.eachRow((row, n) => {
      if (n < 3 || bars.includes(n)) return;
      for (let c = 5; c <= 5 + qNums.length; c++) {
        const cell = row.getCell(c);
        cell.alignment = n === 3 ? { horizontal: "center", textRotation: 90 } : { horizontal: "center" };
        if (cell.value === "✗") cell.font = { ...font, color: { argb: "FFC00000" } };
      }
    });
    paintRoomBars(ws);
  }

  // 3) Every answer each student gave.
  {
    const ws = wb.addWorksheet("คำตอบรายคน");
    const header = [
      "ห้อง", "เลขที่", "รหัสนักศึกษา", "ชื่อ-สกุล", "ข้อ (ต้นฉบับ)", "ลำดับที่นักศึกษาเห็น", "คำถาม",
      "รหัสที่ตอบ", "คำตอบของนักศึกษา", "คำตอบที่ถูก", "ผล",
    ];
    title(ws, "คำตอบของนักศึกษารายข้อ", header.length);
    ws.addRow(header);
    for (const room of rooms) {
      if (!inRoom(room).some((s) => sheets.has(s.studentId))) continue;
      roomBar(ws, room, header.length);
      for (const s of inRoom(room)) {
        const rows = sheets.get(s.studentId);
        if (!rows) continue;
        for (const r of [...rows].sort((a, b) => (a.paperNumber ?? a.number) - (b.paperNumber ?? b.number)))
          ws.addRow([
            ...who(s),
            r.paperNumber ?? r.number,
            r.number,
            r.prompt,
            r.chosen?.code ?? "",
            r.chosen?.label ?? "ไม่ได้ตอบ",
            r.correct?.label ?? "",
            r.isCorrect === true ? "ถูก" : r.isCorrect === false ? "ผิด" : "ไม่ตอบ",
          ]);
      }
    }
    [16, 7, 18, 30, 9, 10, 60, 10, 30, 30, 8].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    style(ws, 3, [4, 7, 9, 10]);
    paintRoomBars(ws);
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: header.length } };
  }

  // 4) Rule breaks.
  {
    const ws = wb.addWorksheet("บันทึกการทุจริต");
    const header = ["ห้อง", "เลขที่", "รหัสนักศึกษา", "ชื่อ-สกุล", "ครั้งที่", "พฤติกรรม", "เวลา", "ขณะทำข้อที่"];
    title(ws, `บันทึกพฤติกรรมส่อทุจริต (กำหนดสูงสุด ${opts.maxViolations} ครั้ง)`, header.length);
    ws.addRow(header);
    for (const room of rooms) {
      if (!inRoom(room).some((s) => s.violations.length)) continue;
      roomBar(ws, room, header.length);
      for (const s of inRoom(room))
        [...s.violations].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).forEach((v, i) => {
          const q = v.detail?.questionIndex;
          ws.addRow([
            ...who(s),
            i + 1,
            VIOLATION_TRANSLATION[v.type] ?? v.type,
            localDate(v.occurredAt),
            typeof q === "number" ? q + 1 : "",
          ]);
        });
    }
    if (ws.rowCount === 3) ws.addRow(["", "", "", "ไม่พบการทุจริต"]);
    ws.getColumn(7).numFmt = dateFmt;
    [16, 7, 18, 32, 8, 32, 20, 11].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    style(ws, 3, [4, 6]);
    paintRoomBars(ws);
  }

  // 5) What the proctor did.
  {
    const ws = wb.addWorksheet("การสั่งการผู้คุมสอบ");
    const header = ["เวลา", "การสั่งการ", "นักศึกษา", "รายละเอียด", "โดย"];
    title(ws, "ประวัติการสั่งการของผู้คุมสอบ", header.length);
    ws.addRow(header);
    const nameById = new Map(students.map((s) => [s.studentId, `(${s.studentCode}) ${s.fullName}`]));
    for (const a of [...opts.audit].sort((x, y) => x.createdAt.localeCompare(y.createdAt))) {
      const studentId = typeof a.metadata?.studentId === "string" ? a.metadata.studentId : null;
      // The audit covers every room; a one-room export keeps the room-wide actions and its own students.
      if (studentId && !nameById.has(studentId)) continue;
      const extra =
        a.action === "ATTEMPT_MESSAGE"
          ? String(a.metadata?.message ?? "")
          : a.action === "ATTEMPT_ADD_TIME"
            ? `+${Number(a.metadata?.seconds ?? 0) / 60} นาที`
            : "";
      ws.addRow([
        localDate(a.createdAt),
        AUDIT_ACTION_TH[a.action] ?? a.action,
        studentId ? nameById.get(studentId) : "",
        extra,
        a.actorName,
      ]);
    }
    ws.getColumn(1).numFmt = dateFmt;
    [20, 18, 34, 50, 24].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    style(ws, 3, [3, 4]);
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const stamp = new Date().toLocaleDateString("sv-SE");
  const safe = (t: string) => t.replace(/[\\/:*?"<>|]/g, "").slice(0, 80).trim();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${safe(opts.examTitle)} - ${safe(opts.roomLabel)} - ${stamp}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
