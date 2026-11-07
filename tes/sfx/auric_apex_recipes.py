import os, sys
sys.path.insert(0, os.environ.get('SFX_SCRIPTS', os.path.expanduser('~/Projects/project-phantasm/.agents/skills/procedural-sfx/scripts')))
from sfxkit import *


def _fade(x, fin=.01, fout=.08):
    tt = t_(len(x) / SR)
    d = len(x) / SR
    return x * np.minimum(1, tt / fin) * np.minimum(1, np.maximum(0, d - tt) / fout)


def apex_charge(v=1.0, d=2.15):
    """Railgun charge-up: rising detuned whine with tremolo that speeds up, rising sizzle and sparse crackle."""
    tt = t_(d); p = tt / d
    f = 140 + 1250 * p ** 1.6
    ph = 2 * np.pi * np.cumsum(f) / SR
    whine = np.sin(ph) + .55 * np.sin(ph * 1.006 * 2) + .3 * np.sin(ph * 3.01) + .18 * np.sin(ph * 5.02)
    trem_rate = 7 + 45 * p ** 1.4
    trem = .65 + .35 * np.sin(2 * np.pi * np.cumsum(trem_rate) / SR)
    swell = np.minimum(1, tt / .12) * (.35 + .65 * p ** 1.2)
    sizzle = hp(noise(d), 2500) * (.05 + .3 * p ** 2)
    sizzle = bp(sizzle, 2500, 9000)
    sparks = hp(noise(d), 4000) * (rand(len(tt)) > (.9985 - .004 * p ** 2)) * 4
    sparks = lp(sparks, 9000)
    hum = np.sin(2 * np.pi * 55 * tt) * .35 * swell
    x = whine * trem * swell * .8 + sizzle * swell + sparks * .35 * swell + hum
    x = sat(x, 1.6)
    return norm(_fade(x, .02, .12)) * v


def apex_ready(v=1.0):
    """Full-charge ping: bright inharmonic metal partials with a quick upward chirp."""
    d = .7; tt = t_(d)
    chirp = sweep(1800, 3600, .06) * env_exp(.06, .03)
    chirp = np.pad(chirp, (0, n_(d) - len(chirp)))
    ring = sum(a * np.sin(2 * np.pi * fr * tt) * env_exp(d, tau) for fr, a, tau in [(2350, 1, .22), (3520, .6, .16), (5170, .35, .1), (1175, .4, .3)])
    x = chirp * .5 + ring * env_ad(d, .002, 1)
    return norm(_fade(x, .002, .1)) * v


def apex_fire(v=1.0):
    """Railgun discharge: hard crack, down-sweeping electric zap, sub thump, crackling electric tail and a metal ring."""
    d = 1.5; tt = t_(d)
    crack = hp(noise(d), 3000) * env_exp(d, .003)
    zap = (sweep(4200, 260, .35, .5) + sweep(4230, 270, .35, .5) * .8) * env_exp(.35, .07)
    zap = np.pad(zap, (0, n_(d) - len(zap)))
    sub = np.sin(2 * np.pi * np.cumsum(75 - 40 * np.minimum(1, tt / .4)) / SR) * env_ad(d, .003, .14)
    boom = lp(noise(d), 450) * env_exp(d, .07)
    am = .5 + .5 * np.sign(np.sin(2 * np.pi * 62 * tt))
    tail = bp(noise(d), 1800, 7000) * am * env_ad(d, .02, .3)
    sparks = lp(hp(noise(d), 4000) * (rand(len(tt)) > .997) * 4, 9000) * env_exp(d, .35)
    ring = sum(a * np.sin(2 * np.pi * fr * tt) for fr, a in [(1240, 1), (1870, .7), (2960, .45)]) * env_exp(d, .45)
    x = crack * 1.8 + sat(zap, 2.5) * .9 + sub * .75 + boom * 1.0 + tail * .35 + sparks * .3 + ring * .12
    x = sat(x, 1.8)
    x = echo(x, delay=.09, feedback=.2, taps=3, damp=2500)
    return norm(_fade(x, .001, .2)) * v
