import RNFS from 'react-native-fs';
import { ensureCachedVoiceAudio, VoiceMedia } from '@/utils/voice-message';

/**
 * Resolves voice-note durations without playback so players can show the real
 * length before the user presses play (issue #128 follow-up: previews showed
 * 0:00).
 *
 * m4a/aac files carry the duration in the ISO-BMFF `mvhd` (movie header) box,
 * readable straight from the cached file bytes. WebM/WAV files have no mvhd,
 * so for those we fall back to a byte-size heuristic. Results are cached
 * in-memory keyed by media id / url so each voice note is probed once per app
 * session.
 */

const durationByKey = new Map<string, number>();
const pendingByKey = new Map<string, Promise<number>>();

const cacheKeyFor = (media: VoiceMedia): string =>
  media.id || media.file_link || media.file_name;

const stdAtob: (b64: string) => string =
  // Hermes exposes globalThis.atob on RN >= 0.74; manual fallback otherwise.
  typeof (globalThis as { atob?: (b64: string) => string }).atob === 'function'
    ? (b64: string) =>
        (globalThis as unknown as { atob: (b64: string) => string }).atob(b64)
    : (b64: string) => {
        const table =
          'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let out = '';
        let bits = 0;
        let acc = 0;
        for (const ch of b64.replace(/[^A-Za-z0-9+/=]/g, '')) {
          if (ch === '=') {
            break;
          }
          acc = (acc << 6) | table.indexOf(ch);
          bits += 6;
          if (bits >= 8) {
            bits -= 8;
            out += String.fromCharCode((acc >> bits) & 0xff);
          }
        }
        return out;
      };

function readU32(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset] << 24) |
      (buf[offset + 1] << 16) |
      (buf[offset + 2] << 8) |
      buf[offset + 3]) >>>
    0
  );
}

function readU64(buf: Uint8Array, offset: number): number {
  // Durations fit well within JS number precision.
  return readU32(buf, offset) * 0x100000000 + readU32(buf, offset + 4);
}

/**
 * Scans the ISO-BMFF box markers for the `mvhd` (movie header) box and parses
 * its duration. `moov` can sit anywhere in an m4a (recorders often write it at
 * the end), so the whole file is scanned rather than a fixed offset assumed.
 */
function findMvhdDurationMs(bytes: Uint8Array): number | null {
  try {
    for (let i = 0; i + 12 <= bytes.length; i++) {
      if (
        bytes[i] === 0x6d && // m
        bytes[i + 1] === 0x76 && // v
        bytes[i + 2] === 0x68 && // h
        bytes[i + 3] === 0x64 // d
      ) {
        // bytes[i-4..i-1] is the box size; the mvhd body starts at i+4.
        return parseMvhd(bytes, i + 4);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * mvhd body:
 *  v0: version(1) flags(3) ctime(4) mtime(4) timescale(4) duration(4)
 *  v1: version(1) flags(3) ctime(8) mtime(8) timescale(4) duration(8)
 */
function parseMvhd(bytes: Uint8Array, bodyStart: number): number | null {
  const version = bytes[bodyStart];
  const timescaleOffset = bodyStart + (version === 1 ? 20 : 12);
  const durationOffset = timescaleOffset + 4;

  const timescale = readU32(bytes, timescaleOffset);
  if (!timescale) {
    return null;
  }

  const duration =
    version === 1
      ? readU64(bytes, durationOffset)
      : readU32(bytes, durationOffset);
  if (!duration) {
    return null;
  }

  return Math.round((duration / timescale) * 1000);
}

/**
 * Rough fallback for containers without mvhd (webm/wav): assume a nominal
 * audio bitrate of 64 kbps between Opus voice (~24k) and wav (~256k+).
 */
function estimateFromFileSizeMs(sizeBytes: number): number | null {
  if (!sizeBytes || sizeBytes < 0) {
    return null;
  }
  return Math.round((sizeBytes * 8) / 64);
}

async function probeDurationMs(media: VoiceMedia): Promise<number> {
  const key = cacheKeyFor(media);
  const cached = durationByKey.get(key);
  if (cached !== undefined) {
    return cached;
  }

  if (pendingByKey.has(key)) {
    return pendingByKey.get(key)!;
  }

  const pending = (async () => {
    try {
      const localPath = await ensureCachedVoiceAudio(media);
      // Base64: utf8 reads mangle binary bytes, so decode manually.
      const stat = await RNFS.stat(localPath);
      const size = Number(stat.size) || 0;
      if (size <= 0) {
        return 0;
      }
      const b64 = await RNFS.read(localPath, size, 0, 'base64');
      const decoded = stdAtob(b64);
      const bytes = new Uint8Array(decoded.length);
      for (let i = 0; i < decoded.length; i++) {
        bytes[i] = decoded.charCodeAt(i);
      }

      let durationMs = findMvhdDurationMs(bytes) ?? 0;
      // No mvhd (webm/wav): estimate from the cached file size.
      if (!(durationMs > 0)) {
        durationMs = estimateFromFileSizeMs(size) ?? 0;
      }

      if (durationMs > 0 && durationMs < 1000 * 60 * 60) {
        durationByKey.set(key, durationMs);
        return durationMs;
      }
    } catch {
      // fall through to 0 — the player shows 0:00 as before on failure
    }
    return 0;
  })();

  pendingByKey.set(key, pending);
  const result = await pending;
  pendingByKey.delete(key);
  return result;
}

export const voiceDurationService = {
  /**
   * Synchronous read of a previously-resolved duration (0 when unknown).
   * UI should call `resolve()` in an effect to kick off probing, then
   * re-render from the resolved value.
   */
  getCachedDurationMs(media?: VoiceMedia | null): number {
    if (!media) return 0;
    return durationByKey.get(cacheKeyFor(media)) ?? 0;
  },

  /**
   * Probes the duration from the cached audio file. Safe to call repeatedly;
   * resolves to the same cached value.
   */
  resolveDurationMs(media?: VoiceMedia | null): Promise<number> {
    if (!media?.file_link) {
      return Promise.resolve(0);
    }
    return probeDurationMs(media);
  },
};
