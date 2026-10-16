/**
 * Game-menu panels for the student pages: a dark, slightly worn card in a
 * bronze-gold frame with studs at the corners (like a "choose your mode" screen).
 * `hot` marks the one that matters now — an open exam room — with a crimson
 * core, a spiked crest on top and a pulsing glow.
 */
export function GameFrame({
  hot = false,
  className = "",
  children,
}: {
  hot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative ${className}`}>
      {hot && <Crest />}
      <div
        className={`relative h-full rounded-[14px] p-[2px] transition-all duration-300 ${
          hot
            ? "bg-gradient-to-b from-[#ffd88a] via-[#c0392b] to-[#5a0d12] shadow-[0_0_28px_rgba(230,40,40,0.45),0_18px_40px_rgba(0,0,0,0.6)] [animation:game-hot_2.8s_ease-in-out_infinite]"
            : "bg-gradient-to-b from-[#e9c27a] via-[#8a5a2b] to-[#3d2412] shadow-[0_18px_40px_rgba(0,0,0,0.6)] group-hover:shadow-[0_0_26px_rgba(255,170,70,0.4),0_18px_40px_rgba(0,0,0,0.6)]"
        }`}
      >
        <div
          className="relative h-full overflow-hidden rounded-[12px] border border-black/70"
          style={{
            background: hot
              ? "radial-gradient(ellipse at 50% 110%, rgba(255,60,40,0.45), transparent 60%), linear-gradient(180deg, #23090d 0%, #3d0b13 55%, #6e0f1c 100%)"
              : "radial-gradient(ellipse at 50% 0%, rgba(255,190,110,0.10), transparent 55%), linear-gradient(180deg, #241915 0%, #1b120f 60%, #120b09 100%)",
            boxShadow: "inset 0 0 0 1px rgba(255,210,140,0.14), inset 0 0 50px rgba(0,0,0,0.65)",
          }}
        >
          {children}
        </div>
        {/* Corner studs */}
        {["left-1 top-1", "right-1 top-1", "left-1 bottom-1", "right-1 bottom-1"].map((p) => (
          <span
            key={p}
            className={`pointer-events-none absolute ${p} h-2 w-2 rotate-45 border border-black/60 bg-gradient-to-br from-[#fff0c0] to-[#a8742f]`}
          />
        ))}
      </div>
    </div>
  );
}

/** Spiked metal crest over the "hot" card, like the hardcore option's. */
function Crest() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 120 26"
      className="pointer-events-none absolute -top-[18px] left-1/2 z-10 h-[26px] w-[120px] -translate-x-1/2 drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]"
    >
      <defs>
        <linearGradient id="crest-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6e2b0" />
          <stop offset="0.5" stopColor="#9a7a4a" />
          <stop offset="1" stopColor="#4a3420" />
        </linearGradient>
      </defs>
      <path
        d="M0 26 L10 18 L16 22 L24 12 L30 19 L38 8 L44 17 L52 4 L60 0 L68 4 L76 17 L82 8 L90 19 L96 12 L104 22 L110 18 L120 26 Z"
        fill="url(#crest-metal)"
        stroke="#2a1a0e"
        strokeWidth="1"
      />
      <circle cx="60" cy="14" r="4" fill="#ff3b30" stroke="#2a1a0e" />
    </svg>
  );
}

/** A round medallion holding the subject's icon. */
export function Emblem({ icon, from, to, size = 72 }: { icon: string; from: string; to: string; size?: number }) {
  return (
    <span
      className="relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#ffe7a8] via-[#b8863f] to-[#5a3a18] p-[3px] shadow-[0_6px_16px_rgba(0,0,0,0.7)]"
      style={{ width: size, height: size }}
    >
      <span
        className="flex h-full w-full items-center justify-center rounded-full border-2 border-black/60"
        style={{ background: `radial-gradient(circle at 35% 30%, ${to}, ${from} 70%, #0b0508 100%)` }}
      >
        {/* Size inline: the icon font's stylesheet loads after Tailwind and would win. */}
        <span className="material-symbols-outlined text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]" style={{ fontSize: size * 0.48 }}>
          {icon}
        </span>
      </span>
    </span>
  );
}

/** Gold title + subtitle at the head of a game-menu screen. */
export function GameHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="text-center">
      <h1 className="font-display text-3xl font-black italic tracking-wide text-[#f6dfa0] [text-shadow:0_2px_0_#3a1606,0_0_24px_rgba(255,150,60,0.45)] sm:text-4xl">
        {title}
      </h1>
      {sub && <p className="mx-auto mt-2 max-w-2xl text-[15px] text-[#e8b64c]">{sub}</p>}
    </div>
  );
}

/** The arcade button used on the cards. */
export const GAME_BUTTON =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#ffd08a]/70 bg-gradient-to-b from-[#ff9a45] via-[#e8441f] to-[#a3171f] px-5 py-2.5 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_3px_0_#5c0d12] transition-all [text-shadow:0_1px_0_#6b0f0f] hover:brightness-110 active:translate-y-[2px]";
