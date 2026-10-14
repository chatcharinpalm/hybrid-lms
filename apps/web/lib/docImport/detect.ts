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
const KEY_HEAD = /^(?:เฉลย|answer\s*key|answers?\b|key\s*[:：])/i;
const ANSWER_LINE = /^(?:ตอบ|คำตอบ|answer|ans)\s*[:：.]?\s*(.+)$/i;
const TF_HINT = /ถูก.{0,40}ผิด|ผิด.{0,40}ถูก|true.{0,40}false|✓.{0,40}✗/i;
/** Choices that point at other choices; their order must stay as printed. */
const REFERS = /ทุกข้อ|ทั้ง\s*\S+\s*และ|ไม่มีข้อใด|ข้อ\s*[กขคงจ]\s*(และ|หรือ|,)|all of the above|none of the above|both\s+\S+\s+and|\b[a-d]\s+and\s+[a-d]\b/i;
const MARK_CHARS = /^\s*[*✓✔√]\s*|\s*[*✓✔√]\s*$/g;
/** Bank codes: "[Code 01]", "Code 1", "A", "AB", "[A01]". */
const CODE_RE = /^\[?\s*(code\s*\d{1,3}|[A-Z]{1,3}\d{0,3})\s*\]?$/i;

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

function bankPairs(t: TableUnit) {
  const pairs: Array<{ code: string; label: string }> = [];
  for (const row of t.rows) {
    const cells = row.filter((c) => !c.hidden);
    for (let c = 0; c + 1 < cells.length; c += 2) {
      const code = cells[c].text;
      const label = cells[c + 1].text;
      if (code && label && CODE_RE.test(code)) pairs.push({ code: canonicalCode(code), label });
    }
  }
  return pairs;
}

/** "ก. aaa  ข. bbb" → choices, when the line starts with the next expected marker. */
function parseChoices(text: string, have: number, marker: Marker | undefined) {
  const re = /(?:^|\s)(?:\(([ก-ฮa-jA-J1-9])\)|([ก-ฮa-jA-J])\s*[.)]|([1-9])\))\s*/g;
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
  const bankAt = units.findIndex((u) => u.kind === "table" && bankPairs(u).length >= 4);
  const seen = new Set<string>();
  const bank = bankAt < 0 ? [] : bankPairs(units[bankAt] as TableUnit).filter((b) => (seen.has(b.code) ? false : (seen.add(b.code), true)));
  bank.sort((a, b) => compareCodes(a.code, b.code));

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
  const keyUnits = keyAt >= 0 ? units.slice(keyAt + 1) : [];

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
    if (u.kind === "p") {
      const text = u.text;
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
          const rawMatch = u.label ? null : raw.match(Q_RAW) ?? raw.match(/^\s*\d{1,3}\s+/);
          current = {
            num: String(qnum),
            run,
            tf: runTf || TF_HINT.test(partText),
            parts: [{ unit: u, cuts: rawMatch ? [{ start: 0, end: rawMatch[0].length }] : [] }],
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
    const prompt = cleanText(promptParts.join(" ")) || `ข้อ ${b.num}`;
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
      // Lookbehind, so one entry's trailing space doesn't hide the next entry's number.
      const re = /(?<=^|\s)(?:ข้อ(?:ที่)?\s*)?(\d{1,3})\s*[.):](?!\d)\s*|(?<=^|\s)ข้อ(?:ที่)?\s*(\d{1,3})\s+/g;
      const hits = [...u.text.matchAll(re)];
      if (!hits.length) {
        const plain = u.text.match(/^(?:ตอบ|คำตอบ)\s*[:：]?\s*(.+)$/);
        if (plain) keyEntries.push({ num: null, answer: plain[1].trim() });
        continue;
      }
      hits.forEach((h, i) => {
        const answer = u.text.slice(h.index! + h[0].length, hits[i + 1]?.index ?? u.text.length).replace(/^(ตอบ|คำตอบ)\s*[:：]?\s*/, "").trim();
        if (answer) keyEntries.push({ num: Number(h[1] ?? h[2]), answer });
      });
    } else {
      const rows = u.rows.map((r) => r.filter((c) => !c.hidden).map((c) => c.text));
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
    const parts = qs.length > 1 ? answer.split(/\s*[,，;|]\s*|\s{2,}/).filter(Boolean) : [answer];
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
        if (idx >= 0 && idx < q.options.length) q.options.forEach((o, j) => (o.isCorrect = j === idx));
        else warnings.push(`เฉลยข้อ ${block.num} "${a}" ไม่ตรงกับตัวเลือก — เลือกเองด้านล่าง`);
      } else if (q.type === "FILL_IN_BANK") {
        const code = bankByNorm.get(normalizeCode(a.match(/\[?\s*(code\s*\d{1,3}|[A-Z]{1,3}\d{0,3})\s*\]?/i)?.[1] ?? a));
        if (code) q.bankAnswer = code;
        else warnings.push(`เฉลยข้อ ${block.num}: รหัส ${a} ไม่มีในคลังตัวเลือก`);
      } else {
        q.answerKey = a;
      }
    });
  }

  // ── Header: title and time ──
  const firstQ = units.findIndex((u) => u.kind === "p" && Q_TEXT.test(u.text));
  const header = units.slice(0, firstQ < 0 ? 10 : firstQ).flatMap((u) => (u.kind === "p" && u.text ? [u.text] : []));
  const fileTitle = fileName.replace(/\.(docx|pdf)$/i, "");
  const title = header.find((t) => /แบบทดสอบ|ข้อสอบ|บทที่|quiz|exam|test/i.test(t) && t.length < 200) ?? header[0] ?? fileTitle;
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
  const essays = questions.filter((q) => q.type === "ESSAY").length;
  if (essays > 0) warnings.push(`มีข้อเขียน (อัตนัย) ${essays} ข้อ — ไม่นับในคะแนนอัตโนมัติ อาจารย์อ่านคำตอบได้ในหน้าคุมสอบ`);

  return { title, durationMinutes, bank, blocks, questions, warnings };
}
