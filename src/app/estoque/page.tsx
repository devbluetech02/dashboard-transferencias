"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CIDADES } from "@/lib/estoque";
import type {
  EstoqueProdutoRow,
  EstoqueCidadeRow,
  EtiquetaEstoqueRow,
  SecaoOption,
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

const nf = (n: number, dec = 0) =>
  (n ?? 0).toLocaleString("pt-BR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  });

// Classificação de cobertura (meses de estoque)
function mesesClass(m: number) {
  if (m <= 0) return { label: "Ruptura", cls: "text-rose-300 bg-rose-500/15 border-rose-500/30" };
  if (m >= 15) return { label: "Sem giro", cls: "text-violet-300 bg-violet-500/15 border-violet-500/30" };
  if (m <= 2) return { label: "Baixo", cls: "text-amber-300 bg-amber-500/15 border-amber-500/30" };
  if (m <= 6) return { label: "Saudável", cls: "text-emerald-300 bg-emerald-500/15 border-emerald-500/30" };
  return { label: "Alto", cls: "text-sky-300 bg-sky-500/15 border-sky-500/30" };
}

function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="glass rounded-xl px-4 py-3.5 flex items-center gap-3">
      <div className="size-9 rounded-lg bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-[var(--text-muted)] truncate">{label}</div>
        <div className="text-lg font-semibold tracking-tight">{value}</div>
        {sub && <div className="text-[11px] text-[var(--text-muted)]">{sub}</div>}
      </div>
    </div>
  );
}

export default function EstoquePage() {
  const [produtos, setProdutos] = useState<EstoqueProdutoRow[]>([]);
  const [secoes, setSecoes] = useState<SecaoOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<Date | null>(null);

  // filtros
  const [cidade, setCidade] = useState("");
  const [secao, setSecao] = useState("");
  const [codprodFiltro, setCodprodFiltro] = useState("");
  const [busca, setBusca] = useState(""); // filtro client por descrição/código

  // drawer
  const [sel, setSel] = useState<EstoqueProdutoRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const qs = new URLSearchParams();
      if (cidade) qs.set("cidade", cidade);
      if (secao) qs.set("secao", secao);
      if (codprodFiltro) qs.set("codprod", codprodFiltro);
      const r = await fetch(`/api/estoque?${qs}`, { cache: "no-store" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Erro ao carregar");
      setProdutos(data.produtos ?? []);
      setLastLoaded(new Date());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [cidade, secao, codprodFiltro]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/estoque/secoes")
      .then((r) => r.json())
      .then((d) => setSecoes(d.secoes ?? []))
      .catch(() => {});
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return produtos;
    return produtos.filter(
      (p) =>
        String(p.CODPROD).includes(q) ||
        (p.DESCRICAO ?? "").toLowerCase().includes(q),
    );
  }, [produtos, busca]);

  const kpis = useMemo(() => {
    const estoqueTotal = produtos.reduce((s, p) => s + (p.ESTOQ_ATUAL || 0), 0);
    const ruptura = produtos.filter((p) => p.MESES_ESTQ <= 0).length;
    const semGiro = produtos.filter((p) => p.MESES_ESTQ >= 15).length;
    return { total: produtos.length, estoqueTotal, ruptura, semGiro };
  }, [produtos]);

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

          {/* Seção */}
          <select
            value={secao}
            onChange={(e) => setSecao(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--text)] focus:border-[var(--accent)] outline-none"
          >
            <option value="">Todas as seções</option>
            {secoes.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {/* Cidade */}
          <select
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--text)] focus:border-[var(--accent)] outline-none"
          >
            <option value="">Nacional (todas)</option>
            {CIDADES.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label}
              </option>
            ))}
          </select>

          {/* Busca local */}
          <div className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-sm w-56 focus-within:border-[var(--accent)] transition">
            <IconSearch size={15} />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar (código/descrição)…"
              className="bg-transparent flex-1 outline-none placeholder:text-[var(--text-muted)]"
            />
            {busca && (
              <button onClick={() => setBusca("")} className="text-[var(--text-muted)] hover:text-[var(--text)]">
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

        {/* KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Produtos" value={nf(kpis.total)} icon={<IconLayers size={18} />} />
          <KpiCard label="Estoque total (metros)" value={nf(kpis.estoqueTotal)} icon={<IconChart size={18} />} />
          <KpiCard label="Em ruptura" value={nf(kpis.ruptura)} sub="meses ≤ 0" icon={<IconActivity size={18} />} />
          <KpiCard label="Sem giro" value={nf(kpis.semGiro)} sub="≥ 15 meses" icon={<IconFilter size={18} />} />
        </section>

        {/* Tabela principal */}
        <section className="glass rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Produto</th>
                  <th className="px-4 py-3 font-medium text-right">Estoque</th>
                  <th className="px-4 py-3 font-medium text-right">Venda média</th>
                  <th className="px-4 py-3 font-medium text-right">Meses estq.</th>
                  <th className="px-4 py-3 font-medium">Status</th>
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
                {filtrados.map((p) => {
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
        </section>
      </main>

      {sel && (
        <ProdutoDrawer produto={sel} cidade={cidade} onClose={() => setSel(null)} />
      )}
    </div>
  );
}

// ============================================================================
// Drawer de detalhe do produto: cidades + lotes + etiquetas
// ============================================================================
function ProdutoDrawer({
  produto,
  cidade,
  onClose,
}: {
  produto: EstoqueProdutoRow;
  cidade: string;
  onClose: () => void;
}) {
  const [cidades, setCidades] = useState<EstoqueCidadeRow[]>([]);
  const [lotes, setLotes] = useState<string[]>([]);
  const [lote, setLote] = useState("ALL");
  const [etiquetas, setEtiquetas] = useState<EtiquetaEstoqueRow[]>([]);
  const [loadingCid, setLoadingCid] = useState(true);
  const [loadingEtq, setLoadingEtq] = useState(true);

  const cod = produto.CODPROD;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setLoadingCid(true);
    fetch(`/api/estoque/cidades?codprod=${cod}`)
      .then((r) => r.json())
      .then((d) => setCidades(d.cidades ?? []))
      .catch(() => {})
      .finally(() => setLoadingCid(false));

    const qs = new URLSearchParams({ codprod: String(cod) });
    if (cidade) qs.set("cidade", cidade);
    fetch(`/api/estoque/lotes?${qs}`)
      .then((r) => r.json())
      .then((d) => setLotes(d.lotes ?? []))
      .catch(() => {});
  }, [cod, cidade]);

  useEffect(() => {
    setLoadingEtq(true);
    const qs = new URLSearchParams({ codprod: String(cod), lote });
    if (cidade) qs.set("cidade", cidade);
    fetch(`/api/estoque/etiquetas?${qs}`)
      .then((r) => r.json())
      .then((d) => setEtiquetas(d.etiquetas ?? []))
      .catch(() => {})
      .finally(() => setLoadingEtq(false));
  }, [cod, lote, cidade]);

  const totalEtq = etiquetas.reduce((s, e) => s + (e.METROS || 0), 0);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="relative anim-slide w-full max-w-2xl h-full bg-[var(--surface-solid)] border-l border-[var(--border)] overflow-y-auto">
        <div className="sticky top-0 glass border-b border-[var(--border)] px-5 py-4 flex items-start gap-3 z-10">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-[var(--text-muted)] font-mono">#{cod}</div>
            <h2 className="text-base font-semibold leading-tight">{produto.DESCRICAO}</h2>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] p-1">
            <IconX size={18} />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Resumo */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass rounded-lg px-3 py-2.5">
              <div className="text-[11px] text-[var(--text-muted)]">Estoque</div>
              <div className="text-lg font-semibold tabular-nums">{nf(produto.ESTOQ_ATUAL)}</div>
            </div>
            <div className="glass rounded-lg px-3 py-2.5">
              <div className="text-[11px] text-[var(--text-muted)]">Venda média</div>
              <div className="text-lg font-semibold tabular-nums">{nf(produto.VENDA_MEDIA)}</div>
            </div>
            <div className="glass rounded-lg px-3 py-2.5">
              <div className="text-[11px] text-[var(--text-muted)]">Meses estq.</div>
              <div className="text-lg font-semibold tabular-nums">{nf(produto.MESES_ESTQ, 1)}</div>
            </div>
          </div>

          {/* Por cidade */}
          <section>
            <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
              <IconChart size={15} /> Estoque por cidade
            </h3>
            <div className="glass rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
                    <th className="px-3 py-2 font-medium">Cidade</th>
                    <th className="px-3 py-2 font-medium text-right">Estoque</th>
                    <th className="px-3 py-2 font-medium text-right">V. média</th>
                    <th className="px-3 py-2 font-medium text-right">Meses</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingCid && (
                    <tr><td colSpan={4} className="px-3 py-4"><div className="skeleton h-4 w-full" /></td></tr>
                  )}
                  {!loadingCid && cidades.length === 0 && (
                    <tr><td colSpan={4} className="px-3 py-4 text-center text-[var(--text-muted)]">Sem dados.</td></tr>
                  )}
                  {cidades.map((c) => {
                    const k = mesesClass(c.MESES_ESTQ);
                    return (
                      <tr key={c.CIDADE} className="border-b border-[var(--border)] last:border-0">
                        <td className="px-3 py-2">{c.CIDADE}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{nf(c.ESTOQ_ATUAL)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{nf(c.VENDA_MEDIA)}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] border ${k.cls}`}>
                            {nf(c.MESES_ESTQ, 1)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Etiquetas / lotes */}
          <section>
            <div className="flex items-center justify-between mb-2 gap-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <IconBarcode size={15} /> Etiquetas
                <span className="text-[var(--text-muted)] font-normal">
                  ({nf(etiquetas.length)} · {nf(totalEtq)} m)
                </span>
              </h3>
              <select
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                className="px-2.5 py-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-xs outline-none focus:border-[var(--accent)] max-w-[55%]"
              >
                <option value="ALL">Todos os lotes</option>
                {lotes.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div className="glass rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
                    <th className="px-3 py-2 font-medium">Cód. barras</th>
                    <th className="px-3 py-2 font-medium">Lote</th>
                    <th className="px-3 py-2 font-medium text-right">Metros</th>
                    <th className="px-3 py-2 font-medium">Filial</th>
                    <th className="px-3 py-2 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingEtq && (
                    <tr><td colSpan={5} className="px-3 py-4"><div className="skeleton h-4 w-full" /></td></tr>
                  )}
                  {!loadingEtq && etiquetas.length === 0 && (
                    <tr><td colSpan={5} className="px-3 py-4 text-center text-[var(--text-muted)]">Sem etiquetas.</td></tr>
                  )}
                  {etiquetas.map((e) => (
                    <tr key={e.CODBARID} className="border-b border-[var(--border)] last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">{e.CODBARID}</td>
                      <td className="px-3 py-2 font-mono text-xs text-[var(--text-muted)]">{e.LOTEPRODUTO}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{nf(e.METROS, 2)}</td>
                      <td className="px-3 py-2">{e.FILIAL}</td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">{e.DATA}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
