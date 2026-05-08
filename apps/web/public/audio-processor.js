/**
 * AudioWorklet processor — real-time audio thread.
 *
 * Downsamples from whatever rate the AudioContext was created at (typically
 * 44 100 Hz or 48 000 Hz on macOS/Windows) down to 16 000 Hz using linear
 * interpolation, converts to signed 16-bit PCM, and posts 100 ms batches to
 * the main thread.
 *
 * Deepgram receives clean 16 kHz linear16 audio with no container overhead.
 *
 * The global `sampleRate` variable is injected by the AudioWorklet runtime
 * and always reflects the true AudioContext sample rate.
 */

const TARGET_RATE = 16000;
const TARGET_CHUNK_SAMPLES = 1600; // 100 ms worth at 16 kHz

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Ratio: how many input samples correspond to one output sample.
    // e.g. 48000 / 16000 = 3.0  |  44100 / 16000 = 2.75625
    this._ratio = sampleRate / TARGET_RATE;

    // Ring buffer for incoming float32 samples (before downsampling).
    this._inBuf  = new Float32Array(8192);
    this._inHead = 0;   // write pointer
    this._inTail = 0;   // read pointer (fractional)

    // Output buffer for resampled int16 samples.
    this._outBuf  = new Int16Array(TARGET_CHUNK_SAMPLES);
    this._outHead = 0;
  }

  /** Read a float sample at a fractional position with linear interpolation. */
  _readAt(pos) {
    const i = pos | 0;
    const f = pos - i;
    const a = this._inBuf[i % this._inBuf.length];
    const b = this._inBuf[(i + 1) % this._inBuf.length];
    return a + (b - a) * f;
  }

  process(inputs) {
    const channel = inputs && inputs[0] && inputs[0][0];
    if (!channel) return true;

    // Write incoming samples into the ring buffer.
    for (let i = 0; i < channel.length; i++) {
      this._inBuf[this._inHead % this._inBuf.length] = channel[i];
      this._inHead++;
    }

    // Drain resampled output while there are enough input samples.
    const available = this._inHead - this._inTail;
    while (this._inTail + this._ratio <= this._inHead) {
      const sample = this._readAt(this._inTail % this._inBuf.length);
      this._inTail += this._ratio;

      // Float32 → Int16
      const s = sample < -1 ? -1 : sample > 1 ? 1 : sample;
      this._outBuf[this._outHead++] = s < 0 ? (s * 0x8000) | 0 : (s * 0x7FFF) | 0;

      if (this._outHead >= TARGET_CHUNK_SAMPLES) {
        // Transfer buffer ownership to avoid copying.
        const transfer = this._outBuf.buffer;
        this.port.postMessage(transfer, [transfer]);
        this._outBuf  = new Int16Array(TARGET_CHUNK_SAMPLES);
        this._outHead = 0;
      }
    }

    return true; // keep the processor alive
  }
}

registerProcessor('audio-processor', AudioProcessor);
