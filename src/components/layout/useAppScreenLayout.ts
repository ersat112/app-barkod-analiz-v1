import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolvePersistentBottomNavReservedSpace } from '../../navigation/navigationLayout';

type AppScreenLayoutOptions = {
  topInsetExtra?: number;
  topInsetMin?: number;
  contentBottomExtra?: number;
  contentBottomMin?: number;
  floatingBottomExtra?: number;
  floatingBottomMin?: number;
  horizontalPadding?: number;
};

export const useAppScreenLayout = (
  options: AppScreenLayoutOptions = {}
) => {
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const {
      topInsetExtra = 16,
      topInsetMin = 32,
      contentBottomExtra = 28,
      contentBottomMin = 40,
      floatingBottomExtra = 12,
      floatingBottomMin = 12,
      horizontalPadding = 20,
    } = options;

    const persistentBottomNavReservedSpace =
      resolvePersistentBottomNavReservedSpace(insets.bottom);

    const headerTopPadding = Math.max(insets.top + topInsetExtra, topInsetMin);
    const contentBottomPadding = Math.max(
      insets.bottom + contentBottomExtra + persistentBottomNavReservedSpace,
      contentBottomMin + persistentBottomNavReservedSpace
    );
    const floatingBottomOffset = Math.max(
      insets.bottom + floatingBottomExtra + persistentBottomNavReservedSpace - 16,
      floatingBottomMin + persistentBottomNavReservedSpace - 16
    );

    return {
      insets,
      headerTopPadding,
      contentBottomPadding,
      floatingBottomOffset,
      horizontalPadding,
    };
  }, [insets, options]);
};
