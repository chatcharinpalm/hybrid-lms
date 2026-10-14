import { detectExam, type Draft } from "./detect";

export type { Draft, DraftBlock, DraftQuestion, QType } from "./detect";
export { MARKERS, markerLabel, normalizeCode } from "./detect";

/** Reads the teacher's Word or PDF file into an exam draft, in the document's own layout. */
export async function importDocument(file: File): Promise<Draft> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".docx")) {
    const { readDocx } = await import("./docx");
    const { units, warnings } = await readDocx(file);
    return detectExam(units, file.name, warnings);
  }
  if (name.endsWith(".pdf")) {
    const { readPdf } = await import("./pdf");
    const { units, warnings } = await readPdf(file);
    return detectExam(units, file.name, warnings);
  }
  if (name.endsWith(".doc")) throw new Error("ไฟล์ .doc รุ่นเก่า: เปิดใน Word แล้ว Save As เป็น .docx ก่อน");
  throw new Error("รองรับไฟล์ Word (.docx) และ PDF");
}
