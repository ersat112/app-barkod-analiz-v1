import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// Core Services & Context
import { auth, db } from '../../config/firebase';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

/**
 * Ayarlar Satırı Bileşeni (Reusable UI Component)
 */
const SettingsItem = ({ icon, label, value, onPress, children, colors }: any) => (
  <TouchableOpacity 
    style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]} 
    onPress={onPress}
    disabled={!onPress}
  >
    <View style={styles.itemLeft}>
      <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <Text style={[styles.itemLabel, { color: colors.text }]}>{label}</Text>
    </View>
    {children ? children : (
      <View style={styles.itemRight}>
        {value && <Text style={[styles.itemValue, { color: colors.text }]}>{value}</Text>}
        <Ionicons name="chevron-forward" size={18} color={colors.border} />
      </View>
    )}
  </TouchableOpacity>
);

export const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors, isDark, setIsDark } = useTheme();
  const { locale, changeLanguage } = useLanguage();
  
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  /**
   * Firestore'dan Kullanıcı Bilgilerini Çekme (Ad, Soyad, Konum)
   */
  const fetchUserProfile = async () => {
    try {
      const user = auth.currentUser;
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data());
        }
      }
    } catch (error) {
      console.error("Profile Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Çıkış Yapma Protokolü
   */
  const handleLogout = () => {
    Alert.alert(t('logout_title'), t('logout_confirm_msg'), [
      { text: t('cancel'), style: 'cancel' },
      { 
        text: t('logout'), 
        style: 'destructive', 
        onPress: async () => {
          try {
            await signOut(auth);
          } catch (error) {
            Alert.alert(t('error_title'), t('logout_error'));
          }
        } 
      }
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      {/* 👤 Profil Kartı */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.primary }]}>{t('settings')}</Text>
      </View>

      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>
            {userData?.firstName ? userData.firstName[0].toUpperCase() : 'U'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Text style={[styles.userName, { color: colors.text }]}>
                {userData?.firstName} {userData?.lastName}
              </Text>
              <Text style={[styles.userMeta, { color: colors.text }]}>
                {userData?.city} / {userData?.district}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* ⚙️ Uygulama Ayarları */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('application_settings')}</Text>
      
      <SettingsItem icon="moon-outline" label={t('dark_mode')} colors={colors}>
        <Switch 
          value={isDark} 
          onValueChange={() => setIsDark(!isDark)}
          trackColor={{ false: '#767577', true: colors.primary }}
          thumbColor={Platform.OS === 'ios' ? '#FFF' : isDark ? colors.primary : '#f4f3f4'}
        />
      </SettingsItem>

      <View style={[styles.languageBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.itemLeft}>
          <View style={[styles.iconBox, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="language-outline" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.itemLabel, { color: colors.text }]}>{t('language')}</Text>
        </View>
        <View style={styles.langOptions}>
          {['tr', 'en', 'de', 'fr'].map((lang) => (
            <TouchableOpacity 
              key={lang} 
              style={[
                styles.langBtn, 
                { borderColor: locale === lang ? colors.primary : colors.border, backgroundColor: locale === lang ? colors.primary + '10' : 'transparent' }
              ]}
              onPress={() => changeLanguage(lang)}
            >
              <Text style={[styles.langText, { color: locale === lang ? colors.primary : colors.text }]}>
                {lang.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ℹ️ Destek & Bilgi */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('support_info')}</Text>
      
      <SettingsItem icon="shield-checkmark-outline" label={t('privacy_policy')} colors={colors} onPress={() => Linking.openURL('https://erenesal.com/privacy')} />
      <SettingsItem icon="information-circle-outline" label={t('about_app')} colors={colors} value="v1.0.4" />
      <SettingsItem icon="mail-outline" label={t('contact_us')} colors={colors} onPress={() => Linking.openURL('mailto:destek@erenesal.com')} />

      {/* 🚪 Çıkış Butonu */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={22} color="#FF4444" />
        <Text style={styles.logoutText}>{t('logout')}</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.text }]}>ErEnesAl® v1.0.4</Text>
        <Text style={[styles.footerSub, { color: colors.text }]}>Made for Health with Intelligence</Text>
      </View>
      
      <View style={{ height: 50 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingHorizontal: 25, marginBottom: 20 },
  headerTitle: { fontSize: 32, fontWeight: '900', letterSpacing: 1 },
  profileCard: { marginHorizontal: 25, padding: 20, borderRadius: 20, flexDirection: 'row', alignItems: 'center', borderWidth: 1, marginBottom: 30 },
  avatar: { width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 24, fontWeight: '900', color: '#000' },
  profileInfo: { marginLeft: 15 },
  userName: { fontSize: 18, fontWeight: 'bold' },
  userMeta: { fontSize: 12, opacity: 0.6, marginTop: 4 },
  sectionTitle: { marginHorizontal: 25, fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase', opacity: 0.5, letterSpacing: 1, marginBottom: 12 },
  item: { marginHorizontal: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  itemLeft: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  itemLabel: { fontSize: 15, fontWeight: '600' },
  itemRight: { flexDirection: 'row', alignItems: 'center' },
  itemValue: { fontSize: 14, opacity: 0.5, marginRight: 8 },
  languageBox: { marginHorizontal: 25, padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  langOptions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  langBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, width: '22%', alignItems: 'center' },
  langText: { fontSize: 12, fontWeight: 'bold' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 30, padding: 20 },
  logoutText: { color: '#FF4444', fontSize: 16, fontWeight: 'bold', marginLeft: 10 },
  footer: { alignItems: 'center', marginTop: 20, opacity: 0.3 },
  footerText: { fontSize: 12, fontWeight: 'bold' },
  footerSub: { fontSize: 10, marginTop: 4 }
});