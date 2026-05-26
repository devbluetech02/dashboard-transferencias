import { gatewayQuery } from "@/lib/winthor";
import { Q_KPI_STATUS, Q_KPI_SOLICITANTE } from "@/lib/queries";

export async function GET() {
  try {
    const [status, solicitantes] = await Promise.all([
      gatewayQuery<{ POSICAO: string; TOTAL: number }>(Q_KPI_STATUS),
      gatewayQuery<{ SOLICITANTE: string; TOTAL: number }>(Q_KPI_SOLICITANTE),
    ]);
    return Response.json({
      status: status.rows,
      solicitantes: solicitantes.rows,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
