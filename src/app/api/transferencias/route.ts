import { gatewayQuery } from "@/lib/winthor";
import { Q_TRANSFERENCIAS } from "@/lib/queries";

export async function GET() {
  try {
    const r = await gatewayQuery(Q_TRANSFERENCIAS);
    return Response.json({ rows: r.rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
