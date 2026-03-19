# MVP Definition

## Objective

Validate that users:

1. Add their vehicles
2. Log maintenance data
3. Return due to reminders

---

## Core Features

### 1. Authentication

- Email + password login/signup
- Secure session handling

---

### 2. Vehicle Management

Users can:

- Add multiple vehicles
- Store:
  - Registration number
  - Make, model, variant
  - Year
  - Fuel type
  - Odometer
  - Ownership date

---

### 3. Maintenance Logging

Users can log:

- Service date
- Odometer
- Service type
- Cost
- Notes
- Workshop
- Parts replaced
- Next due date/km

---

### 4. Attachments

Users can:

- Upload receipts (image/PDF)
- Link them to service entries

---

### 5. Reminders

Support:

- Date-based reminders
- Odometer-based reminders

Examples:

- Service due
- Insurance expiry
- PUC expiry
- Tyre rotation

---

### 6. Dashboard

Displays:

- All vehicles
- Upcoming reminders
- Overdue reminders
- Recent maintenance

---

### 7. Data Export

Users can:

- Export vehicle data as CSV/JSON

---

## Non-Goals (Excluded from MVP)

- OCR invoice parsing
- AI recommendations
- Service center integrations
- Native mobile apps
- Advanced analytics
- Social features

---

## Success Criteria

- ≥60% users add at least 1 vehicle
- ≥40% log at least 1 service
- ≥25% return within 7 days
- ≥20% upload at least 1 receipt

---

## MVP Philosophy

> Fast logging + real value > fancy features

If logging is slow, the product fails.
