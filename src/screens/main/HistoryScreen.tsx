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

import { ScreenOnboardingOverlay } from '../../components/ScreenOnboardingOverlay';
import { useTheme } from '../../context/ThemeContext';
import { AdBanner } from '../../components/AdBanner';
import { usePaginatedHistory } from '../../hooks/usePaginatedHistory';
import { useRescanActions } from '../../hooks/useRescanActions';
import { useAppScreenLayout } from '../../components/layout/useAppScreenLayout';
import {
  hasSeenScreenOnboarding,
  markScreenOnboardingSeen,
} from '../../services/screenOnboarding.service';
import {
  HistoryEmptyState,
  HistoryErrorState,
  HistoryFilterBar,
  HistoryListFooter,
  HistoryListHeader,
  HistoryListItem,
  HistoryLoadingState,
  HistorySectionHeader,
} from './history/HistorySections';

const resolveLookupModeFromType = (
  type: 'food' | 'beauty' | 'medicine'
): 'food' | 'beauty' | 'medicine' => {
  if (type === 'medicine') {
    return 'medicine';
  }

  if (type === 'beauty') {
    return 'beauty';
  }

  return 'food';
};

export const HistoryScreen: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [showOnboarding, setShowOnboarding] = React.useState(false);

  const layout = useAppScreenLayout({
    topInsetExtra: 20,
    topInsetMin: 60,
    contentBottomExtra: 16,
    contentBottomMin: 24,
  });

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
    searchQuery,
    selectedType,
    hasActiveFilters,
    loadInitial,
    refresh,
    loadMore,
    deleteEntry,
    setSearchQuery,
    setSelectedType,
    clearFilters,
    parseCreatedAt,
  } = usePaginatedHistory(tt);

  const {
    load: loadRescanActions,
    refresh: refreshRescanActions,
    toggleFavorite,
    isFavorite,
  } = useRescanActions();

  useFocusEffect(
    useCallback(() => {
      void loadInitial();
      void loadRescanActions();

      let cancelled = false;

      const loadOnboarding = async () => {
        const hasSeen = await hasSeenScreenOnboarding('history');

        if (!cancelled) {
          setShowOnboarding(!hasSeen);
        }
      };

      void loadOnboarding();

      return () => {
        cancelled = true;
      };
    }, [loadInitial, loadRescanActions])
  );

  const handleDismissOnboarding = useCallback(() => {
    setShowOnboarding(false);
    void markScreenOnboardingSeen('history');
  }, []);

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
                await refreshRescanActions();
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
    [deleteEntry, refreshRescanActions, tt]
  );

  const handleRefresh = useCallback(async () => {
    await Promise.all([refresh(), refreshRescanActions()]);
  }, [refresh, refreshRescanActions]);

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
    if (hasActiveFilters) {
      return (
        <HistoryEmptyState
          title={tt('no_results', 'Sonuç bulunamadı')}
          text={tt(
            'history_filtered_empty',
            'Arama veya filtre sonucunda eşleşen geçmiş kaydı bulunamadı.'
          )}
          actionLabel={tt('clear_filters', 'Filtreleri Temizle')}
          onActionPress={clearFilters}
          colors={colors}
        />
      );
    }

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
                medicineLabel={tt('medicine_label', 'İlaç')}
                officialLabel={tt('history_status_official', 'Resmi kayıt')}
                excellentLabel={tt('history_status_excellent', 'Mükemmel')}
                goodLabel={tt('history_status_good', 'İyi')}
                poorLabel={tt('history_status_poor', 'Orta')}
                badLabel={tt('history_status_bad', 'Kötü')}
                favoriteLabel={tt('favorite', 'Favori')}
                unfavoriteLabel={tt('remove_favorite', 'Favoriden Çıkar')}
                fallbackBrand={tt('unknown_brand', 'Bilinmeyen Marka')}
                fallbackName={tt('unnamed_product', 'İsimsiz Ürün')}
                isFavorite={isFavorite(item.barcode)}
                onPress={() =>
                  navigation.navigate('Detail', {
                    barcode: item.barcode,
                    entrySource: 'history',
                    prefetchedProduct: item,
                    lookupMode: resolveLookupModeFromType(item.type),
                  })
                }
                onDelete={() => handleDelete(item.id)}
                onToggleFavorite={() => {
                  void toggleFavorite(item.barcode);
                }}
                colors={colors}
              />
            );
          }}
          renderSectionHeader={({ section }) => (
            <HistorySectionHeader section={section} colors={colors} />
          )}
          ListHeaderComponent={
            <>
              <HistoryListHeader
                title={tt('history', 'Geçmiş')}
                subtitle={tt(
                  'history_swipe_hint',
                  'Son taramalarını burada görebilir, arayabilir ve sağa kaydırarak silebilirsin.'
                )}
                colors={colors}
                topPadding={layout.headerTopPadding}
              />
              <HistoryFilterBar
                searchValue={searchQuery}
                selectedType={selectedType}
                hasActiveFilters={hasActiveFilters}
                onSearchChange={setSearchQuery}
                onSelectType={setSelectedType}
                onClear={clearFilters}
                searchPlaceholder={tt('history_search_placeholder', 'Marka, ürün ya da barkod ara')}
                allLabel={tt('all', 'Tümü')}
                foodLabel={tt('food_label', 'Gıda')}
                beautyLabel={tt('beauty_label', 'Kozmetik')}
                medicineLabel={tt('medicine_label', 'İlaç')}
                clearLabel={tt('clear', 'Temizle')}
                colors={colors}
              />
            </>
          }
          ListFooterComponent={
            <>
              <HistoryListFooter
                loadingMore={loadingMore}
                hasMore={hasMore}
                colors={colors}
              />
              <View style={styles.footerBox}>
                <AdBanner placement="history_footer" />
              </View>
              <View style={{ height: layout.contentBottomPadding }} />
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
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
        />

        <ScreenOnboardingOverlay
          visible={showOnboarding}
          icon="time-outline"
          title={tt('history_onboarding_title', 'Geçmiş burada')}
          body={tt(
            'history_onboarding_body',
            'Önceki taramaları burada arayabilir, filtreleyebilir, favoriye alabilir ve tekrar detayına gidebilirsin.'
          )}
          actionLabel={tt('onboarding_continue', 'Tamam')}
          colors={colors}
          onPress={handleDismissOnboarding}
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
