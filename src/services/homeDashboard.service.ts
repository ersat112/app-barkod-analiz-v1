import { getHomeDashboardSnapshot as getHomeDashboardSnapshotFromRepository } from './db/history.repository';
import type { HomeDashboardSnapshot } from '../types/history';

export type { HomeDashboardSnapshot };

export const getHomeDashboardSnapshot = (): HomeDashboardSnapshot => {
  return getHomeDashboardSnapshotFromRepository();
};