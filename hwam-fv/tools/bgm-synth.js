/* HWAM FV — original BGM (15s seamless loop, 96 BPM, G major)
   Synthesised with OfflineAudioContext. Runs in a browser: renderBGM() -> { sr, L, R } */
(function () {
  const LOOP = 15, BEAT = 60 / 96; // 0.625s, 6 bars of 4/4 = 15s
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // chord map (time, length, bass, pad voicing) — mirrors the picture
  const CHORDS = [
    [0, 2.5, 36, [52, 55, 59, 62]],      // Cmaj9   : question
    [2.5, 2.5, 45, [55, 59, 60, 64]],    // Am9     : options scatter
    [5.0, 1.25, 40, [55, 59, 62, 64]],   // Em7     : a line appears
    [6.25, 1.25, 42, [54, 57, 62, 64]],  // D/F#    : organising
    [7.5, 1.875, 47, [55, 59, 62, 69]],  // G/B     : できることから
    [9.375, 1.25, 40, [55, 59, 62, 66]], // Em9     : AIを使えば
    [10.625, .625, 38, [54, 57, 62, 66]],// D
    [11.25, 3.75, 43, [54, 59, 62, 69]], // Gmaj9   : HWAM / CTA
  ];

  function makeIR(ctx, secs, decay) {
    const len = Math.floor(ctx.sampleRate * secs), b = ctx.createBuffer(2, len, ctx.sampleRate);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = 0; i < len; i++) {
        const x = i / len, k = .08 + .6 * (1 - x); // darker as it decays
        lp += (rnd() - lp) * k;
        d[i] = lp * Math.pow(1 - x, decay) * (i < 400 ? i / 400 : 1);
      }
    }
    return b;
  }

  async function renderBGM(sr = 44100) {
    const TOTAL = LOOP * 2; // render two passes, keep the 2nd so reverb tails wrap around the loop
    const ctx = new OfflineAudioContext(2, sr * TOTAL, sr);
    const master = ctx.createGain(); master.gain.value = .9;
    const tone = ctx.createBiquadFilter(); tone.type = 'highshelf'; tone.frequency.value = 6000; tone.gain.value = -3;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 2.2; comp.attack.value = .03; comp.release.value = .3; comp.knee.value = 12;
    master.connect(tone); tone.connect(comp); comp.connect(ctx.destination);
    const rev = ctx.createConvolver(); rev.buffer = makeIR(ctx, 3.4, 2.4);
    const revOut = ctx.createGain(); revOut.gain.value = .8; rev.connect(revOut); revOut.connect(master);
    const bus = (dry, wet, pan = 0) => {
      const g = ctx.createGain(), p = ctx.createStereoPanner(); p.pan.value = pan;
      const d = ctx.createGain(), w = ctx.createGain(); d.gain.value = dry; w.gain.value = wet;
      g.connect(p); p.connect(d); p.connect(w); d.connect(master); w.connect(rev); return g;
    };
    let noiseBuf; {
      noiseBuf = ctx.createBuffer(1, sr * 2, sr); const d = noiseBuf.getChannelData(0); let s = 3;
      for (let i = 0; i < d.length; i++) d[i] = ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
    }

    // ---------- instruments ----------
    function piano(t, m, vel, dur = 2.5, pan = 0) {
      const f = mtof(m), out = bus(.75, .38, pan);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400 + vel * 2600; lp.Q.value = .4; lp.connect(out);
      const hi = Math.max(.35, 1 - (m - 60) / 48);
      [[1, 1, 2.6], [2, .42, 1.3], [3, .16, .8], [4, .07, .5], [5, .03, .35]].forEach(([k, a, dec]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f * k * (1 + k * k * .00035); o.detune.value = (k % 2 ? 1 : -1) * 1.5;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * vel * .16, t + .006);
        g.gain.setTargetAtTime(0, t + .006, dec * hi * .45);
        g.gain.setTargetAtTime(0, t + dur, .18);
        o.connect(g); g.connect(lp); o.start(t); o.stop(t + dur + 1.5);
      });
      // felt hammer
      const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
      n.buffer = noiseBuf; bp.type = 'bandpass'; bp.frequency.value = f * 3; bp.Q.value = 1.2;
      ng.gain.setValueAtTime(vel * .02, t); ng.gain.exponentialRampToValueAtTime(.0001, t + .05);
      n.connect(bp); bp.connect(ng); ng.connect(lp); n.start(t); n.stop(t + .08);
    }
    function pad(t, notes, dur, lvl = 1) {
      notes.forEach((m, i) => {
        const out = bus(.55, .55, (i / (notes.length - 1) - .5) * .6);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = .5;
        lp.frequency.setValueAtTime(520, t); lp.frequency.linearRampToValueAtTime(900, t + dur * .6);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.022 * lvl, t + .9);
        g.gain.setValueAtTime(.022 * lvl, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 1.6);
        lp.connect(g); g.connect(out);
        for (const dt of [-7, 6]) {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = dt;
          o.connect(lp); o.start(t); o.stop(t + dur + 1.8);
        }
        const s = ctx.createOscillator(); s.type = 'sine'; s.frequency.value = mtof(m - 12);
        const sg = ctx.createGain(); sg.gain.value = .5; s.connect(sg); sg.connect(lp); s.start(t); s.stop(t + dur + 1.8);
      });
    }
    function bass(t, m, dur, lvl = 1) {
      const out = bus(1, .08), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 280; lp.connect(out);
      const g = ctx.createGain(); g.connect(lp);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.2 * lvl, t + .08);
      g.gain.setTargetAtTime(.13 * lvl, t + .1, .6); g.gain.setTargetAtTime(0, t + dur, .12);
      for (const [type, a] of [['sine', 1], ['triangle', .25]]) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = mtof(m);
        const og = ctx.createGain(); og.gain.value = a; o.connect(og); og.connect(g); o.start(t); o.stop(t + dur + .8);
      }
    }
    function pluck(t, m, vel, pan) {
      const f = mtof(m), out = bus(.6, .5, pan);
      [[1, 1, .55], [3.01, .18, .12], [2, .12, .25]].forEach(([k, a, dec]) => {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f * k;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * vel * .09, t + .004);
        g.gain.setTargetAtTime(0, t + .004, dec * .5);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 2.5);
      });
    }
    function bell(t, m, vel) {
      const f = mtof(m), out = bus(.5, .7, .15);
      [[1, 1, 3.2], [2.76, .35, 1.6], [5.4, .14, .9], [8.93, .06, .5]].forEach(([k, a, dec]) => {
        const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f * k;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * vel * .05, t + .003);
        g.gain.setTargetAtTime(0, t + .003, dec * .4);
        o.connect(g); g.connect(out); o.start(t); o.stop(t + 5);
      });
    }
    function kick(t, vel) {
      const o = ctx.createOscillator(), g = ctx.createGain(), out = bus(1, .05);
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(46, t + .14);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.42 * vel, t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + .42);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + .5);
    }
    function shaker(t, vel, pan = .25) {
      const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain(), out = bus(.8, .25, pan);
      n.buffer = noiseBuf; n.playbackRate.value = 1 + (t * 7 % 1) * .1;
      hp.type = 'bandpass'; hp.frequency.value = 7200; hp.Q.value = .8;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05 * vel, t + .012); g.gain.exponentialRampToValueAtTime(.0001, t + .09);
      n.connect(hp); hp.connect(g); g.connect(out); n.start(t, (t * 13) % 1.5); n.stop(t + .12);
    }
    function riser(t0, t1) {
      const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), out = bus(.5, .6);
      n.buffer = noiseBuf; n.loop = true;
      bp.type = 'bandpass'; bp.Q.value = 1.6; bp.frequency.setValueAtTime(300, t0); bp.frequency.exponentialRampToValueAtTime(3200, t1);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.035, t1 - .05); g.gain.linearRampToValueAtTime(0, t1 + .02);
      n.connect(bp); bp.connect(g); g.connect(out); n.start(t0); n.stop(t1 + .1);
    }
    const strum = (t, notes, vel, gap = .014) => notes.forEach((m, i) => piano(t + i * gap, m, vel * (1 - i * .04), 2.2, (i / notes.length - .5) * .4));

    // ---------- arrangement ----------
    const WORD_X = [430, 1490, 300, 1560, 1010, 840], MINOR_X = [1270, 640, 1300, 190, 1730, 590];
    const panX = x => (x / 1920 * 2 - 1) * .7;
    for (let pass = 0; pass < 2; pass++) {
      const o = pass * LOOP;
      CHORDS.forEach(([t, d, b, notes], i) => {
        pad(o + t, notes, d, i === 0 ? .6 : 1);
        if (t >= 2.5 || pass > 0) bass(o + t, b, d, t < 5 ? .6 : 1);
      });
      // 01 question — sparse, open
      piano(o + .3125, 48, .22, 2.4); piano(o + .3125, 67, .3); piano(o + .3125, 76, .26);
      piano(o + .9375, 74, .24); piano(o + 1.5625, 71, .2); piano(o + 1.875, 74, .18, 1.2);
      // 02 options — each word gets its own pluck, panned to where it appears
      [76, 81, 79, 84, 74, 79].forEach((m, i) => pluck(o + 2.5 + i * .3125, m, .9, panX(WORD_X[i])));
      [88, 86, 91, 88, 84, 86].forEach((m, i) => pluck(o + 2.65625 + i * .3125, m, .45, panX(MINOR_X[i])));
      piano(o + 2.5, 57, .2, 2.4);
      piano(o + 4.375, 69, .14, .6); piano(o + 4.6875, 67, .12, .6);
      // 03 direction — the line: one rising note per station
      [64, 67, 71, 74, 78, 81, 83].forEach((m, i) => { piano(o + 5 + i * .3125, m, .24 + i * .025, .9); pluck(o + 5 + i * .3125, m + 12, .35, -.4 + i * .13); });
      riser(o + 6.25, o + 7.5);
      // 04 できることから
      strum(o + 7.5, [59, 62, 67, 71, 74], .42);
      piano(o + 8.4375, 71, .22); piano(o + 8.75, 74, .2, 1);
      // 05 AI — gentle growth
      strum(o + 9.375, [55, 59, 62, 66, 78], .36);
      [74, 76, 78, 79, 81, 83].forEach((m, i) => pluck(o + 9.6875 + i * .15625, m, .55, -.5 + i * .2));
      strum(o + 10.625, [57, 62, 66], .26);
      // 06 HWAM / CTA
      strum(o + 11.25, [55, 59, 62, 66, 69], .44, .02);
      bell(o + 12.1875, 91, .7);
      piano(o + 12.8125, 81, .18); piano(o + 13.4375, 78, .16); piano(o + 14.0625, 74, .14, 1.2);
      // groove from 04 to the end, breathing out before the loop
      [7.5, 8.75, 10, 11.25, 12.5, 13.75].forEach((t, i) => kick(o + t, i < 5 ? .55 : .35));
      for (let t = 7.5; t < 14.3; t += BEAT / 2) {
        const off = Math.round((t - 7.5) / (BEAT / 2)) % 2;
        shaker(o + t, (off ? .75 : .35) * (t > 13.2 ? .6 : 1), off ? .3 : -.2);
      }
    }
    const buf = await ctx.startRendering();
    const a = Math.floor(LOOP * sr), n = Math.floor(LOOP * sr);
    const L = buf.getChannelData(0).slice(a, a + n), R = buf.getChannelData(1).slice(a, a + n);
    let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    const g = .89 / peak; for (let i = 0; i < n; i++) { L[i] *= g; R[i] *= g; }
    return { sr, L, R };
  }
  window.renderBGM = renderBGM;
})();
