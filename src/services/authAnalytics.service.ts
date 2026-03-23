import { analyticsService } from './analytics.service';
import type { AnalyticsEventPayload } from '../types/ads';

export type AuthAnalyticsMethod = 'password' | 'google' | 'apple';
export type AuthAnalyticsSurface = 'login' | 'signup' | 'home' | 'settings';

function serializeError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'unknown_error';
  }
}

export const authAnalyticsService = {
  async trackLoginSucceeded(params: {
    method: AuthAnalyticsMethod;
    surface: AuthAnalyticsSurface;
    emailVerified?: boolean;
    payload?: AnalyticsEventPayload;
  }): Promise<string> {
    return analyticsService.track(
      'auth_login_succeeded',
      {
        method: params.method,
        surface: params.surface,
        emailVerified: params.emailVerified ?? null,
        ...(params.payload ?? {}),
      },
      { flush: false }
    );
  },

  async trackLoginFailed(params: {
    method: AuthAnalyticsMethod;
    surface: AuthAnalyticsSurface;
    error?: unknown;
    errorCode?: string;
    payload?: AnalyticsEventPayload;
  }): Promise<string> {
    return analyticsService.track(
      'auth_login_failed',
      {
        method: params.method,
        surface: params.surface,
        errorCode: params.errorCode ?? null,
        message: serializeError(params.error),
        ...(params.payload ?? {}),
      },
      { flush: false }
    );
  },

  async trackSignupSucceeded(params: {
    method: AuthAnalyticsMethod;
    surface: AuthAnalyticsSurface;
    emailVerified?: boolean;
    hasProfileSeed?: boolean;
    payload?: AnalyticsEventPayload;
  }): Promise<string> {
    return analyticsService.track(
      'auth_signup_succeeded',
      {
        method: params.method,
        surface: params.surface,
        emailVerified: params.emailVerified ?? null,
        hasProfileSeed: params.hasProfileSeed ?? null,
        ...(params.payload ?? {}),
      },
      { flush: false }
    );
  },

  async trackSignupFailed(params: {
    method: AuthAnalyticsMethod;
    surface: AuthAnalyticsSurface;
    error?: unknown;
    errorCode?: string;
    payload?: AnalyticsEventPayload;
  }): Promise<string> {
    return analyticsService.track(
      'auth_signup_failed',
      {
        method: params.method,
        surface: params.surface,
        errorCode: params.errorCode ?? null,
        message: serializeError(params.error),
        ...(params.payload ?? {}),
      },
      { flush: false }
    );
  },

  async trackProfileSaveSucceeded(params: {
    surface: AuthAnalyticsSurface;
    completionScore: number;
    missingFields: string[];
    changedFields: string[];
    payload?: AnalyticsEventPayload;
  }): Promise<string> {
    return analyticsService.track(
      'profile_save_succeeded',
      {
        surface: params.surface,
        completionScore: params.completionScore,
        missingFields: params.missingFields,
        changedFields: params.changedFields,
        ...(params.payload ?? {}),
      },
      { flush: false }
    );
  },

  async trackProfileSaveFailed(params: {
    surface: AuthAnalyticsSurface;
    changedFields: string[];
    error?: unknown;
    errorCode?: string;
    payload?: AnalyticsEventPayload;
  }): Promise<string> {
    return analyticsService.track(
      'profile_save_failed',
      {
        surface: params.surface,
        changedFields: params.changedFields,
        errorCode: params.errorCode ?? null,
        message: serializeError(params.error),
        ...(params.payload ?? {}),
      },
      { flush: false }
    );
  },

  async trackProfileCompletionGateViewed(params: {
    surface: AuthAnalyticsSurface;
    completionScore: number;
    missingFields: string[];
    payload?: AnalyticsEventPayload;
  }): Promise<string> {
    return analyticsService.track(
      'profile_completion_gate_viewed',
      {
        surface: params.surface,
        completionScore: params.completionScore,
        missingFields: params.missingFields,
        ...(params.payload ?? {}),
      },
      { flush: false }
    );
  },

  async trackProfileCompletionCtaTapped(params: {
    surface: AuthAnalyticsSurface;
    completionScore: number;
    missingFields: string[];
    payload?: AnalyticsEventPayload;
  }): Promise<string> {
    return analyticsService.track(
      'profile_completion_cta_tapped',
      {
        surface: params.surface,
        completionScore: params.completionScore,
        missingFields: params.missingFields,
        ...(params.payload ?? {}),
      },
      { flush: false }
    );
  },
};