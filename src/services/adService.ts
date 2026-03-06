import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * ErEnesAl® v1 Reklam Yönetim Servisi
 * Bu servis, kullanıcıyı bıktırmadan reklam gösterme frekansını ve 
 * tarama sayaçlarını uygulama oturumları arasında senkronize eder.
 */

const STORAGE_KEY = '@Erenesal:scan_ad_counter';

class AdService {
  /**
   * Mevcut tarama sayısını kalıcı hafızadan getirir.
   * @returns {Promise<number>} Kayıtlı tarama sayısı
   */
  private async getScanCount(): Promise<number> {
    try {
      const count = await AsyncStorage.getItem(STORAGE_KEY);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      console.error('AdService Error (getScanCount):', error);
      return 0; // Hata durumunda güvenli varsayılan
    }
  }

  /**
   * Tarama sayısını bir artırır ve kaydeder.
   * @param {number} currentCount Mevcut sayı
   */
  private async incrementScanCount(currentCount: number): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, (currentCount + 1).toString());
    } catch (error) {
      console.error('AdService Error (incrementScanCount):', error);
    }
  }

  /**
   * Reklam gösterilip gösterilmeyeceğine karar veren ana algoritma.
   * Strateji: İlk taramada göster (Zınk etkisi), ardından her 2 taramada bir tekrarla.
   * (1, 3, 5, 7... taramalarda reklam tetiklenir)
   * * @returns {Promise<boolean>} Reklam gösterilmeli mi?
   */
  public async shouldShowAd(): Promise<boolean> {
    try {
      const currentCount = await this.getScanCount();
      
      // Mantık: 
      // 0 (ilk tarama) -> GÖSTER (Zınk!)
      // 2, 4, 6... -> GÖSTER (Mod 2 kontrolü)
      const isInitialScan = currentCount === 0;
      const isEverySecondScan = currentCount > 0 && currentCount % 2 === 0;

      // Sayaç her durumda artırılır
      await this.incrementScanCount(currentCount);

      if (isInitialScan || isEverySecondScan) {
        return true;
      }

      return false;
    } catch (error) {
      // Beklenmedik bir hata durumunda kullanıcıyı bloklamamak için false dönülür
      return false;
    }
  }

  /**
   * Test veya özel durumlar için sayacı sıfırlama fonksiyonu.
   */
  public async resetCounter(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('AdService Error (resetCounter):', error);
    }
  }
}

// Singleton pattern ile dışa aktarıyoruz
export const adService = new AdService();