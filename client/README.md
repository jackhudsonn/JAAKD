# JAAKD Frontend

Angular frontend for JAAKD.

## Run

```bash
npm install
npm start
```

Open:

```text
http://localhost:4200
```

---

## Main Structure

```text
src/
├── app/
│   ├── dashboard/
│   ├── transactions/
│   ├── analytics/
│   └── services/
│
├── styles/
│   ├── tokens.css
│   ├── buttons.css
│   ├── forms.css
│   └── layout.css
│
└── styles.css
```

---

## How to Edit Styling

### Change the whole application

Use `src/styles/`.
Angular loads `client/src/styles.css` globally, so every component under `src/app/` automatically has access to the shared styles it imports from `src/styles/` (`tokens.css`, `buttons.css`, `forms.css`, and `layout.css`). You do **not** need to import these styles separately into each component.

Use `src/styles/` for styles that should apply across the entire application, such as colors, buttons, forms, and shared layouts. Use component CSS such as `dashboard.css`, `transactions.css`, or `analytics.css` only for styling specific to that page.


**`tokens.css`**
- Colors
- Fonts
- Spacing
- Border radius
- Success/error colors

**`buttons.css`**
- Buttons
- Hover states
- Click/active states

**`forms.css`**
- Inputs
- Labels
- Selects
- Form controls

**`layout.css`**
- Header
- Navigation
- Cards
- Panels
- Account controls

### Change only one page

Use that page's CSS:

```text
dashboard/dashboard.css
transactions/transactions.css
analytics/analytics.css
app.css
```

### Easy Rule

> Should this change everywhere? → `src/styles/`

> Only this page? → the page's `.css`

---

## Authentication

Authentication is handled in:

```text
src/app/services/supabase.service.ts
```

Current methods:

- Sign up
- Sign in
- Sign out
- Get session
- Listen for auth changes

The frontend uses the Supabase **publishable key only**.

---

## Routing

Routes are configured in:

```text
src/app/app.routes.ts
```

Current routes:

```text
/dashboard
/transactions
/analytics
```

---

## Connecting the Backend

The frontend should eventually call Spring Boot rather than directly modifying trading data.

```text
Angular
   ↓
Spring Boot
   ↓
PostgreSQL
```

First test:

```text
GET /api/health
```

Then:

```text
GET /api/instruments
POST /api/orders
```

Authenticated requests will eventually send the Supabase access token to Spring Boot.

---

## Current Mock Data

These dashboard values are currently placeholders:

- Prices
- Portfolio value
- Cash
- Returns
- Market status
- Order values

They should be replaced with backend/API data as development continues.
