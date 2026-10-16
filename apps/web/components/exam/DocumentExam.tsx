"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ExamPaper, ExamQuestion, PaperBlock } from "@/types/exam";
import { markerLabel, normalizeCode } from "@/lib/docImport";
import { DocumentPaper, type QuestionBlock } from "./DocumentPaper";
import { BankPanel, useBankPair } from "./BankPanel";
import {
  CONTENT_H,
  CONTENT_W,
  EdgeArrow,
  HEADER_H,
  PAD_BOTTOM,
  PAD_TOP,
  PAGE_H,
  PAGE_W,
  PAPER_TEXT,
  SIDE,
  Sheet,
} from "./PaperExam";
import type { AnswerMap } from "./QuestionPanel";

interface DocumentExamProps {
  paper: ExamPaper;
  answers: AnswerMap;
  onAnswerChange: (questionId: string, value: AnswerMap[string]) => void;
  /** Reports the first question on the page now open (its index in paper.questions). */
  onPageChange: (questionIndex: number) => void;
  onSubmit: () => void;
}

const answered = (q: ExamQuestion, a: AnswerMap[string] | undefined) =>
  q.type === "SHORT_ANSWER" || q.type === "ESSAY" ? !!a?.textAnswer?.trim() : !!a?.selectedOptionIds?.length;

/** The sheet's text: the paper's own looped Thai face at the paper's size. */
const SHEET_TEXT = `font-paper ${PAPER_TEXT} text-black`;

/**
 * An exam imported from the teacher's document, as that document on A4 sheets
 * turned one at a time (like the first paper exams): its own text, tables and
 * pictures, cut into pages by measuring every block at print width. Students
 * mark a choice under a question, type into the blanks, or write under an
 * essay question. Each student's paper has its own question and choice order
 * (dealt by the server), and every sheet carries their name as a watermark.
 */
export function DocumentExam({ paper, answers, onAnswerChange, onPageChange, onSubmit }: DocumentExamProps) {
  const blocks = useMemo(() => paper.document ?? [], [paper.document]);
  const byId = useMemo(() => new Map(paper.questions.map((q) => [q.id, q])), [paper.questions]);
  const indexOf = useMemo(() => new Map(paper.questions.map((q, i) => [q.id, i])), [paper.questions]);
  const total = paper.questions.length;
  const done = paper.questions.filter((q) => answered(q, answers[q.id])).length;
  const [confirming, setConfirming] = useState(false);

  // The Option Bank as this student sees it (same order on every bank question).
  const bankQuestions = paper.questions.filter((q) => q.type === "FILL_IN_BANK");
  const usedIds = new Set(bankQuestions.flatMap((q) => answers[q.id]?.selectedOptionIds ?? []));
  const bank = (bankQuestions[0]?.options ?? []).map((o, i) => ({
    code: o.code ?? String(i + 1),
    label: o.label,
    used: bankQuestions.some((q) => q.options.some((x) => x.code === o.code && usedIds.has(x.id))),
  }));

  const inline = (block: QuestionBlock, id: string) => block.html.includes(`data-slot="${id}"`);

  // ── Pages, cut by measuring every block at print width ──
  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number[][] | null>(null);
  const [pageHeights, setPageHeights] = useState<number[]>([]);
  const paginate = useCallback(() => {
    const root = measureRef.current;
    if (!root) return;
    const out: number[][] = [];
    const heights: number[] = [];
    let page: number[] = [];
    let used = 0;
    blocks.forEach((_, i) => {
      const h = root.querySelector<HTMLElement>(`[data-bi="${i}"]`)?.offsetHeight ?? 0;
      if (page.length > 0 && used + h > CONTENT_H) {
        out.push(page);
        heights.push(used);
        page = [];
        used = 0;
      }
      page.push(i);
      used += h;
    });
    if (page.length) {
      out.push(page);
      heights.push(used);
    }
    setPages(out);
    setPageHeights(heights);
  }, [blocks]);
  useLayoutEffect(() => {
    paginate();
    // Again once the paper font and the pictures have loaded (they change heights).
    document.fonts?.ready.then(paginate).catch(() => undefined);
    const imgs = Array.from(measureRef.current?.querySelectorAll("img") ?? []);
    imgs.forEach((img) => !img.complete && img.addEventListener("load", paginate, { once: true }));
  }, [paginate]);

  // ── Viewer: one sheet per screen, shrunk to fit (never enlarged past A4) ──
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

  const [panelFor, setPanelFor] = useState<string | null>(null);
  const sheetW = PAGE_W * Math.max(0.3, Math.min(1, (viewport.h - 24) / PAGE_H));
  const pair = useBankPair(Boolean(panelFor), sheetW + SIDE * 2);
  const compact = viewport.w > 0 && viewport.w < 1100 && !pair.offset;
  const gutter = compact ? 8 : SIDE;
  const fitW = (viewport.w - gutter * 2) / PAGE_W;
  const fitH = (viewport.h - (compact ? 16 : 24)) / PAGE_H;
  const scale = viewport.w > 0 ? Math.max(0.3, Math.min(1, fitW, Math.max(fitH, compact ? 0.42 : 0.3))) : 1;

  const pageList = pages ?? [];
  const totalPages = pageList.length;
  const [page, setPage] = useState(0);
  const [turn, setTurn] = useState<{ dir: "next" | "prev"; n: number }>({ dir: "next", n: 0 });
  const questionsOn = (p: number) =>
    (pageList[p] ?? []).flatMap((bi) => {
      const b = blocks[bi];
      return b.t === "q" ? b.slots.filter((id) => byId.has(id)) : [];
    });

  // Open on the page the student was last on (after a refresh).
  const initialised = useRef(false);
  useEffect(() => {
    if (!pages || initialised.current) return;
    initialised.current = true;
    const id = paper.questions[paper.currentQuestionIndex ?? 0]?.id;
    const at = id ? pages.findIndex((_, p) => questionsOn(p).includes(id)) : -1;
    if (at > 0) setPage(at);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages]);

  const soundRef = useRef<AudioContext | null>(null);
  const rustle = () => {
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
      // No audio — turning still works silently.
    }
  };
  const goTo = (to: number) => {
    if (to < 0 || to >= totalPages || to === page) return;
    setTurn((t) => ({ dir: to > page ? "next" : "prev", n: t.n + 1 }));
    setPage(to);
    viewerRef.current?.scrollTo({ top: 0 });
    rustle();
    const first = questionsOn(to)[0];
    onPageChange(first ? indexOf.get(first) ?? 0 : 0);
  };

  // Arrow keys turn pages, except while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") goTo(page + 1);
      if (e.key === "ArrowLeft" || e.key === "PageUp") goTo(page - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  // Swipe on touch screens.
  const swipeRef = useRef<number | null>(null);

  // The Option Bank opens beside the paper when a blank is tapped (phones: along the bottom).
  const openPanel = (id: string, el: HTMLElement) => {
    setPanelFor(id);
    if (window.matchMedia("(min-width: 768px)").matches) return;
    requestAnimationFrame(() => {
      const box = viewerRef.current;
      if (!box) return;
      const top = el.getBoundingClientRect().top - box.getBoundingClientRect().top;
      if (top > box.clientHeight * 0.35 || top < 0) box.scrollBy({ top: top - 110, behavior: "smooth" });
    });
  };
  const panelQuestion = panelFor ? byId.get(panelFor) : undefined;
  const panelBlock = panelFor ? blocks.find((b) => b.t === "q" && b.slots.includes(panelFor)) : undefined;
  const panelSelected = panelQuestion?.options.find((o) => o.id === answers[panelQuestion.id]?.selectedOptionIds?.[0])?.code ?? null;

  const watermark = `${paper.student.fullName} ${paper.student.studentCode ?? ""}`.trim();
  const renderBlocks = (list: PaperBlock[]) => (
    <DocumentPaper
      className={SHEET_TEXT}
      blocks={list}
      bank={bank}
      renderSlot={(id) => {
        const q = byId.get(id);
        if (!q) return null;
        if (q.type === "FILL_IN_BANK") {
          return <BankBlank question={q} answer={answers[id]} active={panelFor === id} onOpen={(el) => openPanel(id, el)} />;
        }
        if (q.type === "SHORT_ANSWER") return <TextBlank value={answers[id]?.textAnswer ?? ""} onSave={(t) => onAnswerChange(id, { textAnswer: t })} />;
        return null;
      }}
      renderBelow={(block) =>
        block.slots
          .filter((id) => !inline(block, id))
          .map((id) => {
            const q = byId.get(id);
            if (!q) return null;
            if (q.type === "ESSAY") {
              return <EssayBox key={id} value={answers[id]?.textAnswer ?? ""} onSave={(t) => onAnswerChange(id, { textAnswer: t })} />;
            }
            if (q.type !== "SINGLE_CHOICE" && q.type !== "MULTIPLE_CHOICE") return null;
            return (
              <Choices
                key={id}
                options={q.options}
                chosen={answers[id]?.selectedOptionIds?.[0]}
                label={(i) => (q.options.length === 2 && !block.marker ? "" : markerLabel(block.marker, i))}
                pair={q.options.length === 2}
                onPick={(optionId) => onAnswerChange(id, { selectedOptionIds: [optionId] })}
              />
            );
          })
      }
    />
  );

  const hasPrev = page > 0;
  const hasNext = page + 1 < totalPages;
  const sheetH = Math.max(PAGE_H, (pageHeights[page] ?? 0) + PAD_TOP + PAD_BOTTOM + HEADER_H + 12);

  return (
    // With the bank open, the paper moves aside to sit next to it.
    <div className="relative flex h-full flex-col transition-[margin] duration-200" style={pair.shift}>
      {/* Off-screen copy at print width, used to cut pages: one wrapper per block. */}
      <div ref={measureRef} aria-hidden className="pointer-events-none invisible fixed left-[-10000px] top-0" style={{ width: CONTENT_W }}>
        {blocks.map((b, i) => (
          <div key={i} data-bi={i} className="flow-root">
            {renderBlocks([b])}
          </div>
        ))}
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={viewerRef}
          className={`absolute inset-0 overflow-y-auto overflow-x-hidden ${panelFor ? "max-md:pb-[52vh]" : ""}`}
          onPointerDown={(e) => {
            if (e.pointerType === "touch") swipeRef.current = e.clientX;
          }}
          onPointerUp={(e) => {
            if (swipeRef.current === null) return;
            const dx = e.clientX - swipeRef.current;
            swipeRef.current = null;
            if (dx < -60) goTo(page + 1);
            if (dx > 60) goTo(page - 1);
          }}
        >
          {pages && viewport.w > 0 && totalPages > 0 && (
            <div className={`flex justify-center ${compact ? "px-2 py-2" : "px-4 py-3"}`}>
              <div
                key={`${page}-${turn.n}`}
                className={turn.n === 0 ? "" : turn.dir === "next" ? "page-in-next" : "page-in-prev"}
                // `zoom` lays the text out again at the new size, so Thai marks stay sharp.
                style={{ width: PAGE_W, height: sheetH, zoom: scale }}
              >
                <Sheet title={paper.examTitle ?? ""} pageNumber={page + 1} totalPages={totalPages} watermark={watermark}>
                  {renderBlocks(pageList[page].map((bi) => blocks[bi]))}
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

      {/* Dock: a thumbnail per page (dot = answered), the bank, and handing in */}
      <div className="flex shrink-0 justify-center px-4 pb-3 pt-1">
        <div className="flex max-w-full items-center gap-2 rounded-2xl border border-outline-variant/40 bg-surface-container/85 p-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-1 overflow-x-auto px-1">
            {pageList.map((_, i) => {
              const qs = questionsOn(i);
              const all = qs.length > 0 && qs.every((id) => answered(byId.get(id)!, answers[id]));
              const some = !all && qs.some((id) => answered(byId.get(id)!, answers[id]));
              const current = i === page;
              const nums = qs.map((id) => (indexOf.get(id) ?? 0) + 1);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  title={nums.length ? `หน้า ${i + 1}: ข้อ ${Math.min(...nums)}–${Math.max(...nums)}` : `หน้า ${i + 1}`}
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
                  {(all || some) && (
                    <span
                      className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-surface-container ${all ? "bg-secondary" : "bg-tertiary"}`}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <div className="mx-1 h-8 w-px shrink-0 bg-outline-variant/40" />
          {bankQuestions.length > 0 && (
            <button
              type="button"
              onClick={() => setPanelFor((p) => (p ? null : bankQuestions[0].id))}
              className="flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2.5 text-sm text-on-surface hover:bg-surface-container-highest"
            >
              <span className="material-symbols-outlined text-lg text-primary">menu_book</span>
              <span className="hidden sm:inline">คลังตัวเลือก</span>
            </button>
          )}
          <button
            type="button"
            disabled={done < total}
            onClick={() => setConfirming(true)}
            title={done < total ? "ต้องตอบให้ครบทุกข้อก่อนส่ง" : undefined}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-secondary-container to-secondary px-4 py-2.5 text-sm font-bold text-on-secondary shadow-lg shadow-secondary/20 hover:brightness-110 disabled:cursor-not-allowed disabled:from-surface-container-highest disabled:to-surface-container-highest disabled:text-outline disabled:shadow-none"
          >
            <span className="material-symbols-outlined text-lg">{done < total ? "lock" : "task_alt"}</span>
            {done < total ? `ตอบแล้ว ${done}/${total}` : "ส่งข้อสอบ"}
          </button>
        </div>
      </div>

      {panelQuestion && (
        <BankPanel
          entries={bank}
          questionLabel={panelBlock?.t === "q" ? `ข้อ ${panelBlock.num}` : "ข้อนี้"}
          selectedCode={panelSelected}
          onPick={(code) => {
            const option = panelQuestion.options.find((o) => o.code && normalizeCode(o.code) === normalizeCode(code));
            if (option) onAnswerChange(panelQuestion.id, { selectedOptionIds: [option.id] });
          }}
          onClose={() => setPanelFor(null)}
          offset={pair.offset}
        />
      )}

      {confirming && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-outline-variant/40 bg-surface-container p-6 text-center shadow-2xl">
            <span className="material-symbols-outlined rounded-2xl bg-secondary/15 p-3 text-3xl text-secondary">task_alt</span>
            <h3 className="text-lg font-bold text-on-surface">ยืนยันส่งข้อสอบ?</h3>
            <p className="text-sm text-on-surface-variant">ตอบครบ {total} ข้อแล้ว ส่งแล้วแก้ไขไม่ได้</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="flex-1 rounded-xl bg-surface-container-highest py-3 text-sm font-medium text-on-surface">
                กลับไปตรวจ
              </button>
              <button type="button" onClick={onSubmit} className="flex-1 rounded-xl bg-secondary py-3 text-sm font-bold text-on-secondary">
                ส่งเลย
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The choices under a question, marked like a paper answer sheet: tap one to circle it. */
function Choices({
  options,
  chosen,
  label,
  pair,
  onPick,
}: {
  options: ExamQuestion["options"];
  chosen: string | undefined;
  label: (i: number) => string;
  pair: boolean;
  onPick: (optionId: string) => void;
}) {
  return (
    <div className={`mt-1 grid gap-x-6 gap-y-1 ${pair ? "max-w-sm grid-cols-2" : "grid-cols-2"}`}>
      {options.map((o, i) => {
        const on = chosen === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onPick(o.id)}
            className={`flex items-start gap-2.5 rounded-md px-2 py-1 text-left transition-colors ${on ? "bg-blue-50" : "hover:bg-black/[0.04]"}`}
          >
            <span
              className={`mt-[0.32em] flex h-[1.05em] w-[1.05em] shrink-0 items-center justify-center rounded-full border-2 ${
                on ? "border-blue-700 bg-blue-700" : "border-black/45"
              }`}
            >
              {on && <span className="h-[0.4em] w-[0.4em] rounded-full bg-white" />}
            </span>
            <span className={on ? "font-semibold text-blue-900" : ""}>
              {label(i) ? `${label(i)} ` : ""}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** A typed blank, saved when the student leaves it or pauses typing. */
function TextBlank({ value, onSave }: { value: string; onSave: (text: string) => void }) {
  const [text, setText] = useState(value);
  const saved = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const flush = (t: string) => {
    clearTimeout(timer.current);
    if (t !== saved.current) {
      saved.current = t;
      onSave(t);
    }
  };
  return (
    <input
      value={text}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => flush(t), 1200);
      }}
      onBlur={() => flush(text)}
      onKeyDown={(e) => e.key === "Enter" && flush(text)}
      size={Math.max(8, text.length + 2)}
      className="mx-1 border-0 border-b-2 border-dotted border-slate-500 bg-blue-50/60 px-1 text-center font-bold text-blue-800 outline-none focus:border-blue-600 focus:bg-blue-50"
    />
  );
}

function EssayBox({ value, onSave }: { value: string; onSave: (text: string) => void }) {
  const [text, setText] = useState(value);
  const saved = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const flush = (t: string) => {
    clearTimeout(timer.current);
    if (t !== saved.current) {
      saved.current = t;
      onSave(t);
    }
  };
  return (
    <textarea
      value={text}
      rows={4}
      placeholder="พิมพ์คำตอบ"
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => flush(t), 1500);
      }}
      onBlur={() => flush(text)}
      className="mt-1 w-full resize-y rounded border border-slate-300 bg-blue-50/40 px-3 py-2 text-blue-900 outline-none focus:border-blue-500"
    />
  );
}

/** A blank that takes an Option Bank code: tapping it pops up the bank; the answer can be changed any time. */
function BankBlank({
  question,
  answer,
  active,
  onOpen,
}: {
  question: ExamQuestion;
  answer: AnswerMap[string] | undefined;
  active: boolean;
  onOpen: (el: HTMLElement) => void;
}) {
  const chosen = question.options.find((o) => o.id === answer?.selectedOptionIds?.[0]);
  return (
    <button
      type="button"
      onClick={(e) => onOpen(e.currentTarget)}
      className={`mx-1 inline-flex min-w-[5.5em] items-baseline justify-center gap-1 rounded-sm border-b-2 border-dotted px-1.5 ${
        active ? "border-blue-700 bg-blue-100" : chosen ? "border-slate-500 hover:bg-blue-50" : "border-slate-500 bg-blue-50/60 hover:bg-blue-100"
      }`}
    >
      {chosen ? (
        <>
          <b className="text-blue-800">{chosen.code}</b>
          <span className="text-blue-800">{chosen.label}</span>
        </>
      ) : (
        <span className="text-sm text-slate-400">แตะเพื่อเลือก</span>
      )}
    </button>
  );
}
