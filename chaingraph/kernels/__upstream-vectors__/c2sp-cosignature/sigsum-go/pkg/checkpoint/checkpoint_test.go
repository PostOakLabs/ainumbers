package checkpoint

import (
	"bytes"
	"fmt"
	"strings"
	"testing"

	"sigsum.org/sigsum-go/pkg/crypto"
	"sigsum.org/sigsum-go/pkg/types"
)

var testOrigin = "example.org/log"

var testTreeHead = types.TreeHead{
	Size:     10,
	RootHash: crypto.Hash{28, 14, 71}, // Base64 "HA5H"
}

var testSignedTreeHead = types.SignedTreeHead{
	TreeHead:  testTreeHead,
	Signature: crypto.Ed25519Signature{65, 5}, // Base64 "...EEF"
}
var testCheckpoint = Checkpoint{
	Origin:         testOrigin,
	SignedTreeHead: testSignedTreeHead,
	KeyId:          [4]byte{12, 64, 3, 4}, // Base64 "DEADB..."
}

var testCheckpointASCII = `example.org/log
10
HA5HAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=

— example.org/log DEADBEEFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
`

const validCheckpointASCII = `sigsum.org/v1/tree/e796172b92befd62d9dc67e41c2f5bc9d3100a3023b20b1ca40288dd1c679e69
10
HA5HAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=

— sigsum.org/v1/tree/e796172b92befd62d9dc67e41c2f5bc9d3100a3023b20b1ca40288dd1c679e69 gJ2ho0n8F8olcerUF1FFdv235A/5as/coWrpLrtE7ovMeP5whgwouYExowG/lTznxu6OUGjjt5yJQ6bXtTcf718MqAQ=
`

func TestCheckpointToASCII(t *testing.T) {
	buf := bytes.Buffer{}
	if err := testCheckpoint.ToASCII(&buf); err != nil {
		t.Fatal(err)
	}
	if got, want := buf.String(), testCheckpointASCII; got != want {
		t.Errorf("got checkpoint:\n%swant:\n%s", got, want)
	}
}

func TestCheckpointFromASCII(t *testing.T) {
	var cp Checkpoint
	if err := cp.FromASCII(bytes.NewBufferString(testCheckpointASCII)); err != nil {
		t.Fatal(err)
	}
	if cp != testCheckpoint {
		t.Errorf("FromASCII failed, got:\n%v,\nwanted:\n%v", cp, testCheckpoint)
	}
}

func TestCheckpointSigned(t *testing.T) {
	signer := crypto.NewEd25519Signer(&crypto.Ed25519PrivateKey{17})
	pub := signer.Public()
	origin := fmt.Sprintf("%s%x", types.CheckpointNamePrefix, pub.Hash())
	cp := Checkpoint{
		Origin: origin,
		KeyId:  NewLogKeyId(origin, &pub),
	}
	var err error
	cp.SignedTreeHead, err = testTreeHead.Sign(signer)

	if err != nil {
		t.Fatal(err)
	}
	buf := bytes.Buffer{}
	if err := cp.ToASCII(&buf); err != nil {
		t.Fatal(err)
	}
	if got, want := buf.String(), validCheckpointASCII; got != want {
		t.Errorf("got checkpoint:\n%swant:\n%s", got, want)
	}
}

func TestCheckpointVerify(t *testing.T) {
	// Key used to sign above checkpoint.
	signer := crypto.NewEd25519Signer(&crypto.Ed25519PrivateKey{17})
	pub := signer.Public()

	var validCheckpoint Checkpoint
	if err := validCheckpoint.FromASCII(bytes.NewBufferString(validCheckpointASCII)); err != nil {
		t.Fatal(err)
	}
	if err := validCheckpoint.Verify(&pub); err != nil {
		t.Fatal(err)
	}

	testInvalid := func(desc string, f func(cp *Checkpoint)) {
		cp := validCheckpoint
		f(&cp)
		if err := cp.Verify(&pub); err == nil {
			t.Errorf("%s: bad checkpoint not rejected", desc)
		}
	}

	testInvalid("bad origin", func(cp *Checkpoint) {
		cp.Origin += "x"
	})
	testInvalid("bad key id", func(cp *Checkpoint) {
		cp.KeyId[2] ^= 1
	})
	testInvalid("bad size", func(cp *Checkpoint) {
		cp.TreeHead.Size++
	})
	testInvalid("bad hash", func(cp *Checkpoint) {
		cp.TreeHead.RootHash[3] ^= 1
	})
	testInvalid("bad signature", func(cp *Checkpoint) {
		cp.Signature[4] ^= 1
	})
}

func TestCheckpointVerifyIgnoreExtraSignature(t *testing.T) {
	// Key used to sign above checkpoint.
	signer := crypto.NewEd25519Signer(&crypto.Ed25519PrivateKey{17})
	pub := signer.Public()

	paragraphs := strings.Split(validCheckpointASCII, "\n\n")
	if len(paragraphs) != 2 {
		t.Fatal("internal test error")
	}
	body := paragraphs[0]
	sigs := strings.Split(paragraphs[1], "\n")
	if len(sigs) != 2 || sigs[1] != "" {
		t.Fatalf("internal test error, sigs: %v", sigs)
	}
	validSig := sigs[0]
	// Ed25519 size
	exampleSig := "— example.org/log2 DEADBEEFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
	alienSig := "— example.org/log DEAD"
	badSig := "— example.org/log DEADB"

	for _, table := range []struct {
		sigs []string
		fail bool
	}{
		{sigs: []string{validSig}},
		{sigs: []string{validSig, alienSig}},
		{sigs: []string{validSig, alienSig}},
		{sigs: []string{exampleSig, validSig, alienSig}},
		{sigs: []string{exampleSig, validSig, alienSig, badSig}, fail: true},
	} {
		ascii := fmt.Sprintf("%s\n\n%s\n", body, strings.Join(table.sigs, "\n"))
		var cp Checkpoint
		err := cp.FromASCII(bytes.NewBufferString(ascii))
		if table.fail {
			if err == nil {
				t.Errorf("invalid checkpoint was accepted")
			}
			continue
		}
		if err != nil {
			t.Error(err)
			continue
		}

		if err := cp.Verify(&pub); err != nil {
			t.Error(err)
		}
	}
}

func TestCheckpointCosignVerify(t *testing.T) {
	signer := crypto.NewEd25519Signer(&crypto.Ed25519PrivateKey{17})
	pub := signer.Public()
	timestamp := uint64(1234)
	cosignature, err := testCheckpoint.Cosign(signer, timestamp)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := cosignature.Timestamp, timestamp; got != want {
		t.Errorf("unexpected cosignature timestamp: got %d, want %d", got, want)
	}
	if !testCheckpoint.VerifyCosignature(&pub, &cosignature) {
		t.Errorf("verifying cosignature failed")
	}

	keyName := "example.org/witness"
	cls := CosignatureLine{
		KeyName:     keyName,
		KeyId:       NewWitnessKeyId(keyName, &pub),
		Cosignature: cosignature,
	}
	var buf bytes.Buffer
	if err := cls.ToASCII(&buf); err != nil {
		t.Fatal(err)
	}
	t.Log(buf.String())
}

func TestCheckpointVerifyCosignatureByKey(t *testing.T) {
	// Second line was produced by the test above. First line has
	// a different keyid, third line has a different keyname,
	// fourth line a different signature size.
	input := `
— example.org/witness yX8uUAAAAAAAAATSftMzceM8zssdZ9jin9SjwIxzx9iADMf63VqirX2hafol9RsqNqbofIz0LVRqHXI2kpEBSki5RTXFtxz1vo9+Cg==
— example.org/witness ys8uUAAAAAAAAATSftMzceM8zssdZ9jin9SjwIxzx9iADMf63VqirX2hafol9RsqNqbofIz0LVRqHXI2kpEBSki5RTXFtxz1vo9+Cg==
— example.org/witness-2 ys8uUAAAAAAAAATSftMzceM8zssdZ9jin9SjwIxzx9iADMf63VqirX2hafol9RsqNqbofIz0LVRqHXI2kpEBSki5RTXFtxz1vo9+Cg==
— example.org/witness ys8uUAAAAAAAAATSftMzceM8zssdZ9jin9SjwIxzx9iADMf63VqirX2hafol9RsqNqbofIz0LVRqHXI2kpEBSki5RTXFtxz1vo9+CgXX
`[1:]
	cosignatures, err := CosignatureLinesFromASCII(bytes.NewBufferString(input))
	if err != nil {
		t.Fatal(err)
	}
	if got, want := len(cosignatures), 3; got != want {
		t.Errorf("unexpected number of cosignatures: got %d, want: %d", got, want)
	}
	signer := crypto.NewEd25519Signer(&crypto.Ed25519PrivateKey{17})
	pub := signer.Public()
	cosignature, err := testCheckpoint.VerifyCosignatureByKey(cosignatures, &pub)
	if err != nil {
		t.Fatal(err)
	}
	if got, want := cosignature.Timestamp, uint64(1234); got != want {
		t.Errorf("unexpected cosignature timestamp: got %d, want %d", got, want)
	}

	// Try invalidating the cosignature.
	cosignatures[1].Timestamp++
	_, err = testCheckpoint.VerifyCosignatureByKey(cosignatures, &pub)
	if err == nil {
		t.Errorf("bad cosignature not rejected")
	}
}

func TestGoSumDBCheckpoint(t *testing.T) {
	const (
		// Retrieved from https://sum.golang.org/latest, 2024-09-23
		dbCheckpoint = `go.sum database tree
30055305
mXfgRcJ0bG0j3CPdKwgGWtUzBUbX67saZGRmFuJGGsM=

— sum.golang.org Az3grpgEild5qw7+5dtV13Kf1C2Xurm8q4fhdxvcsDHnqNTaxL2AFjBY+2TyGKevucFcAAlWFJJYle3EJlDCrQ+y3A8=
`

		// Checksum db key, from
		// https://github.com/golang/go/blob/master/src/cmd/go/internal/modfetch/key.go.
		noteKey = "sum.golang.org+033de0ae+Ac4zctda0e5eza+HJyk9SxEdh+s3Ux18htTTAD8OuAn8"
	)
	paragraphSep := strings.Index(dbCheckpoint, "\n\n")
	if paragraphSep < 0 {
		t.Fatal("failed to split checkpoint")
	}
	dbCheckpointBody := dbCheckpoint[:paragraphSep+1]

	var nv NoteVerifier
	if err := nv.FromString(noteKey); err != nil {
		t.Fatal(err)
	}

	// Process checkpoint
	var cp Checkpoint
	if err := cp.fromASCIIWithKeyName(bytes.NewBufferString(dbCheckpoint), nv.Name); err != nil {
		t.Fatal(err)
	}
	if got, want := cp.Origin, "go.sum database tree"; got != want {
		t.Errorf("unexpected origin: got %s, want: %s", got, want)
	}
	if got, want := cp.KeyId, nv.KeyId; got != want {
		t.Errorf("unexpected keyId: got %x, want: %x", got, want)
	}

	checkpointASCII := cp.TreeHead.FormatCheckpoint(cp.Origin)
	if got, want := checkpointASCII, dbCheckpointBody; got != want {
		t.Errorf("formatting roundtrip failed: got:\n%q\nwant:\n%q", got, want)
	}
	if !nv.PublicKey.Verify([]byte(checkpointASCII), &cp.Signature) {
		t.Errorf("verifying checkpoint signature failed")
	}
}
