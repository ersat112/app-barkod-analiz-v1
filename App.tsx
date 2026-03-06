import React, { useEffect } from 'react';
import { LogBox, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import mobileAds from 'react-native-google-mobile-ads';

// 🔌 Firebase Initialization
// firebase.ts içindeki Singleton yapısının uygulama ayağa kalkarken tetiklenmesini sağlar.
import './src/config/firebase';

// 🧠 Context Providers
// Veri akışının hiyerarşik ve tutarlı olması için doğru sarmalama sırası uygulanmıştır.
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider } from './src/context/ThemeContext';
import { LanguageProvider } from './src/context/LanguageContext';

// 🚦 Navigation Center
import { AppNavigator } from './src/navigation/AppNavigator';

/**
 * ErEnesAl® v1 - Ana Giriş Bileşeni (Entry Point)
 * Bu bileşen, uygulamanın tüm global state ve servis yönetimini üstlenir.
 */
export default function App() {
  
  useEffect(() => {
    /**
     * 💰 Google Mobile Ads Başlatma
     * Uygulama açıldığında reklam SDK'sını native katmanda hazırlar.
     * 'initialize' işlemi asenkrondur ve uygulamanın açılış hızını etkilemez.
     */
    const initAds = async () => {
      try {
        const adapterStatuses = await mobileAds().initialize();
        console.log('AdMob Başlatıldı:', adapterStatuses);
      } catch (error) {
        console.error('AdMob Başlatma Hatası:', error);
      }
    };

    initAds();

    /**
     * ⚙️ Geliştirme Günlüğü Yönetimi
     * Firebase ve Timer kaynaklı, performansı etkilemeyen bazı uyarıları temizler.
     */
    LogBox.ignoreLogs([
      'Setting a timer',
      'AsyncStorage has been extracted from react-native core',
      'Non-serializable values were found in the navigation state'
    ]);
  }, []);

  return (
    /**
     * 🟢 GestureHandlerRootView:
     * 'Swipe-to-delete' gibi karmaşık dokunmatik hareketlerin Android/iOS'ta 
     * pürüzsüz çalışması için en dış katman olmalıdır.
     */
    <GestureHandlerRootView style={styles.container}>
      
      {/* 🌍 Dil ve Yerelleştirme Katmanı */}
      <LanguageProvider>
        
        {/* 🎨 Tema ve Karanlık Mod Katmanı */}
        <ThemeProvider>
          
          {/* 🔐 Oturum ve Yetkilendirme Katmanı */}
          <AuthProvider>
            
            {/* 🚦 Navigasyon ve Ekran Yönetimi */}
            <AppNavigator />
            
            {/* 🔋 Durum Çubuğu Ayarı (Temaya Göre Otomatik Değişir) */}
            <StatusBar style="auto" />
            
          </AuthProvider>
          
        </ThemeProvider>
        
      </LanguageProvider>
      
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});