# System Attack Delay
scoreboard players add @a[scores={delayatk=1..}] delayatk 1
scoreboard players set @a[scores={delayatk=31..}] delayatk 0
scoreboard players set @a[scores={delayatk=30..}] solaris_verdant_atk 0 
scoreboard players set @a[scores={delayatk=30..}] supercharged_copper_axe_atk 0

# Weapons Skill
scoreboard players add @a sectick 1
scoreboard players set @a[scores={sectick=20..}] sectick 0
execute at @a[scores={sectick=19..}] run function weapons/weapons_skill 
scoreboard players remove @a[scores={sectick=19..,solaris_verdant_s1=1..}] solaris_verdant_s1 1
scoreboard players remove @a[scores={sectick=19..,solaris_verdant_s2=1..}] solaris_verdant_s2 1
scoreboard players remove @a[scores={sectick=19..,solaris_verdant_s3=1..}] solaris_verdant_s3 1
scoreboard players remove @a[scores={sectick=19..,supercharged_copper_axe_s1=1..}] supercharged_copper_axe_s1 1
scoreboard players remove @a[scores={supercharged_copper_axe_s2=6..}] supercharged_copper_axe_s2 1
scoreboard players remove @a[scores={supercharged_copper_axe_s3=16..}] supercharged_copper_axe_s3 1

# Passive : Charge Passive
scoreboard players add @a[hasitem={item=ph:charged_copper_axe,location=slot.weapon.mainhand}] charged_copper_axe 1
scoreboard players remove @a[scores={charged_copper_axe=101..}] charged_copper_axe 1
titleraw @a[hasitem={item=ph:charged_copper_axe,location=slot.weapon.mainhand}] actionbar {"rawtext":[{"text":"§eCharge : "},{"score":{"name":"*","objective":"charged_copper_axe"}}]}
