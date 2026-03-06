import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, Auth } from 'firebase/auth';

// 💡 KRİTİK HAMLE 3.0: TypeScript'in Firebase'deki bu bilinen tip hatasını 
// (type definition missing) görmezden gelmesi için ayrı bir import yapıyoruz.
// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';

import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
/**
 * ErEnesAl® v1 - Merkezi Firebase Konfigürasyonu
 */
const firebaseConfig = {
  apiKey: "AIzaSyCGQQASVvLt9XbXOt2GSb3Vlg5gf95IosU",
  authDomain: "barkodanaliz-5ed4b.firebaseapp.com",
  projectId: "barkodanaliz-5ed4b",
  storageBucket: "barkodanaliz-5ed4b.firebasestorage.app",
  messagingSenderId: "1054230654930",
  appId: "1:1054230654930:web:d9f0f54eb64f46747b620b"
};

// 1. App Singleton (Fast Refresh Optimizasyonu)
const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 2. Auth Servisi (Hatasız ve Kırmızı Çizgisiz)
const auth: Auth = (() => {
  try {
    // 💡 initializeAuth'u persistence ile ilk kez başlatıyoruz.
    // TypeScript'in Firebase tip uyumsuzluğu feryadını tek satırda susturuyoruz.
    // @ts-ignore
    const _auth = initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage)
    });
    return _auth;
  } catch (error) {
    // Expo hot-reload (Fast Refresh) tetiklendiğinde uygulama yeniden başlatılır.
    // Eğer auth zaten başlatılmışsa initializeAuth hata fırlatır, biz de catch bloğunda 
    // sorunsuz bir şekilde mevcut auth'u (getAuth) döndürürüz.
    return getAuth(app);
  }
})();

// 3. Firestore & Storage
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };