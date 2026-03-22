import type { DiagnosticsTimestamp } from '../types/diagnostics';

export function formatDiagnosticsTime(
  value?: DiagnosticsTimestamp | number | null
): string {
  if (value === null || value === undefined) {
    return '-';
  }

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '-';
    }

    return date.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '-';
  }
}