// The glint and spark recipe is adapted from Sprite Fusion's open-source slash
// (https://www.spritefusion.com/pixel-art-vfx/slash), MIT License, Copyright (c) 2026 Hugo Duprez.
//
// A 64 x 64 crescent moon slash for a Minecraft Bedrock billboard particle. The shape is a true crescent: a
// circle with an offset circle cut out of it, thick in the middle and pointed at both tips. It renders in two
// greyscale layers so the game can tint each one: "core" is the blade (cutout, tinted by the particle), "aura"
// is the stepped halo, the light, the tip glint, sparks and wisps (additive). "all" draws both for previews.
import { Particles, P, Rng, fit, sparkle, clamp, smooth, ease } from "../../core/index.js";

export const meta = {
  name: "Aura slash",
  desc: "A crescent moon blade sweeps tip to tip in two frames inside a stepped halo of light, glints at the far tip and throws sparks, then thins and peels away as wisps.",
  tags: ["melee", "slash", "sword", "crescent", "aura", "light", "minecraft", "one-shot"],
  size: [64, 64],
  origin: [32, 32],
  duration: 0.4,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    layer: "all",
    palette: ["#3a3a3a", "#5c5c5c", "#828282", "#a8a8a8", "#cdcdcd", "#ececec", "#ffffff"],
    aura: ["#2a2a2a", "#555555", "#8a8a8a", "#c4c4c4", "#ffffff"],
    sparks: ["#ffffff", "#e6e6e6", "#a8a8a8", "#6a6a6a"],
    radius: 25,
    thickness: 10,
    tilt: -0.75,
    // radians the whole moon turns over its life, the way it travels round the swing
    travel: 1.1,
    seed: 3,
  },
};

const SWEEP = 0.05, HOLD = 0.06, TRAIL = 0.18, LIFE = SWEEP + HOLD + TRAIL;

// The crescent at one moment: outer circle radius R at the origin of its own frame, inner circle radius Ri
// shifted back by off along -x, so it bulges towards +x. Tips sit at +-th around the outer circle.
function moon(R, thick, cx, cy, rot) {
  const Ri = R * 0.96, off = thick - (R - Ri);
  const x = (Ri * Ri - R * R - off * off) / (2 * off), th = Math.acos(clamp(x / R, -1, 1));
  return { R, Ri, off, th, cx, cy, c: Math.cos(rot), s: Math.sin(rot) };
}

// screen point at outer-circle radius r and crescent angle a
function at(m, r, a) {
  const lx = Math.cos(a) * r, ly = Math.sin(a) * r;
  return [m.cx + lx * m.c - ly * m.s, m.cy + lx * m.s + ly * m.c];
}

// walk every pixel near the crescent: fn(v 0 top tip..1 bottom tip, dOut px inside the outer rim (negative
// outside), dIn px outside the inner circle (negative inside it), out)
function walk(p, m, pad, fn) {
  const B = m.R + pad + 1;
  p.shade(m.cx - B, m.cy - B, m.cx + B, m.cy + B, (x, y, out) => {
    const dx = x - m.cx, dy = y - m.cy, lx = dx * m.c + dy * m.s, ly = -dx * m.s + dy * m.c;
    const ro = Math.hypot(lx, ly), dOut = m.R - ro, dIn = Math.hypot(lx + m.off, ly) - m.Ri;
    if (dOut < -pad || dIn < -pad) return;
    const v = (Math.atan2(ly, lx) + m.th) / (2 * m.th);
    if (v < -0.08 || v > 1.08) return;
    return fn(v, dOut, dIn, out);
  });
}

export function create(o) {
  const C = fit(o.palette, 7), Au = fit(o.aura, 5), Rg = new Rng(o.seed);
  const ps = new Particles({ rng: Rg, ground: () => 99, sparks: o.sparks });
  const showCore = o.layer !== "aura", showAura = o.layer !== "core";
  const CX = 0, CY = 0;
  const turn = (u) => o.tilt + o.travel * ease.outCubic(clamp(u / LIFE));
  let full = moon(o.radius, o.thickness, CX, CY, turn(0));
  let t = 0, landed = false;

  // how much of the crescent shows: head runs tip to tip fast, tail chases it after the hold
  const reveal = (u) => [smooth(SWEEP + HOLD, LIFE, u), ease.outExpo(clamp(u / SWEEP))];

  function blade(p, m, tail, head, age) {
    const n = C.length;
    walk(p, m, 0.5, (v, dOut, dIn, out) => {
      if (dOut < 0 || dIn < 0 || v < tail || v > head) return;
      const q = dOut / Math.max(0.5, dOut + dIn); // 0 outer rim .. 1 inner edge
      const fromHead = (head - v) / Math.max(0.05, head - tail);
      const ci = q < 0.3 && age < 0.5 ? 0 : Math.round(q * (n - 1) * 0.65 + age * 2.4 + fromHead * 0.9);
      out.c = C[n - 1 - clamp(ci, 0, n - 1)];
      // the chasing end dissolves through the dither instead of cutting off
      out.a = Math.min(1, (v - tail) / 0.12 + (tail <= 0 ? 1 : 0)) * (1 - smooth(0.7, 1, age));
    });
  }

  function halo(p, m, tail, head, age) {
    const n = Au.length, k = 1 - age, reach = 6, fade = 1 - smooth(0.4, 0.95, age);
    walk(p, m, reach, (v, dOut, dIn, out) => {
      if (v < tail - 0.04 || v > head + 0.04) return;
      if (dOut >= 0 && dIn >= 0) return; // the blade itself
      const taper = Math.sin(Math.PI * clamp(v)); // halo thins to nothing at both tips, like the blade
      const outside = dOut < 0, d = outside ? -dOut : -dIn;
      if (outside && taper > 0.12) {
        const step = d < 1 ? 0 : d < 2.6 ? 1 : d < 4 && taper > 0.55 ? 2 : -1;
        if (step >= 0) {
          out.c = Au[n - 1 - clamp(step + Math.round(age * 2.2), 0, n - 2)];
          out.a = fade;
        }
      } else if (!outside && d < 1 && taper > 0.35) {
        // a solid dark step on the inner edge, so the hollow of the moon has a clean line too
        out.c = Au[n - 4];
        out.a = fade;
      }
      const fall = 1 - d / (outside ? reach : reach * 0.6);
      if (fall <= 0) return;
      out.l = Au[n - 2];
      out.k = (outside ? 1.1 : 0.5) * k * taper * fall;
    });
  }

  return {
    update(dt) {
      t += dt;
      if (!landed && t >= SWEEP && showAura) {
        landed = true;
        full = moon(o.radius, o.thickness, CX, CY, turn(t));
        // sparks fly off the bottom tip along the swing, slow and short so they stay in the frame
        const [bx, by] = at(full, full.R - 1, full.th), [px, py] = at(full, full.R - 1, full.th - 0.15);
        const dir = Math.atan2(by - py, bx - px);
        for (let i = 0; i < 7; i++) {
          const a = dir + Rg.range(-0.6, 0.6), sp = Rg.range(60, 120);
          ps.spawn(P.SPARK, bx, by, Math.cos(a) * sp, Math.sin(a) * sp, Rg.range(0.06, 0.12));
        }
        // wisps peel off the outer rim, mostly from the thick middle
        for (let i = 0; i < 12; i++) {
          const a = -full.th + 2 * full.th * Rg.range(0.2, 0.8), [x, y] = at(full, full.R + 1, a);
          const ox = x - full.cx, oy = y - full.cy, l = Math.hypot(ox, oy) || 1, sp = Rg.range(12, 28);
          ps.spawn(P.MOTE, x, y, (ox / l) * sp, (oy / l) * sp - 5, Rg.range(0.14, 0.26), Au[3 + Rg.int(0, 1)], 0.5, Rg.range(0, 0.06));
        }
      }
      ps.update(dt);
    },
    draw(p) {
      const age = clamp(t / LIFE);
      if (age < 1) {
        // the blade thins as it fades, so it slims down to a sliver instead of just vanishing
        const m = moon(o.radius, o.thickness * (1 - 0.5 * smooth(0.25, 1, age)), CX, CY, turn(t));
        full = moon(o.radius, o.thickness, CX, CY, turn(t));
        const [tail, head] = reveal(t);
        if (head > tail + 0.01) {
          if (showAura) halo(p, m, tail, head, age);
          if (showCore) blade(p, m, tail, head, age);
        }
      }
      if (!showAura) return;
      // light rides the head as it sweeps, then the far tip glints
      if (t > 0.012 && t < 0.2) {
        const a = -full.th + 2 * full.th * ease.outExpo(clamp(t / SWEEP));
        const [x, y] = at(full, full.R - o.thickness * 0.4, a);
        p.glow(x, y, 13, Au[3], 0.4 * (1 - t / 0.2));
      }
      const g = t - SWEEP * 0.6;
      if (g > 0 && g < 0.16) {
        const [x, y] = at(full, full.R - 1, full.th - 0.05);
        sparkle(p, x, y, 6 * ease.outBack(Math.min(1, g / 0.04)) * (1 - g / 0.16), Au[4], Au[3], 0.55);
      }
      ps.draw(p);
    },
  };
}
