/**
 * Web Audio API Synth utilities for high-fidelity arcade sound effects.
 * Avoids loading heavy external media files and works instantly on all modern browsers.
 */

export function playWinSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // A triumphant ascending chime: C5 -> E5 -> G5 -> C6 -> E6
    const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filterNode = ctx.createBiquadFilter();

      // Slightly warm square wave filtered down for an organic retro feel
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.08);

      filterNode.type = 'lowpass';
      filterNode.frequency.setValueAtTime(2000, ctx.currentTime);

      gainNode.gain.setValueAtTime(0, ctx.currentTime + index * 0.08);
      gainNode.gain.linearRampToValueAtTime(0.18, ctx.currentTime + index * 0.08 + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.08 + 0.3);

      osc.connect(filterNode);
      filterNode.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start(ctx.currentTime + index * 0.08);
      osc.stop(ctx.currentTime + index * 0.08 + 0.35);
    });
  } catch (error) {
    console.warn('Win sound failed to play:', error);
  }
}

export function playLossSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // A low-pitched, sad descending synthesizer sound
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const filterNode = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.35); // A2

    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(800, ctx.currentTime);
    filterNode.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.35);

    gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);

    osc.connect(filterNode);
    filterNode.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (error) {
    console.warn('Loss sound failed to play:', error);
  }
}
