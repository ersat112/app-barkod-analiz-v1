import React, { useCallback } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../context/ThemeContext';
import {
  LEGAL_VERSION_LABEL,
  getLegalDocumentUrl,
  type LegalDocumentSlug,
} from '../../config/legalRuntime';
import { withAlpha } from '../../utils/color';

type AuthLegalNoticeProps = {
  compact?: boolean;
};

const LINK_ITEMS: { slug: LegalDocumentSlug; titleKey: string; fallback: string }[] = [
  {
    slug: 'terms',
    titleKey: 'terms_and_conditions',
    fallback: 'Şartlar ve Koşullar',
  },
  {
    slug: 'privacy',
    titleKey: 'privacy_policy',
    fallback: 'Gizlilik Politikası',
  },
  {
    slug: 'medical',
    titleKey: 'medical_disclaimer',
    fallback: 'Tıbbi ve Bilgilendirme Uyarısı',
  },
];

export const AuthLegalNotice: React.FC<AuthLegalNoticeProps> = ({ compact = false }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const handleOpen = useCallback(
    async (slug: LegalDocumentSlug) => {
      try {
        await WebBrowser.openBrowserAsync(getLegalDocumentUrl(slug), {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        });
      } catch (error) {
        console.warn('[AuthLegalNotice] failed to open legal doc:', error);
        Alert.alert(
          tt('error_title', 'Hata'),
          tt('legal_document_open_error', 'Yasal belge açılamadı.')
        );
      }
    },
    [tt]
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: withAlpha(colors.cardElevated, compact ? 'C8' : 'E6'),
          borderColor: withAlpha(colors.border, 'B8'),
        },
      ]}
    >
      <Text style={[styles.copy, { color: colors.mutedText }]}>
        {tt(
          'auth_legal_notice',
          'Devam ederek BarkodAnaliz Şartlar ve Koşullarını, Gizlilik Politikasını ve Tıbbi/Bilgilendirme Uyarısını inceleyebileceğinizi kabul etmiş olursunuz.'
        )}
      </Text>

      <Text style={[styles.versionText, { color: colors.mutedText }]}>
        {tt('legal_version_label', 'Belge seti sürümü')}: {LEGAL_VERSION_LABEL}
      </Text>

      <View style={styles.linksRow}>
        {LINK_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.slug}
            onPress={() => {
              void handleOpen(item.slug);
            }}
            activeOpacity={0.8}
            style={[
              styles.linkPill,
              { backgroundColor: withAlpha(colors.primary, '12') },
            ]}
          >
            <Text style={[styles.linkText, { color: colors.primary }]}>
              {tt(item.titleKey, item.fallback)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  copy: {
    fontSize: 12,
    lineHeight: 18,
  },
  versionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  linksRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  linkPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
