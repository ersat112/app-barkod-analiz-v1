import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

import { auth, db } from '../config/firebase';
import type { AppUserProfile, UserProfileInput } from '../types/userProfile';

const USERS_COLLECTION = 'users';

function normalizeOptionalString(value?: string | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : undefined;
}

function normalizeOptionalBoolean(value?: boolean | null): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function normalizeProviderIds(
  values?: Array<string | null | undefined>
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

  const firstName = normalizeOptionalString(params.firstName);
  const lastName = normalizeOptionalString(params.lastName);

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

  return output;
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
  const existingProfile = await getUserProfile(user.uid);
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
    lastLoginAt: options?.trackLogin
      ? now
      : existingProfile?.lastLoginAt,
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