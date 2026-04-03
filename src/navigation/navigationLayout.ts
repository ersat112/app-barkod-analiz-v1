import { Platform } from 'react-native';

export const PERSISTENT_BOTTOM_NAV_BASE_HEIGHT = 82;
export const PERSISTENT_BOTTOM_NAV_HEIGHT = 96;
export const PERSISTENT_GLOBAL_BANNER_HEIGHT = 64;

const IOS_BOTTOM_NAV_MIN_INSET = 18;
const ANDROID_BOTTOM_NAV_MIN_INSET = 30;
const BOTTOM_NAV_CONTENT_CLEARANCE = 10;

export const resolvePersistentBottomNavInset = (bottomInset: number): number => {
  const safeInset = Number.isFinite(bottomInset) ? Math.max(bottomInset, 0) : 0;

  return Math.max(
    safeInset,
    Platform.OS === 'android'
      ? ANDROID_BOTTOM_NAV_MIN_INSET
      : IOS_BOTTOM_NAV_MIN_INSET
  );
};

export const resolvePersistentBottomNavHeight = (bottomInset: number): number => {
  return (
    PERSISTENT_BOTTOM_NAV_BASE_HEIGHT +
    PERSISTENT_GLOBAL_BANNER_HEIGHT +
    resolvePersistentBottomNavInset(bottomInset)
  );
};

export const resolvePersistentBottomNavReservedSpace = (
  bottomInset: number
): number => {
  return resolvePersistentBottomNavHeight(bottomInset) + BOTTOM_NAV_CONTENT_CLEARANCE;
};

export const PERSISTENT_BOTTOM_NAV_RESERVED_SPACE =
  resolvePersistentBottomNavReservedSpace(0);
