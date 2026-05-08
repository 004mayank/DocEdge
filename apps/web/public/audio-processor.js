/**
 * AudioWorklet processor — runs in a dedicated real-time audio thread.
 *
 * Converts Float32 PCM samples (from the microphone) to signed 16-bit PCM
 * and posts them to the main thread in ~100 ms batches (1 600 samples at 16 kHz).
 *
 * The main thread forwards the ArrayBuffer over Socket.IO to the API, which
 * streams it to Deepgram as raw linear16 audio.  No container overhead → zero
 * buffering delay on the Deepgram side.
 */

const CHUNK_SAMPLES = 1600; // 100 ms at 16 000 Hz

class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Int16Array(CHUNK_SAMPLES);
    this._offset = 0;
  }

  process(inputs) {
    const channel = inputs && inputs[0] && inputs[0][0];
    if (!channel) return true;

    for (let i = 0; i < channel.length; i++) {
      const s = Math.max(-1.0, Math.min(1.0, channel[i]));
      // Float32 → Int16 (little-endian)
      this._buf[this._offset++] = s < 0 ? s * 0x8000 : s * 0x7fff;

      if (this._offset >= CHUNK_SAMPLES) {
        // Transfer ownership to avoid copying
        const out = this._buf.buffer;
        this.port.postMessage(out, [out]);
        // Allocate fresh buffer for next batch
        this._buf = new Int16Array(CHUNK_SAMPLES);
        this._offset = 0;
      }
    }

    return true; // keep processor alive
  }
}

registerProcessor('audio-processor', AudioProcessor);
