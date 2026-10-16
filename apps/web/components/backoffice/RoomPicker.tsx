"use client";

/**
 * Which rooms sit an exam: "ทุกห้อง" (null) or a chosen set. Tapping a room adds or
 * removes it; with none left, the exam goes back to every room.
 */
export function RoomPicker({
  rooms,
  value,
  onChange,
  disabled,
  size = "sm",
}: {
  rooms: string[];
  value: string[] | null;
  onChange: (next: string[] | null) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const all = !value || value.length === 0;
  const pad = size === "md" ? "px-3 py-2 text-sm" : "px-2.5 py-1 text-[11px]";
  const chip = (active: boolean) =>
    `${pad} rounded-lg border font-semibold transition-colors disabled:opacity-50 ${
      active ? "border-primary bg-primary/15 text-primary" : "border-outline-variant/40 text-on-surface-variant hover:text-on-surface"
    }`;
  const toggle = (room: string) => {
    const current = all ? [] : value!;
    const next = current.includes(room) ? current.filter((r) => r !== room) : [...current, room];
    onChange(next.length === 0 || next.length === rooms.length ? null : next);
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" disabled={disabled} onClick={() => onChange(null)} className={chip(all)}>
        ทุกห้อง
      </button>
      {rooms.map((r) => (
        <button key={r} type="button" disabled={disabled} onClick={() => toggle(r)} className={chip(!all && value!.includes(r))}>
          {r}
        </button>
      ))}
    </div>
  );
}

/** "ทุกห้อง" or "CED 1 DE-RA, TCT 1 DE-RA". */
export const roomsLabel = (value: string[] | null | undefined) => (value && value.length ? value.join(", ") : "ทุกห้อง");
