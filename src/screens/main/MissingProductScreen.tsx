import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '../../context/ThemeContext';
import { useMissingProductFlow } from '../../hooks/useMissingProductFlow';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { AdBanner } from '../../components/AdBanner';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import {
  saveMissingProductDraft,
  type MissingProductType,
} from '../../services/missingProductDraft.service';
import { syncMissingProductDraftToFirestore } from '../../services/missingProductContribution.service';

type MissingRoute = RouteProp<RootStackParamList, 'MissingProduct'>;
type SaveOutcome = 'synced' | 'queued';
type ImageSyncState = 'none' | 'uploaded' | 'pending_upload' | 'upload_failed';

export const MissingProductScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<MissingRoute>();
  const {
    trackMissingProductDraftSaved,
    trackMissingProductScreenViewed,
  } = useMissingProductFlow();

  const layout = useAppScreenLayout({
    topInsetExtra: 12,
    topInsetMin: 56,
    contentBottomExtra: 40,
    contentBottomMin: 44,
    horizontalPadding: 20,
  });

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const barcode = useMemo(
    () => String(route.params?.barcode || '').replace(/[^\d]/g, '').trim(),
    [route.params?.barcode]
  );

  useEffect(() => {
    void trackMissingProductScreenViewed(barcode, 'detail_not_found');
  }, [barcode, trackMissingProductScreenViewed]);

  const typeOptions: { value: MissingProductType; label: string }[] = useMemo(
    () => [
      { value: 'food', label: tt('food_label', 'Gıda') },
      { value: 'beauty', label: tt('beauty_label', 'Kozmetik') },
      { value: 'unknown', label: tt('unknown', 'Bilinmiyor') },
    ],
    [tt]
  );

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [country, setCountry] = useState('');
  const [origin, setOrigin] = useState('');
  const [ingredientsText, setIngredientsText] = useState('');
  const [notes, setNotes] = useState('');
  const [productType, setProductType] = useState<MissingProductType>('unknown');
  const [imageUri, setImageUri] = useState('');
  const [saving, setSaving] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [saveOutcome, setSaveOutcome] = useState<SaveOutcome>('queued');
  const [imageSyncState, setImageSyncState] = useState<ImageSyncState>('none');

  const isFormValid = useMemo(() => {
    return barcode.length >= 8 && name.trim().length > 0;
  }, [barcode, name]);

  const handlePickImage = useCallback(
    async (source: 'camera' | 'library') => {
      try {
        if (source === 'camera') {
          const permission = await ImagePicker.requestCameraPermissionsAsync();

          if (!permission.granted) {
            Alert.alert(
              tt('error_title', 'Hata'),
              tt(
                'camera_permission_required',
                'Fotoğraf çekebilmek için kamera izni gerekiyor.'
              )
            );
            return;
          }

          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.72,
          });

          if (!result.canceled && result.assets?.[0]?.uri) {
            setImageUri(result.assets[0].uri);
          }

          return;
        }

        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            tt('error_title', 'Hata'),
            tt(
              'media_library_permission_required',
              'Galeriden görsel seçebilmek için medya izni gerekiyor.'
            )
          );
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          quality: 0.72,
        });

        if (!result.canceled && result.assets?.[0]?.uri) {
          setImageUri(result.assets[0].uri);
        }
      } catch (error) {
        console.error('Missing product image pick failed:', error);
        Alert.alert(
          tt('error_title', 'Hata'),
          tt(
            'image_pick_error',
            'Ürün görseli seçilirken bir hata oluştu. Lütfen tekrar deneyin.'
          )
        );
      }
    },
    [tt]
  );

  const saveDraft = useCallback(async () => {
    if (!isFormValid) {
      Alert.alert(
        tt('error_title', 'Hata'),
        tt('required_product_name', 'Lütfen en az ürün adını doldurun.')
      );
      return;
    }

    try {
      setSaving(true);

      const draft = await saveMissingProductDraft({
        barcode,
        name,
        brand,
        country,
        origin,
        ingredients_text: ingredientsText,
        notes,
        type: productType,
        image_local_uri: imageUri,
        entry_point: 'detail_not_found',
        source_screen: 'MissingProductScreen',
      });

      await trackMissingProductDraftSaved({
        barcode,
        type: productType,
        hasBrand: brand.trim().length > 0,
        hasCountry: country.trim().length > 0,
        hasOrigin: origin.trim().length > 0,
        hasIngredients: ingredientsText.trim().length > 0,
        hasNotes: notes.trim().length > 0,
        hasImage: imageUri.trim().length > 0,
        entryPoint: 'detail_not_found',
        localId: draft.localId,
        queueStatus: draft.review_queue_status,
      });

      const syncResult = await syncMissingProductDraftToFirestore(draft);

      setSaveOutcome(syncResult.status === 'synced' ? 'synced' : 'queued');
      setImageSyncState(syncResult.imageStatus ?? 'none');
      setSuccessVisible(true);
    } catch (error) {
      console.error('Missing product draft save failed:', error);
      Alert.alert(
        tt('error_title', 'Hata'),
        tt('draft_save_error', 'Taslak kayıt sırasında bir hata oluştu.')
      );
    } finally {
      setSaving(false);
    }
  }, [
    barcode,
    brand,
    country,
    ingredientsText,
    isFormValid,
    name,
    notes,
    origin,
    productType,
    imageUri,
    trackMissingProductDraftSaved,
    tt,
  ]);

  const closeSuccess = useCallback(() => {
    setSuccessVisible(false);
    navigation.goBack();
  }, [navigation]);

  const successTitle = useMemo(() => {
    return saveOutcome === 'synced'
      ? tt('draft_synced_title', 'Bildirim Gönderildi')
      : tt('draft_saved_title', 'Taslak Kuyruğa Alındı');
  }, [saveOutcome, tt]);

  const successText = useMemo(() => {
    if (saveOutcome === 'queued' && imageSyncState === 'upload_failed') {
      return tt(
        'draft_image_pending_message',
        'Eksik ürün kaydı Firebase katkı kuyruğuna gönderildi. Görsel yüklemesi tamamlanamadığı için cihazda saklandı ve daha sonra tekrar denenecek.'
      );
    }

    return saveOutcome === 'synced'
      ? tt(
          'draft_synced_message',
          'Eksik ürün bildirimi Firestore katkı kuyruğuna başarıyla gönderildi.'
        )
      : tt(
          'draft_saved_message',
        'Eksik ürün bildirimi yerel taslak olarak saklandı. Ağ veya izin sorunu nedeniyle daha sonra tekrar senkronize edilebilir.'
      );
  }, [imageSyncState, saveOutcome, tt]);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView
        contentContainerStyle={{
          ...styles.scrollContent,
          paddingTop: layout.headerTopPadding,
          paddingBottom: layout.contentBottomPadding,
          paddingHorizontal: layout.horizontalPadding,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backBtn, { borderColor: colors.border }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: colors.primary }]}>
            {tt('missing_product_report', 'Eksik Ürün Bildir')}
          </Text>

          <Text style={[styles.headerSubtitle, { color: colors.text }]}>
            {tt(
              'missing_product_subtitle',
              'Bu barkod veritabanında yoksa ürün bilgilerini kaydedin. Uygulama önce yerel taslak oluşturur, ardından güvenli şekilde katkı kuyruğuna göndermeyi dener.'
            )}
          </Text>
        </View>

        <View
          style={[
            styles.barcodeCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Ionicons name="barcode-outline" size={24} color={colors.primary} />
          <View style={styles.barcodeInfo}>
            <Text style={[styles.barcodeLabel, { color: colors.text }]}>
              {tt('barcode_label', 'Barkod')}
            </Text>
            <Text style={[styles.barcodeValue, { color: colors.primary }]}>
              {barcode || '-'}
            </Text>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>
            {tt('product_name_label', 'Ürün Adı')} *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="Örn: Organik Keçiboynuzu Özü"
            placeholderTextColor={`${colors.text}55`}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>
            {tt('brand_label', 'Marka')}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
            value={brand}
            onChangeText={setBrand}
            placeholder="Örn: X Marka"
            placeholderTextColor={`${colors.text}55`}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>
            {tt('product_image_label', 'Ürün Görseli')}
          </Text>

          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          ) : (
            <View
              style={[
                styles.imagePlaceholder,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
            >
              <Ionicons name="image-outline" size={28} color={colors.primary} />
              <Text style={[styles.imagePlaceholderText, { color: colors.text }]}>
                {tt(
                  'product_image_helper',
                  'Ürünün ön yüzünü ya da barkodun göründüğü net bir fotoğraf ekleyin.'
                )}
              </Text>
            </View>
          )}

          <View style={styles.imageActionRow}>
            <TouchableOpacity
              style={[
                styles.imageActionButton,
                {
                  backgroundColor: `${colors.primary}14`,
                  borderColor: `${colors.primary}28`,
                },
              ]}
              onPress={() => {
                void handlePickImage('library');
              }}
              activeOpacity={0.86}
            >
              <Ionicons name="images-outline" size={18} color={colors.primary} />
              <Text style={[styles.imageActionButtonText, { color: colors.primary }]}>
                {imageUri
                  ? tt('change_product_image', 'Görseli Değiştir')
                  : tt('choose_from_gallery', 'Galeriden Seç')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.imageActionButton,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => {
                void handlePickImage('camera');
              }}
              activeOpacity={0.86}
            >
              <Ionicons name="camera-outline" size={18} color={colors.text} />
              <Text style={[styles.imageActionButtonText, { color: colors.text }]}>
                {tt('take_photo', 'Fotoğraf Çek')}
              </Text>
            </TouchableOpacity>
          </View>

          {imageUri ? (
            <TouchableOpacity
              style={[
                styles.imageRemoveButton,
                {
                  borderColor: colors.border,
                },
              ]}
              onPress={() => setImageUri('')}
              activeOpacity={0.86}
            >
              <Ionicons name="trash-outline" size={16} color="#D64545" />
              <Text style={styles.imageRemoveButtonText}>
                {tt('remove_image', 'Görseli Kaldır')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>
            {tt('product_type', 'Ürün Tipi')}
          </Text>
          <View style={styles.typeRow}>
            {typeOptions.map((option) => {
              const selected = productType === option.value;

              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.typeChip,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? `${colors.primary}12` : colors.card,
                    },
                  ]}
                  onPress={() => setProductType(option.value)}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      { color: selected ? colors.primary : colors.text },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.twoColRow}>
          <View style={[styles.formGroup, styles.halfCol]}>
            <Text style={[styles.label, { color: colors.text }]}>
              {tt('country_label', 'Ülke')}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
              value={country}
              onChangeText={setCountry}
              placeholder="Örn: Türkiye"
              placeholderTextColor={`${colors.text}55`}
            />
          </View>

          <View style={[styles.formGroup, styles.halfCol]}>
            <Text style={[styles.label, { color: colors.text }]}>
              {tt('origin_label', 'Menşei')}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                },
              ]}
              value={origin}
              onChangeText={setOrigin}
              placeholder="Örn: Konya"
              placeholderTextColor={`${colors.text}55`}
            />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>
            {tt('ingredients_info_label', 'İçerik Bilgisi')}
          </Text>
          <TextInput
            style={[
              styles.textArea,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
            value={ingredientsText}
            onChangeText={setIngredientsText}
            placeholder="Ambalaj üzerindeki içerik listesini yazabilirsiniz."
            placeholderTextColor={`${colors.text}55`}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={[styles.label, { color: colors.text }]}>
            {tt('notes_label', 'Ek Notlar')}
          </Text>
          <TextInput
            style={[
              styles.textArea,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.card,
              },
            ]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Fiyat, ambalaj tipi, raf bilgisi gibi ek notlar..."
            placeholderTextColor={`${colors.text}55`}
            multiline
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submitBtn,
            {
              backgroundColor: isFormValid ? colors.primary : `${colors.border}`,
              opacity: saving ? 0.7 : 1,
            },
          ]}
          onPress={saveDraft}
          disabled={!isFormValid || saving}
        >
          {saving ? (
            <Text style={styles.submitBtnText}>
              {tt('saving_draft', 'Kaydediliyor...')}
            </Text>
          ) : (
            <Text style={styles.submitBtnText}>
              {tt('save_as_draft', 'Kaydet ve Senkronize Et')}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.helperText, { color: colors.text }]}>
          {tt(
            'draft_helper_text',
            'Bu ekran önce yerel taslak üretir. Firestore senkronu başarılıysa katkı kuyruğuna gider, başarısız olursa taslak cihazda korunur.'
          )}
        </Text>

        <View style={styles.adBox}>
          <AdBanner placement="missing_product_footer" />
        </View>
      </ScrollView>

      <Modal visible={successVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.successCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={[styles.successIconWrap, { backgroundColor: `${colors.primary}15` }]}>
              <Ionicons
                name={saveOutcome === 'synced' ? 'cloud-done-outline' : 'save-outline'}
                size={60}
                color={colors.primary}
              />
            </View>

            <Text style={[styles.successTitle, { color: colors.text }]}>
              {successTitle}
            </Text>

            <Text style={[styles.successText, { color: colors.text }]}>
              {successText}
            </Text>

            <TouchableOpacity
              style={[styles.successBtn, { backgroundColor: colors.primary }]}
              onPress={closeSuccess}
            >
              <Text style={styles.successBtnText}>
                {tt('draft_saved_button', 'Tamam')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {},
  header: {
    marginBottom: 22,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.72,
  },
  barcodeCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },
  barcodeInfo: {
    marginLeft: 12,
    flex: 1,
  },
  barcodeLabel: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.65,
  },
  barcodeValue: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  formGroup: {
    marginBottom: 16,
  },
  imagePreview: {
    width: '100%',
    height: 220,
    borderRadius: 18,
    marginBottom: 12,
  },
  imagePlaceholder: {
    borderWidth: 1,
    borderRadius: 18,
    minHeight: 160,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  imagePlaceholderText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    opacity: 0.76,
  },
  imageActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  imageActionButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  imageActionButtonText: {
    fontSize: 13,
    fontWeight: '800',
  },
  imageRemoveButton: {
    marginTop: 10,
    minHeight: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  imageRemoveButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#D64545',
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfCol: {
    flex: 1,
  },
  label: {
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    minHeight: 120,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: '800',
  },
  submitBtn: {
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  helperText: {
    marginTop: 14,
    fontSize: 12,
    lineHeight: 20,
    opacity: 0.65,
  },
  adBox: {
    marginTop: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
  },
  successIconWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
  },
  successText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    opacity: 0.75,
  },
  successBtn: {
    marginTop: 22,
    minWidth: 150,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  successBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
  },
});
