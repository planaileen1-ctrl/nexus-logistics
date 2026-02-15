# Firestore Rules — Safe Rollout Runbook

Last updated: 2026-02-15

Objective: deploy security hardening with minimal operational risk and immediate rollback option.

## Principles

- Revenue-critical flows first: login, order creation, delivery, returns, maintenance, legal PDFs.
- Small steps, observable outcomes.
- Rollback must be ready before deployment.

---

## 1) Pre-deploy checklist

- [ ] Confirm current `firestore.rules` is committed in git.
- [ ] Export/copy current rules to backup file:
  - `firestore.rules.backup.<date>.rules`
- [ ] Identify rollback owner and communication channel.
- [ ] Prepare test users (pharmacy/employee/driver) and test entities.
- [ ] Keep `docs/regression-checklist.md` open during validation.

Suggested commands:

```bash
git add firestore.rules
git commit -m "chore(security): harden firestore rules"
```

---

## 2) Deployment strategy (low risk)

### Phase A — Controlled deploy window

- Deploy only Firestore rules (no app code deploy in same window):

```bash
firebase deploy --only firestore:rules
```

- Immediately run Section 1 (smoke) from regression checklist.

### Phase B — Critical path validation (15–30 min)

Run in this exact order:

1. Login (all roles)
2. Employee creates order
3. Driver pickup + delivery
4. Employee confirms pump return
5. Maintenance update
6. PDF access/share

If any blocker appears, execute rollback.

---

## 3) Rollback (fast path)

If a critical regression is detected:

1. Restore previous rules file content.
2. Redeploy rules immediately:

```bash
firebase deploy --only firestore:rules
```

3. Re-test login + order creation smoke.
4. Notify stakeholders with incident summary and ETA.

Rollback decision threshold (automatic):

- Any failed login for active role.
- Cannot create or complete order.
- Returns flow blocked.

---

## 4) Post-deploy monitoring (first 24h)

- [ ] Check auth/login support tickets.
- [ ] Check order volume vs. baseline (hourly).
- [ ] Check completion rate (created -> delivered).
- [ ] Check returns confirmed count.
- [ ] Check PDF generation/access issues.

If one KPI drops materially, trigger rollback review.

---

## 5) Known limitation (important)

Current app still relies on anonymous auth + client context (`localStorage`) for role/tenant behavior. Hardening rules is an essential step, but not the final state.

Recommended next phase (without rushing):

1. Introduce Firebase Auth identities per user role.
2. Move role/tenant enforcement to custom claims.
3. Enforce tenant isolation by `pharmacyId` in rules.
4. Add server-side endpoints for high-risk writes.
