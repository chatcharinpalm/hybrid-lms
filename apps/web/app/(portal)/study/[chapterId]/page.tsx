"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { GamePanel, RibbonCard } from "@/components/study/RibbonCard";

type Block = { type: "text"; text: string } | { type: "image"; url: string; alt?: string };

interface Section {
  id: string;
  order: number;
  title: string;
  blocks: Block[];
}

interface Choice {
  label: string;
  text: string;
}

interface Question {
  id: string;
  order: number;
  text: string;
  choices: Choice[];
}

interface Worksheet {
  id: string;
  order: number;
  title: string;
  blocks: Block[];
}

interface Chapter {
  id: string;
  number: number;
  title: string;
  sections: Section[];
  questions: Question[];
  worksheets: Worksheet[];
}

interface CheckResult {
  correct: boolean;
  answerIndex: number;
  explanation: string | null;
}

type Part = "lesson" | "quiz" | "worksheet" | "essay";

const ESSAY_TITLE = "ข้อสอบอัตนัยทบทวน";
const QUESTIONS_PER_PAGE = 5;
const ESSAYS_PER_PAGE = 3;

/** Groups blocks into pages of roughly equal reading size. */
/** How much room a block takes on a page: pictures and long paragraphs take two slots, short lines one. */
function blockWeight(b: Block) {
  if (b.type === "image") return 2;
  return cleanDisplay(b.text).length > 250 ? 2 : 1;
}

/** Every page holds the same amount of material (9 slots), so pages look alike. */
const SLOTS_PER_PAGE = 9;

function chunkBlocks(all: Block[]): Block[][] {
  // Lines that are only dots show nothing, so they are dropped here instead of leaving an empty page.
  const blocks = all.filter((b) => !(b.type === "text" && cleanDisplay(b.text).replace(/[.…\s]/g, "") === ""));
  // A numbered item ("10.1 …") and everything under it up to the next item stay together,
  // so a question and its answer box are never split across two pages.
  const units: Block[][] = [];
  for (const b of blocks) {
    const startsItem = b.type === "text" && SUBHEAD.test(cleanDisplay(b.text));
    if (startsItem || units.length === 0) units.push([b]);
    else units[units.length - 1].push(b);
  }

  const pages: Block[][] = [];
  let current: Block[] = [];
  let used = 0;
  for (const unit of units) {
    const w = unit.reduce((sum, b) => sum + blockWeight(b), 0);
    if (current.length && used + w > SLOTS_PER_PAGE) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(...unit);
    used += w;
  }
  if (current.length) pages.push(current);
  return pages;
}
function chunkList<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** A section heading with its number in a badge, e.g. "2" + "วิวัฒนาการของคอมพิวเตอร์". */
function SectionTitle({ title }: { title: string }) {
  const m = title.match(/^(\d{1,2})\.\s*(.*)$/);
  return (
    <div className="mb-6 flex items-center gap-3 border-b border-white/10 pb-3">
      {m && (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#e8562a] text-sm font-bold text-white">{m[1]}</span>
      )}
      <h2 className="text-lg font-bold text-[#fffaf0]">{m ? m[2] : title}</h2>
    </div>
  );
}

/** Dotted leaders (".....") in the Word file are blanks the student fills in; the dots themselves are not shown. */
const LEADER = /(\.{5,}|…{3,})/;
/** A small answer box that grows with what is typed, so it stays neat inside the sentence. */
function Blank() {
  const [value, setValue] = useState("");
  return (
    <input
      aria-label="ช่องเติมคำ"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      style={{ width: `${Math.max(6, value.length + 2)}ch` }}
      className="mx-1 inline-block max-w-full rounded border border-[#e9c27a]/40 bg-[#120a08]/70 px-2 py-0.5 align-baseline text-[15px] text-[#ffd27a] focus:border-[#ff8a68] focus:outline-none"
    />
  );
}

/** Removes invisible and private-use characters left over from Word, and collapses spacing. */
function cleanDisplay(s: string) {
  return s.replace(/[​-‍­﻿-]/g, "").replace(/\s+/g, " ").trim();
}

/** "1.1 การนำสัญญาณ…" lines in the lesson are sub-headings, not body text. */
const SUBHEAD = /^\d+\.\d+\s/;

/** Short labels such as "ข้อเสีย ……" are kept side by side in rows, so the label and its box stay together. */
function isShortLine(text: string) {
  const t = cleanDisplay(text);
  return t.length > 0 && t.length <= 60 && !SUBHEAD.test(t);
}

/** Text with dotted leaders: each leader becomes a small answer box where the dots were. */
function lineBody(text: string) {
  return text.split(LEADER).map((part, i) =>
    LEADER.test(part) ? <Blank key={i} /> : <span key={i}>{part.trimEnd()}</span>
  );
}

/** One paragraph (or a sub-heading, or a short label row) from the lesson or worksheet. */
function FillLine({ text: raw, fill = false }: { text: string; fill?: boolean }) {
  const text = cleanDisplay(raw);
  // A line that is only dots is an empty leader line: nothing to show.
  if (text && text.replace(/[.…\s]/g, "") === "") return null;
  const isSub = SUBHEAD.test(text) && text.length < 140;
  // On worksheets every numbered item (10.1, 10.2, ...) gets an answer box after it.
  if (isSub && fill && !LEADER.test(text)) {
    // A numbered worksheet item gets its own answer box underneath, so there is room to write.
    return (
      <div className="space-y-2">
        <h3 className="text-[16px] font-bold leading-7 text-[#ffe6a8]">{text}</h3>
        <textarea
          aria-label="คำตอบ"
          rows={2}
          placeholder="พิมพ์คำตอบ"
          className="w-full resize-y rounded-md border border-white/15 bg-[#120a08]/70 p-3 text-[15px] leading-7 text-[#fbf4e6] placeholder:text-[#8f8271] focus:border-[#e8562a] focus:outline-none"
        />
      </div>
    );
  }
  if (isSub) {
    return <h3 className="pt-2 text-[16px] font-bold text-[#ffe6a8]">{lineBody(text)}</h3>;
  }
  if (!LEADER.test(text)) {
    return <p className="text-[15px] leading-7 text-[#fbf4e6]">{text}</p>;
  }
  return <p className="text-[15px] leading-7 text-[#fbf4e6]">{lineBody(text)}</p>;
}

/** One short label line, kept on a row with its neighbours. */
function LabelItem({ text }: { text: string }) {
  return <span className="inline-flex items-baseline gap-1 whitespace-nowrap text-[15px] text-[#fbf4e6]">{lineBody(cleanDisplay(text))}</span>;
}

/** The lesson text as a document: comfortable line length. */
function Blocks({ blocks, fill = false }: { blocks: Block[]; fill?: boolean }) {
  const nodes: ReactNode[] = [];
  let row: Block[] = [];
  const flush = (key: number) => {
    if (!row.length) return;
    nodes.push(
      <div key={`row-${key}`} className="flex flex-wrap items-baseline gap-x-8 gap-y-2 py-1">
        {row.map((b, k) => (b.type === "text" ? <LabelItem key={k} text={b.text} /> : null))}
      </div>
    );
    row = [];
  };
  blocks.forEach((b, i) => {
    if (b.type === "text" && isShortLine(b.text) && LEADER.test(b.text)) {
      row.push(b);
      return;
    }
    flush(i);
    if (b.type === "image") {
      nodes.push(
        <figure key={i} className="my-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={b.url} alt={b.alt ?? ""} loading="lazy" className="mx-auto max-h-[480px] max-w-full rounded border border-white/10" />
        </figure>
      );
    } else {
      nodes.push(<FillLine key={i} text={b.text} fill={fill} />);
    }
  });
  flush(blocks.length);
  return <div className={fill ? "space-y-6" : "space-y-1"}>{nodes}</div>;
}
/** One practice question. Choosing only marks the answer; right/wrong and the key show after the whole set is submitted. */
function PracticeQuestion({
  question,
  picked,
  result,
  locked,
  onPick,
}: {
  question: Question;
  picked: number | undefined;
  result: CheckResult | undefined;
  locked: boolean;
  onPick: (index: number) => void;
}) {
  return (
    <div className="border-t border-white/10 pt-4">
      <p className="text-[15px] font-semibold leading-7 text-[#fffaf0]">
        ข้อ {question.order}. {question.text}
      </p>
      <div className="mt-3 space-y-2">
        {question.choices.map((c, i) => {
          const isKey = result !== undefined && i === result.answerIndex;
          const isWrongPick = result !== undefined && picked === i && !result.correct;
          const isPicked = picked === i && result === undefined;
          const tone = isKey
            ? "border-[#2e9d5b] bg-[#2e9d5b]/20"
            : isWrongPick
              ? "border-[#c0392b] bg-[#c0392b]/20"
              : isPicked
                ? "border-[#e9c27a] bg-[#e9c27a]/15"
                : "border-white/15 hover:bg-[#ffffff]/[0.07]";
          return (
            <button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => onPick(i)}
              aria-pressed={picked === i}
              className={`flex w-full gap-3 rounded-md border px-3 py-2 text-left text-[15px] text-[#fbf4e6] disabled:cursor-default ${tone}`}
            >
              <span className="w-6 shrink-0 font-semibold">{c.label}</span>
              <span>{c.text}</span>
            </button>
          );
        })}
      </div>
      {result && (
        <div className="mt-3 space-y-2 text-[14px] leading-7">
          <p className={result.correct ? "font-semibold text-[#7fd09a]" : "font-semibold text-[#f08a80]"}>
            {result.correct ? "ถูกต้อง" : "ผิด"}
          </p>
          {result.explanation && <p className="whitespace-pre-wrap text-[#eadfcd]">คำอธิบาย: {result.explanation}</p>}
        </div>
      )}
    </div>
  );
}

/** Essay questions on one page: the question and a box to type the answer. */
function EssayQuestions({ questions, offset }: { questions: Block[]; offset: number }) {
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  return (
    <div className="space-y-6">
      {questions.map((q, i) => {
        const n = offset + i;
        return (
          <div key={n} className="space-y-2">
            <p className="text-[15px] font-semibold leading-7 text-[#fffaf0]">
              ข้อ {n + 1}. {q.type === "text" ? q.text : ""}
            </p>
            <textarea
              aria-label={`คำตอบข้อ ${n + 1}`}
              value={drafts[n] ?? ""}
              onChange={(e) => setDrafts((d) => ({ ...d, [n]: e.target.value }))}
              rows={4}
              placeholder="พิมพ์คำตอบ"
              className="w-full resize-y rounded-md border border-white/15 bg-[#120a08]/70 p-3 text-[15px] leading-7 text-[#fbf4e6] placeholder:text-[#8f8271] focus:border-[#e8562a] focus:outline-none"
            />
          </div>
        );
      })}
    </div>
  );
}
interface PageItem {
  /** Heading of the part inside the page list (a section, a worksheet, ...), used by the side list. */
  group: string;
  node: ReactNode;
}

const PART_LABEL: Record<Part, string> = {
  lesson: "อ่านบทเรียน",
  quiz: "แบบทดสอบทบทวน",
  worksheet: "ใบงาน",
  essay: "ข้อสอบอัตนัยทบทวน",
};

export default function StudyChapterPage({ params }: { params: { chapterId: string } }) {
  const [chapter, setChapter] = useState<Chapter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [part, setPart] = useState<Part | null>(null);
  // Quiz: picks are only marked until the student submits; results (right/wrong + key) come after that.
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [results, setResults] = useState<Record<string, CheckResult> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const articleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<Chapter>(`/api/study/chapters/${params.chapterId}`)
      .then(setChapter)
      .catch(() => setError("ไม่พบบทเรียนนี้ หรือยังไม่เปิดให้ทบทวน"));
  }, [params.chapterId]);

  // Arrow keys turn pages inside a part, except while typing an answer.
  useEffect(() => {
    if (!part) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT") return;
      if (e.key === "ArrowRight") setPageIndex((p) => p + 1);
      if (e.key === "ArrowLeft") setPageIndex((p) => p - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [part]);

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[#f08a80]">{error}</p>
        <Link href="/study" className="text-xs text-[#ffa387] underline">
          กลับไปรายการบทเรียน
        </Link>
      </div>
    );
  }
  if (!chapter) return <p className="text-sm text-outline">กำลังโหลดบทเรียน...</p>;

  const essay = chapter.worksheets.find((w) => w.title === ESSAY_TITLE);
  const practiceWorksheets = chapter.worksheets.filter((w) => w.title !== ESSAY_TITLE);
  const essayQuestions = essay ? essay.blocks.filter((b): b is Block & { type: "text" } => b.type === "text") : [];
  const total = chapter.questions.length;
  const answeredCount = Object.keys(picks).length;
  const score = results ? chapter.questions.filter((q) => results[q.id]?.correct).length : 0;

  function pick(questionId: string, index: number) {
    if (results) return;
    setPicks((p) => ({ ...p, [questionId]: index }));
  }

  async function submitQuiz() {
    // Only once every question has an answer.
    if (submitting || answeredCount < total) return;
    setSubmitting(true);
    try {
      const entries = await Promise.all(
        Object.entries(picks).map(
          async ([id, choice]) =>
            [
              id,
              await apiFetch<CheckResult>(`/api/study/questions/${id}/check`, {
                method: "POST",
                body: JSON.stringify({ choice }),
              }),
            ] as const
        )
      );
      setResults(Object.fromEntries(entries));
    } finally {
      setSubmitting(false);
    }
  }

  function retakeQuiz() {
    setPicks({});
    setResults(null);
  }


  // Pages for the chosen part only. Pages stay mounted, so typed answers and checked questions are kept.
  const pages: PageItem[] = [];
  if (part === "lesson") {
    for (const s of chapter.sections) {
      const isObjectives = s.title.startsWith("วัตถุประสงค์");
      // Objectives: the cover lines (course name, document title) are skipped; the rest is a bullet list.
      const objectiveItems = isObjectives
        ? (() => {
            const start = s.blocks.findIndex((b) => b.type === "text" && /^วัตถุประสงค์/.test(cleanDisplay(b.text)));
            return s.blocks.slice(start + 1).flatMap((b) => (b.type === "text" && cleanDisplay(b.text) ? [cleanDisplay(b.text)] : []));
          })()
        : null;
      const sectionPages: ReactNode[] = objectiveItems
        ? chunkList(objectiveItems, 10).map((items, k) => (
            <ul key={k} className="list-disc space-y-3 pl-6 text-[15px] leading-7 text-[#fbf4e6] marker:text-[#e8562a]">
              {items.map((t, k) => (
                <li key={k}>{t}</li>
              ))}
            </ul>
          ))
        : chunkBlocks(s.blocks).map((blocks, k) => <Blocks key={k} blocks={blocks} />);
      sectionPages.forEach((node, i) =>
        pages.push({
          group: s.title,
          node: (
            <>
              {i === 0 && <SectionTitle title={s.title} />}
              {node}
            </>
          ),
        })
      );
    }
  }
  if (part === "quiz") {
    chunkList(chapter.questions, QUESTIONS_PER_PAGE).forEach((qs, i, all) =>
      pages.push({
        group: PART_LABEL.quiz,
        node: (
          <>
            {i === 0 && (
              <p className="mb-5 rounded-lg bg-[#120a08]/70 p-4 text-sm font-bold text-[#ffe6a8]">
                {results
                  ? `ได้ ${score}/${total} ข้อ · ดูเฉลยและคำอธิบายในแต่ละข้อได้ด้านล่าง`
                  : `ทั้งหมด ${total} ข้อ · เลือกคำตอบให้ครบทุกข้อ แล้วกดส่งคำตอบที่หน้าสุดท้าย`}
              </p>
            )}
            <div className="space-y-6">
              {qs.map((q) => (
                <PracticeQuestion
                  key={q.id}
                  question={q}
                  picked={picks[q.id]}
                  result={results?.[q.id]}
                  locked={!!results}
                  onPick={(index) => pick(q.id, index)}
                />
              ))}
            </div>
            {i === all.length - 1 && (
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
                {results ? (
                  <>
                    <p className="text-sm font-bold text-[#ffe6a8]">ได้ {score}/{total} ข้อ</p>
                    <button type="button" onClick={retakeQuiz} className="rounded-md border border-white/25 px-4 py-2 text-sm font-semibold text-[#fffaf0] hover:bg-white/10">
                      ทำใหม่
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[#d9ccb7]">
                      {answeredCount < total
                        ? `ตอบแล้ว ${answeredCount}/${total} ข้อ ต้องตอบให้ครบก่อนจึงจะส่งได้`
                        : `ตอบครบ ${total} ข้อแล้ว`}
                    </p>
                    <button
                      type="button"
                      onClick={submitQuiz}
                      disabled={answeredCount < total || submitting}
                      className="rounded-md bg-[#e8562a] px-5 py-2 text-sm font-semibold text-white hover:bg-[#d24a22] disabled:opacity-40"
                    >
                      {submitting ? "กำลังตรวจ..." : "ส่งคำตอบ"}
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        ),
      })
    );
  }
  if (part === "worksheet") {
    for (const w of practiceWorksheets) {
      chunkBlocks(w.blocks).forEach((blocks, i) =>
        pages.push({
          group: w.title,
          node: (
            <>
              {i === 0 && <h2 className="mb-4 text-lg font-bold text-[#fffaf0]">{w.title}</h2>}
              <Blocks blocks={blocks} fill />
            </>
          ),
        })
      );
          }
  }
  if (part === "essay" && essay) {
    chunkList(essayQuestions, ESSAYS_PER_PAGE).forEach((qs, i) =>
      pages.push({
        group: PART_LABEL.essay,
        node: (
          <EssayQuestions questions={qs} offset={i * ESSAYS_PER_PAGE} />
        ),
      })
    );
  }

  const current = Math.min(Math.max(pageIndex, 0), Math.max(pages.length - 1, 0));

  function openPart(next: Part) {
    setPart(next);
    setPageIndex(0);
    articleRef.current?.scrollIntoView({ block: "start" });
  }

  function goTo(index: number) {
    setPageIndex(index);
    articleRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  // Header shared by the menu and the parts.
  const header = (
    <header className="border-b border-white/10 pb-5">
      <p className="text-xs text-[#d9ccb7]">บทที่ {chapter.number}</p>
      <h1 className="mt-1 text-2xl font-bold text-[#fffaf0]">{chapter.title}</h1>
    </header>
  );

  // Menu: each kind of material is its own choice, nothing is mixed together.
  if (!part) {
    const menu: { key: Part; title: string; detail: string[] }[] = [
      { key: "lesson", title: "อ่านบทเรียน", detail: [] },
      ...(total ? [{ key: "quiz" as Part, title: "แบบทดสอบทบทวน", detail: [] }] : []),
      ...(practiceWorksheets.length
        ? [{ key: "worksheet" as Part, title: "ใบงาน", detail: [] }]
        : []),
      ...(essayQuestions.length
        ? [{ key: "essay" as Part, title: "ข้อสอบอัตนัยทบทวน", detail: [] }]
        : []),
    ];
    // Each part is one game-menu card: ribbon title, picture panel, caption.
    const looks: Record<Part, { icon: string; from: string; to: string; glow: string }> = {
      lesson: { icon: "menu_book", from: "#7a1838", to: "#f0661f", glow: "#ffd27a" },
      quiz: { icon: "quiz", from: "#2c0c35", to: "#c0306a", glow: "#ff9ac0" },
      worksheet: { icon: "edit_note", from: "#4a1030", to: "#e8a13a", glow: "#ffe08a" },
      essay: { icon: "history_edu", from: "#12071f", to: "#8a2be2", glow: "#d7a6ff" },
    };
    return (
      <div className="space-y-4">
        <Link href="/study" className="text-xs text-[#d9ccb7] hover:text-[#ffa387]">
          ← ทบทวนบทเรียน
        </Link>
        <GamePanel title={`บทที่ ${chapter.number} ${chapter.title}`} closeHref="/study">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {menu.map((m) => (
              <button key={m.key} type="button" onClick={() => openPart(m.key)} className="text-left">
                <RibbonCard ribbon={m.title} caption={m.detail} {...looks[m.key]} />
              </button>
            ))}
          </div>
          <p className="pt-6 text-center text-sm text-[#cbbfae]">เลือกส่วนที่ต้องการทบทวน ทำตามลำดับไหนก็ได้</p>        </GamePanel>
      </div>
    );
  }

  // Side list: sections for the lesson, worksheet names for the worksheets.
  const groups: { label: string; first: number }[] = [];
  pages.forEach((p, i) => {
    if (!groups.length || groups[groups.length - 1].label !== p.group) groups.push({ label: p.group, first: i });
  });
  const showSidebar = part === "lesson" || part === "worksheet";

  return (
    <div className={showSidebar ? "grid gap-6 lg:grid-cols-[15rem_1fr]" : "mx-auto max-w-3xl"}>
      {showSidebar && (
        <aside className="space-y-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto">
          <button type="button" onClick={() => setPart(null)} className="text-xs text-[#d9ccb7] hover:text-[#ffa387]">
            ← เมนูของบทนี้
          </button>
          <p className="text-[11px] uppercase tracking-wider text-[#d9ccb7]">{PART_LABEL[part]}</p>
          <ol className="space-y-1 text-sm">
            {groups.map((g) => {
              const active = pages[current]?.group === g.label;
              return (
                <li key={`${g.first}-${g.label}`}>
                  <button
                    type="button"
                    onClick={() => goTo(g.first)}
                    className={`block w-full rounded px-2 py-1 text-left ${
                      active ? "bg-[#e8562a]/15 text-[#ffa387]" : "text-[#eadfcd] hover:bg-[#ffffff]/[0.07] hover:text-[#fffaf0]"
                    }`}
                  >
                    {g.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>
      )}

      <div ref={articleRef} className="min-w-0 scroll-mt-24 rounded-xl bg-[#120a08]/85 px-6 py-8 text-[#fffaf0] shadow-lg ring-1 ring-white/10 ring-1 ring-white/10 md:px-12 md:py-10">
        {!showSidebar && (
          <button type="button" onClick={() => setPart(null)} className="mb-4 text-xs text-[#d9ccb7] hover:text-[#ffa387]">
            ← เมนูของบทนี้
          </button>
        )}
        <p className="text-xs text-[#d9ccb7]">
          บทที่ {chapter.number} · {PART_LABEL[part]}
        </p>
        <h2 className="mb-6 mt-1 border-b border-white/10 pb-4 text-xl font-bold text-[#fffaf0]">{PART_LABEL[part]}</h2>

        <div>
          {pages.length === 0 && <p className="text-sm text-[#d9ccb7]">ยังไม่มีเนื้อหาในส่วนนี้</p>}
          {pages.map((p, i) => (
            <div key={i} hidden={i !== current}>
              {p.node}
            </div>
          ))}
        </div>

        {pages.length > 1 && (
          <nav className="mt-8 flex items-center justify-between gap-3 border-t border-white/10 pt-5" aria-label="เปลี่ยนหน้า">
            <button
              type="button"
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              className="rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-[#fffaf0] hover:bg-[#ffffff]/[0.07] disabled:opacity-30"
            >
              ← ก่อนหน้า
            </button>
            <p className="text-xs text-[#d9ccb7]">
              หน้า {current + 1} / {pages.length}
            </p>
            <button
              type="button"
              onClick={() => goTo(current + 1)}
              disabled={current >= pages.length - 1}
              className="rounded-md bg-[#e8562a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#d24a22] disabled:opacity-30"
            >
              ถัดไป →
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
