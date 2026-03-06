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
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

// Context & Data
import { auth, db } from '../../config/firebase';
import { useTheme } from '../../context/ThemeContext';
import { TURKEY_DATA } from '../../services/locationData';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  district: string;
  address: string;
  password: string;
  confirmPassword: string;
  kvkkAccepted: boolean;
}

export const SignUpScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  // States
  const [formData, setFormData] = useState<FormData>({
    firstName: '', lastName: '', email: '', phone: '',
    city: '', district: '', address: '',
    password: '', confirmPassword: '', kvkkAccepted: false,
  });
  const [loading, setLoading] = useState(false);
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [districtModalVisible, setDistrictModalVisible] = useState(false);

  const updateField = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  /**
   * Kayıt Algoritması ve Doğrulama Katmanı
   */
  const handleSignUp = async () => {
    const { email, password, confirmPassword, firstName, lastName, city, district, kvkkAccepted } = formData;

    // 1. Temel Boşluk Kontrolü
    if (!email || !password || !firstName || !lastName || !city || !district) {
      Alert.alert(t('error_title'), t('fill_all_fields'));
      return;
    }

    // 2. Şifre Eşleşme Kontrolü
    if (password !== confirmPassword) {
      Alert.alert(t('error_title'), t('passwords_do_not_match'));
      return;
    }

    // 3. KVKK Kontrolü
    if (!kvkkAccepted) {
      Alert.alert(t('error_title'), t('accept_kvkk_error'));
      return;
    }

    setLoading(true);
    try {
      // Firebase Auth: Kullanıcı Oluşturma
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Firestore: Ek Profil Bilgilerini Kaydetme
      await setDoc(doc(db, "users", user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: formData.phone,
        city,
        district,
        address: formData.address,
        email: email.trim(),
        createdAt: new Date().toISOString(),
      });

    } catch (error: any) {
      let message = t('signup_error_generic');
      if (error.code === 'auth/email-already-in-use') message = t('email_already_in_use');
      Alert.alert(t('error_title'), message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Şehir ve İlçe Seçim Modalı Render Fonksiyonu
   */
  const renderPickerModal = (visible: boolean, setVisible: (v: boolean) => void, data: string[], onSelect: (val: string) => void) => (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('select_location')}</Text>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={data}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={styles.modalItem} 
                onPress={() => { onSelect(item); setVisible(false); }}
              >
                <Text style={{ color: colors.text, fontSize: 16 }}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <Text style={[styles.title, { color: colors.primary }]}>{t('signup')}</Text>

        <View style={styles.form}>
          <View style={styles.row}>
            <TextInput placeholder={t('first_name')} style={[styles.input, styles.halfInput, { color: colors.text, borderColor: colors.border }]} onChangeText={v => updateField('firstName', v)} placeholderTextColor="#777" />
            <TextInput placeholder={t('last_name')} style={[styles.input, styles.halfInput, { color: colors.text, borderColor: colors.border }]} onChangeText={v => updateField('lastName', v)} placeholderTextColor="#777" />
          </View>

          <TextInput placeholder={t('email')} style={[styles.input, { color: colors.text, borderColor: colors.border }]} keyboardType="email-address" autoCapitalize="none" onChangeText={v => updateField('email', v)} placeholderTextColor="#777" />
          <TextInput placeholder={t('phone')} style={[styles.input, { color: colors.text, borderColor: colors.border }]} keyboardType="phone-pad" onChangeText={v => updateField('phone', v)} placeholderTextColor="#777" />

          {/* Konum Seçiciler */}
          <TouchableOpacity style={[styles.input, styles.pickerInput, { borderColor: colors.border }]} onPress={() => setCityModalVisible(true)}>
            <Text style={{ color: formData.city ? colors.text : '#777' }}>{formData.city || t('city')}</Text>
            <Ionicons name="chevron-down" size={18} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.input, styles.pickerInput, { borderColor: colors.border, opacity: formData.city ? 1 : 0.5 }]} 
            onPress={() => formData.city && setDistrictModalVisible(true)}
          >
            <Text style={{ color: formData.district ? colors.text : '#777' }}>{formData.district || t('district')}</Text>
            <Ionicons name="chevron-down" size={18} color={colors.primary} />
          </TouchableOpacity>

          <TextInput placeholder={t('password')} style={[styles.input, { color: colors.text, borderColor: colors.border }]} secureTextEntry onChangeText={v => updateField('password', v)} placeholderTextColor="#777" />
          <TextInput placeholder={t('confirm_password')} style={[styles.input, { color: colors.text, borderColor: colors.border }]} secureTextEntry onChangeText={v => updateField('confirmPassword', v)} placeholderTextColor="#777" />

          {/* KVKK Onayı */}
          <TouchableOpacity style={styles.kvkkRow} onPress={() => updateField('kvkkAccepted', !formData.kvkkAccepted)}>
            <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: formData.kvkkAccepted ? colors.primary : 'transparent' }]}>
              {formData.kvkkAccepted && <Ionicons name="checkmark" size={16} color="#000" />}
            </View>
            <Text style={[styles.kvkkText, { color: colors.text }]}>{t('kvkk_agreement_text')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.signUpButton, { backgroundColor: colors.primary }]} onPress={handleSignUp} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>{t('signup').toUpperCase()}</Text>}
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Modallar */}
      {renderPickerModal(cityModalVisible, setCityModalVisible, Object.keys(TURKEY_DATA), (val) => { updateField('city', val); updateField('district', ''); })}
      {renderPickerModal(districtModalVisible, setDistrictModalVisible, TURKEY_DATA[formData.city] || [], (val) => updateField('district', val))}
      
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  scrollContent: { padding: 25, paddingTop: 60 },
  title: { fontSize: 32, fontWeight: '900', marginBottom: 30 },
  form: { width: '100%' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInput: { width: '48%' },
  input: { height: 55, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, marginBottom: 15, fontSize: 14, backgroundColor: 'rgba(255,255,255,0.02)' },
  pickerInput: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kvkkRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10, paddingRight: 20 },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderRadius: 6, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  kvkkText: { fontSize: 12, lineHeight: 18, opacity: 0.8 },
  signUpButton: { height: 60, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginTop: 25 },
  buttonText: { color: '#000', fontWeight: '900', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 25, borderTopRightRadius: 25, height: '70%', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  modalItem: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' }
});