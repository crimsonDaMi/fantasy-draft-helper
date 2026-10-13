let audioContext: AudioContext | undefined;

/** A short two-tone chime, generated so no audio file is needed. Browsers
 * only start audio after the user has interacted with the page, so the
 * first call should come from a click (turning the sound on); later calls
 * reuse that audio context. Fails silently where audio is unavailable. */
export function playAlertSound(): void {
  if (typeof window.AudioContext !== "function") {
    return;
  }

  try {
    audioContext ??= new window.AudioContext();
    audioContext.resume().catch(() => {
      // Not allowed yet; stays silent.
    });

    const start = audioContext.currentTime;

    for (const [offset, frequency] of [
      [0, 880],
      [0.18, 1320],
    ] as const) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.16);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.17);
    }
  } catch {
    // No sound.
  }
}
