/** Looks for course cards, so each course reads as its own subject at a glance — all in the dusk-sky palette. */
const COVERS = [
  { from: "#7a1838", to: "#f0661f", glow: "#ffd27a" },
  { from: "#2c0c35", to: "#c0306a", glow: "#ff9ac0" },
  { from: "#4a1030", to: "#e8a13a", glow: "#ffe08a" },
  { from: "#12071f", to: "#8a2be2", glow: "#d7a6ff" },
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
