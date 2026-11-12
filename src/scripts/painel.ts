import { carregaBase, carregaCovid, carregaRotina, ErroDeLeitura, type Base } from './dados';
import { leConsulta, perguntaEscolhida, resumo, ROTULO_DESFECHO, ROTULO_FAIXA, ROTULO_MODO, ROTULO_TAXA } from './consulta';
import { fDec, fInt, fR, fSinal, graficoDispersao, graficoLinha, mapaQuadrados, type PontoDisp, type PontoLinha, type Segmento } from './graficos';
import type { Associacao, Consulta, Desfecho, RegGripe, RegInfarto, Tabela } from './tipos';

type Filho = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...filhos: Filho[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k === 'class' ? (el.className = v) : el.setAttribute(k, v);
  for (const f of filhos) if (f) el.append(f);
  return el;
}
function poe(el: HTMLElement, ...filhos: Filho[]) { for (const f of filhos) if (f) el.append(f); }
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const form = $<HTMLFormElement>('form');
const secConsulta = $('consulta'), filtros = $('filtros'), erroForm = $('erro-form'), estado = $('estado');
const secResultado = $('resultado'), corpo = $('corpo'), chips = $('chips');
let tabelaAtual: Tabela | null = null;
let consultaAtual: Consulta | null = null;
let redesenhos: (() => void)[] = [];

const UFS27 = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const NO = new Set(['BR', 'AC', 'AM', 'AP', 'CE', 'DF', 'ES', 'MA', 'PA', 'PR', 'PI', 'RJ', 'RN', 'RS', 'TO', 'MT', 'MS']);
const NA = new Set(['BA', 'PB']);
const emLocal = (uf: string, nome: string) => `${NO.has(uf) ? 'no' : NA.has(uf) ? 'na' : 'em'} ${nome}`;
const anosEntre = (de: number, ate: number) => Array.from({ length: ate - de + 1 }, (_, i) => de + i);
const n = (v: number | null | undefined, f: (x: number) => string, sufixo = '') => (v == null ? '—' : f(v) + sufixo);

function mensagem(tipo: 'erro' | 'vazio' | 'carregando' | 'aviso' | 'info', titulo: string, texto: string, extra?: Node): HTMLElement {
  return h('p', { class: `msg ${tipo}`, role: tipo === 'erro' ? 'alert' : 'status' }, h('strong', {}, `${titulo} `), texto, extra ? ' ' : null, extra);
}
function kpi(rotulo: string, valor: string, sub?: Filho, selo?: Filho, texto = false): HTMLElement {
  return h('div', { class: 'kpi' }, h('span', { class: 'rot' }, rotulo, selo ? ' ' : null, selo), h('span', { class: texto ? 'val texto' : 'val' }, valor), sub ? h('span', { class: 'sub' }, sub) : null);
}
const seloPreliminar = () => h('span', { class: 'selo' }, 'Preliminar');

function tabelaHtml(t: Tabela): HTMLElement {
  const tb = h('table', { class: 'dados' }, h('caption', {}, t.titulo));
  tb.append(h('thead', {}, h('tr', {}, ...t.colunas.map((c) => h('th', c.texto ? { scope: 'col', class: 'txt' } : { scope: 'col' }, c.rotulo)))));
  const corpoT = h('tbody');
  for (const linha of t.linhas) {
    const tr = h('tr', t.destaque?.(linha) ? { class: 'dest' } : {});
    linha.forEach((v, i) => {
      const col = t.colunas[i];
      const td = h('td', col?.texto ? { class: 'txt' } : {});
      const texto = v == null ? '—' : typeof v === 'number' ? (Number.isInteger(v) && Math.abs(v) >= 1000 ? fInt(v) : String(v).replace('.', ',')) : v;
      if (typeof v === 'string' && v.includes('preliminar')) td.append(seloPreliminar());
      else td.textContent = texto;
      tr.append(td);
    });
    corpoT.append(tr);
  }
  tb.append(corpoT);
  return h('div', { class: 'tabela-wrap', tabindex: '0', role: 'region', 'aria-label': t.titulo }, tb);
}
function caixaGrafico(desenha: (el: HTMLElement) => void, alto = false): HTMLElement {
  const el = h('div', { class: 'chart' });
  if (alto) el.style.minHeight = '300px';
  redesenhos.push(() => desenha(el));
  return el;
}
function legenda(itens: { cor: string; texto: string; ponto?: boolean }[]): HTMLElement {
  return h('div', { class: 'legenda' }, ...itens.map((i) => {
    const marca = h('i', i.ponto ? { class: 'ponto' } : {});
    marca.style.borderColor = i.cor;
    return h('span', {}, marca, i.texto);
  }));
}
function palavra(r: number | null): string {
  if (r == null) return 'sem pontos suficientes';
  const a = Math.abs(r);
  const forca = a < 0.2 ? 'muito fraca' : a < 0.4 ? 'fraca' : a < 0.6 ? 'moderada' : 'forte';
  return a < 0.05 ? `${forca}, sem direção` : `${forca} e ${r < 0 ? 'negativa' : 'positiva'}`;
}

interface Saida { nos: Node[]; tabela: Tabela | null }

function cobertura(b: Base, c: Consulta): Saida {
  const local = b.nomeUf(c.local);
  const regs = anosEntre(c.de, c.ate).map((a) => b.gripe.get(`${c.local}|${a}`)).filter((r): r is RegGripe => !!r);
  const comValor = regs.filter((r) => r.cobertura != null);
  const comAlgo = regs.filter((r) => r.cobertura != null || r.doses != null);
  if (!comAlgo.length) {
    const porque = c.local === 'BR'
      ? 'Não há valor publicado para este período.'
      : 'De 2021 a 2023 só existe o valor do Brasil: o SI-PNI Web devolve tabela vazia para esses anos e o painel da RNDS começa em 2024.';
    return { tabela: null, nos: [mensagem('vazio', 'Sem dados para esta consulta.', `Não há cobertura da gripe para ${local} entre ${c.de} e ${c.ate}. ${porque} Edite a consulta e inclua 2011–2020 ou 2024–2025, ou escolha Brasil.`)] };
  }
  const fonte = (r: RegGripe) => (r.origem ? b.painel.fontes_gripe[r.origem] : null);
  const ult = comValor[comValor.length - 1] ?? null;
  const nos: Node[] = [];

  if (ult) {
    const f = fonte(ult);
    nos.push(h('p', { class: 'resposta' }, `Em ${ult.ano}, a cobertura da vacina da gripe em pessoas de 60 anos ou mais ${emLocal(c.local, local)} foi de `, h('b', {}, `${fDec(ult.cobertura as number)}%`), '.',
      ult.doses != null && ult.pop_alvo != null ? ` Foram ${fInt(ult.doses)} doses para uma população-alvo de ${fInt(ult.pop_alvo)} pessoas.` : ' A fonte não informa doses nem população-alvo para este valor.'));
    nos.push(h('div', { class: 'kpis' },
      kpi(`Cobertura em ${ult.ano}`, `${fDec(ult.cobertura as number)}%`, ult.situacao === 'nacional' ? 'valor nacional, sem detalhe por estado' : `método ${ult.metodo}`),
      kpi('Doses aplicadas', n(ult.doses, fInt), 'numerador da cobertura'),
      kpi('População-alvo', n(ult.pop_alvo, fInt), 'denominador da cobertura'),
      kpi('Fonte e data de referência', f?.fonte.split(' (')[0] ?? '—', f ? f.data_ref : null, null, true)));
  } else {
    const d = comAlgo[comAlgo.length - 1] as RegGripe;
    nos.push(h('p', { class: 'resposta' }, `Para ${local}, em ${d.ano} só há o número de doses aplicadas em pessoas de 60 anos ou mais: `, h('b', {}, fInt(d.doses as number)), '. Sem população-alvo publicada, a cobertura não pode ser calculada.'));
  }

  const metodos = new Set(comValor.map((r) => r.metodo));
  if (comValor.some((r) => (r.cobertura as number) > 100)) {
    nos.push(mensagem('aviso', 'Valores acima de 100%.', 'A cobertura divide doses aplicadas por uma população-alvo estimada. De 2015 a 2020 o SI-PNI manteve a mesma população de idosos enquanto ela crescia, e pessoas vacinadas fora do estado de residência contam onde tomaram a dose. Por isso o resultado pode passar de 100% sem que todos tenham sido vacinados.'));
  }
  if (metodos.size > 1) {
    nos.push(mensagem('aviso', 'Mudança de método.', 'Até 2022 a cobertura vem de totais consolidados informados pelos municípios (SI-PNI). A partir de 2023 vem do registro nominal de cada dose na RNDS, com população do Censo 2022. Os dois trechos não são comparáveis e aparecem em cores diferentes, sem linha entre eles.'));
  }
  const pend = regs.filter((r) => r.situacao === 'pendente').map((r) => r.ano);
  if (pend.length) nos.push(mensagem('info', 'Anos sem valor por estado:', `${pend.join(', ')}. Nesses anos só existe a cobertura do Brasil; os estados ficam em branco, sem estimativa.`));
  if (regs.some((r) => r.situacao === 'nacional')) nos.push(mensagem('info', 'Valores nacionais de 2021 a 2023.', 'Vêm de uma apresentação do Ministério da Saúde (dados de junho de 2025), que não informa doses nem população-alvo. Aparecem como círculos vazados.'));
  if (regs.some((r) => r.situacao === 'parcial')) nos.push(mensagem('info', '2010 é parcial.', 'Só o número de doses está publicado. A cobertura fica em branco.'));

  if (comValor.length) {
    const pt = (r: RegGripe): PontoLinha => ({ x: r.ano, y: r.cobertura, oco: r.situacao === 'nacional', nota: r.situacao === 'nacional' ? 'valor nacional' : undefined });
    const cons = regs.filter((r) => r.metodo === 'consolidado' && r.cobertura != null);
    const nomi = regs.filter((r) => r.metodo === 'nominal' && r.cobertura != null);
    const segs: Segmento[] = [];
    const quebra = (rs: RegGripe[], cor: string) => {
      let atual: PontoLinha[] = [];
      rs.forEach((r, i) => {
        if (i && r.ano - (rs[i - 1] as RegGripe).ano > 1) { segs.push({ pontos: atual, cor }); atual = []; }
        atual.push(pt(r));
      });
      if (atual.length) segs.push({ pontos: atual, cor });
    };
    quebra(cons, 'var(--s1)');
    quebra(nomi, 'var(--s2)');
    const marcas = cons.length && nomi.length ? [{ x: ((cons[cons.length - 1] as RegGripe).ano + (nomi[0] as RegGripe).ano) / 2, rotulo: 'muda o método' }] : [];
    nos.push(h('div', { class: 'card' }, h('h3', {}, `Cobertura da gripe em 60 anos ou mais (%), ${local}`),
      caixaGrafico((el) => graficoLinha(el, segs, { xDom: [c.de, c.ate], unidade: '%', aria: `Cobertura da vacina da gripe por ano em ${local}`, marcas, referencia: comValor.some((r) => (r.cobertura as number) > 95) ? { y: 100, rotulo: '100%' } : undefined })),
      legenda([{ cor: 'var(--s1)', texto: 'SI-PNI/PNI, método consolidado' }, { cor: 'var(--s2)', texto: 'RNDS, registro nominal' }, { cor: 'var(--fg-muted)', texto: 'valor nacional, sem doses', ponto: true }])));
  }

  if (ult) {
    const valores = new Map(UFS27.map((u) => [u, b.gripe.get(`${u}|${ult.ano}`)?.cobertura ?? null] as [string, number | null]));
    if ([...valores.values()].some((v) => v != null)) {
      nos.push(h('div', { class: 'card' }, h('h3', {}, `Cobertura por estado em ${ult.ano} (%)`), h('p', { class: 'dica' }, 'Cada quadrado é um estado, na posição aproximada do mapa. Escolha um para refazer a consulta nele.'),
        caixaMapa(valores, 'var(--s1)', c, b)));
    }
  }

  const tabela: Tabela = {
    titulo: `Cobertura da vacina da gripe em 60 anos ou mais, ${local}, ${c.de}–${c.ate}`,
    colunas: [{ rotulo: 'Ano' }, { rotulo: 'Cobertura (%)' }, { rotulo: 'Doses' }, { rotulo: 'População-alvo' }, { rotulo: 'Fonte', texto: true }, { rotulo: 'Método', texto: true }, { rotulo: 'Critério geográfico', texto: true }, { rotulo: 'Data de referência', texto: true }, { rotulo: 'Observação', texto: true }],
    linhas: regs.map((r) => { const f = fonte(r); return [String(r.ano), r.cobertura, r.doses, r.pop_alvo, f?.fonte ?? null, r.metodo, f?.geo ?? null, f?.data_ref ?? null, r.nota]; }),
  };
  nos.push(tabelaHtml(tabela));
  return { nos, tabela };
}

function caixaMapa(valores: Map<string, number | null>, cor: string, c: Consulta, b: Base): HTMLElement {
  const el = h('div', { class: 'mapa' });
  mapaQuadrados(el, valores, { cor, selecionada: c.local, nome: b.nomeUf, aoEscolher: (uf) => {
    const sel = document.getElementById(`${c.pergunta === 'cobertura' ? 'c' : c.pergunta === 'infarto' ? 'i' : 'o'}-local`);
    if (sel instanceof HTMLSelectElement) { sel.value = uf; void executa(); }
  } });
  return el;
}

function infarto(b: Base, c: Consulta): Saida {
  const local = b.nomeUf(c.local);
  const suf = c.faixa === '60' ? '60' : '';
  const kN = `${c.desfecho}${suf}` as keyof RegInfarto, kPop = (c.faixa === '60' ? 'pop60' : 'pop') as keyof RegInfarto;
  const kTx = `tx_${c.desfecho}${suf}` as keyof RegInfarto, kTxp = `txp_${c.desfecho}${suf}` as keyof RegInfarto;
  const regs = anosEntre(c.de, c.ate).map((a) => b.infarto.get(`${c.local}|${a}`)).filter((r): r is RegInfarto => !!r);
  if (!regs.length) return { tabela: null, nos: [mensagem('vazio', 'Sem dados para esta consulta.', `Não há registros de infarto para ${local} entre ${c.de} e ${c.ate}.`)] };
  const ult = regs[regs.length - 1] as RegInfarto, prim = regs[0] as RegInfarto;
  const obitos = c.desfecho === 'obitos';
  const prelim = (r: RegInfarto) => obitos && r.preliminar;
  const temPad = regs.every((r) => r[kTxp] != null);
  const kPrincipal = temPad ? kTxp : kTx;
  const oque = obitos ? 'óbitos por infarto' : 'internações por infarto no SUS';
  const quem = c.faixa === '60' ? 'em pessoas de 60 anos ou mais' : 'em todas as idades';
  const nos: Node[] = [];

  nos.push(h('p', { class: 'resposta' }, `Em ${ult.ano}, ${local} registrou `, h('b', {}, fInt(ult[kN] as number)), ` ${oque} ${quem}`, prelim(ult) ? ' ' : null, prelim(ult) ? seloPreliminar() : null,
    `: ${fDec(ult[kTx] as number)} por 100 mil habitantes`, temPad ? `, ou ${fDec(ult[kTxp] as number)} com padronização por idade.` : ' (taxa bruta).'));
  const v0 = prim[kPrincipal] as number | null, v1 = ult[kPrincipal] as number | null;
  nos.push(h('div', { class: 'kpis' },
    kpi(`${obitos ? 'Óbitos' : 'Internações'} em ${ult.ano}`, fInt(ult[kN] as number), ROTULO_FAIXA[c.faixa], prelim(ult) ? seloPreliminar() : null),
    kpi('Taxa bruta', fDec(ult[kTx] as number), 'por 100 mil habitantes'),
    kpi('Taxa padronizada por idade', n(ult[kTxp] as number | null, fDec), temPad ? 'por 100 mil, população padrão Brasil 2022' : 'faltam dados por faixa etária'),
    kpi(`Variação desde ${prim.ano}`, v0 && v1 != null && prim.ano !== ult.ano ? `${fSinal(100 * (v1 / v0 - 1))}%` : '—', `na taxa ${temPad ? 'padronizada' : 'bruta'}`)));

  if (obitos && regs.some((r) => r.preliminar)) nos.push(mensagem('aviso', 'Dados preliminares.', b.painel.qualidade.obitos_preliminar.texto + ' No gráfico, 2025 aparece como círculo vazado ligado por linha tracejada.'));
  if (!obitos) nos.push(mensagem('info', 'Alcance do SIH/SUS.', b.painel.qualidade.sih + ' Um aumento pode refletir mais acesso ao SUS, e não só mais infartos.'));
  if (!temPad) nos.push(mensagem('info', 'Taxa bruta.', 'Não há numeradores por faixa etária para padronizar esta série; estados com população mais velha tendem a ter taxas maiores só por isso.'));

  const firme = regs.filter((r) => !prelim(r)).map((r): PontoLinha => ({ x: r.ano, y: r[kPrincipal] as number | null }));
  const segs: Segmento[] = [{ pontos: firme, cor: obitos ? 'var(--s2)' : 'var(--s1)' }];
  const p25 = regs.find(prelim);
  if (p25) {
    const ant = regs.find((r) => r.ano === p25.ano - 1);
    segs.unshift({ tracejado: true, cor: 'var(--s2)', pontos: [...(ant ? [{ x: ant.ano, y: ant[kPrincipal] as number | null }] : []), { x: p25.ano, y: p25[kPrincipal] as number | null, oco: true, nota: 'preliminar' }] });
    if (ant) segs.push({ pontos: [{ x: ant.ano, y: ant[kPrincipal] as number | null }], cor: 'var(--s2)' });
  }
  const faixas = c.de <= 2022 && c.ate >= 2020 ? [{ de: Math.max(2020, c.de), ate: Math.min(2022, c.ate), rotulo: 'pandemia' }] : [];
  nos.push(h('div', { class: 'card' }, h('h3', {}, `${ROTULO_DESFECHO[c.desfecho]}, ${ROTULO_FAIXA[c.faixa].toLowerCase()}: taxa ${temPad ? 'padronizada por idade' : 'bruta'} por 100 mil, ${local}`),
    caixaGrafico((el) => graficoLinha(el, segs, { xDom: [c.de, c.ate], unidade: ' por 100 mil', aria: `Taxa de ${oque} por ano em ${local}`, faixas })),
    legenda([{ cor: obitos ? 'var(--s2)' : 'var(--s1)', texto: temPad ? 'taxa padronizada por idade' : 'taxa bruta' }, ...(p25 ? [{ cor: 'var(--s2)', texto: '2025 preliminar', ponto: true }] : [])])));

  const valores = new Map(UFS27.map((u) => [u, (b.infarto.get(`${u}|${ult.ano}`)?.[kPrincipal] as number | null | undefined) ?? null] as [string, number | null]));
  nos.push(h('div', { class: 'card' }, h('h3', {}, `Taxa ${temPad ? 'padronizada' : 'bruta'} por estado em ${ult.ano}`, prelim(ult) ? ' ' : null, prelim(ult) ? seloPreliminar() : null),
    h('p', { class: 'dica' }, 'Escolha um estado para refazer a consulta nele.'), caixaMapa(valores, obitos ? 'var(--s2)' : 'var(--s1)', c, b)));

  const tabela: Tabela = {
    titulo: `${ROTULO_DESFECHO[c.desfecho]}, ${ROTULO_FAIXA[c.faixa].toLowerCase()}, ${local}, ${c.de}–${c.ate}`,
    colunas: [{ rotulo: 'Ano' }, { rotulo: obitos ? 'Óbitos' : 'Internações' }, { rotulo: 'População' }, { rotulo: 'Taxa bruta (por 100 mil)' }, { rotulo: 'Taxa padronizada (por 100 mil)' }, { rotulo: 'Situação', texto: true }],
    linhas: regs.map((r) => [String(r.ano), r[kN] as number, r[kPop] as number, r[kTx] as number | null, r[kTxp] as number | null, prelim(r) ? 'preliminar' : obitos ? 'definitivo' : 'SIH/SUS, internações financiadas pelo SUS']),
  };
  nos.push(tabelaHtml(tabela));
  return { nos, tabela };
}

function pontosAssociacao(b: Base, c: Consulta, desfecho: Desfecho, tipo: 'padronizada' | 'bruta'): PontoDisp[] {
  const per = b.painel.periodos[c.periodo];
  const col = `${tipo === 'padronizada' ? 'txp' : 'tx'}_${desfecho}60` as keyof RegInfarto;
  const pts: PontoDisp[] = [];
  const par = (uf: string, a: number) => {
    const g = b.gripe.get(`${uf}|${a}`), t = b.infarto.get(`${uf}|${a}`)?.[col] as number | null | undefined;
    return g && g.cobertura != null && g.metodo === per.metodo && t != null ? { x: g.cobertura, y: t } : null;
  };
  for (const uf of UFS27) {
    for (const a of anosEntre(per.de, per.ate)) {
      const p = par(uf, a);
      if (!p) continue;
      if (c.modo === 'nivel') { pts.push({ ...p, uf, rotulo: `${uf} ${a}`, destaque: uf === c.local }); continue; }
      if (a === per.de) continue;
      const p0 = par(uf, a - 1);
      if (p0) pts.push({ x: p.x - p0.x, y: p.y - p0.y, uf, rotulo: `${uf} ${a - 1}→${a}`, destaque: uf === c.local });
    }
  }
  return pts;
}

function associacao(b: Base, c: Consulta): Saida {
  const per = b.painel.periodos[c.periodo];
  const acha = (desfecho: Desfecho, taxa: 'padronizada' | 'bruta', periodo = c.periodo): Associacao | undefined =>
    b.painel.associacoes.find((a) => a.periodo === periodo && a.desfecho === desfecho && a.taxa === taxa && a.modo === c.modo);
  const escolhe = (desfecho: Desfecho, periodo = c.periodo) => {
    const pedida = acha(desfecho, c.taxa, periodo);
    if (pedida?.disponivel || c.taxa === 'bruta') return { a: pedida, taxa: c.taxa, trocou: false };
    return { a: acha(desfecho, 'bruta', periodo), taxa: 'bruta' as const, trocou: true };
  };
  const blocos = (['obitos', 'intern'] as Desfecho[]).map((d) => ({ d, ...escolhe(d) }));
  if (blocos.every((x) => !x.a?.disponivel)) {
    return { tabela: null, nos: [mensagem('vazio', 'Sem dados para esta consulta.', `Não há pares suficientes de cobertura e taxa de infarto em ${per.rotulo} para calcular a associação.`)] };
  }
  const variacao = c.modo === 'variacao';
  const nos: Node[] = [];
  const frase = (x: (typeof blocos)[number]) => x.a?.disponivel ? `${palavra(x.a.r)} (r = ${fR(x.a.r as number)}, ${fInt(x.a.n_obs)} observações de ${x.a.n_ufs} UFs)` : 'não calculada';
  nos.push(h('p', { class: 'resposta' }, `Em ${per.rotulo.split(' (')[0]}, a associação entre a cobertura da gripe e os `, h('b', {}, 'óbitos'), ` por infarto em 60 anos ou mais é ${frase(blocos[0] as (typeof blocos)[number])}. Com as `, h('b', {}, 'internações'), ` no SUS, é ${frase(blocos[1] as (typeof blocos)[number])}.`));
  nos.push(mensagem('aviso', 'Associação populacional, não causa.', 'O coeficiente compara estados e anos, não pessoas. Ele não diz se quem se vacinou infartou menos. Envelhecimento, acesso a hospital, qualidade do registro e a pandemia mudam vacinação e infarto ao mesmo tempo. Investigar causa é uma etapa própria, com dados individuais ou mensais.'));
  if (c.periodo === 'sensibilidade') nos.push(mensagem('info', 'Análise de sensibilidade.', 'Inclui 2020, primeiro ano da pandemia, quando a cobertura registrada passou de 100% em vários estados. Compare com o período 2011–2019 na tabela de períodos.'));
  if (c.periodo === 'recente') nos.push(mensagem('info', 'Série recente.', 'São só dois anos (2024 e 2025), medidos pela RNDS. Há poucas observações e os óbitos de 2025 são preliminares; leia com cautela.'));
  if (c.local !== 'BR') nos.push(mensagem('info', `${b.nomeUf(c.local)} está só destacado.`, 'Os pontos desse estado aparecem em laranja, mas o coeficiente é calculado com todas as UFs que têm dados no período.'));

  const linhasDet: (string | number | null)[][] = [];
  for (const x of blocos) {
    const titulo = ROTULO_DESFECHO[x.d];
    const cartao = h('div', { class: 'card' }, h('h3', {}, titulo));
    if (!x.a?.disponivel) {
      cartao.append(mensagem('vazio', 'Sem dados.', 'Não há observações suficientes deste desfecho no período escolhido.'));
      nos.push(cartao);
      continue;
    }
    const pts = pontosAssociacao(b, c, x.d, x.taxa);
    pts.forEach((p) => linhasDet.push([titulo, p.uf, p.rotulo.slice(3), Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]));
    poe(cartao,
      h('div', { class: 'acoes' }, h('span', { class: 'r-grande' }, fR(x.a.r as number)), h('span', {}, `Pearson (r): associação ${palavra(x.a.r)}`)),
      h('dl', { class: 'fatos' },
        h('div', {}, h('dt', {}, 'Período'), h('dd', {}, `${per.de}–${per.ate}`)),
        h('div', {}, h('dt', {}, 'UFs no cálculo'), h('dd', {}, String(x.a.n_ufs))),
        h('div', {}, h('dt', {}, 'Observações'), h('dd', {}, fInt(x.a.n_obs))),
        h('div', {}, h('dt', {}, 'Taxa de infarto'), h('dd', {}, `${ROTULO_TAXA[x.taxa]}, 60 anos ou mais`)),
        h('div', {}, h('dt', {}, 'Comparação'), h('dd', {}, variacao ? 'Variação de um ano para o seguinte' : 'Níveis'))),
      h('p', { class: 'dica' }, `Regra de seleção: ${per.regra} Entram os pares estado-ano com cobertura oficial e taxa de infarto disponíveis${variacao ? ', e cada observação é a diferença entre dois anos seguidos do mesmo estado' : ''}.`),
      x.trocou ? mensagem('info', 'Taxa bruta.', 'A taxa padronizada por idade não está disponível para este desfecho; o cálculo usa a taxa bruta.') : null,
      x.d === 'intern' ? mensagem('info', 'Alcance do SIH/SUS.', b.painel.qualidade.sih) : null,
      x.d === 'obitos' && per.ate >= 2025 ? mensagem('aviso', 'Dados preliminares.', b.painel.qualidade.obitos_preliminar.texto) : null,
      caixaGrafico((el) => graficoDispersao(el, pts, {
        aria: `Dispersão entre cobertura da gripe e ${titulo}`,
        xl: variacao ? 'Variação da cobertura (pontos percentuais)' : 'Cobertura da gripe em 60+ (%)',
        yl: variacao ? 'Variação da taxa (por 100 mil)' : 'Taxa por 100 mil',
        fx: (v) => (variacao ? `${fSinal(v)} p.p.` : `${fDec(v)}%`), fy: (v) => (variacao ? fSinal(v) : fDec(v)),
      }), true),
      legenda([{ cor: 'var(--s1)', texto: 'cada ponto é um estado em um ano (ou par de anos)', ponto: true }, ...(c.local !== 'BR' ? [{ cor: 'var(--s2)', texto: `${b.nomeUf(c.local)} (só destaque)`, ponto: true }] : []), { cor: 'var(--fg)', texto: 'reta de tendência' }]));
    nos.push(cartao);
  }

  const comparativo: Tabela = {
    titulo: `Coeficientes por período e desfecho (${ROTULO_MODO[c.modo].toLowerCase()}; cada período é calculado em separado)`,
    colunas: [{ rotulo: 'Período', texto: true }, { rotulo: 'Desfecho', texto: true }, { rotulo: 'r de Pearson' }, { rotulo: 'Observações' }, { rotulo: 'UFs' }, { rotulo: 'Taxa', texto: true }],
    linhas: (['principal', 'sensibilidade', 'recente'] as const).flatMap((p) => (['obitos', 'intern'] as Desfecho[]).map((d) => {
      const e = escolhe(d, p);
      return [b.painel.periodos[p].rotulo, ROTULO_DESFECHO[d], e.a?.r == null ? null : fR(e.a.r), e.a?.n_obs ?? 0, e.a?.n_ufs ?? 0, ROTULO_TAXA[e.taxa]];
    })),
    destaque: (l) => l[0] === per.rotulo,
  };
  nos.push(tabelaHtml(comparativo));
  const tabela: Tabela = {
    titulo: `Observações usadas no cálculo, ${per.rotulo}`,
    colunas: [{ rotulo: 'Desfecho', texto: true }, { rotulo: 'UF', texto: true }, { rotulo: variacao ? 'Par de anos' : 'Ano', texto: true }, { rotulo: variacao ? 'Variação da cobertura (p.p.)' : 'Cobertura (%)' }, { rotulo: variacao ? 'Variação da taxa (por 100 mil)' : 'Taxa (por 100 mil)' }],
    linhas: linhasDet,
    destaque: (l) => l[1] === c.local,
  };
  nos.push(tabelaHtml(tabela));
  return { nos, tabela };
}

async function outras(b: Base, c: Consulta): Promise<Saida> {
  const local = b.nomeUf(c.local);
  const nos: Node[] = [mensagem('info', 'Seção secundária.', 'Estes dados são descritivos e não entram na análise de associação com infarto.')];
  if (c.vacina === 'COVID-19') {
    const dados = await carregaCovid();
    const r = dados.find((x) => x.uf === c.local);
    if (!r) return { tabela: null, nos: [mensagem('vazio', 'Sem dados para esta consulta.', `Não há registro de COVID-19 para ${local}.`)] };
    nos.unshift(h('p', { class: 'resposta' }, `Até abril de 2026, o total ${emLocal(c.local, local)} era de `, h('b', {}, fDec(r.esquema_por100)), ' esquemas primários de COVID-19 (segunda dose ou dose única) por 100 habitantes.'));
    nos.push(mensagem('info', 'Sem série anual.', 'A vacina existe desde 2021 e a fonte só publica o total acumulado, com a vacina monovalente. O denominador é a população de 2022.'));
    nos.push(h('div', { class: 'card' }, h('h3', {}, 'Esquema primário por 100 habitantes, por estado'), caixaMapa(new Map(dados.filter((x) => x.uf !== 'BR').map((x) => [x.uf, x.esquema_por100] as [string, number])), 'var(--s1)', c, b)));
    const tabela: Tabela = {
      titulo: 'COVID-19: doses aplicadas acumuladas até 24/04/2026, por estado',
      colunas: [{ rotulo: 'Local', texto: true }, { rotulo: 'Esquema primário por 100 hab.' }, { rotulo: 'Total de doses' }, { rotulo: '1ª dose' }, { rotulo: '2ª dose' }, { rotulo: 'Dose única' }, { rotulo: 'Observação', texto: true }],
      linhas: dados.map((x) => [x.nome, x.esquema_por100, x.doses_total, x.dose1, x.dose2, x.dose_unica, x.derivado ? 'Valor derivado por diferença; a linha não aparece no painel de origem.' : null]),
      destaque: (l) => l[0] === local,
    };
    nos.push(tabelaHtml(tabela));
    return { nos, tabela };
  }
  const dados = (await carregaRotina()).filter((x) => x.vacina === c.vacina && x.uf === c.local).sort((x, y) => x.ano - y.ano);
  if (!dados.length) return { tabela: null, nos: [mensagem('vazio', 'Sem dados para esta consulta.', `Não há cobertura de ${c.vacina} para ${local} entre 2010 e 2022.`)] };
  const ult = dados[dados.length - 1] as (typeof dados)[number];
  nos.unshift(h('p', { class: 'resposta' }, `Em ${ult.ano}, a cobertura de ${c.vacina} ${emLocal(c.local, local)} foi de `, h('b', {}, `${fDec(ult.cobertura)}%`), '.'));
  nos.push(h('div', { class: 'card' }, h('h3', {}, `${c.vacina}: cobertura (%), ${local}`),
    caixaGrafico((el) => graficoLinha(el, [{ cor: 'var(--s1)', pontos: dados.map((x) => ({ x: x.ano, y: x.cobertura })) }], { xDom: [2010, 2022], unidade: '%', aria: `Cobertura de ${c.vacina} por ano em ${local}` }))));
  const tabela: Tabela = { titulo: `${c.vacina}: cobertura por ano, ${local} (SI-PNI, TabNet)`, colunas: [{ rotulo: 'Ano' }, { rotulo: 'Cobertura (%)' }], linhas: dados.map((x) => [String(x.ano), x.cobertura]) };
  nos.push(tabelaHtml(tabela));
  return { nos, tabela };
}

function mostraGrupo() {
  const p = perguntaEscolhida(form);
  filtros.hidden = !p;
  filtros.querySelectorAll<HTMLElement>('[data-grupo]').forEach((g) => { g.hidden = g.dataset.grupo !== p; });
  erroForm.hidden = true;
}
function limpaResultado() {
  secResultado.hidden = true;
  corpo.replaceChildren();
  estado.replaceChildren();
  redesenhos = [];
  tabelaAtual = null;
  consultaAtual = null;
}

async function executa() {
  const lida = leConsulta(form);
  if (!lida.ok) {
    erroForm.textContent = lida.erro;
    erroForm.hidden = false;
    filtros.hidden = false;
    if (lida.foco) document.getElementById(lida.foco)?.focus();
    return;
  }
  erroForm.hidden = true;
  const c = lida.consulta;
  limpaResultado();
  estado.replaceChildren(mensagem('carregando', 'Carregando dados…', 'Lendo as tabelas da consulta.'));
  let saida: Saida, b: Base;
  try {
    b = await carregaBase();
    saida = c.pergunta === 'cobertura' ? cobertura(b, c) : c.pergunta === 'infarto' ? infarto(b, c) : c.pergunta === 'associacao' ? associacao(b, c) : await outras(b, c);
  } catch (e) {
    const tentar = h('button', { class: 'btn', type: 'button' }, 'Tentar de novo');
    tentar.addEventListener('click', () => void executa());
    estado.replaceChildren(mensagem('erro', 'Erro ao ler os dados.', e instanceof ErroDeLeitura ? e.message : 'Ocorreu uma falha inesperada ao montar o resultado.', tentar));
    if (!(e instanceof ErroDeLeitura)) console.error(e);
    return;
  }
  estado.replaceChildren();
  consultaAtual = c;
  tabelaAtual = saida.tabela;
  chips.replaceChildren(...resumo(c, b.nomeUf, (p) => b.painel.periodos[p].rotulo).map(([k, v]) => h('li', {}, h('b', {}, `${k}: `), v)));
  corpo.replaceChildren(...saida.nos);
  $<HTMLButtonElement>('baixar').hidden = !saida.tabela;
  secConsulta.hidden = true;
  secResultado.hidden = false;
  redesenhos.forEach((f) => f());
  secResultado.focus({ preventScroll: true });
  secResultado.scrollIntoView({ block: 'start' });
}

function baixa() {
  if (!tabelaAtual || !consultaAtual) return;
  const cel = (v: string | number | null) => {
    const s = v == null ? '' : typeof v === 'number' ? String(v).replace('.', ',') : v;
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const linhas = [[`# ${tabelaAtual.titulo}`], tabelaAtual.colunas.map((c) => c.rotulo), ...tabelaAtual.linhas].map((l) => l.map(cel).join(';'));
  const url = URL.createObjectURL(new Blob(['﻿' + linhas.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = h('a', { href: url, download: `consulta-${consultaAtual.pergunta}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function limpa() {
  form.reset();
  limpaResultado();
  secConsulta.hidden = false;
  mostraGrupo();
  $('titulo-consulta').scrollIntoView({ block: 'start' });
  form.querySelector<HTMLInputElement>('input[name="pergunta"]')?.focus();
}

form.addEventListener('change', (ev) => { if ((ev.target as HTMLElement).getAttribute('name') === 'pergunta') mostraGrupo(); });
form.addEventListener('submit', (ev) => { ev.preventDefault(); void executa(); });
$('limpar-form').addEventListener('click', limpa);
$('limpar').addEventListener('click', limpa);
$('baixar').addEventListener('click', baixa);
$('editar').addEventListener('click', () => {
  secResultado.hidden = true;
  secConsulta.hidden = false;
  mostraGrupo();
  filtros.querySelector<HTMLSelectElement>('[data-grupo]:not([hidden]) select')?.focus();
});
let temporizador = 0;
window.addEventListener('resize', () => { window.clearTimeout(temporizador); temporizador = window.setTimeout(() => { if (!secResultado.hidden) redesenhos.forEach((f) => f()); }, 150); });
mostraGrupo();
void carregaBase().catch(() => undefined);
