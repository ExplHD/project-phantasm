## Entity Runtime
execute as @e[family=animated_tp] at @s run tp @s ^^^1 ~~ 
execute as @e[family=animated_tp2] at @s run tp @s ^^^0.2 ~~ 
execute as @e[family=crystal,tag=!locked] at @s run tp @s ~~~ facing @e[c=1,r=16,type=!item,family=!inanimate,family=!crystal,family=!animirra]
execute at @e[type=ph:spectric_laser] run particle ph:spectric_laser_big ^^^
execute at @e[type=ph:spectric_laser] run particle ph:spectric_laser_small ^1^^
execute at @e[type=ph:spectric_laser] run particle ph:spectric_laser_small ^-1^^