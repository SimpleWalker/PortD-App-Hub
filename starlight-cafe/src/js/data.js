// Starlight Café – game data: characters, rarities, banner rates, milestones.
// Edit this file to add characters or rebalance the game.
window.SC = window.SC || {};

SC.RARITY = {
  R:   { stars: 3, label: 'R',   color: '#8ec5ff', base: 1,  levelCost: 15,  weight: 80 },
  SR:  { stars: 4, label: 'SR',  color: '#c79bff', base: 6,  levelCost: 80,  weight: 17 },
  SSR: { stars: 5, label: 'SSR', color: '#ffc94d', base: 35, levelCost: 400, weight: 3 }
};

// art: path inside the program folder (resolved through PortD.assets at runtime)
SC.CHARACTERS = [
  { id: 'mochi',   name: 'Mochi',   rarity: 'R',   title: 'Bunny Barista',      quote: 'One strawberry latte, extra fluffy!' },
  { id: 'pip',     name: 'Pip',     rarity: 'R',   title: 'Sprout Gardener',    quote: 'The herbs grow better when you sing to them.' },
  { id: 'tofu',    name: 'Tofu',    rarity: 'R',   title: 'Sleepy Kitten',      quote: 'Nya… five more minutes…' },
  { id: 'biscuit', name: 'Biscuit', rarity: 'R',   title: 'Pastry Chef',        quote: 'Fresh from the oven, mind the sparkles.' },
  { id: 'nori',    name: 'Nori',    rarity: 'R',   title: 'Quiet Bookkeeper',   quote: '…the numbers add up. Probably.' },
  { id: 'peach',   name: 'Peach',   rarity: 'R',   title: 'Flower Waitress',    quote: 'A daisy with every order!' },
  { id: 'luna',    name: 'Luna',    rarity: 'SR',  title: 'Moonlight Witch',    quote: 'A pinch of moondust makes everything sweeter.' },
  { id: 'kiko',    name: 'Kiko',    rarity: 'SR',  title: 'Trickster Fox',      quote: 'Did your cake just vanish? Hehe, no idea~' },
  { id: 'sora',    name: 'Sora',    rarity: 'SR',  title: 'Cloud Courier',      quote: 'Deliveries by wing, always on time!' },
  { id: 'rin',     name: 'Rin',     rarity: 'SR',  title: 'Star Idol',          quote: 'This next song is for the café!' },
  { id: 'aurora',  name: 'Aurora',  rarity: 'SSR', title: 'Princess of Stars',  quote: 'The whole sky is on the menu tonight.' },
  { id: 'celeste', name: 'Celeste', rarity: 'SSR', title: 'Gentle Dragon',      quote: 'I guard this café… and its cookies.' },
  { id: 'yume',    name: 'Yume',    rarity: 'SSR', title: 'Dream Shepherd',     quote: 'Count with me… one sheep, two sheep…' }
].map(c => ({ ...c, art: 'assets/chars/' + c.id + '.svg' }));

SC.BANNER = {
  name: 'Twinkle Tea Party',
  singleCost: 100,      // gems
  tenCost: 1000,        // gems, guarantees at least one SR or better
  pity: 60,             // SSR guaranteed on this pull if none before
  rateUp: 'aurora',     // half of SSR pulls are the featured character
  featuredShare: 0.5
};

SC.BALANCE = {
  startGems: 300,
  levelGrowth: 1.15,        // star cost multiplier per level
  bondBonus: 0.25,          // +25% production per duplicate (bond level)
  maxBond: 10,              // duplicates beyond this become gems
  overflowGems: 25,
  tapBase: 1,
  tapShareOfIncome: 0.1,    // a tap gives 10% of a second's income on top
  offlineCapHours: 8,
  offlineRate: 0.5,
  shopGems: 25,             // gems per purchase in the shop
  shopBasePrice: 200,       // stars
  shopGrowth: 1.08,
  dailyGems: 150
};

SC.MILESTONES = [
  { id: 'stars1k',   text: 'Earn 1,000 stars',          test: s => s.lifetime >= 1e3,  gems: 100 },
  { id: 'stars10k',  text: 'Earn 10,000 stars',         test: s => s.lifetime >= 1e4,  gems: 150 },
  { id: 'stars100k', text: 'Earn 100,000 stars',        test: s => s.lifetime >= 1e5,  gems: 200 },
  { id: 'stars1m',   text: 'Earn 1 million stars',      test: s => s.lifetime >= 1e6,  gems: 300 },
  { id: 'stars10m',  text: 'Earn 10 million stars',     test: s => s.lifetime >= 1e7,  gems: 500 },
  { id: 'pulls10',   text: 'Make 10 wishes',            test: s => s.pulls >= 10,      gems: 100 },
  { id: 'pulls50',   text: 'Make 50 wishes',            test: s => s.pulls >= 50,      gems: 250 },
  { id: 'own5',      text: 'Befriend 5 characters',     test: s => SC.ownedCount(s) >= 5,  gems: 150 },
  { id: 'own10',     text: 'Befriend 10 characters',    test: s => SC.ownedCount(s) >= 10, gems: 300 },
  { id: 'ownAll',    text: 'Befriend everyone',         test: s => SC.ownedCount(s) >= SC.CHARACTERS.length, gems: 1000 },
  { id: 'firstSSR',  text: 'Meet an SSR friend',        test: s => SC.CHARACTERS.some(c => c.rarity === 'SSR' && s.owned[c.id]), gems: 100 },
  { id: 'taps500',   text: 'Tap the moon 500 times',    test: s => s.taps >= 500,      gems: 100 },
  { id: 'level25',   text: 'Raise anyone to level 25',  test: s => Object.values(s.owned).some(o => o.level >= 25), gems: 200 }
];
