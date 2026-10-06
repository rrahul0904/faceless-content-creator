# Slice A Verification Record — Persistent Content Brief + Claim/Evidence Model

Status: **PARTIAL PASS / BLOCKED ON DURABLE STORAGE**

This record exists to prevent implementation progress from being mistaken for product certification.

## Slice A acceptance criteria

| Gate | Result | Evidence |
|---|---|---|
| A1 official source may support fact without skipping workflow | PASS | Domain tests + deployed self-test |
| A2 reference pattern cannot support factual claim | PASS | Domain tests + deployed self-test |
| A3 unresolved shortlink retained but not evidence-capable | PASS | Domain tests + deployed self-test |
| A4 unsupported factual claim blocks evidence-ready | PASS | Domain tests + deployed self-test |
| A5 creator opinion remains separate and may stand without external evidence | PASS | Domain tests + deployed self-test |
| A6 experience mode requires author-owned evidence/input | PASS | Domain tests + deployed self-test |
| A7 invalid state transitions fail closed | PASS | Domain tests |
| A8 serialization / receipt hashing deterministic | PASS | Domain tests + deployed self-test |
| Hosted API behavior | PASS | `/api/brief-selftest` on verified preview |
| Browser UAT surface | PASS for served/runtime contract surface | `/brief-uat.html` + `/brief-uat.js` served on preview; browser persistence explicitly labeled fallback |
| Durable save/reload | BLOCKED | No dedicated Creator Console database is configured |
| Recovery after durable reload | BLOCKED | Depends on durable save/reload |
| Parent repository security/audit | IN VERIFICATION | Next.js patched from 16.3.4 to 16.3.6; normal CI rerun required |

## Hosted certification receipt

Verified preview code state:

- Git SHA: `237f3b37f34f71a93c9901d9995b397ac87c2b4f`
- Vercel deployment: `dpl_38bRBaAGUqzFgy9Yjmr1F9B6HtGk`
- route: `GET /api/brief-selftest`
- response schema: `creator-brief-selftest/v1`
- HTTP: 200

Checks:

1. `officialFactBecomesEvidenceReady = true`
2. `referencePatternCannotSupportFact = true`
3. `unresolvedCommunityCannotSupportFact = true`
4. `experienceRequiresAuthorOwnedEvidence = true`
5. `creatorOpinionCanStandAlone = true`
6. `receiptReplayDeterministic = true`

Deterministic official-path receipt observed:

`2702d79854ff67f2c9d9ab184c5d38df7bcf37eb9474806115159245c08468d7`

The deployed self-test also reported:

`persistenceConfigured = false`

Therefore the slice is not promoted to complete.

## Browser UAT

The dedicated clean-room surface is deliberately separate from the old donor UI:

- `/brief-uat.html`
- `/brief-uat.js`

It exercises:

1. live official-source discovery;
2. source classification and resolution state;
3. Content Brief capture;
4. one explicit claim with claim type;
5. hosted claim-level evidence evaluation;
6. `evidence-ready` vs `blocked-evidence` result;
7. deterministic receipt display;
8. persistence behavior.

If durable storage is unavailable, the browser may save a local fallback but displays:

> This does NOT satisfy the durable-storage roadmap gate.

That behavior is intentional.

## Security issue discovered by verification

The parent application dependency graph was pinned to `next@16.3.4`. Normal CI failed at `npm audit --omit=dev --audit-level=high` because that version falls inside the affected range for the 2026 `next/og ImageResponse` RCE advisory.

Corrective work on this branch:

- `next`: `16.3.4` → `16.3.6`
- `eslint-config-next`: `16.3.4` → `16.3.6`
- `package-lock.json` regenerated on GitHub Actions rather than hand-edited
- temporary lockfile-generation workflow removed after use
- normal CI remains the authority for final audit/build status

## Durable storage blocker

Connected Supabase projects were inspected. There is no project dedicated to Creator Console. Existing projects belong to other products and are not reused because that would violate product isolation and make later evidence/storage receipts ambiguous.

A dedicated durable store requires an explicit infrastructure provisioning decision before cost-bearing project creation.

Until then:

- `/api/storage-health` must report `configured:false`;
- `/api/briefs` must not pretend browser persistence is server persistence;
- PR #20 remains draft/unmerged;
- Slice B remains specification-only.

## Promotion rule

Slice A may move from `PARTIAL PASS` to `PASS` only when all of the following are attached to this record:

1. dedicated durable store identity;
2. applied schema evidence;
3. security advisor result after schema creation;
4. successful save receipt;
5. successful reload receipt for the same brief ID;
6. source + claim identity preserved after reload;
7. failure/retry recovery test;
8. exact deployment SHA;
9. green full CI on that SHA.
