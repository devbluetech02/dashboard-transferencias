import type { NextRequest } from "next/server";
import { gatewayQuery } from "@/lib/winthor";
import { Q_TRANSFERENCIA_BY_ID } from "@/lib/queries";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/transferencias/[transacao]">,
) {
  const { transacao } = await ctx.params;
  const n = Number(transacao);
  if (!Number.isFinite(n)) {
    return Response.json({ error: "transacao inválida" }, { status: 400 });
  }
  try {
    const r = await gatewayQuery(Q_TRANSFERENCIA_BY_ID, { transacao: n });
    return Response.json(r.rows[0] ?? null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
