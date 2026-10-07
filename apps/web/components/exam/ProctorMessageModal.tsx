"use client";

import Image from "next/image";

interface ProctorMessageModalProps {
  message: { id: string; message: string; createdAt: string } | null;
  onAcknowledge: () => void;
}

/** A warning sent from the back office, shown over the exam until the student acknowledges it. */
export function ProctorMessageModal({ message, onAcknowledge }: ProctorMessageModalProps) {
  if (!message) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-2xl border-2 border-amber-500 ring-4 ring-amber-500/20 bg-surface-container-high p-6 shadow-2xl text-center space-y-4">
        <div className="w-24 h-24 mx-auto rounded-full overflow-hidden border-4 border-amber-400 animate-bounce">
          <Image src="/hun-nae.png" alt="ผู้คุมสอบ" width={100} height={100} className="object-cover w-full h-full object-top" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-amber-400">ข้อความจากผู้คุมสอบ</p>
          <p className="text-[11px] text-outline font-mono mt-0.5">
            {new Date(message.createdAt).toLocaleTimeString("th-TH")}
          </p>
        </div>
        <p className="text-base font-semibold text-on-surface leading-relaxed whitespace-pre-wrap break-words">
          {message.message}
        </p>
        <button
          type="button"
          onClick={onAcknowledge}
          className="w-full py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black"
        >
          รับทราบ
        </button>
      </div>
    </div>
  );
}
