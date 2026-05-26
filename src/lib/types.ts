export interface Transferencia {
  TRANSACAO: number;
  ORIGEM: string;
  DESTINO: string;
  TRANSF_GERENCIAL: string | null;
  DATA_SOLICITACAO: string | null;
  SOLICITANTE: string | null;
  STATUS_POSICAO: string;
  POSICAO_COD: string;
  DATA_ATUALIZACAO: string | null;
  FUNC_ATUALIZACAO: string | null;
}

export interface Item {
  TRANSACAO: number;
  CODPROD: number;
  NOME_PRODUTO: string | null;
  QUANTIDADE: number;
  SUGESTAO: number | null;
  DATA: string | null;
  POSICAO: string | null;
  QTCOLETADA: number | null;
}

export interface Etiqueta {
  TRANSACAO: number;
  CODBARRAS: string | number;
  FILIALORIG: number;
  FILIALDEST: number;
  DATA: string | null;
  CODFUNC: number | null;
  CONFIRMADO: string | null;
  LEUCODBARRAS: string | null;
  CODFUNCLEITURA: number | null;
  DATALEITURA: string | null;
  PERMITEINCLUIR: string | null;
  DATACONFENT: string | null;
  CODFUNCCONFENT: number | null;
  DATACONFSAI: string | null;
  CODFUNCCONFSAI: number | null;
  TRANSFESTOQUE: string | null;
  VERSAOROTINA: string | null;
  CODPROD: number;
  QUANTIDADE: number;
}

export interface ItemSearchRow {
  TRANSACAO: number;
  CODPROD: number;
  NOME_PRODUTO: string | null;
  QUANTIDADE: number;
  QTCOLETADA: number | null;
  ITEM_POSICAO: string | null;
  DATA_SOLICITACAO: string | null;
  TRANSF_POSICAO: string;
  ORIGEM: string;
  DESTINO: string;
}

export interface KpiStatusRow {
  POSICAO: string;
  TOTAL: number;
}

export interface KpiSolicitanteRow {
  SOLICITANTE: string;
  TOTAL: number;
}
