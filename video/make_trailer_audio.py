"""おはよう予告編のサウンドをゼロから合成する（BGM・効果音すべて自作、素材ライセンス不要）。

使い方: python3 make_trailer_audio.py out.wav
タイミングは ohayou_trailer.html のタイムラインに合わせてある。
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve
from scipy.io import wavfile

SR = 48000
END = 26.5
N = int(SR * END)
rng = np.random.default_rng(7)

dry = np.zeros((N, 2))
send = np.zeros((N, 2))   # リバーブへ送る分


def tt(dur):
    return np.arange(int(SR * dur)) / SR


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def saw(f, t, phase=0.0):
    ph = np.cumsum(np.broadcast_to(f, t.shape)) / SR + phase
    return 2 * (ph % 1) - 1


def sine(f, t):
    return np.sin(2 * np.pi * np.cumsum(np.broadcast_to(f, t.shape)) / SR)


def put(sig, at, gain=1.0, pan=0.0, rev=0.3):
    """モノ/ステレオ信号を at 秒の位置に置く。pan は -1..1 か、配列で時間変化。"""
    i = int(at * SR)
    if i >= N:
        return
    sig = np.asarray(sig)[: N - i]
    if sig.ndim == 1:
        pan = np.broadcast_to(pan, sig.shape)[: len(sig)]
        a = (pan + 1) * np.pi / 4
        sig = np.stack([sig * np.cos(a), sig * np.sin(a)], axis=1)
    dry[i : i + len(sig)] += sig * gain
    send[i : i + len(sig)] += sig * gain * rev


def env_adsr(n, a, r, total):
    t = np.arange(n) / SR
    e = np.minimum(t / max(a, 1e-4), 1.0)
    e *= np.clip((total - t) / max(r, 1e-4), 0, 1)
    return e


def pad(freqs, dur, cutoff, attack, release, detune=0.08, voices=6):
    """デチューンしたノコギリ波を重ねたストリングス風パッド（ステレオ）。"""
    t = tt(dur)
    L = np.zeros_like(t)
    R = np.zeros_like(t)
    for f in freqs:
        for v in range(voices):
            cents = (v - (voices - 1) / 2) * detune * 100 / voices * 2
            ff = f * 2 ** (cents / 1200)
            s = saw(ff, t, rng.random())
            w = v / (voices - 1)
            L += s * (1 - w)
            R += s * w
    L, R = lp(L, cutoff, 4), lp(R, cutoff, 4)
    e = env_adsr(len(t), attack, release, dur)
    out = np.stack([L * e, R * e], axis=1)
    return out / (len(freqs) * voices) * 3


def sub_drop(f0, f1, dur, tau):
    t = tt(dur)
    f = f1 + (f0 - f1) * np.exp(-t / (dur / 4))
    return sine(f, t) * np.exp(-t / tau)


def noise_hit(dur, tau, lo=None, hi=None):
    t = tt(dur)
    n = rng.standard_normal(len(t))
    if lo and hi:
        n = bp(n, lo, hi)
    elif hi:
        n = lp(n, hi)
    elif lo:
        n = hp(n, lo)
    return n * np.exp(-t / tau)


def taiko(size=1.0):
    t = tt(1.6)
    f = 48 + 60 * np.exp(-t / 0.05)
    body = sine(f, t) * np.exp(-t / (0.35 * size))
    skin = sine(170 * np.ones_like(t), t) * np.exp(-t / 0.09) * 0.4
    click = noise_hit(1.6, 0.012, 900, 5000) * 0.6
    return np.tanh((body + skin + click) * 1.8)


def braaam(freqs, dur, bright=3200, dark=380):
    """トレーラーの「ブォーン」。明るい成分が速く、暗い成分がゆっくり減衰する。"""
    t = tt(dur)
    s = sum(saw(f * (1 + 0.003 * k), t, rng.random()) for k, f in enumerate(freqs)) / len(freqs)
    s2 = sum(saw(f * (1 - 0.004 * k), t, rng.random()) for k, f in enumerate(freqs)) / len(freqs)
    att = np.minimum(t / 0.035, 1)
    b = lp(s, bright, 4) * np.exp(-t / 0.35)
    d = lp(s2, dark, 4) * np.exp(-t / 1.4)
    L = np.tanh((b + d * 1.4) * att * 2.2)
    R = np.tanh((lp(s2, bright, 4) * np.exp(-t / 0.35) + lp(s, dark, 4) * np.exp(-t / 1.4) * 1.4) * att * 2.2)
    fade = np.clip((dur - t) / 0.4, 0, 1)
    return np.stack([L * fade, R * fade], axis=1)


def bell(f, dur=2.5):
    t = tt(dur)
    idx = 2.2 * np.exp(-t / 0.4)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * idx
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t / 0.9) * np.minimum(t / 0.002, 1)


def sweep_noise(dur, f0, f1, q=0.25):
    """中心周波数が動くバンドパスノイズ（状態変数フィルタを1サンプルずつ）。"""
    n = len(tt(dur))
    x = rng.standard_normal(n)
    fc = f0 * (f1 / f0) ** (np.arange(n) / n)
    g = 2 * np.sin(np.pi * np.minimum(fc, SR / 6) / SR)
    low = band = 0.0
    y = np.empty(n)
    for i in range(n):
        high = x[i] - low - q * band
        band += g[i] * high
        low += g[i] * band
        y[i] = band
    return y


D1, D2, A2, D3, Fs3, A3, D4, Fs4, A4 = 36.71, 73.42, 110.0, 146.83, 185.0, 220.0, 293.66, 369.99, 440.0
D5, E5, Fs5, A5, D6, E6, Fs6 = 587.33, 659.25, 739.99, 880.0, 1174.66, 1318.5, 1479.98

# ── 0–2.7 審査カード：フィルムのプチプチ音 ──────────────────
for _ in range(40):
    at = rng.uniform(0.05, 2.6)
    put(noise_hit(0.02, 0.002, 1500, 8000), at, 0.08 * rng.random(), rng.uniform(-.5, .5), rev=0.05)
put(lp(rng.standard_normal(int(SR * 2.7)), 400) * env_adsr(int(SR * 2.7), .3, .4, 2.7), 0, 0.02, rev=0)

# ── 3.0 Hwam PRESENTS ─────────────────────────────────────
put(sub_drop(62, 32, 3.0, 0.9), 3.0, 0.55, rev=0.4)
put(noise_hit(3.0, 0.5, 60, 900), 3.0, 0.12, rev=0.6)
put(pad([D5, A5, E6, Fs6], 3.4, 5000, 1.0, 1.0, detune=0.05, voices=4), 3.0, 0.14, rev=0.8)
sw = sweep_noise(1.8, 600, 9000, q=0.4)
sw *= np.sin(np.pi * np.linspace(0, 1, len(sw))) ** 2
put(sw, 3.5, 0.16, pan=np.linspace(-0.9, 0.9, len(sw)), rev=0.5)

# ── 6.2–17.4 夜：低いドローン ─────────────────────────────
drone = pad([D1, D2, A2], 11.2, 260, 2.0, 0.2, detune=0.12)
# 不穏な高音（かすかなビブラート）
t = tt(11.2)
eerie = sine(E5 * (1 + 0.004 * np.sin(2 * np.pi * 5 * t)), t) * env_adsr(len(t), 3, .2, 11.2) * 0.12
drone[:, 0] += eerie * 0.5
drone[:, 1] += eerie
# アラームのところで一度しぼむ（ダッキング）
duck = np.ones(len(t))
ti = t + 6.2
duck *= 1 - 0.7 * np.exp(-np.clip(ti - 11.8, 0, None) / 1.2) * (ti >= 11.8)
put(drone * duck[:, None], 6.2, 0.30, rev=0.35)

# 時計の秒針（布団と戦っていた）
for k, at in enumerate(np.arange(9.4, 11.3, 0.5)):
    put(noise_hit(0.05, 0.004, 2500 if k % 2 else 3400, 7000), at, 0.25, pan=-0.3 if k % 2 else 0.3, rev=0.3)

# ── 11.0–11.7 アラーム → 11.8 ブォーン ─────────────────────
def beep(dur=0.07):
    t = tt(dur)
    s = np.sign(np.sin(2 * np.pi * 2750 * t)) * env_adsr(len(t), .003, .005, dur)
    return bp(s, 900, 5000)

for g0 in (11.0, 11.36):
    for j in range(4):
        put(beep(), g0 + j * 0.075, 0.13, pan=0.15, rev=0.2)
put(braaam([D1, D2, A2, D3], 2.2), 11.8, 0.55, rev=0.45)
put(sub_drop(70, 30, 1.8, 0.6), 11.8, 0.7, rev=0.2)
put(noise_hit(1.5, 0.25, None, 2500), 11.8, 0.35, rev=0.6)

# ── 13.6–15.55 それでも── ライザー ＋ 心音 ────────────────────
rd = 1.95
t = tt(rd)
cres = (t / rd) ** 2.2
rs = sweep_noise(rd, 250, 7000, q=0.3) * cres
put(rs, 13.6, 0.28, pan=0, rev=0.3)
gl = D3 * (4 ** (t / rd) ** 1.3)
trem = 0.6 + 0.4 * np.sin(2 * np.pi * np.cumsum(4 + 14 * t / rd) / SR)
tone = lp(saw(gl, t) + saw(gl * 1.005, t) + saw(gl * 1.5, t) * .5, 3000, 2) * cres * trem
put(tone, 13.6, 0.13, rev=0.3)
beat_t = 13.6
iv = 0.78
while beat_t < 15.4:
    for off, g in ((0, 1.0), (0.14, 0.6)):
        tb = tt(0.3)
        put(sine(52 + 20 * np.exp(-tb / .03), tb) * np.exp(-tb / .09), beat_t + off, 0.5 * g, rev=0.1)
    beat_t += iv
    iv = max(0.36, iv * 0.8)

# ── 15.6 / 16.2 / 16.8 たたみかけるヒット ───────────────────
for at, size, g in ((15.6, 1.0, 0.75), (16.2, 1.15, 0.85), (16.8, 1.4, 1.0)):
    put(taiko(size), at, g, rev=0.5)
    put(noise_hit(0.8, 0.12, None, 4000), at, 0.25 * g, rev=0.6)
put(braaam([D1, D2, A2, D3, A3], 1.2, bright=4200), 16.8, 0.5, rev=0.4)
put(sub_drop(80, 32, 1.2, 0.5), 16.8, 0.6, rev=0.2)

# ── 18.2–20.2 夜明け：あたたかいパッドと逆再生シンバル ─────────────
put(pad([D3, A3, D4, Fs4, A4], 8.4, 1500, 1.8, 2.0, detune=0.10), 18.2, 0.34, rev=0.6)
rc = noise_hit(1.7, 0.6, 3500, 16000)[::-1]
put(np.stack([rc, noise_hit(1.7, 0.6, 3500, 16000)[::-1]], axis=1), 20.2 - 1.7, 0.5, rev=0.3)
# 低い唸りが立ち上がる
t = tt(2.0)
put(lp(saw(D2, t) + saw(D2 * 1.004, t), 200) * (t / 2.0) ** 2, 18.2, 0.35, rev=0.2)

# ── 20.2 おはよう。：本命のヒット ─────────────────────────
put(taiko(1.7), 20.2, 1.0, rev=0.55)
put(sub_drop(85, 28, 3.0, 1.1), 20.2, 0.85, rev=0.2)
put(braaam([D1, D2, A2, D3, Fs3, A3, D4], 4.5, bright=5200, dark=600), 20.2, 0.55, rev=0.6)
crash = np.stack([noise_hit(3.0, 0.9, 3000, 16000), noise_hit(3.0, 0.95, 3000, 16000)], axis=1)
put(crash, 20.2, 0.22, rev=0.5)
# その後の明るいストリングス
put(pad([D2, D3, A3, D4, Fs4, A4, D5], 6.3, 3200, 0.6, 2.2, detune=0.09), 20.2, 0.40, rev=0.7)

# 光のスイープに合わせたキラキラ（左→右）
for k, (at, f) in enumerate(zip((21.25, 21.5, 21.75, 22.0, 22.3), (D5, Fs5, A5, D6, Fs6))):
    put(bell(f), at, 0.13, pan=-0.8 + 0.4 * k, rev=0.7)

# クレジット：低い鐘
put(bell(D4, 3.5) + bell(A4, 3.5) * 0.6, 22.8, 0.16, rev=0.8)

# ── ミックス ─────────────────────────────────────────────
ir_len = int(SR * 2.8)
ti = np.arange(ir_len) / SR
ir = np.stack([lp(rng.standard_normal(ir_len), 6000) * np.exp(-6.9 * ti / 2.6) for _ in range(2)], axis=1)
ir[: int(SR * 0.02)] = 0
ir /= np.sqrt((ir ** 2).sum(axis=0))
wet = np.stack([fftconvolve(send[:, c], ir[:, c])[:N] for c in range(2)], axis=1)
mix = dry + wet * 0.9

# 17.4–18.2 は完全な無音（予告編の「間」）
g = np.ones(N)
a, b = int(17.40 * SR), int(18.2 * SR)
g[a : a + int(0.03 * SR)] = np.linspace(1, 0, int(0.03 * SR))
g[a + int(0.03 * SR) : b] = 0
mix *= g[:, None]

# ラストのフェードアウト（映像の黒フェードに合わせる）
fo = np.clip((END - np.arange(N) / SR) / 1.6, 0, 1)
mix *= fo[:, None]

mix = hp(mix.T, 25).T
mix /= np.abs(mix).max()
mix = np.tanh(mix * 1.6) / np.tanh(1.6) * 0.93
wavfile.write(sys.argv[1] if len(sys.argv) > 1 else "trailer_audio.wav", SR, (mix * 32767).astype(np.int16))
print("ok", mix.shape, float(np.abs(mix).max()))
