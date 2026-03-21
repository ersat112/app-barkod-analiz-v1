import React from 'react';
import {
  Modal,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../context/ThemeContext';

type SuccessOverlayProps = {
  visible: boolean;
  title?: string;
  message?: string;
  buttonText?: string;
  onClose: () => void;
  style?: StyleProp<ViewStyle>;
};

export const SuccessOverlay: React.FC<SuccessOverlayProps> = ({
  visible,
  title,
  message,
  buttonText,
  onClose,
  style,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  const tt = (key: string, fallback: string) => {
    const value = t(key, { defaultValue: fallback });
    return value === key ? fallback : value;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={[styles.overlay, style]}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.iconWrap,
              { backgroundColor: `${colors.primary}16` },
            ]}
          >
            <Ionicons name="checkmark-circle" size={62} color={colors.primary} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            {title || tt('operation_successful', 'İşlem Başarılı')}
          </Text>

          <Text style={[styles.message, { color: colors.text }]}>
            {message || tt('operation_completed', 'İşlem başarıyla tamamlandı.')}
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={onClose}
            activeOpacity={0.88}
          >
            <Text style={styles.buttonText}>
              {buttonText || tt('draft_saved_button', 'Tamam')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: 'center',
  },
  iconWrap: {
    width: 94,
    height: 94,
    borderRadius: 47,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  message: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    opacity: 0.78,
  },
  button: {
    minWidth: 150,
    marginTop: 22,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});