// data/scripts/main.ts
import { system, world } from "@minecraft/server";
system.run(() => {
  world.sendMessage("Hello, world!");
});
