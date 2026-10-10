import { describe, expect, it } from 'vitest';
import { encodeWavPCM16 } from './wavEncoder';

async function decode(blob: Blob) {
  const view = new DataView(await blob.arrayBuffer());
  const ascii = (offset: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => view.getUint8(offset + i)));
  return { view, ascii };
}

describe('encodeWavPCM16', () => {
  it('writes a valid 16-bit mono PCM header', async () => {
    const blob = encodeWavPCM16(new Float32Array(16000), 16000);
    const { view, ascii } = await decode(blob);

    expect(blob.type).toBe('audio/wav');
    expect(blob.size).toBe(44 + 32000);
    expect(ascii(0)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + 32000);
    expect(ascii(8)).toBe('WAVE');
    expect(ascii(12)).toBe('fmt ');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint32(28, true)).toBe(32000); // byte rate
    expect(view.getUint16(34, true)).toBe(16);
    expect(ascii(36)).toBe('data');
    expect(view.getUint32(40, true)).toBe(32000);
  });

  it('scales samples to the int16 range and clips out-of-range values', async () => {
    const { view } = await decode(encodeWavPCM16(new Float32Array([0, 1, -1, 0.5, 2, -3]), 16000));
    const samples = [0, 1, 2, 3, 4, 5].map((i) => view.getInt16(44 + i * 2, true));
    expect(samples).toEqual([0, 32767, -32768, 16383, 32767, -32768]);
  });
});
