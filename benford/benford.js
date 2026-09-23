/* ============================================================
   tothdavid.eu / benford
   Everything happens client-side. No data leaves the browser.
   ============================================================ */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  // Strictness = the pair of Dirichlet concentrations (per 9 bins) behind the
  // fake estimate: [genuine, different]. The genuine one sets how much
  // real-world wobble is tolerated; the gap between the two sets where a
  // deviation starts to count. Tuned on simulated data so that, on large
  // samples, first-digit MAD starts to get flagged around 0.020 / 0.013 / 0.009,
  // and genuine data trips "normal" in at most ~1 run in 20 at n = 100
  // (none from n = 300).
  const STRICTNESS = {
    lenient: { kappa: [300, 25], note: "Lenient: the share of 1s can drift about ±5 points before it counts against the data. Only large deviations (MAD above roughly 0.020) get flagged. Good for messy business data." },
    normal: { kappa: [800, 40], note: "Normal: the share of 1s can drift about ±3 points. Deviations start counting around MAD 0.013, in line with Nigrini's cut-off for nonconforming data." },
    strict: { kappa: [1800, 90], note: "Strict: the share of 1s can drift only about ±2 points. Anything past MAD 0.009 or so counts, so even real data that's a bit off gets flagged." },
  };

  const MAX_FILE_BYTES = 50 * 1024 * 1024;
  const XLSX_SRC = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

  const fmtInt = new Intl.NumberFormat("en-US");
  const pct = (x, dp = 1) => (x * 100).toFixed(dp) + "%";

  /* ---------------- number parsing ---------------- */

  // Returns { d, v } (leading digit, absolute value), { zero: true }, or null.
  function numInfo(raw) {
    if (raw == null) return null;
    if (typeof raw === "number") {
      if (!Number.isFinite(raw)) return null;
      if (raw === 0) return { zero: true };
      const a = Math.abs(raw);
      let str = String(a);
      if (/e/i.test(str)) str = a.toExponential().split("e")[0];
      const sig = str.replace(".", "").replace(/^0+/, "");
      return { d: +sig[0], v: a, neg: raw < 0, sig };
    }
    if (typeof raw === "boolean") return null;

    let s = String(raw).trim();
    if (!s) return null;

    // group separators that never mean a decimal point
    s = s.replace(/[\s  '’_]/g, "");
    const neg = /^\(.*\)$/.test(s) || /^[^\d.,]{0,4}[-−]/.test(s);

    // accounting parentheses, signs, a currency symbol or ISO code in front,
    // and a short unit / percent / currency suffix behind. Anything wordier
    // than that ("Co 12", "Room 4B") isn't a measurement.
    s = s.replace(/^\((.*)\)$/, "$1").replace(/^["']|["']$/g, "");
    s = s.replace(/^[+\-−]?(?:\p{Sc}|[A-Z]{3}(?![a-z]))?[+\-−]?/u, "");
    s = s.replace(/(?:[^\d]{1,5})$/, "");
    if (!s) return null;

    const m = s.match(/^(\d[\d.,]*|[.,]\d+)(?:[eE]([+-]?\d+))?$/);
    if (!m) return null;

    let mant = m[1];
    const exp = m[2] ? +m[2] : 0;
    const hasC = mant.includes(","), hasD = mant.includes(".");

    if (hasC && hasD) {
      const dec = mant.lastIndexOf(",") > mant.lastIndexOf(".") ? "," : ".";
      const grp = dec === "," ? "." : ",";
      const [intPart, fracPart, ...rest] = mant.split(dec);
      if (rest.length || /[.,]/.test(fracPart ?? "")) return null;
      if (!new RegExp("^\\d{1,3}(\\" + grp + "\\d{3})*$").test(intPart)) return null;
      mant = intPart.split(grp).join("") + "." + fracPart;
    } else if (hasC) {
      if (/^\d{1,3}(,\d{3})+$/.test(mant)) mant = mant.replace(/,/g, "");
      else if ((mant.match(/,/g) || []).length === 1) mant = mant.replace(",", ".");
      else return null;
    } else if (hasD) {
      const n = (mant.match(/\./g) || []).length;
      if (n > 1) {
        if (/^\d{1,3}(\.\d{3})+$/.test(mant)) mant = mant.replace(/\./g, "");
        else return null; // 01.05.2024 and friends
      }
    }

    const first = mant.match(/[1-9]/);
    if (!first) return { zero: true, fromText: true };
    const v = Math.abs(parseFloat(mant) * Math.pow(10, exp));
    // digits as written, minus leading zeros: "0.0710" -> "710", "1,200" -> "1200"
    const sig = mant.replace(".", "").replace(/^0+/, "");
    return { d: +first[0], v: Number.isFinite(v) && v > 0 ? v : Number.MAX_VALUE, neg, sig, fromText: true };
  }

  const DATE_RE = /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:[T ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b|\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b|\b\d{1,2}:\d{2}(?::\d{2})?\b/g;

  // Free text: split on obvious separators, try each token whole, then
  // fall back to pulling number-looking runs out of it.
  function extractFree(text) {
    const out = [];
    let zeros = 0;
    const push = (info) => {
      if (!info) return false;
      if (info.zero) zeros++;
      else out.push(info);
      return true;
    };

    const cleaned = text.replace(DATE_RE, " ");
    for (const tok of cleaned.split(/[\s;|]+/)) {
      if (!tok || !/\d/.test(tok)) continue;
      if (push(numInfo(tok))) continue;
      for (const piece of tok.split(",")) {
        if (!/\d/.test(piece)) continue;
        if (push(numInfo(piece))) continue;
        for (const run of piece.match(/\d[\d.]*(?:[eE][+-]?\d+)?/g) || []) push(numInfo(run));
      }
    }
    return { values: out, zeros };
  }

  /* ---------------- tables ---------------- */

  function parseDelimited(text, delim) {
    const rows = [];
    let row = [], field = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else q = false;
        } else field += c;
      } else if (c === '"' && field === "") q = true;
      else if (c === delim) { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows;
  }

  function detectDelim(text, candidates) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 40);
    if (lines.length < 2) return null;
    let best = null, bestScore = 0;
    for (const d of candidates) {
      const counts = lines.map((l) => l.split(d).length - 1);
      const freq = new Map();
      counts.forEach((c) => freq.set(c, (freq.get(c) || 0) + 1));
      let mode = 0, modeN = 0;
      freq.forEach((n, c) => { if (c > 0 && n > modeN) { mode = c; modeN = n; } });
      const share = modeN / lines.length;
      if (mode > 0 && share >= 0.8 && share * mode > bestScore) { best = d; bestScore = share * mode; }
    }
    return best;
  }

  const colLetter = (i) => {
    let s = "";
    for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
  };

  const SKIP_NAME = /(^|[^a-z])(ids?|year|yr|date|day|month|time|zip|postal|postcode|phone|tel|mobile|fax|code|sku|ean|upc|isbn|index|idx|rank|age|nr|#)([^a-z]|$)/i;

  function looksAssigned(infos) {
    const vals = infos.filter((x) => x && !x.zero).map((x) => x.v);
    if (vals.length < 3) return false;
    const ints = vals.every((v) => Number.isInteger(v));
    if (ints && vals.every((v) => v >= 1800 && v <= 2200)) return true; // years
    if (ints) {
      let seq = 0;
      for (let i = 1; i < vals.length; i++) if (vals[i] - vals[i - 1] === 1) seq++;
      if (seq / (vals.length - 1) > 0.9) return true; // row numbers / ids
    }
    return false;
  }

  // Spreadsheet and JSON cells arrive as numbers, which drop the trailing
  // zeros they were written with (1,234.50 -> 1234.5, 56.00 -> 56). That
  // skews the last-two-digits test, so read the whole column at the widest
  // precision any of its values uses.
  function fixNumericPrecision(body, c, infos) {
    const nums = [];
    for (const r of body) if (typeof r[c] === "number" && Number.isFinite(r[c]) && r[c] !== 0) nums.push(r[c]);
    if (!nums.length) return;
    let dec = 0;
    for (const v of nums) {
      const str = String(Math.abs(v));
      if (/e/i.test(str)) return; // too big or small to have a fixed precision
      const dot = str.indexOf(".");
      if (dot >= 0) dec = Math.max(dec, str.length - dot - 1);
    }
    dec = Math.min(dec, 6);
    let j = 0;
    for (const info of infos) {
      if (info.zero || info.fromText) continue;
      const v = nums[j++];
      if (v === undefined) break;
      info.sig = Math.abs(v).toFixed(dec).replace(".", "").replace(/^0+/, "");
    }
  }

  // rows: array of arrays. prefix: sheet name when a workbook has several.
  function columnsFromRows(rows, prefix) {
    rows = rows.filter((r) => r && r.some((c) => c !== "" && c != null));
    if (!rows.length) return [];
    const width = Math.max(...rows.map((r) => r.length));

    const row0 = rows[0];
    let num0 = 0, txt0 = 0;
    row0.forEach((c) => {
      if (c === "" || c == null) return;
      const info = numInfo(c);
      if (info) num0++; else txt0++;
    });
    const hasHeader = rows.length > 1 && txt0 > num0;
    const body = hasHeader ? rows.slice(1) : rows;

    const cols = [];
    for (let c = 0; c < width; c++) {
      const head = hasHeader && row0[c] != null && String(row0[c]).trim() ? String(row0[c]).trim() : "Column " + colLetter(c);
      const infos = [];
      let nonEmpty = 0, valid = 0;
      for (const r of body) {
        const cell = r[c];
        if (cell === "" || cell == null) continue;
        nonEmpty++;
        const info = numInfo(cell);
        if (info) { valid++; infos.push(info); }
      }
      if (!valid || valid < 0.5 * nonEmpty) continue;
      fixNumericPrecision(body, c, infos);
      const name = prefix ? prefix + " · " + head : head;
      cols.push({
        name,
        infos,
        on: !SKIP_NAME.test(head) && !looksAssigned(infos),
      });
    }
    return cols;
  }

  /* ---------------- statistics ---------------- */

  const LANCZOS = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1;
    let a = 0.99999999999980993;
    const t = x + 7.5;
    for (let i = 0; i < 8; i++) a += LANCZOS[i] / (x + i + 1);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }

  // Regularized upper incomplete gamma Q(s, x), for chi-square p-values
  // (series below s + 1, continued fraction above).
  function gammaQ(s, x) {
    if (x <= 0) return 1;
    const lead = -x + s * Math.log(x) - lgamma(s);
    if (x < s + 1) {
      let ap = s, del = 1 / s, sum = del;
      for (let i = 0; i < 1000; i++) {
        ap++; del *= x / ap; sum += del;
        if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
      }
      return Math.max(0, 1 - sum * Math.exp(lead));
    }
    const tiny = 1e-300;
    let b = x + 1 - s, c = 1 / tiny, d = 1 / b, h = d;
    for (let i = 1; i < 1000; i++) {
      const an = -i * (i - s);
      b += 2;
      d = an * d + b; if (Math.abs(d) < tiny) d = tiny;
      c = b + an / c; if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-14) break;
    }
    return Math.exp(lead) * h;
  }

  function quantile(sorted, q) {
    const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
  }

  /* ---------------- tests ---------------- */

  const logP = (k) => Math.log10(1 + 1 / k);
  const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

  // key() maps a value's significant-digit string to a bin, or -1 when the
  // number is too short for the test. MAD cut-offs are Nigrini's.
  const TESTS = {
    first: {
      title: "First digit", what: "leading digits", model: "Benford's law",
      labels: range(1, 9), p: range(1, 9).map(logP),
      key: (s) => +s[0] - 1,
      mad: [0.006, 0.012, 0.015],
      tip: (l) => "Starts with " + l,
      note: "The classic test: how often each number starts with 1, 2, 3 and so on.",
    },
    second: {
      title: "Second digit", what: "second digits", model: "Benford's law",
      labels: range(0, 9),
      p: range(0, 9).map((d) => range(1, 9).reduce((s, a) => s + logP(10 * a + d), 0)),
      key: (s) => (s.length >= 2 ? +s[1] : -1),
      mad: [0.008, 0.01, 0.012],
      tip: (l) => "Second digit " + l,
      note: "Flatter than the first digit (12% zeros down to 8.5% nines). Good at catching amounts nudged up or down.",
    },
    firstTwo: {
      title: "First two digits", what: "first two digits", model: "Benford's law",
      labels: range(10, 99), p: range(10, 99).map(logP),
      key: (s) => (s.length >= 2 ? +s.slice(0, 2) - 10 : -1),
      mad: [0.0012, 0.0018, 0.0022],
      tip: (l) => "Starts with " + l,
      note: "10 to 99. Much finer, so it shows specific amounts that come up too often, like values just under an approval limit. Wants 1,000+ numbers.",
    },
    lastTwo: {
      title: "Last two digits", what: "last two digits", model: "Even spread",
      labels: range(0, 99).map((d) => String(d).padStart(2, "0")), p: new Array(100).fill(0.01),
      key: (s) => (s.length >= 3 ? +s.slice(-2) : -1),
      mad: [0.0012, 0.0018, 0.0022],
      tip: (l) => "Ends in " + l,
      note: "Not Benford: endings should be close to even. Spikes at 00 or 50 point to rounding or numbers typed in by hand.",
    },
  };

  function analyze(values, test, [k0, k1]) {
    const k = test.labels.length, P = test.p;
    const counts = new Array(k).fill(0);
    let skipped = 0;
    for (const x of values) {
      const b = test.key(x.sig);
      if (b >= 0) counts[b]++; else skipped++;
    }
    const n = counts.reduce((s, c) => s + c, 0);
    if (!n) return { test, n, skipped };

    const obs = counts.map((c) => c / n);
    const mad = obs.reduce((s, o, i) => s + Math.abs(o - P[i]), 0) / k;
    const chi2 = counts.reduce((s, c, i) => s + (c - n * P[i]) ** 2 / (n * P[i]), 0);
    const p = gammaQ((k - 1) / 2, chi2 / 2);

    const mo = 1 / k, me = P.reduce((s, e) => s + e, 0) / k;
    let sxy = 0, sxx = 0, syy = 0;
    obs.forEach((o, i) => {
      const dx = o - mo, dy = P[i] - me;
      sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
    });
    // an even expected curve has no shape to correlate with
    const r = syy > 1e-12 && sxx > 0 ? sxy / Math.sqrt(sxx * syy) : null;

    const z = obs.map((o, i) => {
      const e = P[i], se = Math.sqrt((e * (1 - e)) / n);
      return (Math.max(0, Math.abs(o - e) - 1 / (2 * n)) / se) * Math.sign(o - e);
    });
    const band = P.map((e) => 1.96 * Math.sqrt((e * (1 - e)) / n));

    // Bayes factor between two Dirichlet-multinomials centred on the
    // expected curve: a tight one (genuine, with natural wobble) and a loose
    // one (a noticeably different pattern). A flat alternative over every
    // possible pattern wastes its bets on absurd shapes and misses moderate,
    // clear deviations. Concentrations grow with the bin count so per-bin
    // tolerance stays comparable across tests.
    const kappa = k0 * (k / 9), kAlt = k1 * (k / 9);
    let m0 = lgamma(kappa) - lgamma(n + kappa);
    let m1 = lgamma(kAlt) - lgamma(n + kAlt);
    counts.forEach((c, i) => {
      const a = kappa * P[i], b = kAlt * P[i];
      m0 += lgamma(c + a) - lgamma(a);
      m1 += lgamma(c + b) - lgamma(b);
    });
    const fake = 1 / (1 + Math.exp(Math.max(-700, Math.min(700, m0 - m1))));

    const logs = values.map((x) => Math.log10(x.v)).filter(Number.isFinite).sort((a, b) => a - b);
    const span = logs.length > 1 ? quantile(logs, 0.95) - quantile(logs, 0.05) : 0;

    return { test, k, n, skipped, counts, obs, mad, chi2, p, r, z, band, fake, span };
  }

  /* ---------------- state ---------------- */

  const state = {
    tab: "paste",
    paste: { cols: null, free: null },
    file: { cols: null, free: null, name: "" },
  };

  const textarea = $("numbers");
  const optMin = $("opt-min"), optSign = $("opt-sign"), optUnique = $("opt-unique");
  const radio = (name) => (document.querySelector(`input[name="${name}"]:checked`) || {}).value;

  function readPaste() {
    const text = textarea.value;
    const delim = /\t|;/.test(text) ? detectDelim(text, ["\t", ";"]) : null;
    if (delim) {
      const cols = columnsFromRows(parseDelimited(text, delim));
      if (cols.length > 1) {
        // keep the user's column choices while they keep typing
        const prev = new Map((state.paste.cols || []).map((c) => [c.name, c.on]));
        cols.forEach((c) => { if (prev.has(c.name)) c.on = prev.get(c.name); });
        state.paste = { cols, free: null };
        return;
      }
    }
    state.paste = { cols: null, free: extractFree(text) };
  }

  function currentSource() {
    return state.tab === "paste" ? state.paste : state.file;
  }

  function collect() {
    const src = currentSource();
    let values = [], zeros = 0;
    if (src.cols) {
      src.cols.forEach((c) => {
        if (!c.on) return;
        c.infos.forEach((x) => (x.zero ? zeros++ : values.push(x)));
      });
    } else if (src.free) {
      values = src.free.values;
      zeros = src.free.zeros;
    }

    const drop = { small: 0, sign: 0, dups: 0 };
    const min = parseFloat(optMin.value);
    if (Number.isFinite(min) && min > 0) {
      const before = values.length;
      values = values.filter((x) => x.v >= min);
      drop.small = before - values.length;
    }
    if (optSign.value !== "all") {
      const want = optSign.value === "neg";
      const before = values.length;
      values = values.filter((x) => !!x.neg === want);
      drop.sign = before - values.length;
    }
    if (optUnique.checked) {
      const seen = new Set();
      const before = values.length;
      values = values.filter((x) => {
        const key = (x.neg ? "-" : "") + x.v;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      drop.dups = before - values.length;
    }
    return { values, zeros, drop, min, src };
  }

  /* ---------------- rendering ---------------- */

  function renderColumns(src) {
    const box = $("columns"), list = $("col-list");
    if (!src.cols) { box.hidden = true; list.textContent = ""; return; }
    box.hidden = false;
    list.textContent = "";
    src.cols.forEach((c) => {
      const lab = document.createElement("label");
      lab.className = "col";
      const inp = document.createElement("input");
      inp.type = "checkbox";
      inp.checked = c.on;
      inp.addEventListener("change", () => { c.on = inp.checked; update(); });
      const span = document.createElement("span");
      span.title = c.name;
      span.textContent = c.name + " ";
      const cnt = document.createElement("i");
      cnt.textContent = fmtInt.format(c.infos.length);
      span.appendChild(cnt);
      lab.append(inp, span);
      list.appendChild(lab);
    });
  }

  function renderParsed({ values, zeros, drop, min, src }) {
    const bits = [];
    const any = values.length || zeros || drop.small || drop.sign || drop.dups;
    if (src.cols && src.cols.length && !src.cols.some((c) => c.on)) bits.push("No columns selected");
    else if (any) bits.push(fmtInt.format(values.length) + " numbers used");
    if (zeros) bits.push(fmtInt.format(zeros) + " zero" + (zeros > 1 ? "s" : "") + " skipped");
    if (drop.small) bits.push(fmtInt.format(drop.small) + " under " + fmtNum(min) + " left out");
    if (drop.sign) bits.push(fmtInt.format(drop.sign) + (optSign.value === "pos" ? " negative" : " positive") + " left out");
    if (drop.dups) bits.push(fmtInt.format(drop.dups) + (drop.dups > 1 ? " repeats" : " repeat") + " merged");
    $("parsed").textContent = bits.join(" · ");
  }

  const fmtNum = (x) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(x);

  function verdictFor(f) {
    if (f < 0.15) return ["Looks genuine", "var(--ok)"];
    if (f < 0.4) return ["Probably genuine", "var(--ok)"];
    if (f < 0.6) return ["Can't tell", "var(--warn)"];
    if (f < 0.85) return ["Suspicious", "var(--accent-lit)"];
    return ["Likely made up", "var(--accent)"];
  }

  function note(el, text, cls) {
    el.textContent = text;
    el.className = "stat-note " + (cls || "");
  }

  // share formatting: finer tests need an extra decimal
  const share = (a, x) => pct(x, a.k > 10 ? 2 : 1);
  const pts = (a, d) => (d >= 0 ? "+" : "−") + (Math.abs(d) * 100).toFixed(a.k > 10 ? 2 : 1);

  const TEST_KEYS = ["first", "second", "firstTwo", "lastTwo"];
  const enough = (a) => a.n >= (a.k > 10 ? 300 : 50);

  function shortVerdict(f) {
    if (f < 0.4) return ["normal", "var(--ok)"];
    if (f < 0.6) return ["unclear", "var(--warn)"];
    if (f < 0.85) return ["suspicious", "var(--accent-lit)"];
    return ["flagged", "var(--accent)"];
  }

  const bigPct = (f) =>
    f < 0.005 ? '<span class="cmp">&lt;</span>1' : f > 0.995 ? '<span class="cmp">&gt;</span>99' : String(Math.min(99, Math.max(1, Math.round(f * 100))));
  const smallPct = (f) => (f < 0.005 ? "<1%" : f > 0.995 ? ">99%" : Math.min(99, Math.max(1, Math.round(f * 100))) + "%");

  // One test passing proves little: made-up numbers with random later digits
  // sail through the second-digit and last-two tests. So the headline is the
  // most suspicious test that had enough numbers to be trusted.
  function overallOf(all) {
    const usable = TEST_KEYS.filter((k) => all[k].n && enough(all[k]));
    const worst = usable.length ? usable.reduce((w, k) => (all[k].fake > all[w].fake ? k : w)) : "first";
    return { all, usable, worst, fake: all[worst].fake };
  }

  function renderOverall(o) {
    const report = $("report");
    const w = o.all[o.worst];
    const thin = !o.usable.length;
    report.classList.toggle("is-thin", thin);

    const [label, tone] = o.all.first.n < 20 ? ["Not enough data", "var(--paper-2)"] : verdictFor(o.fake);
    $("fake-pct").innerHTML = bigPct(o.fake);
    $("verdict-label").textContent = label;
    report.style.setProperty("--tone", tone);
    $("meter-fill").style.width = (o.fake * 100).toFixed(1) + "%";

    const flagged = o.usable.filter((k) => o.all[k].fake >= 0.6);
    let sub;
    if (thin) sub = "Too few numbers for any test to be sure. This is a rough first read from the first-digit test.";
    else if (flagged.length)
      sub = `Estimated chance the numbers were made up or manipulated. Flagged by the ${TESTS[flagged.sort((a, b) => o.all[b].fake - o.all[a].fake)[0]].title.toLowerCase()} test` +
        (flagged.length > 1 ? ` and ${flagged.length - 1} other${flagged.length > 2 ? "s" : ""}.` : ".");
    else if (o.usable.length === TEST_KEYS.length) sub = "Estimated chance the numbers were made up or manipulated. All four tests look normal.";
    else sub = `Estimated chance the numbers were made up or manipulated. ${o.usable.length} of 4 tests had enough numbers to run, and they look normal.`;
    $("verdict-sub").textContent = sub;

    TEST_KEYS.forEach((k) => {
      const a = o.all[k], cell = $("tv-" + k);
      if (!a.n || !enough(a)) {
        cell.innerHTML = `${a.n ? smallPct(a.fake) : "–"}<small>too few</small>`;
        cell.style.setProperty("--t-tone", "var(--paper-3)");
        return;
      }
      const [word, t] = shortVerdict(a.fake);
      cell.innerHTML = `${smallPct(a.fake)}<small>${word}</small>`;
      cell.style.setProperty("--t-tone", t);
    });
  }

  function renderReport(a) {
    const t = a.test;
    $("test-note").textContent = t.note;
    $("detail").hidden = !a.n;
    $("detail-empty").hidden = !!a.n;
    if (!a.n) {
      $("warnings").innerHTML = "";
      $("detail-empty").textContent = `None of these numbers have enough digits for the ${t.title.toLowerCase()} test.`;
      lastAnalysis = null;
      return;
    }
    const fine = a.k > 10;
    const thinN = fine ? 300 : 50, smallN = fine ? 1000 : 200;

    // caveats
    // caveats
    const warn = [];
    if (a.n < thinN) warn.push(`<b>Only ${fmtInt.format(a.n)} numbers.</b> The ${t.title.toLowerCase()} test needs ${fine ? "well over a thousand" : "a few hundred"} to say much, so treat this as a rough hint.`);
    else if (a.n < smallN) warn.push(`<b>${fmtInt.format(a.n)} numbers is on the small side</b> for this test. ${fine ? "Several thousand" : "A few hundred or more"} gives a firmer answer.`);
    if (a.skipped) warn.push(`<b>${fmtInt.format(a.skipped)} number${a.skipped > 1 ? "s" : ""} had too few digits</b> for this test and ${a.skipped > 1 ? "were" : "was"} left out.`);
    if (t.model !== "Even spread" && a.n >= 10) {
      if (a.span < 1)
        warn.push("<b>Your values sit within one order of magnitude.</b> Benford's law doesn't apply to data like this (think ages, heights, prices in a narrow range), so a poor fit is expected even if the numbers are real.");
      else if (a.span < 2)
        warn.push("<b>Your values span less than two orders of magnitude.</b> Benford fits best when numbers range across several (10s to 10,000s), so read this result loosely.");
    }
    $("warnings").innerHTML = warn.map((w) => `<li>${w}</li>`).join("");

    // stats
    $("s-n").textContent = fmtInt.format(a.n);
    if (a.r == null) {
      $("s-r").textContent = "n/a";
      note($("s-r-note"), "expected curve is flat");
    } else {
      $("s-r").textContent = a.r.toFixed(3);
      note($("s-r-note"),
        a.r >= 0.98 ? "near-identical shape" : a.r >= 0.9 ? "similar shape" : a.r >= 0.7 ? "loosely similar" : "different shape",
        a.r >= 0.98 ? "good" : a.r >= 0.9 ? "" : a.r >= 0.7 ? "meh" : "bad");
    }
    // Nigrini's cut-offs assume big samples; below that, pure sampling noise
    // alone can push MAD past them, so compare against the noise floor too.
    const [m1, m2, m3] = t.mad;
    const noise = t.p.reduce((s, e) => s + Math.sqrt((2 * e * (1 - e)) / (Math.PI * a.n)), 0) / a.k;
    const inNoise = a.mad > m2 && a.mad <= noise * 1.35;
    $("s-mad").textContent = a.mad.toFixed(4);
    note($("s-mad-note"),
      inNoise ? "within noise for this n" : a.mad <= m1 ? "close conformity" : a.mad <= m2 ? "acceptable" : a.mad <= m3 ? "marginal" : "nonconforming",
      inNoise ? "" : a.mad <= m1 ? "good" : a.mad <= m2 ? "" : a.mad <= m3 ? "meh" : "bad");
    $("s-p").textContent = a.p < 0.001 ? "<0.001" : a.p.toFixed(3);
    note($("s-p-note"),
      a.p >= 0.05 ? "consistent with " + (t.model === "Even spread" ? "an even spread" : "Benford") : a.n > 3000 ? "off, but n is large" : "significant deviation",
      a.p >= 0.05 ? "good" : a.n > 3000 ? "meh" : "bad");

    // table: every bin for the short tests, the worst offenders for the long ones
    $("th-bin").textContent = fine ? "Digits" : "Digit";
    $("th-exp").textContent = t.model === "Even spread" ? "Expected" : "Benford";
    let rows = a.obs.map((_, i) => i);
    if (fine) rows = rows.sort((i, j) => Math.abs(a.z[j]) - Math.abs(a.z[i])).slice(0, 12);
    $("table-note").textContent = fine ? "The 12 biggest deviations, worst first. Download the CSV for all " + a.k + "." : "";
    $("table-note").hidden = !fine;
    $("digit-rows").innerHTML = rows.map((i) => {
      const diff = a.obs[i] - t.p[i];
      const sig = Math.abs(a.z[i]) > 1.96;
      return `<tr>
        <td>${t.labels[i]}</td>
        <td>${fmtInt.format(a.counts[i])}</td>
        <td>${share(a, a.obs[i])}</td>
        <td>${share(a, t.p[i])}</td>
        <td class="${sig ? "sig" : diff >= 0 ? "pos" : "neg"}">${pts(a, diff)}</td>
        <td class="${sig ? "sig" : ""}">${a.z[i] >= 0 ? "" : "−"}${Math.abs(a.z[i]).toFixed(2)}</td>
      </tr>`;
    }).join("");

    renderChart(a);
  }

  /* ---------------- chart ---------------- */

  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  };

  let lastAnalysis = null;
  let lastOverall = null;
  let autoPick = false;

  function renderChart(a) {
    lastAnalysis = a;
    const t = a.test, P = t.p, k = a.k, fine = k > 20;
    $("key-exp").textContent = t.model;

    const host = $("chart");
    const narrow = host.clientWidth < 480;
    const W = 640, H = narrow ? 400 : 330;
    const m = { t: 18, r: 6, b: 34, l: 46 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;

    const top = Math.max(...a.obs, ...P.map((e, i) => e + a.band[i])) * 1.08;
    const step = top <= 0.03 ? 0.005 : top <= 0.08 ? 0.01 : top <= 0.2 ? 0.025 : 0.05;
    const yMax = Math.ceil(top / step) * step;
    const y = (v) => m.t + ih - (Math.min(v, yMax) / yMax) * ih;
    const cw = iw / k;
    const cx = (i) => m.l + cw * (i + 0.5);

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${t.title} distribution of your data compared to ${t.model}` });

    const grid = el("g", { class: "grid" }, svg);
    for (let v = 0; v <= yMax + 1e-9; v += step) {
      el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }, grid);
      const tx = el("text", { x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }, grid);
      tx.textContent = +(v * 100).toFixed(1) + "%";
    }

    const cols = el("g", {}, svg);
    const bw = fine ? Math.max(1, cw - 1.5) : cw * 0.5, bandW = fine ? cw : cw * 0.78;
    const axis = el("g", { class: "axis" }, svg);
    P.forEach((e, i) => {
      const g = el("g", { class: "col-g", "data-i": i }, cols);
      el("rect", { class: "hover-bg", x: m.l + cw * i, y: m.t, width: cw, height: ih }, g);

      const lo = Math.max(0, e - a.band[i]), hi = e + a.band[i];
      el("rect", { class: fine ? "band is-fine" : "band", x: cx(i) - bandW / 2, y: y(hi), width: bandW, height: Math.max(1, y(lo) - y(hi)) }, g);

      const off = Math.abs(a.z[i]) > 1.96;
      const by = y(a.obs[i]);
      el("rect", { class: "bar" + (off ? " is-off" : ""), x: cx(i) - bw / 2, y: by, width: bw, height: Math.max(0, m.t + ih - by) }, g);
      if (off && !fine) {
        const f = el("text", { class: "flag", x: cx(i), y: Math.min(by, y(hi)) - 6, "text-anchor": "middle" }, g);
        f.textContent = a.obs[i] > e ? "▲" : "▼";
      }

      if (!fine || i % 10 === 0) {
        const lab = el("text", { x: fine ? m.l + cw * i : cx(i), y: H - 10, "text-anchor": fine ? "start" : "middle" }, axis);
        lab.textContent = t.labels[i];
      }
    });

    el("path", { class: "curve", d: P.map((e, i) => (i ? "L" : "M") + cx(i).toFixed(1) + " " + y(e).toFixed(1)).join(" ") }, svg);
    if (!fine) P.forEach((e, i) => el("circle", { class: "pt", cx: cx(i), cy: y(e), r: 3.5 }, svg));

    const hits = el("g", {}, svg);
    P.forEach((_, i) => el("rect", { class: "hit", "data-i": i, x: m.l + cw * i, y: 0, width: cw, height: H }, hits));

    host.replaceChildren(svg);
  }

  const tip = $("tip");
  function showTip(i, evt) {
    const a = lastAnalysis;
    if (!a) return;
    const t = a.test, e = t.p[i];
    const wrap = tip.parentElement.getBoundingClientRect();
    tip.innerHTML = `<b>${t.tip(t.labels[i])}</b>
      <div class="row"><span>Yours</span><span>${share(a, a.obs[i])} (${fmtInt.format(a.counts[i])})</span></div>
      <div class="row"><span>${t.model === "Even spread" ? "Expected" : "Benford"}</span><span>${share(a, e)}</span></div>
      <div class="row"><span>Normal range</span><span>${share(a, Math.max(0, e - a.band[i]))} to ${share(a, e + a.band[i])}</span></div>
      <div class="row"><span>Difference</span><span>${pts(a, a.obs[i] - e)} pts</span></div>`;
    tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let x = evt.clientX - wrap.left + 14, yy = evt.clientY - wrap.top - th - 12;
    if (x + tw > wrap.width) x = evt.clientX - wrap.left - tw - 14;
    if (x < 0) x = 0;
    if (yy < 0) yy = evt.clientY - wrap.top + 16;
    tip.style.left = x + "px";
    tip.style.top = yy + "px";
    document.querySelectorAll(".col-g").forEach((g) => g.classList.toggle("is-hover", +g.dataset.i === i));
  }
  function hideTip() {
    tip.hidden = true;
    document.querySelectorAll(".col-g.is-hover").forEach((g) => g.classList.remove("is-hover"));
  }
  $("chart").addEventListener("pointermove", (e) => {
    const t = e.target.closest(".hit");
    if (t) showTip(+t.dataset.i, e); else hideTip();
  });
  $("chart").addEventListener("pointerleave", hideTip);

  let resizeT;
  let lastNarrow = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      const narrow = $("chart").clientWidth < 480;
      if (lastAnalysis && narrow !== lastNarrow) renderChart(lastAnalysis);
      lastNarrow = narrow;
    }, 120);
  });

  /* ---------------- export ---------------- */

  const exportStatus = $("export-status");
  let exportT;
  function flash(msg) {
    exportStatus.textContent = msg;
    clearTimeout(exportT);
    exportT = setTimeout(() => (exportStatus.textContent = ""), 2500);
  }

  function summary(o) {
    const [label] = verdictFor(o.fake);
    return [
      `Benford check, ${fmtInt.format(o.all.first.n)} numbers`,
      `Overall chance made up: ${smallPct(o.fake)} (${label})`,
      ...TEST_KEYS.map((k) => {
        const a = o.all[k];
        if (!a.n) return `  ${TESTS[k].title}: not enough digits`;
        return `  ${TESTS[k].title}: ${smallPct(a.fake)} made up, MAD ${a.mad.toFixed(4)}, p ${a.p < 0.001 ? "<0.001" : a.p.toFixed(3)}${enough(a) ? "" : " (too few numbers)"}`;
      }),
      "https://tothdavid.eu/benford/",
    ].join("\n");
  }

  $("dl-csv").addEventListener("click", () => {
    const a = lastAnalysis;
    if (!a) return;
    const t = a.test;
    const lines = [
      ["test", t.title], ["numbers", a.n], ["chance_made_up", a.fake.toFixed(4)],
      ["overall_chance_made_up", lastOverall ? lastOverall.fake.toFixed(4) : ""],
      ["correlation", a.r == null ? "" : a.r.toFixed(4)], ["mad", a.mad.toFixed(5)],
      ["chi_square", a.chi2.toFixed(3)], ["p_value", a.p.toExponential(3)], [],
      ["digits", "count", "share", "expected", "difference", "z"],
      ...a.obs.map((o, i) => [t.labels[i], a.counts[i], o.toFixed(5), t.p[i].toFixed(5), (o - t.p[i]).toFixed(5), a.z[i].toFixed(3)]),
    ].map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([lines + "\n"], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `benford-${t.title.toLowerCase().replace(/\s+/g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $("copy-sum").addEventListener("click", async () => {
    if (!lastOverall) return;
    try {
      await navigator.clipboard.writeText(summary(lastOverall));
      flash("Copied");
    } catch {
      flash("Couldn't reach the clipboard");
    }
  });

  /* ---------------- main update ---------------- */

  function update() {
    const level = STRICTNESS[radio("strict")] || STRICTNESS.normal;
    $("strict-note").textContent = level.note;
    const src = currentSource();
    renderColumns(src);
    const c = collect();
    renderParsed(c);
    const has = c.values.length > 0;
    $("empty").hidden = has;
    $("report").hidden = !has;
    if (!has) {
      lastAnalysis = lastOverall = null;
      return;
    }
    const strict = level.kappa;
    const all = Object.fromEntries(TEST_KEYS.map((k) => [k, analyze(c.values, TESTS[k], strict)]));
    const o = overallOf(all);
    lastOverall = o;

    // fresh data opens on the test that caught it
    if (autoPick) {
      autoPick = false;
      const pick = o.fake >= 0.6 ? o.worst : "first";
      document.querySelector(`input[name="test"][value="${pick}"]`).checked = true;
    }

    renderOverall(o);
    renderReport(all[radio("test")] || all.first);
    lastNarrow = $("chart").clientWidth < 480;
  }

  let typeT;
  textarea.addEventListener("input", () => {
    clearTimeout(typeT);
    typeT = setTimeout(() => { readPaste(); update(); }, 160);
  });
  let minT;
  optMin.addEventListener("input", () => { clearTimeout(minT); minT = setTimeout(update, 200); });
  optSign.addEventListener("change", update);
  optUnique.addEventListener("change", update);
  document.querySelectorAll('input[name="test"], input[name="strict"]').forEach((r) => r.addEventListener("change", update));

  /* ---------------- tabs ---------------- */

  const tabs = [...document.querySelectorAll(".tab")];
  function selectTab(tab, focus) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !on;
    });
    if (focus) tab.focus();
    state.tab = tab.id === "tab-paste" ? "paste" : "file";
    update();
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => selectTab(t));
    t.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        selectTab(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length], true);
      }
    });
  });

  /* ---------------- files ---------------- */

  const status = $("file-status");
  const setStatus = (msg, err) => {
    status.textContent = msg;
    status.classList.toggle("is-error", !!err);
  };

  let xlsxLoading = null;
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxLoading) {
      xlsxLoading = new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = XLSX_SRC;
        s.onload = () => res(window.XLSX);
        s.onerror = () => { xlsxLoading = null; rej(new Error("Couldn't load the spreadsheet reader. Check your connection, or export as CSV.")); };
        document.head.appendChild(s);
      });
    }
    return xlsxLoading;
  }

  function fromJSON(data) {
    // array of objects → one column per key
    if (Array.isArray(data) && data.length && data.every((r) => r && typeof r === "object" && !Array.isArray(r))) {
      const keys = [...new Set(data.flatMap((r) => Object.keys(r)))];
      return { cols: columnsFromRows([keys, ...data.map((r) => keys.map((k) => r[k]))]), free: null };
    }
    // anything else → every number in it
    const values = [];
    let zeros = 0;
    (function walk(v) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
      else if (typeof v === "number" || typeof v === "string") {
        const info = numInfo(v);
        if (info) info.zero ? zeros++ : values.push(info);
      }
    })(data);
    return { cols: null, free: { values, zeros } };
  }

  async function handleFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setStatus(`${file.name} is ${(file.size / 1048576).toFixed(0)} MB. The limit is 50 MB.`, true);
      return;
    }
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    setStatus("Reading " + file.name + "…");
    try {
      let result;
      if (["xlsx", "xls", "ods", "xlsm", "xlsb"].includes(ext)) {
        const XLSX = await loadXLSX();
        const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
        const multi = wb.SheetNames.length > 1;
        const cols = wb.SheetNames.flatMap((name) =>
          columnsFromRows(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, blankrows: false, defval: "" }), multi ? name : ""));
        result = { cols, free: null };
      } else {
        const text = await file.text();
        let parsed = null;
        if (ext === "json" || /^\s*[[{]/.test(text)) {
          try { parsed = fromJSON(JSON.parse(text)); } catch { parsed = null; }
        }
        if (!parsed) {
          const cands = ext === "tsv" ? ["\t"] : ["\t", ";", ",", "|"];
          const delim = detectDelim(text, cands);
          const cols = delim ? columnsFromRows(parseDelimited(text, delim)) : [];
          parsed = cols.length ? { cols, free: null } : { cols: null, free: extractFree(text) };
        }
        result = parsed;
      }

      const count = result.cols ? result.cols.reduce((s, c) => s + c.infos.length, 0) : result.free.values.length;
      if (!count) {
        setStatus(`Couldn't find any numbers in ${file.name}.`, true);
      } else {
        const colsBit = result.cols ? ` in ${result.cols.length} numeric column${result.cols.length > 1 ? "s" : ""}` : "";
        setStatus(`${file.name}: ${fmtInt.format(count)} values${colsBit}.`);
      }
      state.file = { ...result, name: file.name };
      autoPick = true;
      update();
    } catch (err) {
      setStatus(err && err.message ? err.message : "Couldn't read that file.", true);
    }
  }

  const drop = $("drop"), fileInput = $("file");
  fileInput.addEventListener("change", () => { handleFile(fileInput.files[0]); fileInput.value = ""; });
  ["dragenter", "dragover"].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("is-over"); }));
  ["dragleave", "drop"].forEach((t) => drop.addEventListener(t, () => drop.classList.remove("is-over")));
  drop.addEventListener("drop", (e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); });

  // A file dropped anywhere on the page lands in the file tab.
  window.addEventListener("dragover", (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  window.addEventListener("drop", (e) => {
    if (drop.contains(e.target) || !e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    selectTab($("tab-file"));
    handleFile(e.dataTransfer.files[0]);
  });

  /* ---------------- samples ---------------- */

  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const gaussOf = (r) => () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const LOG_PHI = Math.log10((1 + Math.sqrt(5)) / 2), LOG_SQRT5 = Math.log10(Math.sqrt(5));

  // Every sample takes a size, so you can see how the verdict firms up as n grows.
  const SAMPLES = {
    invoices(n) {
      const r = rng(1729), g = gaussOf(r);
      return Array.from({ length: n }, () => money.format(Math.exp(6 + 1.7 * g())));
    },
    fib(n) {
      // exact for the first 300, then mantissa × 10^exponent (12 digits),
      // which is plenty for any digit test and keeps 20,000 terms small
      const out = [];
      let a = 1n, b = 1n;
      for (let i = 1; i <= n; i++) {
        if (i <= 300) { out.push(a.toString()); [a, b] = [b, a + b]; continue; }
        const lg = i * LOG_PHI - LOG_SQRT5, e = Math.floor(lg);
        out.push(Math.pow(10, lg - e).toFixed(11) + "e" + e);
      }
      return out;
    },
    messy(n) {
      // Real, but not textbook: spending with a narrower spread plus a
      // recurring 24 to 38 charge (a subscription, a fee) making up 12% of
      // rows. Normal strictness can't decide, strict flags it, lenient passes.
      const r = rng(2024), g = gaussOf(r);
      return Array.from({ length: n }, () =>
        money.format(r() < 0.12 ? 24 + r() * 14 : Math.exp(5.5 + 1.6 * g())));
    },
    invented(n) {
      // How people make amounts up: leading digits spread evenly, later
      // digits that shy away from 0 and from repeating, a soft spot for 5
      // and 7, and plenty of tidy endings (.00, .50, .99, rounded to 0 or 5).
      const r = rng(42);
      const pick = (w) => {
        let x = r() * w.reduce((s, v) => s + v, 0);
        for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) return i;
        return w.length - 1;
      };
      const LEAD = [0, 10, 11, 12, 11, 12, 11, 12, 10, 11];
      const MID = [4, 8, 10, 10, 11, 14, 10, 13, 11, 9];
      const next = (prev) => {
        let d;
        do d = pick(MID); while (d === prev && r() < 0.75);
        return d;
      };
      return Array.from({ length: n }, () => {
        const len = 2 + pick([3, 4, 3, 1]);
        let s = String(pick(LEAD));
        while (s.length < len) s += next(+s[s.length - 1]);
        const style = r();
        let cents;
        if (style < 0.3) { s = s.slice(0, -1) + (r() < 0.5 ? "0" : "5"); cents = "00"; }
        else if (style < 0.5) cents = r() < 0.6 ? "00" : "50";
        else if (style < 0.6) cents = "99";
        else cents = String(next(-1)) + next(-1);
        return money.format(+(s + "." + cents));
      });
    },
    limit(n) {
      // Genuine expense claims, except 7% were split or trimmed to land just
      // under a 5,000 sign-off limit. The first-two-digits test finds the 48s and 49s.
      const r = rng(5000), g = gaussOf(r);
      return Array.from({ length: n }, () =>
        money.format(r() < 0.07 ? 4800 + r() * 199 : Math.exp(6.2 + 1.5 * g())));
    },
  };

  const sampleSize = $("sample-size");
  let lastSample = null;

  function loadSample(name) {
    lastSample = name;
    textarea.value = SAMPLES[name](+sampleSize.value).join("\n");
    autoPick = true;
    textarea.scrollTop = 0;
    readPaste();
    update();
  }

  document.querySelectorAll("[data-sample]").forEach((b) => {
    b.addEventListener("click", () => {
      if (b.dataset.sample === "clear") {
        lastSample = null;
        textarea.value = "";
        readPaste();
        update();
        return;
      }
      loadSample(b.dataset.sample);
    });
  });

  // changing the size re-rolls the sample you're looking at, unless you've edited it
  sampleSize.addEventListener("change", () => {
    if (lastSample && state.tab === "paste") loadSample(lastSample);
  });
  textarea.addEventListener("input", () => { lastSample = null; });

  /* ---------------- boot ---------------- */

  readPaste();
  update();
})();
