import { useEffect, useState } from "react";
import { getAudioSettings, subscribeAudio } from "./audio";

export function useAudioSettings() {
  const [settings, setSettings] = useState(getAudioSettings);
  useEffect(() => subscribeAudio(setSettings), []);
  return settings;
}
