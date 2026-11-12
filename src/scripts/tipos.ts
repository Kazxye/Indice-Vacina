export type Pergunta = 'cobertura' | 'infarto' | 'associacao' | 'outras';
export type Desfecho = 'obitos' | 'intern';
export type Faixa = '60' | 'todas';
export type PeriodoId = 'principal' | 'sensibilidade' | 'recente';
export type Modo = 'nivel' | 'variacao';
export type TipoTaxa = 'padronizada' | 'bruta';

export interface Uf { sigla: string; nome: string; regiao: string }

export interface RegInfarto {
  uf: string; ano: number; pop: number; pop60: number;
  obitos: number; obitos60: number; intern: number; intern60: number;
  tx_obitos: number | null; tx_obitos60: number | null; tx_intern: number | null; tx_intern60: number | null;
  txp_obitos: number | null; txp_obitos60: number | null; txp_intern: number | null; txp_intern60: number | null;
  preliminar: boolean;
}

export type OrigemGripe = 'pni' | 'sipni' | 'rnds' | 'tabnet' | 'ms_camara';
export type SituacaoGripe = 'oficial' | 'parcial' | 'nacional' | 'pendente' | 'ausente';

export interface RegGripe {
  uf: string; ano: number; cobertura: number | null; doses: number | null; pop_alvo: number | null;
  origem: OrigemGripe | null; metodo: 'consolidado' | 'nominal' | null; situacao: SituacaoGripe; nota: string | null;
}

export interface FonteGripe { fonte: string; metodo: string | null; geo: string; data_ref: string; catalogo: string }

export interface PeriodoAnalise { rotulo: string; de: number; ate: number; metodo: 'consolidado' | 'nominal'; regra: string }

export interface Associacao {
  periodo: PeriodoId; desfecho: Desfecho; taxa: TipoTaxa; modo: Modo;
  r: number | null; n_obs: number; n_ufs: number; disponivel: boolean;
}

export interface Painel {
  gerado_em: string; data_extracao: string; anos: number[]; ufs: Uf[];
  padronizacao: { metodo: string; populacao_padrao: string; faixas: string[]; faixas60: string[]; obitos: boolean; intern60: boolean; intern_todas: boolean };
  qualidade: { obitos_preliminar: { ano: number; texto: string }; sih: string };
  fontes_gripe: Record<OrigemGripe, FonteGripe>;
  periodos: Record<PeriodoId, PeriodoAnalise>;
  infarto: RegInfarto[]; gripe: RegGripe[]; associacoes: Associacao[];
}

export interface RegRotina { vacina: string; uf: string; ano: number; cobertura: number }
export interface RegCovid { uf: string; nome: string; doses_total: number; dose1: number; dose2: number; dose_unica: number; esquema_por100: number; derivado: boolean }

export interface Consulta {
  pergunta: Pergunta;
  local: string;
  de: number;
  ate: number;
  desfecho: Desfecho;
  faixa: Faixa;
  periodo: PeriodoId;
  modo: Modo;
  taxa: TipoTaxa;
  vacina: string;
}

export interface Tabela {
  titulo: string;
  colunas: { rotulo: string; texto?: boolean }[];
  linhas: (string | number | null)[][];
  destaque?: (linha: (string | number | null)[]) => boolean;
}
