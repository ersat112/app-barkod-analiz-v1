import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { URLSearchParams } from 'node:url';

const FIREBASE_TOOLS_CONFIG_PATH = path.join(
  os.homedir(),
  '.config',
  'configstore',
  'firebase-tools.json'
);

function parseArgs(argv) {
  const args = {
    project: 'barkodanaliz-5ed4b',
    documentPath: 'runtime_config/market_gelsin_runtime',
    baseUrl: '',
    enabled: true,
    timeoutMs: 8000,
    version: Date.now(),
    dryRun: false,
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
      default:
        break;
    }
  }

  if (!args.baseUrl.trim()) {
    throw new Error('--base-url zorunlu');
  }

  return {
    ...args,
    baseUrl: args.baseUrl.trim().replace(/\/+$/g, ''),
  };
}

function getFirebaseRefreshToken() {
  if (!fs.existsSync(FIREBASE_TOOLS_CONFIG_PATH)) {
    throw new Error(`firebase-tools config bulunamadi: ${FIREBASE_TOOLS_CONFIG_PATH}`);
  }

  const raw = JSON.parse(fs.readFileSync(FIREBASE_TOOLS_CONFIG_PATH, 'utf8'));
  const refreshToken = raw?.tokens?.refresh_token;

  if (!refreshToken) {
    throw new Error('firebase-tools refresh token bulunamadi. npx firebase-tools login ile oturum acin.');
  }

  return refreshToken;
}

async function getAccessToken(refreshToken) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: '563584335869-l6f2s0c6q8q5q9q7e0o55f2l8mq4c2m3.apps.googleusercontent.com',
      client_secret: 'j9iY8wXW2u8hJ4Jbq6P7Q3fQ',
    }),
  });

  if (!response.ok) {
    throw new Error(`OAuth token alinamadi: ${response.status} ${await response.text()}`);
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
  const refreshToken = getFirebaseRefreshToken();
  const accessToken = await getAccessToken(refreshToken);
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
