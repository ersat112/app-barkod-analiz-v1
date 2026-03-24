import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { auth, db } from '../config/firebase';
import { entitlementService } from './entitlement.service';
import { freeScanPolicyService } from './freeScanPolicy.service';
import { monetizationPolicyService } from './monetizationPolicy.service';
import type {
  AppUserProfile,
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

function normalizeEditableString(value?: string | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  return value.trim();
}

function normalizeOptionalBoolean(value?: boolean | null): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
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

  if (explicitDisplayName) {
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
  assign('createdAt', input.createdAt);
  assign('updatedAt', input.updatedAt);
  assign('lastLoginAt', input.lastLoginAt);
  assign('lastSeenAt', input.lastSeenAt);
  assign('monetization', compactUserMonetizationProjection(input.monetization));

  return output;
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

  return snapshot.data() as AppUserProfile;
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
