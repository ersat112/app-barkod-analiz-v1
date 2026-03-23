import type { User } from 'firebase/auth';

import type { AppUserProfile } from '../types/userProfile';

type BuildDisplayNameParams = {
  profile?: AppUserProfile | null;
  user?: User | null;
  fallback: string;
};

type BuildMetaParams = {
  profile?: AppUserProfile | null;
  user?: User | null;
  fallback: string;
};

const normalizeText = (value?: string | null): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

const formatEmailLocalPart = (value?: string | null): string => {
  const normalized = normalizeText(value);

  if (!normalized) {
    return '';
  }

  return normalized
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export const buildUserDisplayName = ({
  profile,
  user,
  fallback,
}: BuildDisplayNameParams): string => {
  const firstName = normalizeText(profile?.firstName);
  const lastName = normalizeText(profile?.lastName);

  if (firstName || lastName) {
    return `${firstName} ${lastName}`.trim();
  }

  const explicitDisplayName =
    normalizeText(profile?.displayName) || normalizeText(user?.displayName);

  if (explicitDisplayName) {
    return explicitDisplayName;
  }

  const emailLocalPart = formatEmailLocalPart(
    profile?.email || user?.email || undefined
  );

  if (emailLocalPart) {
    return emailLocalPart;
  }

  return fallback;
};

export const buildUserMetaText = ({
  profile,
  user,
  fallback,
}: BuildMetaParams): string => {
  const city = normalizeText(profile?.city);
  const district = normalizeText(profile?.district);

  if (city && district) {
    return `${city} / ${district}`;
  }

  if (city) {
    return city;
  }

  if (district) {
    return district;
  }

  return normalizeText(profile?.email) || normalizeText(user?.email) || fallback;
};

export const buildAvatarLetter = (displayName: string, fallback = 'U'): string => {
  const normalized = normalizeText(displayName);

  if (!normalized) {
    return fallback;
  }

  return normalized.charAt(0).toUpperCase();
};