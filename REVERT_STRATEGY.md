# Revert Strategy: Return to c6bb330

## Current Situation
- **Target commit:** `c6bb330` - "Fix budget duplication: Disable generic budget table generation"
- **Current HEAD:** `a7e35d4` (staging/main)
- **Problematic branch:** `origin/fix-links-v68` (28 commits ahead with cascading failures)

## Safe Revert Commands

### Step 1: Backup Current State
```bash
# Create a backup branch of everything we tried
git checkout fix-links-v68
git checkout -b backup-failed-fixes-20251005
git push origin backup-failed-fixes-20251005
```

### Step 2: Check What We're Reverting From
```bash
# See current state
git log --oneline c6bb330..HEAD

# See file differences
git diff c6bb330 HEAD --stat
```

### Step 3: Revert Staging to c6bb330
```bash
# Switch to staging branch
git checkout staging

# Hard reset to c6bb330
git reset --hard c6bb330

# Force push to remote (CAREFUL!)
git push origin staging --force-with-lease
```

### Step 4: Update Main (if needed)
```bash
# If main also needs to revert
git checkout main
git reset --hard c6bb330
git push origin main --force-with-lease
```

### Step 5: Create Clean Working Branch
```bash
# Start fresh from c6bb330
git checkout -b fix-links-v69-clean c6bb330
git push origin fix-links-v69-clean
```

## What Gets Removed

### ❌ Files to Delete (28 commits of changes)
1. **Testing Infrastructure (47 files)**
   - `backend/tests/*` (entire test suite added mid-crisis)
   - `test-*.mjs` (15+ root-level test scripts)
   - `TESTING_STRATEGY.md`
   - `playwright.config.js` modifications
   - `backend/vitest.config.mjs`

2. **Emergency/Debug Scripts**
   - `frontend/emergency-api-fix.js`
   - `frontend/debug-form.js`
   - `backend/simple-server.mjs`

3. **Documentation/Reports**
   - `FIXES-APPLIED.md`
   - `backend/OPENAI-FIX-SUMMARY.md`
   - `WAYZO_BUG_REPORT.html`
   - `LOCATION_TEST.html` / `LOCATION_TEST_FIXED.html`

4. **Deployment Hacks**
   - `DEPLOY_TRIGGER.txt`
   - `FORCE_DEPLOY.txt`

5. **Debugging Artifacts**
   - `staging-fullplan-response.json`
   - `staging-homepage.html`
   - `staging-preview-response.json`
   - `test-location-fix.html`
   - `final-diagnosis.mjs`
   - `check-deployment.mjs`

### 🔄 Files That Will Revert (Modified during 28 commits)
1. **backend/server.mjs** (8 modifications)
   - GPT-5-nano model experiments removed
   - Budget table AI research reverted
   - API parameter changes undone

2. **frontend/app.js** (7 modifications)
   - Form IIFE restructuring undone
   - Location detection CORS fixes removed
   - Debug logging removed

3. **backend/lib/widgets.mjs** (5 modifications)
   - JSDOM dependency bypass removed
   - Affiliate link changes undone

4. **frontend/index.backend.html** (4 modifications)
   - Emergency script includes removed
   - Debug script includes removed

5. **backend/lib/budget.mjs** (1 modification)
   - Budget calculation fixes removed

## State at c6bb330

### ✅ What Works at c6bb330
- Budget duplication fix applied
- Budget table generation from generic prompts disabled
- Stable codebase before cascading failures
- All core functionality operational

### ⚠️ Known Issues at c6bb330 (to fix separately)
Based on the 28 commits, these issues likely exist at c6bb330:
1. Budget table may need AI research improvements
2. GPT API might need model updates
3. Location detection might have CORS issues
4. Form submission might have event listener issues

**IMPORTANT:** Fix these ONE AT A TIME after reverting, not all at once!

## Post-Revert Action Plan

### Phase 1: Stabilize (Week 1)
1. **Day 1:** Revert to c6bb330, deploy, test basic functionality
2. **Day 2-3:** Monitor production, gather user feedback
3. **Day 4-5:** Identify the SINGLE most critical issue
4. **Day 6-7:** Fix that ONE issue in isolation

### Phase 2: Incremental Improvements (Week 2+)
For each issue found:
1. Create feature branch: `fix/specific-issue-name`
2. Implement fix
3. Test locally
4. Deploy to staging
5. Test on staging for 24 hours
6. Merge to main if stable
7. Wait 48 hours before next fix

### Fix Priority Order (Based on 28 commits)
1. **P1 - Critical:** Backend server startup issues (JSDOM dependency)
2. **P2 - High:** Form submission not working (event listeners)
3. **P3 - Medium:** GPT API model updates (gpt-5-nano support)
4. **P4 - Low:** Location auto-detection CORS
5. **P5 - Enhancement:** Budget table AI research improvements

## Cherry-Pick Candidates

If you want to salvage ANY changes from the 28 commits, cherry-pick them AFTER revert:

```bash
# Example: Only if GPT-5-nano parameter fix is needed
git cherry-pick 5af851d  # Fix GPT-5-nano API parameter

# Only if JSDOM is actually breaking server
git cherry-pick 3507a62  # Backend server JSDOM bypass
```

**Test each cherry-pick individually before proceeding!**

## Rollback Commands (if revert fails)

If the revert causes issues, restore from backup:
```bash
git checkout staging
git reset --hard backup-failed-fixes-20251005
git push origin staging --force
```

## Verification Checklist

After reverting to c6bb330, verify:
- [ ] Backend server starts: `cd backend && npm start`
- [ ] Frontend loads: Open browser to staging URL
- [ ] Trip planning form loads
- [ ] Language switching works
- [ ] Admin panel accessible
- [ ] Database queries work
- [ ] No console errors in browser
- [ ] No server errors in logs

## Key Lessons

1. **Never stack fixes** - Fix one thing, test, then move on
2. **No emergency commits** - If it's an emergency, you're already too late
3. **Test infrastructure ≠ Production** - Keep test files in separate branches
4. **Reverts are OK** - Better to revert than spiral into chaos
5. **Branch per feature** - Isolate changes for easy rollback

## Timeline Estimate

- **Backup creation:** 5 minutes
- **Revert execution:** 10 minutes
- **Deployment:** 15 minutes
- **Verification testing:** 30 minutes
- **Total:** ~1 hour to return to stable state

Compare this to the **7 days and 28 commits** spent trying to fix cascading failures!

---

**EXECUTE THIS PLAN IMMEDIATELY TO RESTORE STABILITY**
