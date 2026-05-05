"use client";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, Sparkles } from "lucide-react";

export function ClosingSlide() {
  return (
    <div className="relative h-full w-full px-12 flex items-center justify-center">
      <div className="grid grid-cols-2 gap-16 items-center max-w-6xl">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-mint/30 bg-mint/5 px-4 py-1.5 text-xs font-semibold text-mint mb-6">
            <Sparkles className="h-3.5 w-3.5" />
            Try it yourself
          </div>

          <h2 className="font-display text-6xl md:text-7xl font-extrabold leading-[0.95] tracking-tight text-white">
            metu.online
          </h2>
          <p className="mt-6 text-xl text-ink-secondary leading-relaxed">
            Scan the QR with your phone or visit the URL. The marketplace is
            fully live — browse stores, sign in with Google, and walk through
            a real checkout (test cards welcome).
          </p>

          <div className="mt-10 flex items-center gap-3 text-sm text-ink-dim">
            <ArrowRight className="h-4 w-4" />
            <span>CPE241 · Database Systems · KMUTT G.8</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-5">
          <div className="rounded-3xl bg-white p-7 shadow-[0_0_120px_rgba(255,200,40,0.25)]">
            <QRCodeSVG
              value="https://metu.online"
              size={280}
              fgColor="#0b0d12"
              bgColor="#ffffff"
              level="M"
              marginSize={2}
            />
          </div>
          <div className="text-xs uppercase tracking-[0.3em] text-ink-dim">
            point your camera here
          </div>
        </div>
      </div>
    </div>
  );
}
