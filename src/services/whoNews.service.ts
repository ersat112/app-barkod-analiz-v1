const WHO_BASE_URL = 'https://www.who.int';
const WHO_NEWS_LIMIT = 4;

export type WhoNewsItem = {
  id: string;
  title: string;
  publishedAt: string | null;
  type: string;
  url: string;
  sourceLocale: 'en' | 'fr';
};

export type WhoNewsSnapshot = {
  items: WhoNewsItem[];
  sourceLocale: 'en' | 'fr';
  requestedLocale: string;
  isFallback: boolean;
};

type WhoNewsLocaleConfig = {
  url: string;
  sourceLocale: 'en' | 'fr';
  sectionHeading: string;
  sectionTail: string;
};

const WHO_NEWS_CONFIG: Record<string, WhoNewsLocaleConfig> = {
  en: {
    url: `${WHO_BASE_URL}/news-room`,
    sourceLocale: 'en',
    sectionHeading: 'Latest news from WHO',
    sectionTail: 'Live press conferences',
  },
  fr: {
    url: `${WHO_BASE_URL}/fr/news-room`,
    sourceLocale: 'fr',
    sectionHeading: 'Dernières informations',
    sectionTail: 'Conférences de presse',
  },
};

function resolveWhoNewsConfig(locale: string): { config: WhoNewsLocaleConfig; isFallback: boolean } {
  const normalized = String(locale || 'en').toLowerCase();

  if (normalized in WHO_NEWS_CONFIG) {
    return {
      config: WHO_NEWS_CONFIG[normalized],
      isFallback: false,
    };
  }

  return {
    config: WHO_NEWS_CONFIG.en,
    isFallback: true,
  };
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePublishedAtFromHref(href: string): string | null {
  const match = href.match(/\/(\d{2})-(\d{2})-(\d{4})-/);

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;

  return `${year}-${month}-${day}`;
}

function normalizeWhoUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) {
    return href;
  }

  return `${WHO_BASE_URL}${href.startsWith('/') ? href : `/${href}`}`;
}

function extractLatestNewsSection(html: string, config: WhoNewsLocaleConfig): string {
  const start = html.indexOf(config.sectionHeading);

  if (start < 0) {
    return html;
  }

  const end = html.indexOf(config.sectionTail, start);

  if (end < 0) {
    return html.slice(start);
  }

  return html.slice(start, end);
}

function parseWhoNewsItems(html: string, sourceLocale: 'en' | 'fr'): WhoNewsItem[] {
  const items: WhoNewsItem[] = [];
  const itemRegex =
    /<a href="([^"]+)" class="link-container" aria-label="([^"]+)" role="link">[\s\S]*?<span class="timestamp">([^<]+)<\/span>[\s\S]*?<div class="sf-tags-list-item">([^<]+)<\/div>[\s\S]*?<p class="heading text-underline">([^<]+)<\/p>/g;

  let match: RegExpExecArray | null = itemRegex.exec(html);

  while (match && items.length < WHO_NEWS_LIMIT) {
    const href = match[1];
    const ariaLabel = decodeHtmlEntities(match[2] || '');
    const type = decodeHtmlEntities(match[4] || '');
    const heading = decodeHtmlEntities(match[5] || ariaLabel);

    items.push({
      id: `${sourceLocale}:${href}`,
      title: heading || ariaLabel,
      publishedAt: parsePublishedAtFromHref(href),
      type,
      url: normalizeWhoUrl(href),
      sourceLocale,
    });

    match = itemRegex.exec(html);
  }

  return items;
}

export async function fetchWhoNews(requestedLocale: string): Promise<WhoNewsSnapshot> {
  const { config, isFallback } = resolveWhoNewsConfig(requestedLocale);
  const response = await fetch(config.url, {
    headers: {
      Accept: 'text/html',
    },
  });

  if (!response.ok) {
    throw new Error(`who_news_request_failed_${response.status}`);
  }

  const html = await response.text();
  const latestSection = extractLatestNewsSection(html, config);
  const items = parseWhoNewsItems(latestSection, config.sourceLocale);

  return {
    items,
    sourceLocale: config.sourceLocale,
    requestedLocale,
    isFallback,
  };
}
