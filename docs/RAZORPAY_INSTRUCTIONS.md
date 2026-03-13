Razorpay integration — paste instructions

Files created for you to paste vendor code into:

- `apps/api/src/razorpay.custom.ts` — Server-side paste target. Paste any Node/Express/Razorpay server examples here. Export functions you want to use and reference secrets from `process.env` or `apps/api/src/config/env.ts`.

- `apps/web/src/components/RazorpayCustom.tsx` — Frontend paste target. Paste any checkout.js snippets or UI components here. Replace hard-coded key ids with `import.meta.env.VITE_RAZORPAY_KEY_ID`.

Key management

- You pasted test keys into `.env.deploy`. Keep that file private.
- Backend keys (private): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` -> Put in `.env.deploy` (done).
- Frontend key (public): `VITE_RAZORPAY_KEY_ID` -> Put in `apps/web/.env` or `.env.deploy` (you have `VITE_RAZORPAY_KEY_ID` already).

How to validate and run

1. Type-check API and frontend after pasting:

   pnpm -C apps/api exec tsc --noEmit
   pnpm -C apps/web exec tsc --noEmit

2. Start local dev servers (API + Web) if you need to test live flows.

3. If you want me to apply the pasted server code into the active router (wire it into `apps/api/src/index.ts` or `apps/api/src/phonepe.ts`), ask and I will integrate it safely (we'll avoid committing secrets).

Security note

- Never commit `.env.deploy` or any file containing private keys.
- For production, set secrets in your deployment provider (Azure App Settings / GitHub secrets). The repo includes scripts/docs for syncing secrets.

---

## ✅ Current status (13 Mar 2026)

- Razorpay backend router is mounted at:
   - `/api/billing/razorpay/create-order`
   - `/api/billing/razorpay/verify-payment`
   - `/api/billing/razorpay/webhook`
- PhonePe backend route remains available at:
   - `/api/billing/create-order` (and other PhonePe billing endpoints)
- Web gateway selector supports both (`VITE_PAYMENT_GATEWAY=both`).
- `RazorpayCustom.tsx` has been converted into compile-safe React/TSX.

## Deploy secrets to Azure App Service (recommended)

Use Azure App Settings (not source files) for backend secrets:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `PHONEPE_MERCHANT_ID`
- `PHONEPE_SALT_KEY`
- `PHONEPE_SALT_INDEX`
- `PHONEPE_ENV`
- `TEMP_UNLOCK_ALL`

### Important `.env.deploy` formatting rule

Do **not** include shell-invalid placeholders (like `<name>` or unbalanced quotes) in `.env.deploy`.
If present, `source .env.deploy` fails with parse errors.

Safe pattern per line:

- `KEY=value`
- No spaces around `=`
- Quote only when necessary (`KEY="value with spaces"`)

### Non-interactive sync approach used

If your `.env.deploy` may contain invalid shell syntax, extract values with `sed` per key and push directly via `az webapp config appsettings set`.
This avoids `source` parse failures and avoids printing secrets.

## GitHub Actions secrets (optional but recommended)

Also mirror these values in GitHub repository secrets for CI/CD deployments:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `PHONEPE_MERCHANT_ID`
- `PHONEPE_SALT_KEY`
- `PHONEPE_SALT_INDEX`
- `PHONEPE_ENV`

## Frontend env (public key only)

Frontend should only receive public values:

- `VITE_RAZORPAY_KEY_ID`
- `VITE_PAYMENT_GATEWAY=both`

Never expose private keys (`RAZORPAY_KEY_SECRET`, `PHONEPE_SALT_KEY`) to frontend env.
