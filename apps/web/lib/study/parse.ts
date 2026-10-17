// Turns a teacher's review-lesson Word files into chapter content (ทบทวนบทเรียน).
// Pictures are read here as data URLs; the importer uploads them and swaps in their links.

export type StudyItem = { kind: "text"; text: string } | { kind: "image"; src: string };

/** A block as the editor sees it: text, or a picture that is still a data URL until uploaded. */
export type DraftBlock = { type: "text"; text: string } | { type: "image"; src: string; alt: string };

export interface DraftSection {
  title: string;
  blocks: DraftBlock[];
}

export interface DraftQuestion {
  text: string;
  choices: { label: string; text: string }[];
  answerIndex: number;
  explanation: string | null;
}

export interface DraftWorksheet {
  title: string;
  blocks: DraftBlock[];
  answers: DraftBlock[] | null;
}

export const ESSAY_TITLE = "ข้อสอบอัตนัยทบทวน";

/** Removes drawing artefacts ("-32385000" glued in front of Thai text) and collapses spaces. */
export function cleanLine(s: string) {
  return s
    .replace(/(?:center|left|right)?-?\d{5,}(?=[ก-ฮ])/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Index of the first practice question ("N. …?"); the lesson file ends with its own practice set, which is dropped. */
export function practiceStart(items: StudyItem[]) {
  const at = items.findIndex((i) => i.kind === "text" && /^\d{1,2}\.\s.*\?\s*$/.test(i.text));
  return at < 0 ? items.length : at;
}

/** Splits items at numbered headings ("2. วิวัฒนาการ…"). Text before the first heading is the objectives section. */
export function splitSections(items: StudyItem[]): DraftSection[] {
  const sections: DraftSection[] = [];
  let current: DraftSection = { title: "วัตถุประสงค์การเรียนรู้", blocks: [] };
  // Thai block (U+0E01–U+0E5B) so titles starting with เ/โ/ใ/แ also count.
  const heading = /^(?:(?:center|left|right)?-?\d{5,})?(\d{1,2})\.\s*([ก-๛].*)$/;
  // Chapter headings count up (some are unnumbered in the Word file), so a numbered line that
  // jumps back, like "3. ผลลัพธ์" inside an example, is body text.
  let last = 0;
  for (const item of items) {
    if (item.kind === "text") {
      const m = item.text.match(heading);
      const n = m ? Number(m[1]) : 0;
      if (m && n > last && n <= last + 2) {
        last = n;
        if (current.blocks.length) sections.push(current);
        current = { title: `${m[1]}. ${m[2]}`.slice(0, 300), blocks: [] };
        continue;
      }
    }
    current.blocks.push(item.kind === "text" ? { type: "text", text: item.text } : { type: "image", src: item.src, alt: "" });
  }
  if (current.blocks.length) sections.push(current);
  return sections;
}

/** Plain blocks (no pictures) from items, for the worksheet and essay answers. */
export function itemsToBlocks(items: StudyItem[]): DraftBlock[] {
  return items.map((i) => (i.kind === "text" ? { type: "text", text: i.text } : { type: "image", src: i.src, alt: "" }));
}

/** MC practice set: "N. question", choice lines "ก. … ข. …", then "เฉลย: ค.". */
export function quizQuestions(paras: string[]): DraftQuestion[] {
  const questions: DraftQuestion[] = [];
  let draft: { text: string; choices: { label: string; text: string }[] } | null = null;
  const letters = ["ก", "ข", "ค", "ง", "จ", "ฉ", "ช", "ซ"];
  for (const para of paras) {
    const answer = para.match(/^เฉลย:\s*([ก-ฮ])/);
    if (answer && draft) {
      const answerIndex = letters.indexOf(answer[1]);
      if (answerIndex >= 0 && answerIndex < draft.choices.length) {
        questions.push({ ...draft, answerIndex, explanation: null });
      }
      draft = null;
      continue;
    }
    // Choice line(s): "ก. Byte ข. Bit" → split on the Thai letter markers.
    if (draft && /^[ก-ง]\.\s/.test(para)) {
      const parts = para.split(new RegExp(`\\s*(?=[${letters.join("")}]\\.\\s)`));
      for (const part of parts) {
        const c = part.match(/^([ก-ซ])\.\s*(.*)$/);
        if (c) draft.choices.push({ label: `${c[1]}.`, text: c[2].trim() });
      }
      continue;
    }
    const q = para.match(/^(\d{1,2})\.\s*(.+)$/);
    if (q) {
      draft = { text: q[2], choices: [] };
      continue;
    }
    // Continuation of a question that wraps onto the next line.
    if (draft && draft.choices.length === 0) draft.text += " " + para;
  }
  return questions;
}

/** Essay part ("ส่วนที่ 2"): questions, with their "แนวทางการตอบ" lines as the answers. */
export function essayWorksheet(paras: string[]): DraftWorksheet | null {
  const start = paras.findIndex((p) => p.startsWith("ส่วนที่ 2"));
  if (start < 0) return null;
  const body = paras.slice(start + 1).filter((p) => !p.startsWith("คำชี้แจง"));
  const questions = body.filter((p) => !p.startsWith("แนวทางการตอบ"));
  const guides = body.filter((p) => p.startsWith("แนวทางการตอบ")).map((p) => p.replace(/^แนวทางการตอบ:\s*/, ""));
  return {
    title: ESSAY_TITLE,
    blocks: questions.map((text) => ({ type: "text", text })),
    answers: guides.map((text) => ({ type: "text", text })),
  };
}
