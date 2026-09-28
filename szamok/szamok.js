/* ============================================================
   tothdavid.eu / szamok
   Collects ten made-up numbers per person. Says nothing about
   what they're for; the server does the real checking.
   ============================================================ */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const hu = {
    docTitle: "Tíz szám",
    title: "Tíz szám",
    lede: "Írj be 10 különböző pozitív egész számot 1 és 9999 között. Találd ki őket fejben: ne használj véletlenszám-generátort, és ne nézz meg hozzá semmit.",
    numsLegend: "A tíz szám",
    numLabel: ({ i }) => `${i}. szám`,
    nameLabel: "Neved (nem kötelező)",
    send: "Beküldés",
    sending: "Küldés…",
    doneBig: "Köszönjük!",
    doneText: "A számaidat megkaptuk.",
    e_count: "Add meg mind a 10 számot.",
    e_range: "Minden szám 1 és 9999 közötti egész szám legyen.",
    e_repeat: "Mind a 10 szám legyen különböző.",
    e_sequence: "Ezek egy szabályos sort alkotnak (például 1, 2, 3…). Találj ki inkább egymástól független számokat.",
    e_pattern: "Túl sok az ismétlődő számjegyekből álló szám (11, 222…). Találj ki változatosabbakat.",
    e_copy: "Ezek a számok nagyon hasonlítanak egy korábbi beküldésre. Találj ki sajátokat.",
    e_already: "Erről az eszközről már beküldtél számokat. Köszönjük!",
    e_closed: "A gyűjtés most szünetel.",
    e_busy: "Túl sok beküldés érkezett innen rövid idő alatt. Várj pár percet, és próbáld újra.",
    e_other: "Valami hiba történt. Próbáld újra egy kicsit később.",
  };

  const en = {
    docTitle: "Ten numbers",
    title: "Ten numbers",
    lede: "Type 10 different whole numbers between 1 and 9999. Make them up in your head: don't use a random number generator, and don't look anything up.",
    numsLegend: "The ten numbers",
    numLabel: ({ i }) => `Number ${i}`,
    nameLabel: "Your name (optional)",
    send: "Send",
    sending: "Sending…",
    doneBig: "Thank you!",
    doneText: "We've got your numbers.",
    e_count: "Fill in all 10 numbers.",
    e_range: "Each number should be a whole number between 1 and 9999.",
    e_repeat: "All 10 numbers should be different.",
    e_sequence: "These form a regular sequence (like 1, 2, 3…). Try numbers that have nothing to do with each other.",
    e_pattern: "Too many numbers made of one repeated digit (11, 222…). Try more varied ones.",
    e_copy: "These are very close to numbers someone already sent. Make up your own.",
    e_already: "You've already sent numbers from this device. Thank you!",
    e_closed: "Collection is paused right now.",
    e_busy: "Too many submissions from here in a short time. Wait a few minutes and try again.",
    e_other: "Something went wrong. Try again in a little while.",
  };

  const I18N = window.I18N;
  I18N.define({ hu, en }, "hu");
  const t = I18N.t;

  /* ---------------- fields ---------------- */

  const grid = $("num-grid");
  const inputs = [];
  for (let i = 1; i <= 10; i++) {
    const label = document.createElement("label");
    label.className = "num";
    const idx = document.createElement("span");
    idx.className = "num-i";
    idx.textContent = i;
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.maxLength = 6;
    input.dataset.i = i;
    label.append(idx, input);
    grid.appendChild(label);
    inputs.push(input);
  }
  const labelInputs = () => inputs.forEach((inp, k) => inp.setAttribute("aria-label", t("numLabel", { i: k + 1 })));
  labelInputs();

  // "1 234" and "1.234" are both fine for a whole number; "3.5" is not
  const parse = (s) => {
    let clean = String(s).replace(/[\s  ]/g, "");
    if (/^\d{1,3}(\.\d{3})+$/.test(clean)) clean = clean.replace(/\./g, "");
    return /^\d+$/.test(clean) ? Number(clean) : NaN;
  };

  // Mirrors the server's hard rules so people get told straight away.
  // The server still decides.
  function localProblem(nums) {
    if (nums.some((n) => Number.isNaN(n))) return nums.some((n, i) => inputs[i].value.trim() === "") ? "count" : "range";
    if (nums.some((n) => n < 1 || n > 9999)) return "range";
    if (new Set(nums).size !== nums.length) return "repeat";
    const s = [...nums].sort((a, b) => a - b);
    if (s.every((n, i) => i === 0 || n - s[i - 1] === s[1] - s[0])) return "sequence";
    return null;
  }

  function markFields(nums, problem) {
    const counts = new Map();
    nums.forEach((n) => counts.set(n, (counts.get(n) || 0) + 1));
    inputs.forEach((inp, i) => {
      const n = nums[i];
      const bad = (problem === "count" && inp.value.trim() === "")
        || (problem === "range" && (Number.isNaN(n) || n < 1 || n > 9999))
        || (problem === "repeat" && counts.get(n) > 1);
      inp.classList.toggle("is-bad", !!bad);
    });
  }

  /* ---------------- device + round ---------------- */

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: server still checks */ } },
  };

  function deviceId() {
    let id = store.get("szamok:device");
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/[^\w-]/g, "");
      store.set("szamok:device", id);
    }
    return id;
  }

  let round = null;
  let lastMsg = null;

  function showMsg(key) {
    lastMsg = key;
    $("msg").textContent = key ? t(key) : "";
    $("msg").classList.toggle("is-error", !!key);
  }

  function showDone(key) {
    $("form").hidden = true;
    $("done").hidden = false;
    if (key) {
      $("done-text").dataset.i18n = key;
      $("done-text").textContent = t(key);
    }
  }

  async function checkRound() {
    try {
      const res = await fetch("/api/submit", { cache: "no-store" });
      if (!res.ok) return;
      const info = await res.json();
      round = info.round;
      if (store.get("szamok:done:" + round)) showDone("e_already");
      else if (!info.open) showMsg("e_closed");
    } catch { /* offline: the submit will say so */ }
  }

  /* ---------------- submit ---------------- */

  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nums = inputs.map((inp) => parse(inp.value));
    const problem = localProblem(nums);
    markFields(nums, problem);
    if (problem) {
      showMsg("e_" + problem);
      return;
    }

    const btn = $("send");
    btn.disabled = true;
    btn.textContent = t("sending");
    showMsg(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nums, name: $("name").value, device: deviceId(), website: $("website").value }),
      });
      const out = await res.json().catch(() => ({}));
      if (out.ok) {
        if (round) store.set("szamok:done:" + round, "1");
        showDone();
      } else if (out.error === "already") {
        if (round) store.set("szamok:done:" + round, "1");
        showDone("e_already");
      } else {
        showMsg(hu["e_" + out.error] ? "e_" + out.error : "e_other");
      }
    } catch {
      showMsg("e_other");
    } finally {
      btn.disabled = false;
      btn.textContent = t("send");
    }
  });

  // clear the red mark once someone edits a field
  grid.addEventListener("input", (e) => e.target.classList.remove("is-bad"));

  I18N.onChange(() => {
    labelInputs();
    if (lastMsg) showMsg(lastMsg);
    if (!$("send").disabled) $("send").textContent = t("send");
  });

  checkRound();
})();
