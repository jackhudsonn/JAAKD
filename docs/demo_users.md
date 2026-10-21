# Demo users

`scripts/seed-demo-users.js` creates three local-only accounts that give
developers realistic profiles to use while building and reviewing features:

| Account | Purpose |
| --- | --- |
| `demo.newbie@jaakd.local` | A newly onboarded user with a profile and payment method, no transactions, and a default empty `My Watchlist`. |
| `demo.intermediate@jaakd.local` | A smaller portfolio with executed trades plus pending, rejected, and failed order examples, and a default `My Watchlist` preloaded with a few symbols. |
| `demo.pro@jaakd.local` | A populated multi-instrument portfolio with about 40 executed trades, about 10 funding rows, and multiple named watchlists (including empty and high-item watchlists). |

The script uses the existing application APIs and the existing FIFO accounting
service for executed fixtures. It does not change the database schema. The
development-profile `/api/order-logs/demo` endpoint accepts an authored status
and historical timestamp so seed data is not run through the live market-hours
validation path. The endpoint is disabled outside the development Spring
profile and requires an `ADMIN` account.

## Running the seed

Start the local stack, then run:

```sh
node scripts/seed-demo-users.js
```

The backend must use the `development` Spring profile. That profile enables
`app.demo-fixtures.enabled`, which is the server-side gate for the demo
endpoint. The seed script authenticates as the seeded admin account when
creating fixture logs and targets each demo user's portfolio.

The script intentionally stops if any of the three demo accounts already
exists. To recreate them from a clean local database:

```sh
docker compose down -v
docker compose up -d --build
node scripts/seed-demo-users.js
```

The credentials are printed by the script and are also defined near the top of
the script for local development.

The Spring profile and identity provider are separate settings:

```env
SPRING_PROFILES_ACTIVE=development
IDENTITY_PROVIDER=development
```

`IDENTITY_PROVIDER` selects the authentication adapter. It does not enable demo
fixtures. The `development` profile enables them through
`app.demo-fixtures.enabled`; other profiles leave that property disabled.

## Fixture behavior agreed during refinement

- Historical order timestamps span January 2025 through October 2026.
- Dates are authored in the fixture data and may be updated manually as the
  demo data becomes stale.
- Executed orders update holdings, position lots, realized P&L, and cash
  through the normal FIFO accounting service.
- Pending rows do **not** reserve cash. Cash is changed only when an order is
  executed, because pending reservation and release are not implemented in the
  backend yet.
- Watchlists are seeded per persona:
  - `newbie`: default `My Watchlist` with no items.
  - `intermediate`: default `My Watchlist` with a few starter items.
  - `pro`: multiple named watchlists, including empty lists and a high-item list.
- Payment and routing values are synthetic local-development values only.
