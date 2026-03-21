import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../context/ThemeContext';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { AdBanner } from '../../components/AdBanner';

type MissingRoute = RouteProp<RootStackParamList, 'MissingProduct'>;

type MissingProductType = 'food' | 'beauty' | 'unknown';

type MissingDraft = {
  barcode: string;
  name: string;
  brand: string;
  country: string;
  origin: string;
  ingredients_text: string;
  notes: string;
  type: MissingProductType;
  created_at: string;
  status: 'draft';
};

const STORAGE_KEY = 'erenesal_missing_product_drafts';

export const MissingProductScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<MissingRoute>();

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

  const typeOptions: Array<{ value: MissingProductType; label: string }> = useMemo(
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
  const [saving, setSaving] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  const isFormValid = useMemo(() => {
    return barcode.length >= 8 && name.trim().length > 0;
  }, [barcode, name]);

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

      const draft: MissingDraft = {
        barcode,
        name: name.trim(),
        brand: brand.trim(),
        country: country.trim(),
        origin: origin.trim(),
        ingredients_text: ingredientsText.trim(),
        notes: notes.trim(),
        type: productType,
        created_at: new Date().toISOString(),
        status: 'draft',
      };

      const existingRaw = await AsyncStorage.getItem(STORAGE_KEY);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];

      const nextValue = [draft, ...(Array.isArray(existing) ? existing : [])];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue));

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
    tt,
  ]);

  const closeSuccess = useCallback(() => {
    setSuccessVisible(false);
    navigation.goBack();
  }, [navigation]);

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
              'Bu barkod veritabanında yoksa, ürün bilgilerini kaydederek sonraki sürümlerde katkı sağlayabilirsiniz.'
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
              {tt('save_as_draft', 'Taslak Olarak Kaydet')}
            </Text>
          )}
        </TouchableOpacity>

        <Text style={[styles.helperText, { color: colors.text }]}>
          {tt(
            'draft_helper_text',
            'Bu kayıt yerel taslak olarak saklanır. İleride admin paneli veya toplu senkronizasyon ile sisteme aktarılabilir.'
          )}
        </Text>

        <View style={styles.adBox}>
          <AdBanner />
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
              <Ionicons name="checkmark-circle" size={60} color={colors.primary} />
            </View>

            <Text style={[styles.successTitle, { color: colors.text }]}>
              {tt('draft_saved_title', 'Taslak Kaydedildi')}
            </Text>

            <Text style={[styles.successText, { color: colors.text }]}>
              {tt(
                'draft_saved_message',
                'Eksik ürün bildirimi taslak olarak kaydedildi. Daha sonra sisteme ekleme veya senkronizasyon için kullanılabilir.'
              )}
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
  scrollContent: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 40,
  },
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