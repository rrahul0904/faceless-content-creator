# SaaS Plan Limits and Membership Controls

This layer turns the existing workspace, usage, membership and plan schema into enforceable hosted-product controls while keeping local development zero-config.

## Default plan limits

| Plan | Render jobs / month | AI video jobs / month | Social publishes / month | Storage MB | Members | Metered requests / minute |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| FREE | 20 | 2 | 10 | 1,024 | 1 | 30 |
| CREATOR | 200 | 20 | 100 | 10,240 | 3 | 120 |
| PRO | 1,000 | 100 | 500 | 51,200 | 10 | 300 |
| BUSINESS | 5,000 | 500 | 5,000 | 256,000 | 100 | 1,200 |

Monthly limits reset at 00:00 UTC on the first day of the next month. Metered request buckets reset every minute.

## Enforcement

The render quota is enforced across the legacy `/api/render`, content render, template render and Studio render entry points. AI-presenter jobs use their own quota. Social publishing checks the number of target accounts before creating publication records. Requests rejected by a quota or rate limit return HTTP `429`, a stable error `code`, structured limit metadata and `Retry-After` when a time-based reset applies.

`GET /api/v1/limits` exposes the current workspace plan, monthly usage, member capacity and current rate bucket without consuming the rate budget.

## Membership management

`GET/POST /api/v1/memberships` lists or creates workspace memberships. `PATCH/DELETE /api/v1/memberships/:id` updates roles or removes memberships. The control plane is workspace-scoped and prevents the last `OWNER` from being demoted or deleted.

At this stage these are operator APIs authenticated through the existing workspace API-key/local boundary. Customer-facing sign-in/session identity and end-user role authorization remain a separate productization slice.

## Environment overrides

Every limit can be overridden per plan without code changes. The variable pattern is `FCC_<PLAN>_<LIMIT>`, for example:

```text
FCC_FREE_RENDER_JOBS_PER_MONTH=20
FCC_FREE_AI_VIDEO_JOBS_PER_MONTH=2
FCC_FREE_SOCIAL_PUBLISHES_PER_MONTH=10
FCC_FREE_STORAGE_MB=1024
FCC_FREE_MEMBERS=1
FCC_FREE_METERED_REQUESTS_PER_MINUTE=30
```

The same suffixes work with `CREATOR`, `PRO`, and `BUSINESS`.

## Certification

CI boots the real Docker image with deliberately small FREE-plan limits after the normal build/render gates. It then proves that the existing two real render jobs consume the monthly allowance, a third render is rejected as `quota_exceeded`, the next metered render is rejected as `metered_rate_limited`, a second member is rejected as `membership_limit_exceeded`, and the last workspace owner cannot be demoted or deleted.
