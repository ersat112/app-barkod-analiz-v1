import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { updateCurrentUserProfile } from '../services/userProfile.service';
import { authAnalyticsService } from '../services/authAnalytics.service';
import { calculateProfileCompletion } from '../services/profileCompletion.service';
import {
  resolveCanonicalCity,
  resolveCanonicalDistrict,
} from '../services/locationData';

export type SettingsProfileDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  city: string;
  district: string;
  address: string;
};

const createDraft = (input?: Partial<SettingsProfileDraft> | null): SettingsProfileDraft => {
  return {
    firstName: input?.firstName?.trim() ?? '',
    lastName: input?.lastName?.trim() ?? '',
    phone: input?.phone?.trim() ?? '',
    city: input?.city?.trim() ?? '',
    district: input?.district?.trim() ?? '',
    address: input?.address?.trim() ?? '',
  };
};

const areDraftsEqual = (
  left: SettingsProfileDraft,
  right: SettingsProfileDraft
): boolean => {
  return (
    left.firstName === right.firstName &&
    left.lastName === right.lastName &&
    left.phone === right.phone &&
    left.city === right.city &&
    left.district === right.district &&
    left.address === right.address
  );
};

function getChangedFields(
  source: SettingsProfileDraft,
  draft: SettingsProfileDraft
): string[] {
  const changed: string[] = [];

  (Object.keys(draft) as (keyof SettingsProfileDraft)[]).forEach((key) => {
    if (source[key] !== draft[key]) {
      changed.push(key);
    }
  });

  return changed;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return 'profile_save_failed';
}

export const useSettingsProfileEditor = () => {
  const { user, profile, refreshProfile, applyProfileSnapshot } = useAuth();

  const sourceDraft = useMemo(
    () =>
      createDraft({
        firstName: profile?.firstName,
        lastName: profile?.lastName,
        phone: profile?.phone,
        city: profile?.city,
        district: profile?.district,
        address: profile?.address,
      }),
    [
      profile?.address,
      profile?.city,
      profile?.district,
      profile?.firstName,
      profile?.lastName,
      profile?.phone,
    ]
  );

  const [draft, setDraft] = useState<SettingsProfileDraft>(sourceDraft);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraft(sourceDraft);
    }
  }, [isEditing, sourceDraft]);

  const hasChanges = useMemo(() => {
    return !areDraftsEqual(draft, sourceDraft);
  }, [draft, sourceDraft]);

  const resolvedCity = useMemo(() => {
    return resolveCanonicalCity(draft.city);
  }, [draft.city]);

  const startEditing = useCallback(() => {
    setDraft(sourceDraft);
    setSaveError(null);
    setIsEditing(true);
  }, [sourceDraft]);

  const cancelEditing = useCallback(() => {
    setDraft(sourceDraft);
    setSaveError(null);
    setIsEditing(false);
  }, [sourceDraft]);

  const setField = useCallback(
    (field: keyof SettingsProfileDraft, value: string) => {
      setDraft((current) => {
        if (field === 'city') {
          const nextCity = value;
          const nextResolvedCity = resolveCanonicalCity(nextCity);
          const nextDistrict = nextResolvedCity
            ? resolveCanonicalDistrict(nextResolvedCity, current.district) ??
              (current.district.trim() ? '' : current.district)
            : current.district;

          return {
            ...current,
            city: nextCity,
            district: nextDistrict,
          };
        }

        return {
          ...current,
          [field]: value,
        };
      });
    },
    []
  );

  const selectCity = useCallback((value: string) => {
    setDraft((current) => ({
      ...current,
      city: value,
      district:
        resolveCanonicalDistrict(value, current.district) ?? '',
    }));
  }, []);

  const selectDistrict = useCallback((value: string) => {
    setDraft((current) => ({
      ...current,
      district: value,
    }));
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setSaveError('auth_required');
      return false;
    }

    if (!hasChanges) {
      setIsEditing(false);
      setSaveError(null);
      return true;
    }

    const changedFields = getChangedFields(sourceDraft, draft);
    const nextDraft: SettingsProfileDraft = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      phone: draft.phone.trim(),
      city: resolveCanonicalCity(draft.city) ?? draft.city.trim(),
      district:
        resolveCanonicalDistrict(draft.city, draft.district) ?? draft.district.trim(),
      address: draft.address.trim(),
    };

    try {
      setIsSaving(true);
      setSaveError(null);

      const nextProfile = await updateCurrentUserProfile({
        firstName: nextDraft.firstName,
        lastName: nextDraft.lastName,
        phone: nextDraft.phone,
        city: nextDraft.city,
        district: nextDraft.district,
        address: nextDraft.address,
      });

      applyProfileSnapshot(
        nextProfile ?? {
          ...(profile ?? {}),
          firstName: nextDraft.firstName,
          lastName: nextDraft.lastName,
          phone: nextDraft.phone,
          city: nextDraft.city,
          district: nextDraft.district,
          address: nextDraft.address,
        }
      );
      setDraft(nextDraft);
      try {
        await refreshProfile();
      } catch (refreshError) {
        console.warn('[useSettingsProfileEditor] refresh after save failed:', refreshError);
      }

      const completion = calculateProfileCompletion({
        profile: nextProfile ?? {
          ...(profile ?? {}),
          firstName: nextDraft.firstName,
          lastName: nextDraft.lastName,
          phone: nextDraft.phone,
          city: nextDraft.city,
          district: nextDraft.district,
          address: nextDraft.address,
        },
        user,
      });

      try {
        await authAnalyticsService.trackProfileSaveSucceeded({
          surface: 'settings',
          completionScore: completion.score,
          missingFields: completion.missingFields,
          changedFields,
        });
      } catch (analyticsError) {
        console.warn(
          '[useSettingsProfileEditor] success analytics failed:',
          analyticsError
        );
      }

      setIsEditing(false);
      return true;
    } catch (error) {
      console.error('[useSettingsProfileEditor] save failed:', error);

      try {
        await authAnalyticsService.trackProfileSaveFailed({
          surface: 'settings',
          changedFields,
          error,
        });
      } catch (analyticsError) {
        console.warn(
          '[useSettingsProfileEditor] failure analytics failed:',
          analyticsError
        );
      }

      setSaveError(toErrorMessage(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    applyProfileSnapshot,
    draft,
    hasChanges,
    profile,
    refreshProfile,
    sourceDraft,
    user,
  ]);

  return {
    draft,
    isEditing,
    isSaving,
    hasChanges,
    resolvedCity,
    saveError,
    startEditing,
    cancelEditing,
    setField,
    selectCity,
    selectDistrict,
    save,
  };
};
