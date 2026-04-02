import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Vibration,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { MarketPriceTableCard } from '../../components/MarketPriceTableCard';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { MARKET_GELSIN_RUNTIME } from '../../config/marketGelsinRuntime';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { adService } from '../../services/adService';
import { entitlementService } from '../../services/entitlement.service';
import { freeScanPolicyService } from '../../services/freeScanPolicy.service';
import { enqueueRemoteHistorySync } from '../../services/historyRemoteSync.service';
import {
  resolveCanonicalCity,
  resolveCanonicalDistrict,
  resolveTurkeyCityCode,
} from '../../services/locationData';
import { fetchMarketProductOffers } from '../../services/marketPricing.service';
import {
  lookupProductByBarcode,
  type ProductLookupMode,
} from '../../services/productLookup.service';
import {
  isMlKitTextRecognitionAvailable,
  recognizeTextFromImage,
} from '../../services/mlKitTextRecognition.service';
import { resolveHybridTextAnalysis } from '../../services/textHybridAnalysis.service';
import { saveProductToHistory } from '../../services/db';
import { prewarmMedicineCatalog } from '../../services/titckMedicine.service';
import {
  playScanBeep,
  prepareScanBeep,
  unloadScanBeep,
} from '../../services/scanFeedback.service';
import { useScanStore } from '../../store/useScanStore';
import type { MarketOffer, MarketProductOffersResponse } from '../../types/marketPricing';
import { analyzeProduct, type AnalysisResult, type Product } from '../../utils/analysis';
import { barcodeDecoder } from '../../utils/barcodeDecoder';

type ScanPreviewStatus = 'loading' | 'found' | 'not_found' | 'error';
type ScannerUiMode = 'food' | 'beauty' | 'medicine' | 'text';

type ScanPreviewItem = {
  id: string;
  barcode: string;
  lookupMode: ProductLookupMode;
  status: ScanPreviewStatus;
  createdAt: number;
  product?: Product;
  analysis?: AnalysisResult;
  message?: string;
  isTextAnalysis?: boolean;
};

export const ScannerScreen: React.FC = () => {
  return <ScannerExperience initialMode="food" />;
};

export const MedicineScannerScreen: React.FC = () => {
  return <ScannerExperience initialMode="medicine" />;
};

type ScannerExperienceProps = {
  initialMode?: ScannerUiMode;
};

const PREVIEW_QUEUE_LIMIT = 6;
const FALLBACK_IMAGE = 'https://via.placeholder.com/240?text=No+Image';
const MODE_ICON_MAP: Record<ScannerUiMode, keyof typeof Ionicons.glyphMap> = {
  food: 'nutrition-outline',
  beauty: 'sparkles-outline',
  medicine: 'medkit-outline',
  text: 'document-text-outline',
};

const buildPreviewId = (): string => {
  return `preview_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

const getScoreTone = (score?: number): string => {
  if (typeof score !== 'number') {
    return '#7DD3FC';
  }

  if (score >= 85) {
    return '#22C55E';
  }

  if (score >= 70) {
    return '#84CC16';
  }

  if (score >= 55) {
    return '#F59E0B';
  }

  if (score >= 35) {
    return '#F97316';
  }

  return '#EF4444';
};

const formatLocalizedPrice = (locale: string, amount?: number | null, currency = 'TRY'): string => {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return '--';
  }

  try {
    return new Intl.NumberFormat(locale || 'tr-TR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

const formatDistanceMeters = (tt: (key: string, fallback: string) => string, value?: number | null): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return '';
  }

  if (value < 1000) {
    return tt('price_compare_distance_meters', '{{value}} m').replace(
      '{{value}}',
      Math.round(value).toString()
    );
  }

  return tt('price_compare_distance_km', '{{value}} km').replace(
    '{{value}}',
    (value / 1000).toFixed(1)
  );
};

const pickBestMarketOffer = (offers: MarketOffer[]): MarketOffer | null => {
  if (!offers.length) {
    return null;
  }

  const sorted = [...offers].sort((left, right) => {
    if (left.inStock !== right.inStock) {
      return left.inStock ? -1 : 1;
    }

    if (left.price !== right.price) {
      return left.price - right.price;
    }

    return left.marketName.localeCompare(right.marketName, 'tr');
  });

  return sorted[0] ?? null;
};

const ScannerExperience: React.FC<ScannerExperienceProps> = ({
  initialMode = 'food',
}) => {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isFocused = useIsFocused();

  const layout = useAppScreenLayout({
    topInsetExtra: 8,
    topInsetMin: 24,
    floatingBottomExtra: 16,
    floatingBottomMin: 28,
  });

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [previewItems, setPreviewItems] = useState<ScanPreviewItem[]>([]);
  const [activeLookupBarcode, setActiveLookupBarcode] = useState<string | null>(null);
  const [previewOffersResponse, setPreviewOffersResponse] =
    useState<MarketProductOffersResponse | null>(null);
  const [previewOffersLoading, setPreviewOffersLoading] = useState(false);
  const [previewOffersError, setPreviewOffersError] = useState<string | null>(null);
  const [previewMarketSheetOffer, setPreviewMarketSheetOffer] = useState<MarketOffer | null>(null);

  const [isManualMode, setIsManualMode] = useState(false);
  const [manualEntryMode, setManualEntryMode] = useState<'barcode' | 'text'>('barcode');
  const [manualBarcode, setManualBarcode] = useState('');
  const [manualText, setManualText] = useState('');
  const [manualError, setManualError] = useState('');
  const [selectedMode, setSelectedMode] = useState<ScannerUiMode>(initialMode);
  const [showModeHint, setShowModeHint] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [ocrProcessing, setOcrProcessing] = useState(false);

  const { setAnalysis, markNotFound, previewCacheByBarcode } = useScanStore();
  const cameraRef = useRef<CameraView | null>(null);
  const lineAnim = useRef(new Animated.Value(0)).current;
  const previewSheetAnim = useRef(new Animated.Value(220)).current;
  const scanResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const recentScanMapRef = useRef<Record<string, number>>({});
  const dismissedModeHintsRef = useRef<Record<ScannerUiMode, boolean>>({
    food: false,
    beauty: false,
    medicine: false,
    text: false,
  });
  const scanMode: ProductLookupMode =
    selectedMode === 'medicine'
      ? 'medicine'
      : selectedMode === 'beauty'
        ? 'beauty'
        : selectedMode === 'food'
          ? 'food'
          : 'auto';
  const isTextMode = selectedMode === 'text';
  const profileCity = resolveCanonicalCity(profile?.city);
  const profileDistrict = profileCity
    ? resolveCanonicalDistrict(profileCity, profile?.district) ??
      profile?.district ??
      null
    : null;
  const profileCityCode = resolveTurkeyCityCode(profileCity);
  const ocrAvailable = isMlKitTextRecognitionAvailable();

  const closePreviewMarketSheet = useCallback(() => {
    setPreviewMarketSheetOffer(null);
  }, []);

  const openPreviewMarketSheet = useCallback((offer: MarketOffer) => {
    setPreviewMarketSheetOffer(offer);
  }, []);

  useEffect(() => {
    let disposed = false;

    const setupAds = async () => {
      try {
        const entitlement = await entitlementService.getSnapshot();

        if (disposed) {
          return;
        }

        if (entitlement.isPremium) {
          console.log('[ScannerAds] premium entitlement active, preload skipped');
          return;
        }

        const policy = await adService.getCurrentPolicy();

        if (disposed) {
          return;
        }

        if (!policy.enabled || !policy.interstitialEnabled) {
          console.log('[ScannerAds] interstitial policy disabled, preload skipped');
          return;
        }

        await Promise.all([
          adService.prepareInterstitial(),
          adService.prepareRewardedAd(),
        ]);
      } catch (error) {
        console.log('[ScannerAds] setup failed', error);

        void adService.trackInterstitialShowFailure(error, {
          stage: 'setup',
          screen: 'Scanner',
        });
      }
    };

    void setupAds();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    void prepareScanBeep();

    return () => {
      void unloadScanBeep();
    };
  }, []);

  useEffect(() => {
    console.log('[ScannerScreen] mode ready:', {
      routeName: route?.name,
      initialMode,
      selectedMode,
      resolvedMode: scanMode,
    });
  }, [initialMode, route?.name, scanMode, selectedMode]);

  useEffect(() => {
    setSelectedMode(initialMode);
    setShowModeHint(!dismissedModeHintsRef.current[initialMode]);
  }, [initialMode]);

  useEffect(() => {
    if (isFocused && !isManualMode) {
      lineAnim.setValue(0);

      animationRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(lineAnim, {
            toValue: 240,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(lineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );

      animationRef.current.start();
    } else {
      animationRef.current?.stop();
      animationRef.current = null;
    }

    return () => {
      animationRef.current?.stop();
      animationRef.current = null;
    };
  }, [isFocused, isManualMode, lineAnim]);

  useEffect(() => {
    return () => {
      if (scanResetTimeoutRef.current) {
        clearTimeout(scanResetTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const prewarm = async () => {
      try {
        if (scanMode === 'medicine') {
          await prewarmMedicineCatalog();
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[ScannerScreen] medicine catalog prewarm failed:', error);
        }
      }
    };

    void prewarm();

    return () => {
      cancelled = true;
    };
  }, [scanMode]);

  const closeManualMode = useCallback(() => {
    setIsManualMode(false);
    setManualEntryMode('barcode');
    setManualError('');
    setManualBarcode('');
    setManualText('');
    Keyboard.dismiss();
  }, []);

  const handleCloseScanner = useCallback(() => {
    if (typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate('Main');
  }, [navigation]);

  const handleSelectMode = useCallback((nextMode: ScannerUiMode) => {
    setSelectedMode(nextMode);
    setShowModeHint(!dismissedModeHintsRef.current[nextMode]);
    setScanned(false);
  }, []);

  const dismissModeHint = useCallback(() => {
    dismissedModeHintsRef.current[selectedMode] = true;
    setShowModeHint(false);
  }, [selectedMode]);

  const openInfoHint = useCallback(() => {
    setShowModeHint(true);
  }, []);

  const openManualEntry = useCallback(() => {
    setManualEntryMode(selectedMode === 'text' ? 'text' : 'barcode');
    setManualError('');
    setIsManualMode(true);
  }, [selectedMode]);

  const resetTransientState = useCallback(() => {
    setIsManualMode(false);
    setManualEntryMode('barcode');
    setManualBarcode('');
    setManualText('');
    setManualError('');
  }, []);

  const pushLoadingPreview = useCallback(
    (barcode: string, lookupMode: ProductLookupMode) => {
      const item: ScanPreviewItem = {
        id: buildPreviewId(),
        barcode,
        lookupMode,
        status: 'loading',
        createdAt: Date.now(),
        message: tt('scanner_lookup_loading', 'Urun bilgileri getiriliyor...'),
      };

      setPreviewItems((current) => [item, ...current].slice(0, PREVIEW_QUEUE_LIMIT));
      return item.id;
    },
    [tt]
  );

  const updatePreviewItem = useCallback(
    (previewId: string, updater: (current: ScanPreviewItem) => ScanPreviewItem) => {
      setPreviewItems((current) =>
        current.map((item) => (item.id === previewId ? updater(item) : item))
      );
    },
    []
  );

  const dismissPreviewItem = useCallback((previewId: string) => {
    setPreviewItems((current) => current.filter((item) => item.id !== previewId));
  }, []);

  const dismissPreviewByBarcode = useCallback((barcode: string) => {
    setPreviewItems((current) => current.filter((item) => item.barcode !== barcode));
  }, []);

  const applyTextAnalysis = useCallback(
    async (rawValue: string, source: 'manual' | 'ocr') => {
      const trimmedValue = rawValue.trim();

      if (trimmedValue.length < 12) {
        throw new Error('TEXT_TOO_SHORT');
      }

      resetTransientState();
      const previewId = pushLoadingPreview(`TEXT-${Date.now()}`, 'auto');
      const hybridResult = await resolveHybridTextAnalysis({
        rawText: trimmedValue,
        inputSource: source,
        tt,
      });
      setAnalysis(hybridResult.product, hybridResult.analysis);

      updatePreviewItem(previewId, (current) => ({
        ...current,
        status: 'found',
        product: hybridResult.product,
        analysis: hybridResult.analysis,
        isTextAnalysis: true,
        message: hybridResult.previewMessage,
      }));
    },
    [pushLoadingPreview, resetTransientState, setAnalysis, tt, updatePreviewItem]
  );

  const handleOpenPreviewDetail = useCallback(
    (item: ScanPreviewItem) => {
      if (!item.product || item.isTextAnalysis) {
        return;
      }

      navigation.navigate('Detail', {
        barcode: item.barcode,
        entrySource: 'scanner',
        lookupMode: item.lookupMode,
        prefetchedProduct: item.product,
        historyAlreadySaved: true,
      });
    },
    [navigation]
  );

  const handleOpenMissingProduct = useCallback(
    (barcode: string) => {
      dismissPreviewByBarcode(barcode);
      navigation.navigate('MissingProduct', { barcode });
    },
    [dismissPreviewByBarcode, navigation]
  );

  const maybeShowScanInterstitial = useCallback(
    async (params: { barcode: string; outcome: 'found' | 'not_found' }) => {
      try {
        const entitlement = await entitlementService.getSnapshot();

        if (entitlement.isPremium) {
          return;
        }

        const decision = await adService.evaluateScanInterstitialOpportunity();

        if (!decision.shouldShow) {
          return;
        }

        if (!adService.isInterstitialReady()) {
          await adService.prepareInterstitial();
          await new Promise((resolve) => setTimeout(resolve, 320));
        }

        if (!adService.isInterstitialReady()) {
          await adService.trackInterstitialShowFailure(
            'scan_interstitial_not_ready',
            {
              stage: 'scan_interstitial_show_gate',
              screen: 'Scanner',
              barcode: params.barcode,
              outcome: params.outcome,
              reason: decision.reason,
              successfulScanCount: decision.successfulScanCount,
              dailyInterstitialCount: decision.dailyInterstitialCount,
            }
          );
          return;
        }

        const shown = await adService.showPreparedInterstitial();

        if (!shown) {
          await adService.trackInterstitialShowFailure(
            'scan_interstitial_show_returned_false',
            {
              stage: 'scan_interstitial_show',
              screen: 'Scanner',
              barcode: params.barcode,
              outcome: params.outcome,
              reason: decision.reason,
              successfulScanCount: decision.successfulScanCount,
              dailyInterstitialCount: decision.dailyInterstitialCount,
            }
          );
          return;
        }

        await adService.recordInterstitialShown({
          successfulScanCount: decision.successfulScanCount,
        });

        void adService.prepareInterstitial();
      } catch (error) {
        console.log('[ScannerAds] interstitial show failed', error);

        await adService.trackInterstitialShowFailure(error, {
          stage: 'scan_interstitial_show_exception',
          screen: 'Scanner',
          barcode: params.barcode,
          outcome: params.outcome,
        });
      }
    },
    []
  );

  const processBarcode = useCallback(
    async (validBarcodeData: string) => {
      setScanned(true);
      setActiveLookupBarcode(validBarcodeData);

      try {
        try {
          const freeScanResult = await freeScanPolicyService.registerSuccessfulScan();

          if (!freeScanResult.allowed) {
            resetTransientState();
            setScanned(false);

            if (freeScanResult.snapshot.paywallEnabled) {
              navigation.navigate('Paywall', { source: 'scan_limit' });
            } else {
              Alert.alert(
                tt('scan_limit_title', 'Tarama limiti'),
                tt(
                  'scan_limit_reached_message',
                  'Günlük ücretsiz tarama limitine ulaştınız.'
                )
              );
            }

            return;
          }
        } catch (error) {
          console.error('Free scan policy failed, allowing scan:', error);
        }

        Vibration.vibrate(18);
        void playScanBeep();
        resetTransientState();
        const previewId = pushLoadingPreview(validBarcodeData, scanMode);
        const cachedPreview = previewCacheByBarcode[validBarcodeData];

        if (cachedPreview) {
          if (cachedPreview.product.image_url) {
            void Image.prefetch(cachedPreview.product.image_url);
          }

          setAnalysis(cachedPreview.product, cachedPreview.analysis);
          updatePreviewItem(previewId, (current) => ({
            ...current,
            status: 'found',
            product: cachedPreview.product,
            analysis: cachedPreview.analysis,
            message: tt(
              'scanner_preview_cached',
              'Son sonuc gosteriliyor, yeni veri arka planda kontrol ediliyor.'
            ),
          }));
        }

        console.log('[ScannerScreen] lookup started:', {
          barcode: validBarcodeData,
          routeName: route?.name,
          scanMode,
        });

        try {
          const result = await lookupProductByBarcode(validBarcodeData, {
            lookupMode: scanMode,
          });

          if (!result.found) {
            markNotFound(validBarcodeData);

            updatePreviewItem(previewId, (current) => ({
              ...current,
              status: result.reason === 'invalid_barcode' ? 'error' : 'not_found',
              message:
                result.reason === 'invalid_barcode'
                  ? tt('invalid_barcode', 'Geçersiz barkod formatı')
                  : tt('product_not_found', 'Ürün verisi bulunamadı'),
            }));

            if (result.reason !== 'invalid_barcode') {
              await maybeShowScanInterstitial({
                barcode: validBarcodeData,
                outcome: 'not_found',
              });
            }

            return;
          }

          const product = result.product;
          const analysis = analyzeProduct(product);
          setAnalysis(product, analysis);

          if (product.image_url) {
            void Image.prefetch(product.image_url);
          }

          try {
            await Promise.resolve(
              saveProductToHistory(
                product,
                product.type === 'medicine' ? null : analysis.score
              )
            );

            if (product.type !== 'medicine') {
              void enqueueRemoteHistorySync({
                product,
                score: analysis.score,
                riskLevel: analysis.riskLevel,
              });
            }
          } catch (historyError) {
            console.warn('[ScannerScreen] preview history save failed:', historyError);
          }

          updatePreviewItem(previewId, (current) => ({
            ...current,
            status: 'found',
            product,
            analysis,
            message:
              product.type === 'medicine'
                ? tt(
                    'scanner_preview_medicine_ready',
                    'Ilac bulundu. Prospektus ve detaylar icin karta dokunun.'
                  )
                : tt(
                    'scanner_preview_ready',
                    'Hizli sonuc hazir. Detay icin karta dokunun.'
                  ),
          }));

          await maybeShowScanInterstitial({
            barcode: validBarcodeData,
            outcome: 'found',
          });
        } catch (lookupError) {
          console.error('[ScannerScreen] lookup failed:', lookupError);

          updatePreviewItem(previewId, (current) => ({
            ...current,
            status: 'error',
            message: tt('error_generic', 'Bir hata oluştu'),
          }));
        }
      } finally {
        if (scanResetTimeoutRef.current) {
          clearTimeout(scanResetTimeoutRef.current);
        }

        scanResetTimeoutRef.current = setTimeout(() => {
          setScanned(false);
        }, 900);

        setActiveLookupBarcode(null);
      }
    },
    [
      markNotFound,
      maybeShowScanInterstitial,
      navigation,
      previewCacheByBarcode,
      pushLoadingPreview,
      resetTransientState,
      route?.name,
      scanMode,
      setAnalysis,
      tt,
      updatePreviewItem,
    ]
  );

  const processTextInput = useCallback(async () => {
    Keyboard.dismiss();
    setManualError('');

    const trimmedValue = manualText.trim();

    if (trimmedValue.length < 12) {
      setManualError(
        tt(
          'manual_text_min_length',
          'Lütfen analiz etmek istediğiniz metni biraz daha uzun girin.'
        )
      );
      return;
    }

    await applyTextAnalysis(trimmedValue, 'manual');
  }, [applyTextAnalysis, manualText, tt]);

  const captureAndAnalyzeText = useCallback(async () => {
    if (!ocrAvailable) {
      Alert.alert(
        tt('text_mode_ocr_unavailable_title', 'OCR hazır değil'),
        tt(
          'text_mode_ocr_unavailable_message',
          'Bu build içinde kamera tabanli metin okuma henüz aktif degil. Istersen metni elle girebilirsin.'
        )
      );
      openManualEntry();
      return;
    }

    if (!cameraReady || !cameraRef.current) {
      Alert.alert(
        tt('camera_not_ready_title', 'Kamera hazır değil'),
        tt(
          'camera_not_ready_message',
          'Kamera tam olarak hazır olduğunda tekrar deneyin.'
        )
      );
      return;
    }

    try {
      setOcrProcessing(true);
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.35,
        base64: false,
        shutterSound: false,
      });

      if (!picture?.uri) {
        throw new Error('OCR_CAPTURE_EMPTY');
      }

      const ocrResult = await recognizeTextFromImage(picture.uri);

      if (!ocrResult.hasText || ocrResult.text.trim().length < 12) {
        Alert.alert(
          tt('text_mode_no_text_title', 'Metin okunamadı'),
          tt(
            'text_mode_no_text_message',
            'Lütfen içindekiler alanını daha net hizalayın veya metni elle girin.'
          )
        );
        return;
      }

      await applyTextAnalysis(ocrResult.text, 'ocr');
    } catch (error) {
      console.error('[ScannerScreen] OCR capture failed:', error);
      Alert.alert(
        tt('text_mode_ocr_failed_title', 'Metin okunamadı'),
        tt(
          'text_mode_ocr_failed_message',
          'Kameradan metin okunurken bir hata oluştu. Dilersen metni elle girebilirsin.'
        )
      );
    } finally {
      setOcrProcessing(false);
    }
  }, [applyTextAnalysis, cameraReady, ocrAvailable, openManualEntry, tt]);

  const handleBarCodeScanned = useCallback(
    ({ data, type }: { data: string; type?: string }) => {
      if (scanned || activeLookupBarcode || !isFocused || isManualMode || isTextMode) {
        return;
      }

      const decoded = barcodeDecoder.decode(data, type);

      if (!decoded.isValid) {
        return;
      }

      const lastScannedAt = recentScanMapRef.current[decoded.normalizedData] ?? 0;
      const now = Date.now();

      if (now - lastScannedAt < 2200) {
        return;
      }

      recentScanMapRef.current[decoded.normalizedData] = now;

      void processBarcode(decoded.normalizedData);
    },
    [activeLookupBarcode, isFocused, isManualMode, isTextMode, processBarcode, scanned]
  );

  const handleManualSubmit = useCallback(() => {
    if (manualEntryMode === 'text') {
      void processTextInput();
      return;
    }

    Keyboard.dismiss();
    setManualError('');

    const rawValue = manualBarcode.trim();

    if (!rawValue) {
      setManualError(tt('please_enter_barcode', 'Lütfen barkod girin'));
      return;
    }

    const decoded = barcodeDecoder.decode(rawValue);

    if (!decoded.isValid) {
      setManualError(tt('invalid_barcode', 'Geçersiz barkod formatı'));
      return;
    }

    void processBarcode(decoded.normalizedData);
  }, [manualBarcode, manualEntryMode, processBarcode, processTextInput, tt]);

  const hasPreviewSurface = previewItems.length > 0 || Boolean(activeLookupBarcode);
  const latestPreview = previewItems[0] ?? null;
  const previewHistory = previewItems.slice(1);
  const previewOffers = useMemo(
    () => previewOffersResponse?.offers ?? [],
    [previewOffersResponse?.offers]
  );
  const previewBestOffer = useMemo(() => pickBestMarketOffer(previewOffers), [previewOffers]);
  const previewMarketSummary = useMemo(() => {
    if (previewOffersLoading) {
      return tt('scanner_market_prices_loading', 'Market teklifleri yükleniyor...');
    }

    if (previewOffersError) {
      return previewOffersError;
    }

    if (previewBestOffer) {
      return tt(
        'scanner_market_prices_summary_best',
        '{{market}} içinde en iyi canlı fiyat {{price}}'
      )
        .replace('{{market}}', previewBestOffer.marketName)
        .replace(
          '{{price}}',
          formatLocalizedPrice(
            i18n.resolvedLanguage || 'tr-TR',
            previewBestOffer.price,
            previewBestOffer.currency
          )
        );
    }

    return tt(
      'scanner_market_prices_summary_empty',
      'Bu ürün için market teklifi bulunursa burada özetlenecek.'
    );
  }, [i18n.resolvedLanguage, previewBestOffer, previewOffersError, previewOffersLoading, tt]);

  const previewMarketSheetDetails = useMemo(() => {
    if (!previewMarketSheetOffer) {
      return null;
    }

    return [
      {
        key: 'price',
        label: tt('price_compare_market_sheet_price', 'Fiyat'),
        value: formatLocalizedPrice(
          i18n.resolvedLanguage || 'tr-TR',
          previewMarketSheetOffer.price,
          previewMarketSheetOffer.currency
        ),
      },
      typeof previewMarketSheetOffer.unitPrice === 'number' &&
      previewMarketSheetOffer.unitPriceUnit
        ? {
            key: 'unit',
            label: tt('price_compare_market_sheet_unit_price', 'Birim fiyat'),
            value: `${formatLocalizedPrice(
              i18n.resolvedLanguage || 'tr-TR',
              previewMarketSheetOffer.unitPrice,
              previewMarketSheetOffer.currency
            )} / ${previewMarketSheetOffer.unitPriceUnit}`,
          }
        : null,
      {
        key: 'stock',
        label: tt('price_compare_market_sheet_stock', 'Durum'),
        value: previewMarketSheetOffer.inStock
          ? tt('price_compare_stock_in', 'Stokta')
          : tt('price_compare_stock_out', 'Stokta değil'),
      },
      formatDistanceMeters(tt, previewMarketSheetOffer.distanceMeters)
        ? {
            key: 'distance',
            label: tt('price_compare_market_sheet_distance', 'Mesafe'),
            value: formatDistanceMeters(tt, previewMarketSheetOffer.distanceMeters),
          }
        : null,
      previewMarketSheetOffer.branchName
        ? {
            key: 'branch',
            label: tt('price_compare_market_sheet_branch', 'Şube'),
            value: previewMarketSheetOffer.branchName,
          }
        : null,
      previewMarketSheetOffer.districtName
        ? {
            key: 'district',
            label: tt('price_compare_market_sheet_district', 'İlçe'),
            value: previewMarketSheetOffer.districtName,
          }
        : null,
      previewMarketSheetOffer.cityName
        ? {
            key: 'city',
            label: tt('price_compare_market_sheet_city', 'Şehir'),
            value: previewMarketSheetOffer.cityName,
          }
        : null,
    ].filter(Boolean) as { key: string; label: string; value: string }[];
  }, [i18n.resolvedLanguage, previewMarketSheetOffer, tt]);
  const modeOptions: {
    key: ScannerUiMode;
    label: string;
    hintTitle: string;
    hintBody: string;
    frameTitle: string;
    frameSubtitle: string;
  }[] = [
    {
      key: 'food',
      label: tt('food_label', 'Gıda'),
      hintTitle: tt('scanner_mode_food_title', 'Gıda modunda tarama'),
      hintBody: tt(
        'scanner_mode_food_body',
        'Paketli gıdanın barkodunu kare içine hizala. Skor, alerjen ve katkı sinyalleri gelir.'
      ),
      frameTitle: tt('scanner_frame_food_title', 'Barkodu kareye hizalayın'),
      frameSubtitle: tt(
        'scanner_frame_food_subtitle',
        'Skor, alerjen ve katkı sinyalleri hızlıca okunur.'
      ),
    },
    {
      key: 'beauty',
      label: tt('beauty_label', 'Kozmetik'),
      hintTitle: tt('scanner_mode_beauty_title', 'Kozmetik modunda tarama'),
      hintBody: tt(
        'scanner_mode_beauty_body',
        'Kozmetik barkodunu okut. İçerik sinyali ve uygun marketlerde fiyat kıyası gösterilir.'
      ),
      frameTitle: tt('scanner_frame_beauty_title', 'Kozmetik barkodunu hizalayın'),
      frameSubtitle: tt(
        'scanner_frame_beauty_subtitle',
        'İçerik riski ve market fiyatları birlikte hazırlanır.'
      ),
    },
    {
      key: 'medicine',
      label: tt('medicine_label', 'İlaç'),
      hintTitle: tt('scanner_mode_medicine_title', 'İlaç modunda tarama'),
      hintBody: tt(
        'scanner_mode_medicine_body',
        'İlaç kutusunun barkodunu okut. Resmi kayıt, prospektüs ve kullanım özeti gelir.'
      ),
      frameTitle: tt('scanner_frame_medicine_title', 'İlaç barkodunu hizalayın'),
      frameSubtitle: tt(
        'scanner_frame_medicine_subtitle',
        'Resmi kayıt, prospektüs ve kullanım özeti açılır.'
      ),
    },
    {
      key: 'text',
      label: tt('text_mode_label', 'Metin'),
      hintTitle: tt('scanner_mode_text_title', 'Metin modunda analiz'),
      hintBody: tt(
        'scanner_mode_text_body',
        'Gıdada hem içindekiler hem besin değerleri tablosunu okut. Kozmetikte INCI, ilaçta ne için kullanılır bölümü okunabilir. Eksik metin sınırlı sonuç üretir.'
      ),
      frameTitle: tt('scanner_frame_text_title', 'Metni kareye hizalayın'),
      frameSubtitle: tt(
        'scanner_frame_text_subtitle',
        'Gıdada içerik ve besin değerlerini birlikte okutun.'
      ),
    },
  ];
  const selectedModeMeta = modeOptions.find((item) => item.key === selectedMode) ?? modeOptions[0];

  useEffect(() => {
    if (
      !MARKET_GELSIN_RUNTIME.isEnabled ||
      !latestPreview?.product ||
      latestPreview.status !== 'found' ||
      latestPreview.isTextAnalysis ||
      latestPreview.product.type === 'medicine' ||
      !profileCityCode
    ) {
      setPreviewOffersResponse(null);
      setPreviewOffersError(null);
      setPreviewOffersLoading(false);
      return;
    }

    let cancelled = false;

    const loadPreviewOffers = async () => {
      try {
        setPreviewOffersLoading(true);
        setPreviewOffersError(null);

        const response = await fetchMarketProductOffers(latestPreview.barcode, {
          cityCode: profileCityCode,
          districtName: profileDistrict ?? undefined,
          limit: 24,
          includeOutOfStock: true,
        });

        if (cancelled) {
          return;
        }

        setPreviewOffersResponse(response);
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.warn('[ScannerScreen] preview market offers load failed:', error);
        setPreviewOffersResponse(null);
        setPreviewOffersError(
          tt(
            'market_pricing_error',
            'Fiyat katmanı şu anda yüklenemedi. Daha sonra tekrar deneyebilirsiniz.'
          )
        );
      } finally {
        if (!cancelled) {
          setPreviewOffersLoading(false);
        }
      }
    };

    void loadPreviewOffers();

    return () => {
      cancelled = true;
    };
  }, [latestPreview, profileCityCode, profileDistrict, tt]);

  useEffect(() => {
    setPreviewMarketSheetOffer(null);
  }, [latestPreview?.barcode]);

  useEffect(() => {
    Animated.spring(previewSheetAnim, {
      toValue: hasPreviewSurface ? 0 : 220,
      damping: 22,
      stiffness: 200,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [hasPreviewSurface, previewSheetAnim]);

  if (!permission) {
    return <View style={[styles.container, { backgroundColor: '#000' }]} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: colors.background }]}>
        <View
          style={[
            styles.permissionIconWrap,
            { backgroundColor: `${colors.primary}14` },
          ]}
        >
          <Ionicons name="camera-outline" size={58} color={colors.primary} />
        </View>

        <Text style={[styles.permissionTitle, { color: colors.text }]}>
          {tt('camera_permission_required', 'Kamera izni gerekiyor')}
        </Text>

        <Text style={[styles.permissionText, { color: colors.text }]}>
          {tt(
            'camera_permission_help',
            'Barkod tarayabilmek için kameraya erişim izni vermeniz gerekiyor.'
          )}
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={requestPermission}
        >
          <Text style={styles.primaryBtnText}>
            {tt('allow_camera', 'Kameraya İzin Ver').toUpperCase()}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryGhostBtn, { borderColor: colors.border }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.secondaryGhostBtnText, { color: colors.text }]}>
            {tt('go_back', 'Geri Dön')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const topInsetPadding = layout.headerTopPadding;

  return (
    <View style={styles.container}>
      {isFocused && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFillObject}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          onCameraReady={() => setCameraReady(true)}
          enableTorch={torch}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
          }}
        />
      )}

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.topDarkArea, { paddingTop: topInsetPadding }]}>
          {!isManualMode ? (
            <>
              <View style={styles.topHeaderCard}>
                <TouchableOpacity
                  style={styles.topBackButton}
                  onPress={handleCloseScanner}
                  activeOpacity={0.85}
                >
                  <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={styles.topHeaderTextWrap}>
                  <Text style={styles.topHeaderEyebrow}>
                    {selectedModeMeta.label}
                  </Text>
                  <Text style={styles.topHeaderTitle}>
                    {selectedModeMeta.frameTitle}
                  </Text>
                </View>

                <View style={styles.topActionsGroup}>
                  <TouchableOpacity
                    style={styles.topIconButton}
                    onPress={openInfoHint}
                    activeOpacity={0.88}
                  >
                    <Ionicons
                      name="information-outline"
                      size={17}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.topIconButton}
                    onPress={openManualEntry}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={selectedMode === 'text' ? 'document-text-outline' : 'keypad-outline'}
                      size={17}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.topIconButton}
                    onPress={() => setTorch((prev) => !prev)}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name={torch ? 'flash' : 'flash-off'}
                      size={17}
                      color={torch ? colors.primary : '#FFFFFF'}
                    />
                  </TouchableOpacity>

                </View>
              </View>

              <View style={styles.modeRailWrap}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.modeSelectorRow}
                >
                  {modeOptions.map((mode) => {
                    const selected = mode.key === selectedMode;

                    return (
                      <TouchableOpacity
                        key={mode.key}
                        style={[
                          styles.modeChip,
                          {
                            backgroundColor: selected
                              ? `${colors.primary}22`
                              : 'rgba(255,255,255,0.04)',
                            borderColor: selected
                              ? `${colors.primary}88`
                              : 'rgba(255,255,255,0.10)',
                          },
                        ]}
                        activeOpacity={0.88}
                        onPress={() => handleSelectMode(mode.key)}
                      >
                        <Ionicons
                          name={MODE_ICON_MAP[mode.key]}
                          size={15}
                          color={selected ? colors.primary : '#FFFFFF'}
                        />
                        <Text
                          style={[
                            styles.modeChipText,
                            { color: selected ? colors.primary : '#FFFFFF' },
                          ]}
                        >
                          {mode.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {showModeHint ? (
                <View style={styles.modeHintCard}>
                  <View style={styles.modeHintHeader}>
                    <View style={styles.modeHintTitleWrap}>
                      <View
                        style={[
                          styles.modeHintIcon,
                          { backgroundColor: `${colors.primary}18` },
                        ]}
                      >
                        <Ionicons
                          name={MODE_ICON_MAP[selectedModeMeta.key]}
                          size={16}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.modeHintTextWrap}>
                        <Text style={styles.modeHintEyebrow}>
                          {tt('scanner_how_to_title', 'Nasıl taranır')}
                        </Text>
                        <Text style={styles.modeHintTitle}>{selectedModeMeta.hintTitle}</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.modeHintClose}
                      onPress={dismissModeHint}
                      activeOpacity={0.86}
                    >
                      <Ionicons name="close" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.modeHintBody}>{selectedModeMeta.hintBody}</Text>
                  <View style={styles.modeHintMiniRow}>
                    <Ionicons name="scan-outline" size={15} color="#9FDBFF" />
                    <Text style={styles.modeHintMiniText}>
                      {selectedModeMeta.frameSubtitle}
                    </Text>
                  </View>
                  {selectedMode === 'text' ? (
                    <TouchableOpacity
                      style={[styles.modeHintAction, { backgroundColor: colors.primary }]}
                      activeOpacity={0.88}
                      onPress={openManualEntry}
                    >
                      <Ionicons
                        name="create-outline"
                        size={16}
                        color={colors.primaryContrast}
                      />
                      <Text
                        style={[
                          styles.modeHintActionText,
                          { color: colors.primaryContrast },
                        ]}
                      >
                        {tt('text_mode_manual_action', 'Metni elle gir')}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={styles.middleRow}>
          <View style={styles.sideDarkArea} />

          <View style={[styles.scannerFrame, { borderColor: colors.primary }]}>
            {!isManualMode && (
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    backgroundColor: colors.primary,
                    transform: [{ translateY: lineAnim }],
                  },
                ]}
              />
            )}

            <View style={[styles.corner, styles.topLeft, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.topRight, { borderColor: colors.primary }]} />
            <View
              style={[styles.corner, styles.bottomLeft, { borderColor: colors.primary }]}
            />
            <View
              style={[styles.corner, styles.bottomRight, { borderColor: colors.primary }]}
            />
          </View>

          <View style={styles.sideDarkArea} />
        </View>

        <View style={styles.bottomDarkArea}>
          {!isManualMode ? (
            isTextMode ? (
              <View style={styles.textCapturePanel}>
                <View style={styles.frameGuideCard}>
                  <View style={styles.frameGuideIconWrap}>
                    <Ionicons
                      name={MODE_ICON_MAP[selectedMode]}
                      size={16}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.frameGuideTextWrap}>
                    <Text style={styles.frameGuideTitle}>{selectedModeMeta.frameTitle}</Text>
                    <Text style={styles.frameGuideSubtitle}>
                      {tt(
                        'text_mode_capture_hint',
                        'Gıda için önce içindekiler, sonra besin değerleri tablosunu kareye hizalayın. Yalnız içerik metni okunursa sonuç sınırlı ve hatalı olabilir.'
                      )}
                    </Text>
                  </View>
                </View>
                <View style={styles.textCaptureWarning}>
                  <Ionicons name="information-circle-outline" size={16} color="#FCD34D" />
                  <Text style={styles.textCaptureWarningText}>
                    {tt(
                      'text_mode_capture_warning',
                      'Tam gıda yorumu için içerik ve besin değerleri birlikte okunmalıdır. Kozmetik ve ilaçta ilgili bölüm tek başına yeterli olabilir.'
                    )}
                  </Text>
                </View>
                <View style={styles.textCaptureActions}>
                  <TouchableOpacity
                    style={[
                      styles.textCaptureButton,
                      {
                        backgroundColor: ocrAvailable ? colors.primary : 'rgba(255,255,255,0.14)',
                      },
                    ]}
                    activeOpacity={0.88}
                    onPress={() => {
                      void captureAndAnalyzeText();
                    }}
                    disabled={ocrProcessing}
                  >
                    {ocrProcessing ? (
                      <ActivityIndicator size="small" color={colors.primaryContrast} />
                    ) : (
                      <Ionicons
                        name="scan-outline"
                        size={18}
                        color={ocrAvailable ? colors.primaryContrast : '#FFFFFF'}
                      />
                    )}
                    <Text
                      style={[
                        styles.textCaptureButtonText,
                        { color: ocrAvailable ? colors.primaryContrast : '#FFFFFF' },
                      ]}
                    >
                      {ocrProcessing
                        ? tt('text_mode_processing', 'Okunuyor...')
                        : tt('text_mode_capture_action', 'Metni Tara')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.textManualFallback}
                    activeOpacity={0.84}
                    onPress={openManualEntry}
                  >
                    <Text style={styles.textManualFallbackText}>
                      {tt('text_mode_manual_short', 'Metni Gir')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.frameGuideCard}>
                <View style={styles.frameGuideIconWrap}>
                  <Ionicons
                    name={MODE_ICON_MAP[selectedMode]}
                    size={16}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.frameGuideTextWrap}>
                  <Text style={styles.frameGuideTitle}>{selectedModeMeta.frameTitle}</Text>
                  <Text style={styles.frameGuideSubtitle}>{selectedModeMeta.frameSubtitle}</Text>
                </View>
                <TouchableOpacity
                  style={styles.frameGuideAction}
                  activeOpacity={0.84}
                  onPress={openManualEntry}
                >
                  <Ionicons
                    name="keypad-outline"
                    size={15}
                    color="#FFFFFF"
                  />
                  <Text style={styles.frameGuideActionText}>
                    {tt('manual_entry_short', 'Elle Gir')}
                  </Text>
                </TouchableOpacity>
              </View>
            )
          ) : null}
        </View>
      </View>

      {!isManualMode && hasPreviewSurface ? (
        <Animated.View
          style={[
            styles.previewSheet,
            {
              bottom: Math.max(layout.contentBottomPadding - 18, 92),
              backgroundColor: 'rgba(11,14,20,0.94)',
              borderColor: 'rgba(255,255,255,0.12)',
              transform: [{ translateY: previewSheetAnim }],
            },
          ]}
        >
          {latestPreview ? (
            <View style={styles.previewPrimaryCard}>
              <View style={styles.previewCardTopRow}>
                <View style={styles.previewBadgeRow}>
                  <View
                    style={[
                      styles.previewStatusPill,
                      {
                        backgroundColor:
                          latestPreview.status === 'found'
                            ? `${getScoreTone(latestPreview.analysis?.score)}22`
                            : latestPreview.status === 'loading'
                              ? 'rgba(125,211,252,0.16)'
                              : latestPreview.status === 'not_found'
                                ? 'rgba(248,113,113,0.16)'
                                : 'rgba(244,114,182,0.16)',
                      },
                    ]}
                  >
                    <Text style={styles.previewStatusText}>
                      {latestPreview.status === 'found'
                        ? latestPreview.product?.type === 'medicine'
                          ? tt('medicine_label', 'İlaç')
                          : `${Math.round(latestPreview.analysis?.score ?? 0)}/100`
                        : latestPreview.status === 'loading'
                          ? tt('scanner_status_searching', 'Aranıyor')
                          : latestPreview.status === 'not_found'
                            ? tt('scanner_status_not_found', 'Bulunamadı')
                            : tt('error_title', 'Hata')}
                    </Text>
                  </View>
                  <Text style={styles.previewBarcodeText}>{latestPreview.barcode}</Text>
                </View>

                <View style={styles.previewTopActions}>
                  {latestPreview.status === 'loading' ? (
                    <ActivityIndicator size="small" color="#7DD3FC" />
                  ) : null}

                  <TouchableOpacity
                    style={styles.previewDismissButton}
                    onPress={() => dismissPreviewItem(latestPreview.id)}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={
                  latestPreview.status === 'found' && !latestPreview.isTextAnalysis ? 0.9 : 1
                }
                disabled={latestPreview.status !== 'found' || latestPreview.isTextAnalysis}
                onPress={() => handleOpenPreviewDetail(latestPreview)}
                style={styles.previewBodyTouchable}
              >
                <View style={styles.previewBody}>
                  <Image
                    source={{
                      uri: latestPreview.product?.image_url || FALLBACK_IMAGE,
                    }}
                    style={styles.previewImage}
                  />
                  <View style={styles.previewTextWrap}>
                    <Text style={styles.previewBrand} numberOfLines={1}>
                      {latestPreview.product?.brand ||
                        tt('unknown_brand', 'Bilinmeyen Marka')}
                    </Text>
                    <Text style={styles.previewName} numberOfLines={2}>
                      {latestPreview.product?.name ||
                        (latestPreview.status === 'not_found'
                          ? tt('scanner_not_found_title', 'Ürün bulunamadı')
                          : tt('scanner_lookup_loading', 'Urun bilgileri getiriliyor...'))}
                    </Text>
                    <Text style={styles.previewMessage} numberOfLines={2}>
                      {latestPreview.message ||
                        tt(
                          'scanner_preview_ready',
                          'Hizli sonuc hazir. Detay icin karta dokunun.'
                        )}
                    </Text>
                  </View>
                  {latestPreview.status === 'found' ? (
                    <View
                      style={[
                        styles.previewScoreBubble,
                        {
                          backgroundColor: getScoreTone(latestPreview.analysis?.score),
                        },
                      ]}
                    >
                      <Text style={styles.previewScoreValue}>
                        {latestPreview.product?.type === 'medicine'
                          ? tt('medicine_short_label', 'ILAC')
                          : Math.round(latestPreview.analysis?.score ?? 0)}
                      </Text>
                      <Text style={styles.previewScoreCaption}>
                        {latestPreview.product?.type === 'medicine'
                          ? tt('medicine_label', 'İlaç')
                          : tt('score_short', 'Skor')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>

              {latestPreview.status === 'not_found' ? (
                <TouchableOpacity
                  style={styles.previewActionButton}
                  onPress={() => handleOpenMissingProduct(latestPreview.barcode)}
                  activeOpacity={0.88}
                >
                  <Ionicons name="add-circle-outline" size={18} color="#0B0E14" />
                  <Text style={styles.previewActionButtonText}>
                    {tt('add_product', 'Ürün Ekle')}
                  </Text>
                </TouchableOpacity>
              ) : latestPreview.status === 'found' ? (
                <>
                  {latestPreview.product?.type !== 'medicine' ? (
                    profileCityCode ? (
                      <>
                        {previewOffersError ? (
                          <Text style={[styles.previewMarketErrorText, { color: '#F59E0B' }]}>
                            {previewOffersError}
                          </Text>
                        ) : null}

                        {!previewOffersError ? (
                          <>
                            <Text style={styles.previewMarketSummaryText} numberOfLines={1}>
                              {previewMarketSummary}
                            </Text>
                            <MarketPriceTableCard
                              title={tt('scanner_market_prices_title', 'Market Fiyatları')}
                              subtitle={tt(
                                'scanner_market_prices_subtitle_compact',
                                'Market sütununa dokunarak detayı aç.'
                              )}
                              offers={previewOffers}
                              productType={latestPreview.product?.type}
                              locale={i18n.resolvedLanguage || 'tr-TR'}
                              colors={colors}
                              tt={tt}
                              loading={previewOffersLoading}
                              compact
                              onOfferPress={openPreviewMarketSheet}
                            />
                          </>
                        ) : null}
                      </>
                    ) : (
                      <Text style={styles.previewHintText}>
                        {tt(
                          'scanner_market_prices_missing_location',
                          'Şehir ve ilçe bilgini eklersen market fiyatları burada açılır.'
                        )}
                      </Text>
                    )
                  ) : null}

                  <Text style={styles.previewHintText}>
                    {latestPreview.isTextAnalysis
                      ? tt(
                          'scanner_text_preview_hint',
                          'Bu ilk sürümde metin analizi kart üzerinde özetlenir. Barkod akışları detay ekranına açılır.'
                        )
                      : tt(
                          'scanner_open_detail_hint',
                          'Detay ekranını açmak için karta dokunun, kamera taramaya devam eder.'
                        )}
                  </Text>
                </>
              ) : null}
            </View>
          ) : null}

          {previewHistory.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.previewQueueRow}
            >
              {previewHistory.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.previewQueueCard}
                  onPress={() => {
                    if (item.status === 'found') {
                      handleOpenPreviewDetail(item);
                    } else if (item.status === 'not_found') {
                      handleOpenMissingProduct(item.barcode);
                    }
                  }}
                  activeOpacity={0.88}
                >
                  <Text style={styles.previewQueueTitle} numberOfLines={1}>
                    {item.product?.name ||
                      (item.status === 'not_found'
                        ? tt('scanner_not_found_short', 'Bulunamadı')
                        : tt('scanner_status_searching', 'Aranıyor'))}
                  </Text>
                  <Text style={styles.previewQueueMeta} numberOfLines={1}>
                    {item.product?.type === 'medicine'
                      ? tt('medicine_label', 'İlaç')
                      : typeof item.analysis?.score === 'number'
                        ? `${Math.round(item.analysis.score)}/100`
                        : item.barcode}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
        </Animated.View>
      ) : null}

      <Modal
        visible={Boolean(previewMarketSheetOffer)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closePreviewMarketSheet}
      >
        <View style={styles.marketSheetOverlay}>
          <TouchableOpacity
            style={styles.marketSheetBackdrop}
            activeOpacity={1}
            onPress={closePreviewMarketSheet}
          />

          {previewMarketSheetOffer ? (
            <View style={styles.marketSheetWrap}>
              <View
                style={[
                  styles.marketSheetCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={[styles.marketSheetHandle, { backgroundColor: `${colors.border}AA` }]} />

                <View style={styles.marketSheetHeader}>
                  <View style={styles.marketSheetHeaderTextWrap}>
                    <Text style={[styles.marketSheetTitle, { color: colors.text }]}>
                      {previewMarketSheetOffer.marketName}
                    </Text>
                    <Text style={[styles.marketSheetSubtitle, { color: colors.text }]}>
                      {[
                        previewMarketSheetOffer.branchName,
                        previewMarketSheetOffer.districtName,
                        previewMarketSheetOffer.cityName,
                      ]
                        .filter(Boolean)
                        .join(' • ') || tt('price_compare_market_sheet_subtitle', 'Market detayı')}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.marketSheetCloseButton, { borderColor: colors.border }]}
                    onPress={closePreviewMarketSheet}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="close-outline" size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <View style={[styles.marketSheetDetailsWrap, { borderTopColor: `${colors.border}99` }]}>
                  {previewMarketSheetDetails?.map((detail) => (
                    <View
                      key={detail.key}
                      style={[styles.marketSheetDetailRow, { borderBottomColor: `${colors.border}99` }]}
                    >
                      <Text style={[styles.marketSheetDetailLabel, { color: colors.text }]}>
                        {detail.label}
                      </Text>
                      <Text style={[styles.marketSheetDetailValue, { color: colors.text }]}>
                        {detail.value}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.marketSheetActions}>
                  {previewMarketSheetOffer.latitude && previewMarketSheetOffer.longitude ? (
                    <TouchableOpacity
                      style={[styles.marketSheetActionButton, { borderColor: colors.primary }]}
                      activeOpacity={0.88}
                      onPress={() => {
                        void Linking.openURL(
                          `https://www.google.com/maps/search/?api=1&query=${previewMarketSheetOffer.latitude},${previewMarketSheetOffer.longitude}`
                        );
                      }}
                    >
                      <Ionicons name="navigate-outline" size={16} color={colors.primary} />
                      <Text style={[styles.marketSheetActionText, { color: colors.primary }]}>
                        {tt('price_compare_market_sheet_open_map', 'Haritada Aç')}
                      </Text>
                    </TouchableOpacity>
                  ) : null}

                  {previewMarketSheetOffer.sourceUrl ? (
                    <TouchableOpacity
                      style={[styles.marketSheetActionButton, { borderColor: colors.primary }]}
                      activeOpacity={0.88}
                      onPress={() => {
                        void Linking.openURL(previewMarketSheetOffer.sourceUrl);
                      }}
                    >
                      <Ionicons name="open-outline" size={16} color={colors.primary} />
                      <Text style={[styles.marketSheetActionText, { color: colors.primary }]}>
                        {tt('price_compare_market_sheet_open_source', 'Kaynağı Aç')}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>

      {isManualMode && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.manualOverlay}
        >
          <View
            style={[
              styles.manualCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.manualHeader}>
              <Text style={[styles.manualTitle, { color: colors.text }]}>
                {manualEntryMode === 'text'
                  ? tt('manual_text_title', 'Analiz edilecek metni girin')
                  : tt('manual_entry_title', 'Barkodu Elle Girin')}
              </Text>

              <TouchableOpacity onPress={closeManualMode}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.manualSubtitle, { color: colors.text }]}>
              {manualEntryMode === 'text'
                ? tt(
                    'manual_text_help',
                    'Gıda için içindekiler ve besin değerleri tablosunu birlikte yapıştırın. Sadece içerik metni girilirse sonuç sınırlı olabilir.'
                  )
                : tt(
                    'manual_barcode_help',
                    '8, 12 veya 13 haneli barkod numarasını girin.'
                  )}
            </Text>

            <TextInput
              style={[
                styles.input,
                manualEntryMode === 'text' && styles.inputMultiline,
                {
                  color: colors.text,
                  borderColor: manualError ? '#FF4444' : colors.border,
                  textAlign: manualEntryMode === 'text' ? 'left' : 'center',
                  letterSpacing: manualEntryMode === 'text' ? 0 : 1.5,
                },
              ]}
              placeholder={
                manualEntryMode === 'text'
                  ? tt('manual_text_placeholder', 'Örnek: İçindekiler: su, şeker, E330...')
                  : '8690000000000'
              }
              placeholderTextColor={`${colors.text}55`}
              keyboardType={manualEntryMode === 'text' ? 'default' : 'number-pad'}
              value={manualEntryMode === 'text' ? manualText : manualBarcode}
              onChangeText={(text) => {
                if (manualEntryMode === 'text') {
                  setManualText(text);
                } else {
                  setManualBarcode(text.replace(/[^\d]/g, ''));
                }
                setManualError('');
              }}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleManualSubmit}
              maxLength={manualEntryMode === 'text' ? 2000 : 14}
              multiline={manualEntryMode === 'text'}
              textAlignVertical={manualEntryMode === 'text' ? 'top' : 'center'}
            />

            {manualError ? <Text style={styles.errorText}>{manualError}</Text> : null}

            <View style={styles.manualActions}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  styles.cancelBtn,
                  { borderColor: colors.border },
                ]}
                onPress={closeManualMode}
              >
                <Text style={[styles.cancelBtnText, { color: colors.text }]}>
                  {tt('cancel', 'İptal')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                onPress={handleManualSubmit}
              >
                <Text style={styles.submitBtnText}>
                  {manualEntryMode === 'text'
                    ? tt('analyze', 'Analiz Et')
                    : tt('search', 'Sorgula')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  permissionIconWrap: {
    width: 110,
    height: 110,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
  },
  permissionText: {
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 24,
    fontSize: 15,
    lineHeight: 23,
    opacity: 0.78,
  },
  primaryBtn: {
    minWidth: 220,
    paddingHorizontal: 32,
    paddingVertical: 17,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 14,
    letterSpacing: 0.8,
  },
  secondaryGhostBtn: {
    marginTop: 14,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  secondaryGhostBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  topDarkArea: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 16,
  },
  topHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(11,14,20,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  topBackButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 2,
  },
  topHeaderEyebrow: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  topHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  modeRailWrap: {
    marginTop: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(11,14,20,0.42)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modeSelectorRow: {
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  modeChip: {
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '800',
  },
  topActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeHintCard: {
    marginTop: 12,
    borderRadius: 18,
    padding: 14,
    backgroundColor: 'rgba(11,14,20,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modeHintHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  modeHintTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modeHintTextWrap: {
    flex: 1,
  },
  modeHintIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeHintEyebrow: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  modeHintTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  modeHintClose: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modeHintBody: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  modeHintMiniRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  modeHintMiniText: {
    flex: 1,
    color: 'rgba(255,255,255,0.72)',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
  },
  modeHintAction: {
    marginTop: 12,
    alignSelf: 'flex-start',
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeHintActionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  topIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideDarkArea: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  middleRow: {
    flexDirection: 'row',
    height: 260,
  },
  scannerFrame: {
    width: 260,
    height: 260,
    borderWidth: 0.5,
    backgroundColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  scanLine: {
    height: 3,
    width: '100%',
    shadowColor: '#FFF',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderWidth: 5,
  },
  topLeft: {
    top: -2,
    left: -2,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: -2,
    right: -2,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  bottomDarkArea: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  frameGuideCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: 'rgba(11,14,20,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  frameGuideIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  frameGuideTextWrap: {
    flex: 1,
  },
  frameGuideTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '900',
  },
  frameGuideSubtitle: {
    color: 'rgba(255,255,255,0.70)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  frameGuideAction: {
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  frameGuideActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  textCapturePanel: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(11,14,20,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    gap: 12,
  },
  textCaptureWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(252,211,77,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.26)',
  },
  textCaptureWarningText: {
    flex: 1,
    color: 'rgba(255,255,255,0.84)',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  textCaptureActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  textCaptureButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  textCaptureButtonText: {
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  textManualFallback: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textManualFallbackText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  previewSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    zIndex: 4,
  },
  previewPrimaryCard: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
  },
  previewCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  previewBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  previewTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewDismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  previewStatusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  previewBarcodeText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  previewBodyTouchable: {
    marginTop: 14,
  },
  previewBody: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  previewImage: {
    width: 66,
    height: 66,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  previewTextWrap: {
    flex: 1,
  },
  previewScoreBubble: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  previewScoreValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  previewScoreCaption: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
    textAlign: 'center',
  },
  previewBrand: {
    color: '#FFD34D',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  previewName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 20,
  },
  previewMessage: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  previewActionButton: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#FFD34D',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  previewActionButtonText: {
    color: '#0B0E14',
    fontSize: 13,
    fontWeight: '900',
  },
  previewHintText: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
  },
  previewMarketErrorText: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
    fontWeight: '700',
  },
  previewMarketSummaryText: {
    color: 'rgba(255,255,255,0.74)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 12,
    marginBottom: 8,
    fontWeight: '700',
  },
  previewQueueRow: {
    paddingTop: 10,
    gap: 10,
  },
  previewQueueCard: {
    width: 140,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  previewQueueTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  previewQueueMeta: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  marketSheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 8,
  },
  marketSheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  marketSheetWrap: {
    paddingHorizontal: 12,
    paddingBottom: 18,
  },
  marketSheetCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  marketSheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    marginBottom: 16,
  },
  marketSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  marketSheetHeaderTextWrap: {
    flex: 1,
    gap: 4,
  },
  marketSheetTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '900',
  },
  marketSheetSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    opacity: 0.76,
  },
  marketSheetCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marketSheetDetailsWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  marketSheetDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  marketSheetDetailLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    opacity: 0.72,
  },
  marketSheetDetailValue: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'right',
  },
  marketSheetActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 16,
  },
  marketSheetActionButton: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  marketSheetActionText: {
    fontSize: 12,
    fontWeight: '800',
  },
  manualOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.86)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 10,
  },
  manualCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  manualHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  manualTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.3,
    flex: 1,
    paddingRight: 10,
  },
  manualSubtitle: {
    marginTop: 10,
    marginBottom: 18,
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.75,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 20,
    letterSpacing: 1.5,
    textAlign: 'center',
    marginBottom: 10,
  },
  inputMultiline: {
    minHeight: 150,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 15,
    lineHeight: 22,
  },
  errorText: {
    color: '#FF4444',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 15,
    fontWeight: '700',
  },
  manualActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 15,
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  submitBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
  },
});
