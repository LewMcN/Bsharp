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
