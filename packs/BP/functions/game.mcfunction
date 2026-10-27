# Entity Runtime
execute at @e[type=ph:prism_weaver_laser] run particle ph:prism_weaver_laser ~~~
execute at @e[type=ph:crimson_stray_projectile] run particle ph:crimson_stray_projectile ~~~
execute as @e[family=homing_slow] at @s run tp @s ^^^0.2 facing @p[r=64,c=1]
execute as @e[family=crystal,tag=!locked] at @s run tp @s ~~~ facing @e[c=1,r=16,type=!item,family=!inanimate,family=!crystal,family=!animirra]
execute as @e[family=copper_mechanical,tag=locked] at @s run tp @s ~~~ facing @e[name=LOCK_DIRECTION,type=armor_stand,c=1]
execute at @e[type=ph:spectric_laser] run particle ph:spectric_laser_small ^1^^
execute at @e[type=ph:spectric_laser] run particle ph:spectric_laser_small ^-1^^
execute at @e[type=ph:peacemaker_oath_projectile] run particle ph:peacemaker_oath_flash ~~~
execute at @e[type=ph:plasmoid_drone_projectile] run particle ph:plasmoid_drone_trail ~~~

# Batch Sound Cooldown
# Boss summons fire the same hit sound from many entities on one tick; the first one plays
# it and sets a 3 tick cooldown on its fake player (sfx_axe, sfx_sword, ...), the rest skip it.
execute if score sfx_axe sfx_cd matches 1.. run scoreboard players remove sfx_axe sfx_cd 1
execute if score sfx_sword sfx_cd matches 1.. run scoreboard players remove sfx_sword sfx_cd 1
execute if score sfx_laser sfx_cd matches 1.. run scoreboard players remove sfx_laser sfx_cd 1
execute if score sfx_flame_wall sfx_cd matches 1.. run scoreboard players remove sfx_flame_wall sfx_cd 1
execute if score sfx_meteor sfx_cd matches 1.. run scoreboard players remove sfx_meteor sfx_cd 1

# Boss Despawn Mechanic
# Checked once a second: a boss with no player inside its arena radius despawns.
execute if entity @a[scores={sectick=19..}] as @e[type=ph:soul_of_nature] at @s unless entity @a[r=64] run function boss_despawn/soul_of_nature
execute if entity @a[scores={sectick=19..}] as @e[type=ph:copper_mechanical_array] at @s unless entity @a[r=128] run function boss_despawn/copper_mechanical_array
execute if entity @a[scores={sectick=19..}] as @e[type=ph:punicea_crimson_eye] at @s unless entity @a[r=64] run function boss_despawn/punicea_crimson_eye

# Guidebook Runtime
tag @a[tag=!guidebook_phantasm_uc] remove guidebook_phantasm_uc
tag @a[tag=guidebook_phantasm_uc] remove guidebook_phantasm_ub