import { gatewayQuery } from "@/lib/winthor";
import { Q_SECOES, type SecaoOption } from "@/lib/estoque";

export async function GET() {
  try {
    const r = await gatewayQuery<SecaoOption>(Q_SECOES);
    return Response.json({ secoes: r.rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
