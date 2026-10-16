/** One browser audio engine is loaded before either application entry point. */
export type Sound =
  | "intro"
  | "opening"
  | "question"
  | "correct"
  | "wrong"
  | "reveal"
  | "score"
  | "celebration"
  | "steal"
  | "steal-success"
  | "steal-fail"
  | "countdown"
  | "timeout"
  | "turn"
  | "discussion"
  | "winner"
  | "click";
export type AudioSettings = {
  enabled: boolean;
  volume: number;
  profile: "normal" | "game-show";
};
export type SoundOptions = { id?: string; points?: number };
export type SoundEffect = { id: Sound; label: string; description: string };
export type AudioEngine = {
  getEffects: () => SoundEffect[];
  getSettings: () => AudioSettings;
  setSettings: (settings: Partial<AudioSettings>) => AudioSettings;
  play: (name: Sound, options?: SoundOptions) => Promise<boolean>;
  preview: (name: Sound) => Promise<boolean>;
  unlock: () => Promise<boolean>;
  stop: () => void;
  test: () => Promise<boolean>;
  subscribe: (listener: (settings: AudioSettings) => void) => () => void;
};
declare global {
  interface Window {
    family100Audio?: AudioEngine;
  }
}
const defaults: AudioSettings = {
  enabled: true,
  volume: 65,
  profile: "game-show",
};
export const getSoundEffects = (): SoundEffect[] =>
  window.family100Audio?.getEffects() ?? [];
export const getAudioSettings = (): AudioSettings =>
  window.family100Audio?.getSettings() ?? defaults;
export const setAudioSettings = (patch: Partial<AudioSettings>) =>
  window.family100Audio?.setSettings(patch) ?? defaults;
export const subscribeAudio = (listener: (settings: AudioSettings) => void) =>
  window.family100Audio?.subscribe(listener) ?? (() => undefined);
export function playSound(name: Sound, options?: SoundOptions) {
  void window.family100Audio?.play(name, options).catch(() => undefined);
}
export function stopSound() {
  window.family100Audio?.stop();
}
export async function previewSound(name: Sound) {
  return window.family100Audio?.preview(name) ?? false;
}
export async function testSound() {
  const engine = window.family100Audio;
  return engine?.test() ?? false;
}
/** Honour an old mute only when no new global preference has ever been saved. */
export function migrateLegacyMute(sound: boolean) {
  try {
    if (!sound && localStorage.getItem("family100.audio.v1") === null)
      setAudioSettings({ enabled: false });
  } catch {
    /* The engine can still keep settings in memory when storage is unavailable. */
  }
}
