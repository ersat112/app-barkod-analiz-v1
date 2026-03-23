import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  GoogleAuthProvider,
  OAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
} from 'firebase/auth';

import { auth } from '../../config/firebase';
import { useTheme } from '../../context/ThemeContext';
import { authAnalyticsService } from '../../services/authAnalytics.service';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_IDS = {
  android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '',
  ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '',
  web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '',
};

const isGoogleConfiguredForPlatform = (): boolean => {
  if (Platform.OS === 'android') return !!GOOGLE_CLIENT_IDS.android;
  if (Platform.OS === 'ios') return !!GOOGLE_CLIENT_IDS.ios;
  return !!GOOGLE_CLIENT_IDS.web;
};

const randomNonce = (length = 32): string => {
  const chars =
    '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';

  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return result;
};

type SocialButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  textColor?: string;
  backgroundColor?: string;
  borderColor?: string;
};

const SocialButton: React.FC<SocialButtonProps> = ({
  icon,
  label,
  onPress,
  disabled = false,
  loading = false,
  textColor = '#111',
  backgroundColor = '#FFF',
  borderColor = '#DDD',
}) => {
  return (
    <TouchableOpacity
      activeOpacity={disabled ? 1 : 0.86}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.socialButton,
        {
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Ionicons name={icon} size={20} color={textColor} />
      )}
      <Text style={[styles.socialButtonText, { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
};

type GoogleAuthSectionProps = {
  label: string;
};

const GoogleAuthSection: React.FC<GoogleAuthSectionProps> = ({ label }) => {
  const [loading, setLoading] = useState(false);

  const config = useMemo(
    () => ({
      androidClientId: GOOGLE_CLIENT_IDS.android || undefined,
      iosClientId: GOOGLE_CLIENT_IDS.ios || undefined,
      webClientId: GOOGLE_CLIENT_IDS.web || undefined,
    }),
    []
  );

  const [request, response, promptAsync] = Google.useAuthRequest(config);

  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (response?.type !== 'success') return;

      try {
        setLoading(true);

        const idToken =
          response.authentication?.idToken ||
          (typeof response.params?.id_token === 'string' ? response.params.id_token : null);

        const accessToken =
          response.authentication?.accessToken ||
          (typeof response.params?.access_token === 'string'
            ? response.params.access_token
            : null);

        if (!idToken && !accessToken) {
          await authAnalyticsService.trackLoginFailed({
            method: 'google',
            surface: 'login',
            error: 'google_credential_missing',
          });

          Alert.alert('Hata', 'Google kimlik doğrulama bilgisi alınamadı.');
          return;
        }

        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        const userCredential = await signInWithCredential(auth, credential);

        await authAnalyticsService.trackLoginSucceeded({
          method: 'google',
          surface: 'login',
          emailVerified: userCredential.user.emailVerified,
        });
      } catch (error: any) {
        console.error('Google login failed:', error);

        await authAnalyticsService.trackLoginFailed({
          method: 'google',
          surface: 'login',
          error,
          errorCode: error?.code,
        });

        Alert.alert('Hata', error?.message || 'Google ile giriş başarısız oldu.');
      } finally {
        setLoading(false);
      }
    };

    void handleGoogleResponse();
  }, [response]);

  return (
    <SocialButton
      icon="logo-google"
      label={label}
      onPress={() => promptAsync()}
      disabled={!request}
      loading={loading}
      backgroundColor="#FFFFFF"
      borderColor="#E5E5E5"
      textColor="#111111"
    />
  );
};

export const LoginScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [securePassword, setSecurePassword] = useState(true);
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);

  const isGoogleEnabled = useMemo(() => isGoogleConfiguredForPlatform(), []);
  const isFormValid = email.trim().length > 0 && password.trim().length > 0;

  const handleEmailLogin = useCallback(async () => {
    if (!isFormValid) {
      Alert.alert(
        tt('error_title', 'Hata'),
        tt('fill_all_fields', 'Lütfen tüm zorunlu alanları doldurun.')
      );
      return;
    }

    try {
      setLoading(true);
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await authAnalyticsService.trackLoginSucceeded({
        method: 'password',
        surface: 'login',
        emailVerified: userCredential.user.emailVerified,
      });
    } catch (error: any) {
      console.error('Login failed:', error);

      await authAnalyticsService.trackLoginFailed({
        method: 'password',
        surface: 'login',
        error,
        errorCode: error?.code,
      });

      let message = tt('login_error_generic', 'Giriş sırasında bir hata oluştu.');

      if (error?.code === 'auth/invalid-email') {
        message = tt('invalid_email_format', 'Geçersiz e-posta formatı.');
      } else if (
        error?.code === 'auth/invalid-credential' ||
        error?.code === 'auth/user-not-found' ||
        error?.code === 'auth/wrong-password'
      ) {
        message = tt('invalid_credentials', 'E-posta veya şifre hatalı.');
      } else if (error?.code === 'auth/network-request-failed') {
        message = tt('network_error', 'Ağ bağlantısı hatası.');
      } else if (error?.code === 'auth/too-many-requests') {
        message = tt(
          'too_many_requests',
          'Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.'
        );
      }

      Alert.alert(tt('error_title', 'Hata'), message);
    } finally {
      setLoading(false);
    }
  }, [email, isFormValid, password, tt]);

  const handleAppleLogin = useCallback(async () => {
    try {
      setAppleLoading(true);

      const rawNonce = randomNonce();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!appleCredential.identityToken) {
        await authAnalyticsService.trackLoginFailed({
          method: 'apple',
          surface: 'login',
          error: 'apple_identity_token_missing',
        });

        Alert.alert('Hata', 'Apple kimlik doğrulama bilgisi alınamadı.');
        return;
      }

      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({
        idToken: appleCredential.identityToken,
        rawNonce,
      });

      const userCredential = await signInWithCredential(auth, credential);

      await authAnalyticsService.trackLoginSucceeded({
        method: 'apple',
        surface: 'login',
        emailVerified: userCredential.user.emailVerified,
      });
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }

      console.error('Apple login failed:', error);

      await authAnalyticsService.trackLoginFailed({
        method: 'apple',
        surface: 'login',
        error,
        errorCode: error?.code,
      });

      Alert.alert('Hata', error?.message || 'Apple ile giriş başarısız oldu.');
    } finally {
      setAppleLoading(false);
    }
  }, []);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={[styles.logoWrap, { backgroundColor: `${colors.primary}15` }]}>
            <Ionicons name="barcode-outline" size={48} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.primary }]}>
            {tt('app_name', 'ErEnesAl®')}
          </Text>

          <Text style={[styles.subtitle, { color: colors.text }]}>
            {tt('login_subtitle', 'Sağlıklı seçimler için ilk adımınız')}
          </Text>
        </View>

        <View
          style={[
            styles.formCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.label, { color: colors.text }]}>
            {tt('email', 'E-posta Adresi')}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: isDark ? '#181818' : '#FAFAFA',
              },
            ]}
            placeholder={tt('email', 'E-posta Adresi')}
            placeholderTextColor={`${colors.text}55`}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />

          <Text style={[styles.label, { color: colors.text }]}>
            {tt('password', 'Şifre')}
          </Text>
          <View
            style={[
              styles.passwordWrap,
              {
                borderColor: colors.border,
                backgroundColor: isDark ? '#181818' : '#FAFAFA',
              },
            ]}
          >
            <TextInput
              style={[styles.passwordInput, { color: colors.text }]}
              placeholder={tt('password', 'Şifre')}
              placeholderTextColor={`${colors.text}55`}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={securePassword}
              autoCapitalize="none"
              textContentType="password"
            />
            <Pressable onPress={() => setSecurePassword((prev) => !prev)}>
              <Ionicons
                name={securePassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={colors.text}
              />
            </Pressable>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              {
                backgroundColor: isFormValid ? colors.primary : colors.border,
                opacity: loading ? 0.7 : 1,
              },
            ]}
            onPress={handleEmailLogin}
            disabled={!isFormValid || loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {tt('login', 'Giriş Yap')}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.text }]}>
              {tt('or_continue_with', 'veya şununla devam et')}
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {isGoogleEnabled ? (
            <GoogleAuthSection label={tt('google_sign_in', 'Google ile Giriş')} />
          ) : (
            <SocialButton
              icon="logo-google"
              label={tt('google_sign_in', 'Google ile Giriş')}
              disabled
              backgroundColor="#FFFFFF"
              borderColor="#E5E5E5"
              textColor="#111111"
            />
          )}

          {Platform.OS === 'ios' ? (
            <View style={styles.appleButtonWrap}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={
                  isDark
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={16}
                style={styles.appleButton}
                onPress={appleLoading ? () => undefined : handleAppleLogin}
              />
              {appleLoading ? (
                <View style={styles.appleLoadingOverlay}>
                  <ActivityIndicator size="small" color={isDark ? '#000' : '#FFF'} />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.footerRow}>
          <Text style={[styles.footerText, { color: colors.text }]}>
            {tt('no_account', 'Hesabınız yok mu?')}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={[styles.footerLink, { color: colors.primary }]}>
              {tt('signup', 'Kayıt Ol')}
            </Text>
          </TouchableOpacity>
        </View>

        {!isGoogleEnabled ? (
          <Text style={[styles.helperText, { color: colors.text }]}>
            {tt(
              'social_login_not_configured',
              'Sosyal giriş henüz yapılandırılmadı.'
            )}
          </Text>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 68,
    paddingBottom: 40,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 26,
  },
  logoWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    opacity: 0.72,
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
  },
  label: {
    marginBottom: 8,
    marginTop: 6,
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    marginBottom: 10,
  },
  passwordWrap: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 14,
    paddingRight: 10,
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 18,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.64,
  },
  socialButton: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  appleButtonWrap: {
    marginTop: 2,
    position: 'relative',
  },
  appleButton: {
    width: '100%',
    height: 54,
  },
  appleLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    opacity: 0.75,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '900',
  },
  helperText: {
    marginTop: 16,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.64,
  },
});