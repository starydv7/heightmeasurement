import { Platform } from 'react-native';
import CameraView from 'expo-camera';
import type { CameraCapturedPicture, CameraPictureOptions } from 'expo-camera/build/Camera.types';

type CameraInstance = InstanceType<typeof CameraView>;

/**
 * Android: some OEMs fail on maximum quality or the default JPEG pipeline.
 * Avoid calling resumePreview before capture — on several devices it interrupts the pipeline and breaks takePictureAsync.
 */
export async function takePictureWithAndroidFallbacks(camera: CameraInstance | null): Promise<CameraCapturedPicture> {
  if (!camera) {
    throw new Error('Camera is not ready');
  }

  if (Platform.OS === 'android') {
    // Brief yield so layout + CameraSession finish attaching (helps Samsung/Oppo builds).
    await new Promise<void>((resolve) => setTimeout(resolve, 180));
  }

  const attempts: CameraPictureOptions[] =
    Platform.OS === 'android'
      ? [
          { quality: 0.88, shutterSound: false },
          { quality: 0.75, shutterSound: false },
          { quality: 0.65, skipProcessing: true, shutterSound: false },
        ]
      : [{ quality: 0.95 }, { quality: 0.88 }];

  let lastError: unknown;
  for (const options of attempts) {
    try {
      const capture = await camera.takePictureAsync(options);
      if (capture?.uri && capture.width > 0 && capture.height > 0) {
        return capture;
      }
    } catch (e) {
      lastError = e;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error('Photo capture returned no image data');
}

const ANDROID_ERROR_MAX = 420;

/** Readable one-line-ish message for on-screen debug (Android only). */
export function formatAndroidCameraError(e: unknown): string {
  let raw: string;
  if (e instanceof Error) {
    raw = [e.name, e.message].filter(Boolean).join(': ') || 'Error';
  } else if (typeof e === 'string') {
    raw = e;
  } else if (e != null && typeof e === 'object' && 'message' in e) {
    raw = String((e as { message: unknown }).message);
  } else {
    raw = String(e);
  }
  raw = raw.replace(/\s+/g, ' ').trim();
  if (raw.length > ANDROID_ERROR_MAX) {
    return `${raw.slice(0, ANDROID_ERROR_MAX)}…`;
  }
  return raw;
}
