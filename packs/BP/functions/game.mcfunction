# Entity Runtime
execute at @e[type=ph:prism_weaver_laser] run particle ph:prism_weaver_laser ~~~
execute at @e[type=ph:crimson_stray_projectile] run particle ph:crimson_stray_projectile ~~~
execute as @e[family=homing_slow] at @s run tp @s ^^^0.2 facing @p[r=64,c=1]
execute as @e[family=crystal,tag=!locked] at @s run tp @s ~~~ facing @e[c=1,r=16,type=!item,family=!inanimate,family=!crystal,family=!animirra]
execute as @e[family=copper_mechanical,tag=locked] at @s run tp @s ~~~ facing @e[name=LOCK_DIRECTION,type=armor_stand,c=1]
execute at @e[type=ph:spectric_laser] run particle ph:spectric_laser_small ^1^^
execute at @e[type=ph:spectric_laser] run particle ph:spectric_laser_small ^-1^^
execute at @e[type=ph:peacemaker_oath_projectile] run particle ph:peacemaker_oath_flash ~~~

# Boss Despawn Mechanic
execute as @e[type=ph:soul_of_nature] at @s if entity @a[rm=64,r=80,scores={sectick=19..}] run function boss_despawn/soul_of_nature
execute as @e[type=ph:copper_mechanical_array] at @s if entity @a[rm=128,r=160,scores={sectick=19..}] run function boss_despawn/copper_mechanical_array
execute as @e[type=ph:punicea_crimson_eye] at @s if entity @a[rm=64,r=80,scores={sectick=19..}] run function boss_despawn/punicea_crimson_eye

# Guidebook Runtime
tag @a[tag=!guidebook_phantasm_uc] remove guidebook_phantasm_uc
tag @a[tag=guidebook_phantasm_uc] remove guidebook_phantasm_ub