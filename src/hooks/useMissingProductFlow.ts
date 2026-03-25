import { useCallback, useRef } from 'react';

import { analyticsService } from '../services/analytics.service';

type NotFoundReason = 'not_found' | 'invalid_barcode' | 'unknown';
type MissingProductEntryPoint = 'detail_not_found' | 'manual';

type NotFoundEventPayload = {
  barcode: string;
  reason: NotFoundReason;
  entryPoint?: MissingProductEntryPoint;
};

type MissingProductDraftEventPayload = {
  barcode: string;
  type: 'food' | 'beauty' | 'medicine' | 'unknown';
  hasBrand: boolean;
  hasCountry: boolean;
  hasOrigin: boolean;
  hasIngredients: boolean;
  hasNotes: boolean;
  hasImage: boolean;
  entryPoint: MissingProductEntryPoint;
  localId?: string;
  queueStatus?: string;
  syncError?: string;
};

function normalizeBarcode(barcode: string): string {
  return String(barcode || '').replace(/[^\d]/g, '').trim();
}

function normalizeReason(reason?: string | null): NotFoundReason {
  if (reason === 'invalid_barcode') {
    return 'invalid_barcode';
  }

  if (reason === 'not_found') {
    return 'not_found';
  }

  return 'unknown';
}

export const useMissingProductFlow = () => {
  const trackedNotFoundViewKeysRef = useRef<Set<string>>(new Set());
  const trackedMissingScreenKeysRef = useRef<Set<string>>(new Set());

  const trackNotFoundViewed = useCallback(
    async (payload: NotFoundEventPayload): Promise<void> => {
      const barcode = normalizeBarcode(payload.barcode);

      if (!barcode) {
        return;
      }

      const reason = normalizeReason(payload.reason);
      const dedupeKey = `${barcode}:${reason}`;

      if (trackedNotFoundViewKeysRef.current.has(dedupeKey)) {
        return;
      }

      trackedNotFoundViewKeysRef.current.add(dedupeKey);

      await analyticsService.track(
        'product_not_found_viewed',
        {
          barcode,
          reason,
          entryPoint: payload.entryPoint ?? 'detail_not_found',
        },
        { flush: false }
      );
    },
    []
  );

  const trackNotFoundRetryTapped = useCallback(
    async (payload: NotFoundEventPayload): Promise<void> => {
      const barcode = normalizeBarcode(payload.barcode);

      if (!barcode) {
        return;
      }

      await analyticsService.track(
        'product_not_found_retry_tapped',
        {
          barcode,
          reason: normalizeReason(payload.reason),
          entryPoint: payload.entryPoint ?? 'detail_not_found',
        },
        { flush: false }
      );
    },
    []
  );

  const trackNotFoundAddProductTapped = useCallback(
    async (payload: NotFoundEventPayload): Promise<void> => {
      const barcode = normalizeBarcode(payload.barcode);

      if (!barcode) {
        return;
      }

      await analyticsService.track(
        'product_not_found_add_product_tapped',
        {
          barcode,
          reason: normalizeReason(payload.reason),
          entryPoint: payload.entryPoint ?? 'detail_not_found',
        },
        { flush: false }
      );
    },
    []
  );

  const trackMissingProductScreenViewed = useCallback(
    async (barcode: string, entryPoint: MissingProductEntryPoint = 'detail_not_found') => {
      const normalizedBarcode = normalizeBarcode(barcode);

      if (!normalizedBarcode) {
        return;
      }

      const dedupeKey = `${normalizedBarcode}:${entryPoint}`;

      if (trackedMissingScreenKeysRef.current.has(dedupeKey)) {
        return;
      }

      trackedMissingScreenKeysRef.current.add(dedupeKey);

      await analyticsService.track(
        'missing_product_screen_viewed',
        {
          barcode: normalizedBarcode,
          entryPoint,
        },
        { flush: false }
      );
    },
    []
  );

  const trackMissingProductDraftSaved = useCallback(
    async (payload: MissingProductDraftEventPayload): Promise<void> => {
      const barcode = normalizeBarcode(payload.barcode);

      if (!barcode) {
        return;
      }

      await analyticsService.track(
        'missing_product_draft_saved',
        {
          barcode,
          type: payload.type,
          hasBrand: payload.hasBrand,
          hasCountry: payload.hasCountry,
          hasOrigin: payload.hasOrigin,
          hasIngredients: payload.hasIngredients,
          hasNotes: payload.hasNotes,
          hasImage: payload.hasImage,
          entryPoint: payload.entryPoint,
          localId: payload.localId,
          queueStatus: payload.queueStatus ?? 'local_draft',
        },
        { flush: false }
      );
    },
    []
  );

  return {
    trackNotFoundViewed,
    trackNotFoundRetryTapped,
    trackNotFoundAddProductTapped,
    trackMissingProductScreenViewed,
    trackMissingProductDraftSaved,
  };
};
