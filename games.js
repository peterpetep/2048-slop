// The game list for the selector. Each game lives in games/<slug>/index.html.
// Set `ready: true` once a game's folder is in place.
window.GAMES = [
  { slug: "eddy-merge",     name: "Eddy Merge",     ready: true,
    rule: "Slide and merge matching Eddys until you reach Eddy Li (MIT)." },
  { slug: "tilt-jar",       name: "Tilt Jar",       ready: false,
    rule: "Tiles are balls in a jar. Tilt it, and matching balls merge when they touch." },
  { slug: "snake",          name: "Snake",          ready: false,
    rule: "Steer a snake made of tiles. Eat numbers to grow, and equal neighbours merge." },
  { slug: "spawn-master",   name: "Spawn Master",   ready: false,
    rule: "A bot slides the tiles. You choose where each new tile lands." },
  { slug: "mirror-boards",  name: "Mirror Boards",  ready: false,
    rule: "One swipe moves two boards, and the second one is flipped." },
  { slug: "hex-hive",       name: "Hex Hive",       ready: false,
    rule: "A honeycomb grid with six directions to slide in." },
  { slug: "memory",         name: "Memory",         ready: false,
    rule: "Tiles turn face down after a moment. Merge from memory." },
  { slug: "conveyor",       name: "Conveyor",       ready: false,
    rule: "A new row pushes in from the bottom every few moves." },
  { slug: "paint-lab",      name: "Paint Lab",      ready: false,
    rule: "Mix colors instead of numbers. Opposite colors cancel out." },
  { slug: "on-beat",        name: "On Beat",        ready: false,
    rule: "Moves only count on the beat, and the tempo keeps climbing." },
];
