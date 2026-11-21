(function () {
  const C = window.COUNTS, L = window.Leak;
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local
  const pairs = L.dailyPairs(C, today);
  const KEY = "cual-se-filtro", URL = "https://matmat202.github.io/cual-se-filtro/";
  const $ = id => document.getElementById(id);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  const picks = L.restore(saved, today, pairs);
  let i = picks.length;
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ date: today, picks })); } catch (e) {} }

  function show() {
    const p = pairs[i];
    $("progress").textContent = `${i + 1} de ${pairs.length}`;
    $("verdict").textContent = "";
    $("next").hidden = true;
    $("pair").replaceChildren(...p.map(w => {
      const b = document.createElement("button");
      b.className = "pw"; b.textContent = w; b.dataset.w = w;
      b.onclick = () => pick(w);
      return b;
    }));
  }

  function pick(w) {
    const p = pairs[i], ok = L.isRight(C, p, w);
    picks.push(w); save();
    const [hi, lo] = C[p[0]] > C[p[1]] ? p : [p[1], p[0]];
    for (const b of $("pair").children) {
      b.disabled = true;
      b.classList.add(b.dataset.w === hi ? "win" : "lose");
      const n = document.createElement("span");
      n.className = "n"; n.textContent = L.fmt(C[b.dataset.w]) + " veces";
      b.append(n);
    }
    $("verdict").innerHTML = "";
    const s = document.createElement("span");
    s.className = ok ? "ok" : "bad"; s.textContent = ok ? "¡Correcto! " : "No. ";
    $("verdict").append(s, `“${hi}” aparece ${L.ratioText(C[hi], C[lo])} que “${lo}”.`);
    $("next").hidden = false;
    $("next").textContent = i + 1 < pairs.length ? "Siguiente" : "Ver resultado";
    $("next").focus();
  }

  function finish() {
    const right = picks.filter((w, k) => L.isRight(C, pairs[k], w)).length;
    $("game").hidden = true; $("done").hidden = false;
    $("score").textContent = `${right} de ${pairs.length}`;
    let hist = null;
    try { hist = JSON.parse(localStorage.getItem(KEY + "-dias")); } catch (e) {}
    hist = L.record(hist, today, right);
    try { localStorage.setItem(KEY + "-dias", JSON.stringify(hist)); } catch (e) {}
    const st = L.streak(hist, today), dias = n => n === 1 ? "1 día" : `${n} días`;
    $("streak").textContent = `🔥 Racha: ${st.current === 1 ? "1 día" : dias(st.current) + " seguidos"}` +
      (st.best > st.current ? ` · tu mejor racha: ${dias(st.best)}` : "") + ` · ${dias(st.played)} jugados`;
    $("share-line").textContent = L.shareText(C, pairs, picks, today, URL).split("\n")[1] + " · Mañana hay otras diez.";
    $("review").replaceChildren(...L.review(C, pairs, picks).map(row));
  }

  // One answer row: [mark] winner (count) > loser (count); the player's tap underlined.
  function row(r) {
    const li = document.createElement("li");
    if (r.pick !== undefined) {
      li.className = r.ok ? "ok-row" : "bad-row";
      const mark = document.createElement("span");
      mark.className = "mark"; mark.textContent = r.ok ? "✅" : "❌";
      mark.setAttribute("aria-label", r.ok ? "acertaste" : "fallaste");
      li.append(mark);
    }
    const cell = (w, n) => {
      const d = document.createElement("span");
      d.className = "w" + (w === r.pick ? " picked" : "");
      const b = document.createElement("b"); b.textContent = w;
      const c = document.createElement("span"); c.className = "c"; c.textContent = L.fmt(n);
      d.append(b, c);
      return d;
    };
    const gt = document.createElement("span"); gt.className = "gt"; gt.textContent = ">";
    li.append(cell(r.hi, r.hiN), gt, cell(r.lo, r.loN));
    return li;
  }

  // Yesterday's answers, for whoever missed the day. The game began 2026-11-03.
  const ayer = L.yesterday(C, today);
  if (ayer.date >= "2026-11-03" && ayer.rows.length) {
    const [y, m, d] = ayer.date.split("-").map(Number);
    $("ayer-date").textContent = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
    $("ayer-list").replaceChildren(...ayer.rows.map(row));
    $("ayer").hidden = false;
  }

  $("next").onclick = () => (++i < pairs.length ? show() : finish());

  $("share").onclick = async () => {
    const text = L.shareText(C, pairs, picks, today, URL);
    try {
      if (navigator.share) return await navigator.share({ text });
      await navigator.clipboard.writeText(text);
      $("share-out").textContent = "Copiado. Pégalo en el chat de la familia.";
    } catch (e) {
      if (e && e.name === "AbortError") return;
      $("share-out").textContent = text;
    }
  };

  $("check").onclick = async () => {
    const pw = $("mine").value, out = $("mine-out");
    if (!pw) return;
    out.textContent = "Revisando…";
    try {
      const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(pw));
      const hex = [...new Uint8Array(buf)].map(x => x.toString(16).padStart(2, "0")).join("").toUpperCase();
      const r = await fetch("https://api.pwnedpasswords.com/range/" + hex.slice(0, 5), { headers: { "Add-Padding": "true" } });
      const n = L.countInRange(await r.text(), hex);
      const v = L.verdict(C, n, pw);
      out.className = v.cls; out.textContent = v.text;
    } catch (e) {
      out.className = ""; out.textContent = "No se pudo consultar ahora (¿sin internet?).";
    }
    $("mine").value = "";
  };
  // The phone keyboard's "Ir"/Enter checks too.
  $("mine").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); $("check").click(); } };

  if (i >= pairs.length) finish(); else show();
})();
