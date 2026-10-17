// Settings window: general, accounts, privacy & PIN, memory, about.
(async () => {
  const { el, t, iconSvg } = BB;
  const params = new URLSearchParams(location.search);
  let tab = params.get('tab') || 'general';
  let selected = params.get('id') || null;
  let D = await bb.invoke('settings:get');
  BB.setDict(D.dict);
  BB.applyI18n();

  const setSetting = async (key, value) => {
    await bb.invoke('settings:set', { key, value });
    await reload();
  };
  const updateAccount = async (id, patch) => {
    await bb.invoke('account:update', { id, patch });
    await reload();
  };
  const action = async (id, a) => {
    await bb.invoke('account:action', { id, action: a });
    await reload();
  };
  async function reload() {
    D = await bb.invoke('settings:get');
    renderAll();
  }

  // ---------- small builders ----------
  function opt(labelKey, hintKey, control) {
    return el('div', { class: 'opt' }, el('label', {}, t(labelKey), hintKey ? el('span', { class: 'hint', text: t(hintKey) }) : null), control);
  }
  function check(value, onChange) {
    return el('input', { type: 'checkbox', checked: !!value, onchange: (e) => onChange(e.target.checked) });
  }
  function select(value, options, onChange) {
    const s = el('select', { onchange: (e) => onChange(e.target.value) });
    for (const [v, label] of options) s.append(el('option', { value: v, text: label, selected: String(v) === String(value) }));
    return s;
  }
  function number(value, min, max, onChange) {
    return el('input', { type: 'number', value, min, max, style: { width: '90px' }, onchange: (e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || min))) });
  }
  function card(...children) {
    return el('div', { class: 'card' }, ...children);
  }
  const adapterOf = (id) => D.adapters.find((a) => a.id === id) || { name: id, color: '#64748b', icon: { text: '?' } };

  // ---------- general ----------
  function general() {
    const s = D.settings;
    const dndOn = D.dndUntil > Date.now();
    return [
      el('h1', { text: t('settings.tab.general') }),
      card(
        opt('settings.language', null, select(s.locale || 'auto', [['auto', t('settings.languageAuto')], ['en', 'English'], ['vi', 'Tiếng Việt']], (v) => setSetting('locale', v === 'auto' ? null : v))),
        opt('tray.showBubbles', null, check(!s.hideAll, (v) => setSetting('hideAll', !v))),
        opt('tray.merge', 'settings.mergeHint', check(s.merged, (v) => setSetting('merged', v))),
        opt('settings.previews', 'settings.previewsHint', check(s.previews, (v) => setSetting('previews', v))),
        opt('settings.autoPeek', 'settings.autoPeekHint', check(s.autoPeek, (v) => setSetting('autoPeek', v))),
        opt('tray.autoLaunch', null, check(s.autoLaunch, (v) => setSetting('autoLaunch', v))),
        opt('settings.checkUpdates', 'settings.checkUpdatesHint', check(s.checkUpdates, (v) => setSetting('checkUpdates', v))),
        opt('settings.spellcheck', null, check(s.spellcheck, (v) => setSetting('spellcheck', v))),
        opt('settings.gpu', 'settings.gpuHint', check(s.hardwareAcceleration, (v) => setSetting('hardwareAcceleration', v))),
      ),
      el('h2', { text: t('tray.profiles') }),
      card(
        ...Object.keys(D.groups).map((g) => opt('group.' + g, 'settings.groupHint', check(D.groups[g].enabled !== false, (v) => setSetting('group:' + g, v)))),
        el(
          'div',
          { class: 'opt' },
          el('label', {}, t('tray.dnd'), el('span', { class: 'hint', text: dndOn ? t('tray.dndOnUntil', { time: new Date(D.dndUntil).toLocaleString() }) : t('settings.dndOff') })),
          el('button', { text: t('tray.dnd1h'), onclick: () => setSetting('dnd', '1h') }),
          el('button', { text: t('tray.dndMorning'), onclick: () => setSetting('dnd', 'morning') }),
          el('button', { text: t('tray.dndOff'), disabled: !dndOn, onclick: () => setSetting('dnd', 'off') }),
        ),
      ),
    ];
  }

  // ---------- accounts ----------
  function accounts() {
    if (!D.accounts.length) return [el('h1', { text: t('settings.tab.accounts') }), el('p', { class: 'muted', text: t('tray.noAccounts') })];
    if (!selected || !D.accounts.some((a) => a.id === selected)) selected = D.accounts[0].id;
    const list = el(
      'div',
      { class: 'acc-list' },
      D.accounts.map((a) => {
        const ad = adapterOf(a.adapter);
        return el(
          'button',
          { class: a.id === selected ? 'on' : '', onclick: () => ((selected = a.id), renderAll()) },
          el('span', { class: 'glyph', style: { background: a.color } }, iconSvg(ad.icon, '#fff')),
          el('span', { class: 'grow' }, el('div', { text: a.name }), el('div', { class: 'small muted', text: ad.name + (a.runtime.awake ? '' : ' · zzz') })),
        );
      }),
    );
    return [el('h1', { text: t('settings.tab.accounts') }), el('div', { class: 'split' }, list, editor(D.accounts.find((a) => a.id === selected)))];
  }

  function editor(a) {
    const id = a.id;
    const idx = D.accounts.indexOf(a);
    const sch = a.schedule || {};
    const name = el('input', { type: 'text', value: a.name, maxlength: 40, onchange: (e) => e.target.value.trim() && updateAccount(id, { name: e.target.value }) });
    const swatches = el(
      'div',
      { class: 'swatches' },
      D.colors.map((c) => el('button', { class: a.color.toLowerCase() === c.toLowerCase() ? 'on' : '', style: { background: c }, title: c, onclick: () => updateAccount(id, { color: c }) })),
    );
    const days = el(
      'div',
      { class: 'days' },
      [1, 2, 3, 4, 5, 6, 0].map((d) =>
        el(
          'label',
          {},
          el('input', {
            type: 'checkbox',
            checked: (sch.days || []).includes(d),
            onchange: (e) => {
              const set = new Set(sch.days || []);
              e.target.checked ? set.add(d) : set.delete(d);
              updateAccount(id, { schedule: { ...sch, days: [...set].sort() } });
            },
          }),
          t('day.' + d),
        ),
      ),
    );
    const time = (key) => el('input', { type: 'time', value: sch[key] || '', onchange: (e) => updateAccount(id, { schedule: { ...sch, [key]: e.target.value } }) });
    return el(
      'div',
      {},
      card(
        opt('settings.acc.name', null, name),
        opt('menu.color', null, swatches),
        opt('menu.skin', null, select(a.skin, D.skins.map((s) => [s, t('skin.' + s)]), (v) => updateAccount(id, { skin: v }))),
        opt('settings.acc.group', null, select(a.group, Object.keys(D.groups).map((g) => [g, t('group.' + g)]), (v) => updateAccount(id, { group: v }))),
        opt('settings.acc.hidden', 'settings.acc.hiddenHint', check(a.hidden, (v) => updateAccount(id, { hidden: v }))),
        opt('menu.preview', 'settings.previewsHint', check(a.preview !== false, (v) => updateAccount(id, { preview: v }))),
      ),
      el('h2', { text: t('menu.sound') }),
      card(
        opt(
          'menu.sound',
          null,
          el(
            'div',
            { class: 'row' },
            select(a.sound, D.sounds.map((s) => [s, t('sound.' + s)]), async (v) => {
              if (v === 'file') await bb.invoke('sound:pickFile', id);
              else await updateAccount(id, { sound: v });
              await bb.invoke('sound:test', id);
              await reload();
            }),
            el('button', { text: t('settings.acc.test'), onclick: () => bb.invoke('sound:test', id) }),
          ),
        ),
        a.sound === 'file' && a.soundFile ? el('div', { class: 'opt small muted', text: a.soundFile }) : null,
        opt('settings.acc.muteNative', 'settings.acc.muteNativeHint', check(a.muteNative, (v) => updateAccount(id, { muteNative: v }))),
      ),
      el('h2', { text: t('settings.acc.sleep') }),
      card(
        opt('menu.sleepMode', 'settings.acc.sleepHint', select(a.sleepMode, D.sleepModes.map((m) => [m, t('sleep.' + m)]), (v) => updateAccount(id, { sleepMode: v }))),
        opt('settings.acc.sleepEvery', null, number(a.sleepEvery, 1, 240, (v) => updateAccount(id, { sleepEvery: v }))),
        opt('settings.acc.idleMinutes', null, number(a.idleMinutes, 1, 480, (v) => updateAccount(id, { idleMinutes: v }))),
      ),
      el('h2', { text: t('settings.acc.schedule') }),
      card(
        opt('settings.acc.scheduleOn', 'settings.acc.scheduleHint', check(sch.enabled, (v) => updateAccount(id, { schedule: { ...sch, enabled: v } }))),
        opt('settings.acc.days', null, days),
        opt('settings.acc.hours', null, el('div', { class: 'row' }, time('from'), el('span', { text: '→' }), time('to'))),
        opt('settings.acc.outside', null, select(sch.outside || 'mute', [['hide', t('outside.hide')], ['mute', t('outside.mute')], ['none', t('outside.none')]], (v) => updateAccount(id, { schedule: { ...sch, outside: v } }))),
      ),
      el(
        'div',
        { class: 'actions' },
        el('button', { class: 'primary', text: t('menu.open'), onclick: () => action(id, 'open') }),
        el('button', { text: t('menu.reload'), onclick: () => action(id, 'reload') }),
        a.runtime.awake ? el('button', { text: t('menu.sleepNow'), onclick: () => action(id, 'sleep') }) : el('button', { text: t('menu.wake'), onclick: () => action(id, 'wake') }),
        el('button', { text: '↑', title: t('menu.moveUp'), disabled: idx === 0, onclick: () => bb.invoke('account:move', { id, to: idx - 1 }).then(reload) }),
        el('button', { text: '↓', title: t('menu.moveDown'), disabled: idx === D.accounts.length - 1, onclick: () => bb.invoke('account:move', { id, to: idx + 1 }).then(reload) }),
        el('span', { class: 'grow' }),
        el('button', { class: 'danger', text: t('menu.signOut'), onclick: () => action(id, 'signout') }),
        el('button', { class: 'danger', text: t('menu.remove'), onclick: () => action(id, 'remove') }),
      ),
    );
  }

  // ---------- privacy ----------
  function privacy() {
    const s = D.settings;
    const msg = el('div', { class: 'error small' });
    const oldPin = el('input', { type: 'password', inputmode: 'numeric', maxlength: 8, placeholder: t('settings.pin.old') });
    const newPin = el('input', { type: 'password', inputmode: 'numeric', maxlength: 8, placeholder: t('settings.pin.new') });
    const again = el('input', { type: 'password', inputmode: 'numeric', maxlength: 8, placeholder: t('settings.pin.again') });
    const savePin = async () => {
      if (newPin.value !== again.value) return (msg.textContent = t('settings.pin.mismatch'));
      const r = await bb.invoke('pin:set', { pin: newPin.value, oldPin: oldPin.value });
      if (!r.ok) return (msg.textContent = r.error);
      await reload();
    };
    const clearPin = async () => {
      const r = await bb.invoke('pin:clear', { oldPin: oldPin.value });
      if (!r.ok) return (msg.textContent = r.error);
      await reload();
    };
    return [
      el('h1', { text: t('settings.tab.privacy') }),
      card(
        opt('tray.hideFromCapture', 'settings.captureHint', check(s.contentProtection, (v) => setSetting('contentProtection', v))),
        opt('tray.hideOnPresent', 'settings.presentHint', check(s.hideOnPresentation, (v) => setSetting('hideOnPresentation', v))),
      ),
      el('h2', { text: t('settings.pin.title') }),
      el('p', { class: 'muted small', text: t('settings.pin.warning') }),
      card(
        el(
          'div',
          { class: 'opt' },
          el('label', {}, t(s.pinSet ? 'settings.pin.change' : 'settings.pin.set'), el('span', { class: 'hint', text: t('settings.pin.rule') })),
          el('div', { class: 'row' }, s.pinSet ? oldPin : null, newPin, again, el('button', { class: 'primary', text: t('common.save'), onclick: savePin })),
        ),
        s.pinSet ? el('div', { class: 'opt' }, el('label', {}, t('settings.pin.remove'), el('span', { class: 'hint', text: t('settings.pin.removeHint') })), el('button', { class: 'danger', text: t('settings.pin.removeBtn'), onclick: clearPin })) : null,
        msg,
        opt('settings.pin.auto', 'settings.pin.autoHint', number(s.autoLockMinutes, 0, 240, (v) => setSetting('autoLockMinutes', v))),
        opt('settings.pin.onWinLock', null, check(s.lockOnScreenLock, (v) => setSetting('lockOnScreenLock', v))),
      ),
    ];
  }

  // ---------- memory ----------
  function memory() {
    const m = D.memory || { accounts: {}, frameMB: 0, totalMB: 0 };
    const rows = D.accounts.map((a) =>
      el(
        'tr',
        {},
        el('td', { text: a.name }),
        el('td', { class: 'muted', text: adapterOf(a.adapter).name }),
        el('td', { text: a.runtime.awake ? t('settings.mem.awake') : t('tray.asleep') }),
        el('td', { class: 'num', text: a.runtime.awake && m.accounts[a.id] ? m.accounts[a.id] + ' MB' : '—' }),
        el(
          'td',
          {},
          a.runtime.awake ? el('button', { text: t('menu.sleepNow'), onclick: () => action(a.id, 'sleep') }) : el('button', { text: t('menu.wake'), onclick: () => action(a.id, 'wake') }),
          ' ',
          el('button', { text: t('menu.reload'), onclick: () => action(a.id, 'reload') }),
        ),
      ),
    );
    return [
      el('h1', { text: t('settings.tab.memory') }),
      el('p', { class: 'muted', text: t('settings.mem.truth') }),
      el(
        'div',
        { class: 'stat' },
        el('div', {}, el('b', { text: (m.totalMB || '—') + ' MB' }), t('settings.mem.total')),
        el('div', {}, el('b', { text: (m.frameMB || '—') + ' MB' }), t('settings.mem.frame')),
      ),
      card(el('table', {}, el('thead', {}, el('tr', {}, ['settings.mem.account', 'settings.mem.app', 'settings.mem.state', 'settings.mem.ram', ''].map((k) => el('th', { text: k ? t(k) : '' })))), el('tbody', {}, rows))),
      el('div', { class: 'actions' }, el('button', { class: 'primary', text: t('tray.memRefresh'), onclick: async () => ((D.memory = await bb.invoke('mem:sample')), renderAll()) })),
      card(opt('settings.mem.threshold', 'settings.mem.thresholdHint', number(D.settings.memThresholdMB, 0, 8000, (v) => setSetting('memThresholdMB', v)))),
    ];
  }

  // ---------- about ----------
  function about() {
    const link = (url, text) => el('a', { href: '#', text, onclick: (e) => (e.preventDefault(), bb.invoke('app:openExternal', url)) });
    return [
      el('h1', { text: 'Bongbong ' + D.version }),
      el('p', { class: 'muted', text: t('about.tagline') }),
      card(
        el('div', { class: 'opt' }, el('label', {}, t('about.privacy'), el('span', { class: 'hint', text: t('about.privacyText') }))),
        el('div', { class: 'opt' }, el('label', {}, t('about.source')), link('https://github.com/submit69/bongbongzalo', 'github.com/submit69/bongbongzalo')),
        el('div', { class: 'opt' }, el('label', {}, t('tray.checkUpdates')), el('button', { text: t('tray.checkUpdates'), onclick: () => bb.invoke('updates:check') })),
        el('div', { class: 'opt' }, el('label', {}, t('about.license'), el('span', { class: 'hint', text: t('about.licenseText') }))),
      ),
      el('p', { class: 'muted small', text: t('about.disclaimer') }),
    ];
  }

  // ---------- shell ----------
  const SECTIONS = { general, accounts, privacy, memory, about };
  function renderAll() {
    document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    for (const [k, fn] of Object.entries(SECTIONS)) {
      const s = document.getElementById(k);
      s.classList.toggle('on', k === tab);
      if (k === tab) s.replaceChildren(...fn().filter(Boolean));
    }
  }
  document.querySelectorAll('nav button').forEach((b) =>
    b.addEventListener('click', async () => {
      tab = b.dataset.tab;
      if (tab === 'memory') D.memory = await bb.invoke('mem:sample');
      renderAll();
    }),
  );
  bb.on('settings:refresh', async (q) => {
    if (q && q.tab) tab = q.tab;
    if (q && q.id) selected = q.id;
    await reload();
  });
  if (tab === 'memory') D.memory = await bb.invoke('mem:sample');
  renderAll();
})();
