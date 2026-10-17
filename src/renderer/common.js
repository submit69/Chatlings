// Small helpers shared by Bongbong's own pages (no framework).
(function () {
  'use strict';
  let dict = {};

  function setDict(d) {
    dict = d || {};
    document.documentElement.lang = dict['meta.lang'] || 'en';
  }

  function t(key, vars) {
    let s = dict[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`));
    return s;
  }

  /** Fills [data-i18n], [data-i18n-title], [data-i18n-placeholder]. */
  function applyI18n(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n)));
    root.querySelectorAll('[data-i18n-title]').forEach((el) => (el.title = t(el.dataset.i18nTitle)));
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
  }

  const NS = 'http://www.w3.org/2000/svg';
  /** Service glyph as an <svg>, filled with `fill`. */
  function iconSvg(icon, fill = '#fff') {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', (icon && icon.viewBox) || '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    if (icon && icon.path) {
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', icon.path);
      p.setAttribute('fill', fill);
      svg.appendChild(p);
    } else {
      const txt = document.createElementNS(NS, 'text');
      txt.setAttribute('x', '12');
      txt.setAttribute('y', '12');
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('dominant-baseline', 'central');
      txt.setAttribute('font-family', 'Segoe UI, system-ui, sans-serif');
      txt.setAttribute('font-weight', '800');
      txt.setAttribute('font-size', icon && icon.text && icon.text.length > 1 ? '12' : '15');
      txt.setAttribute('fill', fill);
      txt.textContent = (icon && icon.text) || '?';
      svg.appendChild(txt);
    }
    return svg;
  }

  function el(tag, attrs = {}, ...children) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) if (c !== null && c !== undefined) e.append(c);
    return e;
  }

  function ago(ts, now = Date.now()) {
    const s = Math.max(0, Math.round((now - ts) / 1000));
    if (s < 45) return t('time.now');
    const m = Math.round(s / 60);
    if (m < 60) return t('time.min', { n: m });
    return t('time.hour', { n: Math.round(m / 60) });
  }

  window.BB = { setDict, t, applyI18n, iconSvg, el, ago };
})();
