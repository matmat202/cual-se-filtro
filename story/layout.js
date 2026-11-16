/* Where every mark sits on each step of the story. Pure: no DOM, so test/story.test.mjs
 * runs every layout at several plot sizes.
 *
 * "words": one dot per password in play, at log10 of its leak count, one row per category
 * of words.txt (its two batches' "amor" and "ciudades" rows merged); names red. "pairs": one square-ish dot per pair of a year of games with
 * exactly one name in it, red if the name leaked more. "shuffle": 1,000 random word sets
 * given the name label, stacked by their win rate, with the real names as one red dot.
 */
export const COL = { name: '#b3261e', other: '#8a857e', lost: '#cfcac3', ink: '#1d1a18', faint: '#cfcac3' };
export const LOG = [2, 7];        // words: log10 of the count
export const RATE = [0.3, 0.9];   // shuffle: share of mixed pairs the group won
export const BIN = 0.01;

export const STEPS = { words: 'words', pairs: 'pairs', shuffle: 'shuffle' };

export const isName = (D, i) => D.words[i].cat === D.names;
/* category rows, names first, in the order words.txt lists them */
export const row = (c) => (c.startsWith('amor') ? 'amor' : c.includes('ciudades') ? 'ciudades' : c);
export const cats = (D) => { const s = [D.names]; for (const w of D.words) if (!s.includes(row(w.cat))) s.push(row(w.cat)); return s; };
/* the pairs with exactly one name, as [name index, other index] */
export const mixed = (D) => D.pairs.filter(([a, b]) => isName(D, a) !== isName(D, b)).map(([a, b]) => (isName(D, a) ? [a, b] : [b, a]));
export const won = (D, [x, y]) => D.words[x].n > D.words[y].n;

/* -> {kind, X, Y, words: [{x,y,r,fill,op}], pairs: [...], shuffles: [...], real} in px of w x h */
export function layout(name, D, w, h) {
  if (!STEPS[name]) throw new Error(`unknown step ${name}`);
  const pad = 8;
  const none = () => ({ x: w / 2, y: h / 2, r: 0, op: 0, fill: COL.faint });
  const M = mixed(D);
  const out = { kind: name, words: D.words.map(none), pairs: M.map(none), shuffles: D.shuffles.map(none), real: none() };
  if (name === 'words') {
    const C = cats(D);
    const X = (v) => pad + ((Math.log10(v) - LOG[0]) / (LOG[1] - LOG[0])) * (w - 2 * pad);
    const rowH = (h - 2 * pad) / C.length;
    const Y = (k) => pad + rowH * (k + 0.5);
    const r = Math.max(2.5, Math.min(5, w / 160));
    // dodge: within a row, a dot closer than 2r to the one before it moves up/down a notch
    const seen = C.map(() => []);
    out.words = D.words.map((d, i) => {
      const k = C.indexOf(row(d.cat)), x = X(d.n);
      const near = seen[k].filter((x0) => Math.abs(x0 - x) < 2 * r).length;
      seen[k].push(x);
      const off = near === 0 ? 0 : (near % 2 ? -1 : 1) * Math.ceil(near / 2) * r * 1.2;
      return { x, y: Y(k) + Math.max(-rowH / 2 + r, Math.min(rowH / 2 - r, off)), r, fill: isName(D, i) ? COL.name : COL.other, op: 0.9 };
    });
    return { ...out, X, Y, C };
  }
  if (name === 'pairs') {
    // waffle: names that won first, then the rest, filled row by row
    const order = M.map((p, k) => [won(D, p) ? 0 : 1, k]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[1]);
    const cols = Math.max(10, Math.round(Math.sqrt((M.length * (w - 2 * pad)) / (h - 2 * pad))));
    const rows = Math.ceil(M.length / cols);
    const cell = Math.min((w - 2 * pad) / cols, (h - 2 * pad) / rows);
    const r = Math.max(1, cell * 0.42);
    const pos = [];
    order.forEach((k, j) => { pos[k] = j; });
    out.pairs = M.map((p, k) => {
      const j = pos[k];
      return { x: pad + cell * ((j % cols) + 0.5), y: pad + cell * (Math.floor(j / cols) + 0.5), r, fill: won(D, p) ? COL.name : COL.lost, op: 1 };
    });
    return { ...out, cols, rows, cell };
  }
  const X = (v) => pad + ((v - RATE[0]) / (RATE[1] - RATE[0])) * (w - 2 * pad);
  const bins = {};
  const most = Math.max(...Object.values(D.shuffles.reduce((m, v) => { const b = Math.round(v / BIN); m[b] = (m[b] || 0) + 1; return m; }, {})));
  const r = Math.max(1, Math.min(4, (h - 2 * pad) / (2 * most + 2), (w - 2 * pad) / ((RATE[1] - RATE[0]) / BIN) / 2.2));
  out.shuffles = D.shuffles.map((v) => {
    const b = Math.round(v / BIN), k = (bins[b] = (bins[b] || 0) + 1) - 1;
    return { x: X(b * BIN), y: h - pad - r - k * 2 * r, r, fill: COL.other, op: 0.7 };
  });
  const rate = M.filter((p) => won(D, p)).length / M.length;
  out.real = { x: X(rate), y: h - pad - 3 * r, r: Math.max(5, 3 * r), fill: COL.name, op: 1 };
  return { ...out, X };
}
