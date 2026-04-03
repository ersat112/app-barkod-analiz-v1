import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppOnboardingScreenKey =
  | 'home'
  | 'history'
  | 'price'
  | 'profile'
  | 'scanner';

const SCREEN_ONBOARDING_STORAGE_KEY = 'screen_onboarding_seen_v1';

type ScreenOnboardingState = Partial<Record<AppOnboardingScreenKey, boolean>>;

const normalizeState = (value: unknown): ScreenOnboardingState => {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value as ScreenOnboardingState;
};

const readState = async (): Promise<ScreenOnboardingState> => {
  try {
    const raw = await AsyncStorage.getItem(SCREEN_ONBOARDING_STORAGE_KEY);

    if (!raw) {
      return {};
    }

    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn('[ScreenOnboarding] failed to read state:', error);
    return {};
  }
};

const writeState = async (state: ScreenOnboardingState): Promise<void> => {
  try {
    await AsyncStorage.setItem(SCREEN_ONBOARDING_STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('[ScreenOnboarding] failed to write state:', error);
  }
};

export const hasSeenScreenOnboarding = async (
  screenKey: AppOnboardingScreenKey
): Promise<boolean> => {
  const state = await readState();
  return state[screenKey] === true;
};

export const markScreenOnboardingSeen = async (
  screenKey: AppOnboardingScreenKey
): Promise<void> => {
  const state = await readState();
  state[screenKey] = true;
  await writeState(state);
};

export const resetScreenOnboarding = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SCREEN_ONBOARDING_STORAGE_KEY);
  } catch (error) {
    console.warn('[ScreenOnboarding] failed to reset state:', error);
  }
};
