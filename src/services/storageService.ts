import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  type UploadMetadata,
} from 'firebase/storage';
import { auth, storage } from '../config/firebase';

/**
 * ErEnesAl® v1 - Firebase Storage Yönetim Servisi
 * Ürün görselleri ve kullanıcı katkı dosyaları için merkezi servis.
 */

const sanitizePathPart = (value: string): string =>
  String(value || '')
    .trim()
    .replace(/[^\w.-]+/g, '_');

const guessContentType = (uri: string): string => {
  const lower = uri.toLowerCase();

  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';

  return 'image/jpeg';
};

const buildTimestampedPath = (
  folder: string,
  identifier: string,
  extension = 'jpg'
): string => {
  const safeFolder = sanitizePathPart(folder);
  const safeIdentifier = sanitizePathPart(identifier) || 'file';
  return `${safeFolder}/${safeIdentifier}_${Date.now()}.${extension}`;
};

const resolveAuthenticatedUserId = (): string | null => {
  const userId = auth.currentUser?.uid;
  return typeof userId === 'string' && userId.trim() ? userId.trim() : null;
};

const resolveExtensionFromUri = (uri: string): string => {
  const lower = uri.toLowerCase();

  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.webp')) return 'webp';
  if (lower.endsWith('.heic')) return 'heic';
  if (lower.endsWith('.heif')) return 'heif';

  return 'jpg';
};

const uriToBlob = async (uri: string): Promise<Blob> => {
  const response = await fetch(uri);

  if (!response.ok) {
    throw new Error(`Dosya okunamadı: ${response.status}`);
  }

  return await response.blob();
};

export const storageService = {
  /**
   * Genel görsel yükleme fonksiyonu.
   */
  uploadImage: async (
    uri: string,
    path: string,
    metadata?: UploadMetadata
  ): Promise<string | null> => {
    if (!uri?.trim() || !path?.trim()) {
      return null;
    }

    try {
      const blob = await uriToBlob(uri);
      const storageRef = ref(storage, path);

      const uploadMeta: UploadMetadata = {
        contentType: guessContentType(uri),
        cacheControl: 'public,max-age=3600',
        ...(metadata || {}),
      };

      const snapshot = await uploadBytes(storageRef, blob, uploadMeta);
      const downloadURL = await getDownloadURL(snapshot.ref);

      return downloadURL;
    } catch (error) {
      console.error('Storage uploadImage error:', error);
      return null;
    }
  },

  /**
   * Barkod ürün görselini yükler.
   */
  uploadProductImage: async (uri: string, barcode: string): Promise<string | null> => {
    const userId = resolveAuthenticatedUserId();

    if (!userId) {
      return null;
    }

    const ext = resolveExtensionFromUri(uri);
    const path = buildTimestampedPath(`products/${sanitizePathPart(userId)}`, barcode, ext);

    return await storageService.uploadImage(uri, path, {
      customMetadata: {
        userId: sanitizePathPart(userId),
        barcode: sanitizePathPart(barcode),
        source: 'product',
      },
    });
  },

  /**
   * Eksik ürün katkı ekranından gelen görseli yükler.
   */
  uploadMissingProductImage: async (
    uri: string,
    barcode: string
  ): Promise<string | null> => {
    const userId = resolveAuthenticatedUserId();

    if (!userId) {
      return null;
    }

    const ext = resolveExtensionFromUri(uri);
    const path = buildTimestampedPath(
      `missing-products/${sanitizePathPart(userId)}`,
      barcode,
      ext
    );

    return await storageService.uploadImage(uri, path, {
      customMetadata: {
        userId: sanitizePathPart(userId),
        barcode: sanitizePathPart(barcode),
        source: 'missing-product',
      },
    });
  },

  /**
   * Kullanıcı avatarı / profil görseli yüklemek için yardımcı fonksiyon.
   */
  uploadUserImage: async (uri: string, userId: string): Promise<string | null> => {
    const currentUserId = resolveAuthenticatedUserId();
    const safeUserId = sanitizePathPart(userId);

    if (!currentUserId || currentUserId !== userId) {
      return null;
    }

    const ext = resolveExtensionFromUri(uri);
    const path = buildTimestampedPath(`users/${safeUserId}`, safeUserId, ext);

    return await storageService.uploadImage(uri, path, {
      customMetadata: {
        userId: safeUserId,
        source: 'user-profile',
      },
    });
  },

  /**
   * Storage dosyasını tam URL veya path ile siler.
   */
  deleteImage: async (imageUrlOrPath: string): Promise<boolean> => {
    if (!imageUrlOrPath?.trim()) {
      return false;
    }

    try {
      const fileRef = ref(storage, imageUrlOrPath);
      await deleteObject(fileRef);
      return true;
    } catch (error) {
      console.error('Storage deleteImage error:', error);
      return false;
    }
  },
};
