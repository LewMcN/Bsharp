/* Lick / song-idea / content generators for the Ideas and Create tabs.
   Pure logic — no React. Scale data is passed in from App.jsx. */

const STD = [64, 59, 55, 50, 45, 40]; // string 0 (high E) → 5 (low E)
const pc = (m) => ((m % 12) + 12) % 12;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ------------------------------ licks ------------------------------ */

// Rhythms are lists of durations in eighth-note units (bar = 8).
const RHYTHMS = {
  bluesy:  [[1,1,2,1,1,2,3,1,4], [2,1,1,2,2,1,1,2,4], [1,1,1,1,2,2,2,2,4]],
  melodic: [[2,2,1,1,2,2,2,4], [1,1,2,1,1,2,4,4], [2,1,1,4,2,1,1,4]],
  fast:    [[0.5,0.5,0.5,0.5,1,0.5,0.5,0.5,0.5,1,2], [1,0.5,0.5,1,0.5,0.5,1,0.5,0.5,2.5]],
};
const LICK_BPM = { bluesy: 92, melodic: 100, fast: 116 };

// Generate a lick: a walk through scale notes in a lead-register position,
// mostly stepwise, ending on a chord tone. Returns events with tab positions.
export function generateLick(rootPc, scaleIv, style) {
  // position window anchored to the E-shape around the root
  const r = pc(rootPc - 4);
  const start = Math.max(2, (r === 0 ? 12 : r) - 1);
  const winEnd = start + 5;

  // playable scale cells on the top four strings
  const cells = [];
  for (let s = 0; s <= 3; s++) {
    for (let f = start; f <= winEnd; f++) {
      const midi = STD[s] + f;
      const semi = pc(midi - rootPc);
      if (scaleIv.includes(semi)) cells.push({ s, f, semi, midi });
    }
  }
  cells.sort((a, b) => a.midi - b.midi);
  if (cells.length < 5) return null;

  const strong = [0, 7, scaleIv.includes(4) ? 4 : 3].filter((x) => scaleIv.includes(x) || x === 0);
  const rhythm = pick(RHYTHMS[style]);
  const n = rhythm.length;

  // start on a strong tone near the middle of the register
  const mid = Math.floor(cells.length / 2);
  let idx = cells.findIndex((c, i) => i >= mid - 3 && strong.includes(c.semi));
  if (idx < 0) idx = mid;

  const events = [];
  let prevIdx = -99;
  for (let k = 0; k < n; k++) {
    const last = k === n - 1;
    if (last) {
      // resolve: nearest strong tone, favouring downward
      let best = idx, bestD = 99;
      cells.forEach((c, i) => {
        if (!strong.includes(c.semi)) return;
        const d = Math.abs(i - idx) + (i > idx ? 0.5 : 0);
        if (d < bestD) { bestD = d; best = i; }
      });
      idx = best;
    } else if (k > 0) {
      const roll = Math.random();
      let step;
      if (roll < 0.62) step = Math.random() < 0.55 ? -1 : 1;      // stepwise, slight downward pull
      else if (roll < 0.85) step = Math.random() < 0.5 ? -2 : 2;  // small leap
      else step = Math.random() < 0.5 ? -3 : 3;                    // rare bigger leap
      if (idx === prevIdx) step = step || 1;                       // never sit still twice
      idx = Math.max(0, Math.min(cells.length - 1, idx + step));
    }
    prevIdx = idx;
    events.push({ ...cells[idx], dur: rhythm[k], tech: "" });
  }

  // techniques from motion between events
  for (let k = 1; k < events.length; k++) {
    const a = events[k - 1], b = events[k];
    if (a.s === b.s) {
      const d = b.f - a.f;
      if (d === 1 || d === 2) b.tech = "h";
      else if (d === -1 || d === -2) b.tech = "p";
      else if (Math.abs(d) >= 3) b.tech = "/";
    }
  }
  const lastEv = events[events.length - 1];
  lastEv.tech = "~";
  if (style === "bluesy") {
    // one bend on a b3 or b7 mid-phrase, if present
    const cand = events.slice(1, -1).find((e) => e.semi === 3 || e.semi === 10);
    if (cand) cand.tech = "b";
  }

  return { events, window: [start, winEnd], bpm: LICK_BPM[style], style };
}

// Layout: x column per event (proportional to time), bar lines every 8 eighths.
export function layoutLick(events, unit = 34, padL = 30) {
  let cum = 0;
  const cols = events.map((ev) => {
    const x = padL + cum * unit;
    cum += ev.dur;
    return { x, ev };
  });
  const bars = [];
  for (let b = 8; b < cum; b += 8) bars.push(padL + b * unit);
  return { cols, bars, totalW: padL + cum * unit + 26, totalBeats: cum };
}

// Render the lick to a 1080×1080 canvas for Instagram, returns a Promise<Blob>.
export function lickToPNG({ events }, title, subtitle) {
  const c = document.createElement("canvas");
  c.width = 1080; c.height = 1080;
  const g = c.getContext("2d");

  const grad = g.createLinearGradient(0, 0, 1080, 1080);
  grad.addColorStop(0, "#0d0d14"); grad.addColorStop(1, "#08080b");
  g.fillStyle = grad; g.fillRect(0, 0, 1080, 1080);

  // brand chip
  const bg = g.createLinearGradient(60, 60, 130, 130);
  bg.addColorStop(0, "#22e3d8"); bg.addColorStop(1, "#7c6cff");
  g.fillStyle = bg;
  g.beginPath(); g.roundRect(60, 60, 74, 74, 18); g.fill();
  g.fillStyle = "#08080b"; g.font = "900 40px system-ui";
  g.textAlign = "center"; g.fillText("B♯", 97, 112);

  g.textAlign = "left";
  g.fillStyle = "#ffffff"; g.font = "800 52px system-ui";
  g.fillText(title, 160, 105);
  g.fillStyle = "#8a8a96"; g.font = "500 30px monospace";
  g.fillText(subtitle, 160, 145);

  // tab: 6 string lines, events spread across the width
  const { cols, bars, totalW } = layoutLick(events, 34, 0);
  const scale = Math.min(1.6, 920 / totalW);
  const x0 = 80, y0 = 420, rowH = 46;
  g.strokeStyle = "rgba(210,210,225,0.35)"; g.lineWidth = 2;
  for (let s = 0; s < 6; s++) {
    g.beginPath(); g.moveTo(x0 - 20, y0 + s * rowH); g.lineTo(1000, y0 + s * rowH); g.stroke();
  }
  g.font = "500 26px monospace"; g.fillStyle = "#6a6a78";
  ["e", "B", "G", "D", "A", "E"].forEach((nm, s) => g.fillText(nm, x0 - 58, y0 + s * rowH + 9));
  bars.forEach((bx) => {
    g.strokeStyle = "rgba(210,210,225,0.2)";
    g.beginPath(); g.moveTo(x0 + bx * scale, y0 - 20); g.lineTo(x0 + bx * scale, y0 + 5 * rowH + 20); g.stroke();
  });
  cols.forEach(({ x, ev }) => {
    const cx = x0 + x * scale, cy = y0 + ev.s * rowH;
    const label = String(ev.f) + (ev.tech || "");
    g.font = "700 34px monospace";
    const w = g.measureText(label).width;
    g.fillStyle = "#08080b"; g.fillRect(cx - w / 2 - 6, cy - 20, w + 12, 40);
    g.fillStyle = "#ffffff"; g.textAlign = "center";
    g.fillText(String(ev.f), cx - (ev.tech ? 8 : 0), cy + 12);
    if (ev.tech) { g.fillStyle = "#22e3d8"; g.font = "700 26px monospace"; g.fillText(ev.tech, cx + w / 2 - 8, cy + 10); }
    g.textAlign = "left";
  });

  g.fillStyle = "#5d5d6a"; g.font = "500 28px monospace";
  g.fillText("h hammer · p pull · / slide · b bend · ~ vibrato", 80, 760);
  g.fillStyle = "#8a8a96"; g.font = "600 30px system-ui";
  g.fillText("made with B Sharp — fretboard intelligence", 80, 990);

  return new Promise((resolve) => c.toBlob(resolve, "image/png"));
}

/* --------------------------- song ideas --------------------------- */

const MOODS = ["late-night", "driving", "swampy", "sunny", "moody", "triumphant", "dusty desert", "smoky bar", "road-trip", "rainy Sunday"];
const TECHNIQUES = ["double stops", "open-string drones", "slides only — no bends", "space: rest on beat 1", "call and response", "one string only", "octaves", "chord stabs between phrases", "repeated bends", "staccato picking"];
const SEEDS = ["a riff that repeats but changes its last note each time", "a melody that starts on the b7", "a bassline-first idea", "a two-note hook", "a question phrase and its answer", "a slow build that doubles speed", "a hook built on the 9", "a groove that leaves beat 4 empty"];

export function generateSongIdea(progKeys, grooveKeys) {
  return {
    keyPc: Math.floor(Math.random() * 12),
    prog: pick(progKeys),
    groove: pick(grooveKeys),
    bpm: 66 + Math.floor(Math.random() * 15) * 6,
    mood: pick(MOODS),
    technique: pick(TECHNIQUES),
    seed: pick(SEEDS),
  };
}

/* ------------------------- content creation ------------------------- */

export const REEL_FORMATS = [
  {
    name: "Lick breakdown",
    hook: (k, s) => `Steal this ${k} ${s} lick 🎸`,
    shots: [
      "0-3s: play the lick full speed, straight in — no intro talk",
      "3-10s: half speed with the tab on screen (use the PNG export)",
      "10-20s: 3 slow loops, camera on the fretting hand",
      "20-25s: full speed again + one-line tip spoken to camera",
    ],
    cta: "Comment “TAB” and I'll send you the diagram.",
  },
  {
    name: "3 ways over 1 chord",
    hook: (k) => `3 ways to solo over a ${k}7 chord — beginner to spicy`,
    shots: [
      "0-3s: “Three ways to play over this chord” + strum the chord",
      "3-10s: way 1 — pentatonic (label: BEGINNER)",
      "10-18s: way 2 — add the blue note (label: BLUESY)",
      "18-28s: way 3 — target the 3rd & 7th (label: PRO)",
    ],
    cta: "Save this for your next jam. Which one sounds best? 👇",
  },
  {
    name: "Myth bust",
    hook: () => "Stop learning scales wrong — nobody solos by running boxes",
    shots: [
      "0-3s: play a scale robotically up and down (the “wrong” way)",
      "3-8s: “This is what scales are actually for” to camera",
      "8-20s: same notes as a phrase — bends, space, repetition",
      "20-28s: side-by-side replay of both",
    ],
    cta: "Follow for one usable idea per day — not exercises.",
  },
  {
    name: "Before / after",
    hook: () => "One tip that instantly makes your blues solos sound pro",
    shots: [
      "0-4s: “before” — busy solo with no space",
      "4-8s: the tip in one sentence (e.g. “land on the 3rd when the chord changes”)",
      "8-20s: “after” — same backing, phrasing with the tip applied",
      "20-25s: freeze frame + text recap of the tip",
    ],
    cta: "Try it over a backing track today — tag me in your attempt.",
  },
  {
    name: "Play-along challenge",
    hook: (k) => `Can you jam this 12-bar in ${k}? Play along 👇`,
    shots: [
      "0-3s: “Jam challenge — name the key, 12-bar, join in”",
      "3-25s: loop the progression on screen with chord names as they change",
      "25-30s: your best 2-bar lick as the outro",
    ],
    cta: "Duet/Remix this and show me your take.",
  },
];

const HASHTAG_POOL = [
  "#guitar", "#guitarist", "#guitarlesson", "#learnguitar", "#guitarlick",
  "#bluesguitar", "#guitarsolo", "#fretboard", "#guitarteacher", "#guitarpractice",
  "#riff", "#pentatonic", "#guitartabs", "#guitarplayer", "#electricguitar",
  "#musictheory", "#jamtrack", "#12barblues", "#guitartok", "#shredding",
];

export function generateReelIdea(keyName, scaleName, progName) {
  const fmt = pick(REEL_FORMATS);
  const tags = [...HASHTAG_POOL].sort(() => Math.random() - 0.5).slice(0, 12).join(" ");
  const caption =
    `${fmt.hook(keyName, scaleName, progName)}\n\n` +
    `Key: ${keyName} · Scale: ${scaleName} · works over: ${progName}\n` +
    `${fmt.cta}\n\n${tags}`;
  return { format: fmt, caption, tags };
}

/* --------------------------- songsterr search --------------------------- */

export async function searchSongsterr(query) {
  const res = await fetch(
    `https://www.songsterr.com/a/ra/songs.json?pattern=${encodeURIComponent(query)}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error("bad status " + res.status);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).slice(0, 12).map((x) => ({
    id: x.id,
    title: x.title,
    artist: x.artist?.name || "",
    url: `https://www.songsterr.com/a/wsa/song?id=${x.id}`,
  }));
}
