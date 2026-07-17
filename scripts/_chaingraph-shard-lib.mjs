// scripts/_chaingraph-shard-lib.mjs — shared byte-exact array-splitting helpers
// used by migrate-chaingraph-shards.mjs (one-time) and assemble-chaingraph.mjs
// (ongoing generator). Splits a top-level JSON array on commas at depth 0,
// string/escape aware, so element text is preserved byte-for-byte.

export function findTopLevelArrayBounds(raw, key) {
  const marker = `\n  "${key}": [`
  const idx = raw.indexOf(marker)
  if (idx < 0) throw new Error('top-level marker not found: ' + key)
  const openIdx = idx + marker.length - 1 // index of '['
  let depth = 0, inStr = false, esc = false
  for (let i = openIdx; i < raw.length; i++) {
    const c = raw[i]
    if (inStr) {
      if (esc) { esc = false }
      else if (c === '\\') { esc = true }
      else if (c === '"') { inStr = false }
      continue
    } else {
      if (c === '"') { inStr = true; continue }
      if (c === '[' || c === '{') depth++
      else if (c === ']' || c === '}') {
        depth--
        if (depth === 0) return { openIdx, closeIdx: i }
      }
    }
  }
  throw new Error('no matching close bracket for ' + key)
}

export function splitTopLevelElements(inner) {
  let depth = 0, inStr = false, esc = false
  const segs = []
  let last = 0
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]
    if (inStr) {
      if (esc) { esc = false }
      else if (c === '\\') { esc = true }
      else if (c === '"') { inStr = false }
      continue
    } else {
      if (c === '"') { inStr = true; continue }
      if (c === '{' || c === '[') depth++
      else if (c === '}' || c === ']') depth--
      else if (c === ',' && depth === 0) {
        segs.push(inner.slice(last, i))
        last = i + 1
      }
    }
  }
  segs.push(inner.slice(last))
  return segs
}
