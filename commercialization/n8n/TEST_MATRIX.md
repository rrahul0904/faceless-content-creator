# Faceless Content Creator n8n Release Test Matrix

| Scenario | Expected result | Gate |
|---|---|---|
| npm clean install | Succeeds | PENDING |
| Lint/typecheck | Pass | PENDING |
| App build | Pass | PENDING |
| n8n workflow JSON | Parses with expected nodes/connections | PENDING |
| n8n import | Imports on pinned n8n | PENDING |
| Local deterministic render | Produces playable output | PENDING |
| Duplicate render trigger | No duplicate billable/public side effect | PENDING |
| Render cancellation | Terminal state is CANCELLED, output discarded | PENDING |
| Workspace auth missing | Hosted mode fails closed | PENDING |
| Cross-workspace media | Access denied | PENDING |
| Plan/usage limit exceeded | Request blocked consistently | PENDING |
| Provider timeout/429 | Bounded recovery | PENDING |
| Social credential isolation | No plaintext leakage | PENDING |
| Scheduled publish duplicate | At most one publication | PENDING |
| Social provider failure | Durable failure/retry state | PENDING |
| Kill switch | Blocks publish side effects | PENDING |
| Secret scan | No live credentials | PENDING |
| Demo evidence | Render + scheduled draft/private publish evidence | PENDING |
| Release receipt | Exact SHA evidence complete | PENDING |
