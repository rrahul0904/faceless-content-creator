# Production checklist

Code can automate the workflow, but external accounts and credentials cannot be fabricated. Complete these steps before switching `DEMO_MODE=false`.

- Create an Orshot workspace and API key.
- Build/duplicate a 9:16 Studio template with dynamic parameters: `clip`, `topic`, `hook`, `stat_number`, `stat_label`, `handle`.
- Provide a presenter image you have rights/consent to use and choose an Orshot voice ID.
- Connect TikTok, Instagram, YouTube, or other social accounts in Orshot and copy their numeric account IDs.
- Provision PostgreSQL and apply `sql/schema.sql`.
- Configure the LLM endpoint, key and model.
- Set a strong `SESSION_SECRET`, admin password and automation token.
- Deploy the web/API service and the background worker.
- Import the n8n production workflow and configure its application URL/token.
- Run one real render with `autoPublish=false`, review it, then publish to one test account.
- Only after that succeeds, enable scheduled or automatic publishing.

A live deployment is verified only after a real content run produces a real Orshot render, the async job reaches `succeeded`, the MP4 is viewable, a connected social account reports the post as published/scheduled, and analytics can subsequently read that post. Those checks require real credentials and connected accounts.
