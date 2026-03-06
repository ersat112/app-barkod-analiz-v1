import React, { useEffect, useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';

// 🔌 Core Services & Stores
import { fetchFoodProduct } from '../../api/foodApi';
import { fetchBeautyProduct } from '../../api/beautyApi';
import { analyzeProduct } from '../../utils/analysis';
import { saveProductToHistory } from '../../services/db';
import { useTheme } from '../../context/ThemeContext';
import { useScanStore } from '../../store/useScanStore';
import { barcodeDecoder } from '../../utils/barcodeDecoder';
import { AD_UNIT_ID, GLOBAL_AD_CONFIG } from '../../config/admob';
import { RootStackParamList } from '../../navigation/AppNavigator';

const { width } = Dimensions.get('window');

export const DetailScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  
  // 🛡️ v7 Tip Güvenliği
  const route = useRoute<RouteProp<RootStackParamList, 'Detail'>>();
  const { barcode } = route.params;

  // 🧠 Zustand Store
  const { setAnalysis, currentProduct, currentAnalysis } = useScanStore();
  
  const [loading, setLoading] = useState<boolean>(!currentProduct || currentProduct.barcode !== barcode);
  const [error, setError] = useState<string | null>(null);

  const originInfo = useMemo(() => barcodeDecoder.decode(barcode), [barcode]);

  useEffect(() => {
    if (currentProduct?.barcode === barcode) {
      setLoading(false);
      return;
    }
    loadProductSequence();
  }, [barcode]);

  const loadProductSequence = async () => {
    try {
      setLoading(true);
      // Önce gıda API'si, bulunamazsa kozmetik API'si denenir.
      let data = await fetchFoodProduct(barcode);
      if (!data) {
        data = await fetchBeautyProduct(barcode);
      }
      
      if (!data) {
        setError(t('product_not_found'));
        return;
      }

      const result = analyzeProduct(data);
      setAnalysis(data, result);
      saveProductToHistory(data, result.score);
    } catch (err) {
      setError(t('error_generic'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 📤 Gelişmiş Paylaşım Fonksiyonu (Hata Düzeltilmiş Sürüm)
   * Optional Chaining (?.) ve Fallback (??) ile null hataları engellenmiştir.
   */
  const handleShare = async () => {
    // Önce verinin varlığını kontrol et
    if (!currentProduct || !currentAnalysis) {
      Alert.alert(t('error_title'), t('data_not_ready'));
      return;
    }

    try {
      // 💡 ÇÖZÜM: Değerler null gelse bile boş string veya 0 basarak hata almayı engelliyoruz.
      const brand = currentProduct.brand ?? 'Bilinmeyen Marka';
      const name = currentProduct.name ?? 'İsimsiz Ürün';
      const risk = currentAnalysis.riskLevel ?? 'Belirsiz';

      const shareMessage = `${brand} - ${name} | ${t('app_name')} Raporu\nAnaliz: ${risk} Risk`;
      
      await Share.share({
        message: shareMessage,
      });
    } catch (err) {
      Alert.alert(t('error_title'), t('share_error'));
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.primary }]}>{t('analyzing').toUpperCase()}</Text>
      </View>
    );
  }

  if (error || !currentProduct) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle-outline" size={80} color={colors.border} />
        <Text style={[styles.errorText, { color: colors.text }]}>{error || t('product_not_found')}</Text>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.primary }]} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>{t('go_back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        
        {/* 🖼️ Hero Alanı */}
        <View style={[styles.imageSection, { backgroundColor: isDark ? '#111' : '#F8F8F8' }]}>
          <Image 
            source={{ uri: currentProduct.image_url || 'https://via.placeholder.com/400' }} 
            style={styles.productImage} 
          />
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={26} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={26} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.originBadge}>
            <Ionicons name="globe-outline" size={14} color="#FFF" />
            <Text style={styles.originText}>{originInfo.country || t('international')}</Text>
          </View>
        </View>

        {/* 📝 Analiz Bilgileri */}
        <View style={styles.content}>
          <Text style={[styles.brandName, { color: colors.primary }]}>{currentProduct.brand}</Text>
          <Text style={[styles.productName, { color: colors.text }]}>{currentProduct.name}</Text>

          {/* 🎯 Skor Kartı */}
          <View style={[styles.analysisCard, { backgroundColor: (currentAnalysis?.color ?? '#888') + '15', borderColor: currentAnalysis?.color ?? '#888' }]}>
            <View style={[styles.gradeCircle, { backgroundColor: currentAnalysis?.color ?? '#888' }]}>
              <Text style={styles.gradeText}>{currentProduct.grade?.toUpperCase() || '?'}</Text>
            </View>
            <View style={styles.analysisInfo}>
              <Text style={[styles.riskTitle, { color: currentAnalysis?.color ?? '#888' }]}>
                {(currentAnalysis?.riskLevel ?? 'Bilinmiyor').toUpperCase()} RİSK
              </Text>
              <Text style={[styles.recommendationText, { color: colors.text }]}>
                {currentAnalysis?.recommendation ?? t('no_recommendation')}
              </Text>
            </View>
          </View>

          {/* 🧪 Katkı Maddeleri Listesi */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('additives')}</Text>
            <View style={[styles.countBadge, { backgroundColor: currentAnalysis?.color ?? colors.primary }]}>
               <Text style={styles.countText}>{currentAnalysis?.foundECodes?.length ?? 0}</Text>
            </View>
          </View>

          {currentAnalysis?.foundECodes && currentAnalysis.foundECodes.length > 0 ? (
            currentAnalysis.foundECodes.map((item, index) => (
              <View 
                key={`${item.code}-${index}`} 
                style={[styles.additiveItem, { backgroundColor: colors.card, borderLeftColor: item.risk === 'Yüksek' ? '#FF4444' : '#FFD700' }]}
              >
                <View style={styles.additiveMain}>
                  <Text style={[styles.additiveName, { color: colors.text }]}>{item.code} - {item.name}</Text>
                  <Text style={[styles.additiveRisk, { color: item.risk === 'Yüksek' ? '#FF4444' : '#FFD700' }]}>{t(`risk_${item.risk.toLowerCase()}`)}</Text>
                </View>
                <Text style={[styles.additiveImpact, { color: colors.text }]}>{item.impact}</Text>
              </View>
            ))
          ) : (
            <View style={styles.cleanContentBox}>
              <Ionicons name="shield-checkmark-outline" size={50} color="#1ED760" />
              <Text style={[styles.cleanText, { color: colors.text }]}>{t('clean_content_detected')}</Text>
            </View>
          )}

          {/* 📋 İçerik Listesi */}
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 35 }]}>{t('ingredients')}</Text>
          <View style={[styles.ingredientsBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.ingredientsText, { color: colors.text }]}>
              {currentProduct.ingredients_text || t('no_ingredients_info')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* 💰 Reklam Alanı */}
      <View style={styles.adContainer}>
        <BannerAd unitId={AD_UNIT_ID.BANNER} size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} requestOptions={GLOBAL_AD_CONFIG} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 15, fontSize: 10, fontWeight: '900', letterSpacing: 4 },
  imageSection: { width: width, height: 380, justifyContent: 'center', alignItems: 'center' },
  productImage: { width: '80%', height: '80%', resizeMode: 'contain' },
  headerActions: { position: 'absolute', top: 55, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  iconBtn: { padding: 12, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)' },
  originBadge: { position: 'absolute', bottom: 25, left: 25, flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 },
  originText: { color: '#FFF', fontSize: 12, fontWeight: 'bold', marginLeft: 6 },
  content: { padding: 25 },
  brandName: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 2 },
  productName: { fontSize: 28, fontWeight: '900', marginTop: 5, marginBottom: 25 },
  analysisCard: { flexDirection: 'row', padding: 22, borderRadius: 25, borderLeftWidth: 10, marginBottom: 35 },
  gradeCircle: { width: 65, height: 65, borderRadius: 32.5, justifyContent: 'center', alignItems: 'center' },
  gradeText: { color: '#000', fontSize: 30, fontWeight: '900' },
  analysisInfo: { flex: 1, marginLeft: 20, justifyContent: 'center' },
  riskTitle: { fontSize: 15, fontWeight: '900', marginBottom: 6 },
  recommendationText: { fontSize: 13, lineHeight: 19, opacity: 0.8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 19, fontWeight: '900' },
  countBadge: { marginLeft: 12, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3 },
  countText: { color: '#000', fontSize: 12, fontWeight: 'bold' },
  additiveItem: { padding: 20, borderRadius: 22, marginBottom: 15, borderLeftWidth: 6 },
  additiveMain: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  additiveName: { fontSize: 16, fontWeight: 'bold' },
  additiveRisk: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  additiveImpact: { fontSize: 13, lineHeight: 22, opacity: 0.7 },
  cleanContentBox: { alignItems: 'center', padding: 45, gap: 15 },
  cleanText: { fontWeight: '800', fontSize: 16, textAlign: 'center' },
  ingredientsBox: { padding: 20, borderRadius: 22, borderWidth: 1, borderStyle: 'dashed' },
  ingredientsText: { fontSize: 14, lineHeight: 26, opacity: 0.6 },
  adContainer: { position: 'absolute', bottom: 0, width: '100%', alignItems: 'center' },
  errorText: { marginTop: 25, fontSize: 16, textAlign: 'center', opacity: 0.6 },
  backBtn: { marginTop: 35, paddingHorizontal: 45, paddingVertical: 18, borderRadius: 22 },
  backBtnText: { color: '#000', fontWeight: 'bold' }
});
