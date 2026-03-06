import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';

// 🔌 Config & Services & Utils
import { useTheme } from '../../context/ThemeContext';
import { adService } from '../../services/adService'; 
import { AD_UNIT_ID, GLOBAL_AD_CONFIG } from '../../config/admob';
import { barcodeDecoder } from '../../utils/barcodeDecoder';

const { width } = Dimensions.get('window');

/**
 * ErEnesAl® v1 - Profesyonel Barkod Tarayıcı ve Manuel Giriş Ekranı
 * Donanım hızlandırmalı tarama, akıllı reklam yönetimi ve manuel veri girişi sağlar.
 */
export const ScannerScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const isFocused = useIsFocused(); 

  // --- States ---
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<boolean>(false);
  const [torch, setTorch] = useState<boolean>(false);
  const [adLoaded, setAdLoaded] = useState<boolean>(false);
  
  // ⌨️ Manuel Giriş States
  const [isManualMode, setIsManualMode] = useState<boolean>(false);
  const [manualBarcode, setManualBarcode] = useState<string>('');
  const [manualError, setManualError] = useState<string>('');
  
  // --- Refs & Animations ---
  const interstitialRef = useRef<InterstitialAd | null>(null);
  const lineAnim = useRef(new Animated.Value(0)).current;

  /**
   * 💰 AdMob Interstitial (Geçiş Reklamı) Yönetimi
   */
  useEffect(() => {
    const interstitial = InterstitialAd.createForAdRequest(AD_UNIT_ID.INTERSTITIAL, GLOBAL_AD_CONFIG);
    
    const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
      setAdLoaded(true);
    });

    const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      setAdLoaded(false);
      interstitial.load(); 
    });

    interstitial.load();
    interstitialRef.current = interstitial;

    return () => {
      unsubscribeLoaded();
      unsubscribeClosed();
    };
  }, []);

  /**
   * 🎞️ Tarama Çizgisi Animasyonu
   */
  useEffect(() => {
    if (isFocused && !isManualMode) {
      const startAnimation = () => {
        lineAnim.setValue(0);
        Animated.loop(
          Animated.sequence([
            Animated.timing(lineAnim, { toValue: 240, duration: 2000, useNativeDriver: true }),
            Animated.timing(lineAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
          ])
        ).start();
      };
      startAnimation();
    }
  }, [isFocused, isManualMode, lineAnim]);

  /**
   * ⚙️ Çekirdek Barkod İşleme Motoru (Ortak Fonksiyon)
   * Hem kamera taramasından hem de manuel girişten gelen veriler buraya düşer.
   */
  const processBarcode = async (validBarcodeData: string) => {
    setScanned(true);

    try {
      const shouldShow = await adService.shouldShowAd();
      if (shouldShow && adLoaded && interstitialRef.current) {
        await interstitialRef.current.show();
      }
    } catch (e) {
      console.error("Ad showing failed:", e);
    } finally {
      setIsManualMode(false); // Manuel moddaysa kapat
      setManualBarcode('');   // Girdiyi temizle
      
      navigation.navigate('Detail', { barcode: validBarcodeData });
      setTimeout(() => setScanned(false), 2000);
    }
  };

  /**
   * 📸 Kameradan Gelen Veriyi Yakalama
   */
  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned || !isFocused || isManualMode) return;
    
    const decoded = barcodeDecoder.decode(data);
    if (!decoded.isValid) return; 

    processBarcode(decoded.normalizedData);
  };

  /**
   * ⌨️ Manuel Girilen Veriyi Yakalama ve Doğrulama
   */
  const handleManualSubmit = () => {
    Keyboard.dismiss();
    setManualError('');

    if (!manualBarcode.trim()) {
      setManualError(t('please_enter_barcode') || 'Lütfen barkod girin');
      return;
    }

    const decoded = barcodeDecoder.decode(manualBarcode.trim());
    if (!decoded.isValid) {
      setManualError(t('invalid_barcode') || 'Geçersiz barkod formatı');
      return;
    }

    processBarcode(decoded.normalizedData);
  };

  // --- İzin Kontrolleri ---
  if (!permission) return <View style={{ flex: 1, backgroundColor: '#000' }} />;
  
  if (!permission.granted) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="camera-reverse-outline" size={80} color={colors.primary} />
        <Text style={[styles.permissionText, { color: colors.text }]}>{t('camera_permission_required')}</Text>
        <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={requestPermission}>
          <Text style={styles.btnText}>{t('allow_camera').toUpperCase()}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isFocused && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          enableTorch={torch}
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"], 
          }}
        >
          {/* 🎯 Tarama Overlay (Maske) */}
          <View style={styles.overlay}>
            <View style={styles.darkArea} />
            <View style={styles.middleRow}>
              <View style={styles.darkArea} />
              
              <View style={[styles.scannerFrame, { borderColor: colors.primary }]}>
                {!isManualMode && (
                  <Animated.View 
                    style={[
                      styles.scanLine, 
                      { backgroundColor: colors.primary, transform: [{ translateY: lineAnim }] }
                    ]} 
                  />
                )}
                <View style={[styles.corner, styles.topLeft, { borderColor: colors.primary }]} />
                <View style={[styles.corner, styles.topRight, { borderColor: colors.primary }]} />
                <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.primary }]} />
                <View style={[styles.corner, styles.bottomRight, { borderColor: colors.primary }]} />
              </View>

              <View style={styles.darkArea} />
            </View>
            <View style={styles.darkArea}>
                <Text style={styles.infoText}>
                  {isManualMode ? '' : t('align_barcode_instruction')}
                </Text>
            </View>
          </View>

          {/* 🛠️ Donanım ve Menü Kontrolleri */}
          {!isManualMode && (
            <View style={styles.controls}>
              {/* Flaş */}
              <TouchableOpacity style={styles.controlBtn} onPress={() => setTorch(!torch)}>
                <Ionicons name={torch ? "flash" : "flash-off"} size={26} color={torch ? colors.primary : "#FFF"} />
              </TouchableOpacity>
              
              {/* Manuel Giriş Togglesi */}
              <TouchableOpacity style={styles.controlBtnCenter} onPress={() => setIsManualMode(true)}>
                <Ionicons name="keypad" size={32} color={colors.primary} />
              </TouchableOpacity>

              {/* Kapat */}
              <TouchableOpacity style={[styles.controlBtn, { backgroundColor: 'rgba(255,68,68,0.2)', borderColor: '#FF4444' }]} onPress={() => navigation.goBack()}>
                <Ionicons name="close" size={30} color="#FF4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* ⌨️ Manuel Giriş Overlay */}
          {isManualMode && (
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
              style={styles.manualOverlay}
            >
              <View style={[styles.manualCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.manualTitle, { color: colors.text }]}>
                  {t('manual_entry_title') || 'Barkodu Elle Girin'}
                </Text>
                
                <TextInput
                  style={[styles.input, { color: colors.text, borderColor: colors.border }]}
                  placeholder="8690000000000"
                  placeholderTextColor={colors.text + '50'}
                  keyboardType="number-pad"
                  value={manualBarcode}
                  onChangeText={(text) => {
                    setManualBarcode(text);
                    setManualError('');
                  }}
                  autoFocus
                />
                
                {manualError ? <Text style={styles.errorText}>{manualError}</Text> : null}

                <View style={styles.manualActions}>
                  <TouchableOpacity 
                    style={[styles.actionBtn, styles.cancelBtn]} 
                    onPress={() => {
                      setIsManualMode(false);
                      setManualError('');
                      setManualBarcode('');
                    }}
                  >
                    <Text style={styles.cancelBtnText}>{t('cancel') || 'İptal'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]} 
                    onPress={handleManualSubmit}
                  >
                    <Text style={styles.submitBtnText}>{t('search') || 'Sorgula'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}

        </CameraView>
      )}
    </View>
  );
};

// --- STİLLER ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  overlay: { flex: 1 },
  darkArea: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  middleRow: { flexDirection: 'row', height: 260 },
  scannerFrame: { width: 260, height: 260, borderWidth: 0.5, backgroundColor: 'transparent', position: 'relative', overflow: 'hidden' },
  scanLine: { height: 3, width: '100%', shadowColor: '#FFF', shadowOpacity: 0.5, shadowRadius: 10, elevation: 8 },
  corner: { position: 'absolute', width: 25, height: 25, borderWidth: 5 },
  topLeft: { top: -2, left: -2, borderRightWidth: 0, borderBottomWidth: 0 },
  topRight: { top: -2, right: -2, borderLeftWidth: 0, borderBottomWidth: 0 },
  bottomLeft: { bottom: -2, left: -2, borderRightWidth: 0, borderTopWidth: 0 },
  bottomRight: { bottom: -2, right: -2, borderLeftWidth: 0, borderTopWidth: 0 },
  infoText: { color: '#FFF', fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginTop: 30, letterSpacing: 1, opacity: 0.8 },
  
  // Kontroller
  controls: { position: 'absolute', bottom: 50, width: '100%', flexDirection: 'row', justifyContent: 'space-evenly', alignItems: 'center' },
  controlBtn: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  controlBtnCenter: { width: 75, height: 75, borderRadius: 37.5, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  
  // İzinler
  permissionText: { textAlign: 'center', marginVertical: 25, fontSize: 15, lineHeight: 22, opacity: 0.7 },
  btn: { paddingHorizontal: 40, paddingVertical: 18, borderRadius: 20 },
  btnText: { color: '#000', fontWeight: '900', fontSize: 14 },

  // Manuel Giriş Stilleri
  manualOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20, zIndex: 10 },
  manualCard: { width: '100%', maxWidth: 350, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  manualTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 20, textAlign: 'center', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, letterSpacing: 2, textAlign: 'center', marginBottom: 10 },
  errorText: { color: '#FF4444', fontSize: 13, textAlign: 'center', marginBottom: 15, fontWeight: '600' },
  manualActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cancelBtn: { backgroundColor: 'transparent', marginRight: 10, borderWidth: 1, borderColor: '#555' },
  cancelBtnText: { color: '#999', fontSize: 15, fontWeight: 'bold' },
  submitBtnText: { color: '#000', fontSize: 15, fontWeight: 'bold' }
});