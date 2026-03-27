import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import i18n from 'i18next';
import { Platform } from 'react-native';

import {
  getBestScoreToday,
  getLastScannedProduct,
  getPersonalizedEngagementSchedule,
  getTodayScanCount,
} from './db/history.repository';

const PREFERENCES_STORAGE_KEY = 'erenesal-preferences';
const ENGAGEMENT_NOTIFICATION_SYNC_META_KEY = 'erenesal-engagement-notification-sync';
const ANDROID_CHANNEL_ID = 'engagement-reminders';
const NOTIFICATION_SYNC_THROTTLE_MS = 1000 * 60 * 60 * 6;
const MANAGED_NOTIFICATION_KINDS = new Set([
  'daily_scan_reminder',
  'daily_score_summary',
]);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type PreferenceSnapshot = {
  state?: {
    notificationsEnabled?: boolean;
  };
};

type NotificationSyncMeta = {
  fingerprint?: string;
  syncedAt?: number;
};

async function isNotificationsEnabledInPreferences(): Promise<boolean> {
  try {
    const rawValue = await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY);

    if (!rawValue) {
      return true;
    }

    const parsed = JSON.parse(rawValue) as PreferenceSnapshot;
    return parsed.state?.notificationsEnabled ?? true;
  } catch (error) {
    console.warn('[EngagementNotifications] preference read failed:', error);
    return true;
  }
}

async function readNotificationSyncMeta(): Promise<NotificationSyncMeta> {
  try {
    const rawValue = await AsyncStorage.getItem(
      ENGAGEMENT_NOTIFICATION_SYNC_META_KEY
    );

    if (!rawValue) {
      return {};
    }

    return (JSON.parse(rawValue) as NotificationSyncMeta) ?? {};
  } catch (error) {
    console.warn('[EngagementNotifications] sync meta read failed:', error);
    return {};
  }
}

async function writeNotificationSyncMeta(
  meta: NotificationSyncMeta
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      ENGAGEMENT_NOTIFICATION_SYNC_META_KEY,
      JSON.stringify(meta)
    );
  } catch (error) {
    console.warn('[EngagementNotifications] sync meta write failed:', error);
  }
}

async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const permissions = await Notifications.getPermissionsAsync();

  if (permissions.granted) {
    return true;
  }

  if (!permissions.canAskAgain) {
    return false;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: tt('smart_notifications', 'Akıllı Bildirimler'),
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    vibrationPattern: [0, 120, 90, 120],
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function cancelManagedNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  await Promise.all(
    scheduled
      .filter((item) => {
        const kind = item.content.data?.kind;
        return typeof kind === 'string' && MANAGED_NOTIFICATION_KINDS.has(kind);
      })
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
  );
}

const tt = (key: string, fallback: string, options?: Record<string, unknown>): string => {
  const value = i18n.t(key, {
    defaultValue: fallback,
    ...options,
  });

  return value === key ? fallback : value;
};

function buildReminderBody(preferredHour: number | null): string {
  const todayCount = getTodayScanCount();
  const lastProduct = getLastScannedProduct();

  if (todayCount <= 0) {
    if (lastProduct?.name) {
      return tt(
        'notification_reminder_empty_with_product',
        'Bugün henüz barkod taraması yapmadın. {{name}} gibi seçimlerini yeniden kontrol edebilirsin.',
        { name: lastProduct.name }
      );
    }

    return tt(
      'notification_reminder_empty',
      'Bugün henüz barkod taraması yapmadın. Hızlı bir taramayla devam et.'
    );
  }

  if (todayCount < 3) {
    return tt(
      'notification_reminder_light',
      'Bugün birkaç ürün daha tarayarak güvenli seçimlerini güçlendirebilirsin.'
    );
  }

  if (preferredHour != null) {
    return tt(
      'notification_reminder_habit',
      'Genelde bu saatlerde ürün tarıyorsun. Yeni bir barkodla ritmini koru.'
    );
  }

  return tt(
    'notification_reminder_active',
    'Bugünkü tarama ritmini koru. Yeni bir ürün daha tarayıp listeni güncelle.'
  );
}

function buildSummaryBody(): string {
  const bestScore = getBestScoreToday();
  const lastProduct = getLastScannedProduct();

  if (typeof bestScore === 'number' && lastProduct?.name) {
    return tt(
      'notification_summary_best_product',
      'Bugünün öne çıkan ürünü {{score}}/100 ile {{name}}. Detaylara yeniden göz at.',
      {
        score: bestScore,
        name: lastProduct.name,
      }
    );
  }

  if (typeof bestScore === 'number') {
    return tt(
      'notification_summary_best_score',
      'Bugünün en iyi ürün skoru {{score}}/100. Geçmişine dönüp seçimlerini tekrar gözden geçir.',
      { score: bestScore }
    );
  }

  return tt(
    'notification_summary_default',
    'Bugünün en iyi skorlu ürünlerini görmek için geçmiş ekranına göz at.'
  );
}

export async function disableEngagementNotifications(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  await cancelManagedNotifications();
  await AsyncStorage.removeItem(ENGAGEMENT_NOTIFICATION_SYNC_META_KEY);
}

export async function syncEngagementNotifications(options?: {
  force?: boolean;
  reason?: string;
}): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const notificationsEnabled = await isNotificationsEnabledInPreferences();

  if (!notificationsEnabled) {
    await cancelManagedNotifications();
    return;
  }

  const granted = await ensureNotificationPermission();

  if (!granted) {
    return;
  }

  await ensureAndroidChannel();
  const schedule = getPersonalizedEngagementSchedule();
  const lastProduct = getLastScannedProduct();
  const fingerprint = [
    i18n.language,
    schedule.preferredHour ?? 'none',
    schedule.reminderHour,
    schedule.reminderMinute,
    schedule.summaryHour,
    schedule.summaryMinute,
    getTodayScanCount(),
    getBestScoreToday() ?? 'none',
    lastProduct?.barcode ?? 'none',
    lastProduct?.updated_at ?? 'none',
  ].join('|');
  const syncMeta = await readNotificationSyncMeta();
  const now = Date.now();

  if (
    !options?.force &&
    syncMeta.fingerprint === fingerprint &&
    typeof syncMeta.syncedAt === 'number' &&
    now - syncMeta.syncedAt < NOTIFICATION_SYNC_THROTTLE_MS
  ) {
    return;
  }

  await cancelManagedNotifications();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: tt('notification_reminder_title', 'Bugün tarama yaptın mı?'),
      body: buildReminderBody(schedule.preferredHour),
      sound: 'default',
      data: {
        kind: 'daily_scan_reminder',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: schedule.reminderHour,
      minute: schedule.reminderMinute,
      channelId: ANDROID_CHANNEL_ID,
    },
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      title: tt(
        'notification_summary_title',
        'Günün en iyi skorlu ürünleri'
      ),
      body: buildSummaryBody(),
      sound: 'default',
      data: {
        kind: 'daily_score_summary',
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: schedule.summaryHour,
      minute: schedule.summaryMinute,
      channelId: ANDROID_CHANNEL_ID,
    },
  });

  await writeNotificationSyncMeta({
    fingerprint,
    syncedAt: now,
  });
}
