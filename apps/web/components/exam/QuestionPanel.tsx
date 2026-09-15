"use client";

import type { ExamQuestion } from "@/types/exam";

export type AnswerMap = Record<string, { selectedOptionIds?: string[]; textAnswer?: string }>;

interface QuestionPanelProps {
  questions: ExamQuestion[];
  answers: AnswerMap;
  onAnswerChange: (questionId: string, value: AnswerMap[string]) => void;
}

export function QuestionPanel({ questions, answers, onAnswerChange }: QuestionPanelProps) {
  return (
    <div className="space-y-4">
      {questions.map((question, index) => {
        const answer = answers[question.id] ?? {};
        return (
          <div
            key={question.id}
            className="rounded-lg border border-outline-variant/30 bg-surface-container p-5 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-medium text-on-surface leading-relaxed">
                <span className="text-outline font-mono mr-2">Q{index + 1}.</span>
                {question.prompt}
              </h3>
              <span className="text-[11px] font-mono text-outline shrink-0">{question.points} pts</span>
            </div>

            {question.type === "SHORT_ANSWER" ? (
              <input
                type="text"
                value={answer.textAnswer ?? ""}
                onChange={(e) => onAnswerChange(question.id, { textAnswer: e.target.value })}
                placeholder="flag{...}"
                className="w-full px-3 py-2 rounded bg-surface-container-lowest border border-outline-variant/40 font-mono text-xs text-on-surface placeholder:text-outline focus:outline-none focus:border-primary"
              />
            ) : (
              <div className="space-y-2">
                {question.options.map((option) => {
                  const selected = new Set(answer.selectedOptionIds ?? []);
                  const isChecked = selected.has(option.id);
                  const isMultiple = question.type === "MULTIPLE_CHOICE";

                  const toggle = () => {
                    if (isMultiple) {
                      const next = new Set(selected);
                      if (next.has(option.id)) next.delete(option.id);
                      else next.add(option.id);
                      onAnswerChange(question.id, { selectedOptionIds: [...next] });
                    } else {
                      onAnswerChange(question.id, { selectedOptionIds: [option.id] });
                    }
                  };

                  return (
                    <label
                      key={option.id}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded border cursor-pointer text-xs transition-colors ${
                        isChecked
                          ? "border-primary/50 bg-primary/10 text-on-surface"
                          : "border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant hover:border-outline-variant/60"
                      }`}
                    >
                      <input
                        type={isMultiple ? "checkbox" : "radio"}
                        name={question.id}
                        checked={isChecked}
                        onChange={toggle}
                        className="accent-primary"
                      />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
