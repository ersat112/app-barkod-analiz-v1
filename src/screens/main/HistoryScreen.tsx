import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';

import {
  deleteHistoryEntryById,
  getAllHistory,
  type HistoryEntry,
} from '../../services/db';
import { useTheme } from '../../context/ThemeContext';
import { AdBanner } from '../../components/AdBanner';

type HistorySection = {
  title: string;
  rawDate: string;
  data: HistoryEntry[];
};

const FALLBACK_IMAGE = 'https://via.placeholder.com/100?text=No+Image';

const getLocalDateKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseCreatedAt = (createdAt?: string | null) => {
  if (!createdAt) {
    return { datePart: '', timePart: '--:--' };
  }

  const iso = createdAt.replace(' ', 'T');
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    const [datePart = '', timePart = ''] = createdAt.split(' ');
    return {
      datePart,
      timePart: timePart ? timePart.slice(0, 5) : '--:--',
    };
  }

  const datePart = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
  const timePart = `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`;

  return { datePart, timePart };
};

const formatDateTitle = (
  rawDate: string,
  tt: (key: string, fallback: string) => string
): string => {
  const today = getLocalDateKey();
  const yesterday = getLocalDateKey(new Date(Date.now() - 86400000));

  if (rawDate === today) return tt('today', 'Bugün');
  if (rawDate === yesterday) return tt('yesterday', 'Dün');

  return rawDate;
};

const groupHistoryByDate = (
  data: HistoryEntry[],
  tt: (key: string, fallback: string) => string
): HistorySection[] => {
  const grouped = data.reduce<Record<string, HistorySection>>((acc, item) => {
    const { datePart } = parseCreatedAt(item.created_at);
    const rawDate = datePart || 'unknown-date';

    if (!acc[rawDate]) {
      acc[rawDate] = {
        title: formatDateTitle(rawDate, tt),
        rawDate,
        data: [],
      };
    }

    acc[rawDate].data.push(item);
    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => b.rawDate.localeCompare(a.rawDate));
};

const HistoryItemImage: React.FC<{ uri?: string | null }> = ({ uri }) => {
  const [failed, setFailed] = useState(false);

  return (
    <Image
      source={{ uri: !uri || failed ? FALLBACK_IMAGE : uri }}
      style={styles.itemImage}
      onError={() => setFailed(true)}
    />
  );
};

export const HistoryScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const [items, setItems] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const sections = useMemo(() => groupHistoryByDate(items, tt), [items, tt]);

  const loadHistory = useCallback(async () => {
    try {
      setLoadError(null);
      setLoading(true);

      const data = await Promise.resolve(getAllHistory());
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Load history failed:', error);
      setItems([]);
      setLoadError(tt('error_generic', 'Geçmiş yüklenemedi'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tt]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadHistory();
  }, [loadHistory]);

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert(
        tt('delete_title', 'Sil'),
        tt('delete_confirm', 'Bu geçmiş kaydını silmek istiyor musunuz?'),
        [
          { text: tt('cancel', 'İptal'), style: 'cancel' },
          {
            text: tt('delete', 'Sil'),
            style: 'destructive',
            onPress: async () => {
              try {
                await Promise.resolve(deleteHistoryEntryById(id));
                await loadHistory();
              } catch (error) {
                console.error('Delete history failed:', error);
                Alert.alert(
                  tt('error_title', 'Hata'),
                  tt('delete_error', 'Geçmiş kaydı silinemedi')
                );
              }
            },
          },
        ]
      );
    },
    [loadHistory, tt]
  );

  const renderRightActions = useCallback(
    (id: number) => (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleDelete(id)}
        activeOpacity={0.82}
      >
        <Ionicons name="trash-outline" size={26} color="#FFF" />
      </TouchableOpacity>
    ),
    [handleDelete]
  );

  const renderItem = useCallback(
    ({ item }: { item: HistoryEntry }) => {
      const { timePart } = parseCreatedAt(item.created_at);

      return (
        <Swipeable
          overshootRight={false}
          renderRightActions={() => renderRightActions(item.id)}
        >
          <TouchableOpacity
            style={[
              styles.itemCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={() => navigation.navigate('Detail', { barcode: item.barcode })}
            activeOpacity={0.82}
          >
            <HistoryItemImage uri={item.image_url} />

            <View style={styles.itemDetails}>
              <Text style={[styles.itemBrand, { color: colors.primary }]} numberOfLines={1}>
                {item.brand || tt('unknown_brand', 'Bilinmeyen Marka')}
              </Text>

              <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>
                {item.name || tt('unnamed_product', 'İsimsiz Ürün')}
              </Text>

              <View style={styles.itemMetaRow}>
                <View
                  style={[
                    styles.inlineBadge,
                    { backgroundColor: `${colors.primary}12` },
                  ]}
                >
                  <Text
                    style={[styles.inlineBadgeText, { color: colors.primary }]}
                    numberOfLines={1}
                  >
                    {item.score ?? '-'}/100
                  </Text>
                </View>

                <View
                  style={[
                    styles.inlineBadge,
                    { backgroundColor: `${colors.primary}12` },
                  ]}
                >
                  <Text
                    style={[styles.inlineBadgeText, { color: colors.primary }]}
                    numberOfLines={1}
                  >
                    {item.type === 'beauty'
                      ? tt('beauty_label', 'Kozmetik')
                      : tt('food_label', 'Gıda')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.itemRightArea}>
              <Text style={[styles.itemTime, { color: colors.text }]}>{timePart}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.border} />
            </View>
          </TouchableOpacity>
        </Swipeable>
      );
    },
    [colors.border, colors.card, colors.primary, colors.text, navigation, renderRightActions, tt]
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.primary }]}>
          {tt('history', 'Geçmiş').toUpperCase()}
        </Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="cloud-offline-outline" size={72} color={colors.border} />
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          {tt('error_title', 'Hata')}
        </Text>
        <Text style={[styles.errorText, { color: colors.text }]}>{loadError}</Text>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={loadHistory}
        >
          <Text style={styles.primaryBtnText}>{tt('retry', 'Tekrar Dene')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!items.length) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="time-outline" size={72} color={colors.border} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {tt('history', 'Geçmiş')}
        </Text>
        <Text style={[styles.emptyText, { color: colors.text }]}>
          {tt('history_empty', 'Henüz bir tarama yapmadınız.')}
        </Text>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('Scanner')}
        >
          <Text style={styles.primaryBtnText}>{tt('scan_now', 'Şimdi Tara')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {section.title}
              </Text>
            </View>
          )}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: colors.primary }]}>
                {tt('history', 'Geçmiş')}
              </Text>
              <Text style={[styles.headerSubtitle, { color: colors.text }]}>
                {tt(
                  'history_swipe_hint',
                  'Önceki barkod analizlerinizi burada görebilir, sağa kaydırarak silebilirsiniz.'
                )}
              </Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.footerBox}>
              <AdBanner />
            </View>
          }
        />
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 36,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.68,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    opacity: 0.55,
    letterSpacing: 1,
  },
  itemCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemImage: {
    width: 72,
    height: 72,
    borderRadius: 18,
    resizeMode: 'cover',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
  },
  itemBrand: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  itemName: {
    marginTop: 5,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 21,
  },
  itemMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  inlineBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    maxWidth: '100%',
  },
  inlineBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  itemRightArea: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    minHeight: 64,
  },
  itemTime: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.7,
  },
  deleteAction: {
    marginRight: 16,
    marginBottom: 12,
    width: 88,
    borderRadius: 20,
    backgroundColor: '#FF4D4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBox: {
    marginTop: 16,
    paddingHorizontal: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 3,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '900',
  },
  emptyText: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.72,
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: '900',
  },
  errorText: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.72,
  },
  primaryBtn: {
    marginTop: 22,
    paddingHorizontal: 26,
    paddingVertical: 15,
    borderRadius: 16,
  },
  primaryBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});