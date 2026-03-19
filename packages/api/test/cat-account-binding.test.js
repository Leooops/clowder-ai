import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

async function seedTemplate(projectRoot, mutateTemplate) {
  const templatePath = join(process.cwd(), '..', '..', 'cat-template.json');
  const template = JSON.parse(await readFile(templatePath, 'utf-8'));
  if (mutateTemplate) mutateTemplate(template);
  await writeFile(join(projectRoot, 'cat-template.json'), `${JSON.stringify(template, null, 2)}\n`, 'utf-8');
}

describe('cat account binding', () => {
  it('treats bootstrapped seed cats as inheriting the active bootstrap binding', async () => {
    const { bootstrapCatCatalog, resolveCatCatalogPath } = await import('../dist/config/cat-catalog-store.js');
    const { loadCatConfig, toAllCatConfigs } = await import('../dist/config/cat-config-loader.js');
    const { resolveBoundAccountRefForCat } = await import('../dist/config/cat-account-binding.js');
    const projectRoot = await mkdtemp(join(tmpdir(), 'cat-account-binding-inherited-'));

    try {
      await seedTemplate(projectRoot);
      bootstrapCatCatalog(projectRoot, join(projectRoot, 'cat-template.json'));
      const catConfig = toAllCatConfigs(loadCatConfig(resolveCatCatalogPath(projectRoot))).codex;
      assert.ok(catConfig, 'codex should be present in bootstrapped runtime catalog');
      assert.equal(resolveBoundAccountRefForCat(projectRoot, 'codex', catConfig), undefined);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('returns explicit seed providerProfileId markers after bootstrap', async () => {
    const { bootstrapCatCatalog, resolveCatCatalogPath } = await import('../dist/config/cat-catalog-store.js');
    const { loadCatConfig, toAllCatConfigs } = await import('../dist/config/cat-config-loader.js');
    const { resolveBoundAccountRefForCat } = await import('../dist/config/cat-account-binding.js');
    const projectRoot = await mkdtemp(join(tmpdir(), 'cat-account-binding-explicit-'));

    try {
      await seedTemplate(projectRoot, (template) => {
        const codexBreed = template.breeds.find((breed) => breed.catId === 'codex');
        if (!codexBreed) throw new Error('codex breed missing from template');
        codexBreed.variants[0].providerProfileId = 'codex-pinned';
      });
      bootstrapCatCatalog(projectRoot, join(projectRoot, 'cat-template.json'));
      const catConfig = toAllCatConfigs(loadCatConfig(resolveCatCatalogPath(projectRoot))).codex;
      assert.ok(catConfig, 'codex should be present in bootstrapped runtime catalog');
      assert.equal(resolveBoundAccountRefForCat(projectRoot, 'codex', catConfig), 'codex-pinned');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
