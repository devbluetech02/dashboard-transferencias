import type { NextRequest } from "next/server";
import { gatewayQuery } from "@/lib/winthor";
import { Q_ITENS_SEARCH } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const codprod = url.searchParams.get("codprod");
  if (!codprod) {
    return Response.json({ rows: [] });
  }
  try {
    const r = await gatewayQuery(Q_ITENS_SEARCH, { codprod });
    return Response.json({ rows: r.rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
