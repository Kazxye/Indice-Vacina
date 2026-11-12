import { csvParse } from 'd3';
import type { Painel, RegCovid, RegGripe, RegInfarto, RegRotina } from './tipos';

export class ErroDeLeitura extends Error {}

async function busca(url: string): Promise<Response> {
  let r: Response;
  try {
    r = await fetch(url);
  } catch {
    throw new ErroDeLeitura(`Não foi possível baixar ${url}. Verifique a conexão e tente de novo.`);
  }
  if (!r.ok) throw new ErroDeLeitura(`O arquivo ${url} respondeu com erro ${r.status}.`);
  return r;
}

export interface Base {
  painel: Painel;
  infarto: Map<string, RegInfarto>;
  gripe: Map<string, RegGripe>;
  nomeUf: (sigla: string) => string;
}

let cacheBase: Promise<Base> | null = null;

export function carregaBase(): Promise<Base> {
  if (!cacheBase) {
    cacheBase = (async () => {
      const r = await busca('/data/painel.json');
      let painel: Painel;
      try {
        painel = (await r.json()) as Painel;
      } catch {
        throw new ErroDeLeitura('O arquivo de dados está corrompido (JSON inválido).');
      }
      if (!Array.isArray(painel.infarto) || !Array.isArray(painel.gripe) || !Array.isArray(painel.associacoes)) {
        throw new ErroDeLeitura('O arquivo de dados não tem o formato esperado.');
      }
      const nomes = new Map(painel.ufs.map((u) => [u.sigla, u.nome]));
      return {
        painel,
        infarto: new Map(painel.infarto.map((x) => [`${x.uf}|${x.ano}`, x])),
        gripe: new Map(painel.gripe.map((x) => [`${x.uf}|${x.ano}`, x])),
        nomeUf: (s: string) => nomes.get(s) ?? s,
      };
    })();
    cacheBase.catch(() => { cacheBase = null; });
  }
  return cacheBase;
}

let cacheRotina: Promise<RegRotina[]> | null = null;
export function carregaRotina(): Promise<RegRotina[]> {
  if (!cacheRotina) {
    cacheRotina = busca('/data/rotina.csv').then((r) => r.text()).then((t) =>
      csvParse(t).map((x) => ({ vacina: x.vacina ?? '', uf: x.uf ?? '', ano: Number(x.ano), cobertura: Number(x.cobertura) })),
    );
    cacheRotina.catch(() => { cacheRotina = null; });
  }
  return cacheRotina;
}

let cacheCovid: Promise<RegCovid[]> | null = null;
export function carregaCovid(): Promise<RegCovid[]> {
  if (!cacheCovid) {
    cacheCovid = busca('/data/covid.csv').then((r) => r.text()).then((t) =>
      csvParse(t).map((x) => ({
        uf: x.uf ?? '', nome: x.nome ?? '', doses_total: Number(x.doses_total), dose1: Number(x.dose1), dose2: Number(x.dose2),
        dose_unica: Number(x.dose_unica), esquema_por100: Number(x.esquema_por100), derivado: x.derivado === 'sim',
      })),
    );
    cacheCovid.catch(() => { cacheCovid = null; });
  }
  return cacheCovid;
}
