import sanitizeHtml from "sanitize-html";
import { seededShuffle } from "../utils/shuffle";

/**
 * An exam imported from the teacher's own document keeps the document's
 * layout: a list of blocks in reading order.
 *
 *  html  anything that is not a question (header, instructions, tables, pictures)
 *  bank  the Option Bank of fill-in-the-blank papers; drawn per student from
 *        their dealt bank (codes in paper order, words dealt per student)
 *  q     one numbered item of the paper. Its html holds a
 *        <span data-slot="QUESTION_ID"></span> wherever the student writes
 *        (blanks); choice and essay questions are answered below the html.
 *        `slots` lists its Question ids in answering order.
 *
 * Question blocks with the same `run` (one part of the paper) are shuffled
 * among themselves per student; a block keeps the number printed at its
 * position, so the paper still reads 1, 2, 3 …
 */
export type PaperBlock =
  | { t: "html"; html: string }
  | { t: "bank" }
  | {
      t: "q";
      num: string;
      html: string;
      slots: string[];
      run: number;
      fixedOptions?: boolean;
      /** Choice lettering as printed: ก. ข. / a. b. / A. B. / (1) (2). */
      marker?: "thai" | "lower" | "upper" | "num";
    };

/** Tags and attributes a converted document may use; everything else is dropped. */
const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "div", "span", "br", "b", "strong", "i", "em", "u", "s", "sub", "sup", "small",
    "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li",
    "table", "thead", "tbody", "tr", "td", "th", "colgroup", "col", "img", "hr",
  ],
  allowedAttributes: {
    "*": ["style", "class", "colspan", "rowspan", "data-slot", "width", "height", "align"],
    img: ["src", "alt", "style", "width", "height"],
  },
  allowedSchemes: ["data"],
  allowedSchemesByTag: { img: ["data"] },
  allowedStyles: {
    "*": {
      "text-align": [/^(left|right|center|justify)$/],
      "font-weight": [/^(bold|normal|\d{3})$/],
      "font-style": [/^(italic|normal)$/],
      "text-decoration": [/^[a-z -]+$/],
      "font-size": [/^\d+(\.\d+)?(pt|px|em|%)$/],
      color: [/^#[0-9a-f]{3,8}$/i],
      "background-color": [/^#[0-9a-f]{3,8}$/i],
      "margin-left": [/^-?\d+(\.\d+)?(pt|px|em)$/],
      "text-indent": [/^-?\d+(\.\d+)?(pt|px|em)$/],
      width: [/^\d+(\.\d+)?(pt|px|%)$/],
      height: [/^\d+(\.\d+)?(pt|px)$/],
      "vertical-align": [/^(top|middle|bottom)$/],
      border: [/^[\w .#-]+$/],
    },
  },
};

export const sanitizePaperHtml = (html: string) => sanitizeHtml(html, SANITIZE);

export function readPaper(json: string | null | undefined): PaperBlock[] | null {
  if (!json) return null;
  try {
    const blocks = JSON.parse(json);
    return Array.isArray(blocks) ? (blocks as PaperBlock[]) : null;
  } catch {
    return null;
  }
}

/** This student's paper: each part's questions shuffled (when the exam shuffles), numbers kept in place. */
export function dealBlocks(blocks: PaperBlock[], seed: string, shuffle: boolean): PaperBlock[] {
  if (!shuffle) return blocks;
  const out = [...blocks];
  const runs = new Map<number, number[]>();
  blocks.forEach((b, i) => {
    if (b.t === "q") runs.set(b.run, [...(runs.get(b.run) ?? []), i]);
  });
  for (const [run, positions] of runs) {
    const dealt = seededShuffle(
      positions.map((p) => blocks[p] as Extract<PaperBlock, { t: "q" }>),
      `${seed}:run${run}`
    );
    positions.forEach((p, i) => {
      out[p] = { ...dealt[i], num: (blocks[p] as Extract<PaperBlock, { t: "q" }>).num };
    });
  }
  return out;
}

/** Question ids in the order this student's paper asks them. */
export const slotOrder = (blocks: PaperBlock[]) => blocks.flatMap((b) => (b.t === "q" ? b.slots : []));

/** Questions whose choices refer to each other ("ทั้ง ก และ ข") keep the paper's choice order. */
export const fixedOptionIds = (blocks: PaperBlock[]) =>
  new Set(blocks.flatMap((b) => (b.t === "q" && b.fixedOptions ? b.slots : [])));
