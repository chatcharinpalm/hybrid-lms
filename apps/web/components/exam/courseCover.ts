/** Looks for course cards, so each course reads as its own subject at a glance. */
const COVERS = [
  { from: "#1e3a8a", to: "#0ea5e9", glow: "#7dd3fc" },
  { from: "#4c1d95", to: "#db2777", glow: "#f9a8d4" },
  { from: "#064e3b", to: "#10b981", glow: "#6ee7b7" },
  { from: "#7c2d12", to: "#f59e0b", glow: "#fcd34d" },
];

export function courseCover(index: number, title: string) {
  const t = title.toLowerCase();
  const icon = /network|communication|datacom|เครือข่าย|สื่อสาร/.test(t)
    ? "lan"
    : /system|organization|computer|โครงสร้าง|ระบบ/.test(t)
      ? "memory"
      : "menu_book";
  return { ...COVERS[index % COVERS.length], icon };
}
