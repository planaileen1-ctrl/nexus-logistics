# Nexus Logistics — Regression Checklist (Business-Critical)

Last updated: 2026-02-15

Goal: validate that hardening/security changes do not affect current revenue-critical flows.

## 0) Test scope and rules

- Do not modify production data manually from Firebase console.
- Use dedicated test entities when possible (test pharmacy, test employee, test driver, test customer).
- Capture evidence for each case: screenshot + order/pump ID + timestamp.

---

## 1) Smoke tests (must pass before deeper tests)

### 1.1 Login flows

- [ ] Pharmacy login with valid PIN succeeds.
- [ ] Employee login with valid PIN succeeds.
- [ ] Driver login with valid PIN succeeds.
- [ ] Invalid PIN fails and does not enter dashboard.

### 1.2 Dashboard access

- [ ] Pharmacy dashboard opens with expected data.
- [ ] Employee dashboard opens with expected counters.
- [ ] Driver dashboard opens and shows orders/connections.

---

## 2) Employee flow: create order

Route: `/employee/orders`

- [ ] Load pumps list filtered by pharmacy.
- [ ] Load customers list filtered by pharmacy.
- [ ] Create order with available pump(s) + customer.
- [ ] Created order appears in activity list with correct status.
- [ ] Pump state changes as expected (not available while assigned/in-progress).

Evidence:
- Order ID: ______
- Pump numbers: ______
- Timestamp: ______

---

## 3) Driver flow: pickup + delivery + signatures

Route: `/driver/dashboard`

- [ ] Driver can connect to pharmacy by PIN (if used in operation).
- [ ] Driver can see assigned/pending relevant orders.
- [ ] Pickup action updates order status correctly.
- [ ] Delivery modal captures receiver name/signatures.
- [ ] Delivery updates status to `DELIVERED`.
- [ ] GPS/IP fields are stored when available.
- [ ] `pump_movements` entries are created for movement actions.

Evidence:
- Order ID: ______
- Delivery timestamp: ______
- Driver ID: ______

---

## 4) Returns flow (critical for pump recovery)

Routes:
- `/driver/dashboard` (mark returned/not returned + reason)
- `/employee/pump-returns` (confirm return to pharmacy)

- [ ] During delivery, previous pumps can be marked returned/not returned.
- [ ] If not returned, reason is required and saved.
- [ ] In `pump-returns`, pending returned pumps appear.
- [ ] Employee marks selected pumps as returned to pharmacy.
- [ ] Pump document updates `maintenanceDue: true` after return confirmation.

Evidence:
- Order ID: ______
- Returned pumps: ______
- Not returned pumps + reason: ______

---

## 5) Maintenance flow

Route: `/employee/pump-maintenance`

- [ ] Returned pumps with `maintenanceDue: true` appear.
- [ ] Clean/calibrate/inspect checkboxes save correctly.
- [ ] When all checks are complete, maintenance state clears as expected.
- [ ] Pump can re-enter available lifecycle when applicable.

Evidence:
- Pump number: ______
- Maintenance completed at: ______

---

## 6) Legal PDF flow

Routes:
- `/driver/delivery-pdfs`
- `/employee/delivery-pdfs`

- [ ] Delivered orders with PDF URL appear in list.
- [ ] PDF opens correctly from list.
- [ ] Share-by-email action works for valid email.
- [ ] Invalid email is rejected by UI validation.

Evidence:
- Order ID: ______
- PDF URL accessible: Yes / No
- Email recipient tested: ______

---

## 7) Data integrity checks (Firestore)

For one full end-to-end tested order:

- [ ] `orders/{orderId}` has coherent status timeline (`createdAt`, `assignedAt`, `deliveredAt`, etc.).
- [ ] `orders/{orderId}.previousPumpsStatus` matches UI decisions.
- [ ] `orders/{orderId}.previousPumpsReturnToPharmacy` matches employee confirmation.
- [ ] Related pump docs reflect expected statuses/maintenance flags.
- [ ] `pump_movements` has corresponding movement events.

---

## 8) Exit criteria (release go/no-go)

### Go

- [ ] All sections 1–6 pass.
- [ ] No blocker in section 7.
- [ ] No regression reported by operations/users.

### No-go

- [ ] Login failures for any active role.
- [ ] Inability to create/complete delivery orders.
- [ ] Returns flow blocked.
- [ ] PDF/legal evidence unavailable for delivered orders.

---

## 9) Incident note template

If something fails, capture:

- Feature/route:
- Exact step:
- User role used:
- Entity IDs (order/pump/customer):
- Error message:
- Time (local + UTC):
- Screenshot/log reference:
