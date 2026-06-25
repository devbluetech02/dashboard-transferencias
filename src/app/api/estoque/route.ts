import type { NextRequest } from "next/server";
import { gatewayQuery } from "@/lib/winthor";
import { qEstoqueConsolidado, type EstoqueProdutoRow } from "@/lib/estoque";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const cidade = url.searchParams.get("cidade");
  const secao = url.searchParams.get("secao");
  const codprod = url.searchParams.get("codprod");
  try {
    const r = await gatewayQuery<EstoqueProdutoRow>(
      qEstoqueConsolidado({ cidade, secao, codprod }),
    );
    return Response.json({ produtos: r.rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
