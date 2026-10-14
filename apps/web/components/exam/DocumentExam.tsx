"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ExamPaper, ExamQuestion } from "@/types/exam";
import { markerLabel, normalizeCode } from "@/lib/docImport";
import { DocumentPaper, type QuestionBlock } from "./DocumentPaper";
import { BANK_PANEL_SHIFT, BankPanel } from "./BankPanel";
import type { AnswerMap } from "./QuestionPanel";

interface DocumentExamProps {
  paper: ExamPaper;
  answers: AnswerMap;
  onAnswerChange: (questionId: string, value: AnswerMap[string]) => void;
  /** Reports the question now in view (its index in paper.questions). */
  onPageChange: (questionIndex: number) => void;
  onSubmit: () => void;
}

const answered = (q: ExamQuestion, a: AnswerMap[string] | undefined) =>
  q.type === "SHORT_ANSWER" || q.type === "ESSAY" ? !!a?.textAnswer?.trim() : !!a?.selectedOptionIds?.length;

/**
 * An exam imported from the teacher's document, on screen as that document:
 * a white sheet with its text, tables and pictures. Students type into the
 * blanks where the paper has them, pick a choice under a question, or write
 * in the box under an essay question. Each student's paper has its own
 * question and choice order (dealt by the server).
 */
export function DocumentExam({ paper, answers, onAnswerChange, onPageChange, onSubmit }: DocumentExamProps) {
  const blocks = paper.document ?? [];
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

  // Tell the server which question the student is looking at (for the proctor's records).
  const observer = useRef<IntersectionObserver | null>(null);
  const lastReported = useRef(-1);
  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const id = visible?.target.getAttribute("data-question");
        const index = id ? indexOf.get(id) : undefined;
        if (index !== undefined && index !== lastReported.current) {
          lastReported.current = index;
          onPageChange(index);
        }
      },
      { rootMargin: "-30% 0px -50% 0px" }
    );
    return () => observer.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexOf]);

  const inline = (block: QuestionBlock, id: string) => block.html.includes(`data-slot="${id}"`);

  // The Option Bank opens beside the paper when a blank is tapped (phones: along the bottom).
  const [panelFor, setPanelFor] = useState<string | null>(null);
  const openPanel = (id: string, el: HTMLElement) => {
    setPanelFor(id);
    if (window.matchMedia("(min-width: 768px)").matches) return;
    requestAnimationFrame(() => {
      const top = el.getBoundingClientRect().top;
      if (top > window.innerHeight * 0.35 || top < 0) window.scrollBy({ top: top - 110, behavior: "smooth" });
    });
  };
  const panelQuestion = panelFor ? byId.get(panelFor) : undefined;
  const panelBlock = panelFor ? blocks.find((b) => b.t === "q" && b.slots.includes(panelFor)) : undefined;
  const panelSelected = panelQuestion?.options.find((o) => o.id === answers[panelQuestion.id]?.selectedOptionIds?.[0])?.code ?? null;

  return (
    // With the bank open, the paper moves left to make room for it.
    <div className={`transition-[margin] duration-200 ${panelFor ? `${BANK_PANEL_SHIFT} max-md:pb-[55vh]` : ""}`}>
    <div className="mx-auto max-w-[860px] space-y-4 pb-28">
      <div className="rounded-sm bg-white px-6 py-8 shadow-2xl shadow-black/40 sm:px-14 sm:py-12">
        <DocumentPaper
          blocks={blocks}
          bank={bank}
          questionRef={(_block, el) => {
            if (el) observer.current?.observe(el);
          }}
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
                const chosen = answers[id]?.selectedOptionIds?.[0];
                return (
                  <div key={id} className={`mt-1 grid gap-x-6 gap-y-0.5 ${q.options.length === 2 ? "grid-cols-2 max-w-sm" : "sm:grid-cols-2"}`}>
                    {q.options.map((o, i) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => onAnswerChange(id, { selectedOptionIds: [o.id] })}
                        className={`flex items-start gap-2 rounded px-2 py-1 text-left transition-colors ${
                          chosen === o.id ? "bg-blue-100 ring-2 ring-blue-500" : "hover:bg-slate-100"
                        }`}
                      >
                        <span
                          className={`mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                            chosen === o.id ? "border-blue-600 bg-blue-600" : "border-slate-400"
                          }`}
                        >
                          {chosen === o.id && <span className="h-2 w-2 rounded-full bg-white" />}
                        </span>
                        <span>
                          {q.options.length === 2 && !block.marker ? "" : `${markerLabel(block.marker, i)} `}
                          {o.label}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })
          }
        />
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
        />
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-slate-950/90 px-4 py-3 backdrop-blur">
        <div className={`flex items-center justify-between gap-3 ${panelFor ? BANK_PANEL_SHIFT : ""}`}>
        <div className="mx-auto flex w-full max-w-[860px] items-center justify-between gap-3">
          <span className="text-sm text-slate-300">
            ตอบแล้ว <b className="text-white">{done}</b> / {total} ข้อ
          </span>
          {confirming ? (
            <span className="flex items-center gap-2">
              <span className="text-sm text-slate-200">ยืนยันส่งข้อสอบ?</span>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-lg bg-slate-700 px-4 py-2 text-sm text-white">
                ยกเลิก
              </button>
              <button type="button" onClick={onSubmit} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                ส่งเลย
              </button>
            </span>
          ) : (
            <button
              type="button"
              disabled={done < total}
              onClick={() => setConfirming(true)}
              title={done < total ? "ต้องตอบให้ครบทุกข้อก่อนส่ง" : undefined}
              className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {done < total ? `เหลืออีก ${total - done} ข้อ` : "ส่งข้อสอบ"}
            </button>
          )}
        </div>
        </div>
      </div>
    </div>
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
