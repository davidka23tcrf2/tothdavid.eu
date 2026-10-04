/* ============================================================
   tothdavid.eu / benford
   Everything happens client-side. No data leaves the browser.

   The page reports how far the digits are from the expected
   distribution. It never claims to know whether data was faked:
   a deviation is a reason to look closer, not proof of anything.
   Copy lives in i18n.js; t() picks the current language.
   ============================================================ */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const t = (key, vars) => window.I18N.t(key, vars);

  const MAX_FILE_BYTES = 50 * 1024 * 1024;
  const XLSX_SRC = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

  // numbers on screen follow the page language (2,500 / 2 500, 30.1% / 30,1%)
  const loc = () => window.I18N.locale;
  const fmtInt = (x) => new Intl.NumberFormat(loc()).format(x);
  const dec = (x, dp) => new Intl.NumberFormat(loc(), { minimumFractionDigits: dp, maximumFractionDigits: dp, useGrouping: false }).format(x);
  const pct = (x, dp = 1) => dec(x * 100, dp) + "%";
  const fmtNum = (x) => new Intl.NumberFormat(loc(), { maximumFractionDigits: 6 }).format(x);

  /* ---------------- number formats ---------------- */

  // "dot":   1,234.56   (comma or space groups, dot decimal)
  // "comma": 1 234,56 / 1.234,56   (space or dot groups, comma decimal)
  const FORMATS = { dot: "1,234.56", comma: "1 234,56" };
  const GROUP_SPACE = "[ \\u00a0\\u202f]";

  // Decide the convention from the text itself. A comma followed by one or
  // two digits (and not another comma, as in a 1,2,3 list) is a decimal
  // comma; lines holding one space-grouped number (1 234) are the Hungarian
  // way of writing thousands.
  function detectFormat(strings) {
    let comma = 0, dot = 0;
    for (const s of strings) {
      if (typeof s !== "string" || !/\d/.test(s)) continue;
      comma += (s.match(/(?:^|[^\d,])\d+,\d{1,2}(?![\d,])/g) || []).length;
      comma += (s.match(/\d{1,3}(?:\.\d{3})+,\d/g) || []).length;
      comma += (s.match(new RegExp("^\\s*[-−]?\\d{1,3}(?:" + GROUP_SPACE + "\\d{3})+\\s*$", "gm")) || []).length;
      dot += (s.match(/(?:^|[^\d.])\d+\.\d{1,2}(?![\d.])/g) || []).length;
      dot += (s.match(/\d{1,3}(?:,\d{3})+\.\d/g) || []).length;
    }
    return comma > dot ? "comma" : "dot";
  }

  /* ---------------- number parsing ---------------- */

  // Returns { d, v, neg, sig } (leading digit, absolute value, sign,
  // significant digits as written), { zero: true }, or null.
  function numInfo(raw, fmt) {
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

    if (fmt === "comma") {
      if (hasC) {
        const parts = mant.split(",");
        if (parts.length > 2) return null;
        let [intPart, frac] = parts;
        if (intPart.includes(".")) {
          if (!/^\d{1,3}(\.\d{3})+$/.test(intPart)) return null;
          intPart = intPart.replace(/\./g, "");
        }
        mant = (intPart || "0") + "." + frac;
      } else if (hasD) {
        if (/^\d{1,3}(\.\d{3})+$/.test(mant)) mant = mant.replace(/\./g, "");
        else if ((mant.match(/\./g) || []).length > 1) return null;
      }
    } else if (hasC && hasD) {
      const decSep = mant.lastIndexOf(",") > mant.lastIndexOf(".") ? "," : ".";
      const grp = decSep === "," ? "." : ",";
      const [intPart, fracPart, ...rest] = mant.split(decSep);
      if (rest.length || /[.,]/.test(fracPart ?? "")) return null;
      if (!new RegExp("^\\d{1,3}(\\" + grp + "\\d{3})*$").test(intPart)) return null;
      mant = intPart.split(grp).join("") + "." + fracPart;
    } else if (hasC) {
      if (/^\d{1,3}(,\d{3})+$/.test(mant)) mant = mant.replace(/,/g, "");
      else if ((mant.match(/,/g) || []).length === 1) mant = mant.replace(",", ".");
      else return null;
    } else if (hasD) {
      if ((mant.match(/\./g) || []).length > 1) {
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

  const DATE_RE = new RegExp([
    "\\b\\d{4}[-/.]\\d{1,2}[-/.]\\d{1,2}(?:[T ]\\d{1,2}:\\d{2}(?::\\d{2}(?:\\.\\d+)?)?(?:Z|[+-]\\d{2}:?\\d{2})?)?\\b",
    "\\b\\d{4}\\.\\s?\\d{1,2}\\.\\s?\\d{1,2}\\.?", // 2024. 03. 05.
    "\\b\\d{1,2}[-/.]\\d{1,2}[-/.]\\d{2,4}\\b",
    "\\b\\d{1,2}:\\d{2}(?::\\d{2})?\\b",
  ].join("|"), "g");

  // Comma-decimal text can't be split on spaces (1 234,56 is one number),
  // so pull whole numbers out with a pattern instead.
  const COMMA_NUM = new RegExp(
    "[-−]?(?:\\d{1,3}(?:" + GROUP_SPACE + "\\d{3})+|\\d{1,3}(?:\\.\\d{3})+|\\d+)(?:,\\d+)?(?:\\.\\d+)?", "g");

  function extractFree(text, fmt) {
    const out = [];
    let zeros = 0;
    const push = (info) => {
      if (!info) return false;
      if (info.zero) zeros++;
      else out.push(info);
      return true;
    };

    const cleaned = text.replace(DATE_RE, " ");
    if (fmt === "comma") {
      for (const tok of cleaned.match(COMMA_NUM) || []) push(numInfo(tok, "comma"));
      return { values: out, zeros };
    }

    // Dot-decimal text: split on obvious separators, try each token whole,
    // then fall back to pulling number-looking runs out of it.
    for (const tok of cleaned.split(/[\s;|]+/)) {
      if (!tok || !/\d/.test(tok)) continue;
      if (push(numInfo(tok, "dot"))) continue;
      for (const piece of tok.split(",")) {
        if (!/\d/.test(piece)) continue;
        if (push(numInfo(piece, "dot"))) continue;
        for (const run of piece.match(/\d[\d.]*(?:[eE][+-]?\d+)?/g) || []) push(numInfo(run, "dot"));
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

  const SKIP_NAME = /(^|[^a-z])(ids?|year|yr|date|day|month|time|zip|postal|postcode|phone|tel|mobile|fax|code|sku|ean|upc|isbn|index|idx|rank|age|nr|#|azonosító|év|dátum|kód|sorszám)([^a-z]|$)/i;

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
    let places = 0;
    for (const v of nums) {
      const str = String(Math.abs(v));
      if (/e/i.test(str)) return; // too big or small to have a fixed precision
      const dot = str.indexOf(".");
      if (dot >= 0) places = Math.max(places, str.length - dot - 1);
    }
    places = Math.min(places, 6);
    let j = 0;
    for (const info of infos) {
      if (info.zero || info.fromText) continue;
      const v = nums[j++];
      if (v === undefined) break;
      info.sig = Math.abs(v).toFixed(places).replace(".", "").replace(/^0+/, "");
    }
  }

  const textCells = (rows) => {
    const out = [];
    for (const r of rows) for (const c of r) if (typeof c === "string" && c) { out.push(c); if (out.length > 5000) return out; }
    return out;
  };

  // rows: array of arrays. prefix: sheet name when a workbook has several.
  function columnsFromRows(rows, prefix, fmt) {
    rows = rows.filter((r) => r && r.some((c) => c !== "" && c != null));
    if (!rows.length) return [];
    const width = Math.max(...rows.map((r) => r.length));

    const row0 = rows[0];
    let num0 = 0, txt0 = 0;
    row0.forEach((c) => {
      if (c === "" || c == null) return;
      if (numInfo(c, fmt)) num0++; else txt0++;
    });
    const hasHeader = rows.length > 1 && txt0 > num0;
    const body = hasHeader ? rows.slice(1) : rows;

    const cols = [];
    for (let c = 0; c < width; c++) {
      const head = hasHeader && row0[c] != null && String(row0[c]).trim() ? String(row0[c]).trim() : t("column", { l: colLetter(c) });
      const infos = [];
      let nonEmpty = 0, valid = 0;
      for (const r of body) {
        const cell = r[c];
        if (cell === "" || cell == null) continue;
        nonEmpty++;
        const info = numInfo(cell, fmt);
        if (info) { valid++; infos.push(info); }
      }
      if (!valid || valid < 0.5 * nonEmpty) continue;
      fixNumericPrecision(body, c, infos);
      const name = prefix ? prefix + " · " + head : head;
      cols.push({ name, infos, on: !SKIP_NAME.test(head) && !looksAssigned(infos) });
    }
    return cols;
  }

  // keep the user's column choices when the same table is parsed again
  function keepChoices(cols, prevCols) {
    const prev = new Map((prevCols || []).map((c) => [c.name, c.on]));
    cols.forEach((c) => { if (prev.has(c.name)) c.on = prev.get(c.name); });
    return cols;
  }

  /* ---------------- statistics ---------------- */

  const LANCZOS = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

  function lgamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    x -= 1;
    let a = 0.99999999999980993;
    const tt = x + 7.5;
    for (let i = 0; i < 8; i++) a += LANCZOS[i] / (x + i + 1);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(tt) - tt + Math.log(a);
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

  // Upper-tail normal quantile: z with P(Z > z) = q (Abramowitz & Stegun 26.2.23).
  function zUpper(q) {
    const r = Math.sqrt(-2 * Math.log(q));
    return r - (2.515517 + 0.802853 * r + 0.010328 * r * r) / (1 + 1.432788 * r + 0.189269 * r * r + 0.001308 * r * r * r);
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
      labels: range(1, 9), p: range(1, 9).map(logP),
      key: (s) => +s[0] - 1,
      mad: [0.006, 0.012, 0.015],
    },
    second: {
      labels: range(0, 9),
      p: range(0, 9).map((d) => range(1, 9).reduce((s, a) => s + logP(10 * a + d), 0)),
      key: (s) => (s.length >= 2 ? +s[1] : -1),
      mad: [0.008, 0.01, 0.012],
    },
    firstTwo: {
      labels: range(10, 99), p: range(10, 99).map(logP),
      key: (s) => (s.length >= 2 ? +s.slice(0, 2) - 10 : -1),
      mad: [0.0012, 0.0018, 0.0022],
    },
    lastTwo: {
      even: true,
      labels: range(0, 99).map((d) => String(d).padStart(2, "0")), p: new Array(100).fill(0.01),
      key: (s) => (s.length >= 3 ? +s.slice(-2) : -1),
      mad: [0.0012, 0.0018, 0.0022],
    },
  };
  const TEST_KEYS = Object.keys(TESTS);
  for (const k of TEST_KEYS) TESTS[k].id = k;

  // The chi-square test is only trustworthy when every bin is expected at
  // least 5 times, so that sets the minimum sample for each test:
  // 110 for the first digit, 59 for the second, 1,146 for the first two, 500 for the last two.
  for (const test of Object.values(TESTS)) test.nMin = Math.ceil(5 / Math.min(...test.p));

  const titleOf = (test) => t("t_" + test.id);
  const modelOf = (test) => t(test.even ? "model_even" : "model_benford");

  function analyze(values, test) {
    const k = test.labels.length, P = test.p;
    const counts = new Array(k).fill(0);
    let skipped = 0;
    for (const x of values) {
      const b = test.key(x.sig);
      if (b >= 0) counts[b]++; else skipped++;
    }
    const n = counts.reduce((s, c) => s + c, 0);
    const base = { test, k, n, skipped, counts, enough: n >= test.nMin };
    if (!n) return base;

    const obs = counts.map((c) => c / n);
    if (!base.enough) return { ...base, obs };

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

    // Single values that come up far more often than expected. MAD averages
    // them away (one spike among 90 pairs barely moves it), so list them
    // separately. Bonferroni-corrected, so testing every bin at once
    // doesn't turn noise into spikes.
    const zCrit = zUpper(0.05 / (2 * k));
    const spikes = z.map((v, i) => [v, i]).filter(([v]) => v > zCrit).sort((a, b) => b[0] - a[0]).map(([, i]) => i);

    const logs = values.map((x) => Math.log10(x.v)).filter(Number.isFinite).sort((a, b) => a - b);
    const span = logs.length > 1 ? quantile(logs, 0.95) - quantile(logs, 0.05) : 0;

    return { ...base, obs, mad, chi2, p, r, z, band, span, spikes };
  }

  /* ---------------- how well it fits ---------------- */

  // A "significant deviation" needs both: the gap is bigger than chance
  // alone would explain (chi-square p < 0.05) AND it is large in size
  // (Nigrini's MAD band for nonconformity). Big samples make p tiny even for
  // harmless wobbles; small samples make MAD noisy. Each check covers the other.
  const FIT_TONE = {
    few: "var(--paper-2)", good: "var(--ok)", marginal: "var(--warn)", deviation: "var(--accent-lit)", unclear: "var(--paper-2)",
  };

  function fitOf(a) {
    if (!a.enough) return "few";
    const [, m2, m3] = a.test.mad;
    if (a.p >= 0.05) return a.mad <= m3 ? "good" : "unclear";
    if (a.mad <= m2) return "good";
    if (a.mad <= m3) return "marginal";
    return "deviation";
  }

  function conformity(a) {
    const [m1, m2, m3] = a.test.mad;
    return t(a.mad <= m1 ? "conf_close" : a.mad <= m2 ? "conf_acceptable" : a.mad <= m3 ? "conf_marginal" : "conf_non");
  }

  const pText = (p) => (p < 0.001 ? "< " + dec(0.001, 3) : "= " + dec(p, 3));

  // The sentence the result stands on, e.g. "The first digits differ from
  // Benford's law by 0.39 percentage points per digit on average."
  function describe(a) {
    const gap = t("describe", { test: a.test.id, gap: dec(a.mad * 100, 2), mad: dec(a.mad, 4), conf: conformity(a), even: !!a.test.even });
    return gap + t(a.p < 0.05 ? "chanceBeyond" : "chanceWithin", { p: pText(a.p) });
  }

  /* ---------------- state ---------------- */

  const state = {
    tab: "paste",
    paste: { cols: null, free: null, fmt: "dot" },
    file: { cols: null, free: null, fmt: "dot", name: "", reparse: null },
  };

  const textarea = $("numbers");
  const optMin = $("opt-min"), optSign = $("opt-sign"), optUnique = $("opt-unique"), optFormat = $("opt-format");
  const radio = (name) => (document.querySelector(`input[name="${name}"]:checked`) || {}).value;

  // the setting wins; "auto" asks the data
  const resolveFormat = (strings) => (optFormat.value === "auto" ? detectFormat(strings) : optFormat.value);

  function readPaste() {
    const text = textarea.value;
    const delim = /\t|;/.test(text) ? detectDelim(text, ["\t", ";"]) : null;
    if (delim) {
      const rows = parseDelimited(text, delim);
      const fmt = resolveFormat(textCells(rows));
      const cols = columnsFromRows(rows, "", fmt);
      if (cols.length > 1) {
        state.paste = { cols: keepChoices(cols, state.paste.cols), free: null, fmt };
        return;
      }
    }
    const fmt = resolveFormat([text]);
    state.paste = { cols: null, free: extractFree(text, fmt), fmt };
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
      cnt.textContent = fmtInt(c.infos.length);
      span.appendChild(cnt);
      lab.append(inp, span);
      list.appendChild(lab);
    });
  }

  function renderParsed({ values, zeros, drop, min, src }) {
    const bits = [];
    const any = values.length || zeros || drop.small || drop.sign || drop.dups;
    const vars = (count) => ({ n: fmtInt(count), count });
    if (src.cols && src.cols.length && !src.cols.some((c) => c.on)) bits.push(t("parsedNoCols"));
    else if (any) bits.push(t("parsedRead", { ...vars(values.length), fmt: FORMATS[src.fmt || "dot"] }));
    if (zeros) bits.push(t("parsedZeros", vars(zeros)));
    if (drop.small) bits.push(t("parsedSmall", { ...vars(drop.small), min: fmtNum(min) }));
    if (drop.sign) bits.push(t(optSign.value === "pos" ? "parsedNeg" : "parsedPos", vars(drop.sign)));
    if (drop.dups) bits.push(t("parsedDups", vars(drop.dups)));
    $("parsed").textContent = bits.join(" · ");
  }

  function note(el, text, cls) {
    el.textContent = text;
    el.className = "stat-note " + (cls || "");
  }

  // share formatting: finer tests need an extra decimal
  const share = (a, x) => pct(x, a.k > 10 ? 2 : 1);
  const pts = (a, d) => (d >= 0 ? "+" : "−") + dec(Math.abs(d) * 100, a.k > 10 ? 2 : 1);

  function renderTiles(all) {
    TEST_KEYS.forEach((k) => {
      const a = all[k], fit = fitOf(a), cell = $("tv-" + k);
      const detail = !a.enough
        ? t("tileNeed", { n: fmtInt(a.n), min: fmtInt(a.test.nMin) })
        : `MAD ${dec(a.mad, 4)}`;
      cell.innerHTML = "";
      cell.append(t(fit === "few" ? "fit_few_short" : "fit_" + fit));
      const small = document.createElement("small");
      small.textContent = detail;
      cell.appendChild(small);
      cell.style.setProperty("--t-tone", FIT_TONE[fit]);
    });
  }

  function renderScale(a) {
    const [m1, m2, m3] = a.test.mad;
    const max = Math.max(m3 * 2, a.mad * 1.08);
    // fr factors that sum below 1 only fill part of the row, so scale them up
    const cols = [m1, m2 - m1, m3 - m2, max - m3].map((w) => (w * 1e4).toFixed(2) + "fr").join(" ");
    $("scale-track").style.gridTemplateColumns = cols;
    $("scale-labels").style.gridTemplateColumns = cols;
    $("scale-mark").style.left = ((a.mad / max) * 100).toFixed(2) + "%";
  }

  function renderReport(a) {
    const test = a.test, fit = fitOf(a);
    const report = $("report");
    report.style.setProperty("--tone", FIT_TONE[fit]);
    report.classList.toggle("is-plain", !a.enough);
    $("test-note").textContent = t("note_" + test.id);

    $("verdict-label").textContent = t("fit_" + fit);
    $("scale").hidden = !a.enough;
    $("stats").hidden = !a.enough;
    $("detail").hidden = !a.n;
    $("detail-empty").hidden = !!a.n;

    if (!a.n) {
      $("verdict-sub").textContent = "";
      $("warnings").innerHTML = "";
      $("detail-empty").textContent = t("tooShort");
      lastAnalysis = null;
      return;
    }

    const warn = [];
    if (a.skipped) warn.push(t("warnSkipped", { n: fmtInt(a.skipped), one: a.skipped === 1 }));

    if (!a.enough) {
      $("verdict-sub").textContent = t("fewSub", { test: test.id, min: fmtInt(test.nMin), n: fmtInt(a.n) });
    } else {
      $("verdict-sub").textContent = describe(a);
      renderScale(a);
      if (a.spikes.length) {
        const list = a.spikes.slice(0, 5).map((i) => t("spikeItem", { l: test.labels[i], got: share(a, a.obs[i]), exp: share(a, test.p[i]) })).join(", ");
        warn.push(t("warnSpikes", { list, more: a.spikes.length > 5 ? fmtInt(a.spikes.length - 5) : "", one: a.spikes.length === 1 }));
      }
      if (a.n < (a.k > 10 ? 3000 : 300)) warn.push(t("warnSmall", { n: fmtInt(a.n) }));
      if (!test.even) {
        if (a.span < 1) warn.push(t("warnSpan1"));
        else if (a.span < 2) warn.push(t("warnSpan2"));
      }

      $("s-n").textContent = fmtInt(a.n);
      if (a.r == null) {
        $("s-r").textContent = "n/a";
        note($("s-r-note"), t("rFlat"));
      } else {
        $("s-r").textContent = dec(a.r, 3);
        note($("s-r-note"),
          t(a.r >= 0.98 ? "rSame" : a.r >= 0.9 ? "rSimilar" : a.r >= 0.7 ? "rLoose" : "rDiff"),
          a.r >= 0.98 ? "good" : a.r >= 0.9 ? "" : a.r >= 0.7 ? "meh" : "bad");
      }
      const [m1, m2, m3] = test.mad;
      $("s-mad").textContent = dec(a.mad, 4);
      note($("s-mad-note"), conformity(a), a.mad <= m1 ? "good" : a.mad <= m2 ? "" : a.mad <= m3 ? "meh" : "bad");
      $("s-p").textContent = a.p < 0.001 ? "<" + dec(0.001, 3) : dec(a.p, 3);
      note($("s-p-note"), t(a.p >= 0.05 ? "pWithin" : "pBeyond"), a.p >= 0.05 ? "good" : "meh");
    }
    $("warnings").innerHTML = warn.map((w) => `<li>${w}</li>`).join("");

    // table: every bin for the short tests; for the long ones the biggest
    // deviations, or the most common values when there's nothing to compare
    const fine = a.k > 10;
    $("th-bin").textContent = t(fine ? "thDigits" : "thDigit");
    $("th-exp").textContent = t(test.even ? "thExpected" : "thBenford");
    let rows = a.obs.map((_, i) => i);
    if (fine) {
      rows = a.enough
        ? rows.sort((i, j) => Math.abs(a.z[j]) - Math.abs(a.z[i])).slice(0, 12)
        : rows.filter((i) => a.counts[i]).sort((i, j) => a.counts[j] - a.counts[i]).slice(0, 12);
    }
    $("table-note").textContent = !fine ? "" : a.enough ? t("noteTop", { k: a.k }) : t("noteCommon");
    $("table-note").hidden = !fine;
    $("digit-rows").innerHTML = rows.map((i) => {
      if (!a.enough) {
        return `<tr><td>${test.labels[i]}</td><td>${fmtInt(a.counts[i])}</td><td>${share(a, a.obs[i])}</td></tr>`;
      }
      const diff = a.obs[i] - test.p[i];
      const sig = Math.abs(a.z[i]) > 1.96;
      return `<tr>
        <td>${test.labels[i]}</td>
        <td>${fmtInt(a.counts[i])}</td>
        <td>${share(a, a.obs[i])}</td>
        <td>${share(a, test.p[i])}</td>
        <td class="${sig ? "sig" : diff >= 0 ? "pos" : "neg"}">${pts(a, diff)}</td>
        <td class="${sig ? "sig" : ""}">${a.z[i] >= 0 ? "" : "−"}${dec(Math.abs(a.z[i]), 2)}</td>
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
  let lastAll = null;

  // With too few numbers the chart shows plain counts only: no expected
  // curve, no normal range, nothing that invites a comparison.
  function renderChart(a) {
    lastAnalysis = a;
    const test = a.test, P = test.p, k = a.k, fine = k > 20, plain = !a.enough;
    $("key-exp").textContent = modelOf(test);

    const host = $("chart");
    const narrow = host.clientWidth < 480;
    const W = 640, H = narrow ? 400 : 330;
    const m = { t: 18, r: 6, b: 34, l: 46 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b;

    const top = Math.max(...a.obs, ...(plain ? [] : P.map((e, i) => e + a.band[i]))) * 1.08;
    const step = top <= 0.03 ? 0.005 : top <= 0.08 ? 0.01 : top <= 0.2 ? 0.025 : top <= 0.5 ? 0.05 : 0.1;
    const yMax = Math.ceil(top / step) * step;
    const y = (v) => m.t + ih - (Math.min(v, yMax) / yMax) * ih;
    const cw = iw / k;
    const cx = (i) => m.l + cw * (i + 0.5);

    const svg = el("svg", {
      viewBox: `0 0 ${W} ${H}`, role: "img",
      "aria-label": plain ? t("chartPlain", { title: titleOf(test) }) : t("chartCompare", { title: titleOf(test), model: modelOf(test) }),
    });

    const grid = el("g", { class: "grid" }, svg);
    for (let v = 0; v <= yMax + 1e-9; v += step) {
      el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }, grid);
      const tx = el("text", { x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }, grid);
      tx.textContent = fmtNum(+(v * 100).toFixed(1)) + "%";
    }

    const cols = el("g", {}, svg);
    const bw = fine ? Math.max(1, cw - 1.5) : cw * 0.5, bandW = fine ? cw : cw * 0.78;
    const axis = el("g", { class: "axis" }, svg);
    P.forEach((e, i) => {
      const g = el("g", { class: "col-g", "data-i": i }, cols);
      el("rect", { class: "hover-bg", x: m.l + cw * i, y: m.t, width: cw, height: ih }, g);

      let hi = 0;
      if (!plain) {
        const lo = Math.max(0, e - a.band[i]);
        hi = e + a.band[i];
        el("rect", { class: fine ? "band is-fine" : "band", x: cx(i) - bandW / 2, y: y(hi), width: bandW, height: Math.max(1, y(lo) - y(hi)) }, g);
      }

      const off = !plain && Math.abs(a.z[i]) > 1.96;
      const by = y(a.obs[i]);
      el("rect", { class: "bar" + (off ? " is-off" : ""), x: cx(i) - bw / 2, y: by, width: bw, height: Math.max(0, m.t + ih - by) }, g);
      if (off && !fine) {
        const f = el("text", { class: "flag", x: cx(i), y: Math.min(by, y(hi)) - 6, "text-anchor": "middle" }, g);
        f.textContent = a.obs[i] > e ? "▲" : "▼";
      }

      if (!fine || i % 10 === 0) {
        const lab = el("text", { x: fine ? m.l + cw * i : cx(i), y: H - 10, "text-anchor": fine ? "start" : "middle" }, axis);
        lab.textContent = test.labels[i];
      }
    });

    if (!plain) {
      el("path", { class: "curve", d: P.map((e, i) => (i ? "L" : "M") + cx(i).toFixed(1) + " " + y(e).toFixed(1)).join(" ") }, svg);
      if (!fine) P.forEach((e, i) => el("circle", { class: "pt", cx: cx(i), cy: y(e), r: 3.5 }, svg));
    }

    const hits = el("g", {}, svg);
    P.forEach((_, i) => el("rect", { class: "hit", "data-i": i, x: m.l + cw * i, y: 0, width: cw, height: H }, hits));

    host.replaceChildren(svg);
  }

  const tip = $("tip");
  function showTip(i, evt) {
    const a = lastAnalysis;
    if (!a) return;
    const test = a.test, e = test.p[i];
    const wrap = tip.parentElement.getBoundingClientRect();
    const row = (label, value) => `<div class="row"><span>${label}</span><span>${value}</span></div>`;
    tip.innerHTML = `<b>${t("tip_" + test.id, { l: test.labels[i] })}</b>` +
      row(t("tipYours"), `${share(a, a.obs[i])} (${fmtInt(a.counts[i])})`) +
      (a.enough
        ? row(t(test.even ? "tipExpected" : "tipBenford"), share(a, e)) +
          row(t("tipRange"), `${share(a, Math.max(0, e - a.band[i]))} ${t("tipTo")} ${share(a, e + a.band[i])}`) +
          row(t("tipDiff"), `${pts(a, a.obs[i] - e)} ${t("pts")}`)
        : "");
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
    const hit = e.target.closest(".hit");
    if (hit) showTip(+hit.dataset.i, e); else hideTip();
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

  function summary(all) {
    return [
      t("sumHead", { n: fmtInt(all.first.n) }),
      ...TEST_KEYS.map((k) => {
        const a = all[k];
        if (!a.enough) return t("sumFew", { title: titleOf(a.test), n: fmtInt(a.n), min: fmtInt(a.test.nMin) });
        return `${titleOf(a.test)}: ${t("fit_" + fitOf(a))}. ${describe(a)}`;
      }),
      t("sumFoot"),
    ].join("\n");
  }

  // The CSV stays machine-readable: English headers, dot decimals.
  $("dl-csv").addEventListener("click", () => {
    const a = lastAnalysis;
    if (!a) return;
    const test = a.test;
    const name = { first: "first-digit", second: "second-digit", firstTwo: "first-two-digits", lastTwo: "last-two-digits" }[test.id];
    const verdict = { few: "not enough data", good: "good fit", marginal: "marginal fit", deviation: "significant deviation", unclear: "no clear deviation" }[fitOf(a)];
    const head = a.enough
      ? [["test", name], ["numbers", a.n], ["result", verdict], ["mad", a.mad.toFixed(5)],
        ["chi_square", a.chi2.toFixed(3)], ["p_value", a.p.toExponential(3)], ["correlation", a.r == null ? "" : a.r.toFixed(4)], [],
        ["digits", "count", "share", "expected", "difference", "z"]]
      : [["test", name], ["numbers", a.n], ["result", verdict], ["minimum_numbers", test.nMin], [],
        ["digits", "count", "share"]];
    const body = a.obs.map((o, i) => a.enough
      ? [test.labels[i], a.counts[i], o.toFixed(5), test.p[i].toFixed(5), (o - test.p[i]).toFixed(5), a.z[i].toFixed(3)]
      : [test.labels[i], a.counts[i], o.toFixed(5)]);
    const lines = [...head, ...body].map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([lines + "\n"], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `benford-${name}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  /* ---------------- chart as PNG ---------------- */

  // A self-contained figure for slides and reports: test and result on top,
  // the chart, and a footer with n, MAD, p, the data source and the date.
  // Drawn on a canvas (not a copy of the on-screen SVG) so it can use a
  // light background and the page's web fonts at twice the resolution.
  const PNG = {
    W: 1600, H: 1000, scale: 2, pad: 64,
    bg: "#ffffff", ink: "#14120f", ink2: "#4a443d", ink3: "#8a8178", grid: "#e6e0d8",
    bar: "#a89c8f", barOff: "#3b3530", accent: "#e0402b", band: "rgba(224, 64, 43, 0.13)",
    serif: '"Fraunces", Georgia, serif', mono: '"IBM Plex Mono", ui-monospace, monospace',
  };

  function wrapText(ctx, text, maxWidth) {
    const lines = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      const next = line ? line + " " + word : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  function sourceLabel() {
    if (state.tab === "file" && state.file.name) return state.file.name;
    const sample = { invoices: "sInvoices", fib: "sFib", messy: "sMessy", invented: "sInvented", limit: "sLimit", class: "sClass" }[lastSample];
    return sample ? t(sample) : t("pngPasted");
  }

  async function drawPng(a) {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    const { W, H, scale, pad } = PNG;
    const canvas = document.createElement("canvas");
    canvas.width = W * scale;
    canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = PNG.bg;
    ctx.fillRect(0, 0, W, H);

    const test = a.test, P = test.p, k = a.k, fine = k > 20, plain = !a.enough;

    // title: test · result
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = PNG.ink;
    ctx.font = `700 46px ${PNG.serif}`;
    ctx.fillText(`${titleOf(test)} · ${t("fit_" + fitOf(a))}`, pad, pad + 40);

    // the sentence the result stands on
    ctx.font = `400 21px ${PNG.mono}`;
    ctx.fillStyle = PNG.ink2;
    const sub = plain ? t("fewSub", { test: test.id, min: fmtInt(test.nMin), n: fmtInt(a.n) }) : describe(a);
    let y = pad + 90;
    for (const line of wrapText(ctx, sub, W - pad * 2).slice(0, 4)) {
      ctx.fillText(line, pad, y);
      y += 31;
    }

    // legend
    y += 22;
    ctx.font = `500 19px ${PNG.mono}`;
    let x = pad;
    const key = (draw, label) => {
      draw(x, y);
      ctx.fillStyle = PNG.ink2;
      ctx.fillText(label, x + 30, y + 6);
      x += 30 + ctx.measureText(label).width + 36;
    };
    key((kx, ky) => { ctx.fillStyle = PNG.bar; ctx.fillRect(kx, ky - 9, 18, 18); }, t("keyObs"));
    if (!plain) {
      key((kx, ky) => { ctx.strokeStyle = PNG.accent; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(kx - 2, ky); ctx.lineTo(kx + 22, ky); ctx.stroke(); }, modelOf(test));
      key((kx, ky) => { ctx.fillStyle = PNG.band; ctx.fillRect(kx, ky - 9, 20, 18); }, t("keyBand"));
    }

    // chart area
    const m = { t: y + 40, r: pad, b: H - 150, l: pad + 62 };
    const iw = W - m.l - m.r, ih = m.b - m.t;
    const top = Math.max(...a.obs, ...(plain ? [] : P.map((e, i) => e + a.band[i]))) * 1.08;
    const step = top <= 0.03 ? 0.005 : top <= 0.08 ? 0.01 : top <= 0.2 ? 0.025 : top <= 0.5 ? 0.05 : 0.1;
    const yMax = Math.ceil(top / step) * step;
    const yy = (v) => m.b - (Math.min(v, yMax) / yMax) * ih;
    const cw = iw / k;
    const cx = (i) => m.l + cw * (i + 0.5);

    ctx.font = `400 17px ${PNG.mono}`;
    ctx.textAlign = "right";
    for (let v = 0; v <= yMax + 1e-9; v += step) {
      ctx.strokeStyle = PNG.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.l, Math.round(yy(v)) + 0.5);
      ctx.lineTo(W - m.r, Math.round(yy(v)) + 0.5);
      ctx.stroke();
      ctx.fillStyle = PNG.ink3;
      ctx.fillText(fmtNum(+(v * 100).toFixed(1)) + "%", m.l - 12, yy(v) + 6);
    }

    const bw = fine ? Math.max(1, cw - 2) : cw * 0.5, bandW = fine ? cw : cw * 0.78;
    P.forEach((e, i) => {
      if (!plain) {
        const lo = Math.max(0, e - a.band[i]), hi = e + a.band[i];
        ctx.fillStyle = PNG.band;
        ctx.fillRect(cx(i) - bandW / 2, yy(hi), bandW, Math.max(1, yy(lo) - yy(hi)));
      }
      const off = !plain && Math.abs(a.z[i]) > 1.96;
      ctx.fillStyle = off ? PNG.barOff : PNG.bar;
      ctx.fillRect(cx(i) - bw / 2, yy(a.obs[i]), bw, m.b - yy(a.obs[i]));
    });

    if (!plain) {
      ctx.strokeStyle = PNG.accent;
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.beginPath();
      P.forEach((e, i) => (i ? ctx.lineTo(cx(i), yy(e)) : ctx.moveTo(cx(i), yy(e))));
      ctx.stroke();
      if (!fine) {
        P.forEach((e, i) => {
          ctx.beginPath();
          ctx.arc(cx(i), yy(e), 5.5, 0, Math.PI * 2);
          ctx.fillStyle = PNG.bg;
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.stroke();
        });
      }
    }

    // x axis labels
    ctx.fillStyle = PNG.ink2;
    ctx.font = `500 ${fine ? 17 : 21}px ${PNG.mono}`;
    ctx.textAlign = fine ? "left" : "center";
    test.labels.forEach((l, i) => {
      if (!fine || i % 10 === 0) ctx.fillText(String(l), fine ? m.l + cw * i : cx(i), m.b + 30);
    });

    // footer: numbers, source, date, tool
    ctx.textAlign = "left";
    ctx.font = `400 17px ${PNG.mono}`;
    ctx.fillStyle = PNG.ink3;
    const facts = [`n = ${fmtInt(a.n)}`];
    if (!plain) facts.push(`MAD ${dec(a.mad, 4)} (${conformity(a)})`, `${t("stP")} ${pText(a.p)}`);
    ctx.fillText(facts.join("   ·   "), pad, H - 62);
    const date = new Date().toLocaleDateString(loc());
    ctx.fillText(`${t("pngSource")}: ${sourceLabel()}   ·   ${date}   ·   tothdavid.eu/benford`, pad, H - 34);

    return new Promise((res) => canvas.toBlob(res, "image/png"));
  }

  $("dl-png").addEventListener("click", async () => {
    const a = lastAnalysis;
    if (!a) return;
    const blob = await drawPng(a);
    if (!blob) return flash(t("pngFail"));
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const name = { first: "first-digit", second: "second-digit", firstTwo: "first-two-digits", lastTwo: "last-two-digits" }[a.test.id];
    link.href = url;
    link.download = `benford-${name}-${new Date().toISOString().slice(0, 10)}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $("copy-sum").addEventListener("click", async () => {
    if (!lastAll) return;
    try {
      await navigator.clipboard.writeText(summary(lastAll));
      flash(t("copied"));
    } catch {
      flash(t("copyFail"));
    }
  });

  /* ---------------- main update ---------------- */

  function update() {
    const src = currentSource();
    renderColumns(src);
    const c = collect();
    renderParsed(c);
    const has = c.values.length > 0;
    $("empty").hidden = has;
    $("report").hidden = !has;
    if (!has) {
      lastAnalysis = lastAll = null;
      return;
    }
    const all = Object.fromEntries(TEST_KEYS.map((k) => [k, analyze(c.values, TESTS[k])]));
    lastAll = all;
    renderTiles(all);
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
  optFormat.addEventListener("change", () => {
    readPaste();
    if (state.file.reparse) state.file = { ...state.file, ...state.file.reparse(state.file.cols) };
    update();
  });
  document.querySelectorAll('input[name="test"]').forEach((r) => r.addEventListener("change", update));

  /* ---------------- tabs ---------------- */

  const tabs = [...document.querySelectorAll(".tab")];
  function selectTab(tab, focus) {
    tabs.forEach((tb) => {
      const on = tb === tab;
      tb.classList.toggle("is-active", on);
      tb.setAttribute("aria-selected", on);
      tb.tabIndex = on ? 0 : -1;
      $(tb.getAttribute("aria-controls")).hidden = !on;
    });
    if (focus) tab.focus();
    state.tab = tab.id === "tab-paste" ? "paste" : "file";
    update();
  }
  tabs.forEach((tb, i) => {
    tb.addEventListener("click", () => selectTab(tb));
    tb.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        selectTab(tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length], true);
      }
    });
  });

  /* ---------------- files ---------------- */

  const status = $("file-status");
  let lastStatus = null;
  // kept as a key + vars so it re-renders when the language changes
  function setStatus(key, vars, err) {
    lastStatus = key ? { key, vars, err } : null;
    status.textContent = key ? t(key, vars) : "";
    status.classList.toggle("is-error", !!err);
  }

  let xlsxLoading = null;
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (!xlsxLoading) {
      xlsxLoading = new Promise((res, rej) => {
        const s = document.createElement("script");
        s.src = XLSX_SRC;
        s.onload = () => res(window.XLSX);
        s.onerror = () => { xlsxLoading = null; rej(Object.assign(new Error("xlsx"), { key: "fileXlsx" })); };
        document.head.appendChild(s);
      });
    }
    return xlsxLoading;
  }

  function fromJSON(data) {
    // array of objects → one column per key
    if (Array.isArray(data) && data.length && data.every((r) => r && typeof r === "object" && !Array.isArray(r))) {
      const keys = [...new Set(data.flatMap((r) => Object.keys(r)))];
      const rows = [keys, ...data.map((r) => keys.map((k) => r[k]))];
      return (prev) => {
        const fmt = resolveFormat(textCells(rows.slice(1)));
        return { cols: keepChoices(columnsFromRows(rows, "", fmt), prev), free: null, fmt };
      };
    }
    // anything else → every number in it
    const leaves = [];
    (function walk(v) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") Object.values(v).forEach(walk);
      else if (typeof v === "number" || typeof v === "string") leaves.push(v);
    })(data);
    return () => {
      const fmt = resolveFormat(leaves.filter((v) => typeof v === "string"));
      const values = [];
      let zeros = 0;
      for (const v of leaves) {
        const info = numInfo(v, fmt);
        if (info) info.zero ? zeros++ : values.push(info);
      }
      return { cols: null, free: { values, zeros }, fmt };
    };
  }

  // Each reader returns a parse function rather than a result, so changing
  // the number format can re-read the same file without asking for it again.
  async function readerFor(file) {
    const ext = (file.name.split(".").pop() || "").toLowerCase();
    if (["xlsx", "xls", "ods", "xlsm", "xlsb"].includes(ext)) {
      const XLSX = await loadXLSX();
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const multi = wb.SheetNames.length > 1;
      const sheets = wb.SheetNames.map((name) => ({
        prefix: multi ? name : "",
        rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, blankrows: false, defval: "" }),
      }));
      return (prev) => {
        const fmt = resolveFormat(sheets.flatMap((s) => textCells(s.rows)));
        const cols = sheets.flatMap((s) => columnsFromRows(s.rows, s.prefix, fmt));
        return { cols: keepChoices(cols, prev), free: null, fmt };
      };
    }

    const text = await file.text();
    if (ext === "json" || /^\s*[[{]/.test(text)) {
      try { return fromJSON(JSON.parse(text)); } catch { /* not JSON after all */ }
    }
    const delim = detectDelim(text, ext === "tsv" ? ["\t"] : ["\t", ";", ",", "|"]);
    const rows = delim ? parseDelimited(text, delim) : null;
    return (prev) => {
      if (rows) {
        const fmt = resolveFormat(textCells(rows));
        const cols = columnsFromRows(rows, "", fmt);
        if (cols.length) return { cols: keepChoices(cols, prev), free: null, fmt };
      }
      const fmt = resolveFormat([text]);
      return { cols: null, free: extractFree(text, fmt), fmt };
    };
  }

  async function handleFile(file) {
    if (!file) return;
    const name = file.name;
    if (file.size > MAX_FILE_BYTES) {
      setStatus("fileTooBig", { name, mb: fmtInt(Math.round(file.size / 1048576)) }, true);
      return;
    }
    setStatus("fileReading", { name });
    try {
      const reparse = await readerFor(file);
      const result = reparse(null);
      const count = result.cols ? result.cols.reduce((s, c) => s + c.infos.length, 0) : result.free.values.length;
      if (!count) setStatus("fileNone", { name }, true);
      else if (result.cols) setStatus("fileCols", { name, n: fmtInt(count), c: result.cols.length });
      else setStatus("fileFree", { name, n: fmtInt(count) });
      state.file = { ...result, name, reparse };
      update();
    } catch (err) {
      setStatus(err && err.key ? err.key : "fileFail", {}, true);
    }
  }

  const drop = $("drop"), fileInput = $("file");
  fileInput.addEventListener("change", () => { handleFile(fileInput.files[0]); fileInput.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("is-over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove("is-over")));
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
      let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // samples come out in the page language's format (1,234.56 / 1 234,56)
  const moneyFmt = () => new Intl.NumberFormat(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const gaussOf = (r) => () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const LOG_PHI = Math.log10((1 + Math.sqrt(5)) / 2), LOG_SQRT5 = Math.log10(Math.sqrt(5));

  // Every sample takes a size, so you can see how the result firms up as n grows.
  const SAMPLES = {
    invoices(n, money) {
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
    messy(n, money) {
      // Real, but not textbook: spending with a narrower spread plus a
      // recurring 24 to 38 charge (a subscription, a fee) making up 12% of
      // rows. It deviates from Benford for a perfectly innocent reason.
      const r = rng(2024), g = gaussOf(r);
      return Array.from({ length: n }, () =>
        money.format(r() < 0.12 ? 24 + r() * 14 : Math.exp(5.5 + 1.6 * g())));
    },
    invented(n, money) {
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
    limit(n, money) {
      // Genuine expense claims, except 7% were split or trimmed to land just
      // under a 5,000 sign-off limit. The first-two-digits test finds the 48s and 49s.
      const r = rng(5000), g = gaussOf(r);
      return Array.from({ length: n }, () =>
        money.format(r() < 0.07 ? 4800 + r() * 199 : Math.exp(6.2 + 1.5 * g())));
    },
  };

  const sampleSize = $("sample-size");
  let lastSample = null;

  // The classroom demo: ten made-up numbers per person, collected on /szamok
  // and read live from the same database. Real data, so the size picker
  // doesn't apply.
  async function loadClass() {
    lastSample = "class";
    textarea.placeholder = t("placeholder"); // clear an earlier failure message
    let nums;
    try {
      const res = await fetch("/api/numbers");
      const out = await res.json();
      if (!out.ok) throw new Error(out.error);
      nums = out.nums;
    } catch {
      if (lastSample !== "class") return;
      // the file status line lives on the other tab, so say it in the empty box
      textarea.value = "";
      textarea.placeholder = t("classFail");
      readPaste();
      update();
      return;
    }
    if (lastSample !== "class") return; // another sample was picked meanwhile
    textarea.value = nums.join("\n");
    textarea.scrollTop = 0;
    readPaste();
    update();
  }

  function loadSample(name) {
    if (name === "class") return loadClass();
    lastSample = name;
    textarea.placeholder = t("placeholder");
    textarea.value = SAMPLES[name](+sampleSize.value, moneyFmt()).join("\n");
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
    if (lastSample && lastSample !== "class" && state.tab === "paste") loadSample(lastSample);
  });
  textarea.addEventListener("input", () => { lastSample = null; });

  function renderSizeOptions() {
    for (const o of sampleSize.options) o.textContent = fmtInt(+o.value);
  }

  /* ---------------- language ---------------- */

  window.I18N.onChange(() => {
    renderSizeOptions();
    if (lastStatus) setStatus(lastStatus.key, lastStatus.vars, lastStatus.err);
    update();
  });

  /* ---------------- boot ---------------- */

  // The collection page's admin view hands numbers over through
  // localStorage; pick them up if they were left in the last few minutes.
  function importHandoff() {
    try {
      const raw = localStorage.getItem("benford:import");
      if (!raw) return;
      localStorage.removeItem("benford:import");
      const { text, at } = JSON.parse(raw);
      if (typeof text !== "string" || Date.now() - at > 5 * 60 * 1000) return;
      textarea.value = text;
    } catch { /* storage blocked or bad data: start empty */ }
  }

  renderSizeOptions();
  importHandoff();
  readPaste();
  update();
})();
