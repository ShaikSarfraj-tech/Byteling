# Go 1.27 finally fixes encoding/json

News/explainer short (~51s). Voice: Kokoro `af_heart`. No music; voice + subtle non-musical SFX only.

**[0.2s] Hook**  
Go's JSON package has been quietly hiding bugs for years. Go 1.27 finally fixes it.

**[6.8s] json/v2 is generally available**  
Meet json/v2, now generally available.

**[9.9s] Problem 1: case-insensitive field matching**  
Problem one. The old package matched field names case insensitively. So a wrong key could silently fill your field. V2 needs an exact match.

**[19.4s] Problem 2: duplicate keys**  
Problem two. Duplicate keys. V1 silently accepted them. V2 returns an error.

**[25.5s] Problem 3: nil slices marshal as null**  
Problem three. A nil slice was written as null, and broke your front end. V2 writes an empty array.

**[32.0s] Performance**  
It's also faster. Early benchmarks report decoding around twice as fast.

**[36.8s] Compatibility**  
The best part? Your old imports still work. The classic package now runs on the new engine, with the old behavior.

**[43.9s] Takeaway**  
So upgrade, then move to v2 one package at a time. Strict by default beats surprising by default.

## Fact check (researched 2026-11-12)
Behaviour differences were checked against the Go source itself (`src/encoding/json/v2_options.go` on `release-branch.go1.27`, which documents every v1-vs-v2 difference):
- v1 matches struct fields with a **case-insensitive** name match; v2 uses an **exact, case-sensitive** match (option `MatchCaseInsensitiveNames` restores v1).
- v1 **permits duplicate names** in a JSON object; in v2 they are an **error** (`jsontext.AllowDuplicateNames`).
- v1 marshals a **nil slice or map as `null`**; v2 marshals them as **`[]` / `{}`** (`FormatNilSliceAsNull`, `FormatNilMapAsNull`).
- In the Go 1.27 release branch the `jsonv2` experiment is **enabled by default** (`internal/buildcfg/exp.go`), and the classic `encoding/json` is implemented on top of the v2 engine while keeping v1 behaviour.
- Go blog post "A new Go API for JSON" (4 Nov 2026) announces the packages as stable and generally available in Go 1.27 — read via search summary only.
- Performance: one benchmark comparison reports unmarshal 1.5–2.3× faster; results vary and one independent test found marshaling slower in some cases. The video says "decoding around twice as fast" and labels it "early benchmarks".
- In the case-sensitivity demo, v2 simply does not match the field (unknown members are ignored by default, not an error).
- Struct, JSON samples and bar lengths on screen are illustrative.

## Sources
- https://go.dev/blog/jsonv2
- https://github.com/golang/go/blob/release-branch.go1.27/src/encoding/json/v2_options.go
- https://lemire.me/blog/2026/08/29/the-new-go-json-api-twice-as-fast-or-1-5x-slower/
- https://www.gopherguides.com/articles/golang-encoding-json-v2
