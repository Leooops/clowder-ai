#!/usr/bin/env node

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function usage() {
  console.error(`Usage:
  node scripts/install-auth-config.mjs env-apply --env-file FILE [--set KEY=VALUE]... [--delete KEY]...
  node scripts/install-auth-config.mjs claude-profile set --project-dir DIR --api-key KEY [--base-url URL] [--model MODEL]
  node scripts/install-auth-config.mjs claude-profile remove --project-dir DIR`);
  process.exit(1);
}

function parseArgs(argv) {
  const positionals = [];
  const values = new Map();

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      usage();
    }
    if (!values.has(key)) {
      values.set(key, []);
    }
    values.get(key).push(next);
    index += 1;
  }

  return { positionals, values };
}

function getRequired(values, key) {
  const value = values.get(key)?.[0];
  if (!value) {
    usage();
  }
  return value;
}

function getOptional(values, key, fallback = '') {
  return values.get(key)?.[0] ?? fallback;
}

function envQuote(value) {
  const stringValue = String(value);
  if (!stringValue.includes("'")) {
    return `'${stringValue}'`;
  }
  return `"${stringValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function applyEnvChanges(envFile, setPairs, deleteKeys) {
  const existing = existsSync(envFile)
    ? readFileSync(envFile, 'utf8').split(/\r?\n/).filter((line, index, lines) => !(index === lines.length - 1 && line === ''))
    : [];
  const setMap = new Map();
  for (const pair of setPairs) {
    const separator = pair.indexOf('=');
    if (separator <= 0) {
      usage();
    }
    setMap.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  const deleteSet = new Set(deleteKeys);
  const filtered = existing.filter((line) => {
    const separator = line.indexOf('=');
    if (separator === -1) {
      return true;
    }
    const key = line.slice(0, separator);
    return !deleteSet.has(key) && !setMap.has(key);
  });
  for (const [key, value] of setMap.entries()) {
    filtered.push(`${key}=${envQuote(value)}`);
  }
  writeFileSync(envFile, filtered.length > 0 ? `${filtered.join('\n')}\n` : '', 'utf8');
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeClaudeProfile(projectDir, apiKey, baseUrl, model) {
  const profileDir = path.join(projectDir, '.cat-cafe');
  mkdirSync(profileDir, { recursive: true });
  const profileFile = path.join(profileDir, 'provider-profiles.json');
  const secretsFile = path.join(profileDir, 'provider-profiles.secrets.local.json');
  const profileId = 'installer-managed';
  const now = new Date().toISOString();
  const profiles = readJson(profileFile, { version: 1, providers: {} });
  const secrets = readJson(secretsFile, { version: 1, providers: {} });
  const anthropicProfiles = profiles.providers.anthropic ?? { profiles: [] };
  const nextProfiles = (anthropicProfiles.profiles ?? []).filter((profile) => profile.id !== profileId);
  nextProfiles.push({
    id: profileId,
    provider: 'anthropic',
    name: 'Installer API Key',
    mode: 'api_key',
    baseUrl: baseUrl || 'https://api.anthropic.com',
    createdAt: now,
    updatedAt: now,
    ...(model ? { modelOverride: model } : {}),
  });
  profiles.providers.anthropic = {
    ...anthropicProfiles,
    activeProfileId: profileId,
    profiles: nextProfiles,
  };
  secrets.providers.anthropic = {
    ...(secrets.providers.anthropic ?? {}),
    [profileId]: { apiKey },
  };
  writeFileSync(profileFile, JSON.stringify(profiles));
  writeFileSync(secretsFile, JSON.stringify(secrets));
  chmodSync(secretsFile, 0o600);
}

function removeClaudeProfile(projectDir) {
  const profileDir = path.join(projectDir, '.cat-cafe');
  const profileFile = path.join(profileDir, 'provider-profiles.json');
  const secretsFile = path.join(profileDir, 'provider-profiles.secrets.local.json');
  const profileId = 'installer-managed';
  const profiles = readJson(profileFile, null);
  const secrets = readJson(secretsFile, null);
  if (!profiles?.providers?.anthropic) {
    return;
  }
  const anthropicProfiles = profiles.providers.anthropic;
  const nextProfiles = (anthropicProfiles.profiles ?? []).filter((profile) => profile.id !== profileId);
  profiles.providers.anthropic = {
    ...anthropicProfiles,
    profiles: nextProfiles,
    ...(anthropicProfiles.activeProfileId === profileId ? { activeProfileId: nextProfiles[0]?.id ?? '' } : {}),
  };
  if (secrets?.providers?.anthropic?.[profileId]) {
    delete secrets.providers.anthropic[profileId];
  }
  writeFileSync(profileFile, JSON.stringify(profiles));
  if (secrets) {
    writeFileSync(secretsFile, JSON.stringify(secrets));
  }
}

const { positionals, values } = parseArgs(process.argv.slice(2));
if (positionals[0] === 'env-apply') {
  applyEnvChanges(getRequired(values, 'env-file'), values.get('set') ?? [], values.get('delete') ?? []);
  process.exit(0);
}

if (positionals[0] === 'claude-profile' && positionals[1] === 'set') {
  writeClaudeProfile(
    getRequired(values, 'project-dir'),
    getRequired(values, 'api-key'),
    getOptional(values, 'base-url', 'https://api.anthropic.com'),
    getOptional(values, 'model', ''),
  );
  process.exit(0);
}

if (positionals[0] === 'claude-profile' && positionals[1] === 'remove') {
  removeClaudeProfile(getRequired(values, 'project-dir'));
  process.exit(0);
}

usage();
