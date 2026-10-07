"use client";

import { useState } from "react";
import type { ExamQuestion } from "@/types/exam";

interface FillInBankQuestionProps {
  question: ExamQuestion;
  selectedOptionId: string | undefined;
  onSelect: (optionId: string) => void;
}

const BLANK = "______";

/**
 * Fill-in-the-blank from the answer bank, as in the Word paper: the student
 * clicks an answer and it appears in the blank.
 *
 * The server shuffles the bank per student *and* per question, so the list
 * order (and the position of the right answer) differs on every screen and
 * on every question — there is nothing like "answer number 17" to pass around.
 */
export function FillInBankQuestion({ question, selectedOptionId, onSelect }: FillInBankQuestionProps) {
  const [search, setSearch] = useState("");

  const selected = question.options.find((o) => o.id === selectedOptionId) ?? null;
  const term = search.trim().toLowerCase();
  const visible = term ? question.options.filter((o) => o.label.toLowerCase().includes(term)) : question.options;

  const [before, ...rest] = question.prompt.split(BLANK);
  const after = rest.join(BLANK);
  const hasBlank = question.prompt.includes(BLANK);

  const blank = (
    <span
      className={`inline-block mx-1 px-3 py-0.5 rounded-lg border-2 align-middle ${
        selected ? "border-primary bg-primary/15 text-primary" : "border-dashed border-outline text-outline"
      }`}
    >
      {selected ? selected.label : "เลือกคำตอบด้านล่าง"}
    </span>
  );

  return (
    <div className="space-y-5">
      <p className="text-lg font-semibold text-on-surface leading-loose">
        {hasBlank ? (
          <>
            {before}
            {blank}
            {after}
          </>
        ) : (
          <>
            {question.prompt} {blank}
          </>
        )}
      </p>

      <div className="space-y-2">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">
            search
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาคำตอบ เช่น DMA, บัส, Interrupt"
            className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-surface-container-lowest border border-outline-variant/40 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1">
          {visible.map((option) => {
            const isChecked = option.id === selectedOptionId;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(option.id)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left text-sm transition-colors ${
                  isChecked
                    ? "border-primary bg-primary/10 text-on-surface font-medium"
                    : "border-outline-variant/25 bg-surface-container-lowest text-on-surface-variant hover:border-outline-variant/70"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-lg shrink-0 ${isChecked ? "text-primary" : "text-outline/50"}`}
                >
                  {isChecked ? "check_circle" : "radio_button_unchecked"}
                </span>
                {option.label}
              </button>
            );
          })}
          {visible.length === 0 && (
            <p className="col-span-full py-6 text-center text-sm text-outline">ไม่พบคำตอบที่ค้นหา</p>
          )}
        </div>
      </div>
    </div>
  );
}
