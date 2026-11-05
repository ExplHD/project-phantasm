// Contoh spawn aura slash dari script. Belum di-wire ke mana-mana, cuma contoh.
// Kalau mau dipakai beneran, taruh fungsinya di features/weapons/ dan panggil dari event di events/index.ts.
import { MolangVariableMap, type Player, type RGB } from "@minecraft/server";

export interface AuraSlashColors {
    core: RGB;  // warna tengah (blade), 0..1
    aura: RGB;  // warna aura + spark, 0..1
    spin?: number;  // derajat, muter crescent-nya
    size?: number;  // ukuran billboard dalam blok, default 1.5
}

export function spawnAuraSlash(player: Player, colors: AuraSlashColors): void {
    const head = player.getHeadLocation();
    const view = player.getViewDirection();
    const at = { x: head.x + view.x * 1.5, y: head.y - 0.2 + view.y * 1.5, z: head.z + view.z * 1.5 };

    const vars = new MolangVariableMap();
    vars.setFloat("variable.core_r", colors.core.red);
    vars.setFloat("variable.core_g", colors.core.green);
    vars.setFloat("variable.core_b", colors.core.blue);
    vars.setFloat("variable.aura_r", colors.aura.red);
    vars.setFloat("variable.aura_g", colors.aura.green);
    vars.setFloat("variable.aura_b", colors.aura.blue);
    vars.setFloat("variable.slash_spin", colors.spin ?? 0);
    vars.setFloat("variable.slash_size", colors.size ?? 1.5);

    // aura dulu, core di atasnya
    player.dimension.spawnParticle("ph:aura_slash_aura", at, vars);
    player.dimension.spawnParticle("ph:aura_slash_core", at, vars);
}

// contoh: tengah merah, aura crimson
// spawnAuraSlash(player, { core: { red: 1, green: 0.25, blue: 0.2 }, aura: { red: 1, green: 0.2, blue: 0.25 } });
