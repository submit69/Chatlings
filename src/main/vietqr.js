'use strict';
// VietQR (NAPAS 247) payload for a bank transfer QR code, built locally
// (EMVCo merchant-presented QR). Any Vietnamese banking app can scan it.

// Common banks → NAPAS BIN. The BIN can also be put straight into donate.json.
const BANKS = {
  vietcombank: '970436',
  vcb: '970436',
  techcombank: '970407',
  tcb: '970407',
  mbbank: '970422',
  mb: '970422',
  vietinbank: '970415',
  bidv: '970418',
  acb: '970416',
  vpbank: '970432',
  tpbank: '970423',
  sacombank: '970403',
  agribank: '970405',
  vib: '970441',
  ocb: '970448',
  msb: '970426',
  shb: '970443',
  hdbank: '970437',
  timo: '970454',
  cake: '546034',
  ubank: '546035',
  seabank: '970440',
  lpbank: '970449',
  eximbank: '970431',
  namabank: '970428',
};

function binFor(bank) {
  if (!bank) return '';
  if (/^\d{6}$/.test(String(bank.bin || ''))) return String(bank.bin);
  return BANKS[String(bank.bankName || '').toLowerCase().replace(/[^a-z]/g, '')] || '';
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), as EMVCo requires. */
function crc16(str) {
  let crc = 0xffff;
  for (const byte of Buffer.from(str, 'utf8')) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

const tlv = (id, value) => id + String(value.length).padStart(2, '0') + value;

/** Plain ASCII, no accents: what banking apps expect in the transfer note. */
function ascii(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\x20-\x7E]/g, '')
    .slice(0, 25);
}

/**
 * @param bank {bin|bankName, account, note}
 * @returns {string|null} the QR payload, or null when not configured
 */
function vietqrPayload(bank) {
  const bin = binFor(bank);
  const account = String((bank && bank.account) || '').replace(/\s/g, '');
  if (!bin || !/^[0-9A-Za-z]{4,19}$/.test(account)) return null;
  const merchant = tlv('00', 'A000000727') + tlv('01', tlv('00', bin) + tlv('01', account)) + tlv('02', 'QRIBFTTA');
  let p = tlv('00', '01') + tlv('01', '11') + tlv('38', merchant) + tlv('53', '704') + tlv('58', 'VN');
  const note = ascii(bank.note);
  if (note) p += tlv('62', tlv('08', note));
  p += '6304';
  return p + crc16(p);
}

module.exports = { BANKS, binFor, crc16, vietqrPayload, ascii };
