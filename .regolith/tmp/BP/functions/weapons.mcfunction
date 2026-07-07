# Base Objective Runner
scoreboard players add @a[scores={delayatk=1..}] delayatk 1
scoreboard players set @a[scores={delayatk=31..}] delayatk 0
scoreboard players set @a[scores={delayatk=30..}] solaris_verdant_atk 0
scoreboard players set @a[scores={delayatk=30..}] supercharged_copper_axe_atk 0
scoreboard players set @a[scores={delayatk=30..}] prism_weaver_atk 0
scoreboard players set @a[scores={delayatk=30..}] auric_photonizer_atk 0
scoreboard players set @a[scores={delayatk=30..}] the_bleeding_spire_atk 0
scoreboard players set @a[scores={delayatk=30..}] seiketsu_atk 0
scoreboard players add @a sectick 1
scoreboard players set @a[scores={sectick=20..}] sectick 0
execute at @a[scores={sectick=19..}] run function weapons/weapons_skill
scoreboard players remove @a[scores={sectick=19..,solaris_verdant_s1=1..}] solaris_verdant_s1 1
scoreboard players remove @a[scores={sectick=19..,solaris_verdant_s2=1..}] solaris_verdant_s2 1
scoreboard players remove @a[scores={sectick=19..,solaris_verdant_s3=1..}] solaris_verdant_s3 1
scoreboard players remove @a[scores={sectick=19..,supercharged_copper_axe_s1=1..}] supercharged_copper_axe_s1 1
scoreboard players remove @a[scores={sectick=19..,supercharged_copper_axe_s2=1..}] supercharged_copper_axe_s2 1
scoreboard players remove @a[scores={supercharged_copper_axe_s3=6..}] supercharged_copper_axe_s3 1
scoreboard players remove @a[scores={supercharged_copper_axe_s4=16..}] supercharged_copper_axe_s4 1
scoreboard players remove @a[scores={sectick=19..,prism_weaver_s1=1..}] prism_weaver_s1 1
scoreboard players remove @a[scores={sectick=19..,prism_weaver_s2=1..}] prism_weaver_s2 1
scoreboard players remove @a[scores={sectick=19..,prism_weaver_s3=1..}] prism_weaver_s3 1
scoreboard players remove @a[scores={sectick=19..,auric_photonizer_s1=1..}] auric_photonizer_s1 1
scoreboard players remove @a[scores={sectick=19..,auric_photonizer_s2=1..}] auric_photonizer_s2 1
scoreboard players remove @a[scores={sectick=19..,auric_photonizer_s3=1..}] auric_photonizer_s3 1
scoreboard players remove @a[scores={sectick=19..,auric_photonizer_s4=1..}] auric_photonizer_s4 1
scoreboard players remove @a[scores={sectick=19..,the_bleeding_spire_s1=1..}] the_bleeding_spire_s1 1
scoreboard players remove @a[scores={sectick=19..,the_bleeding_spire_s2=1..}] the_bleeding_spire_s2 1
scoreboard players remove @a[scores={sectick=19..,the_bleeding_spire_s3=1..}] the_bleeding_spire_s3 1

# Charged Copper Axe Runtime
scoreboard players add @a[hasitem={item=ph:charged_copper_axe,location=slot.weapon.mainhand}] charged_copper_axe 1
scoreboard players remove @a[scores={charged_copper_axe=101..}] charged_copper_axe 1
scoreboard players remove @a[scores={auric_charge=701..}] auric_charge 1
titleraw @a[hasitem={item=ph:charged_copper_axe,location=slot.weapon.mainhand}] actionbar {"rawtext":[{"text":"§eCharge : "},{"score":{"name":"*","objective":"charged_copper_axe"}},{"text":", §gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}

# Auric Communicator Runtime
scoreboard players set @a[scores={auric_communicator_mode=2..}] auric_communicator_mode 0
titleraw @a[hasitem={item=ph:auric_communicator,location=slot.weapon.mainhand},scores={auric_communicator_mode=0}] actionbar {"rawtext":[{"text":"§eStab Shot"},{"text":", §gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}
titleraw @a[hasitem={item=ph:auric_communicator,location=slot.weapon.mainhand},scores={auric_communicator_mode=1}] actionbar {"rawtext":[{"text":"§cNuke Shot"},{"text":", §gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}

# Peacemaker Oath Runtime
titleraw @a[hasitem={item=ph:peacemaker_oath,location=slot.weapon.mainhand}] actionbar {"rawtext":[{"text":"§gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}

# Auric Charges General Items
titleraw @a[hasitem={item=ph:auric_stock_battery,location=slot.weapon.mainhand}] actionbar {"rawtext":[{"text":"§gAuric Charge : "},{"score":{"name":"*","objective":"auric_charge"}},{"text":"/700"}]}
# Thunder Gale Runtime
effect @a[hasitem={item=ph:thunder_gale,location=slot.weapon.mainhand}] speed 1 2 true

# Dash Passive
scoreboard objectives add dash_cd dummy
scoreboard players add @a dash_cd 0
scoreboard players remove @a[scores={dash_cd=1..}] dash_cd 1