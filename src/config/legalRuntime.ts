import type {
  LegalAcceptanceSnapshot,
  LegalDocumentVersionMap,
} from '../types/userProfile';

export const LEGAL_HOST_BASE_URL = 'https://barkodanaliz-5ed4b.web.app';
export const LEGAL_VERSION_LABEL = '2026-03-31-tr1';

export const LEGAL_DOCUMENT_VERSIONS: LegalDocumentVersionMap = {
  terms: '2026-03-31-tr1',
  privacy: '2026-03-31-tr1',
  medical: '2026-03-31-tr1',
  premium: '2026-03-31-tr1',
  independence: '2026-03-31-tr1',
};

export type LegalDocumentSlug =
  | 'terms'
  | 'privacy'
  | 'medical'
  | 'premium'
  | 'independence';

export function getLegalDocumentUrl(slug: LegalDocumentSlug): string {
  return `${LEGAL_HOST_BASE_URL}/legal/${slug}.html`;
}

export function buildCurrentLegalAcceptance(
  source: LegalAcceptanceSnapshot['source'],
  acceptedAt = new Date().toISOString()
): LegalAcceptanceSnapshot {
  return {
    acceptedAt,
    versionLabel: LEGAL_VERSION_LABEL,
    source,
    documents: LEGAL_DOCUMENT_VERSIONS,
  };
}
