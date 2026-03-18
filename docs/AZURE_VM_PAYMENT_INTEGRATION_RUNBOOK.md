# Azure VM + Payment Gateway Integration Runbook

## Current status in this repo

- ✅ Detailed beginner blueprint available:
   - `docs/BEAMLAB_GPU_DEPLOYMENT_BLUEPRINT.md`
   - Includes day-by-day setup (Day 1–7), VM→VMSS migration path, env matrix, cost and security checklist

- Payment backend is already implemented:
  - `apps/api/src/phonepe.ts`
  - `apps/api/src/razorpay.ts`
- Payment frontend flow is already implemented:
  - `apps/web/src/components/PaymentGatewaySelector.tsx`
  - `apps/web/src/components/PhonePePayment.tsx`
  - `apps/web/src/components/RazorpayPayment.tsx`
  - `apps/web/src/pages/PricingPage.tsx`
- Job queue/proxy endpoints already exist on Node API:
  - `apps/api/src/routes/jobs/index.ts`
  - mounted in `apps/api/src/index.ts` as `/api/jobs` and `/api/v1/jobs`

- ✅ GPU orchestrator integration is now implemented on Node API:
   - `apps/api/src/services/vmOrchestrator.ts` (retry, timeout, circuit breaker, Python fallback)
   - `apps/api/src/routes/gpujobs/index.ts`
   - mounted in `apps/api/src/index.ts` as `/api/gpu-jobs` and `/api/v1/gpu-jobs`

## Goal

Use Azure VM/VMSS for heavy compute while keeping website + API stable, and complete production-grade payment activation.

## A) Azure VM integration (recommended architecture)

1. **Website calls Node API only**
   - Keep frontend on `VITE_API_URL`.
   - Do not call VM endpoints directly from browser.

2. **Node API dispatches heavy jobs to VM orchestrator**
   - Use `/api/jobs` routes as the stable entry point.
   - Set:
     - `AZURE_VM_ORCHESTRATOR_URL`
     - `AZURE_VM_ORCHESTRATOR_API_KEY`

3. **Private network path**
   - Put orchestrator behind private endpoint/VNet where possible.
   - Restrict ingress by IP allowlist + token auth.

4. **Autoscaling**
   - Run compute workers in VM Scale Set.
   - Scale on queue depth / CPU.

5. **Reliability controls**
   - Request timeout + retry (bounded).
   - Dead-letter queue for failed jobs.
   - Health checks + readiness checks.

## B) Payment integration (production checklist)

1. **Backend env vars**
   - PhonePe: `PHONEPE_MERCHANT_ID`, `PHONEPE_SALT_KEY`, `PHONEPE_SALT_INDEX`, `PHONEPE_ENV`, `PHONEPE_CALLBACK_URL`
   - Razorpay: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`

2. **Frontend env vars**
   - `VITE_PAYMENT_GATEWAY` = `razorpay` | `phonepe` | `both`
   - `VITE_PHONEPE_MERCHANT_ID`
   - `VITE_PHONEPE_ENV`
   - `VITE_RAZORPAY_KEY_ID`

3. **Webhooks**
   - PhonePe webhook endpoint under `/api/billing/webhook`
   - Razorpay webhook endpoint under `/api/billing/razorpay/webhook`
   - Ensure signature verification is enabled in production.

4. **Post-payment state sync**
   - On success callback, call subscription refresh (`refreshSubscription`) as already wired in pricing flow.

5. **Safety checks**
   - Disable bypass flags in production.
   - Use live keys only in prod.

## C) Rollout plan

1. Stage/UAT with sandbox keys and test VM orchestrator.
2. Validate end-to-end:
   - Start checkout
   - Complete payment
   - Verify subscription upgrade in DB
   - Submit heavy compute job
   - Confirm job result round-trip
3. Enable production keys + production orchestrator endpoint.
4. Monitor logs and payment webhook success rates.

## Quick test matrix

- Payment:
  - Razorpay success/fail/cancel
  - PhonePe success/fail/cancel
  - webhook replay/idempotency
- Compute:
  - burst job submissions
  - timeout path
  - orchestrator unavailable fallback
