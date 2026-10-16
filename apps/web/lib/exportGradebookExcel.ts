import { ENDED_REASON_TH } from "@/lib/exportExamExcel";

export interface GradebookAttempt {
  id: string;
  examId: string;
  studentId: string;
  status: string;
  startedAt: string;
  submittedAt: string | null;
  scorePoints: number | null;
  scorePercent: number | null;
  passed: boolean | null;
  endedReason: string | null;
  violationCount: number;
  archivedAt: string | null;
}

export interface Gradebook {
  course: { id: string; title: string };
  exams: Array<{
    id: string;
    title: string;
    status: string;
    isHidden: boolean;
    passScorePercent: number;
    totalQuestions: number;
    /** Rooms set to sit it; null = every room. */
    sections: string[] | null;
  }>;
  students: Array<{ id: string; fullName: string; studentCode: string | null; section: string | null; seatNumber: number }>;
  attempts: GradebookAttempt[];
}

const localDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000);
};

/**
 * The gradebook as a workbook: one sheet per room (latest counted score per
 * exam, how many times sat), then every sitting ever made, reset ones included.
 */
export async function exportGradebookExcel(book: Gradebook, onlyRoom: string | null) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const font = { name: "TH SarabunPSK", size: 14 };
  const roomOf = (s: Gradebook["students"][number]) => s.section ?? "ไม่ระบุห้อง";
  const students = book.students.filter((s) => !onlyRoom || roomOf(s) === onlyRoom);
  const rooms = [...new Set(students.map(roomOf))];
  const byKey = new Map<string, GradebookAttempt[]>();
  for (const a of book.attempts) byKey.set(`${a.studentId}:${a.examId}`, [...(byKey.get(`${a.studentId}:${a.examId}`) ?? []), a]);
  const counted = (list: GradebookAttempt[] = []) => list.filter((a) => !a.archivedAt && a.status !== "IN_PROGRESS");

  const finish = (ws: import("exceljs").Worksheet, headerRow: number) => {
    ws.eachRow((row, n) => {
      row.eachCell({ includeEmpty: true }, (c) => {
        c.font = { ...font, bold: n <= headerRow };
        if (n >= headerRow)
          c.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
        if (n === headerRow) {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E2F3" } };
          c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        }
      });
    });
    ws.views = [{ state: "frozen", ySplit: headerRow, xSplit: 3 }];
  };

  for (const room of rooms) {
    const ws = wb.addWorksheet(`ห้อง ${room}`.replace(/[\\/?*[\]:]/g, " ").slice(0, 31));
    const header = ["เลขที่", "รหัสนักศึกษา", "ชื่อ-สกุล"];
    for (const e of book.exams) header.push(`${e.title} (เต็ม ${e.totalQuestions})`, "สอบ (ครั้ง)");
    header.push("สอบแล้ว (ชุด)", "ผ่าน (ชุด)");
    ws.addRow([`${book.course.title} — สมุดคะแนน ห้อง ${room}`]);
    ws.addRow([`คะแนน = ครั้งล่าสุดที่นับ · ส่งออกเมื่อ ${new Date().toLocaleString("th-TH")}`]);
    ws.mergeCells(1, 1, 1, header.length);
    ws.mergeCells(2, 1, 2, header.length);
    ws.addRow(header);
    for (const s of students.filter((x) => roomOf(x) === room)) {
      const cells: Array<string | number | null> = [s.seatNumber, s.studentCode ?? "", s.fullName];
      let done = 0;
      let passed = 0;
      for (const e of book.exams) {
        const list = byKey.get(`${s.id}:${e.id}`) ?? [];
        const last = counted(list).at(-1);
        if (last) done++;
        if (last?.passed) passed++;
        cells.push(last ? last.scorePoints ?? 0 : null, list.length || null);
      }
      cells.push(done, passed);
      const row = ws.addRow(cells);
      // Fail in red.
      book.exams.forEach((e, i) => {
        const last = counted(byKey.get(`${s.id}:${e.id}`)).at(-1);
        if (last && !last.passed) row.getCell(4 + i * 2).font = { ...font, color: { argb: "FFC00000" } };
      });
    }
    [7, 18, 30].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    book.exams.forEach((_, i) => {
      ws.getColumn(4 + i * 2).width = 14;
      ws.getColumn(5 + i * 2).width = 8;
    });
    finish(ws, 3);
  }

  // Every sitting, reset ones included.
  {
    const ws = wb.addWorksheet("ประวัติการสอบทุกครั้ง");
    const header = ["ห้อง", "เลขที่", "รหัสนักศึกษา", "ชื่อ-สกุล", "แบบทดสอบ", "ครั้งที่", "เริ่ม", "ส่ง", "คะแนน", "เต็ม", "ผล", "หมายเหตุ"];
    ws.addRow([`${book.course.title} — ประวัติการสอบทุกครั้ง (รวมสอบซ้ำ สอบแก้ และรอบที่ถูกรีเซ็ต)`]);
    ws.addRow([`ส่งออกเมื่อ ${new Date().toLocaleString("th-TH")}`]);
    ws.mergeCells(1, 1, 1, header.length);
    ws.mergeCells(2, 1, 2, header.length);
    ws.addRow(header);
    for (const s of students)
      for (const e of book.exams)
        (byKey.get(`${s.id}:${e.id}`) ?? []).forEach((a, i) =>
          ws.addRow([
            roomOf(s),
            s.seatNumber,
            s.studentCode ?? "",
            s.fullName,
            e.title,
            i + 1,
            localDate(a.startedAt),
            localDate(a.submittedAt),
            a.scorePoints,
            e.totalQuestions,
            a.status === "IN_PROGRESS" ? "กำลังสอบ" : a.passed ? "ผ่าน" : a.passed === false ? "ไม่ผ่าน" : "",
            [a.archivedAt && "ถูกรีเซ็ต (ไม่นับ)", a.endedReason && ENDED_REASON_TH[a.endedReason], a.violationCount > 0 && `ทุจริต ${a.violationCount} ครั้ง`]
              .filter(Boolean)
              .join(" · "),
          ])
        );
    ws.getColumn(7).numFmt = "dd/mm/yyyy hh:mm";
    ws.getColumn(8).numFmt = "dd/mm/yyyy hh:mm";
    [16, 7, 18, 30, 40, 7, 18, 18, 8, 7, 9, 30].forEach((w, i) => (ws.getColumn(i + 1).width = w));
    finish(ws, 3);
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: header.length } };
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const safe = (t: string) => t.replace(/[\\/:*?"<>|]/g, "").slice(0, 80).trim();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `สมุดคะแนน - ${safe(book.course.title)}${onlyRoom ? ` - ${safe(onlyRoom)}` : ""} - ${new Date().toLocaleDateString("sv-SE")}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
