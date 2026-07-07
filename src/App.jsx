import React, { useState, useRef, useEffect, useCallback } from "react";
import * as Tone from "tone";
import {
  Music, Zap, Target, Play, Square, Volume2, Award, Flame, RotateCcw,
  Check, X, Activity, Sparkles, Brain, Guitar, Ear, ChevronRight,
  Radio, Crosshair, Layers, User, LogOut
} from "lucide-react";
import { supabase, isConfigured } from "./lib/supabase";
import Auth from "./Auth.jsx";

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
  major:      { name: "Major",            tag: "Ionian",    iv: [0,2,4,5,7,9,11], char: "Bright · resolved · uplifting",   gen: "Pop, country, classical", song: "“Ode to Joy”, “Let It Be”" },
  minor:      { name: "Natural Minor",    tag: "Aeolian",   iv: [0,2,3,5,7,8,10], char: "Dark · introspective · serious", gen: "Rock, metal, film score", song: "“Stairway” verse, “Losing My Religion”" },
  majPent:    { name: "Major Pentatonic", tag: "5-note",    iv: [0,2,4,7,9],      char: "Open · sweet · no wrong notes",  gen: "Country, rock, folk",     song: "“My Girl”, “Sweet Home Alabama”" },
  minPent:    { name: "Minor Pentatonic", tag: "5-note",    iv: [0,3,5,7,10],     char: "The rock/blues workhorse",       gen: "Blues, rock, soul",       song: "Most rock solos ever" },
  blues:      { name: "Blues Scale",      tag: "minor + b5",iv: [0,3,5,6,7,10],   char: "Gritty · vocal · the b5 cry",    gen: "Blues, rock, R&B",        song: "Endless 12-bar jams" },
  dorian:     { name: "Dorian",           tag: "mode II",   iv: [0,2,3,5,7,9,10], char: "Minor but hopeful — natural 6",  gen: "Funk, jazz, modal rock",  song: "“So What”, “Oye Como Va”" },
  mixo:       { name: "Mixolydian",       tag: "mode V",    iv: [0,2,4,5,7,9,10], char: "Major with a bluesy b7",         gen: "Blues-rock, funk, jam",   song: "“Sweet Child o’ Mine” riff" },
  lydian:     { name: "Lydian",           tag: "mode IV",   iv: [0,2,4,6,7,9,11], char: "Dreamy · floating · the #4",     gen: "Film, fusion, prog",      song: "“The Simpsons” theme" },
  phrygian:   { name: "Phrygian",         tag: "mode III",  iv: [0,1,3,5,7,8,10], char: "Spanish · exotic · tense b2",    gen: "Flamenco, metal",         song: "Flamenco, thrash riffs" },
  harmMinor:  { name: "Harmonic Minor",   tag: "minor + 7", iv: [0,2,3,5,7,8,11], char: "Dramatic · neoclassical leap",   gen: "Classical, metal, gypsy", song: "Neoclassical shred" },
};

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
// 12-bar shuffle blues in A with a quick-turnaround to E7 in bar 12
const JAM_CHORDS = {
  A7: { name: "A7", rootPc: 9, bass: 33, tones: "A · C# · E · G",  scale: "A Mixolydian / A Blues", third: "C#" },
  D7: { name: "D7", rootPc: 2, bass: 38, tones: "D · F# · A · C",  scale: "D Mixolydian (A Blues still works)", third: "F#" },
  E7: { name: "E7", rootPc: 4, bass: 40, tones: "E · G# · B · D",  scale: "E Mixolydian", third: "G#" },
};
const DOM7 = [0, 4, 7, 10];
const PROGRESSION = ["A7","A7","A7","A7","D7","D7","A7","A7","E7","D7","A7","E7"];
const BLUES_A_PCS = SCALES.blues.iv.map((i) => pc(9 + i)); // A blues safe notes

/* ----------------------------- Fretboard ----------------------------- */

function Fretboard({ tuning, numFrets, leftHanded, interactive, onCell, cellRenderer }) {
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

  return (
    <div className="overflow-x-auto overflow-y-hidden -mx-1 px-1" style={{ WebkitOverflowScrolling: "touch" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ minWidth: W, touchAction: "pan-x" }}>
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
                      <circle cx={cx} cy={cy} r="17.5" fill="none" stroke={r.fill}
                        strokeWidth="2.5" opacity="0.9" className="bs-pulse" />
                    )}
                    {r.ring && (
                      <circle cx={cx} cy={cy} r="18" fill="none"
                        stroke={r.fill} strokeWidth="1.5" opacity="0.55" />
                    )}
                    <circle cx={cx} cy={cy} r={r.faint ? 9 : 14} fill={r.fill}
                      opacity={r.faint ? 0.5 : 1}
                      style={r.faint ? {} : { filter: `drop-shadow(0 0 8px ${r.fill}88)` }} />
                    <text x={cx} y={cy + (r.faint ? 3 : 4)} textAnchor="middle"
                      className={r.faint ? "mono" : "display"}
                      fontSize={r.faint ? 8.5 : 11} fontWeight="700" fill={r.ink}>
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

function BSharp({ username, isGuest, onSignOut, onSignIn, initialProgress, onPersist }) {
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

  const synthRef = useRef(null);
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
  const buildJamSynths = useCallback(() => {
    if (jam.current.built) return;
    const kick = new Tone.MembraneSynth({ octaves: 6, pitchDecay: 0.04 }).toDestination();
    kick.volume.value = -5;

    const snBp = new Tone.Filter(1800, "bandpass").toDestination();
    const snare = new Tone.NoiseSynth({
      noise: { type: "pink" }, envelope: { attack: 0.001, decay: 0.14, sustain: 0 },
    }).connect(snBp);
    snare.volume.value = -9;

    const hatHp = new Tone.Filter(8000, "highpass").toDestination();
    const hat = new Tone.NoiseSynth({
      noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.04, sustain: 0 },
    }).connect(hatHp);
    hat.volume.value = -19;

    const bass = new Tone.MonoSynth({
      oscillator: { type: "square" },
      envelope: { attack: 0.004, decay: 0.25, sustain: 0.35, release: 0.15 },
      filterEnvelope: { attack: 0.002, decay: 0.15, sustain: 0.4, baseFrequency: 120, octaves: 2.2 },
    }).toDestination();
    bass.volume.value = -9;

    const comp = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.005, decay: 0.18, sustain: 0.04, release: 0.2 },
    }).toDestination();
    comp.volume.value = -14;

    jam.current = { ...jam.current, built: true, kick, snare, hat, bass, comp };
  }, []);

  const jamStep = useCallback((time) => {
    const J = jam.current;
    const step = J.step;
    const bar = Math.floor(step / 8) % 12;
    const e = step % 8;
    const chord = JAM_CHORDS[PROGRESSION[bar]];

    try {
      J.hat.triggerAttackRelease("32n", time, e % 2 === 0 ? 0.9 : 0.55);
      if (e === 0 || e === 4) J.kick.triggerAttackRelease("C1", "8n", time);
      if (e === 2 || e === 6) J.snare.triggerAttackRelease("16n", time, 0.85);
      if (e % 2 === 0) {
        const deg = [0, 4, 7, 9][e / 2]; // R 3 5 6 boogie
        J.bass.triggerAttackRelease(midiName(chord.bass + deg), "8n", time, 0.9);
      }
      if (e === 2 || e === 6) {
        // shell voicing: 3rd + b7, two octaves above bass
        J.comp.triggerAttackRelease(
          [midiName(chord.bass + 28), midiName(chord.bass + 34)], "16n", time, 0.6
        );
      }
    } catch (err) {}

    if (e === 0) Tone.Draw.schedule(() => setJamBar(bar), time);
    J.step = (step + 1) % 96;
  }, []);

  const startJam = useCallback(async () => {
    await Tone.start();
    await ensureAudio();
    buildJamSynths();
    jam.current.step = 0;
    setJamBar(0);
    Tone.Transport.bpm.value = bpm;
    Tone.Transport.swing = 0.55;
    Tone.Transport.swingSubdivision = "8n";
    jam.current.loopId = Tone.Transport.scheduleRepeat(jamStep, "8n");
    Tone.Transport.start("+0.06");
    setJamPlaying(true);
  }, [bpm, buildJamSynths, ensureAudio, jamStep]);

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

  useEffect(() => {
    const t = timers.current;
    return () => {
      t.forEach(clearTimeout);
      Tone.Transport.stop();
      Tone.Transport.cancel();
      const J = jam.current;
      ["kick", "snare", "hat", "bass", "comp"].forEach((k) => {
        try { J[k]?.dispose(); } catch (e) {}
      });
    };
  }, []);

  /* ---------------- explore renderer ---------------- */
  const exploreRenderer = useCallback((s, f, midi) => {
    const semi = pc(midi - rootPc);
    const inSet = activeIv.includes(semi);
    const isLast = lastPlayed && lastPlayed.s === s && lastPlayed.f === f;
    if (inSet) {
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
  }, [rootPc, activeIv, viewMode, displayMode, showAll, lastPlayed]);

  const handleExploreCell = useCallback((s, f, midi) => {
    playMidi(midi);
    setLastPlayed({ s, f });
    const t = setTimeout(() => setLastPlayed(null), 480);
    timers.current.push(t);
  }, [playMidi]);

  /* ---------------- jam renderer ---------------- */
  const jamChord = JAM_CHORDS[PROGRESSION[jamBar]];
  const jamRenderer = useCallback((s, f, midi) => {
    const semi = pc(midi - jamChord.rootPc);
    if (DOM7.includes(semi)) {
      const info = IV[semi];
      return { fill: info.c, ink: info.k, label: info.l, ring: semi === 0, glow: semi === 4 };
    }
    if (showSafe && BLUES_A_PCS.includes(pc(midi)))
      return { fill: "#1d2a2e", ink: "#4dd0c5", label: NOTES[pc(midi)], faint: true };
    return null;
  }, [jamChord, showSafe]);

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
  const nextBar = (jamBar + 1) % 12;

  return (
    <div className="min-h-screen w-full text-zinc-200" style={{
      fontFamily: "'DM Sans',ui-sans-serif,system-ui,sans-serif",
      touchAction: "manipulation",
      background: "radial-gradient(900px 600px at 12% -5%,rgba(34,227,216,0.10),transparent 60%)," +
        "radial-gradient(900px 700px at 95% 0%,rgba(124,108,255,0.12),transparent 55%),#08080b",
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
      `}</style>

      <div className="max-w-6xl mx-auto px-4 py-5">

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
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <User size={14} className={isGuest ? "text-zinc-500" : "text-cyan-300"} />
              </div>
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
                <button onClick={onSignOut} title="Sign out"
                  className="p-2 rounded-lg border border-white/10 text-zinc-400 hover:text-white transition-colors">
                  <LogOut size={13} />
                </button>
              )}
            </div>
          </div>
        </header>

        {/* ---------- tabs ---------- */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {[
            { v: "explore", l: "Explore", icon: Guitar },
            { v: "jam", l: "Jam", icon: Radio },
            { v: "train", l: "Train", icon: Target },
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
            <div className="space-y-4">
              <Panel className="p-4">
                <div className="flex flex-wrap gap-x-6 gap-y-3 items-end">
                  <div>
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
                        {Object.entries(SCALES).map(([k, v]) => (
                          <option key={k} value={k}>{v.name}</option>
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

              <Panel className="p-4">
                <Fretboard tuning={tuning} numFrets={numFrets} leftHanded={lefty}
                  interactive onCell={handleExploreCell} cellRenderer={exploreRenderer} />
                <p className="mono text-[10px] text-zinc-500 mt-2">
                  Tap any fret to hear it · root in red
                </p>
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

        {/* ===================== JAM ===================== */}
        {tab === "jam" && (
          <div className="bs-up space-y-4">
            {/* transport + guide */}
            <div className="grid lg:grid-cols-[1fr_300px] gap-4">
              <div className="space-y-4">
                <Panel className="p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <button onClick={jamPlaying ? stopJam : startJam}
                      className="flex items-center gap-2 display font-bold text-sm px-5 py-3 rounded-xl text-black"
                      style={{ background: jamPlaying
                        ? "linear-gradient(135deg,#ff2e4d,#ff7a2f)"
                        : "linear-gradient(135deg,#22e3d8,#7c6cff)",
                        boxShadow: "0 0 22px rgba(124,108,255,0.35)" }}>
                      {jamPlaying ? <Square size={15} /> : <Play size={15} />}
                      {jamPlaying ? "Stop" : "Play 12-Bar Blues in A"}
                    </button>
                    <div className="flex items-center gap-3 flex-1 min-w-44">
                      <span className="mono text-[10px] text-zinc-500">BPM</span>
                      <input type="range" min="60" max="160" value={bpm}
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

                  {/* 12-bar grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5 mt-4">
                    {PROGRESSION.map((c, i) => {
                      const cur = jamPlaying && i === jamBar;
                      return (
                        <div key={i}
                          className={`rounded-lg py-2 text-center border transition-all ${cur ? "bs-beat" : ""}`}
                          style={cur ? {
                            background: "linear-gradient(135deg,rgba(34,227,216,0.28),rgba(124,108,255,0.28))",
                            borderColor: "rgba(255,255,255,0.3)",
                            boxShadow: "0 0 16px rgba(124,108,255,0.4)",
                          } : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.07)" }}>
                          <div className="mono text-[9px] text-zinc-500">{i + 1}</div>
                          <div className={`display font-bold text-sm ${cur ? "text-white" : "text-zinc-400"}`}>{c}</div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>

                <Panel className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="mono text-[10px] text-zinc-500">NOW:</span>
                      <span className="display font-extrabold text-xl text-white">{jamChord.name}</span>
                      <span className="mono text-[11px] text-zinc-500">→ next: {JAM_CHORDS[PROGRESSION[nextBar]].name}</span>
                    </div>
                    <span className="mono text-[10px] text-zinc-500">3rd pulses — that's your landing note</span>
                  </div>
                  <Fretboard tuning={tuning} numFrets={numFrets} leftHanded={lefty}
                    interactive onCell={handleExploreCell} cellRenderer={jamRenderer} />
                  <p className="mono text-[10px] text-zinc-500 mt-2">
                    Board follows the chord live · tap to noodle over the loop
                  </p>
                </Panel>
              </div>

              {/* guide */}
              <Panel className="p-5 h-fit">
                <div className="flex items-center gap-2 text-cyan-300 mb-1">
                  <Radio size={15} />
                  <span className="mono text-[10px] tracking-widest">JAM GUIDE</span>
                </div>
                <h2 className="display font-extrabold text-2xl leading-tight">{jamChord.name}</h2>
                <p className="mono text-[11px] text-zinc-500 mb-4">bar {jamBar + 1} of 12 · shuffle feel</p>

                {[
                  ["Chord tones", jamChord.tones],
                  ["Scale to use", jamChord.scale],
                  ["Target note", `${jamChord.third} — the 3rd. Land on it when the chord hits.`],
                  ["Always safe", "A Blues scale works over the whole form"],
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
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Start with one note per chord: hit each chord's <span className="text-blue-400 font-semibold">3rd</span> as
                    it lands (C# → F# → G#). Once that's automatic, fill the space between with the blues scale.
                    That's the whole secret to sounding like you know the changes.
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
          <Guitar size={11} /> B Sharp v2 — fretboard · scales · arpeggios · jam trainer · mastery training
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
  const [username, setUsername] = useState(null);
  const [cloud, setCloud] = useState(null);
  const [loadingCloud, setLoadingCloud] = useState(false);

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
    if (!session) { setUsername(null); setCloud(null); return; }
    let live = true;
    (async () => {
      setLoadingCloud(true);
      try {
        const [{ data: prof }, { data: prog }] = await Promise.all([
          supabase.from("profiles").select("username").eq("id", session.user.id).maybeSingle(),
          supabase.from("progress").select("*").eq("user_id", session.user.id).maybeSingle(),
        ]);
        if (!live) return;
        setUsername(prof?.username || session.user.email);
        setCloud(prog ? {
          xp: prog.xp, best: prog.best_streak, answered: prog.answered,
          correct: prog.correct, missByNote: prog.miss_by_note || {},
        } : {});
      } catch (e) {
        if (!live) return;
        setUsername(session.user.email);
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

  if (!authReady) return <Splash />;
  if (session && loadingCloud) return <Splash />;
  if (screen === "auth" && !session) return <Auth onGuest={() => setScreen("app")} />;

  const signedIn = Boolean(session);
  return (
    <BSharp
      key={session?.user?.id || "guest"}
      username={username}
      isGuest={!signedIn}
      onSignOut={signOut}
      onSignIn={() => setScreen("auth")}
      initialProgress={signedIn ? cloud : loadGuest()}
      onPersist={persist}
    />
  );
}
