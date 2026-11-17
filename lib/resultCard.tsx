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
  /** Profit/loss line under the stake, e.g. "+₦2,073" or "-₦1,000". */
  pnl: string;
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

const GREEN = "#2fd47a";
const RED = "#ff5d5d";
const LIME = "#c6f432";
const CREAM = "#f3efe6";
const BG = "#08170f";
const MUTED = "#8ba596";
const LOGO_LEFT = "M120 110 A28 28 0 0 1 176 110 V240 A24 24 0 0 0 200 264 V320 A80 80 0 0 1 120 240 Z";
const LOGO_RIGHT = "M224 174 A28 28 0 0 1 280 174 V240 A80 80 0 0 1 200 320 V264 A24 24 0 0 0 224 240 Z";

// Chart panel geometry (inside the 1080px card with 56px padding).
const CHART_W = 968;
const CHART_H = 270;
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
          {Math.abs(y(g) - lastY) > 30 ? (
            <div style={{ display: "flex", marginLeft: 10, marginTop: -2, fontSize: 20, fontWeight: 500, color: MUTED }}>
              {`${Math.round(g * 100)}%`}
            </div>
          ) : null}
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
          color: BG,
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
  const accent = c.kind === "won" ? GREEN : c.kind === "lost" ? RED : LIME;
  const glow = c.kind === "won" ? "rgba(47,212,122,0.22)" : c.kind === "lost" ? "rgba(255,93,93,0.20)" : "rgba(198,244,50,0.18)";
  const tag = c.kind === "won" ? "Won" : c.kind === "lost" ? "Lost" : "Live";
  const tagBg = c.kind === "won" ? "rgba(47,212,122,0.16)" : c.kind === "lost" ? "rgba(255,93,93,0.16)" : "rgba(198,244,50,0.14)";
  const pnlColor = c.pnl.trim().startsWith("-") ? RED : GREEN;
  const sideColor = c.side === "YES" ? GREEN : c.side === "NO" ? RED : CREAM;
  const initials = c.username.slice(0, 2).toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 56,
          color: CREAM,
          fontFamily: "Inter",
          background: `radial-gradient(ellipse at 10% 0%, ${glow} 0%, transparent 55%), radial-gradient(ellipse at 100% 100%, rgba(198,244,50,0.07) 0%, transparent 50%), ${BG}`,
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="56" height="56" viewBox="0 0 400 400">
              <rect width="400" height="400" rx="96" fill="#0B1F16" />
              <path d={LOGO_LEFT} fill={LIME} />
              <path d={LOGO_RIGHT} fill={CREAM} />
            </svg>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>
              <span style={{ color: LIME }}>Uni</span>
              <span style={{ color: CREAM }}>Pred</span>
            </div>
          </div>
          {c.school ? (
            <div
              style={{
                display: "flex",
                fontSize: 24,
                fontWeight: 800,
                color: CREAM,
                background: "rgba(243,239,230,0.08)",
                border: "1px solid rgba(243,239,230,0.14)",
                padding: "10px 22px",
                borderRadius: 999,
              }}
            >
              {c.school}
            </div>
          ) : null}
        </div>

        {/* Post header: avatar, username, tinted tag */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 40 }}>
          <div
            style={{
              display: "flex",
              width: 64,
              height: 64,
              borderRadius: 999,
              background: LIME,
              color: BG,
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 800,
            }}
          >
            {initials}
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800, color: CREAM }}>@{c.username}</div>
          <div
            style={{
              display: "flex",
              fontSize: 26,
              fontWeight: 800,
              color: accent,
              background: tagBg,
              padding: "6px 16px",
              borderRadius: 10,
            }}
          >
            {tag}
          </div>
          <div style={{ display: "flex", fontSize: 26, fontWeight: 500, color: MUTED }}>{c.status}</div>
        </div>

        {/* Headline + big amount */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: 26 }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 500, color: "rgba(243,239,230,0.85)" }}>{c.headline}</div>
          <div
            style={{
              display: "flex",
              fontSize: c.amount.length > 10 ? 112 : c.amount.length > 7 ? 128 : 144,
              fontWeight: 800,
              lineHeight: 1,
              marginTop: 6,
              color: c.kind === "lost" ? CREAM : accent,
            }}
          >
            {c.amount}
          </div>
        </div>

        {/* Position panel */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 28,
            marginTop: 30,
            padding: "26px 30px",
            borderRadius: 28,
            background: "rgba(255,255,255,0.045)",
            border: "2px solid rgba(255,255,255,0.07)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, fontWeight: 500, color: MUTED }}>
              <span>Position</span>
              <div style={{ display: "flex", width: 10, height: 10, borderRadius: 999, background: accent }} />
              <div
                style={{
                  display: "flex",
                  fontSize: 22,
                  fontWeight: 800,
                  color: sideColor,
                  background: "rgba(255,255,255,0.06)",
                  padding: "2px 12px",
                  borderRadius: 8,
                }}
              >
                {c.side}
              </div>
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 10,
                fontSize: c.question.length > 80 ? 26 : 30,
                fontWeight: 800,
                lineHeight: 1.25,
                color: CREAM,
              }}
            >
              {c.question}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0 }}>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 800, color: CREAM }}>{c.stake}</div>
            <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: pnlColor, marginTop: 4 }}>{c.pnl}</div>
          </div>
        </div>

        {/* Chart */}
        <div style={{ display: "flex", marginTop: 28 }}>
          <CandleChart candles={c.candles} yesShare={c.yesShare} accent={accent} />
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: "auto",
            fontSize: 24,
            fontWeight: 500,
            color: MUTED,
          }}
        >
          <span>{c.detail}</span>
          <span style={{ color: LIME, fontWeight: 800 }}>unipred.site</span>
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
