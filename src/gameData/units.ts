import { UnitDefinition } from './types';

// Placeholder images are simple slug paths for now. Replace with real assets later.
export const units: UnitDefinition[] = [
  { id: 'luffy', name: 'Monkey D. Luffy', faction: 'straw_hat', role: 'attacker', tier: 3, power: 58, health: 620, abilityType: 'cast', abilityValue: 90, abilityDescription: 'Gum-Gum Gatling deals bonus damage', image: 'img/luffy.png' },
  { id: 'zoro', name: 'Roronoa Zoro', faction: 'straw_hat', role: 'attacker', tier: 3, power: 62, health: 600, abilityType: 'cast', abilityValue: 85, abilityDescription: 'Three-Sword Slash hits closest enemies', image: 'img/zoro.png' },
  { id: 'nami', name: 'Nami', faction: 'straw_hat', role: 'control', tier: 2, power: 32, health: 420, abilityType: 'cast', abilityValue: 60, abilityDescription: 'Thundercloud slows and shocks', image: 'img/nami.png' },
  { id: 'usopp', name: 'Usopp', faction: 'straw_hat', role: 'attacker', tier: 2, power: 40, health: 430, abilityType: 'on_hit', abilityValue: 35, abilityDescription: 'Sniper shots have bonus crit', image: 'img/usopp.png' },
  { id: 'sanji', name: 'Vinsmoke Sanji', faction: 'straw_hat', role: 'attacker', tier: 3, power: 55, health: 560, abilityType: 'on_hit', abilityValue: 45, abilityDescription: 'Black Leg kicks ignite briefly', image: 'img/sanji.png' },
  { id: 'chopper', name: 'Tony Tony Chopper', faction: 'straw_hat', role: 'support', tier: 2, power: 28, health: 520, abilityType: 'cast', abilityValue: 55, abilityDescription: 'Transforms to heal allies', image: 'img/chopper.png' },
  { id: 'robin', name: 'Nico Robin', faction: 'straw_hat', role: 'control', tier: 3, power: 36, health: 510, abilityType: 'cast', abilityValue: 70, abilityDescription: 'Clutch immobilizes targets', image: 'img/robin.png' },
  { id: 'franky', name: 'Franky', faction: 'straw_hat', role: 'tank', tier: 3, power: 48, health: 700, abilityType: 'passive', abilityValue: 40, abilityDescription: 'Iron body reduces damage', image: 'img/franky.png' },
  { id: 'brook', name: 'Brook', faction: 'straw_hat', role: 'support', tier: 2, power: 34, health: 470, abilityType: 'on_death', abilityValue: 60, abilityDescription: 'Soul music speeds allies', image: 'img/brook.png' },
  { id: 'jinbe', name: 'Jinbe', faction: 'straw_hat', role: 'tank', tier: 4, power: 52, health: 820, abilityType: 'cast', abilityValue: 75, abilityDescription: 'Fishman Karate shields allies', image: 'img/jinbe.png' },

  { id: 'smoker', name: 'Smoker', faction: 'navy', role: 'control', tier: 3, power: 50, health: 640, abilityType: 'cast', abilityValue: 80, abilityDescription: 'Smoke binds frontline enemies', image: 'img/smoker.png' },
  { id: 'tashigi', name: 'Tashigi', faction: 'navy', role: 'attacker', tier: 2, power: 42, health: 480, abilityType: 'on_hit', abilityValue: 30, abilityDescription: 'Swift strikes reduce armor', image: 'img/tashigi.png' },
  { id: 'kizaru', name: 'Borsalino', faction: 'navy', role: 'attacker', tier: 4, power: 70, health: 700, abilityType: 'cast', abilityValue: 95, abilityDescription: 'Light beams pierce backline', image: 'img/kizaru.png' },
  { id: 'akainu', name: 'Sakazuki', faction: 'navy', role: 'attacker', tier: 5, power: 78, health: 820, abilityType: 'cast', abilityValue: 120, abilityDescription: 'Magma fist melts defenses', image: 'img/akainu.png' },
  { id: 'aokiji', name: 'Kuzan', faction: 'navy', role: 'control', tier: 4, power: 60, health: 760, abilityType: 'cast', abilityValue: 100, abilityDescription: 'Ice age freezes an area', image: 'img/aokiji.png' },
  { id: 'garp', name: 'Monkey D. Garp', faction: 'navy', role: 'tank', tier: 4, power: 66, health: 880, abilityType: 'passive', abilityValue: 50, abilityDescription: 'Iron fist shields allies', image: 'img/garp.png' },
  { id: 'coby', name: 'Coby', faction: 'navy', role: 'support', tier: 1, power: 26, health: 420, abilityType: 'cast', abilityValue: 45, abilityDescription: 'Inspires allies with courage', image: 'img/coby.png' },

  { id: 'kaido', name: 'Kaido', faction: 'beast_pirates', role: 'tank', tier: 5, power: 85, health: 1100, abilityType: 'cast', abilityValue: 140, abilityDescription: 'Dragon form breathes fire', image: 'img/kaido.png' },
  { id: 'king', name: 'King', faction: 'beast_pirates', role: 'tank', tier: 4, power: 62, health: 900, abilityType: 'passive', abilityValue: 60, abilityDescription: 'Lunarian flames reduce damage', image: 'img/king.png' },
  { id: 'queen', name: 'Queen', faction: 'beast_pirates', role: 'support', tier: 4, power: 58, health: 880, abilityType: 'cast', abilityValue: 85, abilityDescription: 'Plague devices weaken foes', image: 'img/queen.png' },
  { id: 'jack', name: 'Jack', faction: 'beast_pirates', role: 'tank', tier: 3, power: 54, health: 820, abilityType: 'on_hit', abilityValue: 45, abilityDescription: 'Mammoth charges knock back', image: 'img/jack.png' },
  { id: 'ulti', name: 'Ulti', faction: 'beast_pirates', role: 'control', tier: 2, power: 46, health: 620, abilityType: 'cast', abilityValue: 65, abilityDescription: 'Headbutt stuns one target', image: 'img/ulti.png' },
  { id: 'page_one', name: 'Page One', faction: 'beast_pirates', role: 'attacker', tier: 2, power: 44, health: 600, abilityType: 'on_hit', abilityValue: 38, abilityDescription: 'Dino claws rend armor', image: 'img/page_one.png' },

  { id: 'mihawk', name: 'Dracule Mihawk', faction: 'warlords', role: 'attacker', tier: 5, power: 90, health: 780, abilityType: 'cast', abilityValue: 130, abilityDescription: 'Black blade cleaves a line', image: 'img/mihawk.png' },
  { id: 'crocodile', name: 'Crocodile', faction: 'warlords', role: 'control', tier: 4, power: 55, health: 750, abilityType: 'cast', abilityValue: 90, abilityDescription: 'Sandstorm drains and slows', image: 'img/crocodile.png' },
  { id: 'kuma', name: 'Bartholomew Kuma', faction: 'warlords', role: 'tank', tier: 4, power: 60, health: 920, abilityType: 'cast', abilityValue: 95, abilityDescription: 'Paw repel shields allies', image: 'img/kuma.png' },
  { id: 'doflamingo', name: 'Donquixote Doflamingo', faction: 'warlords', role: 'control', tier: 4, power: 62, health: 760, abilityType: 'cast', abilityValue: 100, abilityDescription: 'Strings bind multiple foes', image: 'img/doflamingo.png' },
  { id: 'boa', name: 'Boa Hancock', faction: 'warlords', role: 'control', tier: 3, power: 50, health: 640, abilityType: 'cast', abilityValue: 80, abilityDescription: 'Love beam petrifies briefly', image: 'img/boa.png' },
  { id: 'moria', name: 'Gecko Moria', faction: 'warlords', role: 'support', tier: 3, power: 42, health: 720, abilityType: 'on_death', abilityValue: 70, abilityDescription: 'Shadows empower allies', image: 'img/moria.png' },

  { id: 'dragon', name: 'Monkey D. Dragon', faction: 'revolutionary', role: 'support', tier: 5, power: 68, health: 880, abilityType: 'cast', abilityValue: 110, abilityDescription: 'Storm grants shields teamwide', image: 'img/dragon.png' },
  { id: 'sabo', name: 'Sabo', faction: 'revolutionary', role: 'attacker', tier: 4, power: 66, health: 720, abilityType: 'cast', abilityValue: 95, abilityDescription: 'Flame fist burns through lines', image: 'img/sabo.png' },
  { id: 'ivankov', name: 'Emporio Ivankov', faction: 'revolutionary', role: 'support', tier: 3, power: 38, health: 670, abilityType: 'cast', abilityValue: 75, abilityDescription: 'Hormone boost heals allies', image: 'img/ivankov.png' },
  { id: 'koala', name: 'Koala', faction: 'revolutionary', role: 'control', tier: 2, power: 34, health: 520, abilityType: 'on_hit', abilityValue: 30, abilityDescription: 'Fishman karate trips targets', image: 'img/koala.png' },

  { id: 'law', name: 'Trafalgar Law', faction: 'supernova', role: 'control', tier: 4, power: 60, health: 700, abilityType: 'cast', abilityValue: 100, abilityDescription: 'Room swaps and cuts foes', image: 'img/law.png' },
  { id: 'kid', name: 'Eustass Kid', faction: 'supernova', role: 'attacker', tier: 4, power: 64, health: 760, abilityType: 'cast', abilityValue: 95, abilityDescription: 'Magnet slam pulls enemies', image: 'img/kid.png' },
  { id: 'killer', name: 'Killer', faction: 'supernova', role: 'attacker', tier: 3, power: 56, health: 640, abilityType: 'on_hit', abilityValue: 48, abilityDescription: 'Buzz-saw attacks bleed', image: 'img/killer.png' },
  { id: 'bonney', name: 'Jewelry Bonney', faction: 'supernova', role: 'support', tier: 2, power: 30, health: 520, abilityType: 'cast', abilityValue: 55, abilityDescription: 'Appetite buff heals allies', image: 'img/bonney.png' },
  { id: 'drake', name: 'X-Drake', faction: 'supernova', role: 'tank', tier: 3, power: 52, health: 760, abilityType: 'on_hit', abilityValue: 44, abilityDescription: 'Dino form grants damage resist', image: 'img/drake.png' },
  { id: 'hawkins', name: 'Basil Hawkins', faction: 'supernova', role: 'control', tier: 3, power: 46, health: 640, abilityType: 'on_death', abilityValue: 65, abilityDescription: 'Straw voodoo redirects damage', image: 'img/hawkins.png' },

  { id: 'lucci', name: 'Rob Lucci', faction: 'cp9', role: 'attacker', tier: 4, power: 62, health: 700, abilityType: 'on_hit', abilityValue: 55, abilityDescription: 'Rokushiki strikes shred armor', image: 'img/lucci.png' },
  { id: 'kaku', name: 'Kaku', faction: 'cp9', role: 'attacker', tier: 3, power: 50, health: 620, abilityType: 'cast', abilityValue: 70, abilityDescription: 'Giraffe spin cleaves foes', image: 'img/kaku.png' },
  { id: 'jabra', name: 'Jabra', faction: 'cp9', role: 'attacker', tier: 2, power: 42, health: 580, abilityType: 'on_hit', abilityValue: 36, abilityDescription: 'Wolf claws stack bleed', image: 'img/jabra.png' },
  { id: 'kalifa', name: 'Kalifa', faction: 'cp9', role: 'control', tier: 2, power: 34, health: 520, abilityType: 'cast', abilityValue: 60, abilityDescription: 'Soap bubbles silence briefly', image: 'img/kalifa.png' },
  { id: 'blueno', name: 'Blueno', faction: 'cp9', role: 'tank', tier: 2, power: 38, health: 640, abilityType: 'passive', abilityValue: 35, abilityDescription: 'Door-door evasion shield', image: 'img/blueno.png' },

  { id: 'whitebeard', name: 'Edward Newgate', faction: 'whitebeard', role: 'tank', tier: 5, power: 92, health: 1150, abilityType: 'cast', abilityValue: 150, abilityDescription: 'Quake punch shatters terrain', image: 'img/whitebeard.png' },
  { id: 'marco', name: 'Marco', faction: 'whitebeard', role: 'support', tier: 4, power: 54, health: 820, abilityType: 'on_death', abilityValue: 90, abilityDescription: 'Phoenix flames revive briefly', image: 'img/marco.png' },
  { id: 'jozu', name: 'Jozu', faction: 'whitebeard', role: 'tank', tier: 4, power: 60, health: 980, abilityType: 'passive', abilityValue: 55, abilityDescription: 'Diamond body reduces damage', image: 'img/jozu.png' },
  { id: 'vista', name: 'Vista', faction: 'whitebeard', role: 'attacker', tier: 3, power: 58, health: 740, abilityType: 'on_hit', abilityValue: 46, abilityDescription: 'Flower blade parries and strikes', image: 'img/vista.png' },
  { id: 'ace', name: 'Portgas D. Ace', faction: 'whitebeard', role: 'attacker', tier: 4, power: 68, health: 760, abilityType: 'cast', abilityValue: 105, abilityDescription: 'Flame commandment blasts area', image: 'img/ace.png' },
];
