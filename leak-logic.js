// Pure logic for ¿Cuál se filtró más? — no DOM, so node can test it.
(function (root) {
  // Everybody already knows 123456 wins; these never appear in the daily ten.
  const GENERIC = new Set(["123456", "12345678", "123456789", "qwerty", "abc123",
    "111111", "000000", "1234", "2025", "1990"]);
  const MIN_RATIO = 1.25, MAX_RATIO = 10;

  // Words added after launch join the draw only from their date, so a day already
  // played (and saved on someone's phone) keeps its ten pairs.
  const DEBUT = {
    "2026-11-14": "necaxa pachuca xolos tuzos aguilas americanista leon barcelona realmadrid messi chicharito jose juan carlos miguel luis javier ricardo fernando roberto gabriela alejandra adriana veronica patricia rosa carmen maria ximena valeria regina santiago emiliano diego tequiero mibebe bebe novio novia mireina reina hermosa bonita guapo carino mexicano cerveza mezcal chilango guey frijol tortilla mariachi futbol tamal elote churro conejo aguila lobo diostebendiga jehova oaxaca cancun tijuana merida veracruz sinaloa chihuahua jalisco michoacan acapulco chiapas morelia queretaro",
  };
  const since = {};
  for (const [d, ws] of Object.entries(DEBUT)) for (const w of ws.split(" ")) since[w] = d;

  function playable(counts, a, b) {
    const x = counts[a], y = counts[b];
    if (!(x > 0 && y > 0) || x === y) return false;
    const r = Math.max(x, y) / Math.min(x, y);
    return r >= MIN_RATIO && r <= MAX_RATIO;
  }

  // mulberry32: same date -> same ten pairs on every device.
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function dateSeed(iso) { return Number(iso.replace(/-/g, "")); }

  // Ten pairs, no password used twice in one day.
  function dailyPairs(counts, iso, n = 10) {
    const words = Object.keys(counts).filter(w => !GENERIC.has(w) && !(since[w] > iso)).sort();
    const r = rng(dateSeed(iso));
    const used = new Set(), out = [];
    for (let tries = 0; out.length < n && tries < 5000; tries++) {
      const a = words[Math.floor(r() * words.length)];
      const b = words[Math.floor(r() * words.length)];
      if (a === b || used.has(a) || used.has(b) || !playable(counts, a, b)) continue;
      used.add(a); used.add(b);
      out.push(r() < 0.5 ? [a, b] : [b, a]);
    }
    return out;
  }

  function isRight(counts, pair, pick) {
    const other = pair[0] === pick ? pair[1] : pair[0];
    return counts[pick] > counts[other];
  }

  function fmt(n) { return n.toLocaleString("es-MX"); }

  function ratioText(x, y) {
    const r = Math.max(x, y) / Math.min(x, y);
    return r >= 2 ? `${Math.round(r * 10) / 10} veces más` : `${Math.round((r - 1) * 100)}% más`;
  }

  // HIBP range body "SUFFIX:COUNT\r\n..." -> count for this full SHA-1 (hex, upper).
  function countInRange(body, sha1) {
    const suf = sha1.slice(5).toUpperCase();
    for (const line of body.split(/\r?\n/)) {
      const [s, n] = line.trim().split(":");
      if (s === suf) return Number(n);
    }
    return 0;
  }

  // What a reload brings back: today's picks, in order, only while each one is still a
  // word of its pair. Anything else (another day, a stale data set, junk) starts fresh.
  function restore(saved, iso, pairs) {
    if (!saved || saved.date !== iso || !Array.isArray(saved.picks)) return [];
    const out = [];
    for (let k = 0; k < saved.picks.length && k < pairs.length; k++) {
      if (!pairs[k].includes(saved.picks[k])) return [];
      out.push(saved.picks[k]);
    }
    return out;
  }

  // The message a player sends the family: score, one mark per pair, the link.
  function shareText(counts, pairs, picks, iso, url) {
    const marks = picks.map((w, k) => (isRight(counts, pairs[k], w) ? "✅" : "❌"));
    const right = marks.filter(m => m === "✅").length;
    return `¿Cuál se filtró más? ${iso}: ${right}/${pairs.length}\n${marks.join("")}\n${url}`;
  }

  // The day in review, one row per pair played: the more-leaked word first, both counts,
  // what the player tapped and whether it was right.
  function review(counts, pairs, picks) {
    return picks.map((pick, k) => {
      const p = pairs[k], [hi, lo] = counts[p[0]] > counts[p[1]] ? p : [p[1], p[0]];
      return { hi, lo, hiN: counts[hi], loN: counts[lo], pick, ok: pick === hi };
    });
  }

  // Days played, kept on the phone as {"YYYY-MM-DD": right}. A finished day is recorded
  // once (a reload rewrites the same score); junk in storage starts an empty history.
  function record(hist, iso, right) {
    const h = hist && typeof hist === "object" && !Array.isArray(hist) ? { ...hist } : {};
    h[iso] = right;
    return h;
  }
  // Calendar day before iso, in UTC so a DST night or month end never skips or repeats one.
  function dayBefore(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
  }
  // current: days in a row ending today (or yesterday, if today is not played yet);
  // best: the longest such run ever; played: days with a score.
  function streak(hist, iso) {
    const days = Object.keys(hist || {}).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && d <= iso).sort();
    const has = new Set(days);
    let current = 0, d = has.has(iso) ? iso : dayBefore(iso);
    while (has.has(d)) { current++; d = dayBefore(d); }
    let best = 0, run = 0, prev = null;
    for (const x of days) { run = prev && dayBefore(x) === prev ? run + 1 : 1; best = Math.max(best, run); prev = x; }
    return { current, best, played: days.length };
  }

  const api = { GENERIC, since, playable, dailyPairs, isRight, fmt, ratioText, countInRange, rng, restore, shareText, review, record, dayBefore, streak };
  if (typeof module !== "undefined") module.exports = api; else root.Leak = api;
})(this);
