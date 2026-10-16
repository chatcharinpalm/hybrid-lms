"use client";

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { PaperBlock } from "@/types/exam";

export type QuestionBlock = Extract<PaperBlock, { t: "q" }>;

/**
 * An imported document drawn as the paper it came from: its own text,
 * tables and pictures, with the student's answer boxes placed where the
 * document has its blanks (renderSlot) or under a question (renderBelow).
 * Used by the student's exam and by the back office's import preview.
 */
export function DocumentPaper({
  blocks,
  bank,
  renderSlot,
  renderBelow,
  renderAside,
  questionRef,
  className = "font-paper text-[17px] leading-relaxed text-slate-900",
}: {
  /** Text style of the sheet (the exam's A4 pages use the paper's own size). */
  className?: string;
  blocks: PaperBlock[];
  /** The Option Bank as this student sees it; `used` entries are crossed out. */
  bank?: Array<{ code: string; label: string; used?: boolean }>;
  renderSlot: (questionId: string) => ReactNode;
  renderBelow?: (block: QuestionBlock) => ReactNode;
  /** Back office: an editor beside each question. */
  renderAside?: (block: QuestionBlock, index: number) => ReactNode;
  questionRef?: (block: QuestionBlock, el: HTMLElement | null) => void;
}) {
  let qIndex = -1;
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        if (block.t === "html") return <Html key={i} html={block.html} renderSlot={renderSlot} />;
        if (block.t === "bank") return <BankTable key={i} bank={bank ?? []} />;
        qIndex++;
        const index = qIndex;
        const question = (
          <div ref={(el) => questionRef?.(block, el)} data-question={block.slots[0]} className="flex gap-2 py-1.5">
            <span className="shrink-0 font-bold">{block.num}.</span>
            <div className="min-w-0 flex-1">
              <Html html={block.html} renderSlot={renderSlot} />
              {renderBelow?.(block)}
            </div>
          </div>
        );
        if (!renderAside) return <div key={i}>{question}</div>;
        return (
          <div key={i} className="grid gap-3 border-t border-slate-200 py-2 lg:grid-cols-[1fr_22rem]">
            {question}
            <div>{renderAside(block, index)}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Document HTML with React answer boxes portalled into its data-slot spans. */
function Html({ html, renderSlot }: { html: string; renderSlot: (id: string) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [slots, setSlots] = useState<Array<[string, Element]>>([]);
  // A stable object, so React never rewrites the html (and the portals' targets) on re-render.
  const inner = useMemo(() => ({ __html: html }), [html]);
  useLayoutEffect(() => {
    const els = Array.from(ref.current?.querySelectorAll("[data-slot]") ?? []);
    setSlots(els.map((el) => [el.getAttribute("data-slot") ?? "", el]));
  }, [html]);
  return (
    <>
      <div ref={ref} className="doc-html" dangerouslySetInnerHTML={inner} />
      {slots.map(([id, el]) => createPortal(renderSlot(id), el, id))}
    </>
  );
}

function BankTable({ bank }: { bank: Array<{ code: string; label: string; used?: boolean }> }) {
  return (
    <div className="my-3 rounded border border-slate-400 p-3">
      <div className="mb-2 text-center font-bold">คลังตัวเลือก (Option Bank)</div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
        {bank.map((b) => (
          <div key={b.code} className={`flex gap-2 ${b.used ? "text-slate-400 line-through" : ""}`}>
            <span className="w-16 shrink-0 font-bold">[{b.code}]</span>
            <span>{b.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
