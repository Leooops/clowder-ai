import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const { resolveCmdShimScript } = await import('../dist/utils/cli-spawn-win.js');

test('resolveCmdShimScript supports %dp0 shims and keeps scanning where results until one resolves', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'cli-spawn-win-'));
  const originalPath = process.env.PATH;
  const fakeBin = join(tempRoot, 'bin');
  const badShimDir = join(tempRoot, 'bad');
  const goodShimDir = join(tempRoot, 'good');
  const commandName = 'fake-cmd-scan';

  mkdirSync(fakeBin, { recursive: true });
  mkdirSync(badShimDir, { recursive: true });
  mkdirSync(join(goodShimDir, 'node_modules', 'pkg'), { recursive: true });

  const badCmd = join(badShimDir, `${commandName}.cmd`);
  const goodCmd = join(goodShimDir, `${commandName}.cmd`);
  const goodScript = join(goodShimDir, 'node_modules', 'pkg', 'cli.js');
  const whereScript = join(fakeBin, 'where');

  writeFileSync(badCmd, '@"%dp0\\missing\\cli.js" %*\n', 'utf8');
  writeFileSync(goodCmd, '@"%dp0\\node_modules\\pkg\\cli.js" %*\n', 'utf8');
  writeFileSync(goodScript, 'console.log("ok");\n', 'utf8');
  writeFileSync(whereScript, `#!/bin/sh\nprintf '%s\n%s\n' '${badCmd}' '${goodCmd}'\n`, 'utf8');
  chmodSync(whereScript, 0o755);

  try {
    process.env.PATH = `${fakeBin}:${originalPath ?? ''}`;
    const resolved = resolveCmdShimScript(commandName);
    assert.equal(resolved, goodScript);
  } finally {
    process.env.PATH = originalPath;
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
