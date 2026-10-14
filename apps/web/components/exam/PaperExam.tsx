"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ExamOption, ExamPaper, ExamQuestion } from "@/types/exam";
import type { AnswerMap } from "./QuestionPanel";
import { BANK_PANEL_SHIFT, BankPanel } from "./BankPanel";

/** A4 at 96 dpi (210 × 297 mm); margins about 15 mm. */
const PAGE_W = 794;
const PAGE_H = 1123;
const PAD_X = 56;
const PAD_TOP = 44;
const PAD_BOTTOM = 56;
/** Running header (title + page number) plus its gap. */
const HEADER_H = 46;
const CONTENT_W = PAGE_W - PAD_X * 2;
/** A little slack: the zoomed page can wrap a line differently from the measuring copy. */
const CONTENT_H = PAGE_H - PAD_TOP - PAD_BOTTOM - HEADER_H - 12;
/** Room beside the page for the arrow buttons. */
const SIDE = 96;

const BLANK = "______";
/** Body text of the sheet; the measuring copy must use the same. */
const PAPER_TEXT = "text-[19px] leading-[1.65]";

interface PaperExamProps {
  paper: ExamPaper;
  answers: AnswerMap;
  onAnswerChange: (questionId: string, value: AnswerMap[string]) => void;
  /** Reports the first question on the page now open (0 for the Option Bank). */
  onPageChange: (firstQuestionIndex: number) => void;
  onSubmit: () => void;
}

/** The entry's code as printed on the paper ("W", "A01", "Code 07"). */
const codeOf = (o: ExamOption, index: number) => o.code ?? `Code ${String(index + 1).padStart(2, "0")}`;

/** "code 7", "[Code 07]", "07" and "7" are the same answer; so are "a1" and "A01". */
const normalizeCode = (s: string) =>
  s
    .toUpperCase()
    .replace(/CODE/g, "")
    .replace(/[\s[\]]/g, "")
    .replace(/\d+/g, (d) => String(Number(d)));

/** One flowable piece of the paper; pages are packed from these by measured height. */
type Block =
  | { key: string; kind: "info" }
  | { key: string; kind: "part1" | "part2"; sec: number }
  | { key: string; kind: "bankRow"; sec: number; row: number }
  | { key: string; kind: "question"; index: number };

/**
 * A part of the paper with its own Option Bank: the whole paper, or on a
 * combined exam one chapter. `label` is the chapter's name (null on a
 * single-chapter paper, which keeps the Word file's own headings).
 */
interface Section {
  label: string | null;
  /** Indexes into paper.questions (which come grouped by chapter). */
  questions: number[];
  bank: ExamOption[];
  codes: string[];
}

/**
 * The exam as the Word paper: one A4 sheet at a time, shrunk so the whole
 * sheet fits the screen without scrolling and never enlarged past A4, so the
 * writing is no bigger than on paper and hard to read from the seats behind.
 * Pages are cut by measuring every block at print width and turned with a
 * short slide.
 *
 * Against copying, the server deals every student their own question order
 * and their own meaning for each Option Bank code (the codes look like the
 * paper's), so a neighbour's "W" is no help. The words of the chosen entry
 * show under each blank, so students needn't remember what each code means.
 */
export function PaperExam({ paper, answers, onAnswerChange, onPageChange, onSubmit }: PaperExamProps) {
  const questions = paper.questions;
  // Every question of a section lists its bank in the same (per-student) order.
  const sections = useMemo<Section[]>(() => {
    const parts = paper.groups?.length
      ? paper.groups.map((g) => ({ label: g.label, questions: questions.flatMap((q, i) => (q.group === g.group ? [i] : [])) }))
      : [{ label: null, questions: questions.map((_, i) => i) }];
    return parts
      .filter((p) => p.questions.length > 0)
      .map((p) => {
        const bank = questions[p.questions[0]].options;
        return { ...p, bank, codes: bank.map(codeOf) };
      });
  }, [paper.groups, questions]);
  const sectionOf = useMemo(() => {
    const map = new Map<number, number>();
    sections.forEach((s, si) => s.questions.forEach((qi) => map.set(qi, si)));
    return map;
  }, [sections]);

  const blocks = useMemo<Block[]>(
    () => [
      { key: "info", kind: "info" },
      ...sections.flatMap((s, sec): Block[] => [
        { key: `part1-${sec}`, kind: "part1", sec },
        ...Array.from({ length: Math.ceil(s.bank.length / 3) }, (_, row) => ({ key: `row${sec}-${row}`, kind: "bankRow" as const, sec, row })),
        { key: `part2-${sec}`, kind: "part2", sec },
        ...s.questions.map((index) => ({ key: `q${index}`, kind: "question" as const, index })),
      ]),
    ],
    [sections]
  );

  // ── Pagination by measurement ────────────────────────────────
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<Block[][] | null>(null);

  const paginate = useCallback(() => {
    const root = measureRef.current;
    if (!root) return;
    const height = (key: string) => root.querySelector<HTMLElement>(`[data-block="${key}"]`)?.offsetHeight ?? 0;
    const tableHead = height("thead");
    const out: Block[][] = [];
    let page: Block[] = [];
    let used = 0;
    for (const b of blocks) {
      // A table continued on a new sheet repeats its header row.
      const startsTable = b.kind === "bankRow" && page[page.length - 1]?.kind !== "bankRow";
      const h = height(b.key) + (startsTable ? tableHead : 0);
      // Keep a part heading with what follows it.
      const lookahead = b.kind === "part1" || b.kind === "part2" ? 140 : 0;
      if (page.length > 0 && used + h + lookahead > CONTENT_H) {
        out.push(page);
        page = [];
        used = (b.kind === "bankRow" ? tableHead : 0) + height(b.key);
      } else {
        used += h;
      }
      page.push(b);
    }
    if (page.length) out.push(page);
    setPages(out);
  }, [blocks]);

  useLayoutEffect(() => {
    paginate();
    // Re-cut once the paper font has loaded (it changes line breaks).
    document.fonts?.ready.then(paginate).catch(() => undefined);
  }, [paginate]);

  // ── Viewer: one whole sheet per screen, shrunk to fit (never enlarged past A4) ──
  const viewerRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    const measure = () => setViewport({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const viewportW = viewport.w;
  // Tablets and phones: no room for side arrows, so the sheet fills the width (arrows sit over its margins).
  const compact = viewportW > 0 && viewportW < 1100;
  const gutter = compact ? 8 : SIDE;
  const fitW = (viewportW - gutter * 2) / PAGE_W;
  // The whole page shows without scrolling, except on phones held upright where that would be unreadably small.
  const fitH = (viewport.h - (compact ? 16 : 24)) / PAGE_H;
  const scale = viewportW > 0 ? Math.max(0.3, Math.min(1, fitW, Math.max(fitH, compact ? 0.42 : 0.3))) : 1;

  const pageList = pages ?? [];
  const totalPages = pageList.length;
  const pageOfQuestion = (qi: number) => Math.max(0, pageList.findIndex((p) => p.some((b) => b.kind === "question" && b.index === qi)));

  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState<{ dir: "next" | "prev"; n: number }>({ dir: "next", n: 0 });
  const initialised = useRef(false);
  useEffect(() => {
    if (!pages || initialised.current) return;
    initialised.current = true;
    if (paper.currentQuestionIndex) setPage(pageOfQuestion(paper.currentQuestionIndex));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  // The Option Bank panel: open for a blank (its question id), or just to browse (null).
  const [panel, setPanel] = useState<{ questionId: string | null } | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const answeredCount = questions.filter((q) => answers[q.id]?.selectedOptionIds?.length).length;
  const isAnswered = (qi: number) => Boolean(answers[questions[qi].id]?.selectedOptionIds?.length);

  // ── Page turning ─────────────────────────────────────────────
  const soundRef = useRef<AudioContext | null>(null);
  // A short, soft paper rustle: filtered noise, generated on the fly.
  const playRustle = () => {
    try {
      const ctx = (soundRef.current ??= new AudioContext());
      const len = Math.floor(ctx.sampleRate * 0.22);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin((Math.PI * i) / len), 2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 2600;
      band.Q.value = 0.7;
      const gain = ctx.createGain();
      gain.gain.value = 0.05;
      src.connect(band).connect(gain).connect(ctx.destination);
      src.start();
    } catch {
      // No audio available — turning still works silently.
    }
  };

  const goTo = (to: number) => {
    if (to < 0 || to >= totalPages || to === page) return;
    setTurn((t) => ({ dir: to > page ? "next" : "prev", n: t.n + 1 }));
    setPage(to);
    viewerRef.current?.scrollTo({ top: 0 });
    playRustle();
    const firstQ = pageList[to]?.find((b) => b.kind === "question");
    onPageChange(firstQ && firstQ.kind === "question" ? firstQ.index : 0);
  };

  // Left/right arrow keys turn pages, except while writing in a blank.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") goTo(page + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") goTo(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Swipe on touch screens.
  const swipeRef = useRef<number | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "touch") swipeRef.current = e.clientX;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (swipeRef.current === null) return;
    const dx = e.clientX - swipeRef.current;
    swipeRef.current = null;
    if (dx < -60) goTo(page + 1);
    if (dx > 60) goTo(page - 1);
  };

  /** A blank was tapped: open the bank beside the paper (phones: below it, with the blank lifted above). */
  const openForBlank = (questionId: string, el: HTMLElement) => {
    setPanel({ questionId });
    requestAnimationFrame(() => {
      const viewer = viewerRef.current;
      if (!viewer || window.matchMedia("(min-width: 768px)").matches) return;
      const top = el.getBoundingClientRect().top - viewer.getBoundingClientRect().top;
      if (top > viewer.clientHeight * 0.35 || top < 0) viewer.scrollBy({ top: top - 90, behavior: "smooth" });
    });
  };

  /** An entry tapped in the panel answers the open blank (replacing any earlier answer). */
  const answerWithCode = (questionId: string, code: string) => {
    const q = questions.find((x) => x.id === questionId);
    const option = q?.options.find((o, i) => normalizeCode(codeOf(o, i)) === normalizeCode(code));
    if (q && option) onAnswerChange(q.id, { selectedOptionIds: [option.id] });
  };
  const panelQuestionIndex = panel?.questionId ? questions.findIndex((q) => q.id === panel.questionId) : -1;
  const panelSelected = (() => {
    if (panelQuestionIndex < 0) return null;
    const q = questions[panelQuestionIndex];
    const i = q.options.findIndex((o) => o.id === answers[q.id]?.selectedOptionIds?.[0]);
    return i >= 0 ? codeOf(q.options[i], i) : null;
  })();

  // Entries already used in a confirmed answer fade in their section's bank
  // (each question has its own option rows, so match by section and text: usedKey).
  const usedLabels = useMemo(() => {
    const used = new Set<string>();
    questions.forEach((q, qi) => {
      const id = answers[q.id]?.selectedOptionIds?.[0];
      const o = id ? q.options.find((x) => x.id === id) : undefined;
      if (o) used.add(usedKey(sectionOf.get(qi) ?? 0, o.label));
    });
    return used;
  }, [answers, questions, sectionOf]);
  // The bank shown in the panel: the open blank's section, else the one on the page in view.
  const panelSection = (() => {
    if (panelQuestionIndex >= 0) return sectionOf.get(panelQuestionIndex) ?? 0;
    const onPage = pageList[page]?.find((b) => b.kind !== "info");
    return onPage ? (onPage.kind === "question" ? sectionOf.get(onPage.index) ?? 0 : onPage.sec) : 0;
  })();
  const allAnswered = answeredCount === questions.length;

  const watermark = `${paper.student.fullName} ${paper.student.studentCode ?? ""}`.trim();
  const renderBlocks = (list: Block[], measuring = false) => (
    <BlockFlow
      blocks={list}
      paper={paper}
      sections={sections}
      usedLabels={usedLabels}
      questions={questions}
      answers={answers}
      measuring={measuring}
      activeBlank={panel?.questionId ?? null}
      onFocusBlank={openForBlank}
      onAnswerChange={onAnswerChange}
    />
  );

  const hasNext = page + 1 < totalPages;
  const hasPrev = page > 0;

  return (
    // With the bank open, the paper moves left to make room for it.
    <div className={`relative flex h-full flex-col transition-[margin] duration-200 ${panel ? BANK_PANEL_SHIFT : ""}`}>
      {/* Off-screen copy at print width, used to cut pages. */}
      <div
        ref={measureRef}
        aria-hidden
        className={`pointer-events-none invisible fixed left-[-10000px] top-0 font-paper ${PAPER_TEXT} text-black`}
        style={{ width: CONTENT_W }}
      >
        {renderBlocks(blocks, true)}
      </div>

      {/* Viewer: the sheet scrolls up and down inside it when the screen is shorter than A4. */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={viewerRef}
          // Phones: room to scroll the lower blanks up above the bank sheet.
          className={`absolute inset-0 overflow-y-auto overflow-x-hidden ${panel ? "max-md:pb-[52vh]" : ""}`}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
        >
          {pages && viewportW > 0 && totalPages > 0 && (
            <div className={`flex justify-center ${compact ? "px-2 py-2" : "px-4 py-3"}`}>
              {/* Keyed by the page, so each turn replays the slide-in. */}
              <div
                key={`${page}-${turn.n}`}
                className={turn.n === 0 ? "" : turn.dir === "next" ? "page-in-next" : "page-in-prev"}
                // `zoom` lays the text out again at the new size instead of scaling a
                // bitmap, so Thai vowels and tone marks stay sharp.
                style={{ width: PAGE_W, height: PAGE_H, zoom: scale }}
              >
                <Sheet title={paper.examTitle ?? ""} pageNumber={page + 1} totalPages={totalPages} watermark={watermark}>
                  {renderBlocks(pageList[page])}
                </Sheet>
              </div>
            </div>
          )}
        </div>

        {pages && (
          <>
            <EdgeArrow side="left" compact={compact} disabled={!hasPrev} onClick={() => goTo(page - 1)} />
            <EdgeArrow side="right" compact={compact} disabled={!hasNext} onClick={() => goTo(page + 1)} />
          </>
        )}
      </div>

      {/* Dock */}
      <div className="flex shrink-0 justify-center px-4 pb-3 pt-1">
        <div className="flex max-w-full items-center gap-2 rounded-2xl border border-outline-variant/40 bg-surface-container/85 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-1 overflow-x-auto px-1">
            {pageList.map((blocksOnPage, i) => {
              const qs = blocksOnPage.flatMap((b) => (b.kind === "question" ? [b.index] : []));
              const done = qs.length > 0 && qs.every(isAnswered);
              const partial = !done && qs.some(isAnswered);
              const current = i === page;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  title={qs.length ? `หน้า ${i + 1}: ข้อ ${qs[0] + 1}–${qs[qs.length - 1] + 1}` : `หน้า ${i + 1}: คลังตัวเลือก`}
                  className={`relative flex h-11 w-9 shrink-0 flex-col items-center justify-end rounded-md border pb-1 text-[11px] font-bold transition-all ${
                    current
                      ? "-translate-y-0.5 border-primary bg-white text-black shadow-lg shadow-primary/30"
                      : "border-outline-variant/40 bg-surface-container-highest/70 text-on-surface-variant hover:-translate-y-0.5 hover:bg-surface-container-highest"
                  }`}
                >
                  <span className="absolute left-1.5 right-1.5 top-1.5 space-y-[3px] opacity-50">
                    <span className="block h-[2px] rounded bg-current" />
                    <span className="block h-[2px] w-2/3 rounded bg-current" />
                  </span>
                  {i + 1}
                  {(done || partial) && (
                    <span
                      className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-surface-container ${
                        done ? "bg-secondary" : "bg-tertiary"
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>

          <div className="mx-1 h-8 w-px shrink-0 bg-outline-variant/40" />

          <button
            type="button"
            onClick={() => setPanel((p) => (p ? null : { questionId: null }))}
            className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm text-on-surface hover:bg-surface-container-highest"
          >
            <span className="material-symbols-outlined text-lg text-primary">menu_book</span>
            <span className="hidden sm:inline">คลังตัวเลือก</span>
          </button>
          {/* A paper is handed in only when every blank is answered. */}
          <button
            type="button"
            disabled={!allAnswered}
            onClick={() => setConfirmSubmit(true)}
            title={allAnswered ? undefined : "ต้องตอบให้ครบทุกข้อก่อนส่ง"}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-secondary-container to-secondary px-4 py-2.5 text-sm font-bold text-on-secondary shadow-lg shadow-secondary/20 hover:brightness-110 disabled:cursor-not-allowed disabled:from-surface-container-highest disabled:to-surface-container-highest disabled:text-outline disabled:shadow-none"
          >
            <span className="material-symbols-outlined text-lg">{allAnswered ? "task_alt" : "lock"}</span>
            {allAnswered ? "ส่งข้อสอบ" : `ตอบแล้ว ${answeredCount}/${questions.length}`}
          </button>
        </div>
      </div>

      {panel && (
        <BankPanel
          entries={(sections[panelSection]?.bank ?? []).map((o, i) => ({
            code: sections[panelSection].codes[i],
            label: o.label,
            used: usedLabels.has(usedKey(panelSection, o.label)),
          }))}
          title={sections[panelSection]?.label ?? undefined}
          questionLabel={panelQuestionIndex >= 0 ? `ข้อ ${panelQuestionIndex + 1}` : null}
          selectedCode={panelSelected}
          onPick={(code) => {
            if (!panel.questionId) return;
            answerWithCode(panel.questionId, code);
          }}
          onClose={() => setPanel(null)}
        />
      )}
      {confirmSubmit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-5 rounded-3xl border border-outline-variant/40 bg-surface-container p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/15">
              <span className="material-symbols-outlined text-3xl text-secondary">task</span>
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-on-surface">ส่งข้อสอบเลยหรือไม่?</h2>
              <p className="text-sm text-on-surface-variant">
                ตอบแล้ว <b className="text-on-surface">{answeredCount}</b> จาก {questions.length} ข้อ
              </p>
              {answeredCount < questions.length && (
                <p className="text-sm font-medium text-error">ยังเว้นว่าง {questions.length - answeredCount} ข้อ</p>
              )}
              <p className="text-xs text-outline">ส่งแล้วจะกลับมาแก้ไม่ได้</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmSubmit(false)}
                className="flex-1 rounded-xl bg-surface-container-highest py-3 text-sm font-medium text-on-surface"
              >
                กลับไปตรวจ
              </button>
              <button
                type="button"
                onClick={onSubmit}
                className="flex-1 rounded-xl bg-secondary py-3 text-sm font-bold text-on-secondary"
              >
                ยืนยันส่ง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EdgeArrow({ side, compact, disabled, onClick }: { side: "left" | "right"; compact: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "หน้าก่อน" : "หน้าถัดไป"}
      className={`absolute top-1/2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full border border-outline-variant/40 text-on-surface shadow-xl backdrop-blur transition-all hover:scale-110 hover:bg-primary hover:text-on-primary disabled:pointer-events-none disabled:opacity-0 ${
        compact ? "h-12 w-12 bg-surface-container/60" : "h-16 w-16 bg-surface-container/85"
      } ${side === "left" ? (compact ? "left-1" : "left-4") : compact ? "right-1" : "right-4"}`}
    >
      <span className="material-symbols-outlined text-4xl">{side === "left" ? "chevron_left" : "chevron_right"}</span>
    </button>
  );
}

/** One A4 sheet with the Word file's running header, page footer and a name watermark. */
function Sheet({
  title,
  pageNumber,
  totalPages,
  watermark,
  children,
}: {
  title: string;
  pageNumber: number;
  totalPages: number;
  watermark: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-[3px] bg-[#fdfcf8] font-paper text-black shadow-[0_2px_6px_rgba(0,0,0,0.25),0_18px_50px_rgba(0,0,0,0.55)]"
      style={{ padding: `${PAD_TOP}px ${PAD_X}px ${PAD_BOTTOM}px` }}
    >
      {/* Faint diagonal watermark: a photo of this page names whose paper it is. */}
      <div className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center gap-40 overflow-hidden">
        {[0, 1, 2].map((i) => (
          <span key={i} className="whitespace-nowrap text-[44px] font-bold text-black/[0.022] -rotate-[30deg]">
            {watermark}
          </span>
        ))}
      </div>

      <div
        className="relative flex items-baseline justify-between gap-4 border-b border-black/25 pb-1 text-[15px] text-black/65"
        style={{ height: HEADER_H - 14, marginBottom: 14 }}
      >
        <span className="truncate">{title}</span>
        <span className="shrink-0">หน้าที่ {pageNumber}</span>
      </div>
      <div className={`relative ${PAPER_TEXT}`}>{children}</div>
      <div className="absolute inset-x-0 bottom-4 text-center text-[13px] text-black/40">
        — {pageNumber} / {totalPages} —
      </div>
    </div>
  );
}

/** A bank entry's "used" key: section + words (each section has its own bank). */
const usedKey = (sec: number, label: string) => `${sec}\u0000${label}`;

interface BlockFlowProps {
  blocks: Block[];
  paper: ExamPaper;
  sections: Section[];
  /** Entries already given as an answer (usedKey); faded in the table. */
  usedLabels: Set<string>;
  questions: ExamQuestion[];
  answers: AnswerMap;
  /** Measuring copy: every block tagged so its height can be read back. */
  measuring: boolean;
  /** The blank the bank panel is open for. */
  activeBlank: string | null;
  onFocusBlank: (questionId: string, el: HTMLElement) => void;
  onAnswerChange: (questionId: string, value: AnswerMap[string]) => void;
}

const BANK_GRID = "grid grid-cols-[13%_20.33%_13%_20.33%_13%_20.34%]";

/** Renders a run of blocks; consecutive bank rows share one table with a header row. */
function BlockFlow({ blocks, paper, sections, usedLabels, questions, answers, measuring, activeBlank, onFocusBlank, onAnswerChange }: BlockFlowProps) {
  const out: React.ReactNode[] = [];
  const tag = (key: string) => (measuring ? { "data-block": key } : {});
  const longest = sections.map((s) => s.bank.reduce((l, o) => (o.label.length > l.length ? o.label : l), ""));
  const sectionOfQuestion = new Map<number, number>();
  sections.forEach((s, si) => s.questions.forEach((qi) => sectionOfQuestion.set(qi, si)));
  const combined = sections.length > 1 || sections[0]?.label != null;

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.kind === "bankRow") {
      const sec = b.sec;
      const { bank, codes } = sections[sec];
      const rows: number[] = [];
      while (i < blocks.length && blocks[i].kind === "bankRow" && (blocks[i] as { sec: number }).sec === sec) {
        rows.push((blocks[i] as { row: number }).row);
        i++;
      }
      i--;
      out.push(
        <div key={`t${sec}-${rows[0]}`} className="border-l border-t border-black text-[15.5px] leading-snug">
          <div {...tag("thead")} className={BANK_GRID}>
            {[0, 1, 2].map((c) => (
              <PairHeader key={c} />
            ))}
          </div>
          {rows.map((row) => (
            <div key={row} {...tag(`row${sec}-${row}`)} className={BANK_GRID}>
              {[0, 1, 2].map((c) => {
                const n = row * 3 + c;
                return n < bank.length ? (
                  <PairCells key={c} code={codes[n]} label={bank[n].label} used={usedLabels.has(usedKey(sec, bank[n].label))} />
                ) : (
                  <EmptyPair key={c} />
                );
              })}
            </div>
          ))}
        </div>
      );
      continue;
    }

    if (b.kind === "info") {
      const { student } = paper;
      out.push(
        <p key={b.key} {...tag(b.key)} className="pb-3 font-bold">
          ชื่อ-สกุล: <Filled>{student.fullName}</Filled> รหัสนักศึกษา: <Filled>{student.studentCode ?? ""}</Filled>{" "}
          ห้อง: <Filled min={60}>{student.section ?? ""}</Filled> เลขที่: <Filled min={40}>{student.seatNumber ?? ""}</Filled>
        </p>
      );
    } else if (b.kind === "part1") {
      const s = sections[b.sec];
      out.push(
        <div key={b.key} {...tag(b.key)} className={`pb-2 font-bold ${b.sec > 0 ? "pt-6" : ""}`}>
          {/* Combined exams: each chapter starts with its name. */}
          {combined && <p className="mb-1 border-b-2 border-black pb-0.5 text-[21px]">{s.label}</p>}
          <p>
            ส่วนที่ {b.sec * 2 + 1}: คลังตัวเลือกสำหรับนำไปเติมในช่องว่าง (Option Bank) จำนวน {s.bank.length} ตัวเลือก
          </p>
        </div>
      );
    } else if (b.kind === "part2") {
      const s = sections[b.sec];
      out.push(
        <div key={b.key} {...tag(b.key)} className="pb-4 pt-5 font-bold">
          <p>
            ส่วนที่ {b.sec * 2 + 2}: แบบทดสอบชนิดเติมคำ (Fill-in-the-Blank Questions){" "}
            {combined ? `จำนวน ${s.questions.length} ข้อ` : paper.examDescription ?? `จำนวน ${questions.length} ข้อ`}
          </p>
          <p>คำชี้แจง: จงเลือกรหัสตัวเลือกจากส่วนที่ {b.sec * 2 + 1} มาเติมลงในช่องว่างของแต่ละข้อ</p>
        </div>
      );
    } else if (b.kind === "question") {
      const q = questions[b.index];
      const longestLabel = longest[sectionOfQuestion.get(b.index) ?? 0];
      out.push(
        <div key={b.key} {...tag(b.key)} className="pb-3">
          <PaperQuestion
            number={b.index + 1}
            question={q}
            selectedOptionId={answers[q.id]?.selectedOptionIds?.[0]}
            active={activeBlank === q.id}
            readOnly={measuring}
            reserveLabel={measuring ? longestLabel : undefined}
            onFocus={(el) => onFocusBlank(q.id, el)}
            onChange={(ids) => onAnswerChange(q.id, { selectedOptionIds: ids })}
          />
        </div>
      );
    }
  }
  return <>{out}</>;
}

const cell = "border-b border-r border-black px-1.5 py-1";

function PairHeader() {
  return (
    <>
      <div className={`${cell} text-center font-bold`}>รหัสตัวเลือก</div>
      <div className={`${cell} text-center font-bold`}>คำตอบ</div>
    </>
  );
}

function PairCells({ code, label, used }: { code: string; label: string; used: boolean }) {
  const fade = used ? " text-black/30 line-through decoration-black/30" : "";
  return (
    <>
      <div className={`${cell} text-center text-[14.5px] font-bold${fade}`}>[{code}]</div>
      <div className={`${cell}${fade}`}>{label}</div>
    </>
  );
}

function EmptyPair() {
  return (
    <>
      <div className={cell} />
      <div className={cell} />
    </>
  );
}

/** A form field on the paper, already filled in (as if handwritten). */
function Filled({ children, min = 100 }: { children: React.ReactNode; min?: number }) {
  return (
    <span
      className="inline-block border-b border-dotted border-black px-2 text-center font-normal text-blue-800"
      style={{ minWidth: min }}
    >
      {children}
    </span>
  );
}

interface PaperQuestionProps {
  number: number;
  question: ExamQuestion;
  selectedOptionId: string | undefined;
  /** The bank panel is open for this blank. */
  active: boolean;
  readOnly?: boolean;
  /** Measuring copy only: room for the longest entry, so an answer written in later never overflows the page. */
  reserveLabel?: string;
  onFocus: (el: HTMLElement) => void;
  onChange: (selectedOptionIds: string[]) => void;
}

/**
 * "ข้อ N. ... ......[ W ]......" — tapping the blank pops up the Option Bank
 * to pick from; the code can also be typed (saved on Enter or on leaving the
 * blank). The blank shows the code and the entry's words, and can be
 * changed again at any time until the paper is handed in.
 */
function PaperQuestion({ number, question, selectedOptionId, active, readOnly, reserveLabel, onFocus, onChange }: PaperQuestionProps) {
  const options = question.options;
  const codes = options.map(codeOf);
  // Chapter 5 style codes ("Code 07"): "Code" is printed, the student writes "07".
  const codePrefix = codes.length > 0 && codes.every((c) => c.startsWith("Code ")) ? "Code" : "";
  const shown = (c: string) => (codePrefix ? c.slice(codePrefix.length).trim() : c);

  const savedIndex = options.findIndex((o) => o.id === selectedOptionId);
  const [text, setText] = useState(savedIndex >= 0 ? shown(codes[savedIndex]) : "");
  // An answer picked in the bank panel (or restored) shows in the blank.
  useEffect(() => {
    setText(savedIndex >= 0 ? shown(codes[savedIndex]) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedIndex]);

  const findIndex = (value: string) => {
    const key = normalizeCode(value);
    return key ? codes.findIndex((c) => normalizeCode(c) === key) : -1;
  };
  const matched = findIndex(text);
  const valid = text.trim() === "" || matched >= 0;
  const chosen = matched >= 0 ? options[matched] : null;
  const answered = savedIndex >= 0;

  const save = () => {
    if (chosen && matched !== savedIndex) onChange([chosen.id]);
  };

  const [before, ...rest] = question.prompt.split(BLANK);
  const after = rest.join(BLANK);

  return (
    <div className="font-medium">
      <b>ข้อ {number}.</b> {before}
      {/* The blank holds the code and, once it matches, the entry's words: "A05 NCP". */}
      <span className={`mx-1 rounded-sm border-b-2 border-dotted px-2 ${active ? "border-blue-700 bg-blue-100/70" : "border-black"}`}>
        <span className="whitespace-nowrap">
          {codePrefix && <span className="text-black/45">{codePrefix}</span>}
          <input
            value={text}
            onChange={(e) => setText(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && (save(), e.currentTarget.blur())}
            onFocus={(e) => onFocus(e.currentTarget)}
            onClick={(e) => onFocus(e.currentTarget)}
            onBlur={save}
            readOnly={readOnly}
            tabIndex={readOnly ? -1 : undefined}
            autoComplete="off"
            spellCheck={false}
            // Tablets: no on-screen keyboard over the bank panel (a real keyboard still types codes).
            inputMode="none"
            aria-label={`คำตอบข้อ ${number}`}
            placeholder="____"
            className={`ml-1 w-[3em] cursor-pointer rounded bg-transparent text-center font-bold uppercase outline-none placeholder:text-black/25 ${
              valid ? "text-blue-800" : "text-red-600"
            }`}
          />
        </span>
        {(chosen || reserveLabel) && <span className="ml-1 text-blue-800">{chosen ? chosen.label : reserveLabel}</span>}
      </span>
      {after}
      <div className="flex h-[1.6em] items-center gap-2 pl-10 text-[15px] font-normal leading-[1.45]">
        {!valid ? (
          <span className="text-red-600">ไม่มีรหัสนี้ในคลังตัวเลือก</span>
        ) : answered && matched === savedIndex ? (
          <span className="text-emerald-700">✓ ตอบแล้ว (แตะช่องเพื่อเปลี่ยนคำตอบ)</span>
        ) : null}
      </div>
    </div>
  );
}
