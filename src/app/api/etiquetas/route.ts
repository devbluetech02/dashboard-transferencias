import type { NextRequest } from "next/server";
import { gatewayQuery } from "@/lib/winthor";
import { Q_ETIQUETAS_LIST, Q_ETIQUETA_BY_ITEM } from "@/lib/queries";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const transacao = url.searchParams.get("transacao");
  const codprod = url.searchParams.get("codprod");
  const codbarras = url.searchParams.get("codbarras");

  try {
    if (transacao && codprod) {
      const r = await gatewayQuery(Q_ETIQUETA_BY_ITEM, {
        transacao: Number(transacao),
        codprod: Number(codprod),
      });
      return Response.json({ rows: r.rows });
    }
    const r = await gatewayQuery(Q_ETIQUETAS_LIST, {
      codbarras: codbarras && codbarras.length > 0 ? codbarras : null,
    });
    return Response.json({ rows: r.rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
