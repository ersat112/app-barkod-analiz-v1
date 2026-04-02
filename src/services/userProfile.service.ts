import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { auth, db } from '../config/firebase';
import {
  LEGAL_DOCUMENT_VERSIONS,
  LEGAL_VERSION_LABEL,
  buildCurrentLegalAcceptance,
} from '../config/legalRuntime';
import {
  resolveCanonicalCity,
  resolveCanonicalDistrict,
} from './locationData';
import {
  normalizeFamilyHealthProfile,
  type FamilyHealthProfile,
} from './familyHealthProfile.service';
import {
  DEFAULT_NUTRITION_PREFERENCES,
  type NutritionPreferences,
} from './nutritionPreferences.service';
import { entitlementService } from './entitlement.service';
import { freeScanPolicyService } from './freeScanPolicy.service';
import { monetizationPolicyService } from './monetizationPolicy.service';
import type {
  AppUserProfile,
  UserLocationSnapshot,
  LegalAcceptanceSnapshot,
  LegalDocumentVersionMap,
  UserMonetizationProjection,
  UserProfileInput,
} from '../types/userProfile';

const USERS_COLLECTION = 'users';
const USER_MONETIZATION_PROJECTION_VERSION = 1;

function normalizeOptionalString(value?: string | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : undefined;
}

function looksLikeEmail(value?: string | null): boolean {
  const normalized = normalizeOptionalString(value);
  return Boolean(normalized && normalized.includes('@'));
}

function normalizeEditableString(value?: string | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return value.trim();
}

function normalizeOptionalBoolean(value?: boolean | null): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizeNutritionPreferences(input: unknown): NutritionPreferences | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  const normalized: NutritionPreferences = {
    ...DEFAULT_NUTRITION_PREFERENCES,
  };

  let hasAnyValue = false;

  (Object.keys(DEFAULT_NUTRITION_PREFERENCES) as (keyof NutritionPreferences)[]).forEach((key) => {
    if (typeof record[key] === 'boolean') {
      normalized[key] = record[key] as boolean;
      hasAnyValue = true;
    }
  });

  return hasAnyValue ? normalized : undefined;
}

function normalizeLocationContext(input: unknown): UserLocationSnapshot | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  const rawCity = normalizeOptionalString(record.city as string | undefined);
  const rawDistrict = normalizeOptionalString(record.district as string | undefined);
  const city = resolveCanonicalCity(rawCity) ?? rawCity;
  const district = resolveCanonicalDistrict(city, rawDistrict) ?? rawDistrict;
  const latitude =
    typeof record.latitude === 'number' && Number.isFinite(record.latitude)
      ? record.latitude
      : undefined;
  const longitude =
    typeof record.longitude === 'number' && Number.isFinite(record.longitude)
      ? record.longitude
      : undefined;
  const permissionPrompted =
    typeof record.permissionPrompted === 'boolean'
      ? record.permissionPrompted
      : undefined;
  const permissionGranted =
    typeof record.permissionGranted === 'boolean'
      ? record.permissionGranted
      : undefined;
  const capturedAt = normalizeOptionalString(record.capturedAt as string | undefined);
  const rawSource = normalizeOptionalString(record.source as string | undefined);
  const source =
    rawSource === 'device' || rawSource === 'manual' ? rawSource : undefined;

  if (
    permissionPrompted === undefined &&
    permissionGranted === undefined &&
    latitude === undefined &&
    longitude === undefined &&
    !city &&
    !district &&
    !capturedAt &&
    !source
  ) {
    return undefined;
  }

  return {
    permissionPrompted,
    permissionGranted,
    latitude,
    longitude,
    city,
    district,
    capturedAt,
    source,
  };
}

function normalizeLegalDocumentVersions(input: unknown): LegalDocumentVersionMap | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  const normalized: LegalDocumentVersionMap = {
    ...LEGAL_DOCUMENT_VERSIONS,
  };
  let hasAnyValue = false;

  (Object.keys(LEGAL_DOCUMENT_VERSIONS) as (keyof LegalDocumentVersionMap)[]).forEach((key) => {
    if (typeof record[key] === 'string' && record[key].trim()) {
      normalized[key] = record[key].trim();
      hasAnyValue = true;
    }
  });

  return hasAnyValue ? normalized : undefined;
}

function normalizeLegalAcceptanceSnapshot(
  input: unknown
): LegalAcceptanceSnapshot | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  const acceptedAt = normalizeOptionalString(record.acceptedAt as string | undefined);
  const versionLabel =
    normalizeOptionalString(record.versionLabel as string | undefined) ?? LEGAL_VERSION_LABEL;
  const source = normalizeOptionalString(record.source as string | undefined) as
    | LegalAcceptanceSnapshot['source']
    | undefined;
  const documents =
    normalizeLegalDocumentVersions(record.documents) ?? LEGAL_DOCUMENT_VERSIONS;

  if (!acceptedAt && !source) {
    return undefined;
  }

  return {
    acceptedAt,
    versionLabel,
    source,
    documents,
  };
}

function normalizeProviderIds(
  values?: (string | null | undefined)[]
): string[] | undefined {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const normalized = Array.from(
    new Set(
      values
        .map((value) => normalizeOptionalString(value))
        .filter((value): value is string => Boolean(value))
    )
  );

  return normalized.length ? normalized : undefined;
}

function splitDisplayName(displayName?: string): {
  firstName?: string;
  lastName?: string;
} {
  const normalized = normalizeOptionalString(displayName);

  if (!normalized) {
    return {};
  }

  const parts = normalized.split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return {};
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

function buildDisplayName(params: {
  displayName?: string;
  firstName?: string;
  lastName?: string;
}): string | undefined {
  const explicitDisplayName = normalizeOptionalString(params.displayName);

  if (explicitDisplayName && !looksLikeEmail(explicitDisplayName)) {
    return explicitDisplayName;
  }

  const firstName =
    typeof params.firstName === 'string'
      ? params.firstName.trim()
      : normalizeOptionalString(params.firstName);
  const lastName =
    typeof params.lastName === 'string'
      ? params.lastName.trim()
      : normalizeOptionalString(params.lastName);

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }

  return firstName || lastName || undefined;
}

function sanitizeUserProfileInput(input?: UserProfileInput): UserProfileInput {
  if (!input) {
    return {};
  }

  return {
    firstName: normalizeOptionalString(input.firstName),
    lastName: normalizeOptionalString(input.lastName),
    displayName: normalizeOptionalString(input.displayName),
    phone: normalizeOptionalString(input.phone),
    city: normalizeOptionalString(input.city),
    district: normalizeOptionalString(input.district),
    address: normalizeOptionalString(input.address),
    email: normalizeOptionalString(input.email),
    photoURL: normalizeOptionalString(input.photoURL),
    providerIds: normalizeProviderIds(input.providerIds),
    emailVerified: normalizeOptionalBoolean(input.emailVerified),
    kvkkAccepted: normalizeOptionalBoolean(input.kvkkAccepted),
    legalAcceptance: normalizeLegalAcceptanceSnapshot(input.legalAcceptance),
    nutritionPreferences: normalizeNutritionPreferences(input.nutritionPreferences),
    familyHealthProfile: normalizeFamilyHealthProfile(input.familyHealthProfile),
    locationContext: normalizeLocationContext(input.locationContext),
    createdAt: normalizeOptionalString(input.createdAt),
    updatedAt: normalizeOptionalString(input.updatedAt),
    lastLoginAt: normalizeOptionalString(input.lastLoginAt),
    lastSeenAt: normalizeOptionalString(input.lastSeenAt),
  };
}

function sanitizeEditableUserProfileInput(input?: UserProfileInput): UserProfileInput {
  if (!input) {
    return {};
  }

  return {
    firstName: normalizeEditableString(input.firstName),
    lastName: normalizeEditableString(input.lastName),
    displayName: normalizeEditableString(input.displayName),
    phone: normalizeEditableString(input.phone),
    city: normalizeEditableString(input.city),
    district: normalizeEditableString(input.district),
    address: normalizeEditableString(input.address),
    email: normalizeEditableString(input.email),
    photoURL: normalizeEditableString(input.photoURL),
    providerIds: normalizeProviderIds(input.providerIds),
    emailVerified: normalizeOptionalBoolean(input.emailVerified),
    kvkkAccepted: normalizeOptionalBoolean(input.kvkkAccepted),
    legalAcceptance: normalizeLegalAcceptanceSnapshot(input.legalAcceptance),
    nutritionPreferences: normalizeNutritionPreferences(input.nutritionPreferences),
    familyHealthProfile: normalizeFamilyHealthProfile(input.familyHealthProfile),
    locationContext: normalizeLocationContext(input.locationContext),
    createdAt: normalizeEditableString(input.createdAt),
    updatedAt: normalizeEditableString(input.updatedAt),
    lastLoginAt: normalizeEditableString(input.lastLoginAt),
    lastSeenAt: normalizeEditableString(input.lastSeenAt),
  };
}

function deriveUserProfileFromAuthUser(user: User): UserProfileInput {
  const inferredName = splitDisplayName(user.displayName ?? undefined);

  return {
    firstName: inferredName.firstName,
    lastName: inferredName.lastName,
    displayName: normalizeOptionalString(user.displayName),
    email: normalizeOptionalString(user.email),
    photoURL: normalizeOptionalString(user.photoURL),
    providerIds: normalizeProviderIds([
      user.providerId,
      ...user.providerData.map((provider) => provider.providerId),
    ]),
    emailVerified: user.emailVerified,
  };
}

function compactUserMonetizationProjection(
  input?: UserMonetizationProjection
): UserMonetizationProjection | undefined {
  if (!input) {
    return undefined;
  }

  const output: UserMonetizationProjection = {};

  const assign = <K extends keyof UserMonetizationProjection>(
    key: K,
    value: UserMonetizationProjection[K] | undefined
  ) => {
    if (value === undefined) {
      return;
    }

    output[key] = value;
  };

  assign('projectionVersion', input.projectionVersion);
  assign('syncedAt', input.syncedAt);
  assign('plan', input.plan);
  assign('isPremium', input.isPremium);
  assign('adsSuppressed', input.adsSuppressed);
  assign('unlimitedScans', input.unlimitedScans);
  assign('entitlementSource', input.entitlementSource);
  assign('policySource', input.policySource);
  assign('policyVersion', input.policyVersion);
  assign('monthlyPlanEnabled', input.monthlyPlanEnabled);
  assign('monthlyPriceTry', input.monthlyPriceTry);
  assign('monthlyProductId', input.monthlyProductId);
  assign('annualPlanEnabled', input.annualPlanEnabled);
  assign('annualPriceTry', input.annualPriceTry);
  assign('annualProductId', input.annualProductId);
  assign('purchaseProviderEnabled', input.purchaseProviderEnabled);
  assign('restoreEnabled', input.restoreEnabled);
  assign('paywallEnabled', input.paywallEnabled);
  assign('freeScanLimitEnabled', input.freeScanLimitEnabled);
  assign('freeScanLimitActive', input.freeScanLimitActive);
  assign('freeDailyScanLimit', input.freeDailyScanLimit);
  assign('freeScanDateKey', input.freeScanDateKey);
  assign('freeScanUsedCount', input.freeScanUsedCount);
  assign('freeScanRemainingCount', input.freeScanRemainingCount);
  assign('freeScanHasReachedLimit', input.freeScanHasReachedLimit);
  assign('activatedAt', input.activatedAt);
  assign('expiresAt', input.expiresAt);
  assign('lastValidatedAt', input.lastValidatedAt);

  return Object.keys(output).length ? output : undefined;
}

function normalizeStoredMonetizationProjection(
  input: unknown
): UserMonetizationProjection | undefined {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const record = input as Record<string, unknown>;

  return compactUserMonetizationProjection({
    projectionVersion:
      typeof record.projectionVersion === 'number' ? record.projectionVersion : undefined,
    syncedAt: normalizeOptionalString(record.syncedAt as string | undefined),
    plan: normalizeOptionalString(record.plan as string | undefined) as
      | UserMonetizationProjection['plan']
      | undefined,
    isPremium:
      typeof record.isPremium === 'boolean' ? record.isPremium : undefined,
    adsSuppressed:
      typeof record.adsSuppressed === 'boolean' ? record.adsSuppressed : undefined,
    unlimitedScans:
      typeof record.unlimitedScans === 'boolean' ? record.unlimitedScans : undefined,
    entitlementSource: normalizeOptionalString(
      record.entitlementSource as string | undefined
    ) as UserMonetizationProjection['entitlementSource'] | undefined,
    policySource: normalizeOptionalString(
      record.policySource as string | undefined
    ) as UserMonetizationProjection['policySource'] | undefined,
    policyVersion:
      typeof record.policyVersion === 'number' ? record.policyVersion : undefined,
    monthlyPlanEnabled:
      typeof record.monthlyPlanEnabled === 'boolean'
        ? record.monthlyPlanEnabled
        : undefined,
    monthlyPriceTry:
      typeof record.monthlyPriceTry === 'number' ? record.monthlyPriceTry : undefined,
    monthlyProductId: normalizeOptionalString(
      record.monthlyProductId as string | undefined
    ),
    annualPlanEnabled:
      typeof record.annualPlanEnabled === 'boolean'
        ? record.annualPlanEnabled
        : undefined,
    annualPriceTry:
      typeof record.annualPriceTry === 'number' ? record.annualPriceTry : undefined,
    annualProductId: normalizeOptionalString(
      record.annualProductId as string | undefined
    ),
    purchaseProviderEnabled:
      typeof record.purchaseProviderEnabled === 'boolean'
        ? record.purchaseProviderEnabled
        : undefined,
    restoreEnabled:
      typeof record.restoreEnabled === 'boolean' ? record.restoreEnabled : undefined,
    paywallEnabled:
      typeof record.paywallEnabled === 'boolean' ? record.paywallEnabled : undefined,
    freeScanLimitEnabled:
      typeof record.freeScanLimitEnabled === 'boolean'
        ? record.freeScanLimitEnabled
        : undefined,
    freeScanLimitActive:
      typeof record.freeScanLimitActive === 'boolean'
        ? record.freeScanLimitActive
        : undefined,
    freeDailyScanLimit:
      typeof record.freeDailyScanLimit === 'number'
        ? record.freeDailyScanLimit
        : undefined,
    freeScanDateKey: normalizeOptionalString(
      record.freeScanDateKey as string | undefined
    ),
    freeScanUsedCount:
      typeof record.freeScanUsedCount === 'number'
        ? record.freeScanUsedCount
        : undefined,
    freeScanRemainingCount:
      typeof record.freeScanRemainingCount === 'number' ||
      record.freeScanRemainingCount === null
        ? (record.freeScanRemainingCount as number | null)
        : undefined,
    freeScanHasReachedLimit:
      typeof record.freeScanHasReachedLimit === 'boolean'
        ? record.freeScanHasReachedLimit
        : undefined,
    activatedAt: normalizeOptionalString(record.activatedAt as string | undefined) ?? null,
    expiresAt: normalizeOptionalString(record.expiresAt as string | undefined) ?? null,
    lastValidatedAt:
      normalizeOptionalString(record.lastValidatedAt as string | undefined) ?? null,
  });
}

function compactUserProfile(input: UserProfileInput): AppUserProfile {
  const output: AppUserProfile = {};

  const assign = <K extends keyof AppUserProfile>(
    key: K,
    value: AppUserProfile[K] | undefined
  ) => {
    if (value === undefined) {
      return;
    }

    output[key] = value;
  };

  assign('firstName', input.firstName);
  assign('lastName', input.lastName);
  assign('displayName', input.displayName);
  assign('phone', input.phone);
  assign('city', input.city);
  assign('district', input.district);
  assign('address', input.address);
  assign('email', input.email);
  assign('photoURL', input.photoURL);
  assign('providerIds', input.providerIds);
  assign('emailVerified', input.emailVerified);
  assign('kvkkAccepted', input.kvkkAccepted);
  assign('legalAcceptance', input.legalAcceptance);
  assign('nutritionPreferences', input.nutritionPreferences);
  assign('familyHealthProfile', input.familyHealthProfile);
  assign('locationContext', input.locationContext);
  assign('createdAt', input.createdAt);
  assign('updatedAt', input.updatedAt);
  assign('lastLoginAt', input.lastLoginAt);
  assign('lastSeenAt', input.lastSeenAt);
  assign('monetization', compactUserMonetizationProjection(input.monetization));

  return output;
}

function normalizeStoredUserProfile(input: unknown): AppUserProfile | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const record = input as Record<string, unknown>;
  const firstName = normalizeOptionalString(record.firstName as string | undefined);
  const lastName = normalizeOptionalString(record.lastName as string | undefined);
  const rawCity = normalizeOptionalString(record.city as string | undefined);
  const rawDistrict = normalizeOptionalString(record.district as string | undefined);
  const city = resolveCanonicalCity(rawCity) ?? rawCity;
  const district = resolveCanonicalDistrict(city, rawDistrict) ?? rawDistrict;

  return compactUserProfile({
    firstName,
    lastName,
    displayName: buildDisplayName({
      displayName: normalizeOptionalString(record.displayName as string | undefined),
      firstName,
      lastName,
    }),
    phone: normalizeOptionalString(record.phone as string | undefined),
    city,
    district,
    address: normalizeOptionalString(record.address as string | undefined),
    email: normalizeOptionalString(record.email as string | undefined),
    photoURL: normalizeOptionalString(record.photoURL as string | undefined),
    providerIds: normalizeProviderIds(record.providerIds as (string | null | undefined)[]),
    emailVerified:
      typeof record.emailVerified === 'boolean' ? record.emailVerified : undefined,
    kvkkAccepted:
      typeof record.kvkkAccepted === 'boolean' ? record.kvkkAccepted : undefined,
    legalAcceptance: normalizeLegalAcceptanceSnapshot(record.legalAcceptance),
    nutritionPreferences: normalizeNutritionPreferences(record.nutritionPreferences),
    familyHealthProfile: normalizeFamilyHealthProfile(record.familyHealthProfile),
    locationContext: normalizeLocationContext(record.locationContext),
    createdAt: normalizeOptionalString(record.createdAt as string | undefined),
    updatedAt: normalizeOptionalString(record.updatedAt as string | undefined),
    lastLoginAt: normalizeOptionalString(record.lastLoginAt as string | undefined),
    lastSeenAt: normalizeOptionalString(record.lastSeenAt as string | undefined),
    monetization: normalizeStoredMonetizationProjection(record.monetization),
  });
}

async function buildMonetizationProjectionForUser(
  user: User
): Promise<UserMonetizationProjection | undefined> {
  if (!user.uid) {
    return undefined;
  }

  try {
    const [policy, entitlement, freeScan] = await Promise.all([
      monetizationPolicyService.getResolvedPolicy({ allowStale: true }),
      entitlementService.getSnapshot(),
      freeScanPolicyService.getSnapshot(),
    ]);

    return compactUserMonetizationProjection({
      projectionVersion: USER_MONETIZATION_PROJECTION_VERSION,
      syncedAt: new Date().toISOString(),
      plan: entitlement.plan,
      isPremium: entitlement.isPremium,
      adsSuppressed: entitlement.adsSuppressed,
      unlimitedScans: entitlement.unlimitedScans,
      entitlementSource: entitlement.source,
      policySource: policy.source,
      policyVersion: policy.version,
      monthlyPlanEnabled: policy.monthlyPlanEnabled,
      monthlyPriceTry: policy.monthlyPriceTry,
      monthlyProductId: policy.monthlyProductId,
      annualPlanEnabled: policy.annualPlanEnabled,
      annualPriceTry: policy.annualPriceTry,
      annualProductId: policy.annualProductId,
      purchaseProviderEnabled: policy.purchaseProviderEnabled,
      restoreEnabled: policy.restoreEnabled,
      paywallEnabled: policy.paywallEnabled,
      freeScanLimitEnabled: policy.freeScanLimitEnabled,
      freeScanLimitActive: freeScan.limitEnabled,
      freeDailyScanLimit: policy.freeDailyScanLimit,
      freeScanDateKey: freeScan.dateKey,
      freeScanUsedCount: freeScan.usedCount,
      freeScanRemainingCount: freeScan.remainingCount,
      freeScanHasReachedLimit: freeScan.hasReachedLimit,
      activatedAt: entitlement.activatedAt,
      expiresAt: entitlement.expiresAt,
      lastValidatedAt: entitlement.lastValidatedAt,
    });
  } catch (error) {
    console.warn('[UserProfile] monetization projection build failed:', error);
    return undefined;
  }
}

export async function getUserProfile(uid: string): Promise<AppUserProfile | null> {
  const normalizedUid = normalizeOptionalString(uid);

  if (!normalizedUid) {
    return null;
  }

  const ref = doc(db, USERS_COLLECTION, normalizedUid);
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return null;
  }

  return normalizeStoredUserProfile(snapshot.data());
}

export async function getCurrentUserProfile(): Promise<AppUserProfile | null> {
  const currentUser = auth.currentUser;

  if (!currentUser?.uid) {
    return null;
  }

  return getUserProfile(currentUser.uid);
}

export async function ensureUserProfileDocument(
  user: User,
  options?: {
    profile?: UserProfileInput;
    trackLogin?: boolean;
  }
): Promise<AppUserProfile> {
  const [existingProfile, monetizationProjection] = await Promise.all([
    getUserProfile(user.uid),
    buildMonetizationProjectionForUser(user),
  ]);

  const authProfile = deriveUserProfileFromAuthUser(user);
  const overrideProfile = sanitizeUserProfileInput(options?.profile);
  const now = new Date().toISOString();

  const firstName =
    overrideProfile.firstName ??
    existingProfile?.firstName ??
    authProfile.firstName;

  const lastName =
    overrideProfile.lastName ??
    existingProfile?.lastName ??
    authProfile.lastName;

  const displayName = buildDisplayName({
    displayName:
      overrideProfile.displayName ??
      existingProfile?.displayName ??
      authProfile.displayName,
    firstName,
    lastName,
  });

  const providerIds = normalizeProviderIds([
    ...(existingProfile?.providerIds ?? []),
    ...(authProfile.providerIds ?? []),
    ...(overrideProfile.providerIds ?? []),
  ]);

  const mergedProfile = compactUserProfile({
    firstName,
    lastName,
    displayName,
    phone: overrideProfile.phone ?? existingProfile?.phone,
    city: overrideProfile.city ?? existingProfile?.city,
    district: overrideProfile.district ?? existingProfile?.district,
    address: overrideProfile.address ?? existingProfile?.address,
    email: overrideProfile.email ?? authProfile.email ?? existingProfile?.email,
    photoURL:
      overrideProfile.photoURL ?? authProfile.photoURL ?? existingProfile?.photoURL,
    providerIds,
    emailVerified: user.emailVerified,
    kvkkAccepted:
      overrideProfile.kvkkAccepted ?? existingProfile?.kvkkAccepted ?? false,
    legalAcceptance:
      overrideProfile.legalAcceptance ??
      existingProfile?.legalAcceptance ??
      buildCurrentLegalAcceptance(
        options?.trackLogin ? 'first_auth' : 'profile_sync',
        now
      ),
    nutritionPreferences:
      overrideProfile.nutritionPreferences ?? existingProfile?.nutritionPreferences,
    familyHealthProfile:
      overrideProfile.familyHealthProfile ?? existingProfile?.familyHealthProfile,
    locationContext:
      overrideProfile.locationContext ?? existingProfile?.locationContext,
    createdAt: existingProfile?.createdAt ?? now,
    updatedAt: now,
    lastSeenAt: now,
    lastLoginAt: options?.trackLogin ? now : existingProfile?.lastLoginAt,
    monetization: monetizationProjection ?? existingProfile?.monetization,
  });

  const ref = doc(db, USERS_COLLECTION, user.uid);

  await setDoc(ref, mergedProfile, { merge: true });

  return mergedProfile;
}

export async function refreshCurrentUserProfile(): Promise<AppUserProfile | null> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return null;
  }

  const existingProfile = await getUserProfile(currentUser.uid);

  if (existingProfile) {
    return existingProfile;
  }

  return ensureUserProfileDocument(currentUser, {
    trackLogin: false,
  });
}

export async function syncCurrentUserMonetizationProjection(): Promise<AppUserProfile | null> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return null;
  }

  return ensureUserProfileDocument(currentUser, {
    trackLogin: false,
  });
}

export async function updateCurrentUserProfile(input: {
  firstName?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  district?: string;
  address?: string;
}): Promise<AppUserProfile | null> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return null;
  }

  const [existingProfile, monetizationProjection] = await Promise.all([
    getUserProfile(currentUser.uid),
    buildMonetizationProjectionForUser(currentUser),
  ]);

  const authProfile = deriveUserProfileFromAuthUser(currentUser);
  const editableProfile = sanitizeEditableUserProfileInput(input);
  const now = new Date().toISOString();

  const firstName =
    editableProfile.firstName ??
    existingProfile?.firstName ??
    authProfile.firstName ??
    '';

  const lastName =
    editableProfile.lastName ??
    existingProfile?.lastName ??
    authProfile.lastName ??
    '';

  const mergedProfile = compactUserProfile({
    firstName,
    lastName,
    displayName: buildDisplayName({
      displayName: existingProfile?.displayName ?? authProfile.displayName,
      firstName,
      lastName,
    }),
    phone: editableProfile.phone ?? existingProfile?.phone ?? '',
    city: editableProfile.city ?? existingProfile?.city ?? '',
    district: editableProfile.district ?? existingProfile?.district ?? '',
    address: editableProfile.address ?? existingProfile?.address ?? '',
    email: authProfile.email ?? existingProfile?.email,
    photoURL: authProfile.photoURL ?? existingProfile?.photoURL,
    providerIds: normalizeProviderIds([
      ...(existingProfile?.providerIds ?? []),
      ...(authProfile.providerIds ?? []),
    ]),
    emailVerified: currentUser.emailVerified,
    kvkkAccepted: existingProfile?.kvkkAccepted ?? false,
    legalAcceptance:
      existingProfile?.legalAcceptance ?? buildCurrentLegalAcceptance('profile_sync', now),
    nutritionPreferences: existingProfile?.nutritionPreferences,
    familyHealthProfile: existingProfile?.familyHealthProfile,
    locationContext: existingProfile?.locationContext,
    createdAt: existingProfile?.createdAt ?? now,
    updatedAt: now,
    lastLoginAt: existingProfile?.lastLoginAt,
    lastSeenAt: now,
    monetization: monetizationProjection ?? existingProfile?.monetization,
  });

  const ref = doc(db, USERS_COLLECTION, currentUser.uid);

  await setDoc(ref, mergedProfile, { merge: true });

  return mergedProfile;
}

export async function updateCurrentUserNutritionPreferences(
  nutritionPreferences: NutritionPreferences
): Promise<AppUserProfile | null> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return null;
  }

  const normalizedPreferences = normalizeNutritionPreferences(nutritionPreferences);
  const existingProfile = await getUserProfile(currentUser.uid);
  const now = new Date().toISOString();

  const ref = doc(db, USERS_COLLECTION, currentUser.uid);

  await setDoc(
    ref,
    compactUserProfile({
      nutritionPreferences: normalizedPreferences,
      updatedAt: now,
      lastSeenAt: now,
    }),
    { merge: true }
  );

  return compactUserProfile({
    ...(existingProfile ?? {}),
    nutritionPreferences: normalizedPreferences,
    updatedAt: now,
    lastSeenAt: now,
  });
}

export async function updateCurrentUserFamilyHealthProfile(
  familyHealthProfile: FamilyHealthProfile
): Promise<AppUserProfile | null> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return null;
  }

  const normalizedProfile = normalizeFamilyHealthProfile(familyHealthProfile);
  const existingProfile = await getUserProfile(currentUser.uid);
  const now = new Date().toISOString();

  const ref = doc(db, USERS_COLLECTION, currentUser.uid);

  await setDoc(
    ref,
    compactUserProfile({
      familyHealthProfile: normalizedProfile,
      updatedAt: now,
      lastSeenAt: now,
    }),
    { merge: true }
  );

  return compactUserProfile({
    ...(existingProfile ?? {}),
    familyHealthProfile: normalizedProfile,
    updatedAt: now,
    lastSeenAt: now,
  });
}

export async function updateCurrentUserLocationContext(
  locationContext: UserLocationSnapshot
): Promise<AppUserProfile | null> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return null;
  }

  const existingProfile = await getUserProfile(currentUser.uid);
  const normalizedLocation = normalizeLocationContext(locationContext);
  const now = new Date().toISOString();

  const nextLocation = normalizedLocation
    ? normalizeLocationContext({
        ...(existingProfile?.locationContext ?? {}),
        ...normalizedLocation,
        city: normalizedLocation.city ?? existingProfile?.city ?? existingProfile?.locationContext?.city,
        district:
          normalizedLocation.district ??
          existingProfile?.district ??
          existingProfile?.locationContext?.district,
        capturedAt: normalizedLocation.capturedAt ?? now,
        source: normalizedLocation.source ?? 'device',
      })
    : existingProfile?.locationContext;

  const ref = doc(db, USERS_COLLECTION, currentUser.uid);

  await setDoc(
    ref,
    compactUserProfile({
      city: nextLocation?.city ?? existingProfile?.city,
      district: nextLocation?.district ?? existingProfile?.district,
      locationContext: nextLocation,
      updatedAt: now,
      lastSeenAt: now,
    }),
    { merge: true }
  );

  return compactUserProfile({
    ...(existingProfile ?? {}),
    city: nextLocation?.city ?? existingProfile?.city,
    district: nextLocation?.district ?? existingProfile?.district,
    locationContext: nextLocation,
    updatedAt: now,
    lastSeenAt: now,
  });
}

export async function updateCurrentUserLegalAcceptance(
  legalAcceptance: LegalAcceptanceSnapshot
): Promise<AppUserProfile | null> {
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return null;
  }

  const normalizedAcceptance = normalizeLegalAcceptanceSnapshot(legalAcceptance);
  const existingProfile = await getUserProfile(currentUser.uid);
  const now = new Date().toISOString();

  const ref = doc(db, USERS_COLLECTION, currentUser.uid);

  await setDoc(
    ref,
    compactUserProfile({
      kvkkAccepted: true,
      legalAcceptance: normalizedAcceptance,
      updatedAt: now,
      lastSeenAt: now,
    }),
    { merge: true }
  );

  return compactUserProfile({
    ...(existingProfile ?? {}),
    kvkkAccepted: true,
    legalAcceptance: normalizedAcceptance,
    updatedAt: now,
    lastSeenAt: now,
  });
}
