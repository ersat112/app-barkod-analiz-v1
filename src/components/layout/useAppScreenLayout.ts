import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
      insets.bottom + contentBottomExtra,
      contentBottomMin
    );
    const floatingBottomOffset = Math.max(
      insets.bottom + floatingBottomExtra,
      floatingBottomMin
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