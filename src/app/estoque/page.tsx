"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  EstoqueProdutoRow,
  EstoqueCidadeRow,
  EtiquetaEstoqueRow,
} from "@/lib/estoque";
import {
  IconLayers,
  IconSearch,
  IconRefresh,
  IconX,
  IconFilter,
  IconBarcode,
  IconArrowRight,
  IconActivity,
  IconChart,
} from "@/components/icons";
import BorderGlow from "@/components/BorderGlow";
import { Donut } from "@/components/Donut";

const nf = (n: number, dec = 0) =>
  (n ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

// "DD/MM/YYYY" -> dias desde a data (null se inválida)
function diasDesde(br: string | null | undefined): number | null {
  if (!br) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim());
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (Number.isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function fmtDias(d: number | null): string {
  if (d == null) return "—";
  if (d === 0) return "hoje";
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.floor(d / 30)}m`;
  return `${(d / 365).toFixed(1)}a`;
}

// Ordem + metadados das faixas de cobertura (espelha mesesClass)
const STATUS_ESTOQUE = [
  { label: "Ruptura", color: "#f43f5e", glow: { hsl: "350 89 60", colors: ["#fb7185", "#f43f5e", "#fda4af"] }, accent: "from-rose-500 to-rose-700" },
  { label: "Baixo", color: "#f59e0b", glow: { hsl: "38 92 55", colors: ["#fbbf24", "#f59e0b", "#fde68a"] }, accent: "from-amber-500 to-amber-700" },
  { label: "Saudável", color: "#10b981", glow: { hsl: "160 84 45", colors: ["#34d399", "#10b981", "#6ee7b7"] }, accent: "from-emerald-500 to-emerald-700" },
  { label: "Alto", color: "#0ea5e9", glow: { hsl: "199 89 55", colors: ["#38bdf8", "#0ea5e9", "#7dd3fc"] }, accent: "from-sky-500 to-sky-700" },
  { label: "Sem giro", color: "#8b5cf6", glow: { hsl: "262 83 60", colors: ["#a78bfa", "#8b5cf6", "#c4b5fd"] }, accent: "from-violet-500 to-violet-700" },
] as const;

const GLOW_TOTAL = { hsl: "240 5 60", colors: ["#a1a1aa", "#d4d4d8", "#71717a"] };

// Classificação de cobertura (meses de estoque)
function mesesClass(m: number) {
  if (m <= 0) return { label: "Ruptura", cls: "text-rose-300 bg-rose-500/15 border-rose-500/30" };
  if (m >= 15) return { label: "Sem giro", cls: "text-violet-300 bg-violet-500/15 border-violet-500/30" };
  if (m <= 2) return { label: "Baixo", cls: "text-amber-300 bg-amber-500/15 border-amber-500/30" };
  if (m <= 6) return { label: "Saudável", cls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" };
  return { label: "Alto", cls: "text-sky-300 bg-sky-500/15 border-sky-500/30" };
}

// "DD/MM/YYYY" -> número comparável AAAAMMDD (null = 0)
function dataKey(s: string | null): number {
  if (!s) return 0;
  const p = s.split("/");
  if (p.length !== 3) return 0;
  return Number(p[2] + p[1] + p[0]) || 0;
}

// Ordenação da lista
type SortColKey = "CODPROD" | "ESTOQ_ATUAL" | "VENDA_MEDIA";
type SortCol = SortColKey | null;

function SortTh({
  label,
  col,
  sortCol,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string;
  col: SortColKey;
  sortCol: SortCol;
  sortDir: "asc" | "desc";
  onSort: (c: SortColKey) => void;
  align?: "left" | "right";
}) {
  const active = sortCol === col;
  return (
    <th className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        onClick={() => onSort(col)}
        className={`inline-flex items-center gap-1 hover:text-[var(--text)] transition-colors ${
          align === "right" ? "flex-row-reverse" : ""
        } ${active ? "text-[var(--text)]" : ""}`}
      >
        {label}
        <span className="text-[9px] leading-none opacity-70">
          {active ? (sortDir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
    </th>
  );
}

// Filtro de status (popover no cabeçalho da coluna)
const STATUSES = [
  { label: "Ruptura", m: -1 },
  { label: "Baixo", m: 1 },
  { label: "Saudável", m: 4 },
  { label: "Alto", m: 10 },
  { label: "Sem giro", m: 20 },
];

function StatusFilter({
  sel,
  onChange,
}: {
  sel: Set<string>;
  onChange: (s: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left });
    }
    setOpen((o) => !o);
  };
  const flip = (label: string) => {
    const next = new Set(sel);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    onChange(next);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        className={`inline-flex items-center gap-1 hover:text-[var(--text)] transition-colors ${
          sel.size ? "text-[var(--accent)]" : ""
        }`}
      >
        Status
        <IconFilter size={12} />
        {sel.size > 0 && <span className="text-[10px] tabular-nums">({sel.size})</span>}
      </button>
      {open &&
        pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-50" onClick={() => setOpen(false)} />
            <div
              className="fixed z-50 glass rounded-lg border border-[var(--border)] shadow-xl p-1.5 min-w-[190px] text-[var(--text)]"
              style={{ top: pos.top, left: pos.left }}
            >
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  Mostrar status
                </span>
                {sel.size > 0 && (
                  <button
                    onClick={() => onChange(new Set())}
                    className="text-[11px] text-[var(--accent)] hover:opacity-80"
                  >
                    Limpar
                  </button>
                )}
              </div>
              {STATUSES.map((s) => {
                const c = mesesClass(s.m);
                const on = sel.has(s.label);
                return (
                  <button
                    key={s.label}
                    onClick={() => flip(s.label)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[var(--surface-2)] text-sm"
                  >
                    <span
                      className={`size-3.5 rounded border flex items-center justify-center shrink-0 ${
                        on ? "bg-[var(--accent)] border-[var(--accent)]" : "border-[var(--border)]"
                      }`}
                    >
                      {on && <span className="text-[10px] leading-none text-white">✓</span>}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[11px] border ${c.cls}`}>
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
  active,
  onClick,
  hint,
  glow,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  active?: boolean;
  onClick?: () => void;
  hint?: string;
  glow: { hsl: string; colors: readonly string[] };
}) {
  return (
    <BorderGlow
      onClick={onClick}
      backgroundColor="var(--surface-solid)"
      borderRadius={14}
      glowRadius={32}
      glowColor={glow.hsl}
      colors={glow.colors as string[]}
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
        <div className="text-3xl font-semibold tabular-nums tracking-tight">{value}</div>
        <div className="mt-1 text-[11px] uppercase tracking-wider text-[var(--text-muted)] min-h-[14px]">
          {active ? "✓ filtro ativo" : hint ?? "clique p/ filtrar"}
        </div>
      </div>
    </BorderGlow>
  );
}

function ResumoStat({
  label,
  value,
  unit,
  sub,
  accent,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`size-2 rounded-full bg-gradient-to-br ${accent}`} />
        <span className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] truncate">
          {label}
        </span>
      </div>
      <div className="text-xl font-semibold tabular-nums tracking-tight">
        {value}
        {unit && <span className="text-sm font-normal text-[var(--text-muted)]"> {unit}</span>}
      </div>
      {sub && <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{sub}</div>}
    </div>
  );
}

export default function EstoquePage() {
  const [produtos, setProdutos] = useState<EstoqueProdutoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);

  // filtros da lista (cidade NÃO é filtro aqui — é dimensão de drill no detalhe)
  const [busca, setBusca] = useState("");

  // ordenação + filtro de status
  const [sortCol, setSortCol] = useState<SortCol>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusSel, setStatusSel] = useState<Set<string>>(() => new Set());

  const toggleSort = (col: SortColKey) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  // paginação
  const [pagina, setPagina] = useState(1);
  const TAMANHO_PAGINA = 25;

  // detalhe
  const [sel, setSel] = useState<EstoqueProdutoRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch(`/api/estoque`, { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Erro ao carregar");
      setProdutos(data.produtos ?? []);
      setLastLoaded(new Date());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos.filter((p) => {
      if (
        q &&
        !(
          String(p.CODPROD).includes(q) ||
          (p.DESCRICAO ?? "").toLowerCase().includes(q)
        )
      )
        return false;
      if (statusSel.size && !statusSel.has(mesesClass(p.MESES_ESTQ).label))
        return false;
      return true;
    });
  }, [produtos, busca, statusSel]);

  const ordenados = useMemo(() => {
    if (!sortCol) return filtrados;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtrados].sort(
      (a, b) => ((a[sortCol] ?? 0) - (b[sortCol] ?? 0)) * dir,
    );
  }, [filtrados, sortCol, sortDir]);

  useEffect(() => {
    setPagina(1);
  }, [busca, statusSel]);

  const totalPaginas = Math.max(1, Math.ceil(ordenados.length / TAMANHO_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const paginados = useMemo(
    () =>
      ordenados.slice(
        (paginaAtual - 1) * TAMANHO_PAGINA,
        paginaAtual * TAMANHO_PAGINA,
      ),
    [ordenados, paginaAtual],
  );

  const counts = useMemo(() => {
    const m: Record<string, number> = {
      Ruptura: 0,
      Baixo: 0,
      Saudável: 0,
      Alto: 0,
      "Sem giro": 0,
    };
    for (const p of produtos) {
      const l = mesesClass(p.MESES_ESTQ).label;
      m[l] = (m[l] ?? 0) + 1;
    }
    return m;
  }, [produtos]);

  const toggleStatus = (label: string) =>
    setStatusSel((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });

  const estoqueTotal = useMemo(
    () => produtos.reduce((s, p) => s + (p.ESTOQ_ATUAL || 0), 0),
    [produtos],
  );

  // Ruptura: meses <= 0, priorizado por venda média (maior giro = mais urgente)
  const rupturas = useMemo(
    () =>
      produtos
        .filter((p) => p.MESES_ESTQ <= 0)
        .sort((a, b) => b.VENDA_MEDIA - a.VENDA_MEDIA),
    [produtos],
  );

  const distData = useMemo(
    () =>
      STATUS_ESTOQUE.map((s) => ({
        key: s.label,
        label: s.label,
        value: counts[s.label] ?? 0,
        color: s.color,
      })).filter((d) => d.value > 0),
    [counts],
  );

  return (
    <div className="min-h-screen text-[var(--text)]">
      {/* Topbar */}
      <header className="border-b border-[var(--border)] glass sticky top-[49px] z-20">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-3.5 flex flex-wrap items-center gap-3">
          <div className="size-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
            <IconLayers size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base md:text-lg font-semibold tracking-tight">
              Análise de Estoque
            </h1>
            <p className="text-xs text-[var(--text-muted)]">
              {lastLoaded
                ? `Atualizado às ${lastLoaded.toLocaleTimeString("pt-BR")} · ${nf(filtrados.length)} produtos`
                : "Carregando…"}
            </p>
          </div>

          {/* Busca local */}
          <div className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--text-muted)] w-72 focus-within:border-[var(--accent)] transition">
            <IconSearch size={15} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar (código/descrição)…"
              className="bg-transparent flex-1 outline-none text-[var(--text)] placeholder:text-[var(--text-muted)]"
            />
            {busca && (
              <button
                onClick={() => setBusca("")}
                className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text)]"
              >
                <IconX size={14} />
              </button>
            )}
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-[var(--accent)] text-white hover:opacity-90 disabled:opacity-50 transition"
          >
            <IconRefresh size={15} />
            <span className="hidden sm:inline">{loading ? "Carregando…" : "Recarregar"}</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 space-y-6 anim-fade">
        {err && (
          <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-300 flex items-start gap-3">
            <IconX size={16} />
            <div className="flex-1">{err}</div>
            <button onClick={() => setErr(null)} className="text-rose-400 hover:text-rose-200">
              <IconX size={14} />
            </button>
          </div>
        )}

        {/* KPIs (clique = filtro) */}
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          <KpiCard
            label="Produtos"
            value={nf(produtos.length)}
            icon={<IconLayers size={16} />}
            accent="from-zinc-600 to-zinc-800"
            glow={GLOW_TOTAL}
            active={statusSel.size === 0}
            onClick={() => setStatusSel(new Set())}
            hint={statusSel.size === 0 ? "todos" : "limpar filtros"}
          />
          {STATUS_ESTOQUE.map((s, i) => (
            <KpiCard
              key={s.label}
              label={s.label}
              value={nf(counts[s.label] ?? 0)}
              icon={
                [<IconActivity key="a" size={16} />, <IconFilter key="b" size={16} />, <IconChart key="c" size={16} />, <IconChart key="d" size={16} />, <IconBarcode key="e" size={16} />][i]
              }
              accent={s.accent}
              glow={s.glow}
              active={statusSel.has(s.label)}
              onClick={() => toggleStatus(s.label)}
            />
          ))}
        </section>

        {/* Distribuição + resumo */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="glass rounded-xl p-4 md:p-5 lg:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="size-7 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                <IconChart size={15} />
              </span>
              <div>
                <h2 className="text-sm font-semibold tracking-tight">Distribuição por cobertura</h2>
                <p className="text-xs text-[var(--text-muted)]">Produtos por faixa de meses</p>
              </div>
            </div>
            {distData.length ? (
              <Donut data={distData} centerValue={nf(produtos.length)} centerLabel="produtos" />
            ) : (
              <div className="skeleton h-[180px] w-full" />
            )}
          </div>

          <div className="glass rounded-xl p-4 md:p-5 lg:col-span-3 flex flex-col">
            <div className="flex items-center gap-2.5 mb-4">
              <span className="size-7 rounded-md bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
                <IconLayers size={15} />
              </span>
              <div>
                <h2 className="text-sm font-semibold tracking-tight">Resumo</h2>
                <p className="text-xs text-[var(--text-muted)]">Visão geral do estoque</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 flex-1">
              <ResumoStat
                label="Estoque total"
                value={nf(estoqueTotal, 2)}
                unit="m"
                accent="from-indigo-500 to-violet-600"
              />
              <ResumoStat
                label="Produtos"
                value={nf(produtos.length)}
                accent="from-zinc-600 to-zinc-800"
              />
              <ResumoStat
                label="Em ruptura"
                value={nf(counts["Ruptura"] ?? 0)}
                sub="meses ≤ 0"
                accent="from-rose-500 to-rose-700"
              />
              <ResumoStat
                label="Baixo giro"
                value={nf(counts["Baixo"] ?? 0)}
                sub="≤ 2 meses"
                accent="from-amber-500 to-amber-700"
              />
              <ResumoStat
                label="Saudável"
                value={nf(counts["Saudável"] ?? 0)}
                sub="2–6 meses"
                accent="from-emerald-500 to-emerald-700"
              />
              <ResumoStat
                label="Sem giro"
                value={nf(counts["Sem giro"] ?? 0)}
                sub="≥ 15 meses"
                accent="from-violet-500 to-violet-700"
              />
            </div>
          </div>
        </section>

        {/* Alerta de ruptura */}
        {rupturas.length > 0 && (
          <section className="glass rounded-xl overflow-hidden border border-rose-500/30">
            <div className="px-4 md:px-5 py-3.5 flex items-center justify-between gap-3 border-b border-rose-500/20 bg-rose-500/5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="size-7 rounded-md bg-rose-500/15 text-rose-300 flex items-center justify-center shrink-0">
                  <IconActivity size={15} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold tracking-tight text-rose-200">
                    Ruptura — reposição prioritária
                  </h2>
                  <p className="text-xs text-rose-300/70">
                    {nf(rupturas.length)} produto{rupturas.length === 1 ? "" : "s"} sem cobertura · ordenado por venda média
                  </p>
                </div>
              </div>
              {rupturas.length > 6 && (
                <span className="text-[11px] text-rose-300/70 shrink-0">top 6</span>
              )}
            </div>
            <div className="divide-y divide-[var(--border)]">
              {rupturas.slice(0, 6).map((p) => (
                <button
                  key={p.CODPROD}
                  onClick={() => setSel(p)}
                  className="w-full px-4 md:px-5 py-2.5 flex items-center gap-3 text-left hover:bg-[var(--surface-2)] transition-colors"
                >
                  <span className="font-mono text-xs text-[var(--text-muted)] w-14 shrink-0">
                    {p.CODPROD}
                  </span>
                  <span className="flex-1 min-w-0 text-sm truncate">{p.DESCRICAO}</span>
                  <span className="text-[11px] text-[var(--text-muted)] tabular-nums shrink-0 hidden sm:block">
                    v. média <b className="text-[var(--text)]">{nf(p.VENDA_MEDIA)}</b>
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] border text-rose-300 bg-rose-500/15 border-rose-500/30 tabular-nums shrink-0">
                    {nf(p.ESTOQ_ATUAL, 2)} m
                  </span>
                  <IconArrowRight size={14} className="text-[var(--text-muted)] shrink-0" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Tabela principal */}
        <section className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
                  <SortTh label="Código" col="CODPROD" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <SortTh label="Estoque" col="ESTOQ_ATUAL" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <SortTh label="Venda média" col="VENDA_MEDIA" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <th className="px-4 py-3 font-medium text-right">Meses estq.</th>
                  <th className="px-4 py-3 font-medium">
                    <StatusFilter sel={statusSel} onChange={setStatusSel} />
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading && produtos.length === 0 &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-[var(--border)]">
                      <td colSpan={7} className="px-4 py-3">
                        <div className="skeleton h-5 w-full" />
                      </td>
                    </tr>
                  ))}
                {!loading && filtrados.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-[var(--text-muted)]">
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                )}
                {paginados.map((p) => {
                  const c = mesesClass(p.MESES_ESTQ);
                  return (
                    <tr
                      key={p.CODPROD}
                      onClick={() => setSel(p)}
                      className="border-b border-[var(--border)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5 font-mono text-[var(--text-muted)]">{p.CODPROD}</td>
                      <td className="px-4 py-2.5 max-w-[420px] truncate">{p.DESCRICAO}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{nf(p.ESTOQ_ATUAL)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{nf(p.VENDA_MEDIA)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold">
                        {nf(p.MESES_ESTQ, 1)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border ${c.cls}`}>
                          {c.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--text-muted)]">
                        <IconArrowRight size={15} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtrados.length > 0 && (
            <div className="px-4 pb-3">
              <Pagination
                pagina={paginaAtual}
                totalPaginas={totalPaginas}
                total={filtrados.length}
                tamanho={TAMANHO_PAGINA}
                onChange={setPagina}
              />
            </div>
          )}
        </section>
      </main>

      {sel && <ProdutoDetalhe produto={sel} onClose={() => setSel(null)} />}
    </div>
  );
}

// ============================================================================
// Paginação
// ============================================================================
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
        <PageBtn disabled={pagina <= 1} onClick={() => onChange(pagina - 1)} label="‹" />
        {paginas.map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-2 text-[var(--text-muted)] select-none">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`min-w-8 h-8 px-2 rounded-md text-sm tabular-nums transition-colors ${
                p === pagina ? "bg-[var(--accent)] text-white" : "hover:bg-[var(--surface-2)]"
              }`}
            >
              {p}
            </button>
          ),
        )}
        <PageBtn disabled={pagina >= totalPaginas} onClick={() => onChange(pagina + 1)} label="›" />
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

// ============================================================================
// Detalhe do produto — master-detail: Cidade › Lote › Etiqueta
// ============================================================================
type LoteGrupo = {
  lote: string;
  itens: EtiquetaEstoqueRow[];
  metros: number;
};

function ProdutoDetalhe({
  produto,
  onClose,
}: {
  produto: EstoqueProdutoRow;
  onClose: () => void;
}) {
  const cod = produto.CODPROD;

  const [cidades, setCidades] = useState<EstoqueCidadeRow[]>([]);
  const [etiquetas, setEtiquetas] = useState<EtiquetaEstoqueRow[]>([]);
  const [loadingCid, setLoadingCid] = useState(true);
  const [loadingEtq, setLoadingEtq] = useState(true);
  const [errCid, setErrCid] = useState<string | null>(null);
  const [errEtq, setErrEtq] = useState<string | null>(null);

  // "" = todas as cidades
  const [cidadeSel, setCidadeSel] = useState("");
  const [loteAberto, setLoteAberto] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [sugAberta, setSugAberta] = useState(true);

  const requestClose = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, 220);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  // Cidades: números de venda/meses por cidade (endpoint dedicado)
  useEffect(() => {
    setLoadingCid(true);
    setErrCid(null);
    fetch(`/api/estoque/cidades?codprod=${cod}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Erro ao carregar cidades");
        setCidades(d.cidades ?? []);
      })
      .catch((e) => setErrCid(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingCid(false));
  }, [cod]);

  // Etiquetas: TODAS de uma vez; drill por cidade/lote é client-side
  useEffect(() => {
    setLoadingEtq(true);
    setErrEtq(null);
    fetch(`/api/estoque/etiquetas?codprod=${cod}&lote=ALL`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Erro ao carregar etiquetas");
        setEtiquetas(d.etiquetas ?? []);
      })
      .catch((e) => setErrEtq(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoadingEtq(false));
  }, [cod]);

  // Trocar de cidade fecha o lote aberto (contexto muda)
  useEffect(() => {
    setLoteAberto(null);
  }, [cidadeSel]);

  // Etiquetas da cidade selecionada (ou todas), agrupadas por lote
  const lotes = useMemo<LoteGrupo[]>(() => {
    const src = cidadeSel
      ? etiquetas.filter((e) => (e.FILIAL ?? "").toUpperCase() === cidadeSel.toUpperCase())
      : etiquetas;
    const map = new Map<string, EtiquetaEstoqueRow[]>();
    for (const e of src) {
      const k = e.LOTEPRODUTO || "(sem lote)";
      const arr = map.get(k);
      if (arr) arr.push(e);
      else map.set(k, [e]);
    }
    return Array.from(map, ([lote, itens]) => ({
      lote,
      itens,
      metros: itens.reduce((s, i) => s + (i.METROS || 0), 0),
    })).sort((a, b) => b.metros - a.metros);
  }, [etiquetas, cidadeSel]);

  const totalMetros = lotes.reduce((s, l) => s + l.metros, 0);
  const totalEtq = lotes.reduce((s, l) => s + l.itens.length, 0);
  const status = mesesClass(produto.MESES_ESTQ);

  // Sugestão de transferência: mover excedente de cidades com sobra p/ cidades
  // em ruptura/baixo giro. Alvo = 2 meses de cobertura. Alocação gulosa.
  const sugestoes = useMemo(() => {
    const TARGET = 2;
    const pool = cidades
      .map((c) => ({
        cidade: c.CIDADE,
        left: (c.ESTOQ_ATUAL || 0) - (c.VENDA_MEDIA || 0) * TARGET,
        meses: c.MESES_ESTQ,
      }))
      .filter((c) => c.left > 0 && c.meses >= 6)
      .sort((a, b) => b.left - a.left);
    const destinos = cidades
      .map((c) => ({
        cidade: c.CIDADE,
        need: (c.VENDA_MEDIA || 0) * TARGET - (c.ESTOQ_ATUAL || 0),
        meses: c.MESES_ESTQ,
      }))
      .filter((c) => c.need > 0 && c.meses <= 2)
      .sort((a, b) => a.meses - b.meses);
    const out: { origem: string; destino: string; metros: number }[] = [];
    for (const d of destinos) {
      let need = d.need;
      for (const o of pool) {
        if (need <= 0.5) break;
        if (o.left <= 0.5 || o.cidade === d.cidade) continue;
        const mv = Math.min(o.left, need);
        out.push({ origem: o.cidade, destino: d.cidade, metros: mv });
        o.left -= mv;
        need -= mv;
      }
    }
    return out.sort((a, b) => b.metros - a.metros).slice(0, 8);
  }, [cidades]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm ${closing ? "anim-fade-out" : "anim-fade"}`}
        onClick={requestClose}
      />
      <aside className={`relative w-full max-w-5xl h-full glass border-l border-[var(--border)] flex flex-col ${closing ? "anim-slide-out" : "anim-slide"}`}>
        {/* Cabeçalho */}
        <div className="glass border-b border-[var(--border)] px-5 py-4 flex items-start gap-4 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-[var(--text-muted)] font-mono">#{cod}</div>
            <h2 className="text-base font-semibold leading-tight truncate">{produto.DESCRICAO}</h2>
            <div className="flex items-center gap-4 mt-2 text-[13px]">
              <span className="text-[var(--text-muted)]">
                Estoque <b className="text-[var(--text)] tabular-nums">{nf(produto.ESTOQ_ATUAL)}</b> m
              </span>
              <span className="text-[var(--text-muted)]">
                V. média <b className="text-[var(--text)] tabular-nums">{nf(produto.VENDA_MEDIA)}</b>
              </span>
              <span className="text-[var(--text-muted)]">
                Meses <b className="text-[var(--text)] tabular-nums">{nf(produto.MESES_ESTQ, 1)}</b>
              </span>
              <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] border ${status.cls}`}>
                {status.label}
              </span>
            </div>
          </div>
          <button onClick={requestClose} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1">
            <IconX size={18} />
          </button>
        </div>

        {/* Sugestão de transferência */}
        {sugestoes.length > 0 && (
          <div className="border-b border-[var(--border)] bg-[var(--accent-soft)]/40 shrink-0">
            <button
              onClick={() => setSugAberta((v) => !v)}
              className="w-full px-5 py-2.5 flex items-center gap-2.5 text-left hover:bg-[var(--accent-soft)]/60 transition-colors"
            >
              <span className="size-6 rounded-md bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center shrink-0">
                <IconArrowRight size={13} />
              </span>
              <span className="flex-1 min-w-0 text-sm font-medium">
                Sugestões de transferência
                <span className="text-[var(--text-muted)] font-normal">
                  {" "}· {sugestoes.length} movimento{sugestoes.length === 1 ? "" : "s"} p/ cobrir ruptura
                </span>
              </span>
              <span className={`text-[var(--text-muted)] transition-transform ${sugAberta ? "rotate-90" : ""}`}>
                <IconArrowRight size={14} />
              </span>
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                sugAberta ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="px-5 pb-3 flex flex-wrap gap-2">
                  {sugestoes.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-solid)]/60 px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{s.origem}</span>
                      <IconArrowRight size={13} className="text-[var(--accent)]" />
                      <span className="font-medium">{s.destino}</span>
                      <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] tabular-nums bg-[var(--accent)]/15 text-[var(--accent)] whitespace-nowrap">
                        {nf(s.metros, 1)} m
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Master-detail */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[300px_1fr] min-h-0">
          {/* Coluna: cidades */}
          <div className="border-b md:border-b-0 md:border-r border-[var(--border)] overflow-y-auto">
            <div className="px-4 py-2.5 text-[11px] uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2 sticky top-0 bg-[var(--surface-solid)] z-10">
              <IconChart size={13} /> Cidades
            </div>

            {loadingCid && (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton h-9 w-full" />
                ))}
              </div>
            )}
            {!loadingCid && errCid && (
              <div className="px-4 py-4 text-sm text-rose-300">{errCid}</div>
            )}

            {!loadingCid && !errCid && (
              <ul className="pb-2">
                <CidadeItem
                  nome="Todas as cidades"
                  estoque={produto.ESTOQ_ATUAL}
                  ativa={cidadeSel === ""}
                  onClick={() => setCidadeSel("")}
                />
                {cidades.map((c) => (
                  <CidadeItem
                    key={c.CIDADE}
                    nome={c.CIDADE}
                    estoque={c.ESTOQ_ATUAL}
                    meses={c.MESES_ESTQ}
                    ativa={cidadeSel.toUpperCase() === (c.CIDADE ?? "").toUpperCase()}
                    onClick={() => setCidadeSel(c.CIDADE ?? "")}
                  />
                ))}
                {cidades.length === 0 && (
                  <li className="px-4 py-4 text-sm text-[var(--text-muted)]">Sem dados por cidade.</li>
                )}
              </ul>
            )}
          </div>

          {/* Coluna: lotes da cidade selecionada */}
          <div className="overflow-y-auto">
            <div className="px-4 py-2.5 sticky top-0 bg-[var(--surface-solid)] z-10 border-b border-[var(--border)] flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-2">
                <IconBarcode size={13} /> Lotes {cidadeSel ? `· ${cidadeSel}` : "· nacional"}
              </div>
              <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
                {nf(lotes.length)} lotes · {nf(totalEtq)} etiq · {nf(totalMetros)} m
              </div>
            </div>

            <div key={cidadeSel} className="p-4 space-y-2 anim-fade">
              {loadingEtq &&
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="skeleton h-12 w-full" />
                ))}
              {!loadingEtq && errEtq && (
                <div className="px-1 py-4 text-sm text-rose-300">{errEtq}</div>
              )}
              {!loadingEtq && !errEtq && lotes.length === 0 && (
                <div className="px-1 py-10 text-center text-sm text-[var(--text-muted)]">
                  Nenhuma etiqueta {cidadeSel ? `em ${cidadeSel}` : ""}.
                </div>
              )}
              {!loadingEtq &&
                lotes.map((l) => (
                  <LoteCard
                    key={l.lote}
                    grupo={l}
                    aberto={loteAberto === l.lote}
                    mostrarCidade={!cidadeSel}
                    onToggle={() => setLoteAberto(loteAberto === l.lote ? null : l.lote)}
                  />
                ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function CidadeItem({
  nome,
  estoque,
  meses,
  ativa,
  onClick,
}: {
  nome: string;
  estoque: number;
  meses?: number;
  ativa: boolean;
  onClick: () => void;
}) {
  const k = meses !== undefined ? mesesClass(meses) : null;
  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full text-left px-4 py-2.5 flex items-center gap-2 border-l-2 transition-colors ${
          ativa
            ? "border-[var(--accent)] bg-[var(--accent-soft)]"
            : "border-transparent hover:bg-[var(--surface-2)]"
        }`}
      >
        <div className="flex-1 min-w-0 text-sm truncate">{nome}</div>
        <span className="px-1.5 py-0.5 rounded text-[10px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-muted)] tabular-nums whitespace-nowrap">
          {estoque.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} m
        </span>
        {k && (
          <span className={`px-1.5 py-0.5 rounded text-[10px] border tabular-nums whitespace-nowrap ${k.cls}`}>
            {nf(meses ?? 0, 1)} {(meses ?? 0) === 1 ? "mês" : "meses"}
          </span>
        )}
      </button>
    </li>
  );
}

type EtqSortKey = "CODBARID" | "METROS" | "DATA";

function LoteCard({
  grupo,
  aberto,
  mostrarCidade,
  onToggle,
}: {
  grupo: LoteGrupo;
  aberto: boolean;
  mostrarCidade: boolean;
  onToggle: () => void;
}) {
  const [sc, setSc] = useState<EtqSortKey | null>(null);
  const [sd, setSd] = useState<"asc" | "desc">("asc");

  const sort = (c: EtqSortKey) => {
    if (sc === c) setSd((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSc(c);
      setSd("asc");
    }
  };

  const itens = useMemo(() => {
    if (!sc) return grupo.itens;
    const dir = sd === "asc" ? 1 : -1;
    return [...grupo.itens].sort((a, b) => {
      const av = sc === "DATA" ? dataKey(a.DATA) : a[sc] ?? 0;
      const bv = sc === "DATA" ? dataKey(b.DATA) : b[sc] ?? 0;
      return av < bv ? -dir : av > bv ? dir : 0;
    });
  }, [grupo.itens, sc, sd]);

  const ind = (c: EtqSortKey) => (sc === c ? (sd === "asc" ? "▲" : "▼") : "↕");
  const thBtn = "inline-flex items-center gap-1 hover:text-[var(--text)] transition-colors";

  // Idade do estoque no lote = etiqueta mais antiga (maior nº de dias)
  const idade = useMemo(() => {
    const ds = grupo.itens
      .map((i) => diasDesde(i.DATA))
      .filter((x): x is number => x != null);
    return ds.length ? Math.max(...ds) : null;
  }, [grupo.itens]);
  const idadeCls =
    idade == null
      ? "text-[var(--text-muted)] bg-[var(--surface-2)] border-[var(--border)]"
      : idade >= 180
        ? "text-rose-300 bg-rose-500/15 border-rose-500/30"
        : idade >= 90
          ? "text-amber-300 bg-amber-500/15 border-amber-500/30"
          : "text-[var(--text-muted)] bg-[var(--surface-2)] border-[var(--border)]";

  return (
    <div className="glass rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-3.5 py-3 flex items-center gap-3 hover:bg-[var(--surface-2)] transition-colors"
      >
        <span
          className={`text-[var(--text-muted)] transition-transform ${aberto ? "rotate-90" : ""}`}
        >
          <IconArrowRight size={15} />
        </span>
        <div className="flex-1 min-w-0 text-left">
          <div className="text-sm font-medium font-mono truncate">{grupo.lote}</div>
          <div className="text-[11px] text-[var(--text-muted)]">
            {nf(grupo.itens.length)} etiqueta{grupo.itens.length === 1 ? "" : "s"}
          </div>
        </div>
        {idade != null && (
          <span
            title={`Etiqueta mais antiga: ${idade} dia${idade === 1 ? "" : "s"}`}
            className={`px-1.5 py-0.5 rounded text-[10px] border tabular-nums whitespace-nowrap shrink-0 ${idadeCls}`}
          >
            parado há {fmtDias(idade)}
          </span>
        )}
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold tabular-nums">{nf(grupo.metros, 2)} m</div>
        </div>
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          aberto ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
        <div className="border-t border-[var(--border)] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-[var(--text-muted)] border-b border-[var(--border)]">
                <th className="px-3 py-2 font-medium">
                  <button onClick={() => sort("CODBARID")} className={thBtn}>
                    Cód. barras <span className="text-[9px] opacity-70">{ind("CODBARID")}</span>
                  </button>
                </th>
                <th className="px-3 py-2 font-medium text-right">
                  <button onClick={() => sort("METROS")} className={`${thBtn} flex-row-reverse`}>
                    Metros <span className="text-[9px] opacity-70">{ind("METROS")}</span>
                  </button>
                </th>
                {mostrarCidade && <th className="px-3 py-2 font-medium">Cidade</th>}
                <th className="px-3 py-2 font-medium">
                  <button onClick={() => sort("DATA")} className={thBtn}>
                    Data <span className="text-[9px] opacity-70">{ind("DATA")}</span>
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((e) => (
                <tr key={e.CODBARID} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{e.CODBARID}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{nf(e.METROS, 2)}</td>
                  {mostrarCidade && <td className="px-3 py-2">{e.FILIAL}</td>}
                  <td className="px-3 py-2 text-[var(--text-muted)] whitespace-nowrap">
                    {e.DATA}
                    {diasDesde(e.DATA) != null && (
                      <span className="ml-1.5 text-[10px] opacity-70">
                        ({fmtDias(diasDesde(e.DATA))})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </div>
  );
}
