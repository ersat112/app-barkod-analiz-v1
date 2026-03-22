export type DiagnosticsTimestamp = string;

export type DiagnosticsPillTone = 'success' | 'danger' | 'neutral';

export type DiagnosticsPill = {
  label: string;
  tone?: DiagnosticsPillTone;
};

export type DiagnosticsRow = {
  label: string;
  value: string | number;
};