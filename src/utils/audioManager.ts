// ============================================================
// PLANEZ — Audio Manager
// Singleton that handles background music and sound effects.
// ============================================================

const BASE = import.meta.env.BASE_URL;

const BACKGROUND_TRACKS = [
  `${BASE}sounds/Chrono_Nexus.mp3`,
  `${BASE}sounds/Galactic_Command.mp3`,
  `${BASE}sounds/Pixelated_Vanguard.mp3`,
];

const BAD_EVENT_SOUNDS = [
  `${BASE}sounds/BadEvent1.mp3`,
  `${BASE}sounds/BadEvent2.mp3`,
];

const WINNING_SOUND = `${BASE}sounds/Winning.mp3`;

const FADE_DURATION_MS = 1500;
const MUSIC_VOLUME = 0.25;
const SFX_VOLUME = 0.5;

class AudioManager {
  private currentTrack: HTMLAudioElement | null = null;
  private currentTrackIndex = -1;
  private unlocked = false;
  private fadingOut = false;

  /** Call once on first user interaction to unlock Web Audio on browsers. */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    // Start background music on first interaction
    this.playNextTrack();
  }

  /** Transition to a random different background track. */
  transitionMusic() {
    if (!this.unlocked) return;
    if (this.fadingOut) return;
    this.fadeOutAndSwitch();
  }

  /** Play a bad-event sound effect (randomly picks one). */
  playBadEvent() {
    const src = BAD_EVENT_SOUNDS[Math.floor(Math.random() * BAD_EVENT_SOUNDS.length)];
    this.playSfx(src);
  }

  /** Play the winning/good-event sound effect. */
  playWinning() {
    this.playSfx(WINNING_SOUND);
  }

  /** Set music volume (0-1). */
  setMusicVolume(vol: number) {
    if (this.currentTrack) {
      this.currentTrack.volume = vol;
    }
  }

  // ----------------------------------------------------------
  // Internal helpers
  // ----------------------------------------------------------

  private playNextTrack() {
    // Pick a different track than the current one
    let nextIndex: number;
    if (BACKGROUND_TRACKS.length <= 1) {
      nextIndex = 0;
    } else {
      do {
        nextIndex = Math.floor(Math.random() * BACKGROUND_TRACKS.length);
      } while (nextIndex === this.currentTrackIndex);
    }

    this.currentTrackIndex = nextIndex;
    const audio = new Audio(BACKGROUND_TRACKS[nextIndex]);
    audio.volume = MUSIC_VOLUME;
    audio.loop = true;
    audio.play().catch(() => {
      // Browser blocked autoplay — will retry on next user interaction
    });
    this.currentTrack = audio;
  }

  private fadeOutAndSwitch() {
    const old = this.currentTrack;
    if (!old) {
      this.playNextTrack();
      return;
    }

    this.fadingOut = true;
    const steps = 20;
    const stepTime = FADE_DURATION_MS / steps;
    const volumeStep = old.volume / steps;
    let count = 0;

    const interval = setInterval(() => {
      count++;
      old.volume = Math.max(0, old.volume - volumeStep);
      if (count >= steps) {
        clearInterval(interval);
        old.pause();
        old.src = '';
        this.fadingOut = false;
        this.playNextTrack();
      }
    }, stepTime);
  }

  private playSfx(src: string) {
    if (!this.unlocked) return;
    const audio = new Audio(src);
    audio.volume = SFX_VOLUME;
    audio.play().catch(() => {});
  }
}

export const audioManager = new AudioManager();
