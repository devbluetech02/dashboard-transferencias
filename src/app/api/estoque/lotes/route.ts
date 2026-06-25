import type { NextRequest } from "next/server";
import { gatewayQuery } from "@/lib/winthor";
import { qLotes, type LoteRow } from "@/lib/estoque";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const codprod = url.searchParams.get("codprod");
  const cidade = url.searchParams.get("cidade");
  if (!codprod) {
    return Response.json({ error: "codprod obrigatório" }, { status: 400 });
  }
  try {
    const r = await gatewayQuery<LoteRow>(qLotes(codprod, cidade));
    return Response.json({ lotes: r.rows.map((x) => x.LOTEPRODUTO) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
