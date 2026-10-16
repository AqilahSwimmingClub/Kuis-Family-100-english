import { useEffect, useId, useRef, useState } from "react";
import { Play, Volume2, VolumeX, X } from "lucide-react";
import {
  getSoundEffects,
  previewSound,
  setAudioSettings,
  stopSound,
  testSound,
  type SoundEffect,
} from "../game/audio";
import { useAudioSettings } from "../game/useAudioSettings";
import "./sound-settings.css";

export function SoundSettings({ compact = false }: { compact?: boolean }) {
  const settings = useAudioSettings();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const previewRequest = useRef(0);
  const volumeId = useId();
  const effects = getSoundEffects();
  useEffect(() => {
    const element = dialog.current;
    if (open && element) {
      element.showModal();
      return () => element.close();
    }
  }, [open]);
  function close() {
    previewRequest.current++;
    stopSound();
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  }
  async function test(effect?: SoundEffect) {
    const request = ++previewRequest.current;
    const played = await (effect ? previewSound(effect.id) : testSound()).catch(
      () => false,
    );
    if (request !== previewRequest.current || !dialog.current?.open) return;
    setStatus(
      played
        ? `${effect?.label ?? "Tes suara"} diputar. Sesuaikan juga volume perangkat Anda.`
        : "Suara belum aktif. Ketuk Putar atau Tes Suara lagi dan periksa volume perangkat.",
    );
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`sound-settings-trigger ${compact ? "sound-compact" : ""}`}
        aria-label="Pengaturan Suara"
        onClick={() => {
          setStatus("");
          setOpen(true);
        }}
      >
        <Volume2 size={18} />
        <span>Pengaturan Suara</span>
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="sound-dialog"
          aria-labelledby={`${volumeId}-title`}
          onCancel={(event) => {
            event.preventDefault();
            event.stopPropagation();
            close();
          }}
        >
          <div className="sound-dialog-heading">
            <span className="sound-dialog-icon">
              {settings.enabled ? <Volume2 /> : <VolumeX />}
            </span>
            <div>
              <h2 id={`${volumeId}-title`}>Pengaturan Suara</h2>
              <p>Atur suasana game show untuk kelas Anda.</p>
            </div>
            <button
              type="button"
              className="sound-close"
              aria-label="Tutup pengaturan suara"
              data-audio-silent
              onClick={close}
            >
              <X size={20} />
            </button>
          </div>
          <label className="sound-switch">
            <span>
              Efek suara<small>{settings.enabled ? "Aktif" : "Nonaktif"}</small>
            </span>
            <input
              type="checkbox"
              aria-label="Efek suara"
              checked={settings.enabled}
              data-audio-silent
              onChange={(event) => {
                previewRequest.current++;
                setAudioSettings({ enabled: event.target.checked });
                setStatus("");
              }}
            />
          </label>
          <div className="sound-volume">
            <label htmlFor={volumeId}>
              Volume utama <output>{settings.volume}%</output>
            </label>
            <input
              id={volumeId}
              type="range"
              aria-label="Volume utama"
              min="0"
              max="100"
              step="1"
              value={settings.volume}
              data-audio-silent
              onChange={(event) => {
                previewRequest.current++;
                setAudioSettings({ volume: Number(event.target.value) });
                setStatus("");
              }}
            />
            <div className="sound-range-labels">
              <span>0%</span>
              <span>100%</span>
            </div>
          </div>
          <label className="sound-profile">
            Profil suara
            <select
              aria-label="Profil suara"
              value={settings.profile}
              data-audio-silent
              onChange={(event) => {
                previewRequest.current++;
                setAudioSettings({
                  profile: event.target.value as "normal" | "game-show",
                });
                setStatus("");
              }}
            >
              <option value="normal">Normal</option>
              <option value="game-show">Game Show</option>
            </select>
            <small>
              Normal lebih ringkas. Game Show memakai fanfare dan lapisan efek
              yang lebih meriah.
            </small>
          </label>
          <button
            type="button"
            className="sound-test"
            disabled={!settings.enabled || settings.volume === 0}
            data-audio-silent
            onClick={() => void test()}
          >
            <Volume2 size={18} /> Tes Suara
          </button>
          <p className="sound-status" role="status">
            {!settings.enabled || settings.volume === 0
              ? "Aktifkan efek suara dan naikkan volume untuk mencoba."
              : status ||
                "Suara aktif setelah interaksi Anda. Pengaturan tersimpan otomatis di perangkat ini."}
          </p>
          <section
            className="sound-gallery"
            aria-labelledby={`${volumeId}-gallery`}
          >
            <h3 id={`${volumeId}-gallery`}>Galeri Efek Suara</h3>
            <p>
              Dengarkan {effects.length} efek satu per satu. Efek sebelumnya
              berhenti saat Anda memutar efek lain.
            </p>
            <ul className="sound-gallery-list">
              {effects.map((effect) => (
                <li key={effect.id}>
                  <div>
                    <strong>{effect.label}</strong>
                    <small>{effect.description}</small>
                  </div>
                  <button
                    type="button"
                    aria-label={`Putar ${effect.label}`}
                    data-audio-preview={effect.id}
                    data-audio-silent
                    disabled={!settings.enabled || settings.volume === 0}
                    onClick={() => void test(effect)}
                  >
                    <Play size={16} aria-hidden="true" /> Putar
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </dialog>
      )}
    </>
  );
}
