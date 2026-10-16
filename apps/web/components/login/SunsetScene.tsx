/**
 * The login backdrop: a game-title sky at dusk — violet night fading through
 * crimson to an ember-orange horizon, a breathing sun, leaning stone monoliths
 * and grass in silhouette, embers drifting up and the odd shooting star.
 * Pure CSS/SVG, so it costs no image downloads.
 */

// Fixed, so server and browser render the same embers.
const EMBERS = Array.from({ length: 26 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 97.13 + n * 13.7) + 1) / 2) % 1;
  return {
    left: `${Math.round(r(1) * 100)}%`,
    size: 2 + Math.round(r(2) * 4),
    duration: 7 + r(3) * 9,
    delay: -r(4) * 16,
    drift: Math.round((r(5) - 0.5) * 160),
  };
});

/** `dim`: the same sky after dark, behind the student pages, so the cards stay the brightest thing on screen. */
export function SunsetScene({ dim = false }: { dim?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* Sky */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #12071f 0%, #2c0c35 20%, #651640 40%, #b02a3a 58%, #ec5a24 74%, #ff9a3d 86%, #ffd27a 100%)",
        }}
      />
      {/* Stars in the upper sky */}
      <div
        className="absolute inset-x-0 top-0 h-1/2 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(1px 1px at 12% 18%, #fff, transparent), radial-gradient(1px 1px at 28% 8%, #fff, transparent), radial-gradient(1.5px 1.5px at 44% 22%, #ffe9c7, transparent), radial-gradient(1px 1px at 63% 12%, #fff, transparent), radial-gradient(1px 1px at 78% 26%, #fff, transparent), radial-gradient(1.5px 1.5px at 90% 9%, #ffe9c7, transparent), radial-gradient(1px 1px at 6% 34%, #fff, transparent), radial-gradient(1px 1px at 52% 4%, #fff, transparent)",
        }}
      />
      <div className="shooting-star absolute right-[8%] top-[10%] h-[2px] w-40 rounded-full bg-gradient-to-l from-white via-white/70 to-transparent" />

      {/* Sun */}
      <div
        className="sun-breathe absolute left-[58%] top-[74%] h-[46vmin] w-[46vmin] rounded-full"
        style={{ background: "radial-gradient(circle, #fff4c2 0%, #ffd27a 22%, rgba(255,140,50,0.55) 45%, rgba(255,90,40,0) 70%)" }}
      />

      {/* Silhouettes */}
      <svg className="absolute inset-x-0 bottom-0 h-[62%] w-full" viewBox="0 0 1600 560" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff8a3d" stopOpacity="0" />
            <stop offset="1" stopColor="#ff8a3d" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        {/* Far ridge */}
        <path d="M0 330 L120 290 L230 315 L360 260 L470 300 L600 270 L720 310 L860 255 L990 300 L1120 265 L1260 305 L1400 270 L1600 300 L1600 560 L0 560 Z" fill="#8a2240" opacity="0.55" />
        {/* Leaning monoliths, like ruins on the horizon */}
        <g fill="#4a1030" opacity="0.85">
          <path d="M215 330 L248 120 L282 128 L262 335 Z" />
          <path d="M1290 335 L1318 90 L1352 96 L1336 338 Z" />
          <path d="M1365 340 L1380 210 L1400 213 L1392 342 Z" />
          <path d="M395 335 L404 250 L420 252 L416 337 Z" />
        </g>
        <rect x="0" y="250" width="1600" height="310" fill="url(#haze)" />
        {/* Near hills */}
        <path d="M0 420 C160 380 300 400 430 385 C560 370 650 410 800 400 C960 390 1060 360 1220 380 C1380 400 1480 375 1600 390 L1600 560 L0 560 Z" fill="#2b0920" />
        {/* Ground with grass */}
        <path d="M0 480 C220 455 420 470 640 462 C860 454 1080 470 1300 458 C1440 452 1540 462 1600 458 L1600 560 L0 560 Z" fill="#12040e" />
        <g stroke="#12040e" strokeWidth="3" strokeLinecap="round" fill="none">
          {Array.from({ length: 70 }, (_, i) => {
            const x = i * 23 + ((i * 37) % 11);
            const h = 18 + ((i * 53) % 34);
            const lean = ((i * 29) % 21) - 10;
            return <path key={i} d={`M${x} 470 Q${x + lean / 2} ${470 - h / 2} ${x + lean} ${470 - h}`} />;
          })}
        </g>
      </svg>

      {/* Embers */}
      {EMBERS.map((e, i) => (
        <span
          key={i}
          className="ember absolute bottom-[-10px] rounded-full bg-[#ffb85c]"
          style={{
            left: e.left,
            width: e.size,
            height: e.size,
            boxShadow: `0 0 ${e.size * 3}px ${e.size}px rgba(255,130,40,0.55)`,
            animationDuration: `${e.duration}s`,
            animationDelay: `${e.delay}s`,
            ["--drift" as string]: `${e.drift}px`,
          }}
        />
      ))}

      {/* Vignette keeps the cards readable */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(10,3,12,0.55)_100%)]" />
      {dim && <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,3,10,0.82)_0%,rgba(10,3,10,0.7)_55%,rgba(14,4,10,0.55)_100%)]" />}
    </div>
  );
}
