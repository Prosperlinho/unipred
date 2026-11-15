import { ImageResponse } from "next/og";
import type { Candle } from "./candles";

/** Everything the card shows, already formatted. Kept free of app imports so it can be rendered in isolation. */
export interface ResultCardInput {
  kind: "won" | "lost" | "backing";
  headline: string;
  amount: string;
  detail: string;
  question: string;
  school: string;
  username: string;
  /** e.g. "YES" — the side the user backed. */
  side: string;
  stake: string;
  /** e.g. "Result: YES" or "Still live". */
  status: string;
  /** Final or current YES share, 0..1. */
  yesShare: number;
  candles: Candle[];
}

export interface CardFonts {
  latin800: ArrayBuffer | Buffer;
  ext800: ArrayBuffer | Buffer;
  latin500: ArrayBuffer | Buffer;
  ext500: ArrayBuffer | Buffer;
}

export const RESULT_CARD_SIZE = { width: 1080, height: 1080 };

const GREEN = "#10b981";
const RED = "#f43f5e";
const TEAL = "#5eead4";
const GOLD = "#e2b05c";

// Chart panel geometry (inside the 1080px card with 56px padding).
const CHART_W = 968;
const CHART_H = 400;
const PLOT_W = 790; // leaves a right-hand gutter for the % axis and the YES label
const PLOT_PAD_Y = 24;

function y(p: number): number {
  return PLOT_PAD_Y + (1 - Math.min(1, Math.max(0, p))) * (CHART_H - PLOT_PAD_Y * 2);
}

function CandleChart({ candles, yesShare, accent }: { candles: Candle[]; yesShare: number; accent: string }) {
  const n = Math.max(1, candles.length);
  const slot = PLOT_W / n;
  const bodyW = Math.max(6, Math.floor(slot * 0.62));
  const lastY = y(yesShare);

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width: CHART_W,
        height: CHART_H,
        borderRadius: 28,
        background: "linear-gradient(180deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.015) 100%)",
        border: "2px solid rgba(255,255,255,0.08)",
        overflow: "hidden",
      }}
    >
      {/* Grid lines + % axis */}
      {[1, 0.75, 0.5, 0.25, 0].map((g) => (
        <div key={g} style={{ position: "absolute", left: 0, top: y(g), width: CHART_W, display: "flex", alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              width: PLOT_W + 16,
              height: 0,
              borderTop: g === 0.5 ? "2px dashed rgba(255,255,255,0.16)" : "1px solid rgba(255,255,255,0.07)",
            }}
          />
          <div style={{ display: "flex", marginLeft: 10, marginTop: -2, fontSize: 20, fontWeight: 500, color: "#64748b" }}>
            {`${Math.round(g * 100)}%`}
          </div>
        </div>
      ))}

      {/* Candles */}
      {candles.map((k, i) => {
        const up = k.c >= k.o;
        const color = up ? GREEN : RED;
        const cx = i * slot + slot / 2 + 8;
        const top = Math.min(y(k.o), y(k.c));
        const bodyH = Math.max(5, Math.abs(y(k.o) - y(k.c)));
        const wickTop = y(k.h);
        const wickH = Math.max(bodyH, y(k.l) - y(k.h));
        return (
          <div key={i} style={{ position: "absolute", left: cx - bodyW / 2, top: 0, width: bodyW, height: CHART_H, display: "flex" }}>
            <div
              style={{
                position: "absolute",
                left: bodyW / 2 - 2,
                top: wickTop,
                width: 4,
                height: wickH,
                background: color,
                opacity: 0.75,
                borderRadius: 2,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 0,
                top: top - (bodyH === 5 ? 2 : 0),
                width: bodyW,
                height: bodyH,
                background: color,
                borderRadius: 4,
              }}
            />
          </div>
        );
      })}

      {/* Current / final level */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: lastY,
          width: PLOT_W + 16,
          height: 0,
          display: "flex",
          borderTop: `2px dashed ${accent}`,
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: "absolute",
          right: 14,
          top: Math.min(CHART_H - 44, Math.max(4, lastY - 20)),
          display: "flex",
          padding: "6px 14px",
          borderRadius: 999,
          background: accent,
          color: "#0a0d14",
          fontSize: 22,
          fontWeight: 800,
        }}
      >
        {`YES ${Math.round(yesShare * 100)}%`}
      </div>
    </div>
  );
}

export function renderResultCard(c: ResultCardInput, fonts: CardFonts, headers?: Record<string, string>) {
  const accent = c.kind === "won" ? GREEN : c.kind === "lost" ? RED : TEAL;
  const glow = c.kind === "won" ? "rgba(16,185,129,0.35)" : c.kind === "lost" ? "rgba(244,63,94,0.30)" : "rgba(94,234,212,0.26)";
  const badge = c.kind === "won" ? "WINNER" : c.kind === "lost" ? "SETTLED" : "LIVE BET";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 56,
          color: "white",
          fontFamily: "Inter",
          background: `radial-gradient(ellipse at 15% 0%, ${glow} 0%, transparent 50%), radial-gradient(ellipse at 100% 100%, rgba(226,176,92,0.10) 0%, transparent 45%), #070a10`,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "flex",
                width: 52,
                height: 52,
                borderRadius: 14,
                background: TEAL,
                alignItems: "flex-end",
                justifyContent: "center",
                gap: 5,
                padding: "12px 0",
              }}
            >
              <div style={{ display: "flex", width: 8, height: 12, background: "#0a0d14", borderRadius: 2 }} />
              <div style={{ display: "flex", width: 8, height: 20, background: "#0a0d14", borderRadius: 2 }} />
              <div style={{ display: "flex", width: 8, height: 28, background: "#0a0d14", borderRadius: 2 }} />
            </div>
            <div style={{ display: "flex", fontSize: 42, fontWeight: 800 }}>
              <span>Uni</span>
              <span style={{ color: TEAL }}>Pred</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {c.school ? (
              <div
                style={{
                  display: "flex",
                  fontSize: 26,
                  fontWeight: 800,
                  color: GOLD,
                  background: "rgba(226,176,92,0.14)",
                  padding: "10px 22px",
                  borderRadius: 999,
                }}
              >
                {c.school}
              </div>
            ) : null}
            <div
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 800,
                color: accent,
                border: `2px solid ${accent}`,
                padding: "8px 20px",
                borderRadius: 999,
              }}
            >
              {badge}
            </div>
          </div>
        </div>

        {/* Result */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginTop: 44 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: 3 }}>
              {c.headline}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: c.amount.length > 9 ? 112 : 136,
                fontWeight: 800,
                lineHeight: 1,
                marginTop: 6,
                color: c.kind === "lost" ? "#f8fafc" : accent,
              }}
            >
              {c.amount}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, marginBottom: 8 }}>
            <div style={{ display: "flex", gap: 10, fontSize: 26, fontWeight: 500, color: "#94a3b8" }}>
              <span>Staked</span>
              <span style={{ color: "white", fontWeight: 800 }}>{c.stake}</span>
            </div>
            <div style={{ display: "flex", gap: 10, fontSize: 26, fontWeight: 500, color: "#94a3b8" }}>
              <span>Backed</span>
              <span style={{ color: c.side === "YES" ? GREEN : RED, fontWeight: 800 }}>{c.side}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 28, fontWeight: 500, color: "#cbd5e1", marginTop: 14 }}>{c.detail}</div>

        {/* Chart */}
        <div style={{ display: "flex", marginTop: 30 }}>
          <CandleChart candles={c.candles} yesShare={c.yesShare} accent={accent} />
        </div>

        {/* Question + footer */}
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: c.question.length > 80 ? 30 : 34,
            fontWeight: 800,
            lineHeight: 1.25,
          }}
        >
          {c.question}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "auto",
            fontSize: 24,
            fontWeight: 500,
            color: "#64748b",
          }}
        >
          <span>@{c.username}</span>
          <span>{c.status} · unipred.vercel.app</span>
        </div>
      </div>
    ),
    {
      ...RESULT_CARD_SIZE,
      headers,
      // Separate family names: the renderer keeps one font per name+weight, and only the
      // latin-ext files contain the ₦ sign, so they must load as a distinct fallback family.
      fonts: [
        { name: "Inter", data: fonts.latin800, weight: 800, style: "normal" },
        { name: "Inter Ext", data: fonts.ext800, weight: 800, style: "normal" },
        { name: "Inter", data: fonts.latin500, weight: 500, style: "normal" },
        { name: "Inter Ext", data: fonts.ext500, weight: 500, style: "normal" },
      ],
    },
  );
}
