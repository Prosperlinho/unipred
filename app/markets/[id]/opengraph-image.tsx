import { createClient } from "@supabase/supabase-js";
import { ImageResponse } from "next/og";
import { marketProbYes } from "@/lib/pool";
import { env, isSupabaseConfigured } from "@/lib/env";

// Preview card shown when a market link is pasted into WhatsApp, X, Telegram...
export const alt = "UniPred market";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let question = "Predict what happens on your campus";
  let school = "";
  let yes = 0.5;

  if (isSupabaseConfigured && UUID_RE.test(id)) {
    const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false } });
    const { data } = await supabase
      .from("markets")
      .select("question, school_id, pool_yes, pool_no, stake_yes_kobo, stake_no_kobo, engine, status, resolution")
      .eq("id", id)
      .maybeSingle<{
        question: string;
        school_id: string;
        pool_yes: number;
        pool_no: number;
        stake_yes_kobo: number;
        stake_no_kobo: number;
        engine: "pool" | "amm";
        status: string;
        resolution: string | null;
      }>();
    if (data) {
      question = data.question;
      yes =
        data.status === "resolved"
          ? data.resolution === "YES"
            ? 1
            : 0
          : marketProbYes(data);
      const { data: s } = await supabase.from("schools").select("short_name").eq("id", data.school_id).maybeSingle<{ short_name: string }>();
      school = s?.short_name ?? "";
    }
  }

  const yesPct = Math.round(yes * 100);
  const noPct = 100 - yesPct;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #0a0d14 0%, #0f1e24 60%, #11302f 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", fontSize: 40, fontWeight: 800 }}>
            <span>Uni</span>
            <span style={{ color: "#5eead4" }}>Pred</span>
          </div>
          {school ? (
            <div
              style={{
                display: "flex",
                fontSize: 30,
                fontWeight: 700,
                color: "#e2b05c",
                background: "rgba(226,176,92,0.12)",
                padding: "8px 22px",
                borderRadius: 999,
              }}
            >
              {school}
            </div>
          ) : (
            <div style={{ display: "flex" }} />
          )}
        </div>

        <div style={{ display: "flex", fontSize: question.length > 70 ? 54 : 64, fontWeight: 700, lineHeight: 1.15 }}>
          {question}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 40, fontWeight: 800 }}>
            <span style={{ color: "#10b981" }}>YES {yesPct}%</span>
            <span style={{ color: "#f43f5e" }}>NO {noPct}%</span>
          </div>
          <div style={{ display: "flex", height: 22, borderRadius: 999, overflow: "hidden", background: "#242b3b" }}>
            <div style={{ display: "flex", width: `${yesPct}%`, background: "#10b981" }} />
            <div style={{ display: "flex", width: `${noPct}%`, background: "#f43f5e" }} />
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#8b95a9" }}>Make your call on UniPred</div>
        </div>
      </div>
    ),
    size,
  );
}
