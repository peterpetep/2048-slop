// Every game in the arcade. A game is playable once src/games/<slug>/Game.svelte exists;
// until then the selector shows it as "Coming soon". Add new games to this list.
const components = import.meta.glob("./*/Game.svelte");

const LIST = [
  { slug: "eddy-merge", name: "Eddy Merge",
    rule: "Slide and merge matching Eddys until you reach Eddy Li (MIT)." },
  { slug: "tilt-jar", name: "Tilt Jar",
    rule: "Tiles are balls in a jar. Tilt it, and matching balls merge when they touch." },
  { slug: "snake", name: "Snake",
    rule: "Steer a snake made of tiles. Eat numbers to grow, and equal neighbours merge." },
  { slug: "spawn-master", name: "Spawn Master",
    rule: "A bot slides the tiles. You choose where each new tile lands." },
  { slug: "mirror-boards", name: "Mirror Boards",
    rule: "One swipe moves two boards, and the second one is flipped." },
  { slug: "hex-hive", name: "Hex Hive",
    rule: "A honeycomb grid with six directions to slide in." },
  { slug: "memory", name: "Memory",
    rule: "Tiles turn face down after a moment. Merge from memory." },
  { slug: "conveyor", name: "Conveyor",
    rule: "A new row pushes in from the bottom every few moves." },
  { slug: "paint-lab", name: "Paint Lab",
    rule: "Mix colors instead of numbers. Opposite colors cancel out." },
  { slug: "on-beat", name: "On Beat",
    rule: "Moves only count on the beat, and the tempo keeps climbing." },
  { slug: "sneeze", name: "Sneeze",
    rule: "Hold to build a sneeze, then let go to blast every tile across the board." },
  { slug: "whack-an-eddy", name: "Whack-an-Eddy",
    rule: "Eddys pop out of holes. Whack two matching ones within a second to merge them." },
  { slug: "magnet", name: "Magnet",
    rule: "No sliding. Eddys are magnets that pull each other together. Flip poles to steer." },
  { slug: "slingshot", name: "Slingshot",
    rule: "Pull back and fling Eddys at a pile. Matches merge where they land." },
  { slug: "typing", name: "Typing",
    rule: "Every Eddy wears a word. Type it to fire that Eddy at its match before the board fills." },
  { slug: "face-steer", name: "Face Steer",
    rule: "Your webcam watches your head. Tilt or nod to slide the tiles." },
];

export const GAMES = LIST.map(g => ({ ...g, load: components[`./${g.slug}/Game.svelte`] ?? null }));
