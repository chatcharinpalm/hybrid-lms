import { apiFetch } from "@/lib/api";
import { OBJ, rawText } from "@/lib/docImport/units";
import {
  cleanLine,
  essayWorksheet,
  ESSAY_TITLE,
  itemsToBlocks,
  practiceStart,
  quizQuestions,
  splitSections,
  type DraftBlock,
  type DraftQuestion,
  type DraftSection,
  type DraftWorksheet,
  type StudyItem,
} from "./parse";

/** Reads a .docx in reading order: text paragraphs and the pictures between them (pictures already shrunk by the reader). */
export async function readStudyItems(file: File): Promise<StudyItem[]> {
  const { readDocx } = await import("@/lib/docImport/docx");
  const { units } = await readDocx(file);
  const items: StudyItem[] = [];
  const pushText = (raw: string) => {
    const text = cleanLine(raw.replaceAll(OBJ, ""));
    if (text) items.push({ kind: "text", text });
  };
  for (const unit of units) {
    if (unit.kind === "p") {
      pushText(rawText(unit.runs));
      for (const run of unit.runs) if (run.img) items.push({ kind: "image", src: run.img.src });
    } else {
      for (const row of unit.rows) for (const cell of row) pushText(cell.text);
    }
  }
  return items;
}

export interface ImportParts {
  courseId: string;
  number: number;
  title: string;
  lesson?: File;
  quiz?: File;
  worksheet?: File;
  onProgress: (message: string) => void;
}

/** A block as the API stores it: a picture carries its image (a data URL) in `url`. */
type SavedBlock = { type: "text"; text: string } | { type: "image"; url: string; alt?: string };

interface ExistingChapter {
  id: string;
  sections: { title: string; blocks: SavedBlock[] }[];
  questions: DraftQuestion[];
  worksheets: { title: string; blocks: SavedBlock[]; answers: SavedBlock[] | null }[];
}

/** Saved blocks back into the shape the importer works with (a picture's image is its src). */
function fromSaved(blocks: SavedBlock[]): DraftBlock[] {
  return blocks.map((b) => (b.type === "text" ? b : { type: "image", src: b.url, alt: b.alt ?? "" }));
}

/** Back to the saved shape: pictures stay inside the content as data URLs, like exam pictures. */
function toSaved(blocks: DraftBlock[]): SavedBlock[] {
  return blocks.map((b) => (b.type === "text" ? { type: "text", text: b.text } : { type: "image", url: b.src, alt: b.alt }));
}

/**
 * Imports the files of one review chapter. Only the parts whose file was given are replaced;
 * the rest of the chapter is kept as it is.
 */
export async function importChapter(parts: ImportParts) {
  const { courseId, number, title, onProgress } = parts;

  onProgress("กำลังหาบทเดิม...");
  const list = await apiFetch<{ id: string; number: number }[]>(`/api/study/courses/${courseId}/chapters`);
  let chapterId = list.find((c) => c.number === number)?.id;
  if (!chapterId) {
    const created = await apiFetch<{ id: string }>(`/api/study/courses/${courseId}/chapters`, {
      method: "POST",
      body: JSON.stringify({ number, title }),
    });
    chapterId = created.id;
  }
  const existing = await apiFetch<ExistingChapter>(`/api/study/chapters/${chapterId}`);

  // Read every file first; nothing is saved until all of them are read.
  let sections: DraftSection[] = existing.sections.map((s) => ({ title: s.title, blocks: fromSaved(s.blocks) }));
  let questions: DraftQuestion[] = existing.questions;
  const warnings: string[] = [];

  if (parts.lesson) {
    onProgress("กำลังอ่านใบเนื้อหา...");
    const items = await readStudyItems(parts.lesson);
    sections = splitSections(items.slice(0, practiceStart(items)));
  }

  let quizParas: string[] = [];
  if (parts.quiz) {
    onProgress("กำลังอ่านชุดข้อสอบทบทวน...");
    quizParas = (await readStudyItems(parts.quiz)).flatMap((i) => (i.kind === "text" ? [i.text] : []));
    questions = quizParas.length ? quizQuestions(quizParas) : [];
    if (questions.length === 0) warnings.push("ไม่พบข้อสอบแบบปรนัยในไฟล์ชุดทบทวน");
  }

  // Worksheets: the uploaded worksheet replaces the old one; the essay part comes from the quiz file.
  const savedWorksheets: DraftWorksheet[] = existing.worksheets.map((w) => ({
    title: w.title,
    blocks: fromSaved(w.blocks),
    answers: w.answers ? fromSaved(w.answers) : null,
  }));
  let mainWorksheets = savedWorksheets.filter((w) => w.title !== ESSAY_TITLE);
  if (parts.worksheet) {
    onProgress("กำลังอ่านใบงาน...");
    const items = await readStudyItems(parts.worksheet);
    const firstText = items.find((i) => i.kind === "text");
    mainWorksheets = [
      { title: firstText?.kind === "text" ? firstText.text.slice(0, 300) : "ใบงาน", blocks: itemsToBlocks(items), answers: null },
    ];
  }
  let essayWorksheets = savedWorksheets.filter((w) => w.title === ESSAY_TITLE);
  if (parts.quiz) {
    const essay = essayWorksheet(quizParas);
    essayWorksheets = essay ? [essay] : [];
  }
  const worksheets = [...mainWorksheets, ...essayWorksheets];

  const pictures = [...sections.flatMap((s) => s.blocks), ...worksheets.flatMap((w) => [...w.blocks, ...(w.answers ?? [])])].filter(
    (b) => b.type === "image"
  ).length;

  onProgress("กำลังบันทึกเนื้อหา...");
  const saved = await apiFetch<{ sections: number; questions: number; worksheets: number }>(
    `/api/study/chapters/${chapterId}/content`,
    {
      method: "PUT",
      body: JSON.stringify({
        sections: sections.map((s) => ({ title: s.title, blocks: toSaved(s.blocks) })),
        questions: questions.map((q) => ({
          text: q.text,
          choices: q.choices,
          answerIndex: q.answerIndex,
          explanation: q.explanation,
        })),
        worksheets: worksheets.map((w) => ({
          title: w.title,
          blocks: toSaved(w.blocks),
          answers: w.answers ? toSaved(w.answers) : null,
        })),
      }),
    }
  );
  return { chapterId, pictures, warnings, ...saved };
}
