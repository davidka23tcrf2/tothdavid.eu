/* ============================================================
   tothdavid.eu / szamok / admin
   The only place the collected numbers can be seen. Every call
   carries the password; the server checks it each time.
   ============================================================ */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const hu = {
    docTitle: "Beküldött számok · Admin",
    title: "Beküldött számok",
    logout: "Kilépés",
    password: "Jelszó",
    signIn: "Belépés",
    badPassword: "Hibás jelszó.",
    locked: "Túl sok hibás próbálkozás. Várj 15 percet.",
    netError: "Nem sikerült elérni a szervert.",
    setupH: "Még nincs beállítva",
    setupBody: `<ol>
      <li>Az <b>upstash.com</b> oldalon regisztrálj (ingyenes, bankkártya nem kell), és hozz létre egy <b>Redis</b> adatbázist a Free csomaggal, lehetőleg Frankfurt (eu-central-1) régióban.</li>
      <li>Az adatbázis oldalán, a <b>REST API</b> résznél másold ki az <code>UPSTASH_REDIS_REST_URL</code> és az <code>UPSTASH_REDIS_REST_TOKEN</code> értékét.</li>
      <li>A Vercel projektben a <b>Settings → Environment Variables</b> alatt add hozzá ezt a kettőt, és egy <code>ADMIN_PASSWORD</code> változót a választott jelszóval.</li>
      <li>Telepítsd újra az oldalt (Deployments → Redeploy), majd töltsd újra ezt az oldalt.</li>
    </ol>`,
    roundLabel: "Kör",
    collecting: "gyűjt",
    open: "Gyűjtés folyamatban",
    closed: "Gyűjtés szünetel",
    inactive: "Nem ebbe a körbe gyűjt",
    pause: "Gyűjtés szüneteltetése",
    resume: "Gyűjtés folytatása",
    makeCurrent: "Legyen ez a gyűjtő kör",
    newRoundLabel: "Új kör neve",
    newRoundPh: "pl. 11.B, szeptember 30.",
    newRound: "Új kör indítása",
    newRoundConfirm: "Új kört indítasz? A résztvevők ezután az új körbe küldenek, és mindenki újra beküldhet.",
    shareLabel: "A résztvevőknek ezt a címet add meg:",
    copyLink: "Link másolása",
    figSubs: "Beküldés",
    figNums: "Szám",
    figFlagged: "Jelölt",
    openBenford: "Megnyitás a Benford-ellenőrzőben",
    copyNums: "Számok másolása",
    dlCsv: "CSV letöltése",
    skipFlagged: "Jelölt beküldések kihagyása az exportból",
    auto: "Frissítés 10 másodpercenként (30 percig)",
    copied: "Kimásolva.",
    copyFail: "Nem sikerült a vágólapra másolni.",
    nothing: "Még nincs mit exportálni.",
    miniH: "Első számjegyek eddig, a Benford-törvény görbéjével",
    miniFew: ({ n }) => `${n} szám. A megbízható értékeléshez legalább 110 kell; a részletes elemzés a Benford-ellenőrzőben van.`,
    miniOk: ({ n }) => `${n} szám. A részletes elemzés a Benford-ellenőrzőben van.`,
    subsH: "Beküldések",
    thWhen: "Idő",
    thName: "Név",
    thNums: "Számok",
    thFlags: "Jelölés",
    noName: "névtelen",
    remove: "Törlés",
    removeConfirm: "Törlöd ezt a beküldést? Ugyanarról az eszközről ebben a körben akkor sem lehet újra beküldeni.",
    subsEmpty: "Ebben a körben még nincs beküldés.",
    f_round: "sok kerek szám",
    f_repdigits: "ismétlődő számjegyek",
    f_ascending: "növekvő sorrendben",
    f_tiny: "sok egyjegyű",
  };

  const en = {
    docTitle: "Submitted numbers · Admin",
    title: "Submitted numbers",
    logout: "Sign out",
    password: "Password",
    signIn: "Sign in",
    badPassword: "Wrong password.",
    locked: "Too many wrong attempts. Wait 15 minutes.",
    netError: "Couldn't reach the server.",
    setupH: "Not set up yet",
    setupBody: `<ol>
      <li>Sign up at <b>upstash.com</b> (free, no card needed) and create a <b>Redis</b> database on the Free plan, ideally in Frankfurt (eu-central-1).</li>
      <li>On the database page, under <b>REST API</b>, copy <code>UPSTASH_REDIS_REST_URL</code> and <code>UPSTASH_REDIS_REST_TOKEN</code>.</li>
      <li>In the Vercel project, under <b>Settings → Environment Variables</b>, add those two plus <code>ADMIN_PASSWORD</code> with the password you want.</li>
      <li>Redeploy (Deployments → Redeploy), then reload this page.</li>
    </ol>`,
    roundLabel: "Round",
    collecting: "collecting",
    open: "Collecting",
    closed: "Paused",
    inactive: "Not the collecting round",
    pause: "Pause collecting",
    resume: "Resume collecting",
    makeCurrent: "Collect into this round",
    newRoundLabel: "New round name",
    newRoundPh: "e.g. 11B, 30 September",
    newRound: "Start new round",
    newRoundConfirm: "Start a new round? People will submit into it from now on, and everyone can submit again.",
    shareLabel: "Give participants this address:",
    copyLink: "Copy link",
    figSubs: "Submissions",
    figNums: "Numbers",
    figFlagged: "Flagged",
    openBenford: "Open in the Benford checker",
    copyNums: "Copy numbers",
    dlCsv: "Download CSV",
    skipFlagged: "Leave flagged submissions out of exports",
    auto: "Refresh every 10 seconds (for 30 minutes)",
    copied: "Copied.",
    copyFail: "Couldn't reach the clipboard.",
    nothing: "Nothing to export yet.",
    miniH: "First digits so far, with Benford's law",
    miniFew: ({ n }) => `${n} numbers. A reliable assessment needs at least 110; the full analysis is in the Benford checker.`,
    miniOk: ({ n }) => `${n} numbers. The full analysis is in the Benford checker.`,
    subsH: "Submissions",
    thWhen: "Time",
    thName: "Name",
    thNums: "Numbers",
    thFlags: "Flags",
    noName: "no name",
    remove: "Delete",
    removeConfirm: "Delete this submission? The same device still can't submit again in this round.",
    subsEmpty: "No submissions in this round yet.",
    f_round: "many round numbers",
    f_repdigits: "repeated digits",
    f_ascending: "typed in ascending order",
    f_tiny: "many single digits",
  };

  const I18N = window.I18N;
  I18N.define({ hu, en });
  const t = I18N.t;
  const fmtInt = (x) => new Intl.NumberFormat(I18N.locale).format(x);

  /* ---------------- api ---------------- */

  const PW_KEY = "szamok:pw";
  const session = {
    get() { try { return sessionStorage.getItem(PW_KEY) || ""; } catch { return ""; } },
    set(v) { try { v ? sessionStorage.setItem(PW_KEY, v) : sessionStorage.removeItem(PW_KEY); } catch { /* ignore */ } },
  };
  let password = session.get();

  async function api(action, extra) {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + password },
      body: JSON.stringify({ action, ...extra }),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(out.error || "http"), { code: out.error || "http", status: res.status });
    return out;
  }

  /* ---------------- views ---------------- */

  function show(view) {
    $("login").hidden = view !== "login";
    $("setup").hidden = view !== "setup";
    $("dash").hidden = view !== "dash";
    $("logout").hidden = view !== "dash";
  }

  let data = null;          // last state from the server
  let viewing = null;       // round id on screen

  function handleError(err) {
    if (err.code === "password") { session.set(""); password = ""; show("login"); $("login-msg").textContent = t("badPassword"); }
    else if (err.code === "locked") { show("login"); $("login-msg").textContent = t("locked"); }
    else if (err.code === "not_configured" || err.code === "no_password") show("setup");
    else note(t("netError"), true);
  }

  async function load(action = "state", extra = {}) {
    try {
      data = await api(action, { round: viewing, ...extra });
      viewing = data.round.id;
      show("dash");
      render();
      return true;
    } catch (err) {
      handleError(err);
      return false;
    }
  }

  let noteT;
  function note(text, err) {
    const el = $("tools-note");
    el.textContent = text;
    el.style.color = err ? "var(--accent-lit)" : "";
    clearTimeout(noteT);
    noteT = setTimeout(() => (el.textContent = ""), 3000);
  }

  /* ---------------- rendering ---------------- */

  const when = (ts) => new Date(ts).toLocaleString(I18N.locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  function exportSubs() {
    const skip = $("skip-flagged").checked;
    return data.subs.filter((s) => !(skip && s.flags && s.flags.length));
  }

  function render() {
    if (!data) return;
    const round = data.round;

    // rounds, newest first; the collecting one is marked
    const sel = $("round-select");
    sel.innerHTML = "";
    for (const r of data.rounds) {
      const o = document.createElement("option");
      o.value = r.id;
      o.textContent = `${r.name} · ${new Date(r.created).toLocaleDateString(I18N.locale)}${r.id === data.current ? ` (${t("collecting")})` : ""}`;
      o.selected = r.id === round.id;
      sel.appendChild(o);
    }

    // only the current round receives submissions; open/closed is about that one
    const isCurrent = round.id === data.current;
    const status = $("status");
    status.textContent = t(!isCurrent ? "inactive" : round.open ? "open" : "closed");
    status.classList.toggle("is-open", isCurrent && round.open);
    $("toggle-open").textContent = t(round.open ? "pause" : "resume");
    $("toggle-open").hidden = !isCurrent;
    $("make-current").hidden = isCurrent;
    $("share-url").textContent = location.origin + "/szamok";

    const subs = data.subs;
    const flagged = subs.filter((s) => s.flags && s.flags.length).length;
    $("f-subs").textContent = fmtInt(subs.length);
    $("f-nums").textContent = fmtInt(subs.length * 10);
    $("f-flagged").textContent = fmtInt(flagged);

    // newest first in the table
    const body = $("subs");
    body.innerHTML = "";
    for (const s of [...subs].reverse()) {
      const tr = document.createElement("tr");
      const cell = (cls, text) => {
        const td = document.createElement("td");
        if (cls) td.className = cls;
        if (text != null) td.textContent = text;
        tr.appendChild(td);
        return td;
      };
      cell("when", when(s.t));
      const who = cell("who", s.name || t("noName"));
      if (!s.name) who.classList.add("is-empty");
      cell("nums-cell", s.nums.join(" "));
      const flags = cell("");
      for (const f of s.flags || []) {
        const span = document.createElement("span");
        span.className = "flag";
        span.textContent = t("f_" + f);
        flags.appendChild(span);
      }
      const del = cell("del");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-quiet btn-small btn-danger";
      btn.textContent = t("remove");
      btn.addEventListener("click", () => {
        if (confirm(t("removeConfirm"))) load("remove", { round: round.id, id: s.id });
      });
      del.appendChild(btn);
      body.appendChild(tr);
    }
    $("subs-empty").hidden = subs.length > 0;

    renderMini();
  }

  // a glance only; the Benford checker does the real analysis
  function renderMini() {
    const nums = exportSubs().flatMap((s) => s.nums);
    const counts = new Array(9).fill(0);
    for (const n of nums) counts[+String(n)[0] - 1]++;
    const total = nums.length;
    const obs = counts.map((c) => (total ? c / total : 0));
    const P = counts.map((_, i) => Math.log10(1 + 1 / (i + 1)));

    const W = 520, H = 220, m = { t: 12, r: 6, b: 26, l: 40 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const yMax = Math.max(0.35, Math.ceil(Math.max(...obs) * 20) / 20);
    const y = (v) => m.t + ih - (v / yMax) * ih;
    const cw = iw / 9, cx = (i) => m.l + cw * (i + 0.5);

    let svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("miniH")}"><g class="grid">`;
    for (let v = 0; v <= yMax + 1e-9; v += 0.1) {
      svg += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v * 100)}%</text>`;
    }
    svg += "</g>";
    obs.forEach((o, i) => {
      svg += `<rect class="bar-r" x="${cx(i) - cw * 0.28}" y="${y(o)}" width="${cw * 0.56}" height="${m.t + ih - y(o)}"/>`;
      svg += `<text x="${cx(i)}" y="${H - 8}" text-anchor="middle">${i + 1}</text>`;
    });
    svg += `<path class="curve" d="${P.map((p, i) => (i ? "L" : "M") + cx(i).toFixed(1) + " " + y(p).toFixed(1)).join(" ")}"/>`;
    P.forEach((p, i) => { svg += `<circle class="pt" cx="${cx(i)}" cy="${y(p)}" r="3"/>`; });
    svg += "</svg>";
    $("mini-chart").innerHTML = svg;
    $("mini-note").textContent = t(total >= 110 ? "miniOk" : "miniFew", { n: fmtInt(total) });
  }

  /* ---------------- actions ---------------- */

  $("login").addEventListener("submit", async (e) => {
    e.preventDefault();
    password = $("password").value;
    $("login-msg").textContent = "";
    if (await load()) {
      session.set(password);
      $("password").value = "";
    }
  });

  $("logout").addEventListener("click", () => {
    session.set("");
    password = "";
    data = null;
    show("login");
  });

  $("round-select").addEventListener("change", (e) => { viewing = e.target.value; load(); });
  $("toggle-open").addEventListener("click", () => load("setOpen", { round: data.round.id, open: !data.round.open }));
  $("make-current").addEventListener("click", () => load("setCurrent", { round: data.round.id }));
  $("new-round").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!confirm(t("newRoundConfirm"))) return;
    const name = $("new-round-name").value;
    $("new-round-name").value = "";
    viewing = null;
    load("newRound", { name });
  });

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      note(t("copied"));
    } catch {
      note(t("copyFail"), true);
    }
  }

  $("copy-link").addEventListener("click", () => copy(location.origin + "/szamok"));

  $("copy-nums").addEventListener("click", () => {
    const nums = exportSubs().flatMap((s) => s.nums);
    if (!nums.length) return note(t("nothing"), true);
    copy(nums.join("\n"));
  });

  // hand the numbers to the Benford page through localStorage (same site)
  $("open-benford").addEventListener("click", () => {
    const nums = exportSubs().flatMap((s) => s.nums);
    if (!nums.length) return note(t("nothing"), true);
    try {
      localStorage.setItem("benford:import", JSON.stringify({ text: nums.join("\n"), at: Date.now() }));
    } catch { /* storage blocked: the page opens empty */ }
    window.open("/benford", "_blank", "noopener");
  });

  $("dl-csv").addEventListener("click", () => {
    const subs = exportSubs();
    if (!subs.length) return note(t("nothing"), true);
    const esc = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [["time", "name", ...Array.from({ length: 10 }, (_, i) => "n" + (i + 1)), "flags"].join(",")];
    for (const s of subs) lines.push([new Date(s.t).toISOString(), esc(s.name || ""), ...s.nums, esc((s.flags || []).join(" "))].join(","));
    const url = URL.createObjectURL(new Blob([lines.join("\n") + "\n"], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `szamok-${data.round.name.replace(/[^\p{L}\p{N}]+/gu, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $("skip-flagged").addEventListener("change", renderMini);

  // Live during a lesson: refresh while the tab is visible. It switches
  // itself off after 30 minutes so a forgotten tab doesn't use up the
  // database's free monthly allowance; tick the box again to restart.
  const AUTO_FOR = 30 * 60 * 1000;
  let autoSince = Date.now();
  $("auto").addEventListener("change", () => { autoSince = Date.now(); });
  setInterval(() => {
    if (!$("auto").checked) return;
    if (Date.now() - autoSince > AUTO_FOR) { $("auto").checked = false; return; }
    if (data && !document.hidden && !$("dash").hidden) load();
  }, 10000);

  I18N.onChange(render);

  /* ---------------- boot ---------------- */

  if (password) load();
  else show("login");
})();
