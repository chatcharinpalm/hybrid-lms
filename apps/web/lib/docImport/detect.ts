import type { ChoiceMarker, PaperBlock } from "@/types/exam";
import { renderPara, renderTable, type Cut } from "./render";
import { cleanText, rawText, type ParaUnit, type TableUnit, type Unit } from "./units";

/**
 * Finds the exam in a document of any layout — no template. What it knows:
 *
 *  questions   a numbered item: "1.", "1)", "ข้อ 1", or Word's own list numbering
 *  choices     ก. ข. ค. ง. / a) b) c) / A. B. / (1) (2), one per line or several on a line
 *  true/false  a part whose instructions speak of ถูก/ผิด (True/False)
 *  blanks      dotted or underlined gaps (……, ____, [ ...... ]) — the student writes there;
 *              with an Option Bank table in the paper, a blank takes a bank code
 *  essays      a question with nothing to fill in or choose
 *  answers     a เฉลย / Answer key section (lines, runs like "1.ก 2.ข", or tables),
 *              "ตอบ …" lines, or the right choice marked in the document
 *              (highlighted, coloured, bold, * or ✓)
 *
 * Everything else (header, instructions, tables, pictures) is kept as it is.
 * The teacher checks and fixes the result before it is saved.
 */

export type QType = "SINGLE_CHOICE" | "SHORT_ANSWER" | "FILL_IN_BANK" | "ESSAY";
export type Marker = ChoiceMarker;

export interface DraftQuestion {
  key: string;
  type: QType;
  /** Plain text, for the back office (monitor, answer sheets, Excel). */
  prompt: string;
  points: number;
  /** SINGLE_CHOICE */
  options: Array<{ label: string; isCorrect: boolean }>;
  /** FILL_IN_BANK: the right bank code. */
  bankAnswer: string | null;
  /** SHORT_ANSWER: accepted answers "a | b"; ESSAY: a guide for the teacher. */
  answerKey: string;
  /** Why the answer is right, from the key ("ตอบ ค. 48 บิต (MAC Address มีขนาด 48 บิต)"); shown to students in review. */
  explanation?: string;
}

/** Slots name DraftQuestion keys until the server swaps in Question ids. */
export type DraftBlock = PaperBlock;

export interface Draft {
  title: string;
  durationMinutes: number;
  bank: Array<{ code: string; label: string }>;
  blocks: DraftBlock[];
  questions: DraftQuestion[];
  warnings: string[];
}

export const MARKERS: Record<Marker, string> = { thai: "กขคงจฉชซฌญ", lower: "abcdefghij", upper: "ABCDEFGHIJ", num: "123456789" };
export const markerLabel = (m: Marker | undefined, i: number) =>
  m === "num" ? `(${i + 1})` : `${MARKERS[m ?? "thai"][i] ?? i + 1}.`;

const Q_TEXT = /^(?:ข้อ(?:ที่)?\s*)?(\d{1,3})\s*[.):]\s*|^ข้อ(?:ที่)?\s*(\d{1,3})\s+/;
const Q_RAW = /^\s*(?:ข้อ(?:ที่)?\s*)?\d{1,3}\s*[.):]\s*|^\s*ข้อ(?:ที่)?\s*\d{1,3}\s+/;
const BLANK_G = /\[\s*[.…_·\s]{2,}\s*\]|\(\s*[.…_·]{3,}\s*\)|[.…_·]{4,}|_{3,}/g;
const PART = /^(ส่วนที่|ตอนที่|ตอน|part|section)\s*[\dก-ฮIVX๑-๙]+/i;
const KEY_HEAD = /^(?:เฉลย|ตารางเฉลย|answer\s*key|answers?\b|key\s*[:：])/i;
const ANSWER_LINE = /^(?:ตอบ|คำตอบ|answer|ans)\s*[:：.]?\s*(.+)$/i;
const TF_HINT = /ถูก.{0,40}ผิด|ผิด.{0,40}ถูก|true.{0,40}false|✓.{0,40}✗/i;
/** Choices that point at other choices; their order must stay as printed. */
const REFERS = /ทุกข้อ|ทั้ง\s*\S+\s*และ|ไม่มีข้อใด|ข้อ\s*[กขคงจ]\s*(และ|หรือ|,)|all of the above|none of the above|both\s+\S+\s+and|\b[a-d]\s+and\s+[a-d]\b/i;
const MARK_CHARS = /^\s*[*✓✔√]\s*|\s*[*✓✔√]\s*$/g;
/** Bank codes: "[Code 01]", "Code 1", "A", "AB", "[A01]". */
const CODE_RE = /^\[?\s*(code\s*\d{1,3}|[A-Z]{1,3}-?\d{0,3})\s*\]?$/i;

const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋" };
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", n: "ⁿ", E: "ᴱ" };
/** Sub/superscript as Unicode for plain text (one character for one, so offsets hold). */
const scriptText = (s: string, map: Record<string, string>) => [...s].map((c) => map[c] ?? c).join("");

export const normalizeCode = (s: string) =>
  s.toUpperCase().replace(/CODE/g, "").replace(/[\s[\]]/g, "").replace(/\d+/g, (d) => String(Number(d)));
const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, "").replace(/[.)]$/, "");

function canonicalCode(raw: string): string {
  const inner = raw.replace(/[[\]]/g, "").trim();
  const m = inner.match(/^code\s*(\d+)$/i);
  return m ? `Code ${m[1].padStart(2, "0")}` : inner.toUpperCase();
}

function compareCodes(a: string, b: string) {
  const split = (c: string) => {
    const m = c.toUpperCase().match(/^(.*?)(\d*)$/)!;
    return { letters: m[1], num: m[2] ? Number(m[2]) : -1 };
  };
  const x = split(a);
  const y = split(b);
  if (x.letters.length !== y.letters.length) return x.letters.length - y.letters.length;
  if (x.letters !== y.letters) return x.letters < y.letters ? -1 : 1;
  return x.num - y.num;
}

/** A whole bank entry in one cell: "A. ฟลิปฟลอป (Flip-flop)", "AB) …", "[A01] …". */
const CODE_CELL = /^(\[\s*(?:code\s*\d{1,3}|[A-Z]{1,3}-?\d{0,3})\s*\]|[A-Z]{1,3}-?\d{0,3}\s*[.):])\s*(\S.*)$/;

function bankPairs(t: TableUnit) {
  const pairs: Array<{ code: string; label: string }> = [];
  // Code and text in neighbouring cells. The code may carry a stray dot, colon or bracket ("A.", "[A01]", " B ").
  for (const row of t.rows) {
    const cells = row.filter((c) => !c.hidden);
    for (let c = 0; c + 1 < cells.length; c += 2) {
      const code = cells[c].text.trim().replace(/^[\[(]\s*|\s*[\])]$|[.):：]$/g, "").trim();
      const label = cells[c + 1].text.trim();
      if (code && label && CODE_RE.test(code)) pairs.push({ code: canonicalCode(code), label });
    }
  }
  // Code and text in the same cell (a cell may hold one entry or several lines of them).
  for (const row of t.rows) {
    for (const cell of row) {
      if (cell.hidden) continue;
      for (const line of cell.text.split(/\n|\s{2,}/)) {
        const m = line.trim().match(CODE_CELL);
        if (m) pairs.push({ code: canonicalCode(m[1].replace(/[.):：]$/, "")), label: m[2].trim() });
      }
    }
  }
  // The same entry can be read twice (one cell with two lines); keep the first of each code.
  const seen = new Set<string>();
  return pairs.filter((p) => (seen.has(p.code) ? false : (seen.add(p.code), true)));
}

/** "ก. aaa  ข. bbb" → choices, when the line starts with the next expected marker. */
function parseChoices(text: string, have: number, marker: Marker | undefined) {
  // Lookbehind, so a "2)" ending one choice ("Data Link Layer (Layer 2) ข. …") doesn't swallow the space before the next marker.
  const re = /(?<=^|\s)(?:\(([ก-ฮa-jA-J1-9])\)|([ก-ฮa-jA-J])\s*[.)]|([1-9])\))\s*/g;
  const found: Array<{ ch: string; at: number; end: number }> = [];
  for (const m of text.matchAll(re)) {
    found.push({ ch: m[1] ?? m[2] ?? m[3], at: m.index!, end: m.index! + m[0].length });
  }
  if (!found.length || found[0].at !== 0) return null;
  const kind: Marker | null = marker ?? (Object.keys(MARKERS) as Marker[]).find((k) => MARKERS[k][have] === found[0].ch) ?? null;
  if (!kind || MARKERS[kind][have] !== found[0].ch) return null;
  const chain = [found[0]];
  for (const f of found.slice(1)) {
    if (f.ch === MARKERS[kind][have + chain.length]) chain.push(f);
  }
  const labels = chain.map((c, i) => text.slice(c.end, chain[i + 1]?.at ?? text.length).trim());
  if (labels.some((l) => !l)) return null;
  return { kind, labels };
}

/**
 * The reason given after a choice answer in the key: "ค. 48 บิต (MAC Address มีขนาด 48 บิต)",
 * "ข. HttpOnly — ป้องกัน XSS อ่าน Cookie". The choice's own words (even with brackets,
 * "Data Link Layer (Layer 2)") are not a reason; what follows them is.
 */
function rationale(answer: string, label: string): string | null {
  let rest = answer.replace(/^\(?[ก-ฮa-jA-J1-9]\)?[.)]?\s*/, "").trim();
  const squash = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  // Drop the choice's words from the front, matched ignoring spaces ("Http Only" = "HttpOnly").
  const target = squash(label);
  let i = 0;
  let taken = 0;
  while (i < rest.length && taken < target.length) {
    if (!/\s/.test(rest[i])) {
      if (rest[i].toLowerCase() !== target[taken]) break;
      taken++;
    }
    i++;
  }
  if (taken === target.length) rest = rest.slice(i).trim();
  else {
    // Words differ from the choice: the reason is the last bracketed part, if any.
    const last = rest.match(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*$/);
    return last && last.index! > 0 ? last[1].trim() || null : null;
  }
  rest = rest.replace(/^[-–—:：,]\s*/, "").trim();
  const wrapped = rest.match(/^\((.*)\)$/s);
  return (wrapped ? wrapped[1] : rest).trim() || null;
}

/**
 * The answer text of a written (blank) question: the teacher's notes around it are not part of the answer.
 * "เฉลยตอบ: 2 ________ (วิเคราะห์ตามวัตถุประสงค์ข้อที่ 4: …)" → "2".
 */
function cleanKey(answer: string): string {
  return answer
    .replace(/^\s*(เฉลย(?:ตอบ)?|คำตอบ|ตอบ)\s*[:：]\s*/, "")
    .replace(/\(\s*(?:วิเคราะห์|ตามวัตถุประสงค์|วัตถุประสงค์)[^)]*\)?/g, "")
    .replace(/ตามวัตถุประสงค์ข้อที่\s*\d*\.?/g, "")
    .replace(/_{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\s/,;|]+$/, "")
    .trim()
    .slice(0, 1000);
}

/**
 * A key table's columns: the header row names each number column ("ข้อที่") and the answer column
 * right after it or further along ("คำตอบ", "คำตอบที่ถูกต้อง", "ตัวเลือกที่ถูกต้อง"). Several pairs side by side are allowed.
 */
function keyColumns(rows: string[][]): { head: number; pairs: Array<[number, number]> } | null {
  const isAns = (c: string) => /คำตอบ|เฉลย|ตัวเลือกที่ถูก|answer|correct/i.test(c);
  const isNum = (c: string) => /^(ข้อ|no\.?|#)/i.test(c.trim());
  const head = rows.findIndex((r) => r.some(isAns));
  if (head < 0) return null;
  const hdr = rows[head];
  const pairs: Array<[number, number]> = [];
  hdr.forEach((c, j) => {
    if (!isNum(c)) return;
    const k = hdr.findIndex((x, idx) => idx > j && (isAns(x) || isNum(x)));
    if (k > j && isAns(hdr[k])) pairs.push([j, k]);
  });
  return pairs.length ? { head, pairs } : null;
}

/** The words of an entry, split at brackets and slashes: "Clock Generator / Crystal Oscillator (ตัวกำเนิด…)". */
function wordsOf(s: string) {
  return s
    .normalize("NFC")
    .toLowerCase()
    .split(/\s*[/()]\s*|\s+หรือ\s+/)
    .map((x) => x.replace(/\s+/g, ""))
    .filter((x) => x.length >= 3);
}

/** The one bank entry that shares a word with the key ("Clock Generator" in "ตัวกำเนิดสัญญาณนาฬิกา (Clock Generator)"); none when it is ambiguous. */
function matchBankWord(bank: Array<{ code: string; label: string }>, key: string) {
  const mine = wordsOf(key);
  const hits = bank.filter((b) => wordsOf(b.label).some((w) => mine.includes(w)));
  return hits.length === 1 ? hits[0] : undefined;
}

/** Same words, ignoring spaces and case; "Operand (ตัวถูกดำเนินการ)" matches "Operand". */
function sameWords(a: string, b: string) {
  const w = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s+/g, "").replace(/[.)]$/, "");
  const bare = (s: string) => w(s.replace(/\([^)]*\)/g, ""));
  const x = w(a);
  const y = w(b);
  return !!x && (x === y || (!!bare(a) && bare(a) === bare(b)));
}

/** Most of the paragraph highlighted, coloured or bold: a teacher's answer mark. */
function styleMark(p: ParaUnit) {
  const chars = (f: (r: ParaUnit["runs"][number]) => boolean | undefined) =>
    p.runs.filter((r) => !r.img && f(r)).reduce((n, r) => n + r.text.replace(/\s/g, "").length, 0);
  const total = chars(() => true) || 1;
  return {
    strong: chars((r) => r.hl || (r.color != null && !/^#(000000|222222|333333)$/i.test(r.color))) / total > 0.6,
    bold: chars((r) => r.b) / total > 0.6,
  };
}

interface Building {
  num: string;
  run: number;
  tf: boolean;
  /** Question paragraphs/tables, with what to cut from each. */
  parts: Array<{ unit: Unit; cuts: Cut[] }>;
  choices: Array<{ label: string; marked: "strong" | "bold" | "char" | null }>;
  marker?: Marker;
  answer: string | null;
}

export function detectExam(units: Unit[], fileName: string, readerWarnings: string[]): Draft {
  const warnings = [...readerWarnings];
  const blocks: DraftBlock[] = [];
  const questions: DraftQuestion[] = [];
  let pendingHtml: string[] = [];
  const flushHtml = () => {
    const html = pendingHtml.join("").replace(/(<p class="doc-empty">&nbsp;<\/p>)+$/g, "");
    if (html.replace(/<p class="doc-empty">&nbsp;<\/p>/g, "").trim()) blocks.push({ t: "html", html });
    pendingHtml = [];
  };

  // ── Option Bank (fill-in-the-blank papers) ──
  // A table bank ("รหัส | คำตอบ"), or a bank written as lines of "(1) … (22) …" numbered entries.
  const tableBankAt = units.findIndex((u) => u.kind === "table" && bankPairs(u).length >= 4);
  let bankAt = tableBankAt;
  let bankRun: { from: number; to: number; pairs: Array<{ code: string; label: string }> } | null = null;
  if (tableBankAt < 0) {
    const paraBankAt = (u: Unit) => u.kind === "p" && (u.text.match(/\(\d{1,3}\)/g) ?? []).length >= 2;
    const from = units.findIndex(paraBankAt);
    if (from >= 0) {
      let to = from;
      while (to + 1 < units.length && paraBankAt(units[to + 1])) to++;
      const pairs: Array<{ code: string; label: string }> = [];
      for (const u of units.slice(from, to + 1)) {
        if (u.kind !== "p") continue;
        const marks = [...u.text.matchAll(/\((\d{1,3})\)\s*/g)];
        marks.forEach((m, k) => {
          const label = u.text.slice(m.index! + m[0].length, marks[k + 1]?.index ?? u.text.length).trim();
          if (label) pairs.push({ code: m[1], label });
        });
      }
      if (pairs.length >= 8 && to - from >= 3) {
        bankRun = { from, to, pairs };
        bankAt = from;
      }
    }
  }
  // A bank written as one numbered list run over several lines: "1. ตรงกัน 2. Conflict 3. Dirty Bit" … "42. …".
  // Entries are read strictly in order (1, 2, 3…), so a stray number inside a label is not taken as an entry.
  if (!bankRun && tableBankAt < 0) {
    const parseSeq = (text: string) => {
      const entries: Array<{ code: string; label: string }> = [];
      let pos = 0;
      for (let n = 1; ; n++) {
        const re = new RegExp(`(?:^|\\s)${n}(?:[.)]\\s*|\\s+)(?=\\S)`, "g");
        re.lastIndex = pos;
        const m = re.exec(text);
        if (!m) break;
        if (n > 1) entries[entries.length - 1].label = text.slice(pos, m.index).trim();
        entries.push({ code: String(n), label: "" });
        pos = m.index + m[0].length;
      }
      if (entries.length) entries[entries.length - 1].label = text.slice(pos).trim();
      return entries;
    };
    const from = units.findIndex((u) => u.kind === "p" && /(?:^|\s)1[.)]\s*\S/.test(u.text) && /(?:^|\s)2[.)]\s*\S/.test(u.text));
    if (from >= 0) {
      let text = "";
      let to = from - 1;
      for (let i = from; i < units.length && units[i].kind === "p"; i++) {
        // The paragraph must carry the next number in the run.
        const expected = parseSeq(text).length + 1;
        if (!new RegExp(`(?:^|\\s)${expected}(?:[.)]\\s*|\\s+)(?=\\S)`).test(" " + units[i].text + " ")) break;
        text += " " + units[i].text;
        to = i;
      }
      const pairs = parseSeq(text);
      if (pairs.length >= 10 && to - from >= 1) {
        bankRun = { from, to, pairs };
        bankAt = from;
      }
    }
  }
  const seen = new Set<string>();
  const bankSource = bankRun ? bankRun.pairs : bankAt < 0 ? [] : bankPairs(units[bankAt] as TableUnit);
  const bank = bankSource.filter((b) => (seen.has(b.code) ? false : (seen.add(b.code), true)));
  bank.sort((a, b) => compareCodes(a.code, b.code));

  // A key table ("ข้อที่ | วัตถุประสงค์ | คำตอบ") can sit in the body: it is read as the key and never shown on the paper.
  const isKeyTable = (u: Unit) => u.kind === "table" && !!keyColumns(u.rows.map((r) => r.filter((c) => !c.hidden).map((c) => c.text)));
  const keyTableAt = units.findIndex(isKeyTable);

  // ── Answer key section: everything from its heading on ──
  let keyAt = -1;
  {
    let sawQuestion = false;
    units.forEach((u, i) => {
      if (keyAt >= 0 || u.kind !== "p") return;
      if (Q_TEXT.test(u.text)) sawQuestion = true;
      else if (sawQuestion && u.text.length < 160) {
        // "เฉลย", "Answer key", or a part heading about the key ("ส่วนที่ 3: เฉลยคำตอบ…").
        const head = u.text.replace(/^\d{1,2}\s*[.)]\s*/, "");
        if (KEY_HEAD.test(head) || (PART.test(head) && /เฉลย|answer\s*key|solutions?/i.test(head))) keyAt = i;
      }
    });
  }
  const body = keyAt >= 0 ? units.slice(0, keyAt) : units;
  const keyUnits = [
    ...(keyTableAt >= 0 && (keyAt < 0 || keyTableAt < keyAt) ? [units[keyTableAt]] : []),
    ...(keyAt >= 0 ? units.slice(keyAt + 1) : []),
  ];
  const skipped = (i: number) => i === keyTableAt || (bankRun !== null && i > bankRun.from && i <= bankRun.to);

  // ── Questions ──
  const built: Building[] = [];
  let current: Building | null = null;
  let run = 0;
  let runTf = false;
  let lastNum = 0;
  let partText = "";

  const close = () => {
    if (!current) return;
    // Trailing empty paragraphs belong to the layout, not the question.
    while (current.parts.length > 1) {
      const last = current.parts[current.parts.length - 1].unit;
      if (last.kind === "p" && !last.text && !last.runs.some((r) => r.img)) current.parts.pop();
      else break;
    }
    built.push(current);
    blocks.push({ t: "q", num: current.num, html: "", slots: [], run: current.run });
    current = null;
  };

  body.forEach((u, i) => {
    if (i === bankAt) {
      close();
      flushHtml();
      blocks.push({ t: "bank" });
      return;
    }
    if (skipped(i)) return;
    if (u.kind === "p") {
      const text = u.text;
      // "1. ชุดข้อสอบ ชุด A (สำหรับนักศึกษา…)" is the paper's set heading, not question 1.
      if (/^(\d{1,2}\s*[.)]\s*)?ชุดข้อสอบ/.test(text)) {
        pendingHtml.push(renderPara(u));
        return;
      }
      let qm = text.match(Q_TEXT);
      // "41 หาก…" — a number with no dot counts only when it is exactly the next question.
      if (!qm && lastNum > 0) {
        const loose = text.match(/^(\d{1,3})\s+(?=\D)/);
        if (loose && Number(loose[1]) === lastNum + 1) qm = loose;
      }
      // "1. ส่วนที่ 1: …" (a numbered heading) is a part of the paper, not a question.
      const afterNum = qm ? text.slice(qm[0].length) : text;
      const isPart = PART.test(afterNum) || (/^คำชี้แจง|^คำสั่ง\s*[:：]/.test(afterNum) && !!qm) || (!!u.heading && !qm);
      if (isPart) qm = null;
      const qnum = qm ? Number(qm[1] ?? qm[2]) : null;

      if (isPart) {
        close();
        run++;
        partText = text;
        runTf = TF_HINT.test(text);
        lastNum = 0;
        pendingHtml.push(renderPara(u));
        return;
      }
      // The next number, a restart at 1, or a short skip forward (a paper missing a few questions).
      if (qnum !== null && ((qnum > lastNum && qnum <= lastNum + 10) || qnum === 1 || (!current && qnum > lastNum))) {
        // A choice "1)" inside a question is not a new question.
        const asChoice = current && current.choices.length > 0 && current.marker === "num" ? parseChoices(text, current.choices.length, "num") : null;
        if (!asChoice) {
          close();
          flushHtml();
          if (qnum === 1 && lastNum > 0) {
            run++;
            runTf = TF_HINT.test(partText);
          }
          lastNum = qnum;
          const raw = rawText(u.runs);
          // The paper's own number is cut (students see their shuffled number instead) — also when a
          // picture comes first in the paragraph ("[picture] 57. จากภาพ…"); the picture stays.
          const lead = u.label ? 0 : raw.match(/^[\s￼]*/)![0].length;
          const leadImg = raw.slice(0, lead).includes("￼");
          const rest = raw.slice(lead);
          const rawMatch = u.label ? null : rest.match(Q_RAW) ?? rest.match(/^\s*\d{1,3}\s+/);
          const cutStart = leadImg ? lead : 0;
          current = {
            num: String(qnum),
            run,
            tf: runTf || TF_HINT.test(partText),
            parts: [{ unit: u, cuts: rawMatch ? [{ start: cutStart, end: lead + rawMatch[0].length }] : [] }],
            choices: [],
            answer: null,
          };
          return;
        }
      }
      if (current) {
        const choices = parseChoices(text, current.choices.length, current.marker);
        if (choices && !current.tf) {
          current.marker = choices.kind;
          const mark = styleMark(u);
          for (const label of choices.labels) {
            const charMark = /^\s*[*✓✔√]|[*✓✔√]\s*$/.test(label);
            current.choices.push({
              label: label.replace(MARK_CHARS, "").trim(),
              marked: charMark ? "char" : choices.labels.length === 1 ? (mark.strong ? "strong" : mark.bold ? "bold" : null) : null,
            });
          }
          return;
        }
        const ans = text.match(ANSWER_LINE);
        if (ans && !new RegExp(`^${BLANK_G.source}$`).test(ans[1].trim())) {
          current.answer = ans[1].trim();
          return;
        }
        if (current.choices.length === 0 && !/^คำชี้แจง/.test(text)) {
          current.parts.push({ unit: u, cuts: [] });
          return;
        }
        close();
        if (/^คำชี้แจง/.test(text) && TF_HINT.test(text)) runTf = true;
      } else if (/^คำชี้แจง/.test(text)) {
        partText += ` ${text}`;
        if (TF_HINT.test(text)) runTf = true;
      }
      pendingHtml.push(renderPara(u));
    } else {
      if (current && current.choices.length === 0) current.parts.push({ unit: u, cuts: [] });
      else {
        close();
        pendingHtml.push(renderTable(u));
      }
    }
  });
  close();
  flushHtml();

  if (built.length === 0) {
    throw new Error("ไม่พบข้อสอบในเอกสาร — แต่ละข้อต้องมีเลขข้อ เช่น \"1.\" \"1)\" \"ข้อ 1\" หรือใช้เลขลำดับอัตโนมัติของ Word");
  }

  // ── Each question: its type, slots and html ──
  let k = 0;
  const newKey = () => `k${++k}`;
  const qBlocks = blocks.filter((b): b is Extract<DraftBlock, { t: "q" }> => b.t === "q");
  const answersByBlock = new Map<Extract<DraftBlock, { t: "q" }>, string>();

  built.forEach((b, bi) => {
    const block = qBlocks[bi];
    const htmlParts: string[] = [];
    const slots: string[] = [];
    const promptParts: string[] = [];
    let type: QType;

    if (b.tf) {
      // ( ) or a blank in front of the statement is where ถูก/ผิด goes; the choice is drawn below.
      const first = b.parts[0];
      if (first.unit.kind === "p") {
        const raw = rawText(first.unit.runs);
        const from = first.cuts[0]?.end ?? 0;
        const m = raw.slice(from).match(/^\s*(?:\(\s*\)|\[\s*\]|[.…_·]{3,}|_{3,})\s*/);
        if (m) first.cuts.push({ start: from, end: from + m[0].length });
      }
      type = "SINGLE_CHOICE";
    } else if (b.choices.length >= 2) {
      type = "SINGLE_CHOICE";
    } else {
      // Blanks inside the text are answers; a paragraph that is only dots is room to write an essay.
      const inline: Array<{ part: (typeof b.parts)[number]; start: number; end: number }> = [];
      for (const part of b.parts) {
        if (part.unit.kind !== "p") continue;
        const raw = rawText(part.unit.runs);
        const blankOnly = !cleanText(raw.replace(BLANK_G, "").replace(/[()[\]]/g, "")) && BLANK_G.test(raw);
        BLANK_G.lastIndex = 0;
        if (blankOnly && part !== b.parts[0]) continue;
        let prevEnd = -1;
        for (const m of raw.matchAll(BLANK_G)) {
          const start = m.index!;
          const end = start + m[0].length;
          if (start < (part.cuts[0]?.end ?? 0)) continue;
          // Blanks running across lines are one blank.
          const last = inline[inline.length - 1];
          if (last && last.part === part && prevEnd >= 0 && !raw.slice(prevEnd, start).trim()) {
            last.end = end;
          } else inline.push({ part, start, end });
          prevEnd = end;
        }
      }
      if (inline.length > 0) {
        type = bank.length > 0 ? "FILL_IN_BANK" : "SHORT_ANSWER";
        for (const s of inline) {
          const key = newKey();
          s.part.cuts.push({ start: s.start, end: s.end, slot: key });
          slots.push(key);
        }
        // Writing-room paragraphs are left out of a fill-in question.
      } else {
        type = "ESSAY";
      }
      // Essays drop their writing lines; the answer box takes their place.
      b.parts = b.parts.filter((part, pi) => {
        if (pi === 0 || part.unit.kind !== "p") return true;
        const raw = rawText(part.unit.runs);
        const only = !cleanText(raw.replace(BLANK_G, "").replace(/[()[\]]/g, "")) && /[.…_·]{4,}|_{3,}/.test(raw);
        return !only || part.cuts.some((c) => c.slot);
      });
    }

    for (const [pi, part] of b.parts.entries()) {
      if (part.unit.kind === "p") {
        htmlParts.push(renderPara(part.unit, part.cuts, pi > 0));
        let t = rawText(part.unit.runs.map((r) => (r.sub || r.sup ? { ...r, text: scriptText(r.text, r.sub ? SUB : SUP) } : r)));
        for (const c of [...part.cuts].sort((x, y) => y.start - x.start)) {
          t = t.slice(0, c.start) + (c.slot ? " ______ " : "") + t.slice(c.end);
        }
        promptParts.push(t);
      } else {
        htmlParts.push(renderTable(part.unit));
        promptParts.push(part.unit.text);
      }
    }
    const prompt = (cleanText(promptParts.join(" ")) || `ข้อ ${b.num}`).slice(0, 1000); // the server caps a prompt at 5000 characters; the paper itself keeps the full text
    const points = Number(prompt.match(/\(\s*(\d{1,2})\s*คะแนน\s*\)/)?.[1] ?? 1);

    if (type === "SINGLE_CHOICE" || type === "ESSAY") slots.push(newKey());
    const choices = b.tf
      ? [{ label: "ถูก", isCorrect: false }, { label: "ผิด", isCorrect: false }]
      : b.choices.map((c) => ({ label: c.label, isCorrect: false }));
    if (type === "SINGLE_CHOICE" && !b.tf) {
      // A marked choice is the answer when exactly one stands out.
      for (const kind of ["char", "strong", "bold"] as const) {
        const marked = b.choices.map((c, i) => (c.marked === kind ? i : -1)).filter((i) => i >= 0);
        if (marked.length === 1 && b.choices.length > 1) {
          choices[marked[0]].isCorrect = true;
          break;
        }
      }
    }
    for (const key of slots) {
      questions.push({ key, type, prompt, points, options: choices.map((c) => ({ ...c })), bankAnswer: null, answerKey: "" });
    }
    Object.assign(block, {
      html: htmlParts.join(""),
      slots,
      fixedOptions: b.tf || b.choices.some((c) => REFERS.test(c.label)) || undefined,
      marker: type === "SINGLE_CHOICE" && !b.tf ? b.marker : undefined,
    });
    if (b.answer) answersByBlock.set(block, b.answer);
  });

  // ── Answer key ──
  // num null: an unnumbered line ("ตอบ [A06]"), taken in question order.
  const keyEntries: Array<{ num: number | null; answer: string }> = [];
  for (const u of keyUnits) {
    if (u.kind === "p") {
      if (!u.text) continue;
      // "ตอบ ก. Data Link Layer (Layer 2) (…)": a line starting with ตอบ and then an answer (not a
      // question number) is one unnumbered entry, whatever numbers its words hold.
      const plain = u.text.match(/^(?:ตอบ|คำตอบ)\s*[:：]?\s*(?!\d{1,3}\s*[.):])(.+)$/);
      if (plain) {
        keyEntries.push({ num: null, answer: plain[1].trim() });
        continue;
      }
      // Lookbehind, so one entry's trailing space doesn't hide the next entry's number.
      const re = /(?<=^|\s)(?:ข้อ(?:ที่)?\s*)?(\d{1,3})\s*[.):](?!\d)\s*|(?<=^|\s)ข้อ(?:ที่)?\s*(\d{1,3})\s+/g;
      // A number inside brackets is part of an answer ("30. ตอบ ก. Data Link Layer (Layer 2)"), not the next entry.
      const depthAt = (at: number) => [...u.text.slice(0, at)].reduce((d, c) => d + (c === "(" ? 1 : c === ")" ? -1 : 0), 0);
      const hits = [...u.text.matchAll(re)].filter((h) => depthAt(h.index!) <= 0 && !/(ส่วนที่|ตอนที่)\s*$/.test(u.text.slice(0, h.index!)));
      if (!hits.length) continue;
      hits.forEach((h, i) => {
        const answer = u.text.slice(h.index! + h[0].length, hits[i + 1]?.index ?? u.text.length).replace(/^(ตอบ|คำตอบ)\s*[:：]?\s*/, "").trim();
        if (answer) keyEntries.push({ num: Number(h[1] ?? h[2]), answer });
      });
    } else {
      const rows = u.rows.map((r) => r.filter((c) => !c.hidden).map((c) => c.text));
      // A key table: its header names the number and answer columns ("ข้อที่ | คำตอบ", or several pairs side by side).
      const cols = keyColumns(rows);
      if (cols) {
        rows.slice(cols.head + 1).forEach((row) => {
          for (const [n, a] of cols.pairs) {
            const num = row[n]?.match(/\d{1,3}/)?.[0];
            const answer = row[a]?.trim();
            if (num && answer) keyEntries.push({ num: Number(num), answer });
          }
        });
        continue;
      }
      rows.forEach((row, ri) => {
        const numberRow = row.length > 1 && row.every((c) => /^\d{1,3}\.?$/.test(c) || !c);
        if (numberRow && rows[ri + 1]) {
          row.forEach((c, ci) => {
            if (c && rows[ri + 1][ci]) keyEntries.push({ num: parseInt(c), answer: rows[ri + 1][ci] });
          });
          return;
        }
        for (let c = 0; c + 1 < row.length; c++) {
          const n = row[c].match(/^(?:ข้อ\s*)?(\d{1,3})\.?$/);
          if (n && row[c + 1] && !/^\d{1,3}\.?$/.test(row[c + 1])) keyEntries.push({ num: Number(n[1]), answer: row[c + 1] });
        }
      });
    }
  }
  const used = new Map<string, number>();
  let unnumbered = 0;
  for (const e of keyEntries) {
    if (e.num === null) {
      const block = qBlocks[unnumbered++];
      if (block && !answersByBlock.has(block)) answersByBlock.set(block, e.answer);
      continue;
    }
    const same = qBlocks.filter((b) => b.num === String(e.num));
    const n = used.get(String(e.num)) ?? 0;
    used.set(String(e.num), n + 1);
    const block = same[n] ?? same[0];
    if (block && !answersByBlock.has(block)) answersByBlock.set(block, e.answer);
  }

  const byKey = new Map(questions.map((q) => [q.key, q]));
  const bankByNorm = new Map(bank.map((b) => [normalizeCode(b.code), b.code]));
  for (const [block, answer] of answersByBlock) {
    const qs = block.slots.map((s) => byKey.get(s)!).filter(Boolean);
    let parts = qs.length > 1 ? answer.split(/\s*[,，;|]\s*|\s{2,}/).filter(Boolean) : [answer];
    if (qs.length > 1 && qs[0].type === "FILL_IN_BANK") {
      // "V (แทร็ก และ เซกเตอร์)", "A05 B12": the codes, leaving out the words in brackets.
      const codes = [...answer.replace(/\([^)]*\)/g, " ").matchAll(/(?<![A-Za-z0-9])\[?\s*(code\s*\d{1,3}|[A-Z]{1,3}\d{0,3})\s*\]?(?![A-Za-z0-9])/gi)]
        .map((m) => m[1])
        .filter((c) => bankByNorm.has(normalizeCode(c)));
      if (codes.length === qs.length) parts = codes;
      else if (codes.length === 1) {
        // One entry covers every blank of the question.
        parts = qs.map(() => codes[0]);
        warnings.push(`ข้อ ${block.num} มี ${qs.length} ช่องแต่เฉลยมีรหัสเดียว (${codes[0]}) — ใส่รหัสนี้ให้ทุกช่องแล้ว ตรวจดูอีกครั้ง`);
      }
    }
    qs.forEach((q, i) => {
      const a = (parts[i] ?? "").trim();
      if (!a) return;
      if (q.type === "SINGLE_CHOICE") {
        let idx = -1;
        if (q.options.length === 2 && q.options[0].label === "ถูก") {
          idx = /^(ถูก|t|true|✓|✔|o|ใช่)$/i.test(a) ? 0 : /^(ผิด|f|false|✗|✘|x|ไม่ใช่)$/i.test(a) ? 1 : -1;
        } else {
          const m = a.match(/^\(?([ก-ฮa-jA-J1-9])\)?(?:[.)]|\s|$)/);
          if (m) {
            const set = MARKERS[block.marker ?? "thai"];
            idx = set.indexOf(m[1]);
          }
          if (idx < 0) idx = q.options.findIndex((o) => norm(o.label) === norm(a.replace(/^\(?[ก-ฮa-jA-J1-9]\)?[.)]\s*/, "")));
        }
        if (idx >= 0 && idx < q.options.length) {
          q.options.forEach((o, j) => (o.isCorrect = j === idx));
          const why = rationale(a, q.options[idx].label);
          if (why) q.explanation = why.slice(0, 4000);
        } else warnings.push(`เฉลยข้อ ${block.num} "${a}" ไม่ตรงกับตัวเลือก — เลือกเองด้านล่าง`);
      } else if (q.type === "FILL_IN_BANK") {
        const clean = cleanKey(a);
        const bare = clean.replace(/\([^)]*\)/g, " ").trim() || clean;
        // A code only when the whole answer is one ("A", "[A01]", "Code 3"), so "Address" never reads as "A".
        const whole = bare.match(/^\[?\s*(code\s*\d{1,3}|[A-Z]{1,3}-?\d{0,3}|\d{1,3})\s*\]?$/i)?.[1];
        const code = whole ? bankByNorm.get(normalizeCode(whole)) : undefined;
        // No code given: the key's words are matched to the bank entry with the same words.
        const byWords = code ? undefined : bank.find((b) => sameWords(b.label, clean)) ?? matchBankWord(bank, clean);
        if (code) q.bankAnswer = code;
        else if (byWords) q.bankAnswer = byWords.code;
        else warnings.push(`เฉลยข้อ ${block.num}: "${clean}" ไม่มีในคลังตัวเลือก`);
      } else {
        q.answerKey = cleanKey(a);
      }
    });
  }

  // ── Header: title and time ──
  const firstQ = units.findIndex((u) => u.kind === "p" && Q_TEXT.test(u.text));
  const header = units.slice(0, firstQ < 0 ? 10 : firstQ).flatMap((u) => (u.kind === "p" && u.text ? [u.text] : []));
  const fileTitle = fileName.replace(/\.(docx|pdf)$/i, "");
  // The file's name says which chapter it is; the header's wording varies from paper to paper.
  const title = fileTitle;
  const time = header.join(" ").match(/(\d{1,3})\s*นาที/) ?? header.join(" ").match(/(\d)\s*ชั่วโมง/);
  const durationMinutes = time ? (time[0].includes("ชั่วโมง") ? Number(time[1]) * 60 : Number(time[1])) : 60;

  // ── What the teacher should look at ──
  for (let i = 1; i < qBlocks.length; i++) {
    const a = Number(qBlocks[i - 1].num);
    const b = Number(qBlocks[i].num);
    if (qBlocks[i].run === qBlocks[i - 1].run && b !== a + 1) warnings.push(`เลขข้อกระโดดจาก ${a} ไป ${b}`);
  }
  const missing = questions.filter(
    (q) =>
      (q.type === "SINGLE_CHOICE" && !q.options.some((o) => o.isCorrect)) ||
      (q.type === "FILL_IN_BANK" && !q.bankAnswer) ||
      (q.type === "SHORT_ANSWER" && !q.answerKey)
  ).length;
  if (missing > 0) warnings.push(`ยังไม่มีเฉลย ${missing} ข้อ — ใส่เฉลยด้านล่างก่อนบันทึก`);
  // Keys that look like bank codes (A, B, AC, A05) with no bank found: the bank table wasn't read.
  const codeKeys = questions.filter((q) => q.type === "SHORT_ANSWER" && /^\[?[A-Z]{1,3}\d{0,3}\]?$/.test(String(q.answerKey ?? "").trim())).length;
  if (!bank.length && codeKeys >= 3)
    warnings.unshift(
      `ไม่พบคลังตัวเลือก แต่เฉลย ${codeKeys} ข้อเป็นรหัส (เช่น A, B) — ตรวจว่าเอกสารมีตาราง Option Bank เป็นตาราง (รหัส | คำตอบ) ก่อนบันทึก ไม่อย่างนั้นนักศึกษาจะไม่เห็นคลังคำตอบ`
    );
  const essays = questions.filter((q) => q.type === "ESSAY").length;
  if (essays > 0) warnings.push(`มีข้อเขียน (อัตนัย) ${essays} ข้อ — ไม่นับในคะแนนอัตโนมัติ อาจารย์อ่านคำตอบได้ในหน้าคุมสอบ`);

  return { title, durationMinutes, bank, blocks, questions, warnings };
}









