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

import { AUTH_RUNTIME, getGoogleAuthRedirectUri } from '../../config/authRuntime';
import { auth } from '../../config/firebase';
import { useTheme } from '../../context/ThemeContext';
import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import { authAnalyticsService } from '../../services/authAnalytics.service';
import { withAlpha } from '../../utils/color';

WebBrowser.maybeCompleteAuthSession();

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
  errorTitle: string;
  missingCredentialMessage: string;
  failureFallbackMessage: string;
  providerDisabledMessage: string;
};

const GoogleAuthSection: React.FC<GoogleAuthSectionProps> = ({
  label,
  errorTitle,
  missingCredentialMessage,
  failureFallbackMessage,
  providerDisabledMessage,
}) => {
  const [loading, setLoading] = useState(false);
  const redirectUri = useMemo(() => getGoogleAuthRedirectUri(), []);

  const config = useMemo(
    () => ({
      androidClientId: AUTH_RUNTIME.google.androidClientId || undefined,
      iosClientId: AUTH_RUNTIME.google.iosClientId || undefined,
      webClientId: AUTH_RUNTIME.google.webClientId || undefined,
      redirectUri,
      scopes: ['profile', 'email'],
    }),
    [redirectUri]
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

          Alert.alert(errorTitle, missingCredentialMessage);
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

        const message =
          error?.code === 'auth/operation-not-allowed'
            ? providerDisabledMessage
            : error?.message || failureFallbackMessage;

        Alert.alert(errorTitle, message);
      } finally {
        setLoading(false);
      }
    };

    void handleGoogleResponse();
  }, [
    errorTitle,
    failureFallbackMessage,
    missingCredentialMessage,
    providerDisabledMessage,
    response,
  ]);

  return (
    <SocialButton
      icon="logo-google"
      label={label}
      onPress={() =>
        promptAsync({
          showInRecents: true,
        })
      }
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

  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === 'ios');
  const isGoogleEnabled = useMemo(
    () => AUTH_RUNTIME.google.hasActivePlatformClientId,
    []
  );
  const isFormValid = email.trim().length > 0 && password.trim().length > 0;

  useEffect(() => {
    let mounted = true;

    if (Platform.OS !== 'ios') {
      setAppleAvailable(false);
      return () => {
        mounted = false;
      };
    }

    void AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (mounted) {
          setAppleAvailable(available);
        }
      })
      .catch((error) => {
        console.warn('Apple auth availability check failed:', error);

        if (mounted) {
          setAppleAvailable(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

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

        Alert.alert(
          tt('error_title', 'Hata'),
          tt('apple_auth_missing', 'Apple kimlik doğrulama bilgisi alınamadı.')
        );
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

      const message =
        error?.code === 'auth/operation-not-allowed'
          ? tt(
              'apple_provider_disabled',
              'Apple ile giriş Firebase üzerinde etkin değil.'
            )
          : error?.message || tt('apple_login_failed', 'Apple ile giriş başarısız oldu.');

      Alert.alert(
        tt('error_title', 'Hata'),
        message
      );
    } finally {
      setAppleLoading(false);
    }
  }, [tt]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AmbientBackdrop colors={colors} variant="auth" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              styles.heroCard,
              {
                backgroundColor: withAlpha(colors.card, 'F2'),
                borderColor: withAlpha(colors.border, 'B8'),
                shadowColor: colors.shadow,
              },
            ]}
          >
            <View style={styles.heroBadgeRow}>
              <View
                style={[
                  styles.heroBadge,
                  { backgroundColor: withAlpha(colors.primary, '14') },
                ]}
              >
                <Text style={[styles.heroBadgeText, { color: colors.primary }]}>
                  {tt('login', 'Giriş Yap')}
                </Text>
              </View>

              <View
                style={[
                  styles.heroBadge,
                  { backgroundColor: withAlpha(colors.teal, '14') },
                ]}
              >
                <Text style={[styles.heroBadgeText, { color: colors.teal }]}>
                  {Platform.OS.toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.hero}>
              <View
                style={[
                  styles.logoWrap,
                  { backgroundColor: withAlpha(colors.primary, '14') },
                ]}
              >
                <Ionicons name="barcode-outline" size={48} color={colors.primary} />
              </View>

              <Text style={[styles.title, { color: colors.primary }]}>
                {tt('app_name', 'ErEnesAl®')}
              </Text>

              <Text style={[styles.subtitle, { color: colors.mutedText }]}>
                {tt('login_subtitle', 'Sağlıklı seçimler için ilk adımınız')}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.formCard,
              {
                backgroundColor: withAlpha(colors.cardElevated, 'F2'),
                borderColor: withAlpha(colors.border, 'B8'),
                shadowColor: colors.shadow,
              },
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
                borderColor: withAlpha(colors.border, 'CC'),
                backgroundColor: withAlpha(colors.backgroundMuted, isDark ? 'D6' : 'F4'),
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
                borderColor: withAlpha(colors.border, 'CC'),
                backgroundColor: withAlpha(colors.backgroundMuted, isDark ? 'D6' : 'F4'),
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
                shadowColor: colors.shadow,
              },
            ]}
            onPress={handleEmailLogin}
            disabled={!isFormValid || loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primaryContrast} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: colors.primaryContrast }]}>
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
            <GoogleAuthSection
              label={tt('google_sign_in', 'Google ile Giriş')}
              errorTitle={tt('error_title', 'Hata')}
              missingCredentialMessage={tt(
                'google_auth_missing',
                'Google kimlik doğrulama bilgisi alınamadı.'
              )}
              failureFallbackMessage={tt(
                'google_login_failed',
                'Google ile giriş başarısız oldu.'
              )}
              providerDisabledMessage={tt(
                'google_provider_disabled',
                'Google ile giriş Firebase üzerinde etkin değil.'
              )}
            />
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

          {Platform.OS === 'ios' && appleAvailable ? (
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
          <Text style={[styles.footerText, { color: colors.mutedText }]}>
            {tt('no_account', 'Hesabınız yok mu?')}
          </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={[styles.footerLink, { color: colors.primary }]}>
              {tt('signup', 'Kayıt Ol')}
            </Text>
          </TouchableOpacity>
        </View>

        {!isGoogleEnabled ? (
          <Text style={[styles.helperText, { color: colors.mutedText }]}>
            {tt(
              'google_sign_in_unavailable',
              'Google ile giriş bu build için henüz yapılandırılmadı.'
            )}
          </Text>
        ) : null}
        {Platform.OS === 'ios' && !appleAvailable ? (
          <Text style={[styles.helperText, { color: colors.mutedText }]}>
            {tt(
              'apple_sign_in_unavailable',
              'Apple ile giriş bu cihazda veya test ortamında kullanılamıyor.'
            )}
          </Text>
        ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 68,
    paddingBottom: 40,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 20,
    marginBottom: 20,
    shadowOpacity: 0.16,
    shadowRadius: 28,
    shadowOffset: {
      width: 0,
      height: 18,
    },
  },
  heroBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    gap: 10,
  },
  heroBadge: {
    minHeight: 32,
    borderRadius: 999,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  hero: {
    alignItems: 'center',
  },
  logoWrap: {
    width: 104,
    height: 104,
    borderRadius: 32,
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
    borderRadius: 28,
    padding: 20,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: {
      width: 0,
      height: 18,
    },
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
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 12,
    },
  },
  primaryButtonText: {
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
