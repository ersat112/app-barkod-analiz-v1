import { Alert, type AlertButton } from 'react-native';
import { useCallback } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { usePaginatedHistory } from './usePaginatedHistory';
import { useRescanActions } from './useRescanActions';
import type { HistoryListTranslationFn } from '../types/history';

type HistoryScreenControllerParams = {
  t: HistoryListTranslationFn;
};

export const useHistoryScreenController = ({
  t,
}: HistoryScreenControllerParams) => {
  const navigation = useNavigation<any>();

  const history = usePaginatedHistory(t);
  const rescan = useRescanActions();
  const {
    loadInitial,
    refresh,
    deleteEntry,
    ...historyState
  } = history;
  const {
    load: loadRescan,
    refresh: refreshRescan,
    toggleFavorite,
    isFavorite,
  } = rescan;

  useFocusEffect(
    useCallback(() => {
      void loadInitial();
      void loadRescan();

      return undefined;
    }, [loadInitial, loadRescan])
  );

  const openScanner = useCallback(() => {
    navigation.navigate('Scanner');
  }, [navigation]);

  const openDetail = useCallback(
    (barcode: string) => {
      navigation.navigate('Detail', { barcode });
    },
    [navigation]
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([refresh(), refreshRescan()]);
  }, [refresh, refreshRescan]);

  const requestDeleteEntry = useCallback(
    (id: number) => {
      const buttons: AlertButton[] = [
        { text: t('cancel', 'İptal'), style: 'cancel' },
        {
          text: t('delete', 'Sil'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEntry(id);
              await refreshRescan();
            } catch (error) {
              console.error('Delete history failed:', error);
              Alert.alert(
                t('error_title', 'Hata'),
                t('delete_error', 'Geçmiş kaydı silinemedi')
              );
            }
          },
        },
      ];

      Alert.alert(
        t('delete_title', 'Sil'),
        t('delete_confirm', 'Bu geçmiş kaydını silmek istiyor musunuz?'),
        buttons
      );
    },
    [deleteEntry, refreshRescan, t]
  );

  const toggleFavoriteForBarcode = useCallback(
    (barcode: string) => {
      void toggleFavorite(barcode);
    },
    [toggleFavorite]
  );

  return {
    ...historyState,
    openScanner,
    openDetail,
    refreshAll,
    requestDeleteEntry,
    toggleFavoriteForBarcode,
    loadInitial,
    refresh,
    deleteEntry,
    isFavorite,
  };
};
