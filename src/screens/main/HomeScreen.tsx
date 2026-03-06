import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

// Core Services & Contexts
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { getTodayScanCount } from '../../services/db';

const { width } = Dimensions.get('window');

/**
 * ErEnesAl® v1 Ana Ekran Bileşeni
 * Kullanıcıyı karşılayan, günlük analiz özetini sunan ve tarayıcıya yönlendiren merkez.
 */
export const HomeScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  
  const [todayCount, setTodayCount] = useState<number>(0);

  /**
   * Ekran her odaklandığında SQLite üzerinden bugünkü tarama verisini yenile.
   * Bu, kullanıcının tarama yaptıktan sonra ana ekrana döndüğünde güncel skoru görmesini sağlar.
   */
  useFocusEffect(
    useCallback(() => {
      const fetchStats = async () => {
        const count = await getTodayScanCount();
        setTodayCount(count);
      };
      fetchStats();
    }, [])
  );

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      {/* ✋ Karşılama Bölümü */}
      <View style={styles.header}>
        <Text style={[styles.welcomeText, { color: colors.text }]}>{t('welcome')},</Text>
        <Text style={[styles.userName, { color: colors.primary }]}>
          {user?.email?.split('@')[0] || 'ErEnesAl Kullanıcısı'}
        </Text>
      </View>

      {/* 📊 Günlük İstatistik Kartı */}
      <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.statIconBox, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="bar-chart" size={30} color={colors.primary} />
        </View>
        <View style={styles.statInfo}>
          <Text style={[styles.statLabel, { color: colors.text }]}>{t('today_scans')}</Text>
          <Text style={[styles.statValue, { color: colors.primary }]}>
            {todayCount} <Text style={{ fontSize: 16, fontWeight: 'normal' }}>Ürün</Text>
          </Text>
        </View>
      </View>

      {/* 🚀 Ana Aksiyon (CTA) Butonu */}
      <TouchableOpacity 
        style={[styles.mainActionBtn, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('Scanner')}
        activeOpacity={0.9}
      >
        <View style={styles.btnContent}>
          <Ionicons name="barcode-outline" size={32} color="#000" />
          <Text style={styles.mainActionText}>{t('scan_now').toUpperCase()}</Text>
        </View>
        <Ionicons name="arrow-forward" size={24} color="#000" />
      </TouchableOpacity>

      {/* 💡 Bilgi Köşesi (Insight) */}
      <View style={[styles.insightBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.insightHeader}>
          <Ionicons name="bulb-outline" size={20} color={colors.primary} />
          <Text style={[styles.insightTitle, { color: colors.primary }]}>Biliyor muydunuz?</Text>
        </View>
        <Text style={[styles.insightText, { color: colors.text }]}>
          Gıda ürünlerindeki E621 (MSG) katkı maddesi, lezzet artırıcı olarak kullanılır ancak hassas bünyelerde "Çin Restoranı Sendromu" belirtilerine yol açabilir.
        </Text>
      </View>

      {/* 🛡️ Marka Güvencesi Alt Bilgi */}
      <View style={styles.footerBrand}>
        <Ionicons name="shield-checkmark-sharp" size={16} color={colors.primary} />
        <Text style={[styles.footerText, { color: colors.text }]}>AI DESTEKLİ GIDA GÜVENLİK ANALİZİ</Text>
      </View>

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 25, paddingTop: 70, paddingBottom: 100 },
  header: { marginBottom: 35 },
  welcomeText: { fontSize: 18, fontWeight: '300', opacity: 0.8 },
  userName: { fontSize: 32, fontWeight: '900', textTransform: 'capitalize', letterSpacing: -0.5 },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 25,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  statIconBox: { width: 60, height: 60, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  statInfo: { marginLeft: 20 },
  statLabel: { fontSize: 13, fontWeight: 'bold', opacity: 0.5, textTransform: 'uppercase', letterSpacing: 1 },
  statValue: { fontSize: 32, fontWeight: '900', marginTop: 2 },
  mainActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 22,
    borderRadius: 22,
    marginBottom: 35,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  btnContent: { flexDirection: 'row', alignItems: 'center' },
  mainActionText: { color: '#000', fontSize: 20, fontWeight: '900', marginLeft: 15, letterSpacing: 1 },
  insightBox: { padding: 20, borderRadius: 20, borderWidth: 1, borderLeftWidth: 6, borderLeftColor: '#FFD700' },
  insightHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  insightTitle: { fontWeight: 'bold', fontSize: 15, textTransform: 'uppercase' },
  insightText: { fontSize: 14, lineHeight: 22, opacity: 0.8 },
  footerBrand: { marginTop: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: 0.3 },
  footerText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 2 },
});