# Queries — Aba "Estoque"

Fonte: `src/lib/estoque.ts` (builders) + rotas em `src/app/api/estoque/*`.

## Regras de negócio (comuns)

- **Estoque** = `WINDOW.TAB_CODBARRAS`, etiquetas não conferidas (`CONFERIU = 'N'`), `TRUNC(DATA) <= TRUNC(SYSDATE)`.
- **Venda** = `PCMOV` + `PCNFSAID` + `PCCLIENT`, últimos 7 meses, `CODOPER='S'`, cliente `CODATV1='1'`, exclui `TIPOVENDA` SR/DF/VP, `CODFISCAL`/`CONDVENDA` proibidos, `DTCANCEL IS NULL`.
- **Média final** = `CEIL(GREATEST(média 3 meses, média 7 meses))`.
- **Meses de estoque** = `estoque / venda_média` → `0` = ruptura, `15` = estoque sem giro.
- **Produtos** = `PCPRODUT`, `CODEPTO = 19`, `DESCRICAO NOT LIKE '*%'`.
- **Filiais 6, 81, 92** ficam fora de tudo (`EXCL = (6, 81, 92)`).

> ⚠️ **Contorno do gateway:** o gateway interpreta `n.DTSAIDA` em comparação/função como se fosse *tabela* e nega acesso. Por isso `DTSAIDA` aparece **uma única vez** (`n.DTSAIDA AS dt` no SELECT mais interno); todo filtro de data e `GROUP BY` usa o alias minúsculo `dt`.
>
> ⚠️ **Sem CTE (`WITH`):** o gateway também trata nomes de CTE como tabelas. Tudo usa **subqueries inline** (derived tables).

---

## Tabelas usadas (precisam estar no allowlist da API key)

| Tabela | Uso |
|---|---|
| `WINDOW.PCPRODUT`     | produtos (já liberada) |
| `WINDOW.TAB_CODBARRAS`| estoque / etiquetas / lotes |
| `WINDOW.PCMOV`        | movimentação de venda |
| `WINDOW.PCNFSAID`     | notas de saída |
| `WINDOW.PCCLIENT`     | cliente (filtro `CODATV1`) |
| `WINDOW.PCFILIAL`     | painel por cidade |
| `WINDOW.PCSECAO`      | seletor de seção |

---

## 1. Consolidado de produtos — `GET /api/estoque`

`qEstoqueConsolidado({ cidade, secao, codprod })`

Filtros opcionais injetados:
- **cidade** → `AND CODFILIAL IN (...)` (estoque) e `AND m.CODFILIAL IN (...)` (vendas), via mapa cidade→filial.
- **secao** → `AND p.CODSEC = <n>`.
- **codprod** → `AND CODPROD = '<x>'` / `AND m.CODPROD = '<x>'` / `AND p.CODPROD = '<x>'`.

Versão **sem filtro** (nacional):

```sql
SELECT
  TO_NUMBER(p.CODPROD) AS CODPROD,
  p.DESCRICAO,
  COALESCE(e.total_estoque, 0) AS ESTOQ_ATUAL,
  COALESCE(v.media_final, 0)   AS VENDA_MEDIA,
  CASE
    WHEN COALESCE(e.total_estoque,0) <= 0 AND COALESCE(v.media_final,0) >  0 THEN 0
    WHEN COALESCE(e.total_estoque,0) >  0 AND COALESCE(v.media_final,0) <= 0 THEN 15
    WHEN COALESCE(e.total_estoque,0) =  0 AND COALESCE(v.media_final,0) =  0 THEN 0
    ELSE ROUND(COALESCE(e.total_estoque,0) / NULLIF(COALESCE(v.media_final,0), 0), 2)
  END AS MESES_ESTQ
FROM WINDOW.PCPRODUT p
LEFT JOIN (
  SELECT CODPROD, SUM(QUANTIDADE) AS total_estoque
  FROM WINDOW.TAB_CODBARRAS
  WHERE CONFERIU = 'N'
    AND CODFILIAL NOT IN (6, 81, 92)
    AND TRUNC(DATA) <= TRUNC(SYSDATE)
  GROUP BY CODPROD
) e ON p.CODPROD = e.CODPROD
LEFT JOIN (
  SELECT CODPROD,
    CEIL(GREATEST(
      COALESCE(SUM(CASE WHEN mes_venda >= ADD_MONTHS(TRUNC(SYSDATE,'MM'),-3) THEN qtvenda ELSE 0 END),0) / 3,
      COALESCE(SUM(CASE WHEN mes_venda >= ADD_MONTHS(TRUNC(SYSDATE,'MM'),-7) THEN qtvenda ELSE 0 END),0) / 7
    )) AS media_final
  FROM (
    SELECT CODPROD, TRUNC(dt, 'MM') AS mes_venda, SUM(qt) AS qtvenda
    FROM (
      SELECT m.CODPROD AS CODPROD,
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
        AND m.CODFILIAL NOT IN (6, 81, 92)
    )
    WHERE dt >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -7)
      AND dt <  TRUNC(SYSDATE, 'MM')
    GROUP BY CODPROD, TRUNC(dt, 'MM')
  )
  GROUP BY CODPROD
) v ON p.CODPROD = v.CODPROD
WHERE p.CODEPTO = 19
  AND p.DESCRICAO NOT LIKE '*%'
  AND (COALESCE(e.total_estoque,0) > 0 OR COALESCE(v.media_final,0) > 0)
ORDER BY MESES_ESTQ ASC, CODPROD ASC
```

---

## 2. Detalhamento por cidade — `GET /api/estoque/cidades?codprod=<x>`

`qEstoquePorCidade(codprod)` — exige `codprod`.

```sql
SELECT CIDADE,
       SUM(te) AS ESTOQ_ATUAL,
       SUM(tv) AS VENDA_MEDIA,
       CASE
         WHEN SUM(te) <= 0 AND SUM(tv) >  0 THEN 0
         WHEN SUM(te) >  0 AND SUM(tv) <= 0 THEN 15
         WHEN SUM(te) =  0 AND SUM(tv) =  0 THEN 0
         ELSE ROUND(SUM(te) / NULLIF(SUM(tv), 0), 2)
       END AS MESES_ESTQ
FROM (
  SELECT
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
    END AS CIDADE,
    COALESCE(e.total_estoque,0) AS te,
    COALESCE(v.media_final,0)   AS tv
  FROM WINDOW.PCFILIAL fil
  LEFT JOIN (
    SELECT b.CODFILIAL, SUM(b.QUANTIDADE) AS total_estoque
    FROM WINDOW.TAB_CODBARRAS b
    WHERE b.CONFERIU = 'N'
      AND b.CODFILIAL NOT IN (6, 81, 92)
      AND TRUNC(b.DATA) <= TRUNC(SYSDATE)
      AND b.CODPROD = '<codprod>'
    GROUP BY b.CODFILIAL
  ) e ON fil.CODIGO = e.CODFILIAL
  LEFT JOIN (
    SELECT CODFILIAL,
      CEIL(GREATEST(
        COALESCE(SUM(CASE WHEN mes_venda >= ADD_MONTHS(TRUNC(SYSDATE,'MM'),-3) THEN qtvenda ELSE 0 END),0) / 3,
        COALESCE(SUM(CASE WHEN mes_venda >= ADD_MONTHS(TRUNC(SYSDATE,'MM'),-7) THEN qtvenda ELSE 0 END),0) / 7
      )) AS media_final
    FROM (
      SELECT CODFILIAL, TRUNC(dt, 'MM') AS mes_venda, SUM(qt) AS qtvenda
      FROM (
        SELECT m.CODFILIAL AS CODFILIAL,
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
          AND m.CODFILIAL NOT IN (6, 81, 92)
          AND m.CODPROD = '<codprod>'
      )
      WHERE dt >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -7)
        AND dt <  TRUNC(SYSDATE, 'MM')
      GROUP BY CODFILIAL, TRUNC(dt, 'MM')
    )
    GROUP BY CODFILIAL
  ) v ON fil.CODIGO = v.CODFILIAL
  WHERE fil.CODIGO NOT IN (6, 81, 92)
)
GROUP BY CIDADE
HAVING SUM(te) > 0 OR SUM(tv) > 0
ORDER BY MESES_ESTQ DESC NULLS LAST
```

---

## 3. Lotes de um produto — `GET /api/estoque/lotes?codprod=<x>&cidade=<c>`

`qLotes(codprod, cidade?)` — `cidade` opcional injeta `AND b.CODFILIAL IN (...)`.

```sql
SELECT DISTINCT b.LOTEPRODUTO
FROM WINDOW.TAB_CODBARRAS b
WHERE b.CODPROD = '<codprod>'
  AND b.CONFERIU = 'N'
  AND b.CODFILIAL NOT IN (6, 81, 92)
  AND TRUNC(b.DATA) <= TRUNC(SYSDATE)
  -- AND b.CODFILIAL IN (...)   (se cidade selecionada)
ORDER BY b.LOTEPRODUTO
```

---

## 4. Etiquetas (códigos de barras) — `GET /api/estoque/etiquetas?codprod=<x>&lote=<l>&cidade=<c>`

`qEtiquetas(codprod, lote?, cidade?)` — `lote` (≠ `ALL`) injeta `AND b.LOTEPRODUTO = '<l>'`; `cidade` injeta `AND b.CODFILIAL IN (...)`.

```sql
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
  AND b.CODFILIAL NOT IN (6, 81, 92)
  AND TRUNC(b.DATA) <= TRUNC(SYSDATE)
  AND b.CODPROD = '<codprod>'
  -- AND b.LOTEPRODUTO = '<lote>'   (se lote != ALL)
  -- AND b.CODFILIAL IN (...)       (se cidade selecionada)
ORDER BY CAST(b.QUANTIDADE AS NUMBER) DESC, b.LOTEPRODUTO
FETCH FIRST 500 ROWS ONLY
```

---

## 5. Seletor de seção — `GET /api/estoque/secoes`

`Q_SECOES` (constante).

```sql
SELECT s.CODSEC AS value, s.DESCRICAO AS label
FROM WINDOW.PCSECAO s
INNER JOIN WINDOW.PCPRODUT p ON s.CODSEC = p.CODSEC
WHERE p.CODEPTO = 19
GROUP BY s.CODSEC, s.DESCRICAO
HAVING COUNT(DISTINCT p.CODPROD) > 0
ORDER BY s.DESCRICAO
```

---

## Mapa cidade → filiais

| Cidade | Filiais |
|---|---|
| GOIANIA | 1, 5, 9, 11, 17, 18, 19, 51, 77, 99 |
| BRASILIA | 2, 15, 21, 61, 75 |
| RIO DE JANEIRO | 3, 16, 31, 76 |
| SAO PAULO | 10, 13, 62, 73 |
| CAMPINAS | 22 |
| UBERLANDIA | 4, 14, 41, 74 |
| BELO HORIZONTE | 7, 71 |
| CURITIBA | 12, 72 |
| PORTO ALEGRE | 8 |
| VALPARAISO DE GOIAS | 20, 82 |
