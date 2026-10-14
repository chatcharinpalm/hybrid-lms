import type { ParaUnit, Run, TableUnit } from "./units";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * A part of a paragraph's runs (by offset into rawText) that renders
 * differently: skipped (the question number, an answer mark) or replaced by
 * the slot where the student writes.
 */
export interface Cut {
  start: number;
  end: number;
  slot?: string;
}

function runHtml(r: Run, text: string) {
  if (r.img) {
    const w = Math.min(r.img.w || 300, 640);
    return `<img src="${r.img.src}" alt="" style="width:${w}px" />`;
  }
  if (r.br) return "<br />";
  let h = esc(text).replace(/\t/g, "&emsp;").replace(/ {2}/g, " &nbsp;");
  if (!h) return "";
  const style: string[] = [];
  if (r.sizePt && r.sizePt >= 18) style.push(`font-size:${Math.min(r.sizePt / 16, 2).toFixed(2)}em`);
  if (r.color) style.push(`color:${r.color}`);
  if (style.length) h = `<span style="${style.join(";")}">${h}</span>`;
  if (r.b) h = `<b>${h}</b>`;
  if (r.i) h = `<i>${h}</i>`;
  if (r.u) h = `<u>${h}</u>`;
  if (r.s) h = `<s>${h}</s>`;
  if (r.sub) h = `<sub>${h}</sub>`;
  if (r.sup) h = `<sup>${h}</sup>`;
  return h;
}

/** Runs to HTML, with cuts applied. Highlighting is never carried over: it may mark the answer. */
export function renderRuns(runs: Run[], cuts: Cut[] = []) {
  const sorted = [...cuts].sort((a, b) => a.start - b.start);
  let out = "";
  let pos = 0;
  const emitted = new Set<Cut>();
  for (const r of runs) {
    const len = r.img ? 1 : r.br ? 1 : r.text.length;
    const text = r.img || r.br ? "" : r.text;
    let i = 0;
    while (i < len) {
      const at = pos + i;
      const cut = sorted.find((c) => at >= c.start && at < c.end);
      if (cut) {
        if (cut.slot && !emitted.has(cut)) out += `<span data-slot="${cut.slot}"></span>`;
        emitted.add(cut);
        i = Math.min(len, cut.end - pos);
        continue;
      }
      const next = sorted.find((c) => c.start > at);
      const stop = Math.min(len, next ? next.start - pos : len);
      out += r.img || r.br ? runHtml(r, "") : runHtml(r, text.slice(i, stop));
      i = stop;
    }
    pos += len;
  }
  // A slot right at the end of the text.
  for (const c of sorted) if (c.slot && !emitted.has(c)) out += `<span data-slot="${c.slot}"></span>`;
  return out.trim();
}

function paraStyle(p: ParaUnit) {
  const style: string[] = [];
  if (p.align && p.align !== "left") style.push(`text-align:${p.align}`);
  if (p.indentPt) style.push(`margin-left:${Math.min(p.indentPt, 144)}pt`);
  return style.length ? ` style="${style.join(";")}"` : "";
}

/** One paragraph as the document shows it; `withLabel` keeps Word's automatic number. */
export function renderPara(p: ParaUnit, cuts: Cut[] = [], withLabel = true) {
  const body = renderRuns(p.runs, cuts);
  const label = withLabel && p.label ? `${esc(p.label)} ` : "";
  if (!body && !label) return `<p class="doc-empty">&nbsp;</p>`;
  const tag = p.heading ? `h${p.heading + 1}` : "p";
  return `<${tag}${paraStyle(p)}>${label}${body}</${tag}>`;
}

export const renderTableCellParas = (paras: ParaUnit[]) =>
  paras.map((p) => renderPara(p)).filter((h) => !h.includes("doc-empty")).join("");

export function renderTable(t: TableUnit) {
  const rows = t.rows
    .map(
      (row) =>
        `<tr>${row
          .map((c) => `<td${c.colspan > 1 ? ` colspan="${c.colspan}"` : ""}${c.hidden ? ` class="doc-merged"` : ""}>${c.hidden ? "" : c.html}</td>`)
          .join("")}</tr>`
    )
    .join("");
  return `<table class="doc-table"><tbody>${rows}</tbody></table>`;
}
