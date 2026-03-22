import {
  createEmptyHomeDashboardSnapshot,
  type HomeDashboardSnapshot,
} from '../types/history';
import { getHomeDashboardSnapshot } from './homeDashboard.service';

export type HomeDashboardReadModel = HomeDashboardSnapshot;

export const EMPTY_HOME_DASHBOARD_READ_MODEL: HomeDashboardReadModel =
  createEmptyHomeDashboardSnapshot();

function areRecentProductsEqual(
  left: HomeDashboardReadModel['recentProducts'],
  right: HomeDashboardReadModel['recentProducts']
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const current = left[index];
    const next = right[index];

    if (
      current.id !== next.id ||
      current.barcode !== next.barcode ||
      current.updated_at !== next.updated_at
    ) {
      return false;
    }
  }

  return true;
}

export function areHomeDashboardReadModelsEqual(
  left: HomeDashboardReadModel,
  right: HomeDashboardReadModel
): boolean {
  return (
    left.todayCount === right.todayCount &&
    left.todayUniqueCount === right.todayUniqueCount &&
    left.totalHistoryCount === right.totalHistoryCount &&
    left.bestScoreToday === right.bestScoreToday &&
    left.weeklyScanTotal === right.weeklyScanTotal &&
    left.weeklyActiveDays === right.weeklyActiveDays &&
    left.streakCount === right.streakCount &&
    left.lastScannedProduct?.id === right.lastScannedProduct?.id &&
    left.lastScannedProduct?.updated_at === right.lastScannedProduct?.updated_at &&
    areRecentProductsEqual(left.recentProducts, right.recentProducts)
  );
}

export function getHomeDashboardReadModel(): HomeDashboardReadModel {
  return getHomeDashboardSnapshot();
}