# Feedback inbox

`/feedback` collects bugs, ideas, experience reports and market-data issues. This is product feedback for the current preview, not an emergency support channel or live-trading service. Anonymous submissions need no wallet, signatures or transactions. Fields: category, app area, title, description, optional email/X contact. No wallet, positions, balance, browser diagnostics or API keys are attached automatically. No attachments, email delivery or guaranteed response time in this version.

## Local launch

Run the app normally. Successful submissions are durably saved in `.cache/twun-feedback-v1.json` on this server. This private file is ignored by git. Keep a private backup; browser storage is not the inbox. The local adapter is for one Node process, not a multi-instance deployment. No external service receives these local tickets.

To read submissions, set a randomly generated `FEEDBACK_ADMIN_TOKEN` of at least 32 characters in server-only `.env.local`, restart, open **Feedback → Team inbox**, and enter that token. The token is never embedded in the bundle, query string or localStorage. Access is session-memory only; closing/reloading the page clears displayed tickets. Do not share the token with users. Use HTTPS in production. The latest 50 received tickets are returned; records are retained, not silently removed. There is no ticket-status workflow yet: “Received” means saved only.

## Vercel

Add `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` and `FEEDBACK_ADMIN_TOKEN` to the appropriate Vercel environment and redeploy. Existing shared Redis credentials can be reused. Set `FEEDBACK_REDIS_NAMESPACE=twun-feedback-v1`, keeping the namespace separate from market/news data and from preview environments. See [Upstash REST API](https://upstash.com/docs/redis/features/restapi).

On Vercel, missing shared storage disables submission. It never falls back to ephemeral serverless disk or pretends a ticket was sent. Redis errors fail the request without a success receipt. Storage is confirmed before a receipt is displayed. Redis commits ticket, inbox reference and rate counters atomically via Lua. A UUID identifies retries: identical content gets the same receipt, conflicting reuse is rejected. After an unconfirmed attempt, retry the unchanged form; start a new page/form to intentionally submit different content.

## Safety and operational limits

Same-origin JSON POST, 32 KiB body limit, bounded fields, honeypot and anonymous HttpOnly SameSite cookie rate bucket: 5/hour per browser bucket, 60/hour globally. This is basic abuse protection, not bot-proof identity: resetting cookies changes the browser bucket. Add a server-verified bot challenge and stronger edge rate limiting before broad promotion. No raw IPs are stored. Do not log request bodies or admin headers.

The inbox stops accepting new tickets at 2,000 retained records instead of deleting earlier reports. The owner must privately export/archive records and establish retention/deletion procedures as usage grows. Optional contact information is private team data; do not publish it. Back up and restrict Redis access. This feature does not automatically notify anyone: the team must check the inbox. An administration token must be configured by the owner; it is not created or committed by the app.
