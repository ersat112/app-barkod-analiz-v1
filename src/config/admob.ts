import { ADMOB_RUNTIME, type AdRequestOptions, resolveAdUnitId } from './adRuntime';

export const AD_UNIT_ID = Object.freeze({
  INTERSTITIAL: resolveAdUnitId('INTERSTITIAL'),
  BANNER: resolveAdUnitId('BANNER'),
  REWARDED: resolveAdUnitId('REWARDED'),
});

export const GLOBAL_AD_CONFIG: AdRequestOptions = {
  ...ADMOB_RUNTIME.requestOptions,
};

export enum AdUnitType {
  SCAN_INTERSTITIAL = 'SCAN_INTERSTITIAL',
  HISTORY_BANNER = 'HISTORY_BANNER',
}