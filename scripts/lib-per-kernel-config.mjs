// PER-KERNEL-CONFIG-SHARD-1: per-kernel entries live in sibling files next to the kernel
// instead of in two shared keyed maps that every kernel PR edited (merge-conflict hot spots).
//
//   chaingraph/kernels/<kernel-id>.mutation.json   -> merged over mutation-tiers.config.json
//   chaingraph/kernels/<bundle-stem>.authorship.json -> merged over scripts/original-authorship-bundle-allowlist.json
//
// The shared configs keep thresholds, defaults and meta comments only. An entry present in
// BOTH a config map and a sibling is a refusal (never a silent precedence), so a half-moved
// entry cannot drift. Unknown sibling keys are a refusal too (a typo must not be a no-op).
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// sibling key -> mutation-tiers.config.json map it feeds
export const MUTATION_SIBLING_FIELDS = {
  namedLead: 'namedLeads',
  kernelTimeoutSeconds: 'kernelTimeoutSeconds',
  mutateSurfaceSplit: 'mutateSurfaceSplits',
  excluded: 'excludedKernels',
  fixtureRidden: 'fixtureRidden',
  hookSkip: 'hookSkipKernels',
};

const MUTATION_SUFFIX = '.mutation.json';
const AUTHORSHIP_SUFFIX = '.authorship.json';

function siblings(dir, suffix) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(suffix)).sort();
}

function readSibling(file) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`${file}: invalid JSON (${e.message})`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${file}: must be a JSON object`);
  }
  return parsed;
}

/**
 * mergeMutationSiblings — returns a NEW config with every `<id>.mutation.json` sibling in
 * `kernelsDir` merged into the matching per-kernel map. Throws on an unknown key or on an
 * id that is also still present in the legacy map.
 */
export function mergeMutationSiblings(config, kernelsDir) {
  const merged = { ...config };
  for (const map of Object.values(MUTATION_SIBLING_FIELDS)) merged[map] = { ...(config[map] || {}) };
  for (const f of siblings(kernelsDir, MUTATION_SUFFIX)) {
    const id = f.slice(0, -MUTATION_SUFFIX.length);
    const sib = readSibling(path.join(kernelsDir, f));
    for (const [key, value] of Object.entries(sib)) {
      const map = MUTATION_SIBLING_FIELDS[key];
      if (!map) {
        throw new Error(`${f}: unknown key "${key}" (allowed: ${Object.keys(MUTATION_SIBLING_FIELDS).join(', ')})`);
      }
      if (Object.prototype.hasOwnProperty.call(merged[map], id)) {
        throw new Error(`${f}: "${id}" is already present in mutation-tiers.config.json ${map}; remove the legacy key (an entry in both places is refused)`);
      }
      merged[map][id] = value;
    }
  }
  return merged;
}

/**
 * loadOriginalAuthorshipAllowlist — scripts/original-authorship-bundle-allowlist.json plus
 * every `chaingraph/kernels/<stem>.authorship.json` sibling, keyed as
 * `chaingraph/kernels/<stem>.mjs` (the bundle file the sibling describes).
 */
export function loadOriginalAuthorshipAllowlist(root) {
  const legacyPath = path.join(root, 'scripts', 'original-authorship-bundle-allowlist.json');
  const out = existsSync(legacyPath) ? JSON.parse(readFileSync(legacyPath, 'utf8')) : {};
  const kernelsDir = path.join(root, 'chaingraph', 'kernels');
  for (const f of siblings(kernelsDir, AUTHORSHIP_SUFFIX)) {
    const rel = `chaingraph/kernels/${f.slice(0, -AUTHORSHIP_SUFFIX.length)}.mjs`;
    if (Object.prototype.hasOwnProperty.call(out, rel)) {
      throw new Error(`${f}: "${rel}" is already present in original-authorship-bundle-allowlist.json; remove the legacy key (an entry in both places is refused)`);
    }
    out[rel] = readSibling(path.join(kernelsDir, f));
  }
  return out;
}
