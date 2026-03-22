import type { HistoryEntry } from '../services/db';

export const HISTORY_PAGE_SIZE = 20;

export type HistoryFilterType = 'all' | 'food' | 'beauty';

export type HistoryRow = {
  id: number;
  barcode: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  type: string | null;
  score: number | null;
  grade: string | null;
  ingredients_text: string | null;
  country: string | null;
  origin: string | null;
  sourceName: string | null;
  created_at: string;
  updated_at: string;
};

export type HistoryPageResult = {
  items: HistoryEntry[];
  hasMore: boolean;
  nextOffset: number;
};

export type HomeDashboardSnapshot = {
  todayCount: number;
  todayUniqueCount: number;
  totalHistoryCount: number;
  bestScoreToday: number | null;
  weeklyScanTotal: number;
  weeklyActiveDays: number;
  streakCount: number;
  lastScannedProduct: HistoryEntry | null;
  recentProducts: HistoryEntry[];
};

export type HistorySection = {
  title: string;
  rawDate: string;
  data: HistoryEntry[];
};

export type ParsedHistoryCreatedAt = {
  datePart: string;
  timePart: string;
};

export const createEmptyHomeDashboardSnapshot = (): HomeDashboardSnapshot => ({
  todayCount: 0,
  todayUniqueCount: 0,
  totalHistoryCount: 0,
  bestScoreToday: null,
  weeklyScanTotal: 0,
  weeklyActiveDays: 0,
  streakCount: 0,
  lastScannedProduct: null,
  recentProducts: [],
});

export const getLocalDateKey = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
};

export const parseHistoryCreatedAt = (
  createdAt?: string | null
): ParsedHistoryCreatedAt => {
  if (!createdAt) {
    return { datePart: '', timePart: '--:--' };
  }

  const iso = createdAt.replace(' ', 'T');
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    const [datePart = '', timePart = ''] = createdAt.split(' ');

    return {
      datePart,
      timePart: timePart ? timePart.slice(0, 5) : '--:--',
    };
  }

  const datePart = `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
  const timePart = `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`;

  return { datePart, timePart };
};

export const formatHistoryDateTitle = (
  rawDate: string,
  t: (key: string, fallback: string) => string
): string => {
  const today = getLocalDateKey();
  const yesterday = getLocalDateKey(new Date(Date.now() - 86400000));

  if (rawDate === today) {
    return t('today', 'Bugün');
  }

  if (rawDate === yesterday) {
    return t('yesterday', 'Dün');
  }

  return rawDate;
};

export const groupHistoryEntriesByDate = (
  data: HistoryEntry[],
  t: (key: string, fallback: string) => string
): HistorySection[] => {
  const grouped = data.reduce<Record<string, HistorySection>>((acc, item) => {
    const { datePart } = parseHistoryCreatedAt(item.created_at);
    const rawDate = datePart || 'unknown-date';

    if (!acc[rawDate]) {
      acc[rawDate] = {
        title: formatHistoryDateTitle(rawDate, t),
        rawDate,
        data: [],
      };
    }

    acc[rawDate].data.push(item);
    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => b.rawDate.localeCompare(a.rawDate));
};