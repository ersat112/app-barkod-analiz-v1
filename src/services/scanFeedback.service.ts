import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

let cachedScanBeepUri: string | null = null;
let preparedSound: ReturnType<typeof createAudioPlayer> | null = null;
let preparePromise: Promise<ReturnType<typeof createAudioPlayer> | null> | null = null;

const encodeBase64 = (bytes: Uint8Array): string => {
  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const chunk = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);

    output += BASE64_ALPHABET[(chunk >> 18) & 63];
    output += BASE64_ALPHABET[(chunk >> 12) & 63];
    output += typeof second === 'number' ? BASE64_ALPHABET[(chunk >> 6) & 63] : '=';
    output += typeof third === 'number' ? BASE64_ALPHABET[chunk & 63] : '=';
  }

  return output;
};

const writeAscii = (buffer: Uint8Array, offset: number, value: string): void => {
  for (let index = 0; index < value.length; index += 1) {
    buffer[offset + index] = value.charCodeAt(index);
  }
};

const buildScanBeepDataUri = (): string => {
  if (cachedScanBeepUri) {
    return cachedScanBeepUri;
  }

  const sampleRate = 22050;
  const durationMs = 92;
  const totalSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = totalSamples * 2;
  const fileSize = 44 + dataSize;
  const buffer = new Uint8Array(fileSize);
  const view = new DataView(buffer.buffer);

  writeAscii(buffer, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(buffer, 8, 'WAVE');
  writeAscii(buffer, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(buffer, 36, 'data');
  view.setUint32(40, dataSize, true);

  for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex += 1) {
    const time = sampleIndex / sampleRate;
    const attack = Math.min(1, sampleIndex / (sampleRate * 0.008));
    const release = Math.max(0, 1 - sampleIndex / totalSamples);
    const envelope = attack * release;
    const tone =
      Math.sin(2 * Math.PI * 1480 * time) +
      Math.sin(2 * Math.PI * 2960 * time) * 0.28;
    const normalized = Math.max(-1, Math.min(1, tone * 0.32 * envelope));
    view.setInt16(44 + sampleIndex * 2, Math.round(normalized * 32767), true);
  }

  cachedScanBeepUri = `data:audio/wav;base64,${encodeBase64(buffer)}`;
  return cachedScanBeepUri;
};

const ensureAudioMode = async (): Promise<void> => {
  await setAudioModeAsync({
    playsInSilentMode: true,
    allowsRecording: false,
    interruptionMode: 'duckOthers',
    shouldRouteThroughEarpiece: false,
    shouldPlayInBackground: false,
  });
};

const createPreparedSound = async (): Promise<ReturnType<typeof createAudioPlayer> | null> => {
  await ensureAudioMode();

  const sound = createAudioPlayer(
    { uri: buildScanBeepDataUri() },
    {
      updateInterval: 250,
      keepAudioSessionActive: false,
    }
  );

  sound.volume = 0.34;
  preparedSound = sound;
  return sound;
};

const getPreparedSound = async (): Promise<ReturnType<typeof createAudioPlayer> | null> => {
  if (preparedSound) {
    return preparedSound;
  }

  if (!preparePromise) {
    preparePromise = createPreparedSound()
      .catch((error) => {
        console.warn('[ScanFeedback] prepare failed:', error);
        preparedSound = null;
        return null;
      })
      .finally(() => {
        preparePromise = null;
      });
  }

  return preparePromise;
};

export const prepareScanBeep = async (): Promise<void> => {
  await getPreparedSound();
};

export const playScanBeep = async (): Promise<void> => {
  const sound = await getPreparedSound();

  if (!sound) {
    return;
  }

  try {
    await sound.seekTo(0);
    sound.play();
  } catch (error) {
    console.warn('[ScanFeedback] playback failed:', error);
    sound.remove();
    preparedSound = null;
  }
};

export const unloadScanBeep = async (): Promise<void> => {
  if (!preparedSound) {
    return;
  }

  try {
    preparedSound.remove();
  } catch (error) {
    console.warn('[ScanFeedback] unload failed:', error);
  } finally {
    preparedSound = null;
  }
};
