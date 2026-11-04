(function () {
  const C = window.COUNTS, L = window.Leak;
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD, local
  const pairs = L.dailyPairs(C, today);
  let i = 0, right = 0;
  const $ = id => document.getElementById(id);

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
    if (ok) right++;
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

  $("next").onclick = () => {
    if (++i < pairs.length) return show();
    $("game").hidden = true; $("done").hidden = false;
    $("score").textContent = `${right} de ${pairs.length}`;
    $("share-line").textContent = `¿Cuál se filtró más? ${today}: ${right}/${pairs.length}. Mañana hay otras diez.`;
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
      out.className = n ? "bad" : "ok";
      out.textContent = n ? `Apareció ${L.fmt(n)} veces en filtraciones. Cámbiala donde la uses.`
                          : "No aparece en ninguna filtración conocida. Eso no la hace segura, pero es buena señal.";
    } catch (e) {
      out.className = ""; out.textContent = "No se pudo consultar ahora (¿sin internet?).";
    }
    $("mine").value = "";
  };

  show();
})();
