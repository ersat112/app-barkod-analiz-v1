import React, { useCallback } from 'react';
import {
  Alert,
  RefreshControl,
  SectionList,
  StyleSheet,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../context/ThemeContext';
import { AdBanner } from '../../components/AdBanner';
import { usePaginatedHistory } from '../../hooks/usePaginatedHistory';
import {
  HistoryEmptyState,
  HistoryErrorState,
  HistoryListFooter,
  HistoryListHeader,
  HistoryListItem,
  HistoryLoadingState,
  HistorySectionHeader,
} from './history/HistorySections';

export const HistoryScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const tt = useCallback(
    (key: string, fallback: string) => {
      const value = t(key, { defaultValue: fallback });
      return value === key ? fallback : value;
    },
    [t]
  );

  const {
    sections,
    items,
    loading,
    loadingMore,
    refreshing,
    loadError,
    hasMore,
    loadInitial,
    refresh,
    loadMore,
    deleteEntry,
    parseCreatedAt,
  } = usePaginatedHistory(tt);

  useFocusEffect(
    useCallback(() => {
      loadInitial();
    }, [loadInitial])
  );

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
                await deleteEntry(id);
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
    [deleteEntry, tt]
  );

  if (loading) {
    return <HistoryLoadingState label={tt('history', 'Geçmiş')} colors={colors} />;
  }

  if (loadError) {
    return (
      <HistoryErrorState
        title={tt('error_title', 'Hata')}
        text={tt('error_generic', 'Geçmiş yüklenemedi')}
        actionLabel={tt('retry', 'Tekrar Dene')}
        onActionPress={loadInitial}
        colors={colors}
      />
    );
  }

  if (!items.length) {
    return (
      <HistoryEmptyState
        title={tt('history', 'Geçmiş')}
        text={tt('history_empty', 'Henüz bir tarama yapmadınız.')}
        actionLabel={tt('scan_now', 'Şimdi Tara')}
        onActionPress={() => navigation.navigate('Scanner')}
        colors={colors}
      />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const { timePart } = parseCreatedAt(item.created_at);

            return (
              <HistoryListItem
                item={item}
                timeLabel={timePart}
                beautyLabel={tt('beauty_label', 'Kozmetik')}
                foodLabel={tt('food_label', 'Gıda')}
                fallbackBrand={tt('unknown_brand', 'Bilinmeyen Marka')}
                fallbackName={tt('unnamed_product', 'İsimsiz Ürün')}
                onPress={() => navigation.navigate('Detail', { barcode: item.barcode })}
                onDelete={() => handleDelete(item.id)}
                colors={colors}
              />
            );
          }}
          renderSectionHeader={({ section }) => (
            <HistorySectionHeader section={section} colors={colors} />
          )}
          ListHeaderComponent={
            <HistoryListHeader
              title={tt('history', 'Geçmiş')}
              subtitle={tt(
                'history_swipe_hint',
                'Önceki barkod analizlerinizi burada görebilir, sağa kaydırarak silebilirsiniz.'
              )}
              colors={colors}
            />
          }
          ListFooterComponent={
            <>
              <HistoryListFooter
                loadingMore={loadingMore}
                hasMore={hasMore}
                colors={colors}
              />
              <View style={styles.footerBox}>
                <AdBanner />
              </View>
              <View style={{ height: Math.max(insets.bottom + 16, 24) }} />
            </>
          }
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.35}
          onEndReached={loadMore}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor={colors.primary}
            />
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
    paddingBottom: 12,
  },
  footerBox: {
    marginTop: 8,
    paddingHorizontal: 12,
  },
});