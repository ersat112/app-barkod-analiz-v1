import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  FEATURES,
  MONETIZATION_FLOW_LOG_STORAGE_KEY,
} from '../config/features';
import type {
  MonetizationFlowAction,
  MonetizationFlowLogEntry,
  MonetizationFlowLogStage,
  MonetizationFlowLogStatus,
  MonetizationFlowSource,
  MonetizationPlan,
  PurchaseProviderName,
} from '../types/monetization';

const SCHEMA_VERSION = 1;
const MAX_LOG_ITEMS = 20;

type StoredMonetizationFlowLogState = {
  schemaVersion: number;
  items: MonetizationFlowLogEntry[];
};

let writeQueue: Promise<void> = Promise.resolve();

function log(...args: unknown[]) {
  if (FEATURES.monetization.diagnosticsLoggingEnabled) {
    console.log('[PurchaseFlowLog]', ...args);
  }
}

function warn(...args: unknown[]) {
  if (FEATURES.monetization.diagnosticsLoggingEnabled) {
    console.warn('[PurchaseFlowLog]', ...args);
  }
}

function normalizePlan(value: unknown): MonetizationPlan {
  return value === 'premium' ? 'premium' : 'free';
}

function normalizeAction(value: unknown): MonetizationFlowAction {
  return value === 'restore' ? 'restore' : 'purchase';
}

function normalizeStage(value: unknown): MonetizationFlowLogStage {
  switch (value) {
    case 'started':
    case 'error':
      return value;
    default:
      return 'result';
  }
}

function normalizeStatus(value: unknown): MonetizationFlowLogStatus {
  switch (value) {
    case 'purchased':
    case 'already_active':
    case 'cancelled':
    case 'not_supported':
    case 'restored':
    case 'no_active_purchase':
    case 'error':
    case 'started':
      return value;
    default:
      return 'error';
  }
}

function normalizeProviderName(value: unknown): PurchaseProviderName {
  switch (value) {
    case 'adapter_unbound':
    case 'revenuecat':
    case 'native_iap':
      return value;
    default:
      return 'none';
  }
}

function normalizeSource(value: unknown): MonetizationFlowSource {
  switch (value) {
    case 'scan_limit':
    case 'settings':
    case 'unknown':
      return value;
    default:
      return 'service';
  }
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function normalizeTimestamp(value: unknown): string {
  if (typeof value === 'string') {
    const parsed = new Date(value);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

function normalizeMessage(value: unknown): string {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return 'monetization_flow_log_message_missing';
}

function normalizeEntry(raw: unknown): MonetizationFlowLogEntry | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const value = raw as Partial<MonetizationFlowLogEntry>;

  return {
    id:
      normalizeNullableString(value.id) ??
      `flow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: normalizeTimestamp(value.createdAt),
    action: normalizeAction(value.action),
    stage: normalizeStage(value.stage),
    status: normalizeStatus(value.status),
    source: normalizeSource(value.source),
    providerName: normalizeProviderName(value.providerName),
    annualProductId: normalizeNullableString(value.annualProductId) ?? '',
    authUid: normalizeNullableString(value.authUid),
    entitlementPlan: normalizePlan(value.entitlementPlan),
    isPremium: value.isPremium === true,
    customerId: normalizeNullableString(value.customerId),
    transactionId: normalizeNullableString(value.transactionId),
    identityMismatch: value.identityMismatch === true,
    identityMismatchWarning: normalizeNullableString(value.identityMismatchWarning),
    message: normalizeMessage(value.message),
  };
}

function defaultState(): StoredMonetizationFlowLogState {
  return {
    schemaVersion: SCHEMA_VERSION,
    items: [],
  };
}

function normalizeState(raw: unknown): StoredMonetizationFlowLogState {
  if (!raw || typeof raw !== 'object') {
    return defaultState();
  }

  const value = raw as Partial<StoredMonetizationFlowLogState>;
  const items = Array.isArray(value.items)
    ? value.items
        .map((entry) => normalizeEntry(entry))
        .filter((entry): entry is MonetizationFlowLogEntry => Boolean(entry))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, MAX_LOG_ITEMS)
    : [];

  return {
    schemaVersion: SCHEMA_VERSION,
    items,
  };
}

async function readState(): Promise<StoredMonetizationFlowLogState> {
  try {
    const raw = await AsyncStorage.getItem(MONETIZATION_FLOW_LOG_STORAGE_KEY);

    if (!raw) {
      return defaultState();
    }

    return normalizeState(JSON.parse(raw));
  } catch (error) {
    warn('readState failed:', error);
    return defaultState();
  }
}

async function writeState(state: StoredMonetizationFlowLogState): Promise<void> {
  try {
    await AsyncStorage.setItem(
      MONETIZATION_FLOW_LOG_STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch (error) {
    warn('writeState failed:', error);
  }
}

export async function appendMonetizationFlowLog(input: {
  action: MonetizationFlowAction;
  stage: MonetizationFlowLogStage;
  status: MonetizationFlowLogStatus;
  source: MonetizationFlowSource;
  providerName: PurchaseProviderName;
  annualProductId: string;
  authUid: string | null;
  entitlementPlan: MonetizationPlan;
  isPremium: boolean;
  customerId: string | null;
  transactionId: string | null;
  identityMismatchWarning: string | null;
  message: string;
}): Promise<void> {
  const entry: MonetizationFlowLogEntry = {
    id: `flow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    action: input.action,
    stage: input.stage,
    status: input.status,
    source: input.source,
    providerName: input.providerName,
    annualProductId: input.annualProductId.trim(),
    authUid: normalizeNullableString(input.authUid),
    entitlementPlan: input.entitlementPlan,
    isPremium: input.isPremium,
    customerId: normalizeNullableString(input.customerId),
    transactionId: normalizeNullableString(input.transactionId),
    identityMismatch: Boolean(input.identityMismatchWarning),
    identityMismatchWarning: normalizeNullableString(input.identityMismatchWarning),
    message: normalizeMessage(input.message),
  };

  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      const state = await readState();
      const nextState: StoredMonetizationFlowLogState = {
        schemaVersion: SCHEMA_VERSION,
        items: [entry, ...state.items].slice(0, MAX_LOG_ITEMS),
      };

      await writeState(nextState);
      log('appended flow log:', entry);
    });

  await writeQueue;
}

export async function getRecentMonetizationFlowLogs(
  limit = 6
): Promise<MonetizationFlowLogEntry[]> {
  const state = await readState();
  return state.items.slice(0, Math.max(1, limit));
}

export async function clearMonetizationFlowLogs(): Promise<void> {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        await AsyncStorage.removeItem(MONETIZATION_FLOW_LOG_STORAGE_KEY);
        log('flow logs cleared');
      } catch (error) {
        warn('clearMonetizationFlowLogs failed:', error);
      }
    });

  await writeQueue;
}
