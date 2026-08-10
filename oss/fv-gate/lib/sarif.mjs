// sarif.mjs — build a minimal SARIF 2.1.0 log from fv-gate results. New in this extraction (neither
// source script emitted SARIF) — additive, does not change proptests/coverage pass-fail semantics.

const SARIF_SCHEMA = 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json';

export function buildSarif({ proptestResults = [], coverageUnfloored = [] }) {
  const results = [];

  for (const r of proptestResults) {
    if (r.ok) continue;
    results.push({
      ruleId: 'fv-gate/proptest-failed',
      level: 'error',
      message: { text: r.spawnError ? `property file failed to spawn: ${r.spawnError}` : `property file exited ${r.status}` },
      locations: [{ physicalLocation: { artifactLocation: { uri: toPosix(r.file) } } }],
    });
  }

  for (const r of coverageUnfloored) {
    results.push({
      ruleId: `fv-gate/floor-${r.state}`,
      level: 'warning',
      message: { text: r.reason },
      locations: [{ physicalLocation: { artifactLocation: { uri: `${r.tool_id ?? r.name}.kernel.mjs` } } }],
    });
  }

  return {
    $schema: SARIF_SCHEMA,
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'fv-gate',
            informationUri: 'https://github.com/PostOakLabs/ainumbers',
            rules: [
              { id: 'fv-gate/proptest-failed', shortDescription: { text: 'A property-test floor file failed or crashed.' } },
              { id: 'fv-gate/floor-missing', shortDescription: { text: 'A live kernel has no property-test floor file.' } },
              { id: 'fv-gate/floor-stale', shortDescription: { text: 'A floor file\'s recorded digest no longer matches its kernel source.' } },
            ],
          },
        },
        results,
      },
    ],
  };
}

function toPosix(p) {
  return String(p).replace(/\\/g, '/');
}
