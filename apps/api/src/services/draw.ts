import { seededShuffle } from "../utils/shuffle";

/**
 * Combined exams put several chapters in one exam: each question keeps the
 * group (source exam) it was copied from, and every student draws `count`
 * questions from each group by their attempt's seed — a different set per
 * student, the same set every time that attempt is loaded or graded.
 */
export interface DrawRule {
  group: string;
  /** Shown to students and staff, e.g. the source exam's title. */
  label: string;
  count: number;
}

export function readDraw(json: string | null | undefined): DrawRule[] | null {
  if (!json) return null;
  try {
    const rules = JSON.parse(json);
    return Array.isArray(rules) && rules.length ? (rules as DrawRule[]) : null;
  } catch {
    return null;
  }
}

type Drawable = { id: string; group: string | null; order: number };

/**
 * The questions this attempt sits, in the exam's own order. Exams without a
 * draw (and questions in no drawn group) are taken whole.
 */
export function drawQuestions<Q extends Drawable>(questions: Q[], drawJson: string | null | undefined, seed: string): Q[] {
  const rules = readDraw(drawJson);
  if (!rules) return questions;
  const keep = new Set<string>();
  const ruled = new Set(rules.map((r) => r.group));
  for (const q of questions) if (!q.group || !ruled.has(q.group)) keep.add(q.id);
  for (const rule of rules) {
    const pool = questions
      .filter((q) => q.group === rule.group)
      .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    for (const q of seededShuffle(pool, `${seed}:draw:${rule.group}`).slice(0, rule.count)) keep.add(q.id);
  }
  return questions.filter((q) => keep.has(q.id));
}

/** How many questions every attempt of this exam has (the same for all students). */
export function drawnCount(questions: Drawable[], drawJson: string | null | undefined): number {
  const rules = readDraw(drawJson);
  if (!rules) return questions.length;
  const ruled = new Map(rules.map((r) => [r.group, r.count]));
  const perGroup = new Map<string, number>();
  let free = 0;
  for (const q of questions) {
    if (q.group && ruled.has(q.group)) perGroup.set(q.group, (perGroup.get(q.group) ?? 0) + 1);
    else free++;
  }
  return free + [...perGroup].reduce((sum, [g, n]) => sum + Math.min(n, ruled.get(g)!), 0);
}
