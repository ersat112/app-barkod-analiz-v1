import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase';

/**
 * ErEnesAl® v1 - Firebase Storage Yönetim Servisi
 * Ürün görsellerini ve kullanıcı dosyalarını buluta yüklemek için kullanılır.
 */

export const storageService = {
  /**
   * 📸 Görseli Firebase Storage'a Yükle
   * @param uri - Cihazdaki yerel dosya yolu (expo-camera'dan gelen)
   * @param path - Kaydedilecek klasör yolu (Örn: 'products/868123.jpg')
   * @returns Yüklenen dosyanın public URL'i
   */
  uploadImage: async (uri: string, path: string): Promise<string | null> => {
    try {
      // 1. URI'yi Blob formatına dönüştür (React Native/Firebase zorunluluğu)
      const response = await fetch(uri);
      const blob = await response.blob();

      // 2. Firebase Storage referansı oluştur
      const storageRef = ref(storage, path);

      // 3. Dosyayı yükle
      const snapshot = await uploadBytes(storageRef, blob);

      // 4. Public erişim URL'ini al
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('Dosya başarıyla yüklendi:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('Storage Yükleme Hatası:', error);
      return null;
    }
  },

  /**
   * 🖼️ Ürün Görseli Yükle (Kısayol)
   * Barkod numarasına göre özel bir klasörleme yapar.
   */
  uploadProductImage: async (uri: string, barcode: string): Promise<string | null> => {
    const fileName = `products/${barcode}_${Date.now()}.jpg`;
    return await storageService.uploadImage(uri, fileName);
  },

  /**
   * 🗑️ Dosyayı Sil
   * Veritabanından bir ürün silindiğinde depolama alanını temizlemek için kullanılır.
   */
  deleteImage: async (imageUrl: string): Promise<void> => {
    try {
      // URL'den referans oluşturarak dosyayı bul ve sil
      const fileRef = ref(storage, imageUrl);
      await deleteObject(fileRef);
      console.log('Dosya Storage üzerinden silindi.');
    } catch (error) {
      console.error('Storage Silme Hatası:', error);
    }
  }
};