// "Buy the author a coffee" window. Channels come from src/donate.json.
(async () => {
  const init = await bb.invoke('bb:init');
  BB.setDict(init.dict);
  BB.applyI18n();
  const { el, t } = BB;
  const d = await bb.invoke('donate:info');
  const $ = (id) => document.getElementById(id);

  if (d.image) {
    $('picture').src = d.image;
    $('picture').hidden = false;
  } else if (d.bank && d.bank.qrOnly) {
    $('bank').hidden = false;
    $('bank-line').remove();
    $('copy').remove();
  } else if (d.bank) {
    $('bank').hidden = false;
    $('bank-line').append(d.bank.bankName ? d.bank.bankName + ' · ' : '', el('b', { text: d.bank.account }), d.bank.holder ? ' · ' + d.bank.holder : '');
    $('copy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(d.bank.account);
        $('copied').textContent = t('donate.copied');
      } catch {
        $('copied').textContent = d.bank.account;
      }
    };
  }
  const links = [
    [d.buyMeACoffee, 'donate.bmc'],
    [d.kofi, 'donate.kofi'],
    [d.githubSponsors, 'donate.sponsors'],
  ];
  for (const [url, key] of links) {
    if (url) $('links').append(el('button', { class: 'primary', type: 'button', text: t(key), onclick: () => bb.invoke('app:openExternal', url) }));
  }
})();
