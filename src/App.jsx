import React, { useState, useRef, useEffect, useCallback } from "react";
import * as Tone from "tone";
import {
  Music, Zap, Target, Play, Square, Volume2, Award, Flame, RotateCcw,
  Check, X, Activity, Sparkles, Brain, Guitar, Ear, ChevronRight,
  Radio, Crosshair, Layers, User, LogOut, BookOpen, LayoutGrid,
  Lightbulb, Clapperboard, Download, Copy, ExternalLink, Shuffle,
  Users, Settings, Sun, Moon, Heart, Trash2, ImagePlus, Instagram
} from "lucide-react";
import { supabase, isConfigured } from "./lib/supabase";
import {
  makeBassSampler, makePianoSampler,
  makeElectricGuitarSampler, makeAcousticGuitarSampler,
} from "./lib/jamSamples";
import {
  generateLick, layoutLick, lickToPNG, generateSongIdea,
  generateReelIdea, searchSongsterr,
} from "./lib/ideas";
import {
  fetchFeed, createPost, deletePost, toggleLike,
  updateProfile, uploadAvatar, timeAgo, igUrl,
} from "./lib/social";
import Auth from "./Auth.jsx";

/* iOS routes WebAudio through the "ambient" category, which the ring/silent
   switch mutes outright — the app looks broken with the switch flipped.
   A looping (silent) <audio> element promotes the page to the "playback"
   category, which ignores the switch. Must be kicked off by a user gesture. */
let iosUnlockEl = null;
function unlockIOSAudio() {
  if (iosUnlockEl) return;
  try {
    const rate = 8000, n = rate / 5; // 0.2s of digital silence
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data");
    v.setUint32(40, n * 2, true);
    const el = document.createElement("audio");
    el.src = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));
    el.loop = true;
    el.setAttribute("playsinline", "");
    iosUnlockEl = el;
    el.play().catch(() => { iosUnlockEl = null; });
  } catch (e) {}
}

/* ----------------------------------------------------------------------
   B SHARP — Fretboard Intelligence · v2
   fretboard · scales · arpeggios · blues jam trainer · mastery training
---------------------------------------------------------------------- */

const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const IV = [
  { l: "R",  c: "#ff2e4d", k: "#fff" },
  { l: "b2", c: "#ff7a2f", k: "#1a1208" },
  { l: "2",  c: "#ffce36", k: "#1a1208" },
  { l: "b3", c: "#1fe0d4", k: "#062018" },
  { l: "3",  c: "#3a86ff", k: "#fff" },
  { l: "4",  c: "#6ee7b7", k: "#06241a" },
  { l: "b5", c: "#c084fc", k: "#160a24" },
  { l: "5",  c: "#22c55e", k: "#04210f" },
  { l: "b6", c: "#f472b6", k: "#240a16" },
  { l: "6",  c: "#fb923c", k: "#1a1208" },
  { l: "b7", c: "#a78bfa", k: "#150a24" },
  { l: "7",  c: "#f9a8d4", k: "#240a16" },
];

const SCALES = {
  /* --- major scale modes --- */
  major:      { name: "Major",            tag: "Ionian · mode I",   grp: "Major scale modes", iv: [0,2,4,5,7,9,11],  char: "Bright · resolved · uplifting",     gen: "Pop, country, classical", song: "“Ode to Joy”, “Let It Be”" },
  dorian:     { name: "Dorian",           tag: "mode II",           grp: "Major scale modes", iv: [0,2,3,5,7,9,10],  char: "Minor but hopeful — natural 6",     gen: "Funk, jazz, modal rock",  song: "“So What”, “Oye Como Va”" },
  phrygian:   { name: "Phrygian",         tag: "mode III",          grp: "Major scale modes", iv: [0,1,3,5,7,8,10],  char: "Spanish · exotic · tense b2",       gen: "Flamenco, metal",         song: "Flamenco, thrash riffs" },
  lydian:     { name: "Lydian",           tag: "mode IV",           grp: "Major scale modes", iv: [0,2,4,6,7,9,11],  char: "Dreamy · floating · the #4",        gen: "Film, fusion, prog",      song: "“The Simpsons” theme" },
  mixo:       { name: "Mixolydian",       tag: "mode V",            grp: "Major scale modes", iv: [0,2,4,5,7,9,10],  char: "Major with a bluesy b7",            gen: "Blues-rock, funk, jam",   song: "“Sweet Child o’ Mine” riff" },
  minor:      { name: "Natural Minor",    tag: "Aeolian · mode VI", grp: "Major scale modes", iv: [0,2,3,5,7,8,10],  char: "Dark · introspective · serious",    gen: "Rock, metal, film score", song: "“Stairway” verse, “Losing My Religion”" },
  locrian:    { name: "Locrian",          tag: "mode VII",          grp: "Major scale modes", iv: [0,1,3,5,6,8,10],  char: "Unstable · dissonant · b5 root",    gen: "Metal, jazz over m7b5",   song: "“YYZ” intro vibe, m7♭5 lines" },
  /* --- minor & jazz family --- */
  harmMinor:  { name: "Harmonic Minor",   tag: "minor + natural 7", grp: "Minor & jazz",      iv: [0,2,3,5,7,8,11],  char: "Dramatic · neoclassical leap",      gen: "Classical, metal, gypsy", song: "Neoclassical shred" },
  phrygDom:   { name: "Phrygian Dominant",tag: "harm. minor mode V",grp: "Minor & jazz",      iv: [0,1,4,5,7,8,10],  char: "Flamenco fire · exotic dominant",   gen: "Flamenco, metal, klezmer",song: "“Misirlou”, “Hava Nagila”" },
  melMinor:   { name: "Melodic Minor",    tag: "minor + nat. 6 & 7",grp: "Minor & jazz",      iv: [0,2,3,5,7,9,11],  char: "Minor below · major above",         gen: "Jazz, fusion, film",      song: "Jazz-minor lines everywhere" },
  lydDom:     { name: "Lydian Dominant",  tag: "mel. minor mode IV",grp: "Minor & jazz",      iv: [0,2,4,6,7,9,10],  char: "Cheeky #4 over a 7th chord",        gen: "Fusion, Simpsons-jazz",   song: "Trane/Scofield over 7#11" },
  altered:    { name: "Altered Scale",    tag: "mel. minor mode VII",grp: "Minor & jazz",     iv: [0,1,3,4,6,8,10],  char: "Maximum tension — every alt note",  gen: "Jazz V7alt chords",       song: "Bebop turnaround tension" },
  /* --- pentatonic & blues --- */
  majPent:    { name: "Major Pentatonic", tag: "5-note",            grp: "Pentatonic & blues",iv: [0,2,4,7,9],       char: "Open · sweet · no wrong notes",     gen: "Country, rock, folk",     song: "“My Girl”, “Sweet Home Alabama”" },
  minPent:    { name: "Minor Pentatonic", tag: "5-note",            grp: "Pentatonic & blues",iv: [0,3,5,7,10],      char: "The rock/blues workhorse",          gen: "Blues, rock, soul",       song: "Most rock solos ever" },
  blues:      { name: "Blues Scale",      tag: "minor pent + b5",   grp: "Pentatonic & blues",iv: [0,3,5,6,7,10],    char: "Gritty · vocal · the b5 cry",       gen: "Blues, rock, R&B",        song: "Endless 12-bar jams" },
  majBlues:   { name: "Major Blues",      tag: "major pent + b3",   grp: "Pentatonic & blues",iv: [0,2,3,4,7,9],     char: "Sweet with a sly blue note",        gen: "Country, western swing",  song: "BB King's “sweet” side" },
  egyptian:   { name: "Egyptian / Sus",   tag: "pentatonic mode",   grp: "Pentatonic & blues",iv: [0,2,5,7,10],      char: "Ancient · open · no 3rd at all",    gen: "World, modal jams",       song: "Desert-flavoured riffs" },
  /* --- symmetric --- */
  wholeTone:  { name: "Whole Tone",       tag: "6-note symmetric",  grp: "Symmetric",         iv: [0,2,4,6,8,10],    char: "Weightless · dream sequence",       gen: "Impressionism, cartoons", song: "Debussy, dream cutaways" },
  dimWH:      { name: "Diminished (W-H)", tag: "8-note symmetric",  grp: "Symmetric",         iv: [0,2,3,5,6,8,9,11],char: "Spiralling tension · repeats in m3", gen: "Jazz, metal, film",      song: "Over dim7 chords" },
  dimHW:      { name: "Diminished (H-W)", tag: "8-note symmetric",  grp: "Symmetric",         iv: [0,1,3,4,6,7,9,10],char: "The altered-dominant workhorse",     gen: "Jazz V7b9, fusion",      song: "V7♭9 licks" },
  /* --- exotic --- */
  dblHarm:    { name: "Double Harmonic",  tag: "Byzantine",         grp: "Exotic",            iv: [0,1,4,5,7,8,11],  char: "Two exotic leaps · instant east",   gen: "Middle-Eastern, surf",    song: "“Misirlou” full scale" },
  hungMinor:  { name: "Hungarian Minor",  tag: "gypsy minor",       grp: "Exotic",            iv: [0,2,3,6,7,8,11],  char: "Harmonic minor with a #4 twist",    gen: "Gypsy jazz, classical",   song: "Liszt, Django colour" },
  hirajoshi:  { name: "Hirajoshi",        tag: "Japanese 5-note",   grp: "Exotic",            iv: [0,2,3,7,8],       char: "Koto strings · stark beauty",       gen: "Japanese trad, ambient",  song: "Koto & shamisen lines" },
  inSen:      { name: "In Sen",           tag: "Japanese 5-note",   grp: "Exotic",            iv: [0,1,5,7,10],      char: "Floating b2 · zen tension",         gen: "Japanese trad, film",     song: "Shakuhachi moods" },
};

const SCALE_GROUPS = ["Major scale modes", "Minor & jazz", "Pentatonic & blues", "Symmetric", "Exotic"];

const ARPS = {
  maj:   { name: "Major Triad",   suf: "",     iv: [0,4,7],     tip: "The 3 defines it — land there to sound major." },
  min:   { name: "Minor Triad",   suf: "m",    iv: [0,3,7],     tip: "The b3 is the colour note. R–b3–5 outlines any minor chord." },
  dim:   { name: "Diminished",    suf: "°",    iv: [0,3,6],     tip: "Two stacked minor 3rds — pure tension, wants to resolve." },
  aug:   { name: "Augmented",     suf: "+",    iv: [0,4,8],     tip: "Symmetrical: repeats every 4 frets. Great for weird passing runs." },
  maj7:  { name: "Major 7",       suf: "maj7", iv: [0,4,7,11],  tip: "Dreamy. The 7 sits one fret below the root — easy to find." },
  min7:  { name: "Minor 7",       suf: "m7",   iv: [0,3,7,10],  tip: "The ii-chord workhorse. b3 and b7 are your melody anchors." },
  dom7:  { name: "Dominant 7",    suf: "7",    iv: [0,4,7,10],  tip: "The blues engine. Target the 3 and b7 — they ARE the sound." },
  m7b5:  { name: "Minor 7 b5",    suf: "m7♭5", iv: [0,3,6,10],  tip: "Half-diminished — the ii of minor keys and jazz turnarounds." },
  dim7:  { name: "Diminished 7",  suf: "°7",   iv: [0,3,6,9],   tip: "Fully symmetric: same shape every 3 frets up the neck." },
};

/* --------------------------- CAGED positions --------------------------- */
// Fret windows relative to r = fret of the root on the low E string.
// The five shapes tile the whole neck in the fixed order C→A→G→E→D.
const CAGED_POS = {
  C: { off: -8, w: 3, roots: "5th & 2nd strings" },
  A: { off: -6, w: 3, roots: "5th & 3rd strings" },
  G: { off: -4, w: 4, roots: "6th, 3rd & 1st strings" },
  E: { off: -1, w: 3, roots: "6th, 4th & 1st strings" },
  D: { off: 1,  w: 3, roots: "4th & 2nd strings" },
};

/* --------------------------- Chord library --------------------------- */
// Movable shapes in standard tuning. Arrays run low-E → high-E; numbers are
// offsets from the root fret on the form's root string; null = muted.
// E form roots on the 6th string, A form on the 5th — the CAGED barre forms.
const CHORD_LIB = {
  maj:  { name: "Major",        suf: "",     grp: "Triads", iv: [0,4,7], formula: "R · 3 · 5",
          info: "The plain, resolved sound. The major 3rd is what makes it happy — everything else is scaffolding.",
          forms: { E: [0,2,2,1,0,0], A: [null,0,2,2,2,0] } },
  min:  { name: "Minor",        suf: "m",    grp: "Triads", iv: [0,3,7], formula: "R · b3 · 5",
          info: "Flatten the 3rd by one fret and the chord turns sad. One semitone is the whole difference between major and minor.",
          forms: { E: [0,2,2,0,0,0], A: [null,0,2,2,1,0] } },
  dim:  { name: "Diminished",   suf: "°",    grp: "Triads", iv: [0,3,6], formula: "R · b3 · b5",
          info: "Two minor 3rds stacked — maximum instability. It exists to resolve somewhere; it never wants to be home.",
          forms: { A: [null,0,1,2,1,null] } },
  aug:  { name: "Augmented",    suf: "+",    grp: "Triads", iv: [0,4,8], formula: "R · 3 · #5",
          info: "The 5th pushed sharp. Symmetrical (repeats every 4 frets), dreamlike, great as a passing chord between I and vi.",
          forms: { A: [null,0,3,2,2,1] } },
  sus2: { name: "Sus 2",        suf: "sus2", grp: "Triads", iv: [0,2,7], formula: "R · 2 · 5",
          info: "The 3rd replaced by the 2nd — neither major nor minor, just open. 'Sus' = suspended: the 3rd is held back.",
          forms: { A: [null,0,2,2,0,0] } },
  sus4: { name: "Sus 4",        suf: "sus4", grp: "Triads", iv: [0,5,7], formula: "R · 4 · 5",
          info: "The 3rd pushed up to the 4th. Creates a gentle tension that loves resolving back to the major chord.",
          forms: { E: [0,2,2,2,0,0], A: [null,0,2,2,3,0] } },
  six:  { name: "Sixth",        suf: "6",    grp: "Sixths & sevenths", iv: [0,4,7,9], formula: "R · 3 · 5 · 6",
          info: "A major triad plus the 6th — sweet, vintage, resolved. The 'happy ending' chord of early jazz and western swing.",
          forms: { E: [0,2,2,1,2,0], A: [null,0,2,2,2,2] } },
  m6:   { name: "Minor 6th",    suf: "m6",   grp: "Sixths & sevenths", iv: [0,3,7,9], formula: "R · b3 · 5 · 6",
          info: "Minor with a bright 6 — noir and bittersweet at once. The Dorian sound in one chord.",
          forms: { A: [null,0,2,2,1,2] } },
  dom7: { name: "Dominant 7",   suf: "7",    grp: "Sixths & sevenths", iv: [0,4,7,10], formula: "R · 3 · 5 · b7",
          info: "Major 3rd + flat 7 = the tritone engine of the blues and of every V chord. 'Dominant' because it dominates the pull back to I.",
          forms: { E: [0,2,0,1,0,0], A: [null,0,2,0,2,0] } },
  maj7: { name: "Major 7",      suf: "maj7", grp: "Sixths & sevenths", iv: [0,4,7,11], formula: "R · 3 · 5 · 7",
          info: "Major triad + natural 7, one fret below the octave. Dreamy, settled, bossa-and-ballad territory.",
          forms: { E: [0,null,1,1,0,null], A: [null,0,2,1,2,0] } },
  m7:   { name: "Minor 7",      suf: "m7",   grp: "Sixths & sevenths", iv: [0,3,7,10], formula: "R · b3 · 5 · b7",
          info: "Minor softened by the b7. The ii-chord workhorse of jazz and the default 'cool' minor sound.",
          forms: { E: [0,2,0,0,0,0], A: [null,0,2,0,1,0] } },
  m7b5: { name: "Minor 7 b5",   suf: "m7♭5", grp: "Sixths & sevenths", iv: [0,3,6,10], formula: "R · b3 · b5 · b7",
          info: "Half-diminished: a dim triad with a m7 on top. The ii chord of every minor key — tension with somewhere to go.",
          forms: { E: [0,null,0,0,-1,null], A: [null,0,1,0,1,null] } },
  dim7: { name: "Diminished 7", suf: "°7",   grp: "Sixths & sevenths", iv: [0,3,6,9], formula: "R · b3 · b5 · bb7",
          info: "All minor 3rds — perfectly symmetrical, so the same shape repeats every 3 frets. (The bb7 reads as a 6 on the board.)",
          forms: { E: [0,null,-1,0,-1,null], A: [null,0,1,-1,1,-1] } },
  nine: { name: "Ninth",        suf: "9",    grp: "Extensions (9 · 11 · 13)", iv: [0,4,7,10,2], formula: "R · 3 · 5 · b7 · 9",
          info: "A dominant 7 with the 9 stacked on top — funk's favourite chord. James Brown ran an empire on this shape.",
          forms: { A: [null,0,-1,0,0,0] } },
  maj9: { name: "Major 9",      suf: "maj9", grp: "Extensions (9 · 11 · 13)", iv: [0,4,7,11,2], formula: "R · 3 · 5 · 7 · 9",
          info: "maj7 lushness plus the 9. As soft-focus as harmony gets before it turns into a film score.",
          forms: { A: [null,0,-1,1,0,null] } },
  m9:   { name: "Minor 9",      suf: "m9",   grp: "Extensions (9 · 11 · 13)", iv: [0,3,7,10,2], formula: "R · b3 · 5 · b7 · 9",
          info: "m7 with the 9 — instantly smooth. The neo-soul default; let it ring and it does the work for you.",
          forms: { A: [null,0,-2,0,0,null] } },
  eleven:{ name: "Eleventh",    suf: "11",   grp: "Extensions (9 · 11 · 13)", iv: [0,7,10,2,5], formula: "R · (3) · 5 · b7 · 9 · 11",
          info: "In practice the 3rd is dropped (it clashes with the 11), leaving a huge suspended wash — one big barre does it.",
          forms: { A: [null,0,0,0,0,0] } },
  m11:  { name: "Minor 11",     suf: "m11",  grp: "Extensions (9 · 11 · 13)", iv: [0,3,7,10,2,5], formula: "R · b3 · 5 · b7 · 9 · 11",
          info: "Every open string of the guitar is in Em11 — the full six-string barre is the chord. Deep, ambiguous, cinematic.",
          forms: { E: [0,0,0,0,0,0] } },
  thirteen:{ name: "Thirteenth", suf: "13",  grp: "Extensions (9 · 11 · 13)", iv: [0,4,7,10,2,9], formula: "R · 3 · 5 · b7 · 9 · 11 · 13",
          info: "The whole scale stacked in 3rds — on guitar you keep R, 3, b7 and 13 and imply the rest. The classiest way to play a dominant.",
          forms: { E: [0,null,0,1,2,null] } },
  hendrix:{ name: "7 #9 (Hendrix)", suf: "7♯9", grp: "Extensions (9 · 11 · 13)", iv: [0,4,7,10,3], formula: "R · 3 · 5 · b7 · #9",
          info: "Major 3rd AND sharp 9 (a disguised minor 3rd) in one chord — the major/minor clash of “Purple Haze”. Filthy in the best way.",
          forms: { A: [null,0,-1,0,1,null] } },
};

const CHORD_GROUPS = ["Triads", "Sixths & sevenths", "Extensions (9 · 11 · 13)"];

// Label a chord tone: above a 7th, the stacked notes take compound names.
const chordDegLabel = (semi, iv) => {
  const has7 = iv.includes(10) || iv.includes(11);
  if (has7) {
    if (semi === 2) return "9";
    if (semi === 5) return "11";
    if (semi === 9) return "13";
    if (semi === 3 && iv.includes(4)) return "#9";
  }
  return IV[semi].l;
};

const TUNINGS = {
  standard: { name: "Standard",     o: [64,59,55,50,45,40] },
  dropD:    { name: "Drop D",       o: [64,59,55,50,45,38] },
  dadgad:   { name: "DADGAD",       o: [62,57,55,50,45,38] },
  openG:    { name: "Open G",       o: [62,59,55,50,43,38] },
  ebStd:    { name: "Eb Standard",  o: [63,58,54,49,44,39] },
};

const FRET_OPTS = [12, 15, 22];
const SINGLE_INLAY = [3, 5, 7, 9, 15, 17, 21];
const DOUBLE_INLAY = [12, 24];

const pc = (m) => ((m % 12) + 12) % 12;
const midiName = (m) => NOTES[pc(m)] + (Math.floor(m / 12) - 1);
const rand = (n) => Math.floor(Math.random() * n);

/* --------------------------- Jam data --------------------------- */
// Progressions are written as [degree-offset-in-semitones, quality] so they
// transpose to any key. Qualities carry chord tones + a scale suggestion.
const CHORD_QUALITIES = {
  "7":    { suf: "7",    iv: [0,4,7,10], scaleHint: "Mixolydian" },
  m7:     { suf: "m7",   iv: [0,3,7,10], scaleHint: "Dorian" },
  maj7:   { suf: "maj7", iv: [0,4,7,11], scaleHint: "Major (Ionian)" },
  maj:    { suf: "",     iv: [0,4,7],    scaleHint: "Major pentatonic" },
  min:    { suf: "m",    iv: [0,3,7],    scaleHint: "Minor pentatonic" },
  dim:    { suf: "°",    iv: [0,3,6],    scaleHint: "Locrian" },
};

// Nashville-number palette for the custom progression builder (in-key + borrowed)
const NASHVILLE = [
  { l: "1", d: 0, q: "maj" }, { l: "2m", d: 2, q: "min" }, { l: "3m", d: 4, q: "min" },
  { l: "4", d: 5, q: "maj" }, { l: "5", d: 7, q: "maj" }, { l: "6m", d: 9, q: "min" },
  { l: "7°", d: 11, q: "dim" },
  { l: "1⁷", d: 0, q: "7" }, { l: "4⁷", d: 5, q: "7" }, { l: "5⁷", d: 7, q: "7" },
  { l: "1m", d: 0, q: "m7" }, { l: "4m", d: 5, q: "m7" },
  { l: "♭3", d: 3, q: "maj" }, { l: "♭6", d: 8, q: "maj" }, { l: "♭7", d: 10, q: "maj" },
];
const DEFAULT_CUSTOM = [[0,"7"],[0,"7"],[0,"7"],[0,"7"],[5,"7"],[5,"7"],[0,"7"],[0,"7"],[7,"7"],[5,"7"],[0,"7"],[7,"7"]];

const PROGRESSIONS = {
  blues12: {
    name: "12-Bar Blues", nums: "1 · 4 · 5", safe: "blues",
    bars: [[0,"7"],[0,"7"],[0,"7"],[0,"7"],[5,"7"],[5,"7"],[0,"7"],[0,"7"],[7,"7"],[5,"7"],[0,"7"],[7,"7"]],
    tip: "The form every jam night assumes you know. Land each chord's 3rd as it changes.",
  },
  quick12: {
    name: "Quick-Change Blues", nums: "1 · 4 · 5 (IV in bar 2)", safe: "blues",
    bars: [[0,"7"],[5,"7"],[0,"7"],[0,"7"],[5,"7"],[5,"7"],[0,"7"],[0,"7"],[7,"7"],[5,"7"],[0,"7"],[7,"7"]],
    tip: "Same blues, but bar 2 jumps early to the IV — keeps the first line moving.",
  },
  minor12: {
    name: "Minor Blues", nums: "1m · 4m · b6 · 5", safe: "minPent",
    bars: [[0,"m7"],[0,"m7"],[0,"m7"],[0,"m7"],[5,"m7"],[5,"m7"],[0,"m7"],[0,"m7"],[8,"maj7"],[7,"7"],[0,"m7"],[7,"7"]],
    tip: "“The Thrill Is Gone” territory. The bVI–V turnaround is the emotional peak.",
  },
  oneFourFive: {
    name: "I – IV – V", nums: "1 · 4 · 5", safe: "majPent",
    bars: [[0,"maj"],[5,"maj"],[7,"maj"],[0,"maj"]],
    tip: "Three chords, ten thousand songs. Major pentatonic sails over all of it.",
  },
  doowop: {
    name: "I – vi – IV – V ('50s)", nums: "1 · 6m · 4 · 5", safe: "majPent",
    bars: [[0,"maj"],[9,"min"],[5,"maj"],[7,"7"]],
    tip: "“Stand By Me”. The vi chord is the moody one — its b3 is your money note.",
  },
  twoFiveOne: {
    name: "ii – V – I (jazz)", nums: "2m · 5 · 1", safe: "major",
    bars: [[2,"m7"],[7,"7"],[0,"maj7"],[0,"maj7"]],
    tip: "The jazz cell. One major scale covers all three chords — target the 3rds & 7ths.",
  },
};

// Grooves/styles: subdivision, steps per bar, swing, genre bpm, guitar drive.
const GROOVES = {
  shuffle:   { name: "Blues Shuffle",   sig: "4/4 swung", sub: "8n",  steps: 8,  swing: 0.55, bpm: 96 },
  slow128:   { name: "Slow Blues",      sig: "12/8",      sub: "8t",  steps: 12, swing: 0,    bpm: 58 },
  rock:      { name: "Rock",            sig: "4/4",       sub: "8n",  steps: 8,  swing: 0,    bpm: 122, drive: 0.35 },
  metal:     { name: "Metal",           sig: "4/4",       sub: "16n", steps: 16, swing: 0,    bpm: 142, drive: 0.8 },
  country:   { name: "Country Train",   sig: "4/4",       sub: "16n", steps: 16, swing: 0,    bpm: 112 },
  bluegrass: { name: "Bluegrass",       sig: "2/4 fast",  sub: "8n",  steps: 8,  swing: 0,    bpm: 138 },
  waltz:     { name: "Country Waltz",   sig: "3/4",       sub: "8n",  steps: 6,  swing: 0,    bpm: 104 },
};

const chordAt = (keyPc, [deg, q]) => {
  const rootP = pc(keyPc + deg);
  const qual = CHORD_QUALITIES[q];
  const third = qual.iv.includes(4) ? 4 : 3;
  const seventh = qual.iv.length > 3 ? qual.iv[3] : 7;
  return {
    name: NOTES[rootP] + qual.suf,
    rootPc: rootP,
    iv: qual.iv,
    scaleHint: qual.scaleHint,
    third,
    thirdName: NOTES[pc(rootP + third)],
    tones: qual.iv.map((i) => NOTES[pc(rootP + i)]).join(" · "),
    bass: 28 + pc(rootP - 4), // E1..D#2 register
    seventh,
  };
};

/* ----------------------------- Fretboard ----------------------------- */

function Fretboard({ tuning, numFrets, leftHanded, interactive, onCell, cellRenderer, bands }) {
  const cellW = 58, rowH = 44, padL = 56, padT = 46, padB = 36, padR = 22;
  const cols = numFrets + 1;
  const boardW = cols * cellW;
  const boardH = 6 * rowH;
  const W = padL + boardW + padR;
  const H = padT + boardH + padB;

  const dispCol = (c) => (leftHanded ? numFrets - c : c);
  const noteX = (c) => padL + (dispCol(c) + 0.5) * cellW;
  const stringY = (s) => padT + (s + 0.5) * rowH;
  const nutX = leftHanded ? padL + (cols - 1) * cellW : padL + cellW;

  const wires = [];
  for (let k = 1; k < cols; k++) wires.push(padL + k * cellW);

  // Scale to fill the panel on desktop; keep a minimum width on phones so
  // note dots stay tappable, with horizontal scroll taking up the slack.
  const minW = Math.min(W, Math.max(560, numFrets * 46));
  return (
    <div className="overflow-x-auto overflow-y-hidden -mx-1 px-1" style={{ WebkitOverflowScrolling: "touch" }}>
      <svg viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", minWidth: minW, display: "block", touchAction: "pan-x" }}>
        <defs>
          <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1c1c25" />
            <stop offset="50%" stopColor="#121218" />
            <stop offset="100%" stopColor="#0b0b10" />
          </linearGradient>
          <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>

        <rect x={padL} y={padT} width={boardW} height={boardH} rx="6" fill="url(#wood)"
          stroke="rgba(255,255,255,0.07)" />
        <rect x={padL} y={padT} width={boardW} height={boardH / 2} rx="6" fill="url(#sheen)" />

        {/* position highlight bands (e.g. CAGED windows) */}
        {(bands || []).map(([a, b], i) =>
          Array.from({ length: b - a + 1 }, (_, k) => a + k)
            .filter((f) => f >= 0 && f <= numFrets)
            .map((f) => (
              <rect key={`bd${i}-${f}`} x={noteX(f) - cellW / 2} y={padT} width={cellW} height={boardH}
                fill="rgba(124,108,255,0.10)" />
            ))
        )}

        {Array.from({ length: numFrets }, (_, i) => i + 1).map((f) => (
          <text key={"fn" + f} x={noteX(f)} y={padT - 16} textAnchor="middle"
            className="mono" fontSize="11"
            fill={SINGLE_INLAY.includes(f) || DOUBLE_INLAY.includes(f) ? "#7c6cff" : "#4a4a55"}>
            {f}
          </text>
        ))}

        {SINGLE_INLAY.filter((f) => f <= numFrets).map((f) => (
          <circle key={"si" + f} cx={noteX(f)} cy={padT + boardH / 2} r="4.5"
            fill="rgba(124,108,255,0.16)" />
        ))}
        {DOUBLE_INLAY.filter((f) => f <= numFrets).map((f) => (
          <g key={"di" + f}>
            <circle cx={noteX(f)} cy={padT + boardH * 0.3} r="4.5" fill="rgba(124,108,255,0.2)" />
            <circle cx={noteX(f)} cy={padT + boardH * 0.7} r="4.5" fill="rgba(124,108,255,0.2)" />
          </g>
        ))}

        {wires.map((x, i) => {
          const isNut = Math.abs(x - nutX) < 1;
          return (
            <line key={"w" + i} x1={x} y1={padT} x2={x} y2={padT + boardH}
              stroke={isNut ? "#c9c9d4" : "rgba(180,180,200,0.22)"}
              strokeWidth={isNut ? 5 : 1.5} />
          );
        })}

        {tuning.map((m, s) => (
          <g key={"str" + s}>
            <line x1={padL} y1={stringY(s)} x2={padL + boardW} y2={stringY(s)}
              stroke="rgba(210,210,225,0.34)" strokeWidth={1 + s * 0.45} />
            <text x={padL - 14} y={stringY(s) + 4} textAnchor="middle" className="mono"
              fontSize="12" fill="#6a6a78">{NOTES[pc(m)]}</text>
          </g>
        ))}

        {tuning.map((open, s) =>
          Array.from({ length: cols }, (_, f) => {
            const midi = open + f;
            const r = cellRenderer(s, f, midi);
            const cx = noteX(f), cy = stringY(s);
            const handle = interactive && onCell ? () => onCell(s, f, midi) : undefined;
            return (
              <g key={`c${s}-${f}`}>
                {interactive && (
                  <rect x={cx - cellW / 2} y={cy - rowH / 2} width={cellW} height={rowH}
                    fill="transparent" style={{ cursor: "pointer" }} onClick={handle} />
                )}
                {r && (
                  <g style={{ pointerEvents: "none" }}>
                    {r.glow && (
                      <circle cx={cx} cy={cy} r="19.5" fill="none" stroke={r.fill}
                        strokeWidth="2.5" opacity="0.9" className="bs-pulse" />
                    )}
                    {r.ring && (
                      <circle cx={cx} cy={cy} r="20" fill="none"
                        stroke={r.fill} strokeWidth="1.5" opacity="0.55" />
                    )}
                    <circle cx={cx} cy={cy} r={r.faint ? 10.5 : 16} fill={r.fill}
                      opacity={r.faint ? 0.55 : 1}
                      style={r.faint ? {} : { filter: `drop-shadow(0 0 9px ${r.fill}99)` }} />
                    <text x={cx} y={cy + (r.faint ? 3.5 : 4.5)} textAnchor="middle"
                      className={r.faint ? "mono" : "display"}
                      fontSize={r.faint ? 9.5 : 12.5} fontWeight="700" fill={r.ink}>
                      {r.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}

/* ----------------------------- Landing ----------------------------- */

// The opening chord of SRV's "Lenny": Emaj9 voiced x-7-6-8-7-7,
// played on the sampled strat through chorus + long reverb.
async function playLennyChord() {
  unlockIOSAudio();
  await Tone.start();
  const chorus = new Tone.Chorus({ frequency: 1.4, delayTime: 3.8, depth: 0.7, wet: 0.55 }).toDestination().start();
  const verb = new Tone.Reverb({ decay: 4, wet: 0.45 }).connect(chorus);
  const strat = makeElectricGuitarSampler().connect(verb);
  strat.volume.value = -4;
  try { await Tone.loaded(); } catch (e) {}
  const notes = [52, 56, 63, 66, 71]; // E3 G#3 D#4 F#4 B4
  const now = Tone.now() + 0.03;
  notes.forEach((m, i) => {
    try { strat.triggerAttackRelease(midiName(m), 4.5, now + i * 0.055, 0.7 - i * 0.04); } catch (e) {}
  });
  setTimeout(() => { try { strat.dispose(); verb.dispose(); chorus.dispose(); } catch (e) {} }, 8000);
}

function Landing({ onEnter }) {
  const [leaving, setLeaving] = useState(false);
  const go = () => {
    if (leaving) return;
    setLeaving(true);
    playLennyChord().catch(() => {});
    setTimeout(onEnter, 1250);
  };
  return (
    <div onClick={go}
      className="min-h-screen w-full flex flex-col items-center justify-center cursor-pointer select-none overflow-hidden"
      style={{
        background: "radial-gradient(1000px 700px at 50% 30%,rgba(124,108,255,0.14),transparent 60%)," +
          "radial-gradient(800px 600px at 50% 80%,rgba(34,227,216,0.08),transparent 55%),#08080b",
      }}>
      <style>{`
        @keyframes landFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-12px);}}
        @keyframes landGlow{0%,100%{filter:drop-shadow(0 0 22px rgba(124,108,255,0.45));}50%{filter:drop-shadow(0 0 44px rgba(34,227,216,0.6));}}
        @keyframes landHint{0%,100%{opacity:.35;}50%{opacity:.9;}}
        @keyframes landExit{0%{transform:scale(1);opacity:1;}55%{transform:scale(1.12) rotate(-3deg);opacity:1;}100%{transform:scale(7);opacity:0;filter:blur(10px);}}
        @keyframes landString{0%{transform:scaleX(0);opacity:0;}30%{opacity:1;}100%{transform:scaleX(1);opacity:0;}}
        .land-card{animation:landFloat 4.5s ease-in-out infinite, landGlow 4.5s ease-in-out infinite;}
        .land-exit{animation:landExit 1.25s cubic-bezier(.5,0,.8,.4) both;}
        .land-str{transform-origin:left;animation:landString 1.1s ease-out both;}
      `}</style>

      <div className={leaving ? "land-exit" : "land-card"}>
        <svg width="300" height="330" viewBox="0 0 300 330">
          <defs>
            <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#22e3d8" /><stop offset="1" stopColor="#7c6cff" />
            </linearGradient>
          </defs>
          {/* neck + headstock */}
          <rect x="141" y="18" width="18" height="130" rx="4" fill="#15151d" stroke="url(#lg1)" strokeWidth="1.5" />
          <path d="M138 20 L162 20 L166 -2 L134 -2 Z" transform="translate(0 8)" fill="#15151d" stroke="url(#lg1)" strokeWidth="1.5" />
          {[0, 1, 2].map((i) => (
            <line key={i} x1="143" y1={40 + i * 26} x2="157" y2={40 + i * 26} stroke="rgba(210,210,225,0.4)" strokeWidth="2" />
          ))}
          {/* strat-ish body */}
          <path d="M150 132
            C 205 128, 232 158, 230 196
            C 229 224, 210 238, 214 258
            C 218 282, 196 305, 163 303
            C 143 302, 143 292, 128 292
            C 110 292, 106 306, 88 300
            C 62 291, 58 258, 72 236
            C 82 220, 70 206, 74 186
            C 79 158, 106 130, 150 132 Z"
            fill="#101018" stroke="url(#lg1)" strokeWidth="2.5" />
          {/* strings over the body */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={i} x1={144 + i * 2.4} y1="24" x2={144 + i * 2.4} y2="240" stroke="rgba(210,210,225,0.35)" strokeWidth="0.8" />
          ))}
          {/* B# on the body */}
          <text x="150" y="238" textAnchor="middle" fontFamily="system-ui" fontWeight="900" fontSize="64" fill="url(#lg1)">B♯</text>
        </svg>
      </div>

      {leaving ? (
        <div className="w-64 mt-10 space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="land-str h-px w-full"
              style={{ background: "linear-gradient(90deg,#22e3d8,#7c6cff)", animationDelay: `${i * 0.07}s` }} />
          ))}
        </div>
      ) : (
        <p className="mono text-[11px] tracking-[0.35em] text-zinc-500 mt-10"
          style={{ animation: "landHint 2.6s ease-in-out infinite" }}>
          TAP TO TUNE IN
        </p>
      )}
    </div>
  );
}

/* ----------------------------- Chord diagram ----------------------------- */

const STD_OPEN = [40, 45, 50, 55, 59, 64]; // low E → high E, standard tuning

// Resolve a movable form against a root: returns absolute frets + midis.
function resolveShape(rootPc, quality, form) {
  const offs = quality.forms[form];
  const openPc = form === "E" ? 4 : 9; // low E or A string
  let n = pc(rootPc - openPc);
  const minOff = Math.min(...offs.filter((o) => o !== null));
  if (n + minOff < 0) n += 12;
  const frets = offs.map((o) => (o === null ? null : o + n));
  const midis = frets.map((f, i) => (f === null ? null : STD_OPEN[i] + f));
  return { frets, midis };
}

function ChordDiagram({ rootPc, quality, form, onStrum }) {
  const { frets, midis } = resolveShape(rootPc, quality, form);
  const played = frets.filter((f) => f !== null);
  const maxF = Math.max(...played);
  const nutPos = maxF <= 4; // show the nut for open-position shapes
  const base = nutPos ? 1 : Math.min(...played.filter((f) => f > 0));
  const rows = 5;

  const colW = 26, headH = 30, rowH = 30, padX = 34, padB = 14;
  const W = padX * 2 + colW * 5;

  const sx = (i) => padX + i * colW;            // string index 0(lowE)..5
  const fy = (f) => headH + (f - base + 0.5) * rowH; // fret row centre

  return (
    <button onClick={() => onStrum(midis.filter((m) => m !== null))}
      className="rounded-xl border border-white/10 bg-white/[0.03] hover:border-cyan-400/40 transition-colors p-3 text-left"
      title="Tap to hear it">
      <div className="flex items-baseline justify-between mb-1 px-1">
        <span className="display font-bold text-sm text-white">{NOTES[rootPc]}{quality.suf}</span>
        <span className="mono text-[9px] text-zinc-500">{form} form</span>
      </div>
      <svg viewBox={`0 0 ${W} ${headH + rowH * rows + padB}`} style={{ width: "100%", height: "auto" }}>
        {/* open / muted markers */}
        {frets.map((f, i) => (
          <text key={"m" + i} x={sx(i)} y={headH - 14} textAnchor="middle"
            className="mono" fontSize="10"
            fill={f === null ? "#5d5d6a" : f === 0 ? "#4dd0c5" : "transparent"}>
            {f === null ? "✕" : "○"}
          </text>
        ))}
        {/* nut or base-fret label */}
        {nutPos ? (
          <rect x={sx(0) - 1.5} y={headH - 4} width={colW * 5 + 3} height="4" rx="1" fill="#c9c9d4" />
        ) : (
          <text x={6} y={fy(base) + 3.5} textAnchor="start" className="mono" fontSize="10" fill="#7c6cff">
            {base}fr
          </text>
        )}
        {/* grid */}
        {Array.from({ length: rows + 1 }, (_, r) => (
          <line key={"f" + r} x1={sx(0)} y1={headH + r * rowH} x2={sx(5)} y2={headH + r * rowH}
            stroke="rgba(180,180,200,0.25)" strokeWidth="1" />
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <line key={"s" + i} x1={sx(i)} y1={headH} x2={sx(i)} y2={headH + rows * rowH}
            stroke="rgba(210,210,225,0.35)" strokeWidth={1 + (5 - i) * 0.25} />
        ))}
        {/* dots */}
        {frets.map((f, i) => {
          if (f === null || f === 0) return null;
          const semi = pc(STD_OPEN[i] + f - rootPc);
          const info = IV[semi];
          return (
            <g key={"d" + i}>
              <circle cx={sx(i)} cy={fy(f)} r="10.5" fill={info.c}
                stroke={semi === 0 ? "#fff" : "none"} strokeWidth="1.5"
                style={{ filter: `drop-shadow(0 0 5px ${info.c}77)` }} />
              <text x={sx(i)} y={fy(f) + 3.5} textAnchor="middle" className="display"
                fontSize="9" fontWeight="700" fill={info.k}>
                {chordDegLabel(semi, quality.iv)}
              </text>
            </g>
          );
        })}
        {/* open-string tone labels */}
        {frets.map((f, i) => {
          if (f !== 0) return null;
          const semi = pc(STD_OPEN[i] - rootPc);
          return (
            <text key={"o" + i} x={sx(i)} y={headH - 3} textAnchor="middle" className="mono"
              fontSize="7.5" fill="#4dd0c5">
              {chordDegLabel(semi, quality.iv)}
            </text>
          );
        })}
      </svg>
    </button>
  );
}

/* ----------------------------- Lick tab notation ----------------------------- */

function TabSVG({ events }) {
  const { cols, bars, totalW } = layoutLick(events);
  const rowH = 26, padT = 16, padB = 22;
  const H = padT + rowH * 5 + padB;
  const sy = (s) => padT + s * rowH;
  return (
    <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: "touch" }}>
      <svg viewBox={`0 0 ${totalW} ${H}`}
        style={{ width: "100%", height: "auto", minWidth: Math.min(totalW, 640), display: "block" }}>
        {["e", "B", "G", "D", "A", "E"].map((nm, s) => (
          <g key={s}>
            <text x={4} y={sy(s) + 3.5} className="mono" fontSize="10" fill="#6a6a78">{nm}</text>
            <line x1={18} y1={sy(s)} x2={totalW - 6} y2={sy(s)}
              stroke="rgba(210,210,225,0.3)" strokeWidth="1" />
          </g>
        ))}
        {bars.map((bx, i) => (
          <line key={i} x1={bx} y1={sy(0) - 8} x2={bx} y2={sy(5) + 8}
            stroke="rgba(210,210,225,0.18)" strokeWidth="1.5" />
        ))}
        {cols.map(({ x, ev }, i) => (
          <g key={i}>
            <rect x={x - 9} y={sy(ev.s) - 9} width={ev.tech ? 26 : 18} height="18" fill="#101016" />
            <text x={x} y={sy(ev.s) + 4} textAnchor="middle" className="mono"
              fontSize="12" fontWeight="700" fill="#fff">{ev.f}</text>
            {ev.tech && (
              <text x={x + 12} y={sy(ev.s) + 3} textAnchor="middle" className="mono"
                fontSize="9.5" fill="#22e3d8">{ev.tech}</text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ----------------------------- UI atoms ----------------------------- */

const Panel = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl ${className}`}>
    {children}
  </div>
);

function Seg({ value, options, onChange }) {
  return (
    <div className="inline-flex rounded-xl bg-black/40 border border-white/10 p-1 gap-1">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`mono text-xs px-3 py-2 rounded-lg transition-colors ${
            value === o.v ? "text-black font-bold" : "text-zinc-400 hover:text-white"
          }`}
          style={value === o.v ? { background: "linear-gradient(135deg,#22e3d8,#7c6cff)" } : {}}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------- App ------------------------------- */

function BSharp({
  username, isGuest, userId, profile, onProfileChange, theme, setTheme,
  onSignOut, onSignIn, initialProgress, onPersist,
}) {
  const init = initialProgress || {};
  const [tab, setTab] = useState("explore");

  // explore
  const [tuningKey, setTuningKey] = useState("standard");
  const [numFrets, setNumFrets] = useState(15);
  const [rootPc, setRootPc] = useState(9);
  const [scaleKey, setScaleKey] = useState("minPent");
  const [viewMode, setViewMode] = useState("scale"); // scale | arp
  const [arpKey, setArpKey] = useState("dom7");
  const [displayMode, setDisplayMode] = useState("intervals");
  const [showAll, setShowAll] = useState(false);
  const [lefty, setLefty] = useState(false);
  const [lastPlayed, setLastPlayed] = useState(null);
  const [cagedKey, setCagedKey] = useState("all");

  // chords tab
  const [chordRoot, setChordRoot] = useState(9);
  const [chordType, setChordType] = useState("dom7");

  // ideas tab
  const [ideaKey, setIdeaKey] = useState(9);
  const [ideaScale, setIdeaScale] = useState("minPent");
  const [lickStyle, setLickStyle] = useState("bluesy");
  const [lick, setLick] = useState(null);
  const [songIdea, setSongIdea] = useState(null);
  const [tabQuery, setTabQuery] = useState("");
  const [tabSearch, setTabSearch] = useState({ status: "idle", items: [] });

  // create tab
  const [reel, setReel] = useState(null);
  const [copied, setCopied] = useState(false);

  // social tab
  const [feed, setFeed] = useState([]);
  const [feedState, setFeedState] = useState("idle"); // idle|loading|ready|error
  const [postFile, setPostFile] = useState(null);
  const [postCaption, setPostCaption] = useState("");
  const [posting, setPosting] = useState(false);
  const [postErr, setPostErr] = useState(null);

  // settings modal
  const [showSettings, setShowSettings] = useState(false);
  const [setName, setSetName] = useState("");
  const [setIg, setSetIg] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState(null);

  // progression (hydrated from cloud or local save)
  const [xp, setXp] = useState(init.xp || 0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(init.best || 0);
  const [answered, setAnswered] = useState(init.answered || 0);
  const [correct, setCorrect] = useState(init.correct || 0);
  const [missByNote, setMissByNote] = useState(init.missByNote || {});
  const [levelUp, setLevelUp] = useState(false);

  // quiz
  const [quizMode, setQuizMode] = useState("identify");
  const [round, setRound] = useState(null);
  const [found, setFound] = useState(new Set());
  const [wrongCell, setWrongCell] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [locked, setLocked] = useState(false);

  // jam
  const [jamPlaying, setJamPlaying] = useState(false);
  const [bpm, setBpm] = useState(96);
  const [jamBar, setJamBar] = useState(0);
  const [showSafe, setShowSafe] = useState(true);
  const [jamKey, setJamKey] = useState(9); // pitch class, default A
  const [progKey, setProgKey] = useState("blues12");
  const [grooveKey, setGrooveKey] = useState("shuffle");
  const [customBars, setCustomBars] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem("bsharp-customprog"));
      if (Array.isArray(s) && s.length) return s;
    } catch (e) {}
    return DEFAULT_CUSTOM.map((b) => [...b]);
  });
  const [selectedChip, setSelectedChip] = useState(null);

  useEffect(() => {
    try { localStorage.setItem("bsharp-customprog", JSON.stringify(customBars)); } catch (e) {}
  }, [customBars]);

  const synthRef = useRef(null);
  const strumRef = useRef(null);
  const startedRef = useRef(false);
  const prevLevel = useRef(1 + Math.floor((init.xp || 0) / 120));
  const timers = useRef([]);
  const jam = useRef({ built: false, step: 0, loopId: null });
  const missRef = useRef({});
  missRef.current = missByNote;

  const tuning = TUNINGS[tuningKey].o;
  const scale = SCALES[scaleKey];
  const arp = ARPS[arpKey];
  const activeIv = viewMode === "arp" ? arp.iv : scale.iv;
  const level = 1 + Math.floor(xp / 120);
  const xpInLevel = xp % 120;
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

  useEffect(() => {
    if (level > prevLevel.current) {
      prevLevel.current = level;
      setLevelUp(true);
      const t = setTimeout(() => setLevelUp(false), 2200);
      return () => clearTimeout(t);
    }
    prevLevel.current = level;
  }, [level]);

  // debounced save of progress (cloud when signed in, this device when guest)
  const persistRef = useRef(onPersist);
  persistRef.current = onPersist;
  useEffect(() => {
    const t = setTimeout(
      () => persistRef.current?.({ xp, best, answered, correct, missByNote }),
      1200
    );
    return () => clearTimeout(t);
  }, [xp, best, answered, correct, missByNote]);

  /* ---------------- lead synth (tap-to-hear) ---------------- */
  const ensureAudio = useCallback(async () => {
    unlockIOSAudio();
    if (startedRef.current) return;
    await Tone.start();
    const synth = new Tone.PluckSynth({ attackNoise: 1.1, dampening: 3600, resonance: 0.92 });
    const verb = new Tone.Freeverb({ roomSize: 0.55, wet: 0.16 }).toDestination();
    synth.connect(verb);
    synth.volume.value = -4;
    synthRef.current = synth;
    startedRef.current = true;
  }, []);

  const playMidi = useCallback(async (m) => {
    await ensureAudio();
    try { synthRef.current.triggerAttack(midiName(m), Tone.now()); } catch (e) {}
  }, [ensureAudio]);

  const strumChord = useCallback(async (midis) => {
    await Tone.start();
    if (!strumRef.current) {
      strumRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: "triangle" },
        envelope: { attack: 0.004, decay: 1.2, sustain: 0, release: 0.3 },
      }).toDestination();
      strumRef.current.volume.value = -8;
    }
    const now = Tone.now();
    midis.forEach((m, i) => {
      try { strumRef.current.triggerAttackRelease(midiName(m), 1.4, now + i * 0.045); } catch (e) {}
    });
  }, []);

  /* ---------------- social handlers ---------------- */
  const loadFeed = useCallback(async () => {
    if (!isConfigured) return;
    setFeedState("loading");
    try {
      setFeed(await fetchFeed());
      setFeedState("ready");
    } catch (e) {
      setFeedState("error");
    }
  }, []);

  useEffect(() => {
    if (tab === "social" && feedState === "idle") loadFeed();
    // eslint-disable-next-line
  }, [tab]);

  const submitPost = async () => {
    if (!postFile || posting || !userId) return;
    setPosting(true);
    setPostErr(null);
    try {
      await createPost(userId, postFile, postCaption);
      setPostFile(null);
      setPostCaption("");
      await loadFeed();
    } catch (e) {
      setPostErr(e.message || "Upload failed — try again");
    }
    setPosting(false);
  };

  const onLike = async (post) => {
    if (!userId) { onSignIn(); return; }
    const liked = post.likes.some((l) => l.user_id === userId);
    setFeed((f) => f.map((p) => p.id === post.id ? {
      ...p,
      likes: liked ? p.likes.filter((l) => l.user_id !== userId) : [...p.likes, { user_id: userId }],
    } : p));
    try { await toggleLike(post.id, userId, liked); } catch (e) { loadFeed(); }
  };

  const onDeletePost = async (post) => {
    if (!window.confirm("Delete this post?")) return;
    setFeed((f) => f.filter((p) => p.id !== post.id));
    try { await deletePost(post); } catch (e) { loadFeed(); }
  };

  /* ---------------- settings handlers ---------------- */
  const openSettings = () => {
    setSetName(profile?.display_name || "");
    setSetIg(profile?.instagram || "");
    setSettingsMsg(null);
    setShowSettings(true);
  };

  const saveSettings = async () => {
    if (!userId) { setShowSettings(false); return; }
    setSettingsBusy(true);
    setSettingsMsg(null);
    try {
      await updateProfile(userId, { display_name: setName.trim(), instagram: setIg.trim() });
      onProfileChange({ display_name: setName.trim() || null, instagram: setIg.trim() || null });
      setSettingsMsg({ ok: true, text: "Saved" });
    } catch (e) {
      setSettingsMsg({ ok: false, text: e.message || "Couldn't save" });
    }
    setSettingsBusy(false);
  };

  const onAvatarPick = async (file) => {
    if (!file || !userId) return;
    setSettingsBusy(true);
    setSettingsMsg(null);
    try {
      const url = await uploadAvatar(userId, file);
      onProfileChange({ avatar_url: url });
      setSettingsMsg({ ok: true, text: "Photo updated" });
    } catch (e) {
      setSettingsMsg({ ok: false, text: e.message || "Upload failed" });
    }
    setSettingsBusy(false);
  };

  /* ---------------- ideas & create handlers ---------------- */
  const newLick = useCallback((k = ideaKey, sc = ideaScale, st = lickStyle) => {
    setLick(generateLick(k, SCALES[sc].iv, st));
  }, [ideaKey, ideaScale, lickStyle]);

  useEffect(() => {
    if (tab === "ideas" || tab === "create") {
      if (!lick) newLick();
      if (tab === "ideas" && !songIdea) setSongIdea(generateSongIdea(Object.keys(PROGRESSIONS), Object.keys(GROOVES)));
      if (tab === "create" && !reel) setReel(generateReelIdea(NOTES[ideaKey], SCALES[ideaScale].name, PROGRESSIONS[progKey].name));
    }
    // eslint-disable-next-line
  }, [tab]);

  useEffect(() => { if (lick) newLick(); /* eslint-disable-next-line */ }, [ideaKey, ideaScale, lickStyle]);

  const playLick = useCallback(async () => {
    if (!lick) return;
    await ensureAudio();
    await strumChord([]); // ensures the poly synth exists
    const eighth = 30 / lick.bpm;
    let t = Tone.now() + 0.08;
    lick.events.forEach((ev) => {
      try { strumRef.current.triggerAttackRelease(midiName(ev.midi), ev.dur * eighth * 0.92, t); } catch (e) {}
      t += ev.dur * eighth;
    });
  }, [lick, ensureAudio, strumChord]);

  const downloadLick = useCallback(async () => {
    if (!lick) return;
    const blob = await lickToPNG(
      lick,
      `${NOTES[ideaKey]} ${SCALES[ideaScale].name} lick`,
      `${lick.bpm} bpm · ${lickStyle} feel`
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bsharp-lick-${NOTES[ideaKey].replace("#", "s")}-${ideaScale}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, [lick, ideaKey, ideaScale, lickStyle]);

  const loadIdeaInJam = useCallback(() => {
    if (!songIdea) return;
    setJamKey(songIdea.keyPc);
    setProgKey(songIdea.prog);
    setGrooveKey(songIdea.groove);
    setBpm(songIdea.bpm);
    setTab("jam");
  }, [songIdea]);

  const doTabSearch = useCallback(async () => {
    const q = tabQuery.trim();
    if (!q) return;
    setTabSearch({ status: "loading", items: [] });
    try {
      const items = await searchSongsterr(q);
      setTabSearch({ status: "ok", items });
    } catch (e) {
      setTabSearch({ status: "error", items: [] });
    }
  }, [tabQuery]);

  const copyCaption = useCallback(async () => {
    if (!reel) return;
    try {
      await navigator.clipboard.writeText(reel.caption);
      setCopied(true);
      const t = setTimeout(() => setCopied(false), 1600);
      timers.current.push(t);
    } catch (e) {}
  }, [reel]);

  const playScale = useCallback(async () => {
    await ensureAudio();
    let base = 52;
    while (pc(base) !== rootPc) base++;
    const seq = [...activeIv.map((i) => base + i), base + 12];
    const now = Tone.now();
    seq.forEach((m, i) => {
      try { synthRef.current.triggerAttack(midiName(m), now + i * 0.34); } catch (e) {}
    });
  }, [ensureAudio, rootPc, activeIv]);

  /* ---------------- jam engine ---------------- */
  // custom progression: empty bars carry the previous chord forward
  const filledCustom = (() => {
    let last = null;
    const out = customBars.map((b) => { if (b) { last = b; } return last; });
    const firstIdx = out.findIndex(Boolean);
    if (firstIdx < 0) return [[0, "maj"]];
    for (let i = 0; i < firstIdx; i++) out[i] = last; // leading empties wrap from the end
    return out;
  })();
  const customSafe = filledCustom.some(([d, q]) => d === 0 && q === "7") ? "blues"
    : (filledCustom[0][1] === "min" || filledCustom[0][1] === "m7") ? "minPent" : "majPent";
  const customProg = {
    name: "Custom", nums: "your own changes", safe: customSafe, bars: filledCustom,
    tip: "Your progression. Change a bar mid-jam and the band follows — in any key.",
  };
  const jamProg = progKey === "custom" ? customProg : PROGRESSIONS[progKey];

  // live jam config readable from inside the scheduled step (avoids stale closures)
  const jamCfg = useRef(null);
  jamCfg.current = { keyPc: jamKey, prog: jamProg, groove: GROOVES[grooveKey], grooveId: grooveKey };

  const buildJamSynths = useCallback(() => {
    if (jam.current.built) return;
    // master bus: glue compression → a touch of room → limiter
    const limiter = new Tone.Limiter(-1).toDestination();
    const verb = new Tone.Reverb({ decay: 1.5, wet: 0.14 }).connect(limiter);
    const bus = new Tone.Compressor({ threshold: -20, ratio: 3, attack: 0.01, release: 0.16 }).connect(verb);

    const kick = new Tone.MembraneSynth({
      octaves: 5, pitchDecay: 0.05,
      envelope: { attack: 0.001, decay: 0.32, sustain: 0.01, release: 0.4 },
    }).connect(bus);
    kick.volume.value = -4;

    // snare = noise crack + tuned body thump, layered
    const snBp = new Tone.Filter(2200, "bandpass").connect(bus);
    const snare = new Tone.NoiseSynth({
      noise: { type: "pink" }, envelope: { attack: 0.001, decay: 0.16, sustain: 0 },
    }).connect(snBp);
    snare.volume.value = -8;
    const snBody = new Tone.Synth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.001, decay: 0.09, sustain: 0 },
    }).connect(bus);
    snBody.volume.value = -14;

    const hatHp = new Tone.Filter(9000, "highpass").connect(bus);
    const hat = new Tone.NoiseSynth({
      noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.035, sustain: 0 },
    }).connect(hatHp);
    hat.volume.value = -20;

    // real recorded instruments: electric bass + piano (Tone.Sampler repitches)
    const bass = makeBassSampler().connect(bus);
    bass.volume.value = -5;

    const comp = makePianoSampler().connect(bus);
    comp.volume.value = -10;

    // rhythm guitars: electric through a switchable drive, acoustic clean
    const dist = new Tone.Distortion({ distortion: 0.7, oversample: "2x", wet: 0 }).connect(bus);
    const eguitar = makeElectricGuitarSampler().connect(dist);
    eguitar.volume.value = -9;
    const aguitar = makeAcousticGuitarSampler().connect(bus);
    aguitar.volume.value = -9;

    jam.current = { ...jam.current, built: true, kick, snare, snBody, hat, bass, comp, dist, eguitar, aguitar, bus, verb, limiter };
  }, []);

  const jamStep = useCallback((time) => {
    const J = jam.current;
    const { keyPc, prog, groove, grooveId } = jamCfg.current;
    const step = J.step;
    const bar = Math.floor(step / groove.steps) % prog.bars.length;
    const e = step % groove.steps;
    const chord = chordAt(keyPc, prog.bars[bar]);
    const hum = () => 0.85 + Math.random() * 0.15; // humanize velocities
    // comp voicing: 3rd + 7th (or 5th) two octaves up — the "shell"
    const root4 = chord.bass + 24;
    const shell = [
      midiName(root4 + chord.third),
      midiName(root4 + chord.seventh + (chord.seventh < chord.third ? 12 : 0)),
    ];
    const bnote = (semi, dur = "8n", vel = 0.9) =>
      J.bass.triggerAttackRelease(midiName(chord.bass + semi), dur, time, vel * hum());
    const boogie = chord.iv.includes(4) ? [0, 4, 7, 9] : [0, 3, 7, 10];
    // rhythm-guitar voicings in the E2 register
    const g3 = chord.bass + 12;
    const power = [midiName(g3), midiName(g3 + 7), midiName(g3 + 12)];
    const triad = [midiName(g3), midiName(g3 + chord.third), midiName(g3 + 7), midiName(g3 + 12)];
    const strum = (gtr, notes, dur, vel, spread = 0.014) =>
      notes.forEach((nn, i) => { try { gtr.triggerAttackRelease(nn, dur, time + i * spread, vel * hum()); } catch (err) {} });

    try {
      if (grooveId === "shuffle") {
        J.hat.triggerAttackRelease("32n", time, (e % 2 === 0 ? 0.9 : 0.5) * hum());
        if (e === 0 || e === 4) J.kick.triggerAttackRelease("C1", "8n", time, hum());
        if (e === 2 || e === 6) {
          J.snare.triggerAttackRelease("16n", time, 0.85 * hum());
          J.snBody.triggerAttackRelease("G2", "32n", time, 0.7);
        }
        if (e % 2 === 0) bnote(boogie[e / 2]);
        if (e === 2 || e === 6) J.comp.triggerAttackRelease(shell, "16n", time, 0.6 * hum());
      } else if (grooveId === "rock") {
        J.hat.triggerAttackRelease("32n", time, (e % 2 === 0 ? 0.95 : 0.55) * hum());
        if (e === 0 || e === 4 || e === 7) J.kick.triggerAttackRelease("C1", "8n", time, hum());
        if (e === 2 || e === 6) {
          J.snare.triggerAttackRelease("16n", time, 0.9 * hum());
          J.snBody.triggerAttackRelease("G2", "32n", time, 0.75);
        }
        if (e % 2 === 0) bnote(e === 6 ? chord.iv[2] : 0, "8n", 0.95); // driving roots, 5th at the turn
        // driven power chords: ring on the downbeat, tight chugs between
        if (e === 0) strum(J.eguitar, power, "2n", 0.85, 0.008);
        else if (e === 3 || e === 5) strum(J.eguitar, power.slice(0, 2), "16n", 0.55, 0.004);
      } else if (grooveId === "metal") {
        // gallop chug (8th + two 16ths per beat), kick shadowing the guitar
        const inGallop = e % 4 === 0 || e % 4 === 2 || e % 4 === 3;
        if (inGallop) {
          try { J.eguitar.triggerAttackRelease(midiName(g3), "32n", time, (e % 4 === 0 ? 0.9 : 0.6) * hum()); } catch (err) {}
          J.kick.triggerAttackRelease("C1", "16n", time, 0.9 * hum());
        }
        if (e === 0) strum(J.eguitar, power, "4n", 0.9, 0.006); // chord accent on the change
        if (e === 4 || e === 12) {
          J.snare.triggerAttackRelease("16n", time, 1 * hum());
          J.snBody.triggerAttackRelease("G2", "32n", time, 0.8);
        }
        if (e % 2 === 0) bnote(0, "16n", 0.95); // relentless root 8ths
      } else if (grooveId === "country") {
        // train beat: continuous brushed 16ths on the snare, accents on 2 & 4
        const accent = e === 4 || e === 12 ? 1 : e % 2 === 0 ? 0.4 : 0.28;
        J.snare.triggerAttackRelease("32n", time, accent * hum());
        if (e === 4 || e === 12) J.snBody.triggerAttackRelease("G2", "32n", time, 0.7);
        if (e === 0 || e === 8) J.kick.triggerAttackRelease("C1", "8n", time, hum());
        if (e === 0) bnote(0, "4n", 0.95);
        if (e === 8) bnote(chord.iv[2], "4n", 0.9); // root–5 alternation
        if (e === 14) bnote(chord.third, "16n", 0.7); // little walk into the next bar
        if (e === 4 || e === 12) strum(J.aguitar, triad, "8n", 0.55); // acoustic chop on the backbeat
      } else if (grooveId === "bluegrass") {
        // boom–chick, no drums — the guitar chop IS the snare in bluegrass
        if (e === 0 || e === 4) bnote(e === 0 ? 0 : chord.iv[2], "8n", 1);
        if (e === 2 || e === 6) strum(J.aguitar, triad, "16n", 0.75, 0.008);
        if (e === 7 && bar % 2 === 1) bnote(chord.third, "16n", 0.7); // walking run into the change
      } else if (grooveId === "slow128") {
        // 12/8: four beats of three triplet-eighths
        J.hat.triggerAttackRelease("32n", time, (e % 3 === 0 ? 0.85 : 0.4) * hum());
        if (e === 0) J.kick.triggerAttackRelease("C1", "8n", time, hum());
        if (e === 6) {
          J.snare.triggerAttackRelease("16n", time, 0.9 * hum());
          J.snBody.triggerAttackRelease("G2", "32n", time, 0.75);
        }
        if (e === 0) bnote(0, "2n", 0.95);
        if (e === 6) bnote(chord.iv[2], "4n", 0.85);
        if (e === 10) bnote(chord.third, "8n", 0.7);
        if (e === 3 || e === 9) J.comp.triggerAttackRelease(shell, "8n", time, 0.5 * hum());
      } else if (grooveId === "waltz") {
        // 3/4 boom–chick–chick
        J.hat.triggerAttackRelease("32n", time, (e % 2 === 0 ? 0.8 : 0.4) * hum());
        if (e === 0) J.kick.triggerAttackRelease("C1", "8n", time, hum());
        if (e === 2 || e === 4) {
          J.snare.triggerAttackRelease("16n", time, 0.65 * hum());
        }
        if (e === 0) bnote(bar % 2 === 0 ? 0 : chord.iv[2], "2n", 0.95);
        if (e === 2 || e === 4) strum(J.aguitar, triad, "8n", 0.5); // waltz strums on 2 & 3
      }
    } catch (err) {}

    if (e === 0) Tone.Draw.schedule(() => setJamBar(bar), time);
    J.step = (step + 1) % (groove.steps * prog.bars.length);
  }, []);

  const startJam = useCallback(async () => {
    unlockIOSAudio();
    await Tone.start();
    await ensureAudio();
    buildJamSynths();
    try { await Tone.loaded(); } catch (e) {} // sample fetch — first press only
    const groove = GROOVES[grooveKey];
    try { jam.current.dist.wet.value = groove.drive || 0; } catch (e) {}
    jam.current.step = 0;
    setJamBar(0);
    Tone.Transport.bpm.value = bpm;
    Tone.Transport.swing = groove.swing;
    Tone.Transport.swingSubdivision = "8n";
    jam.current.loopId = Tone.Transport.scheduleRepeat(jamStep, groove.sub);
    Tone.Transport.start("+0.06");
    setJamPlaying(true);
  }, [bpm, grooveKey, buildJamSynths, ensureAudio, jamStep]);

  const stopJam = useCallback(() => {
    Tone.Transport.stop();
    if (jam.current.loopId !== null) {
      Tone.Transport.clear(jam.current.loopId);
      jam.current.loopId = null;
    }
    jam.current.step = 0;
    setJamPlaying(false);
    setJamBar(0);
  }, []);

  useEffect(() => {
    if (jamPlaying) Tone.Transport.bpm.rampTo(bpm, 0.2);
  }, [bpm, jamPlaying]);

  // stop jam when leaving the tab; dispose on unmount
  useEffect(() => {
    if (tab !== "jam" && jamPlaying) stopJam();
  }, [tab, jamPlaying, stopJam]);

  // progression/groove swaps change the grid & subdivision — restart cleanly.
  // (key changes are safe to apply live; the step reads them from jamCfg)
  useEffect(() => {
    if (jamPlaying) stopJam();
    setJamBar(0);
    // eslint-disable-next-line
  }, [progKey, grooveKey]);

  // each style has its natural tempo — adopt it when the style changes
  useEffect(() => { setBpm(GROOVES[grooveKey].bpm); }, [grooveKey]);

  useEffect(() => {
    const t = timers.current;
    return () => {
      t.forEach(clearTimeout);
      Tone.Transport.stop();
      Tone.Transport.cancel();
      const J = jam.current;
      ["kick", "snare", "snBody", "hat", "bass", "comp", "dist", "eguitar", "aguitar", "bus", "verb", "limiter"].forEach((k) => {
        try { J[k]?.dispose(); } catch (e) {}
      });
      try { strumRef.current?.dispose(); } catch (e) {}
    };
  }, []);

  /* ---------------- explore renderer ---------------- */
  // CAGED windows: fret ranges (repeating every 12) for the selected shape
  const cagedWindows = (() => {
    if (cagedKey === "all") return null;
    const shape = CAGED_POS[cagedKey];
    const r = pc(rootPc - pc(tuning[5])); // fret of the root on the lowest string
    const start = ((r + shape.off) % 12 + 12) % 12;
    const wins = [];
    for (let s = start; s <= numFrets; s += 12) wins.push([s, Math.min(s + shape.w, numFrets)]);
    return wins;
  })();
  const inCaged = (f) => !cagedWindows || cagedWindows.some(([a, b]) => f >= a && f <= b);

  const exploreRenderer = useCallback((s, f, midi) => {
    const semi = pc(midi - rootPc);
    const inSet = activeIv.includes(semi);
    const isLast = lastPlayed && lastPlayed.s === s && lastPlayed.f === f;
    if (inSet) {
      if (!inCaged(f)) {
        // outside the chosen CAGED window: keep it visible but ghosted
        return { fill: "#1d1d24", ink: "#55555f", label: IV[semi].l, faint: true, glow: isLast };
      }
      const info = IV[semi];
      let label = info.l;
      if (displayMode === "notes") label = NOTES[pc(midi)];
      else if (displayMode === "degrees")
        label = viewMode === "arp" ? info.l : String(activeIv.indexOf(semi) + 1);
      return { fill: info.c, ink: info.k, label, ring: semi === 0, glow: isLast };
    }
    if (showAll)
      return { fill: "#1d1d24", ink: "#5d5d6a", label: NOTES[pc(midi)], faint: true, glow: isLast };
    if (isLast) return { fill: "#2a2a33", ink: "#9a9aa6", label: NOTES[pc(midi)], faint: true, glow: true };
    return null;
    // eslint-disable-next-line
  }, [rootPc, activeIv, viewMode, displayMode, showAll, lastPlayed, cagedKey, numFrets, tuningKey]);

  const handleExploreCell = useCallback((s, f, midi) => {
    playMidi(midi);
    setLastPlayed({ s, f });
    const t = setTimeout(() => setLastPlayed(null), 480);
    timers.current.push(t);
  }, [playMidi]);

  /* ---------------- jam renderer ---------------- */
  const jamGroove = GROOVES[grooveKey];
  const jamChord = chordAt(jamKey, jamProg.bars[Math.min(jamBar, jamProg.bars.length - 1)]);
  const safeScale = SCALES[jamProg.safe];
  const safePcs = safeScale.iv.map((i) => pc(jamKey + i));
  const jamRenderer = useCallback((s, f, midi) => {
    const semi = pc(midi - jamChord.rootPc);
    if (jamChord.iv.includes(semi)) {
      const info = IV[semi];
      return { fill: info.c, ink: info.k, label: info.l, ring: semi === 0, glow: semi === jamChord.third };
    }
    if (showSafe && safePcs.includes(pc(midi)))
      return { fill: "#1d2a2e", ink: "#4dd0c5", label: NOTES[pc(midi)], faint: true };
    return null;
    // eslint-disable-next-line
  }, [jamChord.rootPc, jamChord.iv, jamChord.third, showSafe, jamKey, progKey]);

  /* ---------------- quiz: spaced-repetition weighting ---------------- */
  const weightedPc = useCallback(() => {
    const miss = missRef.current;
    const weights = NOTES.map((n) => 1 + 3 * (miss[n] || 0));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < 12; i++) { r -= weights[i]; if (r < 0) return i; }
    return 11;
  }, []);

  const newRound = useCallback((mode) => {
    setFound(new Set());
    setWrongCell(null);
    setFeedback(null);
    setLocked(false);
    const maxF = Math.min(12, numFrets);
    const cellsWithPc = (p) => {
      const out = [];
      for (let s = 0; s < 6; s++)
        for (let f = 0; f <= maxF; f++)
          if (pc(tuning[s] + f) === p) out.push([s, f]);
      return out;
    };

    if (mode === "identify") {
      const p = weightedPc();
      const opts = cellsWithPc(p);
      const [s, f] = opts[rand(opts.length)];
      setRound({ mode, s, f, answer: NOTES[p] });
    } else if (mode === "interval") {
      const s = rand(6), f = rand(maxF + 1);
      let s2, f2;
      do { s2 = rand(6); f2 = rand(maxF + 1); } while (s2 === s && f2 === f);
      const semi = pc(tuning[s2] + f2 - (tuning[s] + f));
      setRound({ mode, s, f, s2, f2, answer: IV[semi].l });
    } else if (mode === "locate") {
      const p = weightedPc();
      const cells = new Set(cellsWithPc(p).map(([s, f]) => `${s}-${f}`));
      setRound({ mode, p, maxF, total: cells.size, cells, answer: NOTES[p] });
    } else if (mode === "nearest") {
      const types = [
        { suf: "", iv: [0, 4, 7] },
        { suf: "m", iv: [0, 3, 7] },
        { suf: "7", iv: [0, 4, 7, 10] },
      ];
      const type = types[rand(types.length)];
      const cRoot = rand(12);
      const chordPcs = type.iv.map((i) => pc(cRoot + i));
      let rs, rf;
      do { rs = rand(6); rf = rand(maxF + 1); }
      while (chordPcs.includes(pc(tuning[rs] + rf)));
      // all chord-tone cells + manhattan distance from reference
      let minD = Infinity;
      const dists = new Map();
      for (let s = 0; s < 6; s++)
        for (let f = 0; f <= maxF; f++)
          if (chordPcs.includes(pc(tuning[s] + f))) {
            const d = Math.abs(s - rs) + Math.abs(f - rf);
            dists.set(`${s}-${f}`, d);
            if (d < minD) minD = d;
          }
      const nearest = new Set(
        [...dists.entries()].filter(([, d]) => d === minD).map(([k]) => k)
      );
      const chordName = NOTES[cRoot] + type.suf;
      const toneNames = chordPcs.map((p) => NOTES[p]).join(" · ");
      setRound({
        mode, rs, rf, maxF, chordPcs, nearest, dists, minD,
        chordName, toneNames, revealed: false,
        answer: [...nearest].map((k) => {
          const [s, f] = k.split("-").map(Number);
          return NOTES[pc(tuning[s] + f)];
        })[0],
      });
    } else if (mode === "ear") {
      const base = 55 + rand(4);
      const semi = 1 + rand(11);
      setRound({ mode, base, semi, answer: IV[semi].l });
      const t = setTimeout(async () => {
        await ensureAudio();
        const now = Tone.now();
        try {
          synthRef.current.triggerAttack(midiName(base), now);
          synthRef.current.triggerAttack(midiName(base + semi), now + 0.62);
        } catch (e) {}
      }, 320);
      timers.current.push(t);
    }
  }, [numFrets, tuning, ensureAudio, weightedPc]);

  useEffect(() => {
    if (tab === "train") newRound(quizMode);
    // eslint-disable-next-line
  }, [tab, quizMode]);

  const scoreCorrect = () => {
    const ns = streak + 1;
    setStreak(ns);
    setBest((b) => Math.max(b, ns));
    setXp((x) => x + 12 + Math.min(ns, 8) * 3);
    setAnswered((a) => a + 1);
    setCorrect((c) => c + 1);
  };
  const scoreWrong = (noteKey) => {
    setStreak(0);
    setAnswered((a) => a + 1);
    if (noteKey) setMissByNote((m) => ({ ...m, [noteKey]: (m[noteKey] || 0) + 1 }));
  };

  const advance = (delay = 1150) => {
    const t = setTimeout(() => newRound(quizMode), delay);
    timers.current.push(t);
  };

  const submitAnswer = (value) => {
    if (locked || !round) return;
    setLocked(true);
    const ok = value === round.answer;
    if (ok) {
      scoreCorrect();
      setFeedback({ ok: true, text: "Nailed it" });
    } else {
      scoreWrong(quizMode === "identify" ? round.answer : null);
      setFeedback({ ok: false, text: `It was ${round.answer}` });
    }
    advance();
  };

  const handleQuizCell = (s, f, midi) => {
    if (locked || !round) return;
    const key = `${s}-${f}`;

    if (round.mode === "locate") {
      if (found.has(key)) return;
      if (pc(midi) === round.p) {
        playMidi(midi);
        const nf = new Set(found);
        nf.add(key);
        setFound(nf);
        setXp((x) => x + 6);
        if (nf.size === round.total) {
          setLocked(true);
          scoreCorrect();
          setXp((x) => x + 20);
          setFeedback({ ok: true, text: `All ${round.total} found` });
          advance();
        }
      } else {
        setStreak(0);
        setMissByNote((m) => ({ ...m, [round.answer]: (m[round.answer] || 0) + 1 }));
        setWrongCell(key);
        const t = setTimeout(() => setWrongCell(null), 420);
        timers.current.push(t);
      }
      return;
    }

    if (round.mode === "nearest") {
      if (key === `${round.rs}-${round.rf}`) return;
      setLocked(true);
      setRound((prev) => ({ ...prev, revealed: true }));
      const isCT = round.chordPcs.includes(pc(midi));
      if (round.nearest.has(key)) {
        playMidi(midi);
        scoreCorrect();
        setFeedback({ ok: true, text: `${NOTES[pc(midi)]} — closest chord tone, ${round.minD} step${round.minD === 1 ? "" : "s"} away` });
      } else if (isCT && f <= round.maxF) {
        scoreWrong(null);
        setFeedback({ ok: false, text: `Chord tone, but a closer one was only ${round.minD} away — shown in green` });
      } else {
        scoreWrong(null);
        setFeedback({ ok: false, text: `Not in ${round.chordName} — nearest shown in green` });
      }
      advance(1900);
    }
  };

  const replayEar = async () => {
    if (!round || round.mode !== "ear") return;
    await ensureAudio();
    const now = Tone.now();
    try {
      synthRef.current.triggerAttack(midiName(round.base), now);
      synthRef.current.triggerAttack(midiName(round.base + round.semi), now + 0.62);
    } catch (e) {}
  };

  /* ---------------- quiz renderer ---------------- */
  const quizRenderer = useCallback((s, f, midi) => {
    if (!round) return null;
    const key = `${s}-${f}`;
    if (round.mode === "identify") {
      if (s === round.s && f === round.f)
        return { fill: "#7c6cff", ink: "#fff", label: "?", glow: true };
      return { fill: "#1c1c23", ink: "#4a4a55", label: "", faint: true };
    }
    if (round.mode === "interval") {
      if (s === round.s && f === round.f)
        return { fill: IV[0].c, ink: "#fff", label: "R", ring: true };
      if (s === round.s2 && f === round.f2)
        return { fill: "#7c6cff", ink: "#fff", label: "?", glow: true };
      return { fill: "#1c1c23", ink: "#4a4a55", label: "", faint: true };
    }
    if (round.mode === "locate") {
      if (wrongCell === key) return { fill: "#ff2e4d", ink: "#fff", label: "✕" };
      if (found.has(key)) return { fill: "#22c55e", ink: "#04210f", label: NOTES[pc(midi)] };
      if (f > round.maxF) return null;
      return { fill: "#222229", ink: "#3c3c46", label: "", faint: true };
    }
    if (round.mode === "nearest") {
      if (key === `${round.rs}-${round.rf}`)
        return { fill: "#7c6cff", ink: "#fff", label: "★", glow: true };
      if (round.revealed) {
        if (round.nearest.has(key))
          return { fill: "#22c55e", ink: "#04210f", label: NOTES[pc(midi)], ring: true };
        if (round.chordPcs.includes(pc(midi)) && f <= round.maxF)
          return { fill: "#2a2a33", ink: "#8a8a96", label: NOTES[pc(midi)], faint: true };
        return null;
      }
      if (f > round.maxF) return null;
      return { fill: "#222229", ink: "#3c3c46", label: "", faint: true };
    }
    return null;
  }, [round, found, wrongCell]);

  const resetProgress = () => {
    setXp(0); setStreak(0); setBest(0); setAnswered(0);
    setCorrect(0); setMissByNote({}); prevLevel.current = 1;
  };

  const weak = Object.entries(missByNote).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const activeNotes = activeIv.map((i) => NOTES[pc(rootPc + i)]);
  const nextChord = chordAt(jamKey, jamProg.bars[(jamBar + 1) % jamProg.bars.length]);

  return (
    <div className={`min-h-screen w-full text-zinc-200 ${theme === "light" ? "bs-light" : ""}`} style={{
      fontFamily: "'DM Sans',ui-sans-serif,system-ui,sans-serif",
      touchAction: "manipulation",
      background: "radial-gradient(900px 600px at 12% -5%,rgba(34,227,216,0.10),transparent 60%)," +
        "radial-gradient(900px 700px at 95% 0%,rgba(124,108,255,0.12),transparent 55%),#08080b",
      ...(theme === "light" ? { filter: "invert(0.94) hue-rotate(180deg)", colorScheme: "light" } : {}),
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap');
        .display{font-family:'Bricolage Grotesque',ui-sans-serif,sans-serif;}
        .mono{font-family:'JetBrains Mono',ui-monospace,monospace;}
        .bs-pulse{animation:bsp 1.1s ease-in-out infinite;}
        @keyframes bsp{0%,100%{opacity:.85;}50%{opacity:.15;}}
        .bs-up{animation:bsu .5s cubic-bezier(.2,.8,.2,1) both;}
        @keyframes bsu{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
        .bs-shine{background-size:200% 100%;animation:bss 2.4s linear infinite;}
        @keyframes bss{to{background-position:-200% 0;}}
        .bs-beat{animation:bsb .3s ease-out;}
        @keyframes bsb{0%{transform:scale(1.12);}100%{transform:scale(1);}}
        input[type=range]{accent-color:#7c6cff;}
        .bs-light img,.bs-light video{filter:invert(1.064) hue-rotate(180deg);}
      `}</style>

      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-5">

        {/* ---------- header ---------- */}
        <header className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center display font-extrabold text-2xl text-black"
              style={{ background: "linear-gradient(135deg,#22e3d8,#7c6cff)",
                boxShadow: "0 0 24px rgba(124,108,255,0.5)" }}>
              B<span style={{ fontSize: 13, marginLeft: -1 }}>♯</span>
            </div>
            <div>
              <h1 className="display font-extrabold text-xl leading-none tracking-tight">B SHARP</h1>
              <p className="mono text-[10px] tracking-[0.22em] text-zinc-500 mt-1">
                FRETBOARD INTELLIGENCE
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="mono text-[10px] text-zinc-500">LEVEL</div>
              <div className="display font-bold text-lg leading-none">{level}</div>
            </div>
            <div className="w-32">
              <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bs-shine rounded-full" style={{
                  width: `${(xpInLevel / 120) * 100}%`,
                  background: "linear-gradient(90deg,#22e3d8,#7c6cff,#22e3d8)",
                }} />
              </div>
              <div className="mono text-[9px] text-zinc-500 mt-1">{xp} XP</div>
            </div>
            <div className="flex items-center gap-2 pl-3 border-l border-white/10">
              <button onClick={openSettings} title="Settings & profile" aria-label="Settings and profile"
                className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden hover:border-cyan-400/40 transition-colors">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User size={14} className={isGuest ? "text-zinc-500" : "text-cyan-300"} />
                )}
              </button>
              <div className="hidden sm:block max-w-28">
                <div className="mono text-[9px] text-zinc-500">{isGuest ? "GUEST" : "SYNCED"}</div>
                <div className="text-xs text-white leading-tight truncate">
                  {isGuest ? "this device" : username}
                </div>
              </div>
              {isGuest ? (
                <button onClick={onSignIn}
                  className="mono text-[10px] px-2.5 py-2 rounded-lg border border-cyan-400/40 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20 transition-colors">
                  Sign in
                </button>
              ) : (
                <button onClick={openSettings} title="Settings & profile" aria-label="Settings and profile"
                  className="p-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white transition-colors">
                  <Settings size={13} />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ---------- tabs ---------- */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {[
            { v: "explore", l: "Explore", icon: Guitar },
            { v: "chords", l: "Chords", icon: LayoutGrid },
            { v: "jam", l: "Jam", icon: Radio },
            { v: "train", l: "Train", icon: Target },
            { v: "social", l: "Social", icon: Users },
            { v: "ideas", l: "Ideas", icon: Lightbulb },
            { v: "create", l: "Create", icon: Clapperboard },
            { v: "theory", l: "Theory", icon: BookOpen },
          ].map((t) => {
            const Icon = t.icon;
            const active = tab === t.v;
            return (
              <button key={t.v} onClick={() => setTab(t.v)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all display font-semibold ${
                  active ? "border-white/20 text-white" : "border-white/8 text-zinc-500 hover:text-zinc-300"
                }`}
                style={active ? {
                  background: "linear-gradient(135deg,rgba(34,227,216,0.16),rgba(124,108,255,0.16))",
                  boxShadow: "0 0 22px rgba(124,108,255,0.18)",
                } : { background: "rgba(255,255,255,0.02)" }}>
                <Icon size={16} /> {t.l}
              </button>
            );
          })}
        </div>

        {/* ===================== EXPLORE ===================== */}
        {tab === "explore" && (
          <div className="bs-up grid lg:grid-cols-[1fr_300px] gap-4">
            <div className="space-y-4 min-w-0">
              <Panel className="p-4">
                <div className="flex flex-wrap gap-x-6 gap-y-3 items-end">
                  <div className="min-w-0 max-w-full">
                    <div className="mono text-[10px] text-zinc-500 mb-1.5">ROOT</div>
                    <div className="flex flex-wrap gap-1">
                      {NOTES.map((n, i) => (
                        <button key={n} onClick={() => setRootPc(i)}
                          className={`mono text-xs w-9 h-9 rounded-lg transition-all ${
                            rootPc === i ? "text-black font-bold" : "bg-white/5 text-zinc-400 hover:bg-white/10"
                          }`}
                          style={rootPc === i ? { background: "#ff2e4d" } : {}}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mono text-[10px] text-zinc-500 mb-1.5">VIEW</div>
                    <Seg value={viewMode} onChange={setViewMode} options={[
                      { v: "scale", l: "Scale" },
                      { v: "arp", l: "Arpeggio" },
                    ]} />
                  </div>
                  {viewMode === "scale" ? (
                    <div>
                      <div className="mono text-[10px] text-zinc-500 mb-1.5">SCALE</div>
                      <select value={scaleKey} onChange={(e) => setScaleKey(e.target.value)}
                        className="mono text-xs bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-white outline-none">
                        {SCALE_GROUPS.map((g) => (
                          <optgroup key={g} label={g}>
                            {Object.entries(SCALES).filter(([, v]) => v.grp === g).map(([k, v]) => (
                              <option key={k} value={k}>{v.name}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <div className="mono text-[10px] text-zinc-500 mb-1.5">ARPEGGIO</div>
                      <select value={arpKey} onChange={(e) => setArpKey(e.target.value)}
                        className="mono text-xs bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-white outline-none">
                        {Object.entries(ARPS).map(([k, v]) => (
                          <option key={k} value={k}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <div className="mono text-[10px] text-zinc-500 mb-1.5">TUNING</div>
                    <select value={tuningKey} onChange={(e) => setTuningKey(e.target.value)}
                      className="mono text-xs bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-white outline-none">
                      {Object.entries(TUNINGS).map(([k, v]) => (
                        <option key={k} value={k}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-6 gap-y-3 items-end mt-4 pt-4 border-t border-white/8">
                  <div>
                    <div className="mono text-[10px] text-zinc-500 mb-1.5">LABELS</div>
                    <Seg value={displayMode} onChange={setDisplayMode} options={[
                      { v: "intervals", l: "Intervals" },
                      { v: "notes", l: "Notes" },
                      { v: "degrees", l: "Degrees" },
                    ]} />
                  </div>
                  <div>
                    <div className="mono text-[10px] text-zinc-500 mb-1.5">FRETS</div>
                    <Seg value={numFrets} onChange={setNumFrets}
                      options={FRET_OPTS.map((f) => ({ v: f, l: String(f) }))} />
                  </div>
                  <div>
                    <div className="mono text-[10px] text-zinc-500 mb-1.5">CAGED POSITION</div>
                    <Seg value={cagedKey} onChange={setCagedKey} options={[
                      { v: "all", l: "Full neck" },
                      ...Object.keys(CAGED_POS).map((k) => ({ v: k, l: k })),
                    ]} />
                  </div>
                  <button onClick={() => setShowAll((v) => !v)}
                    className={`mono text-xs px-3 py-2.5 rounded-lg border transition-colors ${
                      showAll ? "border-cyan-400/40 text-cyan-300 bg-cyan-400/10" : "border-white/10 text-zinc-400"
                    }`}>
                    {showAll ? "All notes on" : "Scale only"}
                  </button>
                  <button onClick={() => setLefty((v) => !v)}
                    className="mono text-xs px-3 py-2.5 rounded-lg border border-white/10 text-zinc-400 hover:text-white">
                    {lefty ? "Left-handed" : "Right-handed"}
                  </button>
                  <button onClick={playScale}
                    className="ml-auto flex items-center gap-2 mono text-xs px-4 py-2.5 rounded-lg text-black font-bold"
                    style={{ background: "linear-gradient(135deg,#22e3d8,#7c6cff)" }}>
                    <Play size={13} /> Hear it
                  </button>
                </div>
              </Panel>

              <Panel className="p-2 sm:p-4">
                <Fretboard tuning={tuning} numFrets={numFrets} leftHanded={lefty}
                  interactive onCell={handleExploreCell} cellRenderer={exploreRenderer}
                  bands={cagedWindows || []} />
                {cagedKey !== "all" && (
                  <p className="mono text-[10px] text-zinc-500 mt-2 px-2 pb-2 sm:px-0 sm:pb-0">
                    {`${cagedKey} shape · frets ${cagedWindows.map(([a, b]) => `${a}–${b}`).join(" & ")} · roots on the ${CAGED_POS[cagedKey].roots}`}
                  </p>
                )}
              </Panel>

              <Panel className="p-3">
                <div className="flex flex-wrap gap-2">
                  {activeIv.map((semi) => (
                    <div key={semi} className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full inline-block"
                        style={{ background: IV[semi].c }} />
                      <span className="mono text-[11px] text-zinc-400">{IV[semi].l}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>

            {/* profile panel */}
            <Panel className="p-5 h-fit">
              <div className="flex items-center gap-2 text-cyan-300 mb-1">
                {viewMode === "arp" ? <Layers size={15} /> : <Music size={15} />}
                <span className="mono text-[10px] tracking-widest">
                  {viewMode === "arp" ? "ARPEGGIO PROFILE" : "SCALE PROFILE"}
                </span>
              </div>
              <h2 className="display font-extrabold text-2xl leading-tight">
                {viewMode === "arp"
                  ? `${NOTES[rootPc]}${arp.suf}`
                  : `${NOTES[rootPc]} ${scale.name}`}
              </h2>
              <p className="mono text-[11px] text-zinc-500 mb-4">
                {viewMode === "arp" ? arp.name : scale.tag}
              </p>

              {(viewMode === "arp"
                ? [
                    ["Chord tones", activeNotes.join("  ·  ")],
                    ["Formula", arp.iv.map((i) => IV[i].l).join("  ")],
                    ["Why it matters", arp.tip],
                  ]
                : [
                    ["Notes", activeNotes.join("  ·  ")],
                    ["Formula", scale.iv.map((i) => IV[i].l).join("  ")],
                    ["Character", scale.char],
                    ["Common in", scale.gen],
                    ["Hear it in", scale.song],
                  ]
              ).map(([k, v]) => (
                <div key={k} className="py-2.5 border-b border-white/8 last:border-0">
                  <div className="mono text-[10px] text-zinc-500">{k.toUpperCase()}</div>
                  <div className={`mt-0.5 ${k === "Notes" || k === "Formula" || k === "Chord tones"
                    ? "mono text-sm text-white" : "text-sm text-zinc-300"}`}>{v}</div>
                </div>
              ))}

              <div className="mt-4 rounded-xl p-3 bg-white/[0.03] border border-white/8">
                <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                  <Sparkles size={12} />
                  <span className="mono text-[10px]">PRACTICE TIP</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {viewMode === "arp"
                    ? <>Play the arpeggio slowly on one string pair, then jump to the <span className="text-blue-400 font-semibold">same tones</span> in the next position. That's voice leading in miniature.</>
                    : <>Find every <span className="text-red-400 font-semibold">root</span> first, then the <span className="text-emerald-400 font-semibold">5th</span> — those two anchor every position. Solo by targeting them on strong beats.</>}
                </p>
              </div>
            </Panel>
          </div>
        )}

        {/* ===================== CHORDS ===================== */}
        {tab === "chords" && (
          <div className="bs-up grid lg:grid-cols-[1fr_300px] gap-4">
            <div className="space-y-4 min-w-0">
              <Panel className="p-3 sm:p-4">
                <div className="flex flex-wrap gap-x-6 gap-y-3 items-end">
                  <div className="min-w-0 max-w-full">
                    <div className="mono text-[10px] text-zinc-500 mb-1.5">ROOT</div>
                    <div className="flex flex-wrap gap-1">
                      {NOTES.map((n, i) => (
                        <button key={n} onClick={() => setChordRoot(i)}
                          className={`mono text-xs w-9 h-9 rounded-lg transition-all ${
                            chordRoot === i ? "text-black font-bold" : "bg-white/5 text-zinc-400 hover:bg-white/10"
                          }`}
                          style={chordRoot === i ? { background: "#ff2e4d" } : {}}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mono text-[10px] text-zinc-500 mb-1.5">CHORD TYPE</div>
                    <select value={chordType} onChange={(e) => setChordType(e.target.value)}
                      className="mono text-xs bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-white outline-none">
                      {CHORD_GROUPS.map((g) => (
                        <optgroup key={g} label={g}>
                          {Object.entries(CHORD_LIB).filter(([, v]) => v.grp === g).map(([k, v]) => (
                            <option key={k} value={k}>{v.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </div>
              </Panel>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.keys(CHORD_LIB[chordType].forms).map((form) => (
                  <ChordDiagram key={form} rootPc={chordRoot} quality={CHORD_LIB[chordType]}
                    form={form} onStrum={strumChord} />
                ))}
              </div>
              <p className="mono text-[10px] text-zinc-500">Tap a diagram to hear it</p>
            </div>

            {/* chord profile */}
            <Panel className="p-5 h-fit">
              <div className="flex items-center gap-2 text-cyan-300 mb-1">
                <LayoutGrid size={15} />
                <span className="mono text-[10px] tracking-widest">CHORD PROFILE</span>
              </div>
              <h2 className="display font-extrabold text-2xl leading-tight">
                {NOTES[chordRoot]}{CHORD_LIB[chordType].suf}
              </h2>
              <p className="mono text-[11px] text-zinc-500 mb-4">{CHORD_LIB[chordType].name}</p>

              {[
                ["Formula", CHORD_LIB[chordType].formula],
                ["Notes", CHORD_LIB[chordType].iv.map((i) => NOTES[pc(chordRoot + i)]).join("  ·  ")],
                ["Sound & use", CHORD_LIB[chordType].info],
              ].map(([k, v]) => (
                <div key={k} className="py-2.5 border-b border-white/8 last:border-0">
                  <div className="mono text-[10px] text-zinc-500">{k.toUpperCase()}</div>
                  <div className={`mt-0.5 ${k !== "Sound & use" ? "mono text-sm text-white" : "text-sm text-zinc-300"}`}>{v}</div>
                </div>
              ))}

              <div className="mt-4 rounded-xl p-3 bg-white/[0.03] border border-white/8">
                <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                  <Sparkles size={12} />
                  <span className="mono text-[10px]">DOT COLOURS</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Same colour code as the fretboard: <span className="text-red-400 font-semibold">root in red</span>,
                  every other dot labelled with its interval. Extended tones show their compound
                  names — 9, 11, 13 — see the Theory tab for why.
                </p>
              </div>
            </Panel>
          </div>
        )}

        {/* ===================== JAM ===================== */}
        {tab === "jam" && (
          <div className="bs-up space-y-4">
            {/* transport + guide */}
            <div className="grid lg:grid-cols-[1fr_300px] gap-4">
              <div className="space-y-4 min-w-0">
                <Panel className="p-3 sm:p-4">
                  <div className="flex flex-wrap gap-x-6 gap-y-3 items-end">
                    <div className="min-w-0 max-w-full">
                      <div className="mono text-[10px] text-zinc-500 mb-1.5">KEY</div>
                      <div className="flex flex-wrap gap-1">
                        {NOTES.map((n, i) => (
                          <button key={n} onClick={() => setJamKey(i)}
                            className={`mono text-xs w-9 h-9 rounded-lg transition-all ${
                              jamKey === i ? "text-black font-bold" : "bg-white/5 text-zinc-400 hover:bg-white/10"
                            }`}
                            style={jamKey === i ? { background: "#ff2e4d" } : {}}>
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="mono text-[10px] text-zinc-500 mb-1.5">PROGRESSION</div>
                      <select value={progKey} onChange={(e) => setProgKey(e.target.value)}
                        className="mono text-xs bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-white outline-none">
                        {Object.entries(PROGRESSIONS).map(([k, v]) => (
                          <option key={k} value={k}>{v.name}</option>
                        ))}
                        <option value="custom">Custom — build your own</option>
                      </select>
                    </div>
                    <div>
                      <div className="mono text-[10px] text-zinc-500 mb-1.5">GROOVE</div>
                      <select value={grooveKey} onChange={(e) => setGrooveKey(e.target.value)}
                        className="mono text-xs bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-white outline-none">
                        {Object.entries(GROOVES).map(([k, v]) => (
                          <option key={k} value={k}>{v.name} · {v.sig}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap mt-4 pt-4 border-t border-white/8">
                    <button onClick={jamPlaying ? stopJam : startJam}
                      className="flex items-center gap-2 display font-bold text-sm px-5 py-3 rounded-xl text-black"
                      style={{ background: jamPlaying
                        ? "linear-gradient(135deg,#ff2e4d,#ff7a2f)"
                        : "linear-gradient(135deg,#22e3d8,#7c6cff)",
                        boxShadow: "0 0 22px rgba(124,108,255,0.35)" }}>
                      {jamPlaying ? <Square size={15} /> : <Play size={15} />}
                      {jamPlaying ? "Stop" : `Play ${NOTES[jamKey]} ${jamProg.name}`}
                    </button>
                    <div className="flex items-center gap-3 flex-1 min-w-44">
                      <span className="mono text-[10px] text-zinc-500">BPM</span>
                      <input type="range" min="50" max="180" value={bpm}
                        onChange={(e) => setBpm(Number(e.target.value))}
                        className="flex-1" />
                      <span className="mono text-sm text-white w-8 text-right">{bpm}</span>
                    </div>
                    <button onClick={() => setShowSafe((v) => !v)}
                      className={`mono text-xs px-3 py-2.5 rounded-lg border transition-colors ${
                        showSafe ? "border-cyan-400/40 text-cyan-300 bg-cyan-400/10" : "border-white/10 text-zinc-400"
                      }`}>
                      {showSafe ? "Safe notes on" : "Chord tones only"}
                    </button>
                  </div>

                  {/* custom progression builder */}
                  {progKey === "custom" && (
                    <div className="mt-4 pt-4 border-t border-white/8">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                        <div className="mono text-[10px] text-zinc-500">
                          NASHVILLE NUMBERS IN {NOTES[jamKey]} — drag into a bar, or tap a number then tap bars
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="mono text-[10px] text-zinc-500">BARS</span>
                          <Seg value={customBars.length} onChange={(n) => {
                            setCustomBars((prev) => {
                              const next = prev.slice(0, n);
                              while (next.length < n) next.push(null);
                              return next;
                            });
                          }} options={[{ v: 4, l: "4" }, { v: 8, l: "8" }, { v: 12, l: "12" }]} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {NASHVILLE.map((ch, i) => {
                          const name = chordAt(jamKey, [ch.d, ch.q]).name;
                          const sel = selectedChip === i;
                          return (
                            <button key={ch.l} draggable
                              onDragStart={(ev) => ev.dataTransfer.setData("text/plain", String(i))}
                              onClick={() => setSelectedChip(sel ? null : i)}
                              className={`rounded-lg px-2.5 py-1.5 border text-center transition-all cursor-grab active:cursor-grabbing ${
                                sel ? "border-cyan-300 bg-cyan-400/20" : "border-white/10 bg-white/5 hover:bg-white/10"
                              }`}>
                              <div className={`display font-bold text-sm leading-none ${sel ? "text-cyan-200" : "text-white"}`}>{ch.l}</div>
                              <div className="mono text-[9px] text-zinc-500 mt-0.5">{name}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* bar grid (editable slots when custom) */}
                  <div className={`grid gap-1.5 mt-4 ${
                    (progKey === "custom" ? customBars : jamProg.bars).length > 4
                      ? "grid-cols-4 sm:grid-cols-6 lg:grid-cols-12"
                      : "grid-cols-4"
                  }`}>
                    {(progKey === "custom" ? customBars : jamProg.bars).map((b, i) => {
                      const cur = jamPlaying && i === jamBar;
                      const isCustom = progKey === "custom";
                      const eff = isCustom ? filledCustom[i] : b;
                      const c = eff ? chordAt(jamKey, eff) : null;
                      const carried = isCustom && !b;
                      const place = (chipIdx) => {
                        const ch = NASHVILLE[chipIdx];
                        if (!ch) return;
                        setCustomBars((prev) => prev.map((x, j) => (j === i ? [ch.d, ch.q] : x)));
                      };
                      return (
                        <div key={i}
                          onDragOver={isCustom ? (ev) => ev.preventDefault() : undefined}
                          onDrop={isCustom ? (ev) => { ev.preventDefault(); place(Number(ev.dataTransfer.getData("text/plain"))); } : undefined}
                          onClick={isCustom && selectedChip !== null ? () => place(selectedChip) : undefined}
                          className={`relative rounded-lg py-2 text-center border transition-all ${cur ? "bs-beat" : ""} ${
                            isCustom ? "cursor-pointer" : ""
                          } ${isCustom && selectedChip !== null ? "border-dashed" : ""}`}
                          style={cur ? {
                            background: "linear-gradient(135deg,rgba(34,227,216,0.28),rgba(124,108,255,0.28))",
                            borderColor: "rgba(255,255,255,0.3)",
                            boxShadow: "0 0 16px rgba(124,108,255,0.4)",
                          } : {
                            background: "rgba(255,255,255,0.03)",
                            borderColor: isCustom && selectedChip !== null ? "rgba(34,227,216,0.4)" : "rgba(255,255,255,0.07)",
                          }}>
                          <div className="mono text-[9px] text-zinc-500">{i + 1}</div>
                          <div className={`display font-bold text-sm ${cur ? "text-white" : carried ? "text-zinc-600" : "text-zinc-400"}`}>
                            {c ? c.name : "+"}
                          </div>
                          {isCustom && b && (
                            <button onClick={(ev) => { ev.stopPropagation(); setCustomBars((prev) => prev.map((x, j) => (j === i ? null : x))); }}
                              className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-black border border-white/20 text-zinc-500 hover:text-white text-[9px] leading-none"
                              title="Clear bar" aria-label="Clear bar">×</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {progKey === "custom" && (
                    <p className="mono text-[10px] text-zinc-500 mt-2">
                      Faded chords are carried over from the previous bar · × clears a bar · saved on this device
                    </p>
                  )}
                </Panel>

                <Panel className="p-2 sm:p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-1 px-2 pt-2 sm:px-0 sm:pt-0">
                    <div className="flex items-center gap-2">
                      <span className="mono text-[10px] text-zinc-500">NOW:</span>
                      <span className="display font-extrabold text-xl text-white">{jamChord.name}</span>
                      <span className="mono text-[11px] text-zinc-500">→ next: {nextChord.name}</span>
                    </div>
                  </div>
                  <Fretboard tuning={tuning} numFrets={numFrets} leftHanded={lefty}
                    interactive onCell={handleExploreCell} cellRenderer={jamRenderer} />
                </Panel>
              </div>

              {/* guide */}
              <Panel className="p-5 h-fit">
                <div className="flex items-center gap-2 text-cyan-300 mb-1">
                  <Radio size={15} />
                  <span className="mono text-[10px] tracking-widest">JAM GUIDE</span>
                </div>
                <h2 className="display font-extrabold text-2xl leading-tight">{jamChord.name}</h2>
                <p className="mono text-[11px] text-zinc-500 mb-4">
                  bar {jamBar + 1} of {jamProg.bars.length} · {jamGroove.name.toLowerCase()} · {jamGroove.sig}
                </p>

                {[
                  ["Chord tones", jamChord.tones],
                  ["Scale to use", `${NOTES[jamChord.rootPc]} ${jamChord.scaleHint}`],
                  ["Target note", `${jamChord.thirdName} — the 3rd. Land on it when the chord hits.`],
                  ["Always safe", `${NOTES[jamKey]} ${safeScale.name} works over the whole form`],
                ].map(([k, v]) => (
                  <div key={k} className="py-2.5 border-b border-white/8 last:border-0">
                    <div className="mono text-[10px] text-zinc-500">{k.toUpperCase()}</div>
                    <div className={`mt-0.5 ${k === "Chord tones" ? "mono text-sm text-white" : "text-sm text-zinc-300"}`}>{v}</div>
                  </div>
                ))}

                <div className="mt-4 rounded-xl p-3 bg-white/[0.03] border border-white/8">
                  <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                    <Sparkles size={12} />
                    <span className="mono text-[10px]">PLAYING THE CHANGES</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">{jamProg.tip}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed mt-2">
                    In numbers this is <span className="mono text-cyan-300">{jamProg.nums}</span> — same
                    shape in every key. Switch keys above and watch the chords move together.
                  </p>
                </div>
              </Panel>
            </div>
          </div>
        )}

        {/* ===================== TRAIN ===================== */}
        {tab === "train" && (
          <div className="bs-up space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Flame, l: "Streak", v: streak, c: "#fb923c" },
                { icon: Award, l: "Best", v: best, c: "#7c6cff" },
                { icon: Activity, l: "Accuracy", v: `${accuracy}%`, c: "#22e3d8" },
                { icon: Zap, l: "Answered", v: answered, c: "#22c55e" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <Panel key={s.l} className="p-3.5">
                    <div className="flex items-center gap-1.5 mb-1" style={{ color: s.c }}>
                      <Icon size={13} />
                      <span className="mono text-[10px] text-zinc-500">{s.l.toUpperCase()}</span>
                    </div>
                    <div className="display font-extrabold text-2xl">{s.v}</div>
                  </Panel>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { v: "identify", l: "Name the Note", icon: Target },
                { v: "interval", l: "Interval ID", icon: Zap },
                { v: "locate", l: "Find All", icon: Brain },
                { v: "nearest", l: "Nearest Chord Tone", icon: Crosshair },
                { v: "ear", l: "Ear Training", icon: Ear },
              ].map((m) => {
                const Icon = m.icon;
                const active = quizMode === m.v;
                return (
                  <button key={m.v} onClick={() => setQuizMode(m.v)}
                    className={`flex items-center gap-2 mono text-xs px-3.5 py-2.5 rounded-xl border transition-all ${
                      active ? "border-white/20 text-white" : "border-white/8 text-zinc-500 hover:text-zinc-300"
                    }`}
                    style={active ? { background: "linear-gradient(135deg,rgba(34,227,216,0.16),rgba(124,108,255,0.16))" } : {}}>
                    <Icon size={14} /> {m.l}
                  </button>
                );
              })}
            </div>

            <Panel className="p-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="mono text-[10px] text-zinc-500 mb-1">CHALLENGE</div>
                  <h3 className="display font-bold text-lg">
                    {round?.mode === "identify" && "Which note is highlighted?"}
                    {round?.mode === "interval" && "Interval from the root (R) to the ?"}
                    {round?.mode === "locate" && (
                      <>Find every <span className="text-cyan-300">{round.answer}</span> — {found.size}/{round.total}</>
                    )}
                    {round?.mode === "nearest" && (
                      <>From the ★, tap the nearest <span className="text-cyan-300">{round.chordName}</span> chord tone
                        <span className="mono text-xs text-zinc-500 font-normal"> ({round.toneNames})</span></>
                    )}
                    {round?.mode === "ear" && "Identify the interval you hear"}
                  </h3>
                </div>
                <div className="flex gap-2">
                  {round?.mode === "ear" && (
                    <button onClick={replayEar}
                      className="flex items-center gap-2 mono text-xs px-4 py-2.5 rounded-lg text-black font-bold"
                      style={{ background: "linear-gradient(135deg,#22e3d8,#7c6cff)" }}>
                      <Volume2 size={13} /> Replay
                    </button>
                  )}
                  <button onClick={() => newRound(quizMode)}
                    className="flex items-center gap-2 mono text-xs px-3 py-2.5 rounded-lg border border-white/10 text-zinc-400 hover:text-white">
                    <RotateCcw size={13} /> Skip
                  </button>
                </div>
              </div>

              {feedback && (
                <div className={`mt-3 inline-flex items-center gap-2 mono text-xs px-3 py-1.5 rounded-lg bs-up ${
                  feedback.ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
                }`}>
                  {feedback.ok ? <Check size={13} /> : <X size={13} />} {feedback.text}
                </div>
              )}

              {round && round.mode !== "ear" && (
                <div className="mt-4">
                  <Fretboard tuning={tuning} numFrets={numFrets} leftHanded={lefty}
                    interactive={round.mode === "locate" || round.mode === "nearest"}
                    onCell={handleQuizCell} cellRenderer={quizRenderer} />
                </div>
              )}

              {round && round.mode === "ear" && (
                <div className="mt-4 flex items-center justify-center py-8">
                  <div className="w-24 h-24 rounded-full flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg,rgba(34,227,216,0.18),rgba(124,108,255,0.18))",
                      border: "1px solid rgba(255,255,255,0.12)" }}>
                    <Ear size={40} className="text-cyan-300" />
                  </div>
                </div>
              )}

              {round && round.mode === "identify" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {NOTES.map((n) => (
                    <button key={n} disabled={locked} onClick={() => submitAnswer(n)}
                      className="mono text-sm w-12 h-12 rounded-lg bg-white/5 border border-white/10 text-zinc-200 hover:bg-white/10 disabled:opacity-40 transition-colors">
                      {n}
                    </button>
                  ))}
                </div>
              )}
              {round && (round.mode === "interval" || round.mode === "ear") && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {IV.map((iv) => (
                    <button key={iv.l} disabled={locked} onClick={() => submitAnswer(iv.l)}
                      className="mono text-sm px-3 h-12 min-w-12 rounded-lg border text-zinc-200 hover:opacity-80 disabled:opacity-40 transition-all"
                      style={{ background: `${iv.c}22`, borderColor: `${iv.c}55` }}>
                      {iv.l}
                    </button>
                  ))}
                </div>
              )}
              {round && round.mode === "locate" && (
                <p className="mono text-[11px] text-zinc-500 mt-3">
                  Tap each matching note on the board (frets 0–{round.maxF})
                </p>
              )}
              {round && round.mode === "nearest" && !round.revealed && (
                <p className="mono text-[11px] text-zinc-500 mt-3">
                  Nearest = fewest strings + frets away · frets 0–{round.maxF}
                </p>
              )}
            </Panel>

            {weak.length > 0 && (
              <Panel className="p-4">
                <div className="flex items-center gap-1.5 text-orange-300 mb-2">
                  <Activity size={13} />
                  <span className="mono text-[10px] tracking-widest">WEAK SPOTS — NOW APPEARING MORE OFTEN</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {weak.map(([n, c]) => (
                    <span key={n} className="mono text-xs px-3 py-1.5 rounded-lg bg-orange-500/10 border border-orange-500/25 text-orange-200">
                      {n} · missed {c}×
                    </span>
                  ))}
                </div>
              </Panel>
            )}

            <button onClick={resetProgress}
              className="mono text-[11px] text-zinc-600 hover:text-zinc-400">
              reset progress
            </button>
          </div>
        )}

        {/* ===================== SOCIAL ===================== */}
        {tab === "social" && (
          <div className="bs-up max-w-xl mx-auto space-y-4">
            {!isConfigured ? (
              <Panel className="p-6 text-center">
                <Users size={28} className="mx-auto text-zinc-500 mb-3" />
                <h2 className="display font-bold text-lg mb-2">The feed needs the backend connected</h2>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Add your Supabase keys to the build (see README) and run
                  <span className="mono text-cyan-300"> supabase/upgrade-social.sql </span>
                  in the Supabase SQL editor. Then this tab becomes a shared feed of everyone's
                  playing clips.
                </p>
              </Panel>
            ) : (
              <>
                {/* composer */}
                {isGuest ? (
                  <Panel className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-sm text-zinc-400">Sign in to share your playing.</p>
                    <button onClick={onSignIn}
                      className="mono text-xs px-4 py-2.5 rounded-lg text-black font-bold"
                      style={{ background: "linear-gradient(135deg,#22e3d8,#7c6cff)" }}>
                      Sign in
                    </button>
                  </Panel>
                ) : (
                  <Panel className="p-4">
                    <div className="flex gap-3">
                      <label className={`shrink-0 w-20 h-20 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-colors ${
                        postFile ? "border-cyan-400/50 bg-cyan-400/10" : "border-dashed border-white/20 hover:border-white/40"
                      }`}>
                        <input type="file" accept="image/*,video/*" className="hidden"
                          onChange={(e) => setPostFile(e.target.files?.[0] || null)} />
                        <ImagePlus size={18} className={postFile ? "text-cyan-300" : "text-zinc-500"} />
                        <span className="mono text-[8.5px] text-zinc-500 mt-1 px-1 text-center leading-tight">
                          {postFile ? (postFile.type.startsWith("video/") ? "video ✓" : "photo ✓") : "photo / video"}
                        </span>
                      </label>
                      <div className="flex-1 flex flex-col gap-2">
                        <textarea value={postCaption} onChange={(e) => setPostCaption(e.target.value.slice(0, 500))}
                          placeholder="What are you working on?"
                          rows={2}
                          className="w-full text-sm bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white outline-none resize-none placeholder:text-zinc-600" />
                        <div className="flex items-center gap-3">
                          <button onClick={submitPost} disabled={!postFile || posting}
                            className="mono text-xs px-4 py-2 rounded-lg text-black font-bold disabled:opacity-40"
                            style={{ background: "linear-gradient(135deg,#22e3d8,#7c6cff)" }}>
                            {posting ? "Posting…" : "Post"}
                          </button>
                          {postErr && <span className="text-xs text-red-400">{postErr}</span>}
                        </div>
                      </div>
                    </div>
                  </Panel>
                )}

                {/* feed */}
                {feedState === "loading" && (
                  <p className="mono text-[11px] text-zinc-500 text-center py-6">Loading the feed…</p>
                )}
                {feedState === "error" && (
                  <Panel className="p-5 text-center">
                    <p className="text-sm text-zinc-400 mb-3">
                      Couldn't load the feed. If this is a fresh backend, make sure
                      <span className="mono text-cyan-300"> upgrade-social.sql </span> has been run.
                    </p>
                    <button onClick={loadFeed} className="mono text-xs px-4 py-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white">
                      Retry
                    </button>
                  </Panel>
                )}
                {feedState === "ready" && feed.length === 0 && (
                  <Panel className="p-8 text-center">
                    <Guitar size={26} className="mx-auto text-zinc-600 mb-3" />
                    <p className="text-sm text-zinc-400">Nothing here yet — be the first to post your playing.</p>
                  </Panel>
                )}
                {feed.map((post) => {
                  const prof = post.profiles || {};
                  const liked = userId && post.likes.some((l) => l.user_id === userId);
                  const ig = igUrl(prof.instagram);
                  return (
                    <Panel key={post.id} className="overflow-hidden">
                      <div className="flex items-center gap-2.5 p-3">
                        <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                          {prof.avatar_url
                            ? <img src={prof.avatar_url} alt="" className="w-full h-full object-cover" />
                            : <User size={15} className="text-zinc-500" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm text-white font-semibold truncate">
                            {prof.display_name || prof.username || "player"}
                          </div>
                          <div className="mono text-[10px] text-zinc-500">{timeAgo(post.created_at)}</div>
                        </div>
                        {ig && (
                          <a href={ig} target="_blank" rel="noreferrer" title="Instagram" aria-label="Instagram profile"
                            className="p-2 rounded-lg text-zinc-500 hover:text-cyan-300 transition-colors">
                            <Instagram size={15} />
                          </a>
                        )}
                        {userId === post.user_id && (
                          <button onClick={() => onDeletePost(post)} title="Delete" aria-label="Delete post"
                            className="p-2 rounded-lg text-zinc-600 hover:text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {post.media_type === "video" ? (
                        <video src={post.media_url} controls playsInline preload="metadata"
                          className="w-full max-h-[70vh] bg-black" />
                      ) : (
                        <img src={post.media_url} alt="" loading="lazy"
                          className="w-full max-h-[70vh] object-contain bg-black" />
                      )}
                      <div className="p-3">
                        <button onClick={() => onLike(post)}
                          className={`flex items-center gap-1.5 mono text-xs transition-colors ${
                            liked ? "text-red-400" : "text-zinc-500 hover:text-zinc-300"
                          }`}>
                          <Heart size={15} fill={liked ? "currentColor" : "none"} />
                          {post.likes.length > 0 && post.likes.length}
                        </button>
                        {post.caption && (
                          <p className="text-sm text-zinc-300 mt-2 leading-relaxed whitespace-pre-wrap">{post.caption}</p>
                        )}
                      </div>
                    </Panel>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ===================== IDEAS ===================== */}
        {tab === "ideas" && (
          <div className="bs-up grid lg:grid-cols-[1fr_300px] gap-4">
            <div className="space-y-4 min-w-0">
              {/* lick generator */}
              <Panel className="p-3 sm:p-4">
                <div className="flex flex-wrap gap-x-6 gap-y-3 items-end">
                  <div className="min-w-0 max-w-full">
                    <div className="mono text-[10px] text-zinc-500 mb-1.5">KEY</div>
                    <div className="flex flex-wrap gap-1">
                      {NOTES.map((n, i) => (
                        <button key={n} onClick={() => setIdeaKey(i)}
                          className={`mono text-xs w-9 h-9 rounded-lg transition-all ${
                            ideaKey === i ? "text-black font-bold" : "bg-white/5 text-zinc-400 hover:bg-white/10"
                          }`}
                          style={ideaKey === i ? { background: "#ff2e4d" } : {}}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="mono text-[10px] text-zinc-500 mb-1.5">SCALE</div>
                    <select value={ideaScale} onChange={(e) => setIdeaScale(e.target.value)}
                      className="mono text-xs bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-white outline-none">
                      {SCALE_GROUPS.map((g) => (
                        <optgroup key={g} label={g}>
                          {Object.entries(SCALES).filter(([, v]) => v.grp === g).map(([k, v]) => (
                            <option key={k} value={k}>{v.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="mono text-[10px] text-zinc-500 mb-1.5">FEEL</div>
                    <Seg value={lickStyle} onChange={setLickStyle} options={[
                      { v: "bluesy", l: "Bluesy" },
                      { v: "melodic", l: "Melodic" },
                      { v: "fast", l: "Fast" },
                    ]} />
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-white/8">
                  <button onClick={() => newLick()}
                    className="flex items-center gap-2 display font-bold text-sm px-4 py-2.5 rounded-xl text-black"
                    style={{ background: "linear-gradient(135deg,#22e3d8,#7c6cff)" }}>
                    <Shuffle size={14} /> New lick
                  </button>
                  <button onClick={playLick}
                    className="flex items-center gap-2 mono text-xs px-4 py-2.5 rounded-lg border border-cyan-400/40 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20">
                    <Play size={13} /> Play it
                  </button>
                  <button onClick={downloadLick}
                    className="flex items-center gap-2 mono text-xs px-4 py-2.5 rounded-lg border border-white/10 text-zinc-400 hover:text-white">
                    <Download size={13} /> PNG for posting
                  </button>
                  <span className="mono text-[10px] text-zinc-500 ml-auto">
                    {lick ? `${lick.bpm} bpm · frets ${lick.window[0]}–${lick.window[1]}` : ""}
                  </span>
                </div>

                {lick && (
                  <div className="mt-3 rounded-xl bg-black/30 border border-white/8 p-2">
                    <TabSVG events={lick.events} />
                    <p className="mono text-[10px] text-zinc-500 px-2 pb-1">
                      h hammer · p pull · / slide · b bend · ~ vibrato
                    </p>
                  </div>
                )}
              </Panel>

              {/* song idea */}
              {songIdea && (
                <Panel className="p-4 sm:p-5">
                  <div className="flex items-center gap-2 text-cyan-300 mb-3">
                    <Lightbulb size={15} />
                    <span className="mono text-[10px] tracking-widest">SONG STARTER</span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5 mb-4">
                    {[
                      ["Key & progression", `${NOTES[songIdea.keyPc]} · ${PROGRESSIONS[songIdea.prog].name}`],
                      ["Groove", `${GROOVES[songIdea.groove].name} · ${GROOVES[songIdea.groove].sig} · ${songIdea.bpm} bpm`],
                      ["Mood", songIdea.mood],
                      ["Constraint", songIdea.technique],
                      ["Starting seed", songIdea.seed],
                    ].map(([k, v]) => (
                      <div key={k} className={k === "Starting seed" ? "sm:col-span-2" : ""}>
                        <div className="mono text-[10px] text-zinc-500">{k.toUpperCase()}</div>
                        <div className="text-sm text-zinc-200 mt-0.5">{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setSongIdea(generateSongIdea(Object.keys(PROGRESSIONS), Object.keys(GROOVES)))}
                      className="flex items-center gap-2 mono text-xs px-4 py-2.5 rounded-lg border border-white/10 text-zinc-400 hover:text-white">
                      <Shuffle size={13} /> New idea
                    </button>
                    <button onClick={loadIdeaInJam}
                      className="flex items-center gap-2 mono text-xs px-4 py-2.5 rounded-lg text-black font-bold"
                      style={{ background: "linear-gradient(135deg,#22e3d8,#7c6cff)" }}>
                      <Radio size={13} /> Load in Jam
                    </button>
                  </div>
                </Panel>
              )}

              {/* find tabs */}
              <Panel className="p-4 sm:p-5">
                <div className="flex items-center gap-2 text-cyan-300 mb-3">
                  <ExternalLink size={14} />
                  <span className="mono text-[10px] tracking-widest">FIND REAL SONG TABS</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <input value={tabQuery} onChange={(e) => setTabQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doTabSearch()}
                    placeholder="Song or artist…"
                    className="mono text-xs bg-black/50 border border-white/10 rounded-lg px-3 py-2.5 text-white outline-none flex-1 min-w-40" />
                  <button onClick={doTabSearch}
                    className="mono text-xs px-4 py-2.5 rounded-lg text-black font-bold"
                    style={{ background: "linear-gradient(135deg,#22e3d8,#7c6cff)" }}>
                    Search
                  </button>
                </div>
                {tabSearch.status === "loading" && (
                  <p className="mono text-[11px] text-zinc-500 mt-3">Searching Songsterr…</p>
                )}
                {tabSearch.status === "ok" && tabSearch.items.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {tabSearch.items.map((it) => (
                      <a key={it.id} href={it.url} target="_blank" rel="noreferrer"
                        className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 border border-white/8 bg-white/[0.03] hover:border-cyan-400/40 transition-colors">
                        <span className="text-sm text-zinc-200">
                          {it.title} <span className="text-zinc-500">— {it.artist}</span>
                        </span>
                        <ExternalLink size={12} className="text-zinc-500 shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
                {tabSearch.status === "ok" && tabSearch.items.length === 0 && (
                  <p className="mono text-[11px] text-zinc-500 mt-3">No matches — try fewer words.</p>
                )}
                {tabSearch.status === "error" && tabQuery.trim() && (
                  <p className="text-xs text-zinc-400 mt-3">
                    Songsterr didn't answer (their API can be moody). Search directly:{" "}
                    <a className="text-cyan-300 underline" target="_blank" rel="noreferrer"
                      href={`https://www.songsterr.com/?pattern=${encodeURIComponent(tabQuery)}`}>Songsterr</a>
                    {" · "}
                    <a className="text-cyan-300 underline" target="_blank" rel="noreferrer"
                      href={`https://www.ultimate-guitar.com/search.php?search_type=title&value=${encodeURIComponent(tabQuery)}`}>Ultimate Guitar</a>
                  </p>
                )}
                <p className="mono text-[10px] text-zinc-500 mt-3">
                  Powered by Songsterr's public API. Ultimate Guitar has no public API, so that link opens their search.
                </p>
              </Panel>
            </div>

            {/* guide */}
            <Panel className="p-5 h-fit">
              <div className="flex items-center gap-2 text-cyan-300 mb-1">
                <Lightbulb size={15} />
                <span className="mono text-[10px] tracking-widest">HOW TO USE A LICK</span>
              </div>
              <h2 className="display font-extrabold text-2xl leading-tight mb-4">Steal like a musician</h2>
              {[
                ["1 · Loop it", "Play it until your hands know it — 10 times slow beats 3 times fast."],
                ["2 · Move it", "Same shape, new key: shift it up two frets and it's in B."],
                ["3 · Bend it", "Change the last note, the rhythm, or where it starts in the bar. Now it's yours."],
                ["4 · Use it", "Load a Song Starter into the Jam tab and drop the lick over the changes."],
              ].map(([k, v]) => (
                <div key={k} className="py-2.5 border-b border-white/8 last:border-0">
                  <div className="mono text-[10px] text-zinc-500">{k}</div>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{v}</p>
                </div>
              ))}
              <div className="mt-4 rounded-xl p-3 bg-white/[0.03] border border-white/8">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Every generated lick stays inside your chosen scale and position, starts and ends
                  on a strong tone — there are no wrong notes to unlearn.
                </p>
              </div>
            </Panel>
          </div>
        )}

        {/* ===================== CREATE ===================== */}
        {tab === "create" && reel && (
          <div className="bs-up grid lg:grid-cols-[1fr_300px] gap-4">
            <div className="space-y-4 min-w-0">
              <Panel className="p-4 sm:p-5">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <div className="flex items-center gap-2 text-cyan-300">
                    <Clapperboard size={15} />
                    <span className="mono text-[10px] tracking-widest">REEL BLUEPRINT</span>
                  </div>
                  <button onClick={() => setReel(generateReelIdea(NOTES[ideaKey], SCALES[ideaScale].name, PROGRESSIONS[progKey].name))}
                    className="flex items-center gap-2 mono text-xs px-3.5 py-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white">
                    <Shuffle size={13} /> New idea
                  </button>
                </div>
                <h2 className="display font-extrabold text-2xl leading-tight">{reel.format.name}</h2>
                <p className="text-sm text-cyan-300 mt-1 mb-4">
                  “{reel.format.hook(NOTES[ideaKey], SCALES[ideaScale].name)}”
                </p>
                <div className="mono text-[10px] text-zinc-500 mb-2">SHOT LIST</div>
                <div className="space-y-1.5 mb-4">
                  {reel.format.shots.map((s, i) => (
                    <div key={i} className="flex gap-3 rounded-lg px-3 py-2 border border-white/8 bg-white/[0.03]">
                      <span className="mono text-[10px] text-zinc-500 pt-0.5">{i + 1}</span>
                      <span className="text-xs text-zinc-300">{s}</span>
                    </div>
                  ))}
                </div>
                <div className="mono text-[10px] text-zinc-500 mb-2">CAPTION (READY TO PASTE)</div>
                <div className="rounded-xl bg-black/40 border border-white/10 p-3 whitespace-pre-wrap text-xs text-zinc-300 leading-relaxed">
                  {reel.caption}
                </div>
                <button onClick={copyCaption}
                  className="mt-3 flex items-center gap-2 mono text-xs px-4 py-2.5 rounded-lg text-black font-bold"
                  style={{ background: copied ? "#22c55e" : "linear-gradient(135deg,#22e3d8,#7c6cff)" }}>
                  <Copy size={13} /> {copied ? "Copied!" : "Copy caption"}
                </button>
              </Panel>

              <Panel className="p-4 sm:p-5">
                <div className="flex items-center gap-2 text-cyan-300 mb-3">
                  <Download size={14} />
                  <span className="mono text-[10px] tracking-widest">POST ASSET — TAB CARD</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                  Export the current lick ({NOTES[ideaKey]} {SCALES[ideaScale].name}, {lickStyle} feel)
                  as a 1080×1080 tab card — drop it into a reel, a carousel slide, or a story.
                  Generate a different lick in the Ideas tab first if this one isn't the one.
                </p>
                {lick && (
                  <div className="rounded-xl bg-black/30 border border-white/8 p-2 mb-3">
                    <TabSVG events={lick.events} />
                  </div>
                )}
                <button onClick={downloadLick}
                  className="flex items-center gap-2 mono text-xs px-4 py-2.5 rounded-lg text-black font-bold"
                  style={{ background: "linear-gradient(135deg,#22e3d8,#7c6cff)" }}>
                  <Download size={13} /> Download 1080×1080 PNG
                </button>
              </Panel>
            </div>

            {/* posting guide */}
            <Panel className="p-5 h-fit">
              <div className="flex items-center gap-2 text-cyan-300 mb-1">
                <Clapperboard size={15} />
                <span className="mono text-[10px] tracking-widest">WHAT WORKS ON IG</span>
              </div>
              <h2 className="display font-extrabold text-2xl leading-tight mb-4">Guitar content rules</h2>
              {[
                ["Sound first", "Lead with the guitar, not your face or a title card. You have ~1.5s before the swipe."],
                ["Loop the end into the start", "Reels that loop cleanly get rewatched, and rewatches are the algorithm's favourite meal."],
                ["One idea per post", "A lick, a tip, a myth — never two. Save the rest for tomorrow."],
                ["Show the tab", "Overlay the PNG export while you play slow. Saves + shares beat likes."],
                ["Post the attempt, not the perfection", "The take with a small flub outperforms the studio one. People follow people."],
              ].map(([k, v]) => (
                <div key={k} className="py-2.5 border-b border-white/8 last:border-0">
                  <div className="mono text-[10px] text-zinc-500">{k.toUpperCase()}</div>
                  <p className="text-xs text-zinc-400 mt-0.5 leading-relaxed">{v}</p>
                </div>
              ))}
            </Panel>
          </div>
        )}

        {/* ===================== THEORY ===================== */}
        {tab === "theory" && (
          <div className="bs-up space-y-4">
            <Panel className="p-5">
              <div className="flex items-center gap-2 text-cyan-300 mb-1">
                <BookOpen size={15} />
                <span className="mono text-[10px] tracking-widest">THE BUILDING BLOCKS</span>
              </div>
              <h2 className="display font-extrabold text-2xl leading-tight mb-3">Intervals — the 12 flavours</h2>
              <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                Everything on the fretboard is made of <span className="text-white font-semibold">semitones</span> —
                one fret = one semitone, 12 of them and you're back where you started, an octave up.
                Every scale and chord is just a recipe of these distances measured from the root.
                The colours below are used everywhere in this app:
              </p>
              <div className="flex flex-wrap gap-2">
                {IV.map((iv, i) => (
                  <div key={iv.l} className="flex items-center gap-2 rounded-lg px-3 py-2 border"
                    style={{ background: `${iv.c}14`, borderColor: `${iv.c}44` }}>
                    <span className="w-4 h-4 rounded-full inline-block" style={{ background: iv.c }} />
                    <span className="mono text-xs text-white">{iv.l}</span>
                    <span className="mono text-[10px] text-zinc-500">{i} fret{i === 1 ? "" : "s"}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed mt-4">
                A scale's <span className="text-white">formula</span> is which of these it keeps. Major keeps
                R 2 3 4 5 6 7 (steps: W-W-H-W-W-W-H). Change one ingredient and the mood changes —
                flatten the 3 and it turns minor. That's the entire trick.
              </p>
            </Panel>

            {SCALE_GROUPS.map((g) => (
              <Panel key={g} className="p-5">
                <div className="mono text-[10px] tracking-widest text-cyan-300 mb-1">{g.toUpperCase()}</div>
                <p className="text-xs text-zinc-400 leading-relaxed mb-4">
                  {g === "Major scale modes" && (
                    "One set of notes, seven starting points. Play C major starting from D and you get D Dorian — same notes, totally different mood, because the intervals now sit differently against the new root. Brightest to darkest: Lydian → Ionian → Mixolydian → Dorian → Aeolian → Phrygian → Locrian."
                  )}
                  {g === "Minor & jazz" && (
                    "Natural minor has a weak pull home, so composers raised its 7th — harmonic minor — and smoothed the resulting leap by raising the 6th too — melodic minor. Each fix spawned its own set of modes, and three of them (Phrygian Dominant, Lydian Dominant, Altered) became sounds in their own right."
                  )}
                  {g === "Pentatonic & blues" && (
                    "Strip the two most opinionated notes from a 7-note scale and what's left can't clash — that's why pentatonics feel safe. The blues scale then adds one deliberately wrong note (the b5) as seasoning: pass through it, don't live on it."
                  )}
                  {g === "Symmetric" && (
                    "These repeat the same step pattern, so the shapes repeat up the neck — the diminished scales every 3 frets, whole tone every 2. Ambiguous by design: no note feels like home, which is exactly their use."
                  )}
                  {g === "Exotic" && (
                    "Scales from outside Western harmony — augmented 2nds, floating b2s, gaps where you expect notes. One of these over a simple drone is an instant film score."
                  )}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left" style={{ minWidth: 560 }}>
                    <thead>
                      <tr className="mono text-[10px] text-zinc-500">
                        <th className="py-2 pr-3 font-normal">SCALE</th>
                        <th className="py-2 pr-3 font-normal">FORMULA</th>
                        <th className="py-2 pr-3 font-normal">CHARACTER</th>
                        <th className="py-2 font-normal"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(SCALES).filter(([, v]) => v.grp === g).map(([k, v]) => (
                        <tr key={k} className="border-t border-white/8">
                          <td className="py-2.5 pr-3">
                            <div className="text-sm text-white font-semibold">{v.name}</div>
                            <div className="mono text-[10px] text-zinc-500">{v.tag}</div>
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="flex gap-1 flex-wrap">
                              {v.iv.map((i) => (
                                <span key={i} className="mono text-[10px] w-6 h-6 rounded-md flex items-center justify-center"
                                  style={{ background: `${IV[i].c}22`, color: IV[i].c, border: `1px solid ${IV[i].c}55` }}>
                                  {IV[i].l}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-2.5 pr-3 text-xs text-zinc-400">{v.char}</td>
                          <td className="py-2.5 text-right">
                            <button onClick={() => { setScaleKey(k); setViewMode("scale"); setTab("explore"); }}
                              className="mono text-[10px] px-2.5 py-1.5 rounded-lg border border-cyan-400/40 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20 transition-colors whitespace-nowrap">
                              View →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ))}

            <Panel className="p-5">
              <div className="mono text-[10px] tracking-widest text-cyan-300 mb-1">CHORDS COME FROM SCALES</div>
              <h2 className="display font-extrabold text-2xl leading-tight mb-3">Stack every other note</h2>
              <p className="text-sm text-zinc-300 leading-relaxed mb-3">
                Take a major scale and stack alternating notes (1-3-5, 2-4-6, …) and you get one chord
                per scale degree. In every major key the pattern of qualities is identical:
              </p>
              <div className="grid grid-cols-7 gap-1.5 mb-4" style={{ minWidth: 0 }}>
                {[["I","maj"],["ii","min"],["iii","min"],["IV","maj"],["V","maj"],["vi","min"],["vii°","dim"]].map(([n, q]) => (
                  <div key={n} className="rounded-lg py-2 text-center border border-white/8 bg-white/[0.03]">
                    <div className="display font-bold text-sm text-white">{n}</div>
                    <div className="mono text-[9px] text-zinc-500">{q}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Add one more stack (the 7th) and I becomes maj7, ii becomes m7, V becomes a
                <span className="text-white"> dominant 7</span> — the only place a dom7 occurs naturally,
                which is why V7 pulls so hard back to I. The blues cheerfully breaks this rule and plays
                dom7 on <em>everything</em>. That rule-break is the blues sound.
              </p>
            </Panel>

            <Panel className="p-5">
              <div className="mono text-[10px] tracking-widest text-cyan-300 mb-1">THE FOUR CHORD FAMILIES</div>
              <h2 className="display font-extrabold text-2xl leading-tight mb-3">Major · minor · diminished · dominant</h2>
              <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                Every chord you'll ever meet is one of four characters, defined by just two notes —
                the 3rd and the 7th. The root names the chord; these two give it its personality:
              </p>
              <div className="space-y-2.5 mb-4">
                {[
                  ["Major", "3 + 7", "At rest, bright, home. Nothing needs to move.", "maj7"],
                  ["Minor", "b3 + b7", "At rest but shaded. The b3 does all the emotional work.", "m7"],
                  ["Dominant", "3 + b7", "The engine. Major 3rd and flat 7 form a tritone that demands resolution — and the blues runs on refusing to resolve it.", "dom7"],
                  ["Diminished", "b3 + b5", "Pure tension, no home of its own. Lives between chords, pointing at the next one.", "dim7"],
                ].map(([name, sig, desc, key]) => (
                  <div key={name} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 border border-white/8 bg-white/[0.03] flex-wrap">
                    <div className="min-w-28">
                      <div className="text-sm text-white font-semibold">{name}</div>
                      <div className="mono text-[10px] text-cyan-300">{sig}</div>
                    </div>
                    <p className="text-xs text-zinc-400 flex-1 min-w-48">{desc}</p>
                    <button onClick={() => { setChordType(key); setTab("chords"); }}
                      className="mono text-[10px] px-2.5 py-1.5 rounded-lg border border-cyan-400/40 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20 transition-colors whitespace-nowrap">
                      Shapes →
                    </button>
                  </div>
                ))}
              </div>

              <div className="mono text-[10px] tracking-widest text-cyan-300 mb-1 mt-6">BEYOND THE OCTAVE — 9THS, 11THS, 13THS</div>
              <h3 className="display font-bold text-lg mb-2">Keep stacking 3rds and the numbers keep counting</h3>
              <p className="text-sm text-zinc-300 leading-relaxed mb-3">
                Chords are built by stacking every other scale note: 1-3-5 is a triad, add the next
                stack and you get the 7th. Keep going <em>past the octave</em> and the same scale notes
                come back with new numbers — the 2nd an octave up is called the <span className="text-white">9</span>,
                the 4th becomes the <span className="text-white">11</span>, the 6th becomes the <span className="text-white">13</span>:
              </p>
              <div className="overflow-x-auto mb-3">
                <div className="flex gap-1.5" style={{ minWidth: 480 }}>
                  {[["1","R"],["3","3rd"],["5","5th"],["7","7th"],["9","= 2 + oct"],["11","= 4 + oct"],["13","= 6 + oct"]].map(([n, sub], i) => (
                    <div key={n} className={`flex-1 rounded-lg py-2 text-center border ${i >= 4 ? "border-cyan-400/30 bg-cyan-400/5" : "border-white/8 bg-white/[0.03]"}`}>
                      <div className="display font-bold text-base text-white">{n}</div>
                      <div className="mono text-[9px] text-zinc-500">{sub}</div>
                    </div>
                  ))}
                </div>
              </div>
              <ul className="text-xs text-zinc-400 leading-relaxed space-y-2">
                <li><span className="text-white font-semibold">The 7th is the gateway.</span> A chord only gets extension names when a 7th is present: C-E-G-D is C<span className="mono">add9</span>, but C-E-G-Bb-D is C<span className="mono">9</span>. Each number implies everything below it — a 13 chord theoretically contains the 7, 9 and 11 too.</li>
                <li><span className="text-white font-semibold">Guitarists cheat, correctly.</span> Six strings can't hold seven notes, so drop the 5th first (adds nothing), then the root if a bassist has it, then the 11. A great 13th chord is often just 3, b7, 9, 13.</li>
                <li><span className="text-white font-semibold">Extensions follow the family.</span> Dominant chords take them all plus alterations (b9, #9, #11, b13 — hence the Hendrix 7#9). Major chords love 9 and #11 but the plain 11 clashes with their 3rd. Minor chords take 9, 11 and 13 freely.</li>
                <li><span className="text-white font-semibold">Rule of thumb:</span> extensions add colour, not function. A C13 still <em>does</em> the job of C7 — it just wears a better suit. Try them in the Chords tab.</li>
              </ul>
            </Panel>

            <Panel className="p-5">
              <div className="mono text-[10px] tracking-widest text-cyan-300 mb-1">THE CAGED SYSTEM</div>
              <h2 className="display font-extrabold text-2xl leading-tight mb-3">Five shapes tile the whole neck</h2>
              <p className="text-sm text-zinc-300 leading-relaxed mb-3">
                The open chords C, A, G, E and D are more than beginner chords — they're the five
                movable shapes the entire fretboard is built from. For any key, the five shapes appear
                up the neck in that fixed order (C→A→G→E→D, then repeating), each one overlapping the
                next by a fret or two. Learn a scale inside each window and you know it <em>everywhere</em>.
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {Object.entries(CAGED_POS).map(([k, v]) => (
                  <div key={k} className="rounded-lg px-3 py-2 border border-white/8 bg-white/[0.03]">
                    <span className="display font-bold text-sm text-white mr-2">{k} shape</span>
                    <span className="mono text-[10px] text-zinc-500">roots on {v.roots}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => { setCagedKey("E"); setTab("explore"); }}
                className="mono text-[10px] px-3 py-2 rounded-lg border border-cyan-400/40 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20 transition-colors">
                Try it — E shape on the fretboard →
              </button>
            </Panel>

            <Panel className="p-5">
              <div className="mono text-[10px] tracking-widest text-cyan-300 mb-1">PROGRESSIONS & NASHVILLE NUMBERS</div>
              <h2 className="display font-extrabold text-2xl leading-tight mb-3">Why musicians count 1 · 4 · 5</h2>
              <p className="text-sm text-zinc-300 leading-relaxed mb-4">
                Name chords by scale degree instead of letter and every song becomes portable:
                “1-4-5 in A” is A-D-E; the same 1-4-5 in G is G-C-D. Learn the <em>shape</em> once,
                play it in twelve keys. These are the classics — all playable in the Jam tab, any key:
              </p>
              <div className="space-y-2.5">
                {Object.entries(PROGRESSIONS).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3 border border-white/8 bg-white/[0.03] flex-wrap">
                    <div className="min-w-40">
                      <div className="text-sm text-white font-semibold">{v.name}</div>
                      <div className="mono text-[10px] text-zinc-500">{v.nums} · {v.bars.length} bars</div>
                    </div>
                    <p className="text-xs text-zinc-400 flex-1 min-w-48">{v.tip}</p>
                    <button onClick={() => { setProgKey(k); setTab("jam"); }}
                      className="mono text-[10px] px-2.5 py-1.5 rounded-lg border border-cyan-400/40 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20 transition-colors whitespace-nowrap">
                      Jam it →
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl p-3 bg-white/[0.03] border border-white/8">
                <div className="flex items-center gap-1.5 text-zinc-400 mb-1">
                  <Sparkles size={12} />
                  <span className="mono text-[10px]">PRACTICE TIP</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Pick one progression and play it in three keys tonight. The moment you can find
                  1, 4 and 5 from any root without thinking, you can walk into any jam night and survive.
                </p>
              </div>
            </Panel>
          </div>
        )}

        {/* settings & profile modal */}
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
            onClick={() => setShowSettings(false)}>
            <div onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-white/10 p-5 bs-up"
              style={{ background: "#101016" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="display font-extrabold text-xl">Settings</h2>
                <button onClick={() => setShowSettings(false)}
                  className="p-2 rounded-lg text-zinc-500 hover:text-white"><X size={16} /></button>
              </div>

              <div className="mono text-[10px] text-zinc-500 mb-1.5">THEME</div>
              <Seg value={theme} onChange={setTheme} options={[
                { v: "dark", l: "Dark" }, { v: "light", l: "Light" },
              ]} />

              {!isGuest ? (
                <>
                  <div className="flex items-center gap-3 mt-5">
                    <label className="relative w-16 h-16 rounded-full bg-white/5 border border-white/10 overflow-hidden flex items-center justify-center cursor-pointer hover:border-cyan-400/40 transition-colors shrink-0"
                      title="Change photo" aria-label="Change profile photo">
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => onAvatarPick(e.target.files?.[0])} />
                      {profile?.avatar_url
                        ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                        : <User size={22} className="text-zinc-500" />}
                    </label>
                    <div className="text-xs text-zinc-400">
                      <div className="text-white text-sm">@{profile?.username}</div>
                      Tap the photo to change it
                    </div>
                  </div>

                  <div className="mono text-[10px] text-zinc-500 mt-4 mb-1.5">VISIBLE NAME</div>
                  <input value={setName} onChange={(e) => setSetName(e.target.value.slice(0, 40))}
                    placeholder={profile?.username || "Your name"}
                    className="w-full text-sm bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-white outline-none" />

                  <div className="mono text-[10px] text-zinc-500 mt-3 mb-1.5">INSTAGRAM</div>
                  <div className="flex items-center gap-2">
                    <Instagram size={15} className="text-zinc-500 shrink-0" />
                    <input value={setIg} onChange={(e) => setSetIg(e.target.value.slice(0, 60))}
                      placeholder="@yourhandle"
                      className="flex-1 text-sm bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-white outline-none" />
                  </div>

                  <div className="flex items-center gap-3 mt-5">
                    <button onClick={saveSettings} disabled={settingsBusy}
                      className="mono text-xs px-5 py-2.5 rounded-lg text-black font-bold disabled:opacity-50"
                      style={{ background: "linear-gradient(135deg,#22e3d8,#7c6cff)" }}>
                      {settingsBusy ? "Saving…" : "Save"}
                    </button>
                    {settingsMsg && (
                      <span className={`text-xs ${settingsMsg.ok ? "text-emerald-400" : "text-red-400"}`}>
                        {settingsMsg.text}
                      </span>
                    )}
                    <button onClick={() => { setShowSettings(false); onSignOut(); }}
                      className="ml-auto flex items-center gap-1.5 mono text-[11px] text-zinc-500 hover:text-red-400 transition-colors">
                      <LogOut size={12} /> Sign out
                    </button>
                  </div>
                </>
              ) : (
                <div className="mt-5">
                  <p className="text-xs text-zinc-400 mb-3">
                    Sign in to set your name, photo and Instagram — and to post in the Social tab.
                  </p>
                  <button onClick={() => { setShowSettings(false); onSignIn(); }}
                    className="mono text-xs px-4 py-2.5 rounded-lg text-black font-bold"
                    style={{ background: "linear-gradient(135deg,#22e3d8,#7c6cff)" }}>
                    Sign in
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* level up toast */}
        {levelUp && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bs-up z-50">
            <div className="flex items-center gap-3 px-5 py-3 rounded-xl text-black display font-bold"
              style={{ background: "linear-gradient(135deg,#22e3d8,#7c6cff)",
                boxShadow: "0 0 32px rgba(124,108,255,0.6)" }}>
              <Award size={20} /> Level {level} reached
              <ChevronRight size={16} />
            </div>
          </div>
        )}

        <footer className="mt-8 mono text-[10px] text-zinc-600 flex items-center gap-2">
          <Guitar size={11} /> B Sharp — fretboard intelligence
        </footer>
      </div>
    </div>
  );
}

/* ------------------------- Root: auth + persistence ------------------------- */

const GUEST_KEY = "bsharp-progress";
const loadGuest = () => {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY)) || null; }
  catch { return null; }
};

function Splash() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#08080b",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, display: "flex", alignItems: "center",
        justifyContent: "center", fontWeight: 900, fontSize: 26, color: "#08080b",
        fontFamily: "system-ui, sans-serif",
        background: "linear-gradient(135deg,#22e3d8,#7c6cff)",
        boxShadow: "0 0 32px rgba(124,108,255,0.5)",
        animation: "bsplash 1.1s ease-in-out infinite",
      }}>B♯</div>
      <style>{`@keyframes bsplash{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.55;transform:scale(.94);}}`}</style>
    </div>
  );
}

export default function Root() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [screen, setScreen] = useState("auth"); // auth | app
  const [entered, setEntered] = useState(false); // landing gate
  const [profile, setProfile] = useState(null);
  const [cloud, setCloud] = useState(null);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("bsharp-theme") || "dark"; } catch (e) { return "dark"; }
  });
  useEffect(() => {
    try { localStorage.setItem("bsharp-theme", theme); } catch (e) {}
  }, [theme]);

  // returning guests skip the sign-in screen
  useEffect(() => {
    try { if (localStorage.getItem("bsharp-guest") === "1") setScreen("app"); } catch (e) {}
  }, []);

  // watch the Supabase session
  useEffect(() => {
    if (!isConfigured) { setAuthReady(true); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // on sign-in: pull profile + progress, then enter the app
  useEffect(() => {
    if (!session) { setProfile(null); setCloud(null); return; }
    let live = true;
    (async () => {
      setLoadingCloud(true);
      try {
        const [{ data: prof }, { data: prog }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
          supabase.from("progress").select("*").eq("user_id", session.user.id).maybeSingle(),
        ]);
        if (!live) return;
        setProfile(prof || { username: session.user.email });
        setCloud(prog ? {
          xp: prog.xp, best: prog.best_streak, answered: prog.answered,
          correct: prog.correct, missByNote: prog.miss_by_note || {},
        } : {});
      } catch (e) {
        if (!live) return;
        setProfile({ username: session.user.email });
        setCloud({});
      }
      setLoadingCloud(false);
      setScreen("app");
    })();
    return () => { live = false; };
  }, [session]);

  const persist = useCallback(async (p) => {
    if (session && supabase) {
      try {
        await supabase.from("progress").upsert({
          user_id: session.user.id,
          xp: p.xp, best_streak: p.best, answered: p.answered,
          correct: p.correct, miss_by_note: p.missByNote,
          updated_at: new Date().toISOString(),
        });
      } catch (e) {}
    } else {
      try { localStorage.setItem(GUEST_KEY, JSON.stringify(p)); } catch (e) {}
    }
  }, [session]);

  const signOut = useCallback(async () => {
    try { await supabase?.auth.signOut(); } catch (e) {}
    setScreen("auth");
  }, []);

  if (!entered) return <Landing onEnter={() => setEntered(true)} />;
  if (!authReady) return <Splash />;
  if (session && loadingCloud) return <Splash />;
  if (screen === "auth" && !session) {
    return <Auth onGuest={() => {
      try { localStorage.setItem("bsharp-guest", "1"); } catch (e) {}
      setScreen("app");
    }} />;
  }

  const signedIn = Boolean(session);
  return (
    <BSharp
      key={session?.user?.id || "guest"}
      username={profile?.display_name || profile?.username}
      isGuest={!signedIn}
      userId={session?.user?.id || null}
      profile={profile}
      onProfileChange={(p) => setProfile((prev) => ({ ...prev, ...p }))}
      theme={theme}
      setTheme={setTheme}
      onSignOut={signOut}
      onSignIn={() => {
        try { localStorage.removeItem("bsharp-guest"); } catch (e) {}
        setScreen("auth");
      }}
      initialProgress={signedIn ? cloud : loadGuest()}
      onPersist={persist}
    />
  );
}
