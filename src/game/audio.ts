let context: AudioContext | undefined
export type Sound = 'opening' | 'correct' | 'wrong' | 'round' | 'timeout' | 'steal' | 'winner' | 'countdown' | 'confetti'
const notes: Record<Sound, number[]> = {
  opening: [262, 330, 392, 523], correct: [523, 659, 784], wrong: [180, 130], round: [392, 523],
  timeout: [300, 200, 100], steal: [330, 440, 660], winner: [523, 659, 784, 1047, 784, 1047], countdown: [880], confetti: [1047, 1318, 1568],
}
export function playSound(name: Sound, enabled: boolean) {
  if (!enabled) return
  try {
    context ??= new AudioContext()
    void context.resume().catch(() => undefined)
    const start = context.currentTime
    notes[name].forEach((frequency, i) => {
      const oscillator = context!.createOscillator(), gain = context!.createGain()
      oscillator.type = name === 'wrong' ? 'sawtooth' : 'sine'; oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0, start + i * .12)
      gain.gain.linearRampToValueAtTime(.08, start + i * .12 + .015)
      gain.gain.exponentialRampToValueAtTime(.001, start + i * .12 + .2)
      oscillator.connect(gain); gain.connect(context!.destination)
      oscillator.start(start + i * .12); oscillator.stop(start + i * .12 + .22)
    })
  } catch { /* Audio is optional on unsupported browsers. */ }
}
