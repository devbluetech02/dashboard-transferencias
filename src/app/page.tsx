"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Etiqueta,
  Item,
  ItemSearchRow,
  KpiSolicitanteRow,
  KpiStatusRow,
  Transferencia,
} from "@/lib/types";
import { STATUS_LABEL } from "@/lib/queries";
import { Donut } from "@/components/Donut";
import BorderGlow from "@/components/BorderGlow";

const KPI_GLOW: Record<
  string,
  { hsl: string; colors: string[] }
> = {
  total: {
    hsl: "240 5 60",
    colors: ["#a1a1aa", "#d4d4d8", "#71717a"],
  },
  E: {
    hsl: "217 91 60",
    colors: ["#60a5fa", "#3b82f6", "#93c5fd"],
  },
  C: {
    hsl: "38 92 55",
    colors: ["#fbbf24", "#f59e0b", "#fde68a"],
  },
  V: {
    hsl: "262 83 60",
    colors: ["#a78bfa", "#8b5cf6", "#c4b5fd"],
  },
  T: {
    hsl: "160 84 45",
    colors: ["#34d399", "#10b981", "#6ee7b7"],
  },
  N: {
    hsl: "350 89 60",
    colors: ["#fb7185", "#f43f5e", "#fda4af"],
  },
};
import {
  IconArrowRight,
  IconBarcode,
  IconCheck,
  IconClock,
  IconFilter,
  IconGrid,
  IconLayers,
  IconRefresh,
  IconSearch,
  IconTruck,
  IconUser,
  IconX,
} from "@/components/icons";

const STATUS_COLOR: Record<string, string> = {
  L: "#64748b",
  E: "#3b82f6",
  C: "#f59e0b",
  V: "#8b5cf6",
  T: "#10b981",
  N: "#ef4444",
};

const STATUS_BG: Record<string, string> = {
  L: "bg-slate-500/10 text-slate-600 dark:text-slate-300 ring-slate-500/20",
  E: "bg-blue-500/10 text-blue-600 dark:text-blue-300 ring-blue-500/20",
  C: "bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/20",
  V: "bg-violet-500/10 text-violet-600 dark:text-violet-300 ring-violet-500/20",
  T: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 ring-emerald-500/20",
  N: "bg-rose-500/10 text-rose-600 dark:text-rose-300 ring-rose-500/20",
};

function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function fmtDateShort(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("pt-BR");
}

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store" });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j as T;
}

export default function Page() {
  const [kpis, setKpis] = useState<{
    status: KpiStatusRow[];
    solicitantes: KpiSolicitanteRow[];
  } | null>(null);
  const [transfs, setTransfs] = useState<Transferencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);

  const [filtroOrigem, setFiltroOrigem] = useState("");
  const [filtroDestino, setFiltroDestino] = useState("");
  const [statusFiltros, setStatusFiltros] = useState<Set<string>>(new Set());
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const TAMANHO_PAGINA = 25;

  const [selecionada, setSelecionada] = useState<Transferencia | null>(null);
  const [itens, setItens] = useState<Item[] | null>(null);
  const [itensLoading, setItensLoading] = useState(false);
  const [itemExpandido, setItemExpandido] = useState<number | null>(null);
  const [etiquetasItem, setEtiquetasItem] = useState<
    Record<string, Etiqueta[]>
  >({});
  const [etiquetasItemLoading, setEtiquetasItemLoading] = useState<
    Set<string>
  >(new Set());

  const [etiquetaQuery, setEtiquetaQuery] = useState("");
  const [etiquetas, setEtiquetas] = useState<Etiqueta[] | null>(null);
  const [etiquetasLoading, setEtiquetasLoading] = useState(false);
  const [etiquetasModalOpen, setEtiquetasModalOpen] = useState(false);

  const [codprodQuery, setCodprodQuery] = useState("");
  const [itensSearch, setItensSearch] = useState<ItemSearchRow[] | null>(null);
  const [itensSearchLoading, setItensSearchLoading] = useState(false);
  const [itensSearchModalOpen, setItensSearchModalOpen] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [k, t] = await Promise.all([
        fetchJson<{ status: KpiStatusRow[]; solicitantes: KpiSolicitanteRow[] }>(
          "/api/kpis",
        ),
        fetchJson<{ rows: Transferencia[] }>("/api/transferencias"),
      ]);
      setKpis(k);
      setTransfs(t.rows);
      setLastLoaded(new Date());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selecionada) {
      setItens(null);
      setItemExpandido(null);
      setEtiquetasItem({});
      return;
    }
    setItemExpandido(null);
    setItensLoading(true);
    fetchJson<{ rows: Item[] }>(
      `/api/transferencias/${selecionada.TRANSACAO}/itens`,
    )
      .then((r) => setItens(r.rows))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() => setItensLoading(false));
  }, [selecionada]);

  function toggleItemEtiquetas(item: Item) {
    const key = `${item.TRANSACAO}-${item.CODPROD}`;
    if (itemExpandido === item.CODPROD) {
      setItemExpandido(null);
      return;
    }
    setItemExpandido(item.CODPROD);
    if (etiquetasItem[key]) return;
    setEtiquetasItemLoading((prev) => new Set(prev).add(key));
    fetchJson<{ rows: Etiqueta[] }>(
      `/api/etiquetas?transacao=${item.TRANSACAO}&codprod=${item.CODPROD}`,
    )
      .then((r) =>
        setEtiquetasItem((prev) => ({ ...prev, [key]: r.rows })),
      )
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)))
      .finally(() =>
        setEtiquetasItemLoading((prev) => {
          const n = new Set(prev);
          n.delete(key);
          return n;
        }),
      );
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelecionada(null);
        setEtiquetasModalOpen(false);
        setItensSearchModalOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const origens = useMemo(
    () => Array.from(new Set(transfs.map((t) => t.ORIGEM))).sort(),
    [transfs],
  );
  const destinos = useMemo(
    () => Array.from(new Set(transfs.map((t) => t.DESTINO))).sort(),
    [transfs],
  );

  const filtradas = useMemo(() => {
    return transfs.filter((t) => {
      if (filtroOrigem && t.ORIGEM !== filtroOrigem) return false;
      if (filtroDestino && t.DESTINO !== filtroDestino) return false;
      if (statusFiltros.size && !statusFiltros.has(t.POSICAO_COD)) return false;
      if (busca) {
        const q = busca.toLowerCase();
        const hay =
          `${t.TRANSACAO} ${t.SOLICITANTE ?? ""} ${t.ORIGEM} ${t.DESTINO} ${t.FUNC_ATUALIZACAO ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [transfs, filtroOrigem, filtroDestino, statusFiltros, busca]);

  useEffect(() => {
    setPagina(1);
  }, [filtroOrigem, filtroDestino, statusFiltros, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / TAMANHO_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginadas = useMemo(
    () =>
      filtradas.slice(
        (paginaAtual - 1) * TAMANHO_PAGINA,
        paginaAtual * TAMANHO_PAGINA,
      ),
    [filtradas, paginaAtual],
  );

  function toggleStatus(cod: string) {
    setStatusFiltros((prev) => {
      const next = new Set(prev);
      if (next.has(cod)) next.delete(cod);
      else next.add(cod);
      return next;
    });
  }

  const counts = useMemo(() => {
    const m: Record<string, number> = { L: 0, E: 0, C: 0, V: 0, T: 0, N: 0 };
    for (const t of transfs) m[t.POSICAO_COD] = (m[t.POSICAO_COD] ?? 0) + 1;
    return m;
  }, [transfs]);

  const total = transfs.length;
  const donutData = useMemo(
    () =>
      (["E", "C", "V", "T", "N", "L"] as const)
        .filter((k) => counts[k] > 0)
        .map((k) => ({
          key: k,
          label: STATUS_LABEL[k],
          value: counts[k],
          color: STATUS_COLOR[k],
        })),
    [counts],
  );

  async function buscarItens() {
    if (!codprodQuery.trim()) return;
    setItensSearchModalOpen(true);
    setItensSearchLoading(true);
    try {
      const r = await fetchJson<{ rows: ItemSearchRow[] }>(
        `/api/itens/search?codprod=${encodeURIComponent(codprodQuery)}`,
      );
      setItensSearch(r.rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setItensSearchLoading(false);
    }
  }

  async function buscarEtiquetas() {
    setEtiquetasModalOpen(true);
    setEtiquetasLoading(true);
    try {
      const url = etiquetaQuery
        ? `/api/etiquetas?codbarras=${encodeURIComponent(etiquetaQuery)}`
        : "/api/etiquetas";
      const r = await fetchJson<{ rows: Etiqueta[] }>(url);
      setEtiquetas(r.rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setEtiquetasLoading(false);
    }
  }

  const filtersActive =
    !!filtroOrigem || !!filtroDestino || statusFiltros.size > 0 || !!busca;

  return (
    <div className="min-h-screen text-[var(--text)]">
      {/* Main */}
      <div className="min-w-0">
        {/* Topbar */}
        <header className="border-b border-[var(--border)] glass sticky top-0 z-20">
          <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-3.5 flex items-center gap-3">
            <div className="size-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <IconTruck size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base md:text-lg font-semibold tracking-tight">
                Transferências entre filiais
              </h1>
              <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
                <span className="relative flex size-1.5">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                  <span className="relative rounded-full bg-emerald-400 size-1.5" />
                </span>
                {lastLoaded
                  ? `Atualizado às ${lastLoaded.toLocaleTimeString("pt-BR")} · auto 15s`
                  : "Carregando…"}
              </p>
            </div>
            <div className="hidden md:flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--text-muted)] w-72 focus-within:border-[var(--accent)] transition">
              <IconLayers size={15} />
              <input
                value={codprodQuery}
                onChange={(e) => setCodprodQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") buscarItens();
                }}
                placeholder="Código do item (CODPROD)…"
                className="bg-transparent flex-1 outline-none text-[var(--text)] placeholder:text-[var(--text-muted)]"
              />
              {codprodQuery && (
                <button
                  onClick={() => setCodprodQuery("")}
                  className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  <IconX size={14} />
                </button>
              )}
              <button
                onClick={buscarItens}
                disabled={itensSearchLoading}
                className="size-7 shrink-0 rounded-md text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-40 flex items-center justify-center transition-colors"
                title="Buscar item"
              >
                <IconSearch size={15} />
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--text-muted)] w-72 focus-within:border-[var(--accent)] transition">
              <IconBarcode size={15} />
              <input
                value={etiquetaQuery}
                onChange={(e) => setEtiquetaQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") buscarEtiquetas();
                }}
                placeholder="Buscar etiqueta (CODBARRAS)…"
                className="bg-transparent flex-1 outline-none text-[var(--text)] placeholder:text-[var(--text-muted)]"
              />
              {etiquetaQuery && (
                <button
                  onClick={() => setEtiquetaQuery("")}
                  className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text)]"
                >
                  <IconX size={14} />
                </button>
              )}
              <button
                onClick={buscarEtiquetas}
                disabled={etiquetasLoading}
                className="size-7 shrink-0 rounded-md text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-40 flex items-center justify-center transition-colors"
                title="Buscar"
              >
                <IconSearch size={15} />
              </button>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition"
            >
              <IconRefresh size={15} />
              <span className="hidden sm:inline">
                {loading ? "Carregando…" : "Recarregar"}
              </span>
            </button>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 space-y-6 anim-fade">
          {err && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900 px-4 py-3 text-sm text-rose-700 dark:text-rose-300 flex items-start gap-3">
              <span className="mt-0.5">
                <IconX size={16} />
              </span>
              <div className="flex-1">{err}</div>
              <button
                onClick={() => setErr(null)}
                className="text-rose-500 hover:text-rose-700"
              >
                <IconX size={14} />
              </button>
            </div>
          )}

          {/* KPIs (clique = filtro) */}
          <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <KpiCard
              label="Total"
              value={total}
              loading={loading}
              icon={<IconLayers />}
              accent="from-zinc-600 to-zinc-800 dark:from-zinc-400 dark:to-zinc-600"
              glow={KPI_GLOW.total}
              active={statusFiltros.size === 0}
              onClick={() => setStatusFiltros(new Set())}
              hint={statusFiltros.size === 0 ? "todos" : "limpar filtros"}
            />
            <KpiCard
              label="Em coleta"
              value={counts.E}
              loading={loading}
              icon={<IconClock />}
              accent="from-blue-500 to-blue-700"
              glow={KPI_GLOW.E}
              active={statusFiltros.has("E")}
              onClick={() => toggleStatus("E")}
            />
            <KpiCard
              label="Em conferência"
              value={counts.C}
              loading={loading}
              icon={<IconFilter />}
              accent="from-amber-500 to-amber-700"
              glow={KPI_GLOW.C}
              active={statusFiltros.has("C")}
              onClick={() => toggleStatus("C")}
            />
            <KpiCard
              label="Em rota"
              value={counts.V}
              loading={loading}
              icon={<IconTruck />}
              accent="from-violet-500 to-violet-700"
              glow={KPI_GLOW.V}
              active={statusFiltros.has("V")}
              onClick={() => toggleStatus("V")}
            />
            <KpiCard
              label="Concluídas"
              value={counts.T}
              loading={loading}
              icon={<IconCheck />}
              accent="from-emerald-500 to-emerald-700"
              glow={KPI_GLOW.T}
              active={statusFiltros.has("T")}
              onClick={() => toggleStatus("T")}
            />
            <KpiCard
              label="Canceladas"
              value={counts.N}
              loading={loading}
              icon={<IconX />}
              accent="from-rose-500 to-rose-700"
              glow={KPI_GLOW.N}
              active={statusFiltros.has("N")}
              onClick={() => toggleStatus("N")}
            />
          </section>

          {/* Charts row */}
          <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <Card
              title="Distribuição por status"
              subtitle="Posição atual das transferências"
              className="lg:col-span-2"
            >
              {donutData.length ? (
                <Donut
                  data={donutData}
                  centerValue={total}
                  centerLabel="total"
                />
              ) : (
                <SkeletonBlock height={180} />
              )}
            </Card>
            <Card
              title="Top solicitantes"
              subtitle="Quem mais abre transferências"
              className="lg:col-span-3"
              icon={<IconUser size={15} />}
            >
              {kpis?.solicitantes?.length ? (
                <SolicitanteBars rows={kpis.solicitantes.slice(0, 8)} />
              ) : loading ? (
                <SkeletonList rows={6} />
              ) : (
                <Empty />
              )}
            </Card>
          </section>

          {/* Table */}
          <Card
            title="Transferências"
            subtitle={`${filtradas.length} de ${total}`}
            icon={<IconGrid size={15} />}
            action={
              filtersActive && (
                <button
                  onClick={() => {
                    setFiltroOrigem("");
                    setFiltroDestino("");
                    setStatusFiltros(new Set());
                    setBusca("");
                  }}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  Limpar filtros
                </button>
              )
            }
          >
            <div className="flex flex-wrap gap-2 mb-3">
              <Select
                value={filtroOrigem}
                onChange={setFiltroOrigem}
                options={origens}
                placeholder="Origem"
              />
              <Select
                value={filtroDestino}
                onChange={setFiltroDestino}
                options={destinos}
                placeholder="Destino"
              />
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-sm flex-1 min-w-48">
                <IconSearch size={14} className="text-[var(--text-muted)]" />
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar transação, solicitante, funcionário…"
                  className="bg-transparent flex-1 outline-none"
                />
                {busca && (
                  <button
                    onClick={() => setBusca("")}
                    className="text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    <IconX size={12} />
                  </button>
                )}
              </div>
            </div>
            {statusFiltros.size > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3 text-xs text-[var(--text-muted)] items-center">
                <span>Status:</span>
                {Array.from(statusFiltros).map((cod) => (
                  <button
                    key={cod}
                    onClick={() => toggleStatus(cod)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] hover:opacity-80"
                  >
                    {STATUS_LABEL[cod]} <IconX size={10} />
                  </button>
                ))}
              </div>
            )}
            <div className="overflow-x-auto -mx-4 md:-mx-5">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
                  <tr>
                    <Th>Transação</Th>
                    <Th className="!text-center">Rota</Th>
                    <Th>Data</Th>
                    <Th>Solicitante</Th>
                    <Th>Status</Th>
                    <Th>Atualizado em</Th>
                    <Th>Atualizado por</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !transfs.length
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className="border-b border-[var(--border)]">
                          {Array.from({ length: 7 }).map((_, j) => (
                            <td key={j} className="px-3 py-3">
                              <div className="skeleton h-3 w-24" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : paginadas.map((t) => (
                        <tr
                          key={t.TRANSACAO}
                          onClick={() => setSelecionada(t)}
                          className={`group border-b border-[var(--border)] hover:bg-[var(--surface-2)]/60 cursor-pointer transition-colors ${
                            selecionada?.TRANSACAO === t.TRANSACAO
                              ? "bg-[var(--accent-soft)]"
                              : ""
                          }`}
                        >
                          <Td className="font-mono font-medium text-[var(--text)]">
                            #{t.TRANSACAO}
                          </Td>
                          <Td>
                            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm min-w-[18rem]">
                              <span className="font-medium text-left">
                                {t.ORIGEM}
                              </span>
                              <IconArrowRight
                                size={14}
                                className="text-[var(--text-muted)]"
                              />
                              <span className="font-medium text-left">
                                {t.DESTINO}
                              </span>
                            </div>
                          </Td>
                          <Td className="text-[var(--text-muted)]">
                            {fmtDate(t.DATA_SOLICITACAO)}
                          </Td>
                          <Td className="truncate max-w-48">
                            {t.SOLICITANTE ?? "—"}
                          </Td>
                          <Td>
                            <StatusPill cod={t.POSICAO_COD} />
                          </Td>
                          <Td className="text-[var(--text-muted)] text-sm">
                            {fmtDate(t.DATA_ATUALIZACAO)}
                          </Td>
                          <Td className="truncate max-w-48 text-sm">
                            {t.FUNC_ATUALIZACAO ?? "—"}
                          </Td>
                        </tr>
                      ))}
                  {!loading && !filtradas.length && (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-12 text-center text-[var(--text-muted)] text-sm"
                      >
                        Nenhuma transferência encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filtradas.length > 0 && (
              <Pagination
                pagina={paginaAtual}
                totalPaginas={totalPaginas}
                total={filtradas.length}
                tamanho={TAMANHO_PAGINA}
                onChange={setPagina}
              />
            )}
          </Card>

        </main>
      </div>

      {/* Itens search modal */}
      {itensSearchModalOpen && (
        <>
          <div
            onClick={() => setItensSearchModalOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 anim-fade"
          />
          <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-12 pointer-events-none">
            <div className="relative w-full max-w-5xl max-h-[80vh] rounded-2xl glass shadow-2xl flex flex-col anim-fade pointer-events-auto">
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3">
                <div className="size-10 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                  <IconLayers size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                    Busca por item
                  </div>
                  <div className="text-lg font-semibold">
                    CODPROD{" "}
                    <span className="font-mono text-[var(--accent)]">
                      {codprodQuery}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    {itensSearchLoading
                      ? "Carregando…"
                      : `${itensSearch?.length ?? 0} ocorrência${(itensSearch?.length ?? 0) === 1 ? "" : "s"}`}
                  </div>
                </div>
                <button
                  onClick={() => setItensSearchModalOpen(false)}
                  className="size-8 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-muted)]"
                  aria-label="Fechar"
                >
                  <IconX size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {itensSearchLoading ? (
                  <SkeletonList rows={6} />
                ) : itensSearch?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
                        <tr>
                          <Th>CodProd</Th>
                          <Th>Produto</Th>
                          <Th>Transação</Th>
                          <Th className="!text-center">Rota</Th>
                          <Th>Data</Th>
                          <Th className="text-right">Coletada / Qtde</Th>
                          <Th>Status</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {itensSearch.map((r) => {
                          const transf = transfs.find(
                            (t) => t.TRANSACAO === r.TRANSACAO,
                          );
                          return (
                            <tr
                              key={`${r.TRANSACAO}-${r.CODPROD}`}
                              onClick={() => {
                                if (transf) {
                                  setSelecionada(transf);
                                  setItensSearchModalOpen(false);
                                }
                              }}
                              className={`border-b border-[var(--border)] hover:bg-[var(--surface-2)]/60 ${
                                transf ? "cursor-pointer" : ""
                              }`}
                            >
                              <Td className="font-mono">{r.CODPROD}</Td>
                              <Td className="truncate max-w-64">
                                {r.NOME_PRODUTO ?? "—"}
                              </Td>
                              <Td className="font-mono">#{r.TRANSACAO}</Td>
                              <Td>
                                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 min-w-[18rem]">
                                  <span className="font-medium text-left">
                                    {r.ORIGEM}
                                  </span>
                                  <IconArrowRight
                                    size={14}
                                    className="text-[var(--text-muted)]"
                                  />
                                  <span className="font-medium text-left">
                                    {r.DESTINO}
                                  </span>
                                </div>
                              </Td>
                              <Td className="text-[var(--text-muted)]">
                                {fmtDate(r.DATA_SOLICITACAO)}
                              </Td>
                              <Td className="text-right tabular-nums">
                                {r.QTCOLETADA ?? 0}{" "}
                                <span className="text-[var(--text-muted)]">
                                  / {r.QUANTIDADE}
                                </span>
                              </Td>
                              <Td>
                                <StatusPill cod={r.TRANSF_POSICAO} />
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-[var(--text-muted)] flex flex-col items-center gap-2">
                    <IconLayers size={28} className="opacity-40" />
                    Nenhum item encontrado.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Etiquetas modal */}
      {etiquetasModalOpen && (
        <>
          <div
            onClick={() => setEtiquetasModalOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 anim-fade"
          />
          <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-12 pointer-events-none">
            <div className="relative w-full max-w-4xl max-h-[80vh] rounded-2xl glass shadow-2xl flex flex-col anim-fade pointer-events-auto">
              <div className="px-5 py-4 border-b border-[var(--border)] flex items-center gap-3">
                <div className="size-10 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                  <IconBarcode size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                    Resultado da busca
                  </div>
                  <div className="text-lg font-semibold">
                    {etiquetaQuery ? (
                      <>
                        Etiquetas para{" "}
                        <span className="font-mono text-[var(--accent)]">
                          {etiquetaQuery}
                        </span>
                      </>
                    ) : (
                      "Últimas etiquetas"
                    )}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    {etiquetasLoading
                      ? "Carregando…"
                      : `${etiquetas?.length ?? 0} resultado${(etiquetas?.length ?? 0) === 1 ? "" : "s"}`}
                  </div>
                </div>
                <button
                  onClick={() => setEtiquetasModalOpen(false)}
                  className="size-8 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-muted)]"
                  aria-label="Fechar"
                >
                  <IconX size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {etiquetasLoading ? (
                  <SkeletonList rows={6} />
                ) : etiquetas?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs uppercase tracking-wider text-[var(--text-muted)] border-b border-[var(--border)]">
                        <tr>
                          <Th>CodBarras</Th>
                          <Th>Transação</Th>
                          <Th className="!text-center">Rota</Th>
                          <Th>CodProd</Th>
                          <Th className="text-right">Qtde</Th>
                          <Th>Saída</Th>
                          <Th>Entrada</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {etiquetas.map((e) => (
                          <tr
                            key={`${e.TRANSACAO}-${e.CODBARRAS}`}
                            className="border-b border-[var(--border)] hover:bg-[var(--surface-2)]/60"
                          >
                            <Td className="font-mono text-xs">
                              {String(e.CODBARRAS)}
                            </Td>
                            <Td className="font-mono">#{e.TRANSACAO}</Td>
                            <Td className="text-xs">
                              {e.FILIALORIG} → {e.FILIALDEST}
                            </Td>
                            <Td className="font-mono">{e.CODPROD}</Td>
                            <Td className="text-right tabular-nums">
                              {e.QUANTIDADE}
                            </Td>
                            <Td>
                              <EtapaPill
                                label="Saída"
                                ok={!!e.DATACONFSAI}
                                date={e.DATACONFSAI}
                              />
                            </Td>
                            <Td>
                              <EtapaPill
                                label="Entrada"
                                ok={!!e.DATACONFENT}
                                date={e.DATACONFENT}
                              />
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-[var(--text-muted)] flex flex-col items-center gap-2">
                    <IconBarcode size={28} className="opacity-40" />
                    Nenhuma etiqueta encontrada.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Drawer */}
      {selecionada && (
        <>
          <div
            onClick={() => setSelecionada(null)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 anim-fade"
          />
          <aside className="fixed right-0 top-0 h-screen w-full md:w-[640px] glass border-l border-[var(--border)] z-40 shadow-2xl anim-slide flex flex-col">
            <div className="px-5 py-4 border-b border-[var(--border)] flex items-start gap-3">
              <div className="size-10 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                <IconTruck size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  Transação #{selecionada.TRANSACAO}
                </div>
                <div className="text-lg font-semibold flex items-center gap-2 mt-0.5">
                  {selecionada.ORIGEM}
                  <IconArrowRight
                    size={16}
                    className="text-[var(--text-muted)]"
                  />
                  {selecionada.DESTINO}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <StatusPill cod={selecionada.POSICAO_COD} />
                  <span className="text-xs text-[var(--text-muted)]">
                    {fmtDate(selecionada.DATA_SOLICITACAO)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelecionada(null)}
                className="size-8 rounded-md hover:bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-muted)]"
                aria-label="Fechar"
              >
                <IconX size={16} />
              </button>
            </div>

            <div className="px-5 py-4 grid grid-cols-2 gap-3 border-b border-[var(--border)] text-sm">
              <Field label="Solicitante" value={selecionada.SOLICITANTE} />
              <Field
                label="Última atualização"
                value={fmtDate(selecionada.DATA_ATUALIZACAO)}
              />
              <Field
                label="Atualizado por"
                value={selecionada.FUNC_ATUALIZACAO}
              />
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center justify-between">
                <span>Itens</span>
                {itens && (
                  <span className="text-[var(--text-muted)] normal-case">
                    {itens.length} produto{itens.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              {itensLoading ? (
                <SkeletonList rows={5} />
              ) : itens && itens.length ? (
                <div className="space-y-1.5">
                  {itens.map((i) => {
                    const key = `${i.TRANSACAO}-${i.CODPROD}`;
                    return (
                      <ItemRow
                        key={key}
                        item={i}
                        expanded={itemExpandido === i.CODPROD}
                        onClick={() => toggleItemEtiquetas(i)}
                        etiquetas={etiquetasItem[key]}
                        loading={etiquetasItemLoading.has(key)}
                      />
                    );
                  })}
                </div>
              ) : (
                <Empty msg="Sem itens." />
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

/* ---------- subcomponents ---------- */

function KpiCard({
  label,
  value,
  icon,
  accent,
  loading,
  active,
  onClick,
  hint,
  glow,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  loading?: boolean;
  active?: boolean;
  onClick?: () => void;
  hint?: string;
  glow: { hsl: string; colors: string[] };
}) {
  return (
    <BorderGlow
      onClick={onClick}
      backgroundColor="var(--surface-solid)"
      borderRadius={14}
      glowRadius={32}
      glowColor={glow.hsl}
      colors={glow.colors}
      coneSpread={25}
      edgeSensitivity={28}
      glowIntensity={active ? 1.4 : 1.0}
      animated={active}
      className={active ? "!border-[var(--accent)] ring-1 ring-[var(--accent)]/40" : ""}
    >
      <div className="p-4 w-full">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-wider text-[var(--text-muted)] font-medium">
            {label}
          </span>
          <div
            className={`size-7 rounded-md bg-gradient-to-br ${accent} text-white flex items-center justify-center shadow-sm`}
          >
            {icon}
          </div>
        </div>
        {loading ? (
          <div className="skeleton h-8 w-20" />
        ) : (
          <div className="text-3xl font-semibold tabular-nums tracking-tight">
            {value.toLocaleString("pt-BR")}
          </div>
        )}
        <div className="mt-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)] min-h-[14px]">
          {active ? "✓ filtro ativo" : hint ?? "clique p/ filtrar"}
        </div>
      </div>
    </BorderGlow>
  );
}

function Pagination({
  pagina,
  totalPaginas,
  total,
  tamanho,
  onChange,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  tamanho: number;
  onChange: (p: number) => void;
}) {
  const inicio = (pagina - 1) * tamanho + 1;
  const fim = Math.min(pagina * tamanho, total);
  const paginas = pageRange(pagina, totalPaginas);
  return (
    <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-[var(--border)] text-sm">
      <div className="text-[12px] text-[var(--text-muted)] tabular-nums">
        {inicio}–{fim} de {total}
      </div>
      <div className="flex items-center gap-1">
        <PageBtn
          disabled={pagina <= 1}
          onClick={() => onChange(pagina - 1)}
          label="‹"
        />
        {paginas.map((p, i) =>
          p === "…" ? (
            <span
              key={`gap-${i}`}
              className="px-2 text-[var(--text-muted)] select-none"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`min-w-8 h-8 px-2 rounded-md text-sm tabular-nums transition-colors ${
                p === pagina
                  ? "bg-[var(--accent)] text-white"
                  : "hover:bg-[var(--surface-2)]"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <PageBtn
          disabled={pagina >= totalPaginas}
          onClick={() => onChange(pagina + 1)}
          label="›"
        />
      </div>
    </div>
  );
}

function PageBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="min-w-8 h-8 px-2 rounded-md text-sm hover:bg-[var(--surface-2)] disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {label}
    </button>
  );
}

function pageRange(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = Array.from(set)
    .filter((n) => n >= 1 && n <= total)
    .sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push("…");
    out.push(sorted[i]);
  }
  return out;
}

function Card({
  title,
  subtitle,
  children,
  className = "",
  action,
  icon,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl glass p-4 md:p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          {icon && (
            <span className="size-7 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
              {icon}
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            {subtitle && (
              <p className="text-xs text-[var(--text-muted)] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`text-left font-medium px-3 py-2.5 ${className}`}>
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 ${className}`}>{children}</td>;
}

function StatusPill({ cod }: { cod: string }) {
  const cls = STATUS_BG[cod] ?? "bg-zinc-500/10 text-zinc-600 ring-zinc-500/20";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset whitespace-nowrap ${cls}`}
    >
      <span
        className="size-1.5 rounded-full shrink-0"
        style={{ background: STATUS_COLOR[cod] ?? "#64748b" }}
      />
      {STATUS_LABEL[cod] ?? cod}
    </span>
  );
}

function GerencialPill({ v }: { v: string | null }) {
  if (v === "S") {
    return (
      <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 ring-1 ring-inset ring-emerald-500/20">
        SIM
      </span>
    );
  }
  if (v === "N") {
    return (
      <span className="inline-flex px-1.5 py-0.5 rounded text-[11px] font-medium bg-zinc-500/10 text-zinc-500 ring-1 ring-inset ring-zinc-500/20">
        NÃO
      </span>
    );
  }
  return <span className="text-[var(--text-muted)]">—</span>;
}

function ConfirmPill({ v }: { v: string | null }) {
  if (v === "S") {
    return (
      <span className="text-emerald-600 dark:text-emerald-400 text-xs">✓</span>
    );
  }
  if (v === "N") {
    return <span className="text-rose-500 text-xs">✗</span>;
  }
  return <span className="text-[var(--text-muted)] text-xs">—</span>;
}

function SolicitanteBars({ rows }: { rows: KpiSolicitanteRow[] }) {
  const max = Math.max(...rows.map((r) => Number(r.TOTAL)), 1);
  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const pct = (Number(r.TOTAL) / max) * 100;
        return (
          <div
            key={r.SOLICITANTE}
            className="grid grid-cols-[24px_1fr_auto] gap-3 items-center text-sm"
          >
            <span className="text-xs text-[var(--text-muted)] tabular-nums w-5 text-right">
              {i + 1}
            </span>
            <div className="relative h-7 rounded-md bg-[var(--surface-2)] overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500/70 to-violet-500/70 transition-all"
                style={{ width: `${pct}%` }}
              />
              <div className="relative h-full px-2.5 flex items-center text-sm truncate">
                {r.SOLICITANTE}
              </div>
            </div>
            <span className="text-sm tabular-nums font-medium w-10 text-right">
              {r.TOTAL}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder,
  labelMap,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  labelMap?: Record<string, string>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none pl-3 pr-8 py-2 text-sm rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] outline-none hover:border-[var(--accent)]/50 focus:border-[var(--accent)] transition cursor-pointer bg-no-repeat bg-[length:14px] bg-[position:right_10px_center]"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%238892c4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
      }}
    >
      <option value="" className="bg-[var(--surface-solid)] text-[var(--text)]">
        {placeholder} · todos
      </option>
      {options.map((o) => (
        <option
          key={o}
          value={o}
          className="bg-[var(--surface-solid)] text-[var(--text)]"
        >
          {labelMap?.[o] ?? o}
        </option>
      ))}
    </select>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      <div className="text-sm mt-0.5">{value || "—"}</div>
    </div>
  );
}

function ItemRow({
  item,
  expanded,
  onClick,
  etiquetas,
  loading,
}: {
  item: Item;
  expanded: boolean;
  onClick: () => void;
  etiquetas: Etiqueta[] | undefined;
  loading: boolean;
}) {
  const pct = item.QUANTIDADE
    ? Math.min(100, ((item.QTCOLETADA ?? 0) / item.QUANTIDADE) * 100)
    : 0;
  return (
    <div
      className={`rounded-lg border bg-[var(--surface-2)] transition-colors overflow-hidden ${
        expanded
          ? "border-[var(--accent)]/60"
          : "border-[var(--border)] hover:border-[var(--accent)]/40"
      }`}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left p-3 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">
              {item.NOME_PRODUTO ?? `Produto ${item.CODPROD}`}
            </div>
            <div className="text-xs text-[var(--text-muted)] font-mono mt-0.5 flex items-center gap-2">
              <span>#{item.CODPROD}</span>
              <span className="text-[var(--accent)]">
                {expanded ? "▾ ocultar etiquetas" : "▸ ver etiquetas"}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-semibold tabular-nums">
              {item.QTCOLETADA ?? 0}
              <span className="text-[var(--text-muted)] font-normal">
                {" "}
                / {item.QUANTIDADE}
              </span>
            </div>
            {item.SUGESTAO != null && (
              <div className="text-[11px] text-[var(--text-muted)]">
                sugestão: {item.SUGESTAO}
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-[var(--surface)] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </button>
      {expanded && (
        <div className="border-t border-[var(--border)] px-3 py-3 bg-[var(--surface)]/40 anim-fade">
          {loading ? (
            <SkeletonList rows={2} />
          ) : etiquetas && etiquetas.length ? (
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2 flex items-center justify-between">
                <span>Etiquetas</span>
                <span>
                  {etiquetas.length} unidade{etiquetas.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {etiquetas.map((e) => (
                  <EtiquetaCompact
                    key={`${e.TRANSACAO}-${e.CODBARRAS}`}
                    e={e}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--text-muted)] py-2">
              Nenhuma etiqueta cadastrada.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function EtiquetaCompact({ e }: { e: Etiqueta }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface-solid)]/60 px-3 py-2.5 text-sm flex items-center gap-4 flex-wrap">
      <div className="font-mono text-[var(--text)] truncate flex-1 min-w-32 font-medium">
        {String(e.CODBARRAS)}
      </div>
      <div className="text-sm text-[var(--text-muted)] font-mono">
        CodProd{" "}
        <span className="text-[var(--text)] font-medium">{e.CODPROD}</span>
      </div>
      <div className="text-sm text-[var(--text-muted)]">
        Qtde{" "}
        <span className="text-[var(--text)] font-medium tabular-nums">
          {e.QUANTIDADE}
        </span>
      </div>
      <div className="text-sm text-[var(--text-muted)] hidden sm:block">
        <span className="text-[var(--text)] font-medium">{e.FILIALORIG}</span>{" "}
        →{" "}
        <span className="text-[var(--text)] font-medium">{e.FILIALDEST}</span>
      </div>
      <EtapaPill label="Saída" ok={!!e.DATACONFSAI} date={e.DATACONFSAI} />
      <EtapaPill label="Entrada" ok={!!e.DATACONFENT} date={e.DATACONFENT} />
    </div>
  );
}

function EtapaPill({
  label,
  ok,
  date,
}: {
  label: string;
  ok: boolean;
  date: string | null;
}) {
  return (
    <span
      title={date ? new Date(date).toLocaleString("pt-BR") : "pendente"}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ring-1 ring-inset ${
        ok
          ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
          : "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-zinc-500"}`}
      />
      {label}
    </span>
  );
}

function Empty({ msg = "Sem dados." }: { msg?: string }) {
  return <p className="text-sm text-[var(--text-muted)] py-4">{msg}</p>;
}

function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton h-7 w-full" />
      ))}
    </div>
  );
}

function SkeletonBlock({ height = 120 }: { height?: number }) {
  return <div className="skeleton w-full" style={{ height }} />;
}
