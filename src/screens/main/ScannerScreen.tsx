import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { AD_UNIT_ID, GLOBAL_AD_CONFIG } from '../../config/admob';
import { useTheme } from '../../context/ThemeContext';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import { adService } from '../../services/adService';
import { getAdMobModule } from '../../services/admobRuntime';
import { entitlementService } from '../../services/entitlement.service';
import { freeScanPolicyService } from '../../services/freeScanPolicy.service';
import { barcodeDecoder } from '../../utils/barcodeDecoder';

export const ScannerScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
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
  const [adLoaded, setAdLoaded] = useState(false);

  const [isManualMode, setIsManualMode] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [manualError, setManualError] = useState('');

  const interstitialRef = useRef<any>(null);
  const lineAnim = useRef(new Animated.Value(0)).current;
  const scanResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    const setupInterstitial = async () => {
      try {
        const entitlement = await entitlementService.getSnapshot();

        if (disposed) {
          return;
        }

        if (entitlement.isPremium) {
          console.log('[Interstitial] premium entitlement active, preload skipped');
          interstitialRef.current = null;
          setAdLoaded(false);
          return;
        }

        const policy = await adService.getCurrentPolicy();

        if (disposed) {
          return;
        }

        if (!policy.enabled || !policy.interstitialEnabled) {
          console.log('[Interstitial] policy disabled, preload skipped');
          interstitialRef.current = null;
          setAdLoaded(false);
          return;
        }

        const adsModule = getAdMobModule();

        if (!adsModule?.InterstitialAd || !adsModule?.AdEventType) {
          console.log('[Interstitial] native ads module unavailable');
          setAdLoaded(false);
          interstitialRef.current = null;
          return;
        }

        const { InterstitialAd, AdEventType } = adsModule;
        const interstitial = InterstitialAd.createForAdRequest(
          AD_UNIT_ID.INTERSTITIAL,
          GLOBAL_AD_CONFIG
        );

        const unsubscribeLoaded = interstitial.addAdEventListener(
          AdEventType.LOADED,
          () => {
            console.log('[Interstitial] loaded');
            setAdLoaded(true);
          }
        );

        const unsubscribeClosed = interstitial.addAdEventListener(
          AdEventType.CLOSED,
          () => {
            console.log('[Interstitial] closed');
            setAdLoaded(false);
            interstitial.load();
          }
        );

        const unsubscribeError = interstitial.addAdEventListener(
          AdEventType.ERROR,
          (error: unknown) => {
            console.log('[Interstitial] failed', error);
            setAdLoaded(false);

            void adService.trackInterstitialShowFailure(error, {
              stage: 'load',
              screen: 'Scanner',
              unitId: AD_UNIT_ID.INTERSTITIAL,
            });
          }
        );

        interstitial.load();
        interstitialRef.current = interstitial;

        cleanup = () => {
          unsubscribeLoaded?.();
          unsubscribeClosed?.();
          unsubscribeError?.();
        };
      } catch (error) {
        console.log('[Interstitial] setup failed', error);
        interstitialRef.current = null;
        setAdLoaded(false);

        void adService.trackInterstitialShowFailure(error, {
          stage: 'setup',
          screen: 'Scanner',
          unitId: AD_UNIT_ID.INTERSTITIAL,
        });
      }
    };

    void setupInterstitial();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);

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

  const closeManualMode = useCallback(() => {
    setIsManualMode(false);
    setManualError('');
    setManualBarcode('');
    Keyboard.dismiss();
  }, []);

  const resetTransientState = useCallback(() => {
    setIsManualMode(false);
    setManualBarcode('');
    setManualError('');
  }, []);

  const processBarcode = useCallback(
    async (validBarcodeData: string) => {
      setScanned(true);

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

      try {
        const entitlement = await entitlementService.getSnapshot();

        if (!entitlement.isPremium) {
          const decision = await adService.evaluateScanInterstitialOpportunity();

          if (decision.shouldShow && adLoaded && interstitialRef.current) {
            console.log('[Interstitial] show requested', decision);

            await interstitialRef.current.show();

            await adService.recordInterstitialShown({
              shownAt: Date.now(),
              successfulScanCount: decision.successfulScanCount,
            });
          } else if (decision.shouldShow) {
            console.log('[Interstitial] blocked - not ready', {
              reason: decision.reason,
              adLoaded,
              hasRef: Boolean(interstitialRef.current),
            });

            await adService.trackInterstitialShowFailure('interstitial_not_ready', {
              stage: 'show_gate',
              reason: decision.reason,
              adLoaded,
              hasRef: Boolean(interstitialRef.current),
              successfulScanCount: decision.successfulScanCount,
              screen: 'Scanner',
            });
          } else {
            console.log('[Interstitial] skipped', {
              reason: decision.reason,
              adLoaded,
            });
          }
        } else {
          console.log('[Interstitial] premium entitlement active, ads suppressed');
        }
      } catch (error) {
        console.error('Ad policy / show failed:', error);

        await adService.trackInterstitialShowFailure(error, {
          stage: 'show',
          screen: 'Scanner',
        });
      }

      resetTransientState();

      navigation.navigate('Detail', { barcode: validBarcodeData });

      if (scanResetTimeoutRef.current) {
        clearTimeout(scanResetTimeoutRef.current);
      }

      scanResetTimeoutRef.current = setTimeout(() => {
        setScanned(false);
      }, 1800);
    },
    [adLoaded, navigation, resetTransientState, tt]
  );

  const handleBarCodeScanned = useCallback(
    ({ data, type }: { data: string; type?: string }) => {
      if (scanned || !isFocused || isManualMode) {
        return;
      }

      const decoded = barcodeDecoder.decode(data, type);

      if (!decoded.isValid) {
        return;
      }

      void processBarcode(decoded.normalizedData);
    },
    [isFocused, isManualMode, processBarcode, scanned]
  );

  const handleManualSubmit = useCallback(() => {
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
  }, [manualBarcode, processBarcode, tt]);

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
  const bottomControlsOffset = layout.floatingBottomOffset;
  const infoPanelBottomOffset = bottomControlsOffset + 116;

  return (
    <View style={styles.container}>
      {isFocused && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          enableTorch={torch}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
          }}
        />
      )}

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={[styles.topDarkArea, { paddingTop: topInsetPadding }]}>
          <TouchableOpacity
            style={styles.topCloseBtn}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="close" size={28} color="#FFF" />
          </TouchableOpacity>
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

        <View style={styles.bottomDarkArea} />
      </View>

      {!isManualMode && (
        <View style={[styles.infoPanel, { bottom: infoPanelBottomOffset }]}>
          <Text style={styles.infoTitle}>{tt('scan_now', 'Şimdi Tara')}</Text>
          <Text style={styles.infoText}>
            {tt('align_barcode_instruction', 'Barkodu çerçeveye hizalayın')}
          </Text>
        </View>
      )}

      {!isManualMode && (
        <View
          style={[styles.controls, { bottom: bottomControlsOffset }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setTorch((prev) => !prev)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={torch ? 'flash' : 'flash-off'}
              size={24}
              color={torch ? colors.primary : '#FFF'}
            />
            <Text style={styles.controlLabel}>
              {torch ? tt('flash_on', 'Açık') : tt('flash_label', 'Flaş')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtnCenter}
            onPress={() => setIsManualMode(true)}
            activeOpacity={0.9}
          >
            <Ionicons name="keypad-outline" size={30} color={colors.primary} />
            <Text style={[styles.controlCenterLabel, { color: colors.primary }]}>
              {tt('manual_entry_title', 'Barkodu Elle Girin')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => setScanned(false)}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh-outline" size={24} color="#FFF" />
            <Text style={styles.controlLabel}>{tt('retry', 'Yenile')}</Text>
          </TouchableOpacity>
        </View>
      )}

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
                {tt('manual_entry_title', 'Barkodu Elle Girin')}
              </Text>

              <TouchableOpacity onPress={closeManualMode}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.manualSubtitle, { color: colors.text }]}>
              {tt(
                'manual_barcode_help',
                '8, 12 veya 13 haneli barkod numarasını girin.'
              )}
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: manualError ? '#FF4444' : colors.border,
                },
              ]}
              placeholder="8690000000000"
              placeholderTextColor={`${colors.text}55`}
              keyboardType="number-pad"
              value={manualBarcode}
              onChangeText={(text) => {
                setManualBarcode(text.replace(/[^\d]/g, ''));
                setManualError('');
              }}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleManualSubmit}
              maxLength={14}
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
                  {tt('search', 'Sorgula')}
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
    paddingHorizontal: 20,
  },
  topCloseBtn: {
    alignSelf: 'flex-end',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.10)',
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
  },
  infoPanel: {
    position: 'absolute',
    left: 24,
    right: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  infoTitle: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  infoText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
    opacity: 0.82,
  },
  controls: {
    position: 'absolute',
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 14,
    zIndex: 4,
  },
  controlBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  controlBtnCenter: {
    width: 94,
    height: 94,
    borderRadius: 47,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  controlLabel: {
    marginTop: 4,
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.85,
  },
  controlCenterLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: 6,
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