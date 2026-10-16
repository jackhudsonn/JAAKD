# Demo users

`scripts/seed-demo-users.js` creates three local-only accounts that give
developers realistic profiles to use while building and reviewing features:

| Account | Purpose |
| --- | --- |
| `demo.newbie@jaakd.local` | A newly onboarded user with a profile and payment method, but no transactions, trades, holdings, or order-log rows. |
| `demo.intermediate@jaakd.local` | A smaller portfolio with executed trades plus pending, rejected, and failed order examples. |
| `demo.pro@jaakd.local` | A populated multi-instrument portfolio with about 40 executed trades, about 10 funding rows, and a balanced set of pending, rejected, failed, and cancelled examples. |

The script uses the existing application APIs and the existing FIFO accounting
service for executed fixtures. It does not change the database schema. The
development-only `/api/order-logs/demo` endpoint accepts an authored status and
historical timestamp so seed data is not run through the live market-hours
validation path.

## Running the seed

Start the local stack, then run:

```sh
DEV_DEMO_USERS=true node scripts/seed-demo-users.js
```

`DEV_DEMO_USERS=true` is required as an explicit opt-in. The backend must use
the development identity provider; the demo endpoint rejects other providers.

The script intentionally stops if any of the three demo accounts already
exists. To recreate them from a clean local database:

```sh
docker compose down -v
docker compose up -d --build
DEV_DEMO_USERS=true node scripts/seed-demo-users.js
```

The credentials are printed by the script and are also defined near the top of
the script for local development.

## Fixture behavior agreed during refinement

- Historical order timestamps span January 2025 through October 2026.
- Dates are authored in the fixture data and may be updated manually as the
  demo data becomes stale.
- Executed orders update holdings, position lots, realized P&L, and cash
  through the normal FIFO accounting service.
- Pending rows do **not** reserve cash. Cash is changed only when an order is
  executed, because pending reservation and release are not implemented in the
  backend yet.
- Payment and routing values are synthetic local-development values only.

## Future work

- Implement pending cash reservations and release them when an order is
  cancelled, rejected, failed, or otherwise leaves the pending lifecycle.
