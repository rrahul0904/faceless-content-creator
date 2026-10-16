# REA Intake: AI Character + Social Income Engine

Source: https://www.reddit.com/r/DigitalIncomePath/s/yFVEUab9sU
Captured: 2026-10-16
Classification: donor/reference -> extension of the existing `faceless-content-creator` product boundary.
Implementation branch: `rea/ai-character-income-engine`

## Why this belongs here

The existing product already owns content generation, deterministic/AI video rendering, channels, scheduling, social publishing, publication analytics, workspaces and usage controls. The donor adds a missing business layer: persistent recurring characters, recurring-series planning, monetization lanes and profit-aware optimization.

Creating a new repository would duplicate the render/publish/analytics stack and violate the portfolio repository-routing rule.

## Public evidence captured from the Reddit thread

The post describes an AI dog character used for dancing/funny skits and a separate AI persona. The poster says the dog page has more than 120,000 Facebook followers and the same dog has more than 17,000 Instagram followers. The poster explicitly says direct content monetization is supplemental and that affiliate/client/customer revenue can be more valuable and less platform-dependent.

The poster describes a workflow that uses external image/video generation providers. A commenter independently highlights a useful pattern: one recurring character with a running gag performs better than disconnected one-off clips, and suggests preserving the same character across skits and posting the series consistently. The poster confirms it is the same dog, based on a real pet.

These are public claims and anecdotal evidence, not verified earnings guarantees. The owned product must therefore optimize measured economics rather than encode the donor's results as expected outcomes.

## Capability extraction

### 1. Persistent character identity

A character is more than a prompt. We need a reusable identity contract:

- name/persona
- niche and target audience
- visual identity rules
- recurring bit / running gag
- target platforms
- publishing cadence
- expected generation cost per episode
- optional link to an owned Channel

### 2. Recurring-series planner

Generate a sequence, not isolated videos. A series plan should deliberately rotate:

- pattern interrupt
- escalation
- audience challenge
- callbacks
- monetization bridge
- behind-the-character/origin angle
- payoff/loopable episode

The planner should preserve character identity in every episode and avoid turning every post into an ad.

### 3. Monetization portfolio

Treat platform payouts as one lane among several:

- platform creator monetization
- affiliate offers
- owned digital/physical products
- service/client acquisition
- sponsorships

Each character can own multiple active offers. Offer insertion should be deliberate and measurable.

### 4. Revenue and cost ledger

Track per-result economics:

- revenue amount
- generation/distribution cost
- views
- clicks
- conversions
- platform
- monetization source
- optional content/offer association

Derived metrics:

- gross profit
- blended revenue per 1,000 views
- profit per 1,000 views
- click-through rate
- conversion rate
- revenue mix by source

This prevents the system from optimizing for viral reach that is expensive or commercially weak.

### 5. Feedback loop

Owned target flow:

```text
CharacterSpec
  -> recurring SeriesPlan
  -> identity-bound script
  -> image / video generation
  -> review + policy gate
  -> owned renderer
  -> scheduled multi-platform publish
  -> publication analytics + revenue/cost events
  -> unit economics
  -> next SeriesPlan
```

The current branch now implements CharacterSpec, series planning, monetization offers, revenue/cost events, business analytics, character-bound script generation and direct handoff into the existing local FFmpeg renderer. Existing product modules continue to own social scheduling/publishing and publication analytics.

## Clean-room boundary

We are not cloning AtlasCloud, Fannabe, Mage Space, Facebook monetization, TikTok Shop or any third-party provider implementation. Provider names in the source are treated as evidence of capability categories only.

The owned implementation uses its own contracts and existing repository architecture. External model providers can later be connected behind provider adapters, but the product must continue to function with the repository's local-first deterministic media path.

Adult/uncensored monetization workflows mentioned in the discussion are not part of this implementation scope.

## Implemented in this branch

- `lib/character-business.ts`
  - workspace-scoped persisted character-business state
  - character profiles
  - offers
  - revenue/cost events
  - unit-economics summary
- `GET /api/v1/business`
  - business dashboard plus existing publication reach by platform
- `GET/POST /api/v1/business/characters`
  - persistent recurring character profiles
- `GET/POST /api/v1/business/offers`
  - monetization portfolio per character
- `POST /api/v1/business/revenue`
  - revenue/cost/view/click/conversion ledger
- `POST /api/v1/business/series-plan`
  - deterministic three-to-thirty-day recurring-series plan
- `POST /api/v1/business/characters/:id/script`
  - compiles persona, audience, visual identity, recurring bit, platform and optional offer into an episode-writing contract
  - works with configured LLM providers but retains a zero-key deterministic fallback
- `components/character-income-engine.tsx`
  - create/select recurring characters
  - add monetization lanes
  - record unit economics
  - generate a seven-day series
  - generate an identity-bound episode draft
  - send the reviewed draft directly to the existing local render queue and retrieve the MP4
- `scripts/smoke-business.mjs`
  - acceptance path for character -> offer -> revenue -> series -> character-bound script -> persisted business dashboard

For this first slice, the new business state is stored through the existing `Setting` table under a workspace-prefixed key. This keeps the change deployable without a database migration while preserving the workspace isolation contract. Once the contract stabilizes, the data can be normalized into dedicated Prisma models without changing the API surface.

## Acceptance criteria

1. A local workspace can create a reusable character profile.
2. Character state survives process requests because it is persisted in SQLite.
3. A character can own multiple monetization offers.
4. A user can record revenue, cost, views, clicks and conversions.
5. The dashboard returns gross profit, RPM and profit/1K views.
6. A user can generate a recurring seven-day series plan that preserves the character's visual identity and recurring bit.
7. A planned episode can be compiled into an identity-bound script without requiring external AI keys.
8. The reviewed character episode can be handed to the existing owned local render queue and rendered as an MP4.
9. Existing workspace/API-key authorization still gates the new business routes.
10. Existing social publication analytics are visible beside business metrics.
11. CI lint, typecheck, production build and the character-business acceptance smoke remain green.

## Next implementation slices

### Slice 2: Character-consistent visual generation

- attach `characterId` to persisted content jobs
- compile the visual identity contract into provider-neutral image/video generation requests
- add reference-image packs
- add character consistency scoring
- compare generated frames to reference embeddings before approval

### Slice 3: Provider fabric

Provider-neutral interfaces for image-to-video and reference-conditioned video generation. Candidate adapters can include multiple commercial/open providers, but no provider is the product boundary.

### Slice 4: Automated experiment loop

- generate hook/scene variants
- cap spend per experiment
- publish approved variants
- import analytics
- attribute revenue
- promote winning patterns only after minimum evidence thresholds

### Slice 5: Full business automation

- affiliate-link/offer attribution
- campaign-level P&L
- content calendar and fixed posting windows
- per-platform format adaptation
- approval-gated scheduled publishing
- self-healing retries and verification receipts

## Benchmark responsibilities

The benchmark is not “did a video render?” It is:

- identity consistency across an episode set
- repeatable-series quality
- cost per publishable episode
- publish success rate
- measured reach/engagement
- click/conversion attribution quality
- gross profit and profit per 1,000 views
- replayability of the same plan after provider/model drift

No earnings claim from the donor is used as an acceptance threshold.
