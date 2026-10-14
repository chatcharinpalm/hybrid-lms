import { paraUnit, type Unit } from "./units";

/** Thai marks drawn above or below a letter (vowels, tone marks, thanthakhat). */
const THAI_MARKS = /^[ัิ-ฺ็-๎]+$/;

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
}

/**
 * Reads a PDF's text line by line (a PDF has no paragraphs or tables, only
 * placed text). Scanned PDFs are pictures with no text and can't be read.
 */
export async function readPdf(file: File): Promise<{ units: Unit[]; warnings: string[] }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.js", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const units: Unit[] = [];
  let chars = 0;

  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const width = page.getViewport({ scale: 1 }).width;
    const content = await page.getTextContent();
    const styles = content.styles as Record<string, { fontFamily?: string }>;
    const all = (content.items as TextItem[]).filter((it) => typeof it.str === "string" && it.str.length > 0);
    // Thai vowels and tone marks above/below a letter often come as their own pieces,
    // drawn a little off the line; they are put back into the word they sit on.
    const isMark = (s: string) => THAI_MARKS.test(s);
    const items = all.filter((it) => !isMark(it.str));
    const marks = all.filter((it) => isMark(it.str));

    // Group by baseline (top to bottom), then left to right.
    const lines: Array<{ y: number; size: number; items: TextItem[] }> = [];
    for (const it of items) {
      const y = it.transform[5];
      const size = Math.abs(it.transform[3]) || it.height || 10;
      const line = lines.find((l) => Math.abs(l.y - y) < Math.max(2, size * 0.35));
      if (line) line.items.push(it);
      else lines.push({ y, size, items: [it] });
    }
    lines.sort((a, b) => b.y - a.y);

    for (const m of marks) {
      const y = m.transform[5];
      const x = m.transform[4];
      const line = lines
        .filter((l) => Math.abs(l.y - y) < l.size * 1.1)
        .sort((a, b) => Math.abs(a.y - y) - Math.abs(b.y - y))[0];
      const host = line?.items.find((it) => x >= it.transform[4] - 1 && x <= it.transform[4] + it.width + 1);
      if (!host) continue;
      // Position in the word by width, after the letter the mark sits on.
      const chars = [...host.str];
      const at = Math.min(chars.length, Math.max(1, Math.round(((x - host.transform[4]) / (host.width || 1)) * chars.length + 0.5)));
      chars.splice(at, 0, m.str);
      host.str = chars.join("");
    }

    for (const line of lines) {
      line.items.sort((a, b) => a.transform[4] - b.transform[4]);
      let text = "";
      let lastEnd: number | null = null;
      let boldChars = 0;
      for (const it of line.items) {
        const x = it.transform[4];
        if (lastEnd !== null && x - lastEnd > line.size * 0.2) text += x - lastEnd > line.size * 1.5 ? "\t" : " ";
        text += it.str;
        lastEnd = x + it.width;
        const font = `${it.fontName} ${styles[it.fontName]?.fontFamily ?? ""}`;
        if (/bold|black|heavy/i.test(font)) boldChars += it.str.length;
      }
      // Sara am written as nikhahit + sara aa.
      text = text
        .normalize("NFC")
        .replace(/ํา/g, "ำ")
        // A tone mark goes after the vowel above/below its letter, never before it
        // or on a leading vowel (เ แ โ ใ ไ).
        .replace(/([่-๋])([ัิ-ฺ็])/g, "$2$1")
        .replace(/([เ-ไ])([่-๋])([ก-ฮ])/g, "$1$3$2");
      if (!text.trim()) continue;
      chars += text.length;
      const left = line.items[0].transform[4];
      const right = lastEnd ?? left;
      const centered = Math.abs((left + right) / 2 - width / 2) < width * 0.05 && right - left < width * 0.7;
      units.push(
        paraUnit("", [{ text, b: boldChars > text.length / 2 || undefined }], {
          align: centered ? "center" : undefined,
        })
      );
    }
  }

  const warnings = [
    "ไฟล์ PDF: อ่านได้เฉพาะข้อความ (ตารางจะกลายเป็นบรรทัด และไม่มีรูปภาพ) และ PDF บางไฟล์เก็บวรรณยุกต์ภาษาไทยไว้ไม่ครบ (เช่น \"ที่\" เป็น \"ที\") — ถ้ามีไฟล์ Word ต้นฉบับ ใช้ไฟล์ Word จะได้หน้าตาครบและถูกต้องกว่า",
  ];
  if (chars < 20) throw new Error("PDF นี้ไม่มีข้อความให้อ่าน (น่าจะเป็นไฟล์สแกนเป็นรูปภาพ) — กรุณาใช้ไฟล์ Word หรือ PDF ที่สร้างจาก Word");
  return { units, warnings };
}
