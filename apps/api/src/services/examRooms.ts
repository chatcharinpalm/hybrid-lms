/**
 * Which rooms (User.section) sit an exam. Exam.sections holds a JSON string[];
 * null (or an empty/unreadable list) means every room on the course's class list.
 */
export function readSections(json: string | null | undefined): string[] | null {
  if (!json) return null;
  try {
    const list = JSON.parse(json);
    return Array.isArray(list) && list.length ? list.filter((s): s is string => typeof s === "string") : null;
  } catch {
    return null;
  }
}

/** Stored form: null for "every room". */
export function writeSections(list: string[] | null | undefined): string | null {
  const clean = [...new Set((list ?? []).map((s) => s.trim()).filter(Boolean))];
  return clean.length ? JSON.stringify(clean) : null;
}

/** A room's programme, its first word: "CED 1 DE-RA" → "CED", "TCT 1 DE-RA" → "TCT". */
export function programOf(section: string | null | undefined): string | null {
  return section?.trim().split(/\s+/)[0]?.toUpperCase() || null;
}

/** Whether a student of this room may see and sit the exam. */
export function roomAllowed(exam: { sections: string | null }, section: string | null | undefined) {
  const rooms = readSections(exam.sections);
  return !rooms || (!!section && rooms.includes(section));
}
