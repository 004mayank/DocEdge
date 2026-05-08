/**
 * AudioWorklet processor — real-time audio thread.
 *
 * Converts Float32 PCM (at whatever rate the AudioContext was created with —
 * typically 44 100 Hz or 48 000 Hz on macOS/Windows) to signed 16-bit integers
 * and posts 100 ms batches to the main thread.
 *
 * NO downsampling: we send at the native rate and tell Deepgram the actual
 * sample_rate.  This avoids resampling artefacts that degraded recognition.
 *
 * `sampleRate` is a global constant injected by the AudioWorklet runtime.
 */

// 100 ms worth of samples at the native context rate.
const CHUNK_SAMPLES = Math.round(sampleRate * 0.1);

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf    = new Int16Array(CHUNK_SAMPLES);
    this._offset = 0;
  }

  process(inputs) {
    const channel = inputs && inputs[0] && inputs[0][0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      const s = channel[i] < -1 ? -1 : channel[i] > 1 ? 1 : channel[i];
      // Float32 → Int16 (little-endian)
      this._buf[this._offset++] = s < 0 ? (s * 0x8000) | 0 : (s * 0x7FFF) | 0;

      if (this._offset >= CHUNK_SAMPLES) {
        // Transfer ownership — zero-copy send to the main thread.
        this.port.postMessage(this._buf.buffer, [this._buf.buffer]);
        this._buf    = new Int16Array(CHUNK_SAMPLES);
        this._offset = 0;
      }
    }

    return true; // keep the processor alive
  }
}

registerProcessor('audio-processor', AudioProcessor);
