import type { NextRequest } from "next/server";
import { gatewayQuery } from "@/lib/winthor";
import { Q_ITENS } from "@/lib/queries";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/transferencias/[transacao]/itens">,
) {
  const { transacao } = await ctx.params;
  const n = Number(transacao);
  if (!Number.isFinite(n)) {
    return Response.json({ error: "transacao inválida" }, { status: 400 });
  }
  try {
    const r = await gatewayQuery(Q_ITENS, { transacao: n });
    return Response.json({ rows: r.rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
