import type { Consulta, Desfecho, Faixa, Modo, Pergunta, PeriodoId, TipoTaxa } from './tipos';

const PERGUNTAS: Pergunta[] = ['cobertura', 'infarto', 'associacao', 'outras'];

function valor(id: string): string {
  const el = document.getElementById(id);
  return el instanceof HTMLSelectElement ? el.value : '';
}

export function perguntaEscolhida(form: HTMLFormElement): Pergunta | null {
  const v = new FormData(form).get('pergunta');
  return typeof v === 'string' && (PERGUNTAS as string[]).includes(v) ? (v as Pergunta) : null;
}

export type Leitura = { ok: true; consulta: Consulta } | { ok: false; erro: string; foco?: string };

export function leConsulta(form: HTMLFormElement): Leitura {
  const pergunta = perguntaEscolhida(form);
  if (!pergunta) return { ok: false, erro: 'Escolha primeiro o que você quer saber.' };
  const prefixo = { cobertura: 'c', infarto: 'i', associacao: 'a', outras: 'o' }[pergunta];
  const c: Consulta = {
    pergunta,
    local: valor(`${prefixo}-local`) || 'BR',
    de: Number(valor(`${prefixo}-de`)) || 2010,
    ate: Number(valor(`${prefixo}-ate`)) || 2025,
    desfecho: (valor('i-desfecho') || 'obitos') as Desfecho,
    faixa: (valor('i-faixa') || '60') as Faixa,
    periodo: (valor('a-periodo') || 'principal') as PeriodoId,
    modo: (valor('a-modo') || 'variacao') as Modo,
    taxa: (valor('a-taxa') || 'padronizada') as TipoTaxa,
    vacina: valor('o-vacina') || 'COVID-19',
  };
  if ((pergunta === 'cobertura' || pergunta === 'infarto') && c.de > c.ate) {
    return { ok: false, erro: `O período está invertido: o ano inicial (${c.de}) é maior que o final (${c.ate}).`, foco: `${prefixo}-de` };
  }
  return { ok: true, consulta: c };
}

export const ROTULO_DESFECHO: Record<Desfecho, string> = { obitos: 'Óbitos por infarto (SIM)', intern: 'Internações por infarto no SUS (SIH/SUS)' };
export const ROTULO_FAIXA: Record<Faixa, string> = { '60': '60 anos ou mais', todas: 'Todas as idades' };
export const ROTULO_MODO: Record<Modo, string> = { variacao: 'Variação anual dentro de cada estado', nivel: 'Níveis (estado e ano)' };
export const ROTULO_TAXA: Record<TipoTaxa, string> = { padronizada: 'Padronizada por idade', bruta: 'Bruta' };

export function resumo(c: Consulta, nomeUf: (s: string) => string, rotuloPeriodo: (p: PeriodoId) => string): [string, string][] {
  switch (c.pergunta) {
    case 'cobertura':
      return [['Pergunta', 'Cobertura da vacina da gripe'], ['Local', nomeUf(c.local)], ['Período', `${c.de}–${c.ate}`], ['Grupo', '60 anos ou mais']];
    case 'infarto':
      return [['Pergunta', 'Infarto'], ['Desfecho', ROTULO_DESFECHO[c.desfecho]], ['Faixa etária', ROTULO_FAIXA[c.faixa]], ['Local', nomeUf(c.local)], ['Período', `${c.de}–${c.ate}`]];
    case 'associacao':
      return [['Pergunta', 'Associação entre vacinação e infarto'], ['Período de análise', rotuloPeriodo(c.periodo)], ['Comparação', ROTULO_MODO[c.modo]], ['Taxa', ROTULO_TAXA[c.taxa]], ['Estado destacado', c.local === 'BR' ? 'Nenhum' : nomeUf(c.local)]];
    case 'outras':
      return [['Pergunta', 'Outras vacinas'], ['Vacina', c.vacina], ['Local', nomeUf(c.local)]];
  }
}
