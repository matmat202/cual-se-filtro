/* The scrolling story: each <section class="step"> names a layout in data-step; as the
 * reader scrolls into a step, the marks move to their place in that layout. Numbers in
 * the prose are not typed in: a <b data-fact="..."> is computed here from story.json's
 * rows, and test/story.test.mjs checks each against the `check` block build_story.py
 * computed in python. Modelled on which-way/site/story. */
import { layout, mixed, won, isName, cats, STEPS, LOG, RATE, COL } from './layout.js';

const fmt = (n) => n.toLocaleString('es-MX');
const pct = (v) => `${Math.round(v * 100)}%`;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

export function numbers(D) {
  const M = mixed(D);
  const W = M.filter((p) => won(D, p)).length;
  const per = {};
  for (const p of M) { const r = (per[p[0]] ||= [0, 0]); r[0] += won(D, p); r[1]++; }
  const uniq = new Map(M.map((p) => [p.join(','), p]));
  const nm = D.words.filter((_, i) => isName(D, i)).map((w) => w.n), ot = D.words.filter((_, i) => !isName(D, i)).map((w) => w.n);
  const rate = W / M.length;
  return {
    n_pairs: D.pairs.length, n_mixed: M.length, won: W, rate,
    n_names: nm.length, n_play: D.words.length,
    sh_max: Math.max(...D.shuffles), sh_med: median(D.shuffles), as_high: D.shuffles.filter((v) => v >= rate).length,
    worst: Math.min(...Object.values(per).map(([a, b]) => a / b)),
    n_uniq: uniq.size, uniq_rate: [...uniq.values()].filter((p) => won(D, p)).length / uniq.size,
    med_name: median(nm), med_other: median(ot),
    smallest: D.words.filter((_, i) => isName(D, i)).reduce((a, b) => (b.n < a.n ? b : a)),
  };
}

/* "rate" -> "80%". Unknown names throw: a typo must not render as blank */
export function fact(D, spec) {
  const N = numbers(D);
  switch (spec) {
    case 'n_pairs': return fmt(N.n_pairs);
    case 'days': return fmt(D.days);
    case 'n_mixed': return fmt(N.n_mixed);
    case 'won': return fmt(N.won);
    case 'lost': return fmt(N.n_mixed - N.won);
    case 'rate': return pct(N.rate);
    case 'n_names': return fmt(N.n_names);
    case 'n_play': return fmt(N.n_play);
    case 'n_sh': return fmt(D.shuffles.length);
    case 'sh_med': return pct(N.sh_med);
    case 'sh_max': return pct(N.sh_max);
    case 'worst': return pct(N.worst);
    case 'n_uniq': return fmt(N.n_uniq);
    case 'uniq_rate': return pct(N.uniq_rate);
    case 'med_name': return fmt(N.med_name);
    case 'med_other': return fmt(N.med_other);
    case 'med_x': return `${Math.round(N.med_name / N.med_other)}`;
    case 'smallest': return N.smallest.w;
    case 'smallest_n': return fmt(N.smallest.n);
    default: throw new Error(`unknown fact ${spec}`);
  }
}

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
/* words labelled on the strip: the biggest and smallest name, the biggest other word */
export const labelled = (D) => {
  const ix = D.words.map((_, i) => i), nm = ix.filter((i) => isName(D, i)), ot = ix.filter((i) => !isName(D, i));
  const by = (xs, f) => xs.reduce((a, b) => (f(D.words[b].n, D.words[a].n) ? b : a));
  return [by(nm, (a, b) => a > b), by(nm, (a, b) => a < b), by(ot, (a, b) => a > b)];
};

async function main() {
  const D = await (await fetch('story.json')).json();
  for (const e of document.querySelectorAll('[data-fact]')) e.textContent = fact(D, e.dataset.fact);
  const steps = [...document.querySelectorAll('.step')];
  for (const s of steps) if (!STEPS[s.dataset.step]) throw new Error(`unknown step ${s.dataset.step}`);
  const plot = document.getElementById('plot');
  const svg = el('svg', { id: 'chart' });
  const gAxis = el('g', { class: 'axis' }), gW = el('g'), gP = el('g'), gS = el('g'), gR = el('g'), gLab = el('g', { class: 'labels' });
  svg.append(gAxis, gS, gP, gW, gR, gLab);
  plot.append(svg);
  const mk = (g, rows, title) => rows.map((r, k) => {
    const c = g.appendChild(el('circle', { r: 0 }));
    c.append(el('title')); c.firstChild.textContent = title(r, k);
    return c;
  });
  const wDots = mk(gW, D.words, (w) => `${w.w}: ${fmt(w.n)} veces`);
  const M = mixed(D);
  const pDots = mk(gP, M, ([x, y]) => `${D.words[x].w} (${fmt(D.words[x].n)}) contra ${D.words[y].w} (${fmt(D.words[y].n)})`);
  const sDots = mk(gS, D.shuffles, (v, k) => `sorteo ${k + 1}: gana ${pct(v)}`);
  const rDot = mk(gR, [0], () => 'los nombres de verdad')[0];
  const tick = (x, y, text, cls = 'tick') => { const t = el('text', { x, y, class: cls }); t.textContent = text; gAxis.append(t); };
  const grid = (x1, y1, x2, y2) => gAxis.append(el('line', { x1, x2, y1, y2, class: 'grid' }));

  let shown = -1;
  const draw = (i) => {
    const name = steps[i].dataset.step;
    const box = plot.getBoundingClientRect(), W = box.width, H = box.height;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const L = layout(name, D, W, H);
    for (const [dots, lay] of [[wDots, L.words], [pDots, L.pairs], [sDots, L.shuffles], [[rDot], [L.real]]]) lay.forEach((d, k) => {
      const c = dots[k];
      c.style.transform = `translate(${d.x}px, ${d.y}px)`;
      c.setAttribute('r', d.r);
      c.style.fill = d.fill;
      c.style.opacity = d.op;
    });
    gAxis.replaceChildren(); gLab.replaceChildren();
    const labs = [];
    if (name === 'words') {
      for (let v = LOG[0]; v <= LOG[1]; v++) { grid(L.X(10 ** v), 0, L.X(10 ** v), H); tick(L.X(10 ** v), H + 16, fmt(10 ** v), 'tick mid'); }
      tick(W / 2, H + 32, 'veces vista en filtraciones (escala logarítmica)', 'tick mid');
      L.C.forEach((c, k) => tick(4, L.Y(k) - (H / L.C.length) * 0.5 + 12, c, 'tick cat'));
      // the smallest name's label goes under its dot, so it can't meet the biggest name's on a phone
      labelled(D).forEach((k, j) => labs.push([L.words[k], D.words[k].w, j === 1]));
    } else if (name === 'pairs') {
      tick(0, -6, `${fmt(M.length)} pares con un nombre: rojo si ganó el nombre`, 'tick');
      tick(0, H + 16, 'cada punto, un par', 'tick');
      tick(W, H + 16, `${L.cols} por fila`, 'tick end');
    } else {
      for (let v = RATE[0]; v <= RATE[1] + 1e-9; v += 0.1) { grid(L.X(v), 0, L.X(v), H); tick(L.X(v), H + 16, pct(v), 'tick mid'); }
      tick(W / 2, H + 32, 'pares ganados por el grupo', 'tick mid');
      labs.push([L.real, 'los nombres']);
    }
    for (const [d, text, below] of labs) {
      gLab.append(el('circle', { cx: d.x, cy: d.y, r: d.r + 2.5, class: 'ring' }));
      const right = d.x < W * 0.6;
      const tx = el('text', { x: d.x + (right ? 1 : -1) * (d.r + 5), y: below ? d.y + d.r + 13 : d.y - d.r - 3, class: `lab${right ? '' : ' end'}` });
      tx.textContent = text;
      gLab.append(tx);
    }
    document.body.dataset.step = i;
    window.__story = { step: i, name, shown: [...L.words, ...L.pairs, ...L.shuffles, L.real].filter((d) => d.op > 0).length };
  };

  const pick = () => {
    const line = innerHeight * 0.5;
    let i = 0;
    for (let k = 0; k < steps.length; k++) if (steps[k].getBoundingClientRect().top < line) i = k;
    if (i !== shown) { shown = i; draw(i); }
  };
  addEventListener('scroll', pick, { passive: true });
  addEventListener('resize', () => { shown = -1; pick(); });
  pick();
}

export { COL, cats };

if (typeof document !== 'undefined') main().catch((e) => {
  document.body.classList.add('failed');
  document.getElementById('err').textContent = String(e.message || e);
  console.error(e);
});
