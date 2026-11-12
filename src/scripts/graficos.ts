import { Delaunay, extent, formatLocale, least, line, mean, pointer, scaleLinear, select, sum } from 'd3';

const loc = formatLocale({ decimal: ',', thousands: '.', grouping: [3], currency: ['R$', ''] });
export const fInt = loc.format(',.0f');
export const fDec = loc.format(',.1f');
export const fR = loc.format('+.2f');
export const fSinal = loc.format('+,.1f');

function dica(caixa: HTMLElement): HTMLDivElement {
  const t = document.createElement('div');
  t.className = 'tip';
  t.hidden = true;
  caixa.appendChild(t);
  return t;
}
function posiciona(t: HTMLElement, caixa: HTMLElement, px: number, py: number) {
  t.hidden = false;
  t.style.left = `${Math.max(0, Math.min(caixa.clientWidth - t.offsetWidth, px + 12))}px`;
  t.style.top = `${Math.max(0, py - 36)}px`;
}
function linhasDica(t: HTMLElement, linhas: [string, string][]) {
  t.replaceChildren();
  linhas.forEach(([a, b], i) => {
    if (i) t.appendChild(document.createElement('br'));
    const s = document.createElement('span');
    s.textContent = a;
    t.append(s, document.createTextNode(b));
  });
}
export function vazio(el: HTMLElement, texto: string) {
  const d = document.createElement('p');
  d.className = 'msg vazio';
  d.textContent = texto;
  el.replaceChildren(d);
}

export interface PontoLinha { x: number; y: number | null; oco?: boolean; nota?: string }
export interface Segmento { pontos: PontoLinha[]; cor: string; tracejado?: boolean }
export interface OpcoesLinha {
  xDom: [number, number];
  unidade: string;
  aria: string;
  faixas?: { de: number; ate: number; rotulo: string }[];
  marcas?: { x: number; rotulo: string }[];
  referencia?: { y: number; rotulo: string };
}

export function graficoLinha(el: HTMLElement, segmentos: Segmento[], o: OpcoesLinha) {
  el.replaceChildren();
  const todos = segmentos.flatMap((s) => s.pontos.filter((p) => p.y != null).map((p) => ({ ...p, y: p.y as number, cor: s.cor })));
  if (!todos.length) return vazio(el, 'Sem valores para desenhar neste período.');
  const W = Math.max(260, el.clientWidth), H = 250, m = { t: 22, r: 48, b: 28, l: 46 };
  const svg = select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', o.aria);
  const x = scaleLinear(o.xDom[0] === o.xDom[1] ? [o.xDom[0] - 1, o.xDom[1] + 1] : o.xDom, [m.l, W - m.r]);
  const ext = extent(todos, (p) => p.y) as [number, number];
  if (o.referencia) { ext[0] = Math.min(ext[0], o.referencia.y); ext[1] = Math.max(ext[1], o.referencia.y); }
  const folga = (ext[1] - ext[0]) * 0.18 || Math.max(1, ext[1] * 0.1);
  const y = scaleLinear([Math.max(0, ext[0] - folga), ext[1] + folga], [H - m.b, m.t]).nice(4);

  (o.faixas ?? []).forEach((f) => {
    const x0 = Math.max(m.l, x(f.de - 0.5)), x1 = Math.min(W - m.r, x(f.ate + 0.5));
    if (x1 <= x0) return;
    svg.append('rect').attr('x', x0).attr('width', x1 - x0).attr('y', m.t).attr('height', H - m.b - m.t).style('fill', 'var(--muted-mark)').style('opacity', 0.14);
    svg.append('text').attr('class', 'ax').attr('x', (x0 + x1) / 2).attr('y', m.t - 6).attr('text-anchor', 'middle').text(f.rotulo);
  });
  y.ticks(4).forEach((t) => {
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).style('stroke', 'var(--grid)');
    svg.append('text').attr('class', 'ax').attr('x', m.l - 6).attr('y', y(t) + 4).attr('text-anchor', 'end').text(fInt(t));
  });
  const [a0, a1] = x.domain();
  const passo = Math.max(1, Math.ceil((a1 - a0) / (W < 430 ? 4 : 8)));
  for (let a = Math.ceil(a0); a <= a1; a += passo) svg.append('text').attr('class', 'ax').attr('x', x(a)).attr('y', H - 9).attr('text-anchor', 'middle').text(String(a));
  svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', H - m.b).attr('y2', H - m.b).style('stroke', 'var(--axis)');
  if (o.referencia) {
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(o.referencia.y)).attr('y2', y(o.referencia.y)).style('stroke', 'var(--muted-mark)').style('stroke-dasharray', '2 4');
    svg.append('text').attr('class', 'ax').attr('x', W - m.r).attr('y', y(o.referencia.y) - 4).attr('text-anchor', 'end').text(o.referencia.rotulo);
  }
  (o.marcas ?? []).forEach((mk) => {
    if (mk.x <= a0 || mk.x >= a1) return;
    svg.append('line').attr('x1', x(mk.x)).attr('x2', x(mk.x)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--fg)').style('stroke-dasharray', '5 4').style('stroke-width', 1.2);
    svg.append('text').attr('class', 'ax-fg').attr('x', x(mk.x)).attr('y', m.t - 6).attr('text-anchor', 'middle').text(mk.rotulo);
  });

  const traco = line<PontoLinha>().defined((p) => p.y != null).x((p) => x(p.x)).y((p) => y(p.y as number));
  segmentos.forEach((s) => {
    svg.append('path').attr('d', traco(s.pontos)).style('fill', 'none').style('stroke', s.cor).style('stroke-width', 2).style('stroke-linejoin', 'round').style('stroke-dasharray', s.tracejado ? '4 4' : 'none');
  });
  svg.selectAll('circle.pt').data(todos).join('circle').attr('class', 'pt').attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y)).attr('r', (p) => (p.oco ? 4.5 : 3.5))
    .style('fill', (p) => (p.oco ? 'var(--panel)' : p.cor)).style('stroke', (p) => (p.oco ? p.cor : 'var(--panel)')).style('stroke-width', (p) => (p.oco ? 2 : 1.5));
  const ultimo = todos.reduce((a, b) => (b.x >= a.x ? b : a));
  svg.append('text').attr('class', 'ax-fg').attr('x', x(ultimo.x) + 8).attr('y', y(ultimo.y) + 4).text(fDec(ultimo.y));

  const regua = svg.append('line').attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--muted-mark)').style('display', 'none');
  const t = dica(el);
  svg.append('rect').attr('x', m.l).attr('y', m.t).attr('width', W - m.l - m.r).attr('height', H - m.t - m.b).style('fill', 'transparent')
    .on('pointermove', (ev: PointerEvent) => {
      const px = pointer(ev)[0];
      const p = least(todos, (q) => Math.abs(x(q.x) - px));
      if (!p) return;
      regua.attr('x1', x(p.x)).attr('x2', x(p.x)).style('display', null);
      const ls: [string, string][] = [[`${p.x}  `, fDec(p.y) + o.unidade]];
      if (p.nota) ls.push(['', p.nota]);
      linhasDica(t, ls);
      const k = el.clientWidth / W;
      posiciona(t, el, x(p.x) * k, y(p.y) * k);
    })
    .on('pointerleave', () => { regua.style('display', 'none'); t.hidden = true; });
}

export interface PontoDisp { x: number; y: number; uf: string; rotulo: string; destaque: boolean }
export interface OpcoesDisp { xl: string; yl: string; fx: (v: number) => string; fy: (v: number) => string; aria: string }

export function graficoDispersao(el: HTMLElement, pts: PontoDisp[], o: OpcoesDisp) {
  el.replaceChildren();
  if (pts.length < 3) return vazio(el, 'Sem pontos suficientes para desenhar.');
  const W = Math.max(260, el.clientWidth), H = Math.min(400, Math.max(280, W * 0.5)), m = { t: 12, r: 16, b: 44, l: 56 };
  const svg = select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('width', '100%').attr('role', 'img').attr('aria-label', o.aria);
  const x = scaleLinear(extent(pts, (p) => p.x) as [number, number], [m.l, W - m.r]).nice();
  const y = scaleLinear(extent(pts, (p) => p.y) as [number, number], [H - m.b, m.t]).nice();
  y.ticks(5).forEach((t) => {
    svg.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(t)).attr('y2', y(t)).style('stroke', t === 0 ? 'var(--axis)' : 'var(--grid)');
    svg.append('text').attr('class', 'ax').attr('x', m.l - 6).attr('y', y(t) + 4).attr('text-anchor', 'end').text(fInt(t));
  });
  x.ticks(W < 430 ? 4 : 7).forEach((t) => {
    if (t === 0) svg.append('line').attr('x1', x(t)).attr('x2', x(t)).attr('y1', m.t).attr('y2', H - m.b).style('stroke', 'var(--axis)');
    svg.append('text').attr('class', 'ax').attr('x', x(t)).attr('y', H - m.b + 15).attr('text-anchor', 'middle').text(fInt(t));
  });
  svg.append('text').attr('class', 'ax').attr('x', (m.l + W - m.r) / 2).attr('y', H - 8).attr('text-anchor', 'middle').text(o.xl);
  svg.append('text').attr('class', 'ax').attr('transform', `translate(13,${(m.t + H - m.b) / 2}) rotate(-90)`).attr('text-anchor', 'middle').text(o.yl);
  const mx = mean(pts, (p) => p.x) ?? 0, my = mean(pts, (p) => p.y) ?? 0;
  const sxx = sum(pts, (p) => (p.x - mx) ** 2), sxy = sum(pts, (p) => (p.x - mx) * (p.y - my));
  if (sxx > 0) {
    const b = sxy / sxx, a = my - b * mx, dx = x.domain(), dy = y.domain();
    const corta = (v: number) => Math.max(dy[0], Math.min(dy[1], v));
    svg.append('line').attr('x1', x(dx[0])).attr('x2', x(dx[1])).attr('y1', y(corta(a + b * dx[0]))).attr('y2', y(corta(a + b * dx[1]))).style('stroke', 'var(--fg)').style('stroke-width', 1.5).style('stroke-dasharray', '5 4');
  }
  const ordem = pts.slice().sort((p, q) => Number(p.destaque) - Number(q.destaque));
  svg.selectAll('circle.pt').data(ordem).join('circle').attr('class', 'pt').attr('cx', (p) => x(p.x)).attr('cy', (p) => y(p.y)).attr('r', (p) => (p.destaque ? 5.5 : 3.5))
    .style('fill', (p) => (p.destaque ? 'var(--s2)' : 'var(--s1)')).style('fill-opacity', (p) => (p.destaque ? 1 : 0.5)).style('stroke', 'var(--panel)').style('stroke-width', 1);
  const anel = svg.append('circle').attr('r', 7).style('fill', 'none').style('stroke', 'var(--fg)').style('stroke-width', 2).style('display', 'none');
  const t = dica(el), del = Delaunay.from(pts, (p) => x(p.x), (p) => y(p.y));
  svg.append('rect').attr('width', W).attr('height', H).style('fill', 'transparent')
    .on('pointermove', (ev: PointerEvent) => {
      const [px, py] = pointer(ev);
      const p = pts[del.find(px, py)];
      if (!p) return;
      anel.attr('cx', x(p.x)).attr('cy', y(p.y)).style('display', null);
      linhasDica(t, [[`${p.rotulo}  `, ''], ['Cobertura ', o.fx(p.x)], ['Infarto ', o.fy(p.y)]]);
      const k = el.clientWidth / W;
      posiciona(t, el, x(p.x) * k, y(p.y) * k - 24);
    })
    .on('pointerleave', () => { anel.style('display', 'none'); t.hidden = true; });
}

const GRADE: Record<string, [number, number]> = { RR: [1, 0], AP: [3, 0], AM: [1, 1], PA: [2, 1], MA: [3, 1], CE: [4, 1], RN: [5, 1], AC: [0, 2], RO: [1, 2], TO: [2, 2], PI: [3, 2], PB: [4, 2], PE: [5, 2], MT: [1, 3], GO: [2, 3], BA: [3, 3], SE: [4, 3], AL: [5, 3], MS: [1, 4], DF: [2, 4], MG: [3, 4], ES: [4, 4], SP: [2, 5], RJ: [3, 5], PR: [2, 6], SC: [2, 7], RS: [2, 8] };

export function mapaQuadrados(el: HTMLElement, valores: Map<string, number | null>, o: { cor: string; selecionada: string; nome: (uf: string) => string; aoEscolher: (uf: string) => void }) {
  el.replaceChildren();
  const nums = [...valores.values()].filter((v): v is number => v != null);
  const [lo, hi] = extent(nums) as [number, number];
  Object.entries(GRADE).forEach(([uf, [c, l]]) => {
    const v = valores.get(uf) ?? null;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    b.style.gridColumn = String(c + 1);
    b.style.gridRow = String(l + 1);
    b.setAttribute('aria-pressed', String(o.selecionada === uf));
    b.setAttribute('aria-label', `${o.nome(uf)}: ${v == null ? 'sem dado' : fDec(v)}. Ver este estado.`);
    const sw = document.createElement('span');
    sw.className = 'sw';
    if (v != null) sw.style.background = `color-mix(in oklab, ${o.cor} ${Math.round(14 + 80 * (hi === lo ? 0.5 : (v - lo) / (hi - lo)))}%, var(--panel))`;
    const tl = document.createElement('span'); tl.className = 'tl'; tl.textContent = uf;
    const tv = document.createElement('span'); tv.className = 'tv'; tv.textContent = v == null ? '—' : fInt(v);
    b.append(sw, tl, tv);
    b.addEventListener('click', () => o.aoEscolher(uf));
    el.appendChild(b);
  });
}
