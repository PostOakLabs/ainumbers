// check-catalog-urls.test.mjs -- paired red-proof for CATALOG-DEADURL-GATE-1
// (SO #34c / #40b -- a new gate proves red before green, in-repo). RED: a
// planted catalog entry whose metadata.url points at a file absent from
// disk (the XSRF-4 shape). GREEN: an entry whose url resolves, an entry with
// no url at all (the honest-absence case), and a malformed base_url mismatch.
import { findBrokenUrls } from './check-catalog-urls.mjs';

const failures = [];
const check = (name, ok, detail) => {
  console.log((ok ? '  ok ' : '  RED ') + name + (detail ? '  -- ' + detail : ''));
  if (!ok) failures.push(name);
};

// A fake filesystem: only these repo-relative paths "exist".
const fakeExists = (relPath) => relPath === 'tools/01-real-tool.html';

console.log('CONTROL 1 RED -- a catalog entry whose url points at a file absent from disk:');
const catalogWithDeadUrl = {
  base_url: 'https://ainumbers.co',
  tools: [
    { name: 'real_tool', metadata: { url: 'https://ainumbers.co/tools/01-real-tool.html' } },
    { name: 'dead_tool', metadata: { url: 'https://ainumbers.co/tools/520-c2pa-manifest-validator.html' } },
  ],
};
const r1 = findBrokenUrls(catalogWithDeadUrl, fakeExists);
check('exactly 1 broken entry found, naming dead_tool',
  r1.length === 1 && r1[0].name === 'dead_tool',
  JSON.stringify(r1));

console.log('CONTROL 2 GREEN -- an entry with NO url (honest absence) is never flagged:');
const catalogPageless = {
  base_url: 'https://ainumbers.co',
  tools: [
    { name: 'real_tool', metadata: { url: 'https://ainumbers.co/tools/01-real-tool.html' } },
    { name: 'pageless_kernel_shard', metadata: {} },
  ],
};
const r2 = findBrokenUrls(catalogPageless, fakeExists);
check('0 broken entries -- omitted url is not a violation', r2.length === 0, JSON.stringify(r2));

console.log('CONTROL 3 GREEN -- a chaingraph-page url that resolves is never flagged:');
const cgExists = (relPath) => relPath === 'chaingraph/art-123-c2pa-manifest-validator.html';
const catalogCg = {
  base_url: 'https://ainumbers.co',
  tools: [{ name: 'cg_tool', metadata: { url: 'https://ainumbers.co/chaingraph/art-123-c2pa-manifest-validator.html' } }],
};
const r3 = findBrokenUrls(catalogCg, cgExists);
check('0 broken entries -- chaingraph page resolves', r3.length === 0, JSON.stringify(r3));

console.log('CONTROL 4 RED -- a url that does not even start with base_url is flagged, not silently skipped:');
const catalogWrongDomain = {
  base_url: 'https://ainumbers.co',
  tools: [{ name: 'off_domain', metadata: { url: 'https://example.com/tools/x.html' } }],
};
const r4 = findBrokenUrls(catalogWrongDomain, fakeExists);
check('flagged with the base_url-mismatch reason',
  r4.length === 1 && r4[0].reason === 'url does not start with base_url',
  JSON.stringify(r4));

if (failures.length) {
  console.error('\nFAILED (' + failures.length + '): ' + failures.join('; '));
  process.exit(1);
}
console.log('\nAll controls passed.');
process.exit(0);
