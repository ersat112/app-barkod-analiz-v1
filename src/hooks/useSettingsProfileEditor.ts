import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAuth } from '../context/AuthContext';
import { updateCurrentUserProfile } from '../services/userProfile.service';
import { authAnalyticsService } from '../services/authAnalytics.service';
import { calculateProfileCompletion } from '../services/profileCompletion.service';

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
  const { user, profile, refreshProfile } = useAuth();

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
      setDraft((current) => ({
        ...current,
        [field]: value,
      }));
    },
    []
  );

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

    try {
      setIsSaving(true);
      setSaveError(null);

      await updateCurrentUserProfile({
        firstName: draft.firstName,
        lastName: draft.lastName,
        phone: draft.phone,
        city: draft.city,
        district: draft.district,
        address: draft.address,
      });

      await refreshProfile();

      const completion = calculateProfileCompletion({
        profile: {
          ...(profile ?? {}),
          firstName: draft.firstName,
          lastName: draft.lastName,
          phone: draft.phone,
          city: draft.city,
          district: draft.district,
          address: draft.address,
        },
        user,
      });

      await authAnalyticsService.trackProfileSaveSucceeded({
        surface: 'settings',
        completionScore: completion.score,
        missingFields: completion.missingFields,
        changedFields,
      });

      setIsEditing(false);
      return true;
    } catch (error) {
      console.error('[useSettingsProfileEditor] save failed:', error);

      await authAnalyticsService.trackProfileSaveFailed({
        surface: 'settings',
        changedFields,
        error,
      });

      setSaveError(toErrorMessage(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [draft, hasChanges, profile, refreshProfile, sourceDraft, user]);

  return {
    draft,
    isEditing,
    isSaving,
    hasChanges,
    saveError,
    startEditing,
    cancelEditing,
    setField,
    save,
  };
};
