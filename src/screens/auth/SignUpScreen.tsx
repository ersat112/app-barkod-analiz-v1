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
  Switch,
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
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithCredential,
  updateProfile,
} from 'firebase/auth';

import {
  AUTH_RUNTIME,
  getGoogleAuthRedirectUri,
  getEmailVerificationActionSettings,
} from '../../config/authRuntime';
import { auth } from '../../config/firebase';
import { useTheme } from '../../context/ThemeContext';
import { AmbientBackdrop } from '../../components/ui/AmbientBackdrop';
import {
  SearchableSelectSheet,
  SelectionField,
} from '../../components/ui/SearchableSelectSheet';
import { ensureUserProfileDocument } from '../../services/userProfile.service';
import { authAnalyticsService } from '../../services/authAnalytics.service';
import {
  getDistrictsByCity,
  resolveCanonicalCity,
  resolveCanonicalDistrict,
  searchCities,
} from '../../services/locationData';
import { locationService } from '../../services/locationService';
import {
  isGoogleNativePlayServicesError,
  isGoogleNativeSignInReady,
  signInWithGoogleNativeFirebase,
} from '../../services/googleNativeAuth.service';
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

const generateStrongPassword = (): string => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const numbers = '23456789';
  const symbols = '!@#$%&*?';
  const all = upper + lower + numbers + symbols;

  const pick = (source: string) =>
    source.charAt(Math.floor(Math.random() * source.length));

  const seed = [pick(upper), pick(lower), pick(numbers), pick(symbols)];

  while (seed.length < 14) {
    seed.push(pick(all));
  }

  return seed.sort(() => Math.random() - 0.5).join('');
};

const getPasswordStrength = (
  password: string,
  tt: (key: string, fallback: string) => string
): {
  label: string;
  color: string;
  score: number;
} => {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 2) {
    return { label: tt('weak', 'Zayıf'), color: '#FF4D4F', score: 25 };
  }
  if (score <= 4) {
    return { label: tt('medium', 'Orta'), color: '#F5A623', score: 60 };
  }
  return { label: tt('strong', 'Güçlü'), color: '#1ED760', score: 100 };
};

const mergeLocationOptions = (primary: string[], secondary: string[]): string[] =>
  Array.from(
    new Set(
      [...primary, ...secondary]
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right, 'tr'));

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

const NativeGoogleAuthSection: React.FC<GoogleAuthSectionProps> = ({
  label,
  errorTitle,
  missingCredentialMessage,
  failureFallbackMessage,
  providerDisabledMessage,
}) => {
  const [loading, setLoading] = useState(false);

  const handlePress = useCallback(async () => {
    try {
      setLoading(true);
      const result = await signInWithGoogleNativeFirebase();

      if (result.type === 'cancelled') {
        return;
      }

      await ensureUserProfileDocument(result.userCredential.user, {
        trackLogin: true,
      });

      await authAnalyticsService.trackSignupSucceeded({
        method: 'google',
        surface: 'signup',
        emailVerified: result.userCredential.user.emailVerified,
        hasProfileSeed: false,
      });
    } catch (error: any) {
      console.error('Google signup/login failed:', error);

      await authAnalyticsService.trackSignupFailed({
        method: 'google',
        surface: 'signup',
        error,
        errorCode: error?.code,
      });

      const message =
        error?.code === 'auth/operation-not-allowed'
          ? providerDisabledMessage
          : error?.message === 'google_credential_missing'
            ? missingCredentialMessage
            : isGoogleNativePlayServicesError(error)
              ? 'Google Play Hizmetleri bu cihazda kullanılamıyor.'
              : error?.message || failureFallbackMessage;

      Alert.alert(errorTitle, message);
    } finally {
      setLoading(false);
    }
  }, [
    errorTitle,
    failureFallbackMessage,
    missingCredentialMessage,
    providerDisabledMessage,
  ]);

  return (
    <SocialButton
      icon="logo-google"
      label={label}
      onPress={handlePress}
      disabled={!isGoogleNativeSignInReady()}
      loading={loading}
      backgroundColor="#FFFFFF"
      borderColor="#E5E5E5"
      textColor="#111111"
    />
  );
};

const BrowserGoogleAuthSection: React.FC<GoogleAuthSectionProps> = ({
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
          await authAnalyticsService.trackSignupFailed({
            method: 'google',
            surface: 'signup',
            error: 'google_credential_missing',
          });

          Alert.alert(errorTitle, missingCredentialMessage);
          return;
        }

        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        const userCredential = await signInWithCredential(auth, credential);

        await authAnalyticsService.trackSignupSucceeded({
          method: 'google',
          surface: 'signup',
          emailVerified: userCredential.user.emailVerified,
          hasProfileSeed: false,
        });
      } catch (error: any) {
        console.error('Google signup/login failed:', error);

        await authAnalyticsService.trackSignupFailed({
          method: 'google',
          surface: 'signup',
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

const GoogleAuthSection: React.FC<GoogleAuthSectionProps> = (props) => {
  if (Platform.OS === 'android') {
    return <NativeGoogleAuthSection {...props} />;
  }

  return <BrowserGoogleAuthSection {...props} />;
};

export const SignUpScreen: React.FC = () => {
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

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [address, setAddress] = useState('');
  const [cityPickerVisible, setCityPickerVisible] = useState(false);
  const [districtPickerVisible, setDistrictPickerVisible] = useState(false);
  const [cityPickerSearch, setCityPickerSearch] = useState('');
  const [districtPickerSearch, setDistrictPickerSearch] = useState('');
  const [districtOptions, setDistrictOptions] = useState<string[]>([]);
  const [districtOptionsLoading, setDistrictOptionsLoading] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [securePassword, setSecurePassword] = useState(true);
  const [secureConfirmPassword, setSecureConfirmPassword] = useState(true);

  const [kvkkAccepted, setKvkkAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === 'ios');

  const isGoogleEnabled = useMemo(
    () =>
      Platform.OS === 'android'
        ? AUTH_RUNTIME.google.isSignInReady
        : AUTH_RUNTIME.google.hasActivePlatformClientId,
    []
  );
  const resolvedCity = useMemo(() => resolveCanonicalCity(city), [city]);
  const passwordStrength = useMemo(() => getPasswordStrength(password, tt), [password, tt]);

  const isFormValid = useMemo(() => {
    return (
      firstName.trim().length > 0 &&
      lastName.trim().length > 0 &&
      email.trim().length > 0 &&
      password.length >= 8 &&
      confirmPassword.length >= 8 &&
      kvkkAccepted
    );
  }, [confirmPassword.length, email, firstName, kvkkAccepted, lastName, password.length]);

  const handleGeneratePassword = useCallback(() => {
    const next = generateStrongPassword();
    setPassword(next);
    setConfirmPassword(next);
  }, []);

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

  useEffect(() => {
    let isActive = true;

    if (!resolvedCity) {
      setDistrictOptions([]);
      setDistrictOptionsLoading(false);
      return () => {
        isActive = false;
      };
    }

    const localDistrictOptions = getDistrictsByCity(resolvedCity);
    setDistrictOptions(localDistrictOptions);
    setDistrictOptionsLoading(true);

    void locationService
      .getDistrictsByCityName(resolvedCity)
      .then((remoteDistrictOptions) => {
        if (!isActive) {
          return;
        }

        setDistrictOptions(
          mergeLocationOptions(localDistrictOptions, remoteDistrictOptions)
        );
      })
      .catch((error) => {
        console.warn('[SignUpScreen] district options load failed:', error);
      })
      .finally(() => {
        if (isActive) {
          setDistrictOptionsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [resolvedCity]);

  const cityPickerItems = useMemo(() => {
    return searchCities(cityPickerSearch).slice(0, 81);
  }, [cityPickerSearch]);

  const districtPickerItems = useMemo(() => {
    const query = districtPickerSearch.trim().toLocaleLowerCase('tr');

    if (!query) {
      return districtOptions;
    }

    return districtOptions.filter((item) =>
      item.toLocaleLowerCase('tr').includes(query)
    );
  }, [districtOptions, districtPickerSearch]);

  const openCityPicker = useCallback(() => {
    setCityPickerSearch(city);
    setCityPickerVisible(true);
  }, [city]);

  const openDistrictPicker = useCallback(() => {
    if (!resolvedCity) {
      return;
    }

    setDistrictPickerSearch(district);
    setDistrictPickerVisible(true);
  }, [district, resolvedCity]);

  const handleCitySelect = useCallback((value: string) => {
    setCity(value);
    setDistrict('');
    setCityPickerSearch(value);
    setDistrictPickerSearch('');
    setCityPickerVisible(false);
  }, []);

  const handleDistrictSelect = useCallback((value: string) => {
    setDistrict(value);
    setDistrictPickerSearch(value);
    setDistrictPickerVisible(false);
  }, []);

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
        await authAnalyticsService.trackSignupFailed({
          method: 'apple',
          surface: 'signup',
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

      await authAnalyticsService.trackSignupSucceeded({
        method: 'apple',
        surface: 'signup',
        emailVerified: userCredential.user.emailVerified,
        hasProfileSeed: false,
      });
    } catch (error: any) {
      if (error?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }

      console.error('Apple login failed:', error);

      await authAnalyticsService.trackSignupFailed({
        method: 'apple',
        surface: 'signup',
        error,
        errorCode: error?.code,
      });

      const message =
        error?.code === 'auth/operation-not-allowed'
          ? tt(
              'apple_provider_disabled',
              'Apple ile giriş Firebase üzerinde etkin değil.'
            )
          : error?.message || tt('apple_continue_failed', 'Apple ile devam etme başarısız oldu.');

      Alert.alert(
        tt('error_title', 'Hata'),
        message
      );
    } finally {
      setAppleLoading(false);
    }
  }, [tt]);

  const handleSignUp = useCallback(async () => {
    if (!isFormValid) {
      Alert.alert(
        tt('error_title', 'Hata'),
        tt('fill_all_fields', 'Lütfen tüm zorunlu alanları doldurun.')
      );
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        tt('error_title', 'Hata'),
        tt('passwords_do_not_match', 'Şifreler birbiriyle eşleşmiyor.')
      );
      return;
    }

    if (!kvkkAccepted) {
      Alert.alert(
        tt('error_title', 'Hata'),
        tt('accept_kvkk_error', 'Devam etmek için KVKK metnini onaylamalısınız.')
      );
      return;
    }

    try {
      setLoading(true);

      const canonicalCity = resolveCanonicalCity(city) ?? city.trim();
      const canonicalDistrict =
        resolveCanonicalDistrict(canonicalCity, district) ?? district.trim();

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();

      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
      }

      await ensureUserProfileDocument(userCredential.user, {
        trackLogin: true,
        profile: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          displayName,
          phone: phone.trim(),
          city: canonicalCity,
          district: canonicalDistrict,
          address: address.trim(),
          email: email.trim(),
          kvkkAccepted: true,
        },
      });

      let verificationEmailSent = false;

      try {
        const actionSettings = getEmailVerificationActionSettings();

        if (actionSettings) {
          await sendEmailVerification(userCredential.user, actionSettings);
        } else {
          await sendEmailVerification(userCredential.user);
        }

        verificationEmailSent = true;
      } catch (verificationError) {
        console.error('Verification email send failed:', verificationError);
      }

      await authAnalyticsService.trackSignupSucceeded({
        method: 'password',
        surface: 'signup',
        emailVerified: userCredential.user.emailVerified,
        hasProfileSeed: true,
      });

      Alert.alert(
        tt('success_title', 'Başarılı'),
        verificationEmailSent
          ? tt(
              'verification_email_sent_with_support_hint',
              'Hesabınız oluşturuldu. Doğrulama e-postası gönderildi. Gelmezse spam klasörünü kontrol edin veya destekerenesal@gmail.com ile iletişime geçin.'
            )
          : tt(
              'verification_email_send_failed_but_account_created',
              'Hesabınız oluşturuldu ancak doğrulama e-postası şu anda gönderilemedi. Giriş yaptıktan sonra tekrar deneyin veya destekerenesal@gmail.com ile iletişime geçin.'
            )
      );
    } catch (error: any) {
      console.error('Signup failed:', error);

      await authAnalyticsService.trackSignupFailed({
        method: 'password',
        surface: 'signup',
        error,
        errorCode: error?.code,
      });

      let message = tt('signup_error_generic', 'Kayıt sırasında bir hata oluştu.');

      if (error?.code === 'auth/invalid-email') {
        message = tt('invalid_email_format', 'Geçersiz e-posta formatı.');
      } else if (error?.code === 'auth/email-already-in-use') {
        message = tt('email_already_in_use', 'Bu e-posta adresi zaten kullanımda.');
      } else if (error?.code === 'auth/weak-password') {
        message = tt('weak_password', 'Şifre yeterince güçlü değil.');
      } else if (error?.code === 'auth/network-request-failed') {
        message = tt('network_error', 'Ağ bağlantısı hatası.');
      }

      Alert.alert(tt('error_title', 'Hata'), message);
    } finally {
      setLoading(false);
    }
  }, [
    address,
    city,
    confirmPassword,
    district,
    email,
    firstName,
    isFormValid,
    kvkkAccepted,
    lastName,
    password,
    phone,
    tt,
  ]);

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
          <View style={styles.topRow}>
            <TouchableOpacity
              style={[
                styles.backButton,
                {
                  borderColor: withAlpha(colors.border, 'B8'),
                  backgroundColor: withAlpha(colors.cardElevated, 'E8'),
                },
              ]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

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
                  {tt('signup', 'Kayıt Ol')}
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
              <Text style={[styles.title, { color: colors.primary }]}>
                {tt('signup', 'Kayıt Ol')}
              </Text>

              <Text style={[styles.subtitle, { color: colors.mutedText }]}>
                {tt(
                  'signup_subtitle',
                  'Hesabınızı oluşturun ve barkod analizlerini senkronize şekilde kullanın.'
                )}
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
          <View style={styles.row}>
            <View style={styles.half}>
              <Text style={[styles.label, { color: colors.text }]}>
                {tt('first_name', 'Ad')}
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
                value={firstName}
                onChangeText={setFirstName}
                placeholder={tt('first_name', 'Ad')}
                placeholderTextColor={`${colors.text}55`}
              />
            </View>

            <View style={styles.half}>
              <Text style={[styles.label, { color: colors.text }]}>
                {tt('last_name', 'Soyad')}
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
                value={lastName}
                onChangeText={setLastName}
                placeholder={tt('last_name', 'Soyad')}
                placeholderTextColor={`${colors.text}55`}
              />
            </View>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>
            {tt('phone', 'Telefon Numarası')}
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
            value={phone}
            onChangeText={(value) => setPhone(value.replace(/[^\d+]/g, ''))}
            placeholder={tt('phone', 'Telefon Numarası')}
            placeholderTextColor={`${colors.text}55`}
            keyboardType="phone-pad"
          />

          <View style={styles.row}>
            <View style={styles.half}>
              <SelectionField
                label={tt('city', 'Şehir')}
                value={city}
                placeholder={tt('select_city', 'Şehir seçin')}
                onPress={openCityPicker}
                colors={colors}
                isDark={isDark}
                helperText={tt(
                  'city_picker_helper',
                  'Şehrinizi seçmek için dokunun.'
                )}
              />
            </View>

            <View style={styles.half}>
              <SelectionField
                label={tt('district', 'İlçe')}
                value={district}
                placeholder={
                  resolvedCity
                    ? tt('select_district', 'İlçe seçin')
                    : tt('select_city_first', 'Önce şehir seçin')
                }
                onPress={openDistrictPicker}
                colors={colors}
                isDark={isDark}
                disabled={!resolvedCity}
                helperText={
                  resolvedCity
                    ? tt(
                        'district_picker_helper',
                        'İlçenizi seçmek için dokunun.'
                      )
                    : tt(
                        'district_helper_select_city',
                        'İlçe önerilerini görmek için önce şehir seçin.'
                      )
                }
              />
            </View>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>
            {tt('address', 'Adres Detayı')}
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
            value={address}
            onChangeText={setAddress}
            placeholder={tt('address', 'Adres Detayı')}
            placeholderTextColor={`${colors.text}55`}
          />

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
            value={email}
            onChangeText={setEmail}
            placeholder={tt('email', 'E-posta Adresi')}
            placeholderTextColor={`${colors.text}55`}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
          />

          <View style={styles.passwordHeaderRow}>
            <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>
              {tt('password', 'Şifre')}
            </Text>
            <TouchableOpacity onPress={handleGeneratePassword}>
              <Text style={[styles.generateText, { color: colors.primary }]}>
                {tt('suggest_strong_password', 'Güçlü şifre öner')}
              </Text>
            </TouchableOpacity>
          </View>

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
              value={password}
              onChangeText={setPassword}
              placeholder={tt('password', 'Şifre')}
              placeholderTextColor={`${colors.text}55`}
              secureTextEntry={securePassword}
              autoCapitalize="none"
              textContentType="newPassword"
            />
            <Pressable onPress={() => setSecurePassword((prev) => !prev)}>
              <Ionicons
                name={securePassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={colors.text}
              />
            </Pressable>
          </View>

          <View style={styles.passwordMeterRow}>
            <View style={[styles.passwordMeterTrack, { backgroundColor: colors.border }]}>
              <View
                style={[
                  styles.passwordMeterFill,
                  {
                    width: `${passwordStrength.score}%`,
                    backgroundColor: passwordStrength.color,
                  },
                ]}
              />
            </View>
            <Text style={[styles.passwordMeterText, { color: passwordStrength.color }]}>
              {passwordStrength.label}
            </Text>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>
            {tt('confirm_password', 'Şifreyi Onayla')}
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
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder={tt('confirm_password', 'Şifreyi Onayla')}
              placeholderTextColor={`${colors.text}55`}
              secureTextEntry={secureConfirmPassword}
              autoCapitalize="none"
              textContentType="newPassword"
            />
            <Pressable onPress={() => setSecureConfirmPassword((prev) => !prev)}>
              <Ionicons
                name={secureConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                size={22}
                color={colors.text}
              />
            </Pressable>
          </View>

          <View
            style={[
              styles.kvkkRow,
              {
                backgroundColor: withAlpha(colors.backgroundMuted, isDark ? 'D6' : 'F4'),
                borderColor: withAlpha(colors.border, 'CC'),
              },
            ]}
          >
            <View style={styles.kvkkTextWrap}>
              <Text style={[styles.kvkkTitle, { color: colors.text }]}>
                {tt('kvkk_title', 'KVKK Onayı')}
              </Text>
              <Text style={[styles.kvkkText, { color: colors.text }]}>
                {tt(
                  'kvkk_agreement_text',
                  'Kullanım Koşullarını ve KVKK Aydınlatma Metnini okudum, onaylıyorum.'
                )}
              </Text>
            </View>

            <Switch
              value={kvkkAccepted}
              onValueChange={setKvkkAccepted}
              trackColor={{ false: '#767577', true: colors.primary }}
              thumbColor={Platform.OS === 'ios' ? '#FFF' : kvkkAccepted ? colors.primary : '#f4f3f4'}
            />
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
            onPress={handleSignUp}
            disabled={!isFormValid || loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primaryContrast} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: colors.primaryContrast }]}>
                {tt('signup', 'Kayıt Ol')}
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
              label={tt('google_continue', 'Google ile Devam Et')}
              errorTitle={tt('error_title', 'Hata')}
              missingCredentialMessage={tt(
                'google_auth_missing',
                'Google kimlik doğrulama bilgisi alınamadı.'
              )}
              failureFallbackMessage={tt(
                'google_continue_failed',
                'Google ile devam etme başarısız oldu.'
              )}
              providerDisabledMessage={tt(
                'google_provider_disabled',
                'Google ile giriş Firebase üzerinde etkin değil.'
              )}
            />
          ) : (
            <SocialButton
              icon="logo-google"
              label={tt('google_continue', 'Google ile Devam Et')}
              disabled
              backgroundColor="#FFFFFF"
              borderColor="#E5E5E5"
              textColor="#111111"
            />
          )}

          {Platform.OS === 'ios' && appleAvailable ? (
            <View style={styles.appleButtonWrap}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
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
            {tt('already_have_account', 'Zaten hesabınız var mı?')}
          </Text>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={[styles.footerLink, { color: colors.primary }]}>
              {tt('login', 'Giriş Yap')}
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

        <SearchableSelectSheet
          visible={cityPickerVisible}
          title={tt('city_picker_title', 'Şehir seçin')}
          searchPlaceholder={tt('city_picker_search', 'Şehir ara')}
          searchValue={cityPickerSearch}
          onSearchChange={setCityPickerSearch}
          items={cityPickerItems}
          selectedValue={resolvedCity ?? city}
          emptyText={tt('city_picker_empty', 'Aramanıza uygun şehir bulunamadı.')}
          onSelect={handleCitySelect}
          onClose={() => setCityPickerVisible(false)}
          colors={colors}
          isDark={isDark}
        />

        <SearchableSelectSheet
          visible={districtPickerVisible}
          title={tt('district_picker_title', 'İlçe seçin')}
          searchPlaceholder={tt('district_picker_search', 'İlçe ara')}
          searchValue={districtPickerSearch}
          onSearchChange={setDistrictPickerSearch}
          items={districtPickerItems}
          selectedValue={district}
          emptyText={tt(
            'district_picker_empty',
            'Seçili şehir için aramanıza uygun ilçe bulunamadı.'
          )}
          onSelect={handleDistrictSelect}
          onClose={() => setDistrictPickerVisible(false)}
          colors={colors}
          isDark={isDark}
          loading={districtOptionsLoading}
          loadingText={tt('district_picker_loading', 'İlçeler yükleniyor...')}
        />
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
    paddingTop: 52,
    paddingBottom: 40,
  },
  topRow: {
    marginBottom: 8,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 20,
    marginBottom: 18,
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
    marginBottom: 0,
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
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
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
  passwordHeaderRow: {
    marginTop: 6,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  generateText: {
    fontSize: 12,
    fontWeight: '900',
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
  passwordMeterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
    marginTop: -2,
  },
  passwordMeterTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  passwordMeterFill: {
    height: '100%',
    borderRadius: 999,
  },
  passwordMeterText: {
    fontSize: 12,
    fontWeight: '900',
    minWidth: 44,
    textAlign: 'right',
  },
  kvkkRow: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  kvkkTextWrap: {
    flex: 1,
  },
  kvkkTitle: {
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 4,
  },
  kvkkText: {
    fontSize: 12,
    lineHeight: 19,
    opacity: 0.76,
  },
  primaryButton: {
    marginTop: 14,
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
