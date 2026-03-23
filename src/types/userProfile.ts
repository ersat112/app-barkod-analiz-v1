export type AppUserProfile = {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  city?: string;
  district?: string;
  address?: string;
  email?: string;
  photoURL?: string;
  providerIds?: string[];
  emailVerified?: boolean;
  kvkkAccepted?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  lastSeenAt?: string;
};

export type UserProfileInput = Partial<AppUserProfile>;