import { ImageResponse } from "next/og";

/** Everything the card shows, already formatted. Kept free of app imports so it can be rendered in isolation. */
export interface ResultCardInput {
  kind: "won" | "lost" | "backing";
  headline: string;
  amount: string;
  detail: string;
  question: string;
  school: string;
  username: string;
  status: string;
}

export interface CardFonts {
  latin800: ArrayBuffer | Buffer;
  ext800: ArrayBuffer | Buffer;
  latin500: ArrayBuffer | Buffer;
  ext500: ArrayBuffer | Buffer;
}

export const RESULT_CARD_SIZE = { width: 1080, height: 1080 };

export function renderResultCard(c: ResultCardInput, fonts: CardFonts, headers?: Record<string, string>) {
  const accent = c.kind === "won" ? "#10b981" : c.kind === "lost" ? "#f43f5e" : "#5eead4";
  const glow = c.kind === "won" ? "rgba(16,185,129,0.30)" : c.kind === "lost" ? "rgba(244,63,94,0.26)" : "rgba(94,234,212,0.22)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          color: "white",
          fontFamily: "Inter",
          background: `radial-gradient(circle at 85% 0%, ${glow} 0%, transparent 55%), linear-gradient(160deg, #0a0d14 0%, #0f1720 100%)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 48, fontWeight: 800 }}>
            <span>Uni</span>
            <span style={{ color: "#5eead4" }}>Pred</span>
          </div>
          {c.school ? (
            <div
              style={{
                display: "flex",
                fontSize: 32,
                fontWeight: 800,
                color: "#e2b05c",
                background: "rgba(226,176,92,0.14)",
                padding: "10px 26px",
                borderRadius: 999,
              }}
            >
              {c.school}
            </div>
          ) : (
            <div style={{ display: "flex" }} />
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 56, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: 2 }}>
            {c.headline}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: c.amount.length > 9 ? 136 : 168,
              fontWeight: 800,
              lineHeight: 1.05,
              color: c.kind === "lost" ? "#f8fafc" : accent,
            }}
          >
            {c.amount}
          </div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 500, color: "#cbd5e1", marginTop: 14 }}>{c.detail}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div
            style={{
              display: "flex",
              fontSize: c.question.length > 80 ? 36 : 42,
              fontWeight: 500,
              lineHeight: 1.25,
              padding: "28px 32px",
              borderRadius: 28,
              background: "rgba(255,255,255,0.06)",
              border: "2px solid rgba(255,255,255,0.10)",
            }}
          >
            {c.question}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, fontWeight: 500, color: "#8b95a9" }}>
            <span>@{c.username}</span>
            <span>{c.status} · unipred.vercel.app</span>
          </div>
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
