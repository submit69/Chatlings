// Notification sounds, synthesised with WebAudio so the repo ships no audio
// files (nothing to license). "file" plays a user-chosen file passed in as bytes.
(function () {
  'use strict';
  let ctx = null;
  const ac = () => (ctx = ctx || new AudioContext());

  function tone(c, { type = 'sine', freq, at = 0, dur = 0.3, gain = 0.25, slideTo = null, attack = 0.005 }) {
    const t0 = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
    return o;
  }

  const SOUNDS = {
    chime(c) {
      tone(c, { freq: 1318.5, dur: 0.35, gain: 0.18 });
      tone(c, { freq: 1975.5, at: 0.12, dur: 0.5, gain: 0.15 });
    },
    bell(c) {
      tone(c, { type: 'triangle', freq: 880, dur: 1.1, gain: 0.22 });
      tone(c, { freq: 2200, dur: 0.6, gain: 0.06 });
      tone(c, { freq: 3520, dur: 0.3, gain: 0.03 });
    },
    pop(c) {
      tone(c, { freq: 900, slideTo: 300, dur: 0.12, gain: 0.25 });
    },
    // Little "mrr-eow": a sawtooth through a moving band-pass (vowel-ish).
    meow(c) {
      const t0 = c.currentTime;
      const o = c.createOscillator();
      const f = c.createBiquadFilter();
      const g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(520, t0);
      o.frequency.linearRampToValueAtTime(820, t0 + 0.18);
      o.frequency.linearRampToValueAtTime(560, t0 + 0.55);
      f.type = 'bandpass';
      f.Q.value = 6;
      f.frequency.setValueAtTime(900, t0);
      f.frequency.linearRampToValueAtTime(1700, t0 + 0.2);
      f.frequency.linearRampToValueAtTime(1100, t0 + 0.55);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.05);
      g.gain.setValueAtTime(0.5, t0 + 0.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
      o.connect(f).connect(g).connect(c.destination);
      o.start(t0);
      o.stop(t0 + 0.65);
    },
    // Two short "woof"s: low square with a fast pitch drop through a low-pass.
    woof(c) {
      for (const at of [0, 0.22]) {
        const t0 = c.currentTime + at;
        const o = c.createOscillator();
        const f = c.createBiquadFilter();
        const g = c.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(260, t0);
        o.frequency.exponentialRampToValueAtTime(110, t0 + 0.14);
        f.type = 'lowpass';
        f.frequency.value = 700;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
        o.connect(f).connect(g).connect(c.destination);
        o.start(t0);
        o.stop(t0 + 0.2);
      }
    },
  };

  async function play(p) {
    const c = ac();
    if (c.state === 'suspended') await c.resume().catch(() => {});
    if (p.sound === 'file' && p.data) {
      try {
        const bytes = p.data instanceof Uint8Array ? p.data : new Uint8Array(p.data);
        const buf = await c.decodeAudioData(bytes.slice().buffer);
        const src = c.createBufferSource();
        const g = c.createGain();
        g.gain.value = 0.8;
        src.buffer = buf;
        src.connect(g).connect(c.destination);
        src.start();
        return;
      } catch {
        // unreadable file: fall through to the default chime
      }
    }
    (SOUNDS[p.sound] || SOUNDS.chime)(c);
  }

  window.BBSound = { play, names: Object.keys(SOUNDS) };
})();
