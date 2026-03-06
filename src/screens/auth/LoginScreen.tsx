import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';

// Context & Config
import { auth } from '../../config/firebase';
import { useTheme } from '../../context/ThemeContext';

export const LoginScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  // Form States
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [secureText, setSecureText] = useState<boolean>(true);

  /**
   * Email ve Şifre ile Giriş Algoritması
   */
  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(t('error_title'), t('fill_all_fields'));
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // AuthContext üzerindeki onAuthStateChanged sayesinde otomatik yönlendirme tetiklenecektir.
    } catch (error: any) {
      console.error("Login Error:", error.code);
      let errorMessage = t('login_error_generic');
      
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = t('invalid_credentials');
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = t('invalid_email_format');
      }
      
      Alert.alert(t('error_title'), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Google Social Login (Firebase Integration)
   */
  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      // Not: Expo ortamında Google Login için 'expo-auth-session' veya 'expo-google-app-auth' kurulumu gereklidir.
      // Burada Firebase Auth yapısı kurgulanmıştır.
      console.log("Initiating Google Login...");
      // Buraya Google Sign-In yöntemi entegre edilecek.
    } catch (error) {
      Alert.alert(t('error_title'), t('social_login_error'));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Apple Social Login
   */
  const handleAppleLogin = async () => {
    try {
      console.log("Initiating Apple Login...");
      // Apple ID credential işlemleri buraya eklenecek.
    } catch (error) {
      Alert.alert(t('error_title'), t('social_login_error'));
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Logo & Header */}
        <View style={styles.headerSection}>
          <Text style={[styles.logo, { color: colors.primary }]}>{t('app_name')}</Text>
          <Text style={[styles.subtitle, { color: colors.text }]}>{t('login_subtitle')}</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={colors.primary} style={styles.inputIcon} />
            <TextInput
              placeholder={t('email')}
              placeholderTextColor="#777"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.primary} style={styles.inputIcon} />
            <TextInput
              placeholder={t('password')}
              placeholderTextColor="#777"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={secureText}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <TouchableOpacity onPress={() => setSecureText(!secureText)} style={styles.eyeIcon}>
              <Ionicons name={secureText ? "eye-off-outline" : "eye-outline"} size={20} color="#777" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.loginButton, { backgroundColor: colors.primary }]} 
            onPress={handleEmailLogin}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.loginButtonText}>{t('login').toUpperCase()}</Text>}
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.dividerContainer}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.text }]}>{t('or_continue_with')}</Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </View>

        {/* Social Buttons */}
        <View style={styles.socialContainer}>
          <TouchableOpacity style={[styles.socialButton, { borderColor: colors.border }]} onPress={handleGoogleLogin}>
            <Ionicons name="logo-google" size={24} color="#EA4335" />
          </TouchableOpacity>
          
          {Platform.OS === 'ios' && (
            <TouchableOpacity style={[styles.socialButton, { borderColor: colors.border }]} onPress={handleAppleLogin}>
              <Ionicons name="logo-apple" size={24} color={colors.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Footer */}
        <TouchableOpacity style={styles.footerLink} onPress={() => navigation.navigate('SignUp')}>
          <Text style={[styles.footerText, { color: colors.text }]}>
            {t('no_account')} <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{t('signup')}</Text>
          </Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 25 },
  headerSection: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 38, fontWeight: '900', letterSpacing: 2 },
  subtitle: { fontSize: 14, opacity: 0.7, marginTop: 5 },
  formSection: { width: '100%' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, position: 'relative' },
  inputIcon: { position: 'absolute', left: 15, zIndex: 1 },
  input: {
    flex: 1,
    height: 60,
    borderWidth: 1,
    borderRadius: 15,
    paddingLeft: 45,
    paddingRight: 50,
    fontSize: 16,
    backgroundColor: 'rgba(255,255,255,0.02)'
  },
  eyeIcon: { position: 'absolute', right: 15 },
  loginButton: {
    height: 60,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  loginButtonText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 30 },
  divider: { flex: 1, height: 1, opacity: 0.3 },
  dividerText: { marginHorizontal: 10, fontSize: 12, opacity: 0.5 },
  socialContainer: { flexDirection: 'row', justifyContent: 'center', gap: 20 },
  socialButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)'
  },
  footerLink: { marginTop: 40, alignItems: 'center' },
  footerText: { fontSize: 14 }
});