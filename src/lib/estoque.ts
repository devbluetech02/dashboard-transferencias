// ============================================================================
// Camada de dados — Análise de Estoque (CODEPTO 19)
// Lógica espelhada das queries do BI:
//   Estoque  = TAB_CODBARRAS, etiquetas não conferidas (CONFERIU='N')
//   Venda    = PCMOV+PCNFSAID+PCCLIENT, últimos 7 meses, cliente atividade '1'
//   Média    = CEIL(GREATEST(média 3m, média 7m))
//   Meses Estq = estoque / venda_média  (0 = ruptura, 15 = estoque sem giro)
// ============================================================================

export interface EstoqueProdutoRow {
  CODPROD: number;
  DESCRICAO: string;
  ESTOQ_ATUAL: number;
  VENDA_MEDIA: number;
  MESES_ESTQ: number;
}

export interface EstoqueCidadeRow {
  CIDADE: string;
  ESTOQ_ATUAL: number;
  VENDA_MEDIA: number;
  MESES_ESTQ: number;
}

export interface LoteRow {
  LOTEPRODUTO: string;
}

export interface EtiquetaEstoqueRow {
  CODBARID: number;
  CODPROD: number;
  DESCRICAO: string;
  LOTEPRODUTO: string;
  METROS: number;
  DATA: string | null;
  FILIAL: string | null;
}

export interface SecaoOption {
  value: number;
  label: string;
}

// Cidade -> códigos de filial. Filiais 6, 81 e 92 ficam fora globalmente.
export const CIDADES: { label: string; codigos: number[] }[] = [
  { label: "GOIANIA", codigos: [1, 5, 9, 11, 17, 18, 19, 51, 77, 99] },
  { label: "BRASILIA", codigos: [2, 15, 21, 61, 75] },
  { label: "RIO DE JANEIRO", codigos: [3, 16, 31, 76] },
  { label: "SAO PAULO", codigos: [10, 13, 62, 73] },
  { label: "CAMPINAS", codigos: [22] },
  { label: "UBERLANDIA", codigos: [4, 14, 41, 74] },
  { label: "BELO HORIZONTE", codigos: [7, 71] },
  { label: "CURITIBA", codigos: [12, 72] },
  { label: "PORTO ALEGRE", codigos: [8] },
  { label: "VALPARAISO DE GOIAS", codigos: [20, 82] },
];

const EXCL = "(6, 81, 92)";

function filiaisDaCidade(cidade?: string | null): number[] | null {
  if (!cidade) return null;
  const c = CIDADES.find((x) => x.label === cidade.toUpperCase());
  return c ? c.codigos : null;
}

// Saneamento: CODPROD só dígitos/letras; SECAO inteiro.
function safeCodprod(v?: string | null): string | null {
  if (!v) return null;
  const s = String(v).replace(/[^0-9A-Za-z]/g, "");
  return s || null;
}
function safeSecao(v?: string | null): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

// Vendas mensais por chave (CODPROD ou CODFILIAL).
// IMPORTANTE: o gateway interpreta `n.DTSAIDA` numa comparação/função como se
// fosse TABELA e nega acesso. Contorno: a coluna DTSAIDA aparece UMA única vez,
// como `n.DTSAIDA AS dt` na lista do SELECT mais interno; todo filtro de data e
// agrupamento usa o alias minúsculo `dt`, que o parser não confunde com tabela.
function vendasMensal(
  keyRaw: string, // ex: "m.CODPROD"
  keyOut: string, // ex: "CODPROD"
  extraWhere = "",
): string {
  return `
    SELECT ${keyOut}, TRUNC(dt, 'MM') AS mes_venda, SUM(qt) AS qtvenda
    FROM (
      SELECT ${keyRaw} AS ${keyOut},
             n.DTSAIDA AS dt,
             CASE WHEN n.CONDVENDA = 7 THEN m.QTCONT ELSE m.QT END AS qt
      FROM WINDOW.PCMOV m
      INNER JOIN WINDOW.PCNFSAID n ON m.NUMTRANSVENDA = n.NUMTRANSVENDA AND m.CODFILIAL = n.CODFILIAL
      INNER JOIN WINDOW.PCCLIENT c ON m.CODCLI = c.CODCLI
      WHERE n.DTCANCEL IS NULL
        AND m.CODOPER = 'S'
        AND c.CODATV1 = '1'
        AND NVL(n.TIPOVENDA, 'X') NOT IN ('SR', 'DF', 'VP')
        AND n.CODFISCAL NOT IN (522, 622, 722, 532, 632, 732)
        AND n.CONDVENDA NOT IN (4, 8, 10, 13, 20, 98, 99)
        AND m.CODFILIAL NOT IN ${EXCL}${extraWhere}
    )
    WHERE dt >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -7)
      AND dt <  TRUNC(SYSDATE, 'MM')
    GROUP BY ${keyOut}, TRUNC(dt, 'MM')`;
}

const MEDIA_EXPR = `
  CEIL(GREATEST(
    COALESCE(SUM(CASE WHEN mes_venda >= ADD_MONTHS(TRUNC(SYSDATE,'MM'),-3) THEN qtvenda ELSE 0 END),0) / 3,
    COALESCE(SUM(CASE WHEN mes_venda >= ADD_MONTHS(TRUNC(SYSDATE,'MM'),-7) THEN qtvenda ELSE 0 END),0) / 7
  ))`;

const MESES_CASE = (est: string, med: string) => `
  CASE
    WHEN ${est} <= 0 AND ${med} >  0 THEN 0
    WHEN ${est} >  0 AND ${med} <= 0 THEN 15
    WHEN ${est} =  0 AND ${med} =  0 THEN 0
    ELSE ROUND(${est} / NULLIF(${med}, 0), 2)
  END`;

// ----------------------------------------------------------------------------
// Painel principal: consolidado (nacional, ou filtrado por cidade/seção/produto)
// ----------------------------------------------------------------------------
export function qEstoqueConsolidado(opts: {
  cidade?: string | null;
  secao?: string | null;
  codprod?: string | null;
}): string {
  const fil = filiaisDaCidade(opts.cidade);
  const codprod = safeCodprod(opts.codprod);
  const secao = safeSecao(opts.secao);

  const cidEstq = fil ? ` AND CODFILIAL IN (${fil.join(",")})` : "";
  const cidVend = fil ? ` AND m.CODFILIAL IN (${fil.join(",")})` : "";
  const cpEstq = codprod ? ` AND CODPROD = '${codprod}'` : "";
  const cpVend = codprod ? ` AND m.CODPROD = '${codprod}'` : "";
  const cpProd = codprod ? ` AND p.CODPROD = '${codprod}'` : "";
  const secProd = secao !== null ? ` AND p.CODSEC = ${secao}` : "";

  // Sem WITH/CTE: o gateway trata nomes de CTE como tabelas e nega acesso.
  // Tudo via subqueries inline (derived tables), como em Q_LEAD_TIMES.
  return `
SELECT
  TO_NUMBER(p.CODPROD) AS CODPROD,
  p.DESCRICAO,
  COALESCE(e.total_estoque, 0) AS ESTOQ_ATUAL,
  COALESCE(v.media_final, 0)   AS VENDA_MEDIA,
  ${MESES_CASE("COALESCE(e.total_estoque,0)", "COALESCE(v.media_final,0)")} AS MESES_ESTQ
FROM WINDOW.PCPRODUT p
LEFT JOIN (
  SELECT CODPROD, SUM(QUANTIDADE) AS total_estoque
  FROM WINDOW.TAB_CODBARRAS
  WHERE CONFERIU = 'N'
    AND CODFILIAL NOT IN ${EXCL}
    AND TRUNC(DATA) <= TRUNC(SYSDATE)${cidEstq}${cpEstq}
  GROUP BY CODPROD
) e ON p.CODPROD = e.CODPROD
LEFT JOIN (
  SELECT CODPROD, ${MEDIA_EXPR} AS media_final
  FROM (${vendasMensal("m.CODPROD", "CODPROD", `${cidVend}${cpVend}`)}
  )
  GROUP BY CODPROD
) v ON p.CODPROD = v.CODPROD
WHERE p.CODEPTO = 19
  AND p.DESCRICAO NOT LIKE '*%'${secProd}${cpProd}
  AND (COALESCE(e.total_estoque,0) > 0 OR COALESCE(v.media_final,0) > 0)
ORDER BY MESES_ESTQ ASC, CODPROD ASC
`;
}

// ----------------------------------------------------------------------------
// Detalhamento por cidade (produto selecionado)
// ----------------------------------------------------------------------------
const CIDADE_CASE = `
  CASE
    WHEN fil.CODIGO IN (1,5,9,11,17,18,19,51,77,99) THEN 'GOIANIA'
    WHEN fil.CODIGO IN (2,15,21,61,75)              THEN 'BRASILIA'
    WHEN fil.CODIGO IN (3,16,31,76)                 THEN 'RIO DE JANEIRO'
    WHEN fil.CODIGO IN (10,13,62,73)                THEN 'SAO PAULO'
    WHEN fil.CODIGO = 22                            THEN 'CAMPINAS'
    WHEN fil.CODIGO IN (4,14,41,74)                 THEN 'UBERLANDIA'
    WHEN fil.CODIGO IN (7,71)                       THEN 'BELO HORIZONTE'
    WHEN fil.CODIGO IN (12,72)                      THEN 'CURITIBA'
    WHEN fil.CODIGO = 8                             THEN 'PORTO ALEGRE'
    WHEN fil.CODIGO IN (20,82)                      THEN 'VALPARAISO DE GOIAS'
    ELSE fil.CIDADE
  END`;

export function qEstoquePorCidade(codprodRaw: string): string {
  const codprod = safeCodprod(codprodRaw);
  const cp = codprod ? `'${codprod}'` : "NULL";
  // Sem CTE — subqueries inline.
  return `
SELECT CIDADE,
       SUM(te) AS ESTOQ_ATUAL,
       SUM(tv) AS VENDA_MEDIA,
       ${MESES_CASE("SUM(te)", "SUM(tv)")} AS MESES_ESTQ
FROM (
  SELECT ${CIDADE_CASE} AS CIDADE,
         COALESCE(e.total_estoque,0) AS te,
         COALESCE(v.media_final,0)   AS tv
  FROM WINDOW.PCFILIAL fil
  LEFT JOIN (
    SELECT b.CODFILIAL, SUM(b.QUANTIDADE) AS total_estoque
    FROM WINDOW.TAB_CODBARRAS b
    WHERE b.CONFERIU = 'N'
      AND b.CODFILIAL NOT IN ${EXCL}
      AND TRUNC(b.DATA) <= TRUNC(SYSDATE)
      AND b.CODPROD = ${cp}
    GROUP BY b.CODFILIAL
  ) e ON fil.CODIGO = e.CODFILIAL
  LEFT JOIN (
    SELECT CODFILIAL, ${MEDIA_EXPR} AS media_final
    FROM (${vendasMensal("m.CODFILIAL", "CODFILIAL", ` AND m.CODPROD = ${cp}`)}
    )
    GROUP BY CODFILIAL
  ) v ON fil.CODIGO = v.CODFILIAL
  WHERE fil.CODIGO NOT IN ${EXCL}
)
GROUP BY CIDADE
HAVING SUM(te) > 0 OR SUM(tv) > 0
ORDER BY MESES_ESTQ DESC NULLS LAST
`;
}

// ----------------------------------------------------------------------------
// Lotes distintos de um produto (com filtro opcional de cidade)
// ----------------------------------------------------------------------------
export function qLotes(codprodRaw: string, cidade?: string | null): string {
  const codprod = safeCodprod(codprodRaw);
  const cp = codprod ? `'${codprod}'` : "NULL";
  const fil = filiaisDaCidade(cidade);
  const cidFil = fil ? ` AND b.CODFILIAL IN (${fil.join(",")})` : "";
  return `
SELECT DISTINCT b.LOTEPRODUTO
FROM WINDOW.TAB_CODBARRAS b
WHERE b.CODPROD = ${cp}
  AND b.CONFERIU = 'N'
  AND b.CODFILIAL NOT IN ${EXCL}
  AND TRUNC(b.DATA) <= TRUNC(SYSDATE)${cidFil}
ORDER BY b.LOTEPRODUTO
`;
}

// ----------------------------------------------------------------------------
// Etiquetas (códigos de barras) de um produto — opcional lote/cidade
// ----------------------------------------------------------------------------
export function qEtiquetas(
  codprodRaw: string,
  lote?: string | null,
  cidade?: string | null,
): string {
  const codprod = safeCodprod(codprodRaw);
  const cp = codprod ? `'${codprod}'` : "NULL";
  const fil = filiaisDaCidade(cidade);
  const cidFil = fil ? ` AND b.CODFILIAL IN (${fil.join(",")})` : "";
  const loteSafe =
    lote && lote !== "ALL" ? ` AND b.LOTEPRODUTO = '${lote.replace(/'/g, "''")}'` : "";
  return `
SELECT
  b.CODBARID,
  b.CODPROD,
  p.DESCRICAO,
  b.LOTEPRODUTO,
  CAST(b.QUANTIDADE AS NUMBER) AS METROS,
  TO_CHAR(b.DATA, 'DD/MM/YYYY') AS DATA,
  f.CIDADE AS FILIAL
FROM WINDOW.TAB_CODBARRAS b
INNER JOIN WINDOW.PCPRODUT p ON b.CODPROD = p.CODPROD
LEFT  JOIN WINDOW.PCFILIAL f ON b.CODFILIAL = f.CODIGO
WHERE b.CONFERIU = 'N'
  AND b.CODFILIAL NOT IN ${EXCL}
  AND TRUNC(b.DATA) <= TRUNC(SYSDATE)
  AND b.CODPROD = ${cp}${loteSafe}${cidFil}
ORDER BY CAST(b.QUANTIDADE AS NUMBER) DESC, b.LOTEPRODUTO
FETCH FIRST 500 ROWS ONLY
`;
}

// ----------------------------------------------------------------------------
// Seletor de seção (CODEPTO 19)
// ----------------------------------------------------------------------------
export const Q_SECOES = `
SELECT s.CODSEC AS value, s.DESCRICAO AS label
FROM WINDOW.PCSECAO s
INNER JOIN WINDOW.PCPRODUT p ON s.CODSEC = p.CODSEC
WHERE p.CODEPTO = 19
GROUP BY s.CODSEC, s.DESCRICAO
HAVING COUNT(DISTINCT p.CODPROD) > 0
ORDER BY s.DESCRICAO
`;
