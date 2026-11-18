import { getVapidKeys } from "@/lib/notify";

/** Public key browsers need to subscribe to phone notifications. */
export async function GET() {
  const { publicKey } = await getVapidKeys();
  return Response.json({ publicKey }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
