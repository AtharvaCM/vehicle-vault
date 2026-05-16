# TokenService unifies hash-based and JWT-based token lifecycles

**Status**: accepted

`TokenService` owns four token purposes — email verification, password reset, refresh session, and any future single-use tokens — even though refresh tokens are JWT-signed while verification and reset tokens are random bytes stored as SHA-256 hashes. A reasonable reader would expect these to live in separate services because the cryptographic mechanisms differ.

We picked the unification because the *lifecycle vocabulary* is what callers actually use: `issue`, `consume`, `rotate`, `revoke`. AuthService, guards, and mail flows all reason about token *purposes*, not about whether the bits are a JWT or a hash digest. Splitting by mechanism would force every caller to know which service to talk to for which purpose, and would scatter the timing-safe-compare and TTL-enforcement invariants across two modules.

If a future token purpose appears that doesn't fit either mechanism (e.g. opaque tokens stored in Redis with a TTL), add it as another `issueX`/`consumeX` pair on the same module. The seam is the purpose, not the algorithm.
