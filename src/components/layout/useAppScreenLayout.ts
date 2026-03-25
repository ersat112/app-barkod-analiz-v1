import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PERSISTENT_BOTTOM_NAV_RESERVED_SPACE } from '../../navigation/navigationLayout';

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

    const headerTopPadding = Math.max(insets.top + topInsetExtra, topInsetMin);
    const contentBottomPadding = Math.max(
      insets.bottom + contentBottomExtra + PERSISTENT_BOTTOM_NAV_RESERVED_SPACE,
      contentBottomMin + PERSISTENT_BOTTOM_NAV_RESERVED_SPACE
    );
    const floatingBottomOffset = Math.max(
      insets.bottom + floatingBottomExtra + PERSISTENT_BOTTOM_NAV_RESERVED_SPACE - 16,
      floatingBottomMin + PERSISTENT_BOTTOM_NAV_RESERVED_SPACE - 16
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
