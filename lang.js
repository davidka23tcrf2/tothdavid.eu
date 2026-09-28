/* ============================================================
   tothdavid.eu / lang.js
   Tiny shared EN/HU switch. A page calls I18N.define(dict) with
   { en: {...}, hu: {...} }; values are strings with {placeholders}
   or functions of a vars object.

   Markup hooks:
     data-i18n="key"             textContent
     data-i18n-html="key"        innerHTML (our own copy only)
     data-i18n-attr="attr:key;…" attributes (placeholder, aria-label…)
     data-lang="hu"              a button that switches language
   ============================================================ */

(() => {
  "use strict";

  const KEY = "lang";
  const LANGS = ["en", "hu"];
  const listeners = [];
  let dict = {};
  let lang = "en";

  function stored() {
    try {
      const v = localStorage.getItem(KEY);
      return LANGS.includes(v) ? v : null;
    } catch {
      return null;
    }
  }

  function initial(fallback) {
    const q = new URLSearchParams(location.search).get("lang");
    if (LANGS.includes(q)) return q;
    const s = stored();
    if (s) return s;
    if (fallback) return fallback;
    return (navigator.language || "").toLowerCase().startsWith("hu") ? "hu" : "en";
  }

  function t(key, vars) {
    const table = dict[lang] || {};
    let s = key in table ? table[key] : (dict.en || {})[key];
    if (s == null) return key;
    if (typeof s === "function") return s(vars || {});
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ""));
    return s;
  }

  function apply(root) {
    root = root || document;
    document.documentElement.lang = lang;
    root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      for (const pair of el.dataset.i18nAttr.split(";")) {
        const [attr, key] = pair.split(":").map((s) => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      }
    });
    document.querySelectorAll("[data-lang]").forEach((b) => {
      const on = b.dataset.lang === lang;
      b.setAttribute("aria-pressed", on);
      b.classList.toggle("is-on", on);
    });
  }

  function set(next) {
    if (!LANGS.includes(next) || next === lang) return;
    lang = next;
    try { localStorage.setItem(KEY, lang); } catch { /* private mode */ }
    apply();
    listeners.forEach((f) => f(lang));
  }

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-lang]");
    if (b) set(b.dataset.lang);
  });

  window.I18N = {
    get lang() { return lang; },
    get locale() { return lang === "hu" ? "hu-HU" : "en-US"; },
    t,
    set,
    apply,
    onChange: (f) => listeners.push(f),
    // fallback: the language to use when neither the URL nor a saved choice says
    define(d, fallback) {
      dict = d;
      lang = initial(fallback);
      apply();
    },
  };
})();
