import os, sys
sys.path.insert(0, os.environ.get('SFX_SCRIPTS', os.path.expanduser('~/Projects/project-phantasm/.claude/skills/procedural-sfx/scripts')))
from sfxkit import *
from recipes import whoosh


def _fade(x, fin=.004, fout=.06):
    d = len(x) / SR
    tt = t_(d)
    return x * np.minimum(1, tt / fin) * np.minimum(1, np.maximum(0, d - tt) / fout)


def _fit(x, d):
    n = n_(d)
    return x[:n] if len(x) >= n else np.pad(x, (0, n - len(x)))


def interp_cast(v=1.0):
    """Short spell cast: rising glassy chirp, airy swell and a soft low pulse where the splash lands."""
    d = .5; tt = t_(d); k = uniform(.94, 1.06)
    chirp = (sweep(520 * k, 1480 * k, .16, .7) + .6 * sweep(527 * k, 1500 * k, .16, .7)) * env_ad(.16, .01, .09)
    chirp = _fit(chirp, d)
    glass = sum(a * np.sin(2 * np.pi * fr * k * tt) * env_exp(d, tau) for fr, a, tau in [(1480, 1, .12), (2230, .55, .08), (3710, .3, .05), (990, .4, .16)])
    glass = glass * np.minimum(1, np.maximum(0, tt - .1) / .03)
    air = _fit(whoosh(.28, 1, 900, 4200), d) * .5
    pulse = np.sin(2 * np.pi * np.cumsum(120 - 60 * np.minimum(1, tt / .3)) / SR) * env_ad(d, .004, .07)
    pulse = pulse * (tt > .12)
    x = chirp * .7 + glass * .55 + air + pulse * .6
    return norm(_fade(x, .004, .1)) * v


def interp_sword(v=1.0):
    """Spell blade slamming down: falling whistle, hard crack, low boom and a crystal ring with a short echo."""
    d = 1.1; tt = t_(d); k = uniform(.95, 1.05)
    fall = _fit(sweep(2600 * k, 500 * k, .2, 1.6) * np.linspace(0, 1, n_(.2)) ** 2, d) * .45
    hit = np.maximum(0, tt - .2)
    on = tt >= .2
    crack = hp(noise(d), 3200) * np.exp(-hit / .004) * on
    boom = np.sin(2 * np.pi * np.cumsum(88 - 50 * np.minimum(1, hit / .35)) / SR) * np.exp(-hit / .16) * on
    rumble = lp(noise(d), 420) * np.exp(-hit / .09) * on
    ring = sum(a * np.sin(2 * np.pi * fr * k * tt) * np.exp(-hit / tau) for fr, a, tau in [(1320, 1, .32), (1985, .7, .24), (3140, .45, .15), (4660, .25, .09)]) * on
    x = fall + crack * 1.3 + sat(boom + rumble * .8, 2.2) * 1.0 + ring * .28
    x = echo(x, delay=.07, feedback=.25, taps=3, damp=2600)
    return norm(_fade(x, .01, .2)) * v


def interp_laser(v=1.0):
    """Fast energy bolt: detuned down-sweep with a 70 Hz buzz, a tiny crack up front and a thin hiss tail."""
    d = .38; tt = t_(d); k = uniform(.92, 1.08)
    zap = (sweep(3400 * k, 420 * k, .22, .55) + .8 * sweep(3440 * k, 430 * k, .22, .55)) * env_exp(.22, .06)
    zap = _fit(zap, d) * (.7 + .3 * np.sign(np.sin(2 * np.pi * 70 * tt)))
    crack = hp(noise(d), 4000) * env_exp(d, .002)
    hiss = bp(noise(d), 2500, 8000) * env_ad(d, .01, .08) * .25
    low = np.sin(2 * np.pi * np.cumsum(150 - 70 * np.minimum(1, tt / .2)) / SR) * env_ad(d, .003, .05)
    x = sat(zap, 2.2) * .9 + crack * .8 + hiss + low * .5
    return norm(_fade(x, .001, .08)) * v


def interp_noise(v=1.0):
    """Signal interference: stuttering static bursts, a detuned low drone and glitchy falling blips."""
    d = .95; tt = t_(d)
    step = n_(.022)
    gate = np.repeat(rand(len(tt) // step + 1) > .42, step)[:len(tt)].astype(float)
    static = bp(noise(d), 1200, 6500) * gate
    hold = np.repeat(uniform(-1, 1, len(tt) // 40 + 1), 40)[:len(tt)]
    crush = bp(hold, 900, 5000) * (1 - gate) * .6
    drone = (np.sin(2 * np.pi * 92 * tt) + np.sin(2 * np.pi * 97.5 * tt)) * .5
    blips = np.zeros(len(tt))
    for start in (.08, .31, .52, .7):
        b = sweep(uniform(1800, 2600), uniform(500, 900), .07, .6) * env_exp(.07, .03)
        i = n_(start); blips[i:i + len(b)] += b[:len(blips) - i]
    shape = np.minimum(1, tt / .03) * (1 - .55 * tt / d)
    x = (static * .9 + crush + drone * .55 + blips * .5) * shape
    x = sat(x, 1.8)
    return norm(_fade(x, .005, .18)) * v


def interp_shroud(v=1.0):
    """Blink teleport: air sucked inward, then a pitch-dropping pop and a short shimmer."""
    d = .55; tt = t_(d); k = uniform(.95, 1.05)
    suck = bp(noise(.2), 500, 5000) * np.linspace(0, 1, n_(.2)) ** 2.5
    suck = _fit(suck, d) * .6
    pop_at = np.maximum(0, tt - .2); on = tt >= .2
    pop = np.sin(2 * np.pi * np.cumsum(900 * k * np.exp(-pop_at / .05) + 110) / SR) * np.exp(-pop_at / .07) * on
    shimmer = sum(a * np.sin(2 * np.pi * fr * k * tt) * np.exp(-pop_at / tau) for fr, a, tau in [(2480, 1, .1), (3720, .6, .07), (5210, .3, .05)]) * on
    x = suck + pop * .9 + shimmer * .22
    return norm(_fade(x, .01, .1)) * v
