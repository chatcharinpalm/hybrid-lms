import JSZip from "jszip";
import { renderTableCellParas } from "./render";
import { cleanText, paraUnit, type ParaUnit, type Run, type Unit } from "./units";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const M = "http://schemas.openxmlformats.org/officeDocument/2006/math";
const V = "urn:schemas-microsoft-com:vml";
const MC = "http://schemas.openxmlformats.org/markup-compatibility/2006";

const THAI_LETTERS = "กขคงจฉชซฌญฎฏฐฑฒณดตถทธนบปผฝพฟภมยรลวศษสหฬอฮ";
const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

const kids = (el: Element, name?: string, ns = W) =>
  Array.from(el.children).filter((c) => c.namespaceURI === ns && (!name || c.localName === name));
const kid = (el: Element | undefined, name: string, ns = W) => (el ? kids(el, name, ns)[0] : undefined);
const val = (el: Element | undefined, attr = "val") => el?.getAttributeNS(W, attr) ?? el?.getAttribute(`w:${attr}`) ?? null;
/** <w:b/> and <w:b w:val="1"/> are on; w:val="0"/"false" is off. */
const on = (el: Element | undefined) => !!el && !["0", "false", "none"].includes(val(el) ?? "1");

function roman(n: number) {
  const map: Array<[number, string]> = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let out = "";
  for (const [v, s] of map) while (n >= v) (out += s), (n -= v);
  return out;
}

function letters(n: number, alphabet: string) {
  const len = alphabet.length;
  const ch = alphabet[(n - 1) % len];
  return ch.repeat(Math.floor((n - 1) / len) + 1);
}

function formatNumber(n: number, fmt: string) {
  switch (fmt) {
    case "lowerLetter":
      return letters(n, "abcdefghijklmnopqrstuvwxyz");
    case "upperLetter":
      return letters(n, "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
    case "lowerRoman":
      return roman(n);
    case "upperRoman":
      return roman(n).toUpperCase();
    case "thaiLetters":
      return letters(n, THAI_LETTERS);
    case "thaiNumbers":
      return String(n).replace(/\d/g, (d) => THAI_DIGITS[Number(d)]);
    case "bullet":
      return "•";
    case "none":
      return "";
    default:
      return String(n);
  }
}

interface Level {
  start: number;
  fmt: string;
  text: string;
}

/** Word's automatic list numbering: works out "1.", "ก.", "a)" the way Word counts them. */
class Numbering {
  private abstracts = new Map<string, Map<number, Level>>();
  private nums = new Map<string, { abstractId: string; starts: Map<number, number> }>();
  private counters = new Map<string, number[]>();

  constructor(xml: Document | null) {
    if (!xml) return;
    for (const an of Array.from(xml.getElementsByTagNameNS(W, "abstractNum"))) {
      const levels = new Map<number, Level>();
      for (const lvl of kids(an, "lvl")) {
        levels.set(Number(val(lvl, "ilvl") ?? 0), {
          start: Number(val(kid(lvl, "start")) ?? 1),
          fmt: val(kid(lvl, "numFmt")) ?? "decimal",
          text: val(kid(lvl, "lvlText")) ?? "",
        });
      }
      this.abstracts.set(val(an, "abstractNumId") ?? "", levels);
    }
    for (const num of Array.from(xml.getElementsByTagNameNS(W, "num"))) {
      const starts = new Map<number, number>();
      for (const o of kids(num, "lvlOverride")) {
        const s = kid(o, "startOverride");
        if (s) starts.set(Number(val(o, "ilvl") ?? 0), Number(val(s) ?? 1));
      }
      this.nums.set(val(num, "numId") ?? "", { abstractId: val(kid(num, "abstractNumId")) ?? "", starts });
    }
  }

  label(numId: string, ilvl: number): string {
    const num = this.nums.get(numId);
    const levels = num && this.abstracts.get(num.abstractId);
    const level = levels?.get(ilvl);
    if (!num || !levels || !level) return "";
    const startOf = (l: number) => num.starts.get(l) ?? levels.get(l)?.start ?? 1;
    const counts = this.counters.get(numId) ?? [];
    counts[ilvl] = counts[ilvl] === undefined ? startOf(ilvl) : counts[ilvl] + 1;
    counts.length = ilvl + 1; // deeper levels start over
    this.counters.set(numId, counts);
    return level.text.replace(/%(\d)/g, (_m, d: string) => {
      const l = Number(d) - 1;
      return formatNumber(counts[l] ?? startOf(l), levels.get(l)?.fmt ?? "decimal");
    });
  }
}

interface Ctx {
  zip: JSZip;
  rels: Map<string, string>;
  numbering: Numbering;
  styles: Map<string, { heading: number; numId?: string; ilvl?: number }>;
  warnings: Set<string>;
}

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", svg: "image/svg+xml", webp: "image/webp" };

/** Pictures go into the exam itself; big ones are scaled down so the paper stays light. */
async function imageRun(ctx: Ctx, relId: string | null, wPx: number, hPx: number): Promise<Run | null> {
  const target = relId && ctx.rels.get(relId);
  if (!target) return null;
  const path = `word/${target.replace(/^\/?word\//, "").replace(/^\//, "")}`;
  const file = ctx.zip.file(path);
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (!file || !MIME[ext]) {
    ctx.warnings.add("เอกสารมีรูปแบบรูปภาพที่แสดงบนเว็บไม่ได้ (เช่น EMF/WMF) — รูปนั้นจะไม่แสดง");
    return null;
  }
  const bytes = await file.async("arraybuffer");
  const src = await shrinkImage(new Blob([bytes], { type: MIME[ext] }), MIME[ext]);
  return { text: "", img: { src, w: Math.round(wPx), h: Math.round(hPx) } };
}

async function shrinkImage(blob: Blob, mime: string): Promise<string> {
  const asDataUrl = (b: Blob) =>
    new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(b);
    });
  if (blob.size < 120_000 || mime === "image/svg+xml" || mime === "image/gif") return asDataUrl(blob);
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, 1100 / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const g = canvas.getContext("2d")!;
    g.fillStyle = "#fff";
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const jpeg = canvas.toDataURL("image/jpeg", 0.82);
    const png = mime === "image/png" ? canvas.toDataURL("image/png") : jpeg;
    // Diagrams stay sharp as PNG when that is not much bigger.
    return png.length < jpeg.length * 1.6 ? png : jpeg;
  } catch {
    return asDataUrl(blob);
  }
}

function runProps(rPr: Element | undefined): Omit<Run, "text"> {
  if (!rPr) return {};
  const color = val(kid(rPr, "color"));
  const hl = val(kid(rPr, "highlight"));
  const shd = kid(rPr, "shd")?.getAttributeNS(W, "fill");
  const vert = val(kid(rPr, "vertAlign"));
  const sz = val(kid(rPr, "sz"));
  return {
    b: on(kid(rPr, "b")) || undefined,
    i: on(kid(rPr, "i")) || undefined,
    u: (kid(rPr, "u") && val(kid(rPr, "u")) !== "none") || undefined,
    s: on(kid(rPr, "strike")) || undefined,
    sub: vert === "subscript" || undefined,
    sup: vert === "superscript" || undefined,
    sizePt: sz ? Number(sz) / 2 : undefined,
    color: color && !/^(auto|000000)$/i.test(color) ? `#${color}` : undefined,
    hl: (hl && hl !== "none") || (shd && !/^(auto|FFFFFF)$/i.test(shd)) || undefined,
  };
}

async function collectRuns(el: Element, ctx: Ctx, out: Run[]) {
  for (const node of Array.from(el.children)) {
    const name = node.localName;
    if (node.namespaceURI === MC && name === "AlternateContent") {
      const choice = kid(node, "Choice", MC) ?? kid(node, "Fallback", MC);
      if (choice) await collectRuns(choice, ctx, out);
      continue;
    }
    if (node.namespaceURI === M && (name === "oMath" || name === "oMathPara")) {
      const t = Array.from(node.getElementsByTagNameNS(M, "t")).map((x) => x.textContent ?? "").join("");
      if (t) out.push({ text: t, i: true });
      continue;
    }
    if (node.namespaceURI !== W) continue;
    if (name === "r") {
      const props = runProps(kid(node, "rPr"));
      for (const c of Array.from(node.children)) {
        if (c.namespaceURI === MC && c.localName === "AlternateContent") {
          await collectRuns(c, ctx, out);
        } else if (c.localName === "t" || c.localName === "delText") {
          // Variation selectors / zero-width marks Word leaves in Thai text.
          if (c.localName === "t") out.push({ ...props, text: (c.textContent ?? "").replace(/[\u{E0000}-\u{E01EF}︀-️​­]/gu, "") });
        } else if (c.localName === "tab") {
          out.push({ ...props, text: "\t" });
        } else if (c.localName === "br" || c.localName === "cr") {
          if (val(c, "type") !== "page") out.push({ text: "", br: true });
        } else if (c.localName === "noBreakHyphen") {
          out.push({ ...props, text: "-" });
        } else if (c.localName === "sym") {
          const code = parseInt(val(c, "char") ?? "", 16);
          // Wingdings ticks/boxes and the like; symbol fonts' private codes become a mark.
          out.push({ ...props, text: code >= 0xf000 ? "□" : String.fromCharCode(code || 32) });
        } else if (c.localName === "drawing") {
          const blip = c.getElementsByTagNameNS(A, "blip")[0];
          const extent = c.getElementsByTagNameNS(WP, "extent")[0];
          const emu = (a: string) => Number(extent?.getAttribute(a) ?? 0) / 9525;
          const img = await imageRun(ctx, blip?.getAttributeNS(R, "embed") ?? null, emu("cx"), emu("cy"));
          if (img) out.push(img);
          // Text boxes drawn on the page.
          for (const tb of Array.from(c.getElementsByTagNameNS(W, "txbxContent"))) {
            for (const p of kids(tb, "p")) {
              const inner: Run[] = [];
              await collectRuns(p, ctx, inner);
              if (inner.length) out.push({ text: " " }, ...inner);
            }
          }
        } else if (c.localName === "pict" || c.localName === "object") {
          const data = c.getElementsByTagNameNS(V, "imagedata")[0];
          const shape = c.getElementsByTagNameNS(V, "shape")[0];
          const style = shape?.getAttribute("style") ?? "";
          const dim = (k: string) => {
            const m = style.match(new RegExp(`${k}:([\\d.]+)(pt|px|in)`));
            return m ? Number(m[1]) * (m[2] === "pt" ? 4 / 3 : m[2] === "in" ? 96 : 1) : 0;
          };
          const img = await imageRun(ctx, data?.getAttributeNS(R, "id") ?? null, dim("width"), dim("height"));
          if (img) out.push(img);
        }
      }
    } else if (["hyperlink", "ins", "smartTag", "fldSimple", "customXml", "sdtContent", "moveTo"].includes(name)) {
      await collectRuns(node, ctx, out);
    } else if (name === "sdt") {
      const content = kid(node, "sdtContent");
      if (content) await collectRuns(content, ctx, out);
    }
  }
}

/** An underlined stretch of spaces/tabs is a blank on paper: written as a line of underscores. */
function markUnderlinedBlanks(runs: Run[]): Run[] {
  return runs.map((r) => (r.u && !r.img && /^[\s ]+$/.test(r.text) && r.text.length > 0 ? { ...r, text: "________", u: false } : r));
}

async function paragraph(p: Element, ctx: Ctx): Promise<ParaUnit> {
  const pPr = kid(p, "pPr");
  const styleId = val(kid(pPr, "pStyle"));
  const style = styleId ? ctx.styles.get(styleId) : undefined;
  const numPr = kid(pPr, "numPr");
  const numId = val(kid(numPr, "numId")) ?? style?.numId;
  const ilvl = Number(val(kid(numPr, "ilvl")) ?? style?.ilvl ?? 0);
  const label = numId && numId !== "0" ? ctx.numbering.label(numId, ilvl) : "";
  const runs: Run[] = [];
  await collectRuns(p, ctx, runs);
  const jc = val(kid(pPr, "jc"));
  const ind = kid(pPr, "ind");
  const left = Number(ind?.getAttributeNS(W, "left") ?? ind?.getAttributeNS(W, "start") ?? 0);
  return paraUnit(label, markUnderlinedBlanks(runs), {
    align: jc === "center" ? "center" : jc === "right" || jc === "end" ? "right" : jc === "both" ? "justify" : undefined,
    indentPt: left > 0 ? Math.round(left / 20) : undefined,
    heading: style?.heading || undefined,
  });
}

async function table(tbl: Element, ctx: Ctx, out: Unit[]) {
  const rows: Array<Array<{ text: string; html: string; colspan: number; hidden?: boolean }>> = [];
  for (const tr of kids(tbl, "tr")) {
    const row: (typeof rows)[number] = [];
    for (const tc of kids(tr, "tc")) {
      const tcPr = kid(tc, "tcPr");
      const span = Number(val(kid(tcPr, "gridSpan")) ?? 1);
      const vMerge = kid(tcPr, "vMerge");
      const paras: ParaUnit[] = [];
      for (const c of kids(tc)) {
        if (c.localName === "p") paras.push(await paragraph(c, ctx));
        else if (c.localName === "tbl") {
          // A table inside a cell: its text joins the cell.
          const inner: Unit[] = [];
          await table(c, ctx, inner);
          for (const u of inner) if (u.kind === "table") paras.push(paraUnit("", [{ text: u.text }]));
        }
      }
      row.push({
        text: cleanText(paras.map((p) => p.text).join(" ")),
        html: renderTableCellParas(paras),
        colspan: span,
        hidden: !!vMerge && val(vMerge) !== "restart" ? true : undefined,
      });
    }
    rows.push(row);
  }
  out.push({ kind: "table", rows, text: cleanText(rows.map((r) => r.map((c) => c.text).join(" ")).join(" ")) });
}

/** Reads a .docx into units, in reading order. */
export async function readDocx(file: File): Promise<{ units: Unit[]; warnings: string[] }> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const parse = async (path: string) => {
    const xml = await zip.file(path)?.async("string");
    return xml ? new DOMParser().parseFromString(xml, "application/xml") : null;
  };
  const doc = await parse("word/document.xml");
  if (!doc) throw new Error("ไฟล์นี้ไม่ใช่เอกสาร Word (.docx)");
  const body = doc.getElementsByTagNameNS(W, "body")[0];
  if (!body) throw new Error("อ่านเนื้อหาเอกสารไม่ได้");

  const rels = new Map<string, string>();
  const relsXml = await parse("word/_rels/document.xml.rels");
  for (const rel of Array.from(relsXml?.getElementsByTagName("Relationship") ?? [])) {
    rels.set(rel.getAttribute("Id") ?? "", rel.getAttribute("Target") ?? "");
  }

  const styles = new Map<string, { heading: number; numId?: string; ilvl?: number }>();
  const stylesXml = await parse("word/styles.xml");
  for (const s of Array.from(stylesXml?.getElementsByTagNameNS(W, "style") ?? [])) {
    const id = val(s, "styleId") ?? "";
    const name = (val(kid(s, "name")) ?? "").toLowerCase();
    const h = name.match(/^heading (\d)$/);
    const numPr = kid(kid(s, "pPr"), "numPr");
    styles.set(id, {
      heading: name === "title" ? 1 : h ? Math.min(3, Number(h[1])) : 0,
      numId: val(kid(numPr, "numId")) ?? undefined,
      ilvl: numPr ? Number(val(kid(numPr, "ilvl")) ?? 0) : undefined,
    });
  }

  const ctx: Ctx = { zip, rels, numbering: new Numbering(await parse("word/numbering.xml")), styles, warnings: new Set() };
  const units: Unit[] = [];
  const walk = async (el: Element) => {
    for (const c of kids(el)) {
      if (c.localName === "p") units.push(await paragraph(c, ctx));
      else if (c.localName === "tbl") await table(c, ctx, units);
      else if (c.localName === "sdt") {
        const content = kid(c, "sdtContent");
        if (content) await walk(content);
      } else if (c.localName === "customXml") await walk(c);
    }
  };
  await walk(body);
  return { units, warnings: [...ctx.warnings] };
}
