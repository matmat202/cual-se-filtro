// Pure logic for ¿Cuál se filtró más? — no DOM, so node can test it.
(function (root) {
  // Everybody already knows 123456 wins; these never appear in the daily ten.
  const GENERIC = new Set(["123456", "12345678", "123456789", "qwerty", "abc123",
    "111111", "000000", "1234", "2025", "1990"]);
  const MIN_RATIO = 1.25, MAX_RATIO = 10;

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
    const words = Object.keys(counts).filter(w => !GENERIC.has(w)).sort();
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

  const api = { GENERIC, playable, dailyPairs, isRight, fmt, ratioText, countInRange, rng };
  if (typeof module !== "undefined") module.exports = api; else root.Leak = api;
})(this);
