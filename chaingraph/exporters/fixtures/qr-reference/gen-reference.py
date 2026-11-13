# gen-reference.py - regenerate vectors.json from upstream's own encoder.
#
# This script is NOT run in CI and is not imported by anything. It documents exactly how
# vectors.json was produced, so anyone can reproduce the fixture from the upstream source.
#
#   1. Fetch python/qrcodegen.py from nayuki/QR-Code-generator at tag v1.8.0 into a new,
#      empty directory (it is third-party code: keep it out of this repository).
#   2. Confirm its sha256 equals UPSTREAM_SHA256 below.
#   3. python -I gen-reference.py <path-to-qrcodegen.py> > vectors.json
#
# The reference is called in byte mode, with ECC boost off and automatic mask selection,
# which are the three choices exporters/qr.mjs makes. Standard library only.
import hashlib, importlib.util, json, sys

UPSTREAM_REPO = "https://github.com/nayuki/QR-Code-generator"
UPSTREAM_TAG = "v1.8.0"
UPSTREAM_FILE = "python/qrcodegen.py"
UPSTREAM_SHA256 = "b089855caf16185c61421ea4927c1b213cf9468940d71fa8ab11ef83662dcc84"

path = sys.argv[1]
with open(path, "rb") as f:
    actual = hashlib.sha256(f.read()).hexdigest()
if actual != UPSTREAM_SHA256:
    sys.exit("upstream file sha256 mismatch: got " + actual)

spec = importlib.util.spec_from_file_location("qrcodegen_ref", path)
mod = importlib.util.module_from_spec(spec)
sys.modules["qrcodegen_ref"] = mod
spec.loader.exec_module(mod)
Q = mod.QrCode
ECL = {"L": Q.Ecc.LOW, "M": Q.Ecc.MEDIUM, "Q": Q.Ecc.QUARTILE, "H": Q.Ecc.HIGH}


def filler(length, seed):
    # Deterministic printable ASCII (codes 33..122) from a 32-bit linear congruential generator.
    x = seed & 0xFFFFFFFF
    out = []
    for _ in range(length):
        x = (x * 1664525 + 1013904223) & 0xFFFFFFFF
        out.append(chr(33 + (x >> 24) % 90))
    return "".join(out)


LENGTHS = [1, 7, 14, 17, 20, 32, 53, 78, 106, 134, 180, 230, 271, 321, 400, 468, 520, 586, 700, 800,
           858, 1000, 1200, 1273, 1500, 1663, 2000, 2331, 2500, 2953]

cases = []
url = "https://ainumbers.co/chaingraph/verify?hash=" + "a" * 64
for e in "LMQH":
    cases.append({"id": "verify-url/" + e, "ecl": e, "text": url})
for e in "LMQH":
    for n in LENGTHS:
        cases.append({"id": "len%d/%s" % (n, e), "ecl": e, "text": filler(n, n * 31 + ord(e))})
cases.append({"id": "utf8/M", "ecl": "M",
              "text": "Zahlung €1.250,00 – 日本語 \U0001F512"})

vectors = []
for c in cases:
    data = c["text"].encode("utf-8")
    v = {"id": c["id"], "ecl": c["ecl"], "bytes": len(data), "text": c["text"]}
    try:
        qr = Q.encode_segments([mod.QrSegment.make_bytes(data)], ECL[c["ecl"]], boostecl=False)
    except mod.DataTooLongError:
        v["expect"] = "refuse"
        vectors.append(v)
        continue
    n = qr.get_size()
    rows = ["".join("1" if qr.get_module(x, y) else "0" for x in range(n)) for y in range(n)]
    v["expect"] = "matrix"
    v["version"] = qr.get_version()
    v["mask"] = qr.get_mask()
    v["size"] = n
    # sha256 over the rows joined by a single line feed; "1" is a dark module, row 0 is the top.
    v["matrix_sha256"] = hashlib.sha256("\n".join(rows).encode("ascii")).hexdigest()
    vectors.append(v)

json.dump({
    "source": {"repo": UPSTREAM_REPO, "tag": UPSTREAM_TAG, "file": UPSTREAM_FILE, "sha256": UPSTREAM_SHA256,
               "licence": "MIT", "call": "QrCode.encode_segments([QrSegment.make_bytes(utf8)], ecl, boostecl=False)"},
    "matrix_digest": "sha256 of rows joined by LF; '1' dark, '0' light; row 0 is the top row",
    "vectors": vectors,
}, sys.stdout, ensure_ascii=True, indent=1)
sys.stdout.write("\n")
