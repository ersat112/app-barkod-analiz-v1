import type { User } from 'firebase/auth';

import type { AppUserProfile } from '../types/userProfile';

export type ProfileCompletionFieldKey =
  | 'firstName'
  | 'lastName'
  | 'phone'
  | 'city'
  | 'district'
  | 'address';

export type ProfileCompletionSnapshot = {
  totalRequiredFields: number;
  completedRequiredFields: number;
  missingRequiredFields: number;
  score: number;
  progress: number;
  isComplete: boolean;
  missingFields: ProfileCompletionFieldKey[];
  completedFields: ProfileCompletionFieldKey[];
  primaryMissingField: ProfileCompletionFieldKey | null;
};

const REQUIRED_FIELDS: ProfileCompletionFieldKey[] = [
  'firstName',
  'lastName',
  'phone',
  'city',
  'district',
  'address',
];

function normalizeValue(value?: string | null): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
}

function resolveFieldValue(
  field: ProfileCompletionFieldKey,
  profile?: AppUserProfile | null,
  user?: User | null
): string {
  switch (field) {
    case 'firstName':
      return normalizeValue(profile?.firstName);
    case 'lastName':
      return normalizeValue(profile?.lastName);
    case 'phone':
      return normalizeValue(profile?.phone);
    case 'city':
      return normalizeValue(profile?.city);
    case 'district':
      return normalizeValue(profile?.district);
    case 'address':
      return normalizeValue(profile?.address);
    default:
      return normalizeValue(user?.uid);
  }
}

export function calculateProfileCompletion(params: {
  profile?: AppUserProfile | null;
  user?: User | null;
}): ProfileCompletionSnapshot {
  const completedFields: ProfileCompletionFieldKey[] = [];
  const missingFields: ProfileCompletionFieldKey[] = [];

  REQUIRED_FIELDS.forEach((field) => {
    const value = resolveFieldValue(field, params.profile, params.user);

    if (value.length > 0) {
      completedFields.push(field);
      return;
    }

    missingFields.push(field);
  });

  const totalRequiredFields = REQUIRED_FIELDS.length;
  const completedRequiredFields = completedFields.length;
  const missingRequiredFields = missingFields.length;
  const score =
    totalRequiredFields === 0
      ? 100
      : Math.round((completedRequiredFields / totalRequiredFields) * 100);

  return {
    totalRequiredFields,
    completedRequiredFields,
    missingRequiredFields,
    score,
    progress: Math.min(Math.max(score / 100, 0), 1),
    isComplete: missingRequiredFields === 0,
    missingFields,
    completedFields,
    primaryMissingField: missingFields[0] ?? null,
  };
}