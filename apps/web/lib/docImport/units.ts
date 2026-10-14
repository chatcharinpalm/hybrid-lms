/**
 * A teacher's document (Word or PDF) read into "units" in reading order: a
 * paragraph (its runs of formatted text and pictures) or a table. detect.ts
 * finds the questions in them; render.ts turns them back into HTML so the
 * exam looks like the document.
 */

export interface Run {
  text: string;
  b?: boolean;
  i?: boolean;
  u?: boolean;
  s?: boolean;
  sub?: boolean;
  sup?: boolean;
  sizePt?: number;
  color?: string;
  /** Highlighted / shaded text (teachers often mark the answer this way). */
  hl?: boolean;
  /** A picture; its text is one OBJECT REPLACEMENT CHARACTER. */
  img?: { src: string; w: number; h: number };
  br?: boolean;
}

export interface ParaUnit {
  kind: "p";
  /** Word's automatic numbering ("1.", "ก.", "a)"), not part of the runs. */
  label: string;
  runs: Run[];
  align?: "left" | "center" | "right" | "justify";
  indentPt?: number;
  /** Heading level from the paragraph style (1–3), 0 for body text. */
  heading?: number;
  /** label + runs as plain text, spaces collapsed. */
  text: string;
}

export interface TableUnit {
  kind: "table";
  rows: Array<Array<{ text: string; html: string; colspan: number; hidden?: boolean }>>;
  text: string;
}

export type Unit = ParaUnit | TableUnit;

export const OBJ = "￼";

export const cleanText = (s: string) =>
  s
    .replace(/[\u{E0000}-\u{E01EF}︀-️​­]/gu, "")
    .replace(/￼/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const rawText = (runs: Run[]) => runs.map((r) => (r.img ? OBJ : r.br ? "\n" : r.text)).join("");

export function paraUnit(label: string, runs: Run[], extra: Partial<ParaUnit> = {}): ParaUnit {
  return { kind: "p", label, runs, ...extra, text: cleanText(`${label} ${rawText(runs)}`) };
}
