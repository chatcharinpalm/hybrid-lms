import Image from "next/image";

/**
 * The site's mark in the top bars: the department logo in a fiery ring and the
 * site name (arjarnton.com) lettered like a game title.
 */
export function BrandMark({ sub = "ระบบสอบออนไลน์" }: { sub?: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="shrink-0 rounded-full bg-gradient-to-br from-[#ffe08a] via-[#ff9a3d] to-[#e2401c] p-[2px] shadow-[0_0_14px_rgba(255,130,40,0.45)]">
        <Image src="/brand/ce-logo.png" alt="ภาควิชาคอมพิวเตอร์ศึกษา" width={36} height={36} className="h-9 w-9 rounded-full bg-white" />
      </span>
      <span className="hidden flex-col leading-none sm:flex">
        <span
          className="bg-clip-text pr-1 font-display text-[19px] font-black italic tracking-wide text-transparent"
          style={{
            backgroundImage: "linear-gradient(180deg, #fff6c4 0%, #ffd35a 40%, #ff8a2a 70%, #d8301a 100%)",
            filter: "drop-shadow(0 1px 0 #5a0d0a)",
          }}
        >
          ARJARNTON
        </span>
        <span className="mt-0.5 text-[10px] font-medium tracking-wider text-[#ffcf9a]/70">{sub}</span>
      </span>
    </span>
  );
}
