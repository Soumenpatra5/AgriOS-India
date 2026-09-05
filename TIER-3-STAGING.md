# Tier-3: Staging Environment & Load Testing

**Goal:** Validate the app's performance under realistic load before handing to real farmers.

Tier-3 has two parts:
1. **Staging environment** (clean Vercel + Supabase instance)
2. **Load testing** (k6 scenarios simulating realistic traffic)

---

## Part 1: Staging Environment Setup (User Action)

You will create a **new, separate** free-tier Vercel + Supabase account for staging.

### 1a. Create Staging Vercel

1. Go to [vercel.com](https://vercel.com) and create a new account (use a different email than your production account)
   - Or log in to a separate account you already have
2. Import the AgriOS India repository (same GitHub repo, same branch)
3. Add environment variables:
   - `VITE_FB_API_KEY=blank` (disable Firebase, same as production build)
   - Copy any other `VITE_*` vars from production `.env.production`
4. Deploy and note the staging URL (e.g., `https://agrios-staging.vercel.app`)

### 1b. Create Staging Supabase (if needed)

If your app uses Supabase for staging data:
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Use the **free tier**
3. Set up the same schema as production (migrations or manual setup)
4. Add Supabase URL + key to staging Vercel environment variables

### 1c. Verify Staging Boots

Open `https://agrios-staging.vercel.app` in a browser:
- ✅ Should boot to language screen (no Firebase, no /api backend)
- ✅ Splash → Language → Onboarding → Auth (local-first flow)
- No console errors (same safety-by-construction as Tier-2)

---

## Part 2: Update GitHub Secrets

Once your staging Vercel is ready, add these secrets to your GitHub repository:

| Secret | Value | Source |
|--------|-------|--------|
| `VERCEL_STAGING_ORG_ID` | Your staging Vercel account ID | Vercel dashboard → Account → Tokens → API Tokens (shows your org ID) |
| `VERCEL_STAGING_PROJECT_ID` | Your staging project ID | Vercel dashboard → Project Settings → Project ID |
| `VERCEL_STAGING_TOKEN` | New Vercel API token (staging account) | Vercel dashboard → Account → Tokens → Create Token |

**Important:** These must be from your **staging account**, not production.

To add secrets via GitHub CLI:
```bash
gh secret set VERCEL_STAGING_ORG_ID --body "xxx"
gh secret set VERCEL_STAGING_PROJECT_ID --body "xxx"
gh secret set VERCEL_STAGING_TOKEN --body "xxx"
```

---

## Part 3: Deploy to Staging

### Option A: Automatic (recommended)

Create a `staging` branch and push:
```bash
git checkout -b staging
git push -u origin staging
```

This triggers `.github/workflows/deploy-staging.yml`, which auto-deploys to your staging Vercel.

### Option B: Manual

```bash
npm run build
npx vercel deploy --prod --token $VERCEL_STAGING_TOKEN
```

---

## Part 4: Run Load Tests

### Local load testing (against local preview)

1. Make sure k6 is installed: `brew install k6` (macOS) or see [k6 docs](https://k6.io/docs/get-started/installation/)
2. Build the app: `npm run build`
3. Start the preview server: `npm run preview` (runs on `http://localhost:4173`)
4. In another terminal: `npm run load-test`

This runs the k6 suite with default settings:
- Ramp 0 → 50 VUs over 30s
- Hold 50 VUs for 5 minutes
- Ramp down to 0 VUs over 30s
- Total duration: ~11 minutes

### Staging load testing (against deployed staging)

Once staging is deployed to Vercel:
```bash
npm run load-test:staging
```

This points at `https://agrios-staging.vercel.app` and runs the same load profile.

### Custom load profiles

Override the ramp-up, peak VUs, or duration:
```bash
k6 run -e RAMP_UP=1m -e PEAK_VUS=200 -e DURATION=10m load-test.js
```

---

## Load Test Scenarios

The k6 suite simulates **four realistic user journeys:**

### 1. Onboarding (40% of traffic)
- Fresh visitor lands on splash screen
- Chooses language (Hindi / English)
- Accepts ToS
- Represents new farmers discovering the app

### 2. Ledger Workflow (35% of traffic)
- Signed-in farmer navigates to ledger
- Views existing entries
- Adds a new expense/income entry
- Represents daily active users managing finances

### 3. Service Discovery (20% of traffic)
- Farmer opens Services tab
- Scrolls through categories
- Clicks into a few service screens
- Represents explorers browsing marketplace

### 4. Profile Heavy (5% of traffic)
- Power user rapid-tabs between Home, Services, Profile
- Simulates heavy navigation load
- Stress-tests tab switching and state management

---

## Success Criteria

### Performance

- **p95 response time < 3s** (95% of requests finish in 3 seconds or less)
- **p99 response time < 5s** (99th percentile)
- **< 5% error rate** (allow some failures under extreme load)
- **Scenario-specific thresholds:**
  - Onboarding: p95 < 2s (lightweight)
  - Ledger: p95 < 2.5s
  - Services: p95 < 3s
  - Profile: p95 < 3s

### Stability

- App remains responsive across all 50 concurrent VUs
- No crashes or white screens during load
- Graceful degradation if /api is unreachable (local-first promise)
- Navigation and UI interactions remain snappy

### Load Test Report

After the run, k6 outputs a summary:
```
     checks........................: 98.2% ✓
     data_received..................: 48 MB
     data_sent.......................: 2.4 MB
     http_req_blocked...............: avg=1.2ms
     http_req_connecting............: avg=0.3ms
     http_req_duration..............: avg=892ms p(95)=1.8s p(99)=3.2s
     http_req_failed................: 1.8%
     http_req_receiving.............: avg=78ms
     http_req_sending...............: avg=12ms
     http_req_tls_handshaking.......: avg=0.1ms
     http_req_waiting...............: avg=800ms
     http_reqs.......................: 5284
     iteration_duration.............: avg=3.2s
     iterations.....................: 1200
     vus............................: 0
     vus_max........................: 50
```

**Interpret:**
- ✅ `checks ≥ 95%` → app handles the load
- ✅ `http_req_failed < 5%` → acceptable error rate
- ✅ `p(95) < 3s` → fast enough for mobile farmers
- ⚠️ If p(99) > 5s or error rate > 10%, investigate:
  - Vercel cold starts slowing responses
  - JavaScript parsing / rendering bottlenecks
  - Supabase query performance (if using real database)

---

## Next Steps

1. **Create staging account & deploy** (1-2 hours)
2. **Run local load test** to validate the setup (15 minutes)
3. **Run staging load test** against Vercel (15 minutes)
4. **Review results** and adjust if needed
5. **Ready for real farmers** — hand off to Tier-4 (user acceptance testing)

---

## Troubleshooting

### Load test fails with "Connection refused"
- Ensure `npm run preview` is running on port 4173
- Or set `STAGING_URL` to the correct Vercel URL

### k6 not found
- Install: `brew install k6` (macOS) or see [k6 installation](https://k6.io/docs/get-started/installation/)

### Performance under threshold
- Reduce `PEAK_VUS` in `.env` or via `-e PEAK_VUS=25` to validate baseline
- Check Vercel logs for cold starts or errors
- Verify staging Supabase is configured (if using)
- Profile the app in DevTools (bottleneck: rendering, script parsing, or network?)

### Errors in load test output
- First 1-2% of errors are often connection setup; acceptable
- If error rate stays > 5%, the app has a problem under load
- Review Vercel deployment logs for any crashes

---

## When You're Ready

Once staging performs well under load, you're ready for **Tier-4: Real farmers (user acceptance testing)**.

No more code changes needed—just real-world validation with a cohort of actual agricultural users.
