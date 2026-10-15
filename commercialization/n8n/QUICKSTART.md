# Faceless Content Creator — n8n Commercial Edition Quickstart

1. Start the local application stack using the repository's documented Docker/local path.
2. Run `npm ci`, lint, typecheck and the applicable smoke tests before importing n8n automation.
3. Import `workflows/n8n/faceless-content-creator.json` into the pinned supported n8n version.
4. Point the workflow at the same workspace-scoped app URL/API-key boundary used by the SaaS control plane; do not create an n8n bypass around tenant/plan limits.
5. Use local deterministic render mode before enabling external AI or social providers.
6. Keep social publishing in test/private/draft mode until provider-safe E2E and workspace authorization tests pass.

Shipping remains NO-GO until the exact candidate SHA passes application, n8n, tenant-isolation, render-recovery and publishing gates.
