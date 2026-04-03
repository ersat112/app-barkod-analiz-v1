import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { URL, URLSearchParams } from 'node:url';

const FIREBASE_TOOLS_CONFIG_PATH = path.join(
  os.homedir(),
  '.config',
  'configstore',
  'firebase-tools.json'
);
const FIREBASE_TOOLS_CLIENT_ID =
  '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_TOOLS_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

function parseArgs(argv) {
  const args = {
    project: 'barkodanaliz-5ed4b',
    documentPath: 'runtime_config/market_gelsin_runtime',
    baseUrl: '',
    enabled: true,
    timeoutMs: 8000,
    version: Date.now(),
    dryRun: false,
    fromEnv: false,
    allowLoopback: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case '--project':
        args.project = next;
        index += 1;
        break;
      case '--document':
        args.documentPath = next;
        index += 1;
        break;
      case '--base-url':
        args.baseUrl = next;
        index += 1;
        break;
      case '--enabled':
        args.enabled = ['1', 'true', 'yes', 'on'].includes(String(next).toLowerCase());
        index += 1;
        break;
      case '--timeout-ms':
        args.timeoutMs = Number(next) || args.timeoutMs;
        index += 1;
        break;
      case '--version':
        args.version = Number(next) || args.version;
        index += 1;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--from-env':
        args.fromEnv = true;
        break;
      case '--allow-loopback':
        args.allowLoopback = true;
        break;
      default:
        break;
    }
  }

  const envBaseUrl = readEnvValue('EXPO_PUBLIC_MARKET_GELSIN_API_URL');
  const envEnabled = readEnvValue('EXPO_PUBLIC_MARKET_GELSIN_ENABLED');
  const envTimeoutMs = readEnvValue('EXPO_PUBLIC_MARKET_GELSIN_TIMEOUT_MS');

  if (args.fromEnv) {
    if (!args.baseUrl.trim() && envBaseUrl) {
      args.baseUrl = envBaseUrl;
    }

    if (!argv.includes('--enabled') && envEnabled) {
      args.enabled = ['1', 'true', 'yes', 'on'].includes(envEnabled.toLowerCase());
    }

    if (!argv.includes('--timeout-ms') && envTimeoutMs) {
      args.timeoutMs = Number(envTimeoutMs) || args.timeoutMs;
    }
  }

  const normalizedBaseUrl = args.baseUrl.trim().replace(/\/+$/g, '');

  if (args.enabled && !normalizedBaseUrl) {
    throw new Error('--base-url zorunlu (veya --from-env ile .env icinde EXPO_PUBLIC_MARKET_GELSIN_API_URL tanimli olmali)');
  }

  if (!args.allowLoopback && isLoopbackUrl(normalizedBaseUrl) && args.enabled) {
    throw new Error(
      'Loopback URL release runtime icin guvensiz. Yalnizca lokal test icin kullanacaksaniz --allow-loopback ekleyin.'
    );
  }

  return {
    ...args,
    baseUrl: normalizedBaseUrl,
  };
}

function readEnvValue(key) {
  const envPath = path.join(process.cwd(), '.env');

  if (!fs.existsSync(envPath)) {
    return '';
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  const match = raw
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${key}=`));

  if (!match) {
    return '';
  }

  return match.slice(key.length + 1).trim();
}

function isLoopbackUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return ['127.0.0.1', 'localhost', '10.0.2.2'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

function getFirebaseAuthState() {
  if (!fs.existsSync(FIREBASE_TOOLS_CONFIG_PATH)) {
    throw new Error(`firebase-tools config bulunamadi: ${FIREBASE_TOOLS_CONFIG_PATH}`);
  }

  return JSON.parse(fs.readFileSync(FIREBASE_TOOLS_CONFIG_PATH, 'utf8'));
}

function getAccessToken() {
  const authState = getFirebaseAuthState();
  const accessToken = authState?.tokens?.access_token;
  const refreshToken = authState?.tokens?.refresh_token;
  const expiresAt = Number(authState?.tokens?.expires_at ?? 0);

  if (accessToken && Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000) {
    return Promise.resolve(accessToken);
  }

  if (!refreshToken) {
    throw new Error(
      'firebase-tools tokenlari bulunamadi. npx firebase-tools login ile oturum acin.'
    );
  }

  return refreshAccessToken(refreshToken);
}

async function refreshAccessToken(refreshToken) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: FIREBASE_TOOLS_CLIENT_ID,
      client_secret: FIREBASE_TOOLS_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OAuth token alinamadi: ${response.status} ${await response.text()}`
    );
  }

  const payload = await response.json();

  if (!payload.access_token) {
    throw new Error('OAuth cevabinda access_token yok');
  }

  return payload.access_token;
}

function buildFirestoreDocumentBody(input) {
  return {
    fields: {
      version: { integerValue: String(Math.max(1, Math.round(input.version))) },
      enabled: { booleanValue: Boolean(input.enabled) },
      baseUrl: { stringValue: input.baseUrl },
      timeoutMs: { integerValue: String(Math.max(3000, Math.round(input.timeoutMs))) },
      updatedAt: { stringValue: new Date().toISOString() },
    },
  };
}

async function seedRuntimeDocument(input) {
  const accessToken = await getAccessToken();
  const updateMask = [
    'version',
    'enabled',
    'baseUrl',
    'timeoutMs',
    'updatedAt',
  ]
    .map((field) => `updateMask.fieldPaths=${encodeURIComponent(field)}`)
    .join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    input.project
  )}/databases/(default)/documents/${input.documentPath}?${updateMask}`;
  const body = buildFirestoreDocumentBody(input);

  if (input.dryRun) {
    console.log(JSON.stringify({ url, body }, null, 2));
    return;
  }

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Firestore runtime seed basarisiz: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  console.log(
    JSON.stringify(
      {
        name: payload.name,
        updateTime: payload.updateTime,
      },
      null,
      2
    )
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await seedRuntimeDocument(args);
}

main().catch((error) => {
  console.error('[seed-market-gelsin-runtime]', error instanceof Error ? error.message : error);
  process.exit(1);
});
