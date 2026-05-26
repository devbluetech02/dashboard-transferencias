import type { NextRequest } from "next/server";
import { gatewayQuery } from "@/lib/winthor";
import { Q_LEAD_TIMES } from "@/lib/queries";

const PERIODOS: Record<string, number> = { today: 0, "7d": 7, "30d": 30 };

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const period = url.searchParams.get("period") ?? "30d";
  const dias = PERIODOS[period] ?? 30;
  try {
    const r = await gatewayQuery<{
      H_SAIDA: number | null;
      H_ROTA: number | null;
      H_ENTRADA: number | null;
      H_LEAD_TIME: number | null;
      N_CONCLUIDAS: number;
      N_TOTAL: number;
    }>(Q_LEAD_TIMES, { dias });
    return Response.json(r.rows[0] ?? null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
