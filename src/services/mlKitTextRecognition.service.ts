import { NativeModules, Platform } from 'react-native';

type NativeOcrResponse = {
  text?: string;
  blocks?: string[];
  lines?: string[];
  hasText?: boolean;
};

export type MlKitTextRecognitionResult = {
  text: string;
  blocks: string[];
  lines: string[];
  hasText: boolean;
};

type MlKitOcrNativeModule = {
  recognizeTextFromImage: (imageUri: string) => Promise<NativeOcrResponse>;
};

const nativeModule = NativeModules.MlKitOcrModule as MlKitOcrNativeModule | undefined;

export function isMlKitTextRecognitionAvailable(): boolean {
  return Boolean(
    nativeModule &&
      (Platform.OS === 'android' || Platform.OS === 'ios')
  );
}

export async function recognizeTextFromImage(
  imageUri: string
): Promise<MlKitTextRecognitionResult> {
  if (!imageUri.trim()) {
    throw new Error('OCR_IMAGE_URI_MISSING');
  }

  if (!nativeModule?.recognizeTextFromImage) {
    throw new Error('OCR_NATIVE_MODULE_UNAVAILABLE');
  }

  const response = await nativeModule.recognizeTextFromImage(imageUri);
  const text = String(response?.text || '').trim();
  const blocks = Array.isArray(response?.blocks)
    ? response.blocks.map((item) => String(item || '').trim()).filter(Boolean)
    : [];
  const lines = Array.isArray(response?.lines)
    ? response.lines.map((item) => String(item || '').trim()).filter(Boolean)
    : [];

  return {
    text,
    blocks,
    lines,
    hasText: Boolean(response?.hasText) || text.length > 0,
  };
}
