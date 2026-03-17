#!/usr/bin/env node
/**
 * Setup Auth Profile Helper
 *
 * Standalone script for setup.sh to create an api_key provider profile.
 * Follows the exact same data structures and merge logic as F062's
 * provider-profiles.ts (packages/api/src/config/provider-profiles.ts).
 *
 * Design choices aligned with F062:
 * - File format: provider-profiles.json (meta) + provider-profiles.secrets.local.json (secrets)
 * - Default profile: { id: 'anthropic-subscription-default', mode: 'subscription' }
 * - Merge-not-overwrite: reads existing files, appends new profile
 * - Profile ID format: 'profile-setup-<timestamp>'
 * - Secrets file permissions: 0o600
 *
 * Why standalone (not importing from dist)?
 * setup.sh runs before `pnpm build`, so compiled dist is not available.
 * This script replicates the minimal subset of provider-profiles.ts logic.
 *
 * Security:
 * - API key is read from stdin (never via argv, avoids /proc exposure)
 * - Worktree root resolution is handled by setup.sh before calling this script
 *
 * Usage:
 *   echo "$API_KEY" | node scripts/setup-auth-profile.mjs <baseUrl> <metaPath> <secretsPath>
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

// --- Constants matching provider-profiles.ts ---
const DEFAULT_SUBSCRIPTION_PROFILE_ID = 'anthropic-subscription-default';

function createDefaultMeta(now) {
  return {
    version: 1,
    providers: {
      anthropic: {
        activeProfileId: DEFAULT_SUBSCRIPTION_PROFILE_ID,
        profiles: [
          {
            id: DEFAULT_SUBSCRIPTION_PROFILE_ID,
            provider: 'anthropic',
            name: '自有订阅',
            mode: 'subscription',
            createdAt: now,
            updatedAt: now,
          },
        ],
      },
    },
  };
}

function createDefaultSecrets() {
  return { version: 1, providers: { anthropic: {} } };
}

function readJsonOrNull(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

// --- Main ---
const baseUrl = process.argv[2]?.replace(/\/+$/, '');
const metaPath = process.argv[3];
const secretsPath = process.argv[4];

if (!baseUrl || !metaPath || !secretsPath) {
  console.error('Usage: echo "$API_KEY" | node setup-auth-profile.mjs <baseUrl> <metaPath> <secretsPath>');
  process.exit(1);
}

// Read API key from stdin (security: not via argv)
const apiKey = readFileSync('/dev/stdin', 'utf-8').trim();
if (!apiKey) {
  console.error('Error: API key is empty');
  process.exit(1);
}

const now = new Date().toISOString();
const profileId = `profile-setup-${Date.now()}`;

// Read existing or create default (merge, don't overwrite — matching provider-profiles.ts normalizeMeta)
let meta = readJsonOrNull(metaPath);
if (!meta || meta.version !== 1 || !meta.providers?.anthropic?.profiles) {
  meta = createDefaultMeta(now);
}

let secrets = readJsonOrNull(secretsPath);
if (!secrets || secrets.version !== 1 || !secrets.providers?.anthropic) {
  secrets = createDefaultSecrets();
}

// Add new profile (matching createProviderProfile logic in provider-profiles.ts)
meta.providers.anthropic.profiles.push({
  id: profileId,
  provider: 'anthropic',
  name: 'API Key (setup.sh)',
  mode: 'api_key',
  baseUrl,
  createdAt: now,
  updatedAt: now,
});
meta.providers.anthropic.activeProfileId = profileId;
secrets.providers.anthropic[profileId] = { apiKey };

// Write files (matching writeJson pattern in provider-profiles.ts)
mkdirSync(dirname(metaPath), { recursive: true });
writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`, 'utf-8');
writeFileSync(secretsPath, `${JSON.stringify(secrets, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 });
