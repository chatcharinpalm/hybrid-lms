import type { ReactNode } from "react";
import { GameFrame } from "@/components/game/GameFrame";

/**
 * A game-menu card for the review pages: bronze frame, red ribbon title across the top,
 * a coloured picture panel and a caption at the bottom (like a "choose your mode" screen).
 */
export function RibbonCard({
  ribbon,
  caption,
  icon,
  from,
  to,
  glow,
  children,
}: {
  ribbon: string;
  caption: string | string[];
  icon: string;
  from: string;
  to: string;
  glow: string;
  children?: ReactNode;
}) {
  return (
    <div className="group relative pb-5">
      <div className="absolute bottom-0 left-1/2 z-10 -translate-x-1/2 translate-y-1/2 whitespace-nowrap rounded-sm bg-gradient-to-b from-[#e0432a] to-[#8f1d12] px-6 py-1 text-sm font-bold text-[#fff1d6] shadow-[0_3px_8px_rgba(0,0,0,0.6)] [clip-path:polygon(0_0,100%_0,calc(100%-10px)_50%,100%_100%,0_100%,10px_50%)]">
        {ribbon}
      </div>
      <GameFrame className="h-full transition-transform duration-200 group-hover:-translate-y-1">
        <div className="flex h-full flex-col">
          <div
            className="relative flex h-40 items-center justify-center overflow-hidden"
            style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
          >
            <span aria-hidden className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full opacity-50 blur-2xl" style={{ background: glow }} />
            <span className="material-symbols-outlined relative text-[60px] text-white/90 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]">{icon}</span>
          </div>
          <div className="flex flex-1 flex-col gap-2 bg-[#120a08]/80 p-4">
            {typeof caption === "string" ? (<p className="text-sm font-semibold leading-6 text-[#ffe6a8]">{caption}</p>) : caption.length > 0 && (<ul className="max-h-28 space-y-1 overflow-y-auto text-[13px] leading-5 text-[#fbf4e6]">{caption.map((c, i) => (<li key={i} className="flex gap-2"><span className="text-[#e8562a]">•</span><span>{c}</span></li>))}</ul>)}
            {children}
          </div>
        </div>
      </GameFrame>
    </div>
  );
}

/** The bronze window around a menu, with a title bar and an orange close button (like the in-game panels). */
export function GamePanel({
  title,
  closeHref,
  children,
}: {
  title: string;
  closeHref: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="overflow-hidden rounded-xl border-2 border-[#8a5a2b] bg-[radial-gradient(ellipse_at_top,#3a2418,#160e0a)] shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
        <div className="relative flex items-center justify-center border-b-2 border-[#8a5a2b] bg-gradient-to-b from-[#6b4423] to-[#3a2414] px-6 py-3">
          <h1 className="text-base font-bold tracking-wide text-[#ffe6a8] drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]">{title}</h1>
          <a
            href={closeHref}
            aria-label="ปิดเมนู"
            className="absolute right-3 top-2 grid h-7 w-7 place-items-center rounded-sm border border-[#ffd27a] bg-gradient-to-b from-[#ff9a3c] to-[#c4420f] text-sm font-black text-white shadow-md hover:brightness-110"
          >
            ✕
          </a>
        </div>
        <div className="p-6 md:p-8">{children}</div>
      </div>
    </div>
  );
}
