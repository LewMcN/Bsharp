import * as Tone from "tone";

// Real recorded instruments (MIT, tonejs-instruments via Makefully-Studios).
// A sparse set of pitches per instrument — Tone.Sampler repitches between them.
// The mp3s are emitted as separate assets and only fetched when the jam starts.
import bE1 from "tonejs-instrument-bass-electric-mp3/E1.mp3?url";
import bAs1 from "tonejs-instrument-bass-electric-mp3/As1.mp3?url";
import bE2 from "tonejs-instrument-bass-electric-mp3/E2.mp3?url";
import bAs2 from "tonejs-instrument-bass-electric-mp3/As2.mp3?url";
import bE3 from "tonejs-instrument-bass-electric-mp3/E3.mp3?url";
import bG3 from "tonejs-instrument-bass-electric-mp3/G3.mp3?url";

import pC3 from "tonejs-instrument-piano-mp3/C3.mp3?url";
import pE3 from "tonejs-instrument-piano-mp3/E3.mp3?url";
import pGs3 from "tonejs-instrument-piano-mp3/Gs3.mp3?url";
import pC4 from "tonejs-instrument-piano-mp3/C4.mp3?url";
import pE4 from "tonejs-instrument-piano-mp3/E4.mp3?url";
import pGs4 from "tonejs-instrument-piano-mp3/Gs4.mp3?url";
import pC5 from "tonejs-instrument-piano-mp3/C5.mp3?url";
import pE5 from "tonejs-instrument-piano-mp3/E5.mp3?url";

import geE2 from "tonejs-instrument-guitar-electric-mp3/E2.mp3?url";
import geA2 from "tonejs-instrument-guitar-electric-mp3/A2.mp3?url";
import geC3 from "tonejs-instrument-guitar-electric-mp3/C3.mp3?url";
import geDs3 from "tonejs-instrument-guitar-electric-mp3/Ds3.mp3?url";
import geFs3 from "tonejs-instrument-guitar-electric-mp3/Fs3.mp3?url";
import geA3 from "tonejs-instrument-guitar-electric-mp3/A3.mp3?url";
import geC4 from "tonejs-instrument-guitar-electric-mp3/C4.mp3?url";

import gaE2 from "tonejs-instrument-guitar-acoustic-mp3/E2.mp3?url";
import gaG2 from "tonejs-instrument-guitar-acoustic-mp3/G2.mp3?url";
import gaB2 from "tonejs-instrument-guitar-acoustic-mp3/B2.mp3?url";
import gaD3 from "tonejs-instrument-guitar-acoustic-mp3/D3.mp3?url";
import gaF3 from "tonejs-instrument-guitar-acoustic-mp3/F3.mp3?url";
import gaA3 from "tonejs-instrument-guitar-acoustic-mp3/A3.mp3?url";
import gaC4 from "tonejs-instrument-guitar-acoustic-mp3/C4.mp3?url";
import gaE4 from "tonejs-instrument-guitar-acoustic-mp3/E4.mp3?url";

export const makeElectricGuitarSampler = () =>
  new Tone.Sampler({
    urls: { E2: geE2, A2: geA2, C3: geC3, "D#3": geDs3, "F#3": geFs3, A3: geA3, C4: geC4 },
    release: 0.3,
  });

export const makeAcousticGuitarSampler = () =>
  new Tone.Sampler({
    urls: { E2: gaE2, G2: gaG2, B2: gaB2, D3: gaD3, F3: gaF3, A3: gaA3, C4: gaC4, E4: gaE4 },
    release: 0.35,
  });

export const makeBassSampler = () =>
  new Tone.Sampler({
    urls: { E1: bE1, "A#1": bAs1, E2: bE2, "A#2": bAs2, E3: bE3, G3: bG3 },
    release: 0.4,
  });

export const makePianoSampler = () =>
  new Tone.Sampler({
    urls: { C3: pC3, E3: pE3, "G#3": pGs3, C4: pC4, E4: pE4, "G#4": pGs4, C5: pC5, E5: pE5 },
    release: 0.6,
  });
