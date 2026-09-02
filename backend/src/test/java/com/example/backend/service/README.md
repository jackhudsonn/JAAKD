# OrdersService Tests

Unit tests for [OrdersService.java](../../../../../../main/java/com/example/backend/service/OrdersService.java), covering the place → accept → execute order lifecycle.

## What's covered

- `ping()` sanity check
- `placeOrder()` — successful buy, portfolio-ownership validation, insufficient cash, insufficient stock for sell, invalid side
- `acceptOrder()` — successful 110% cash reservation for buy, insufficient cash at acceptance, missing holding for sell
- `executeOrder()` — successful buy (cash debited, holding created), execution price exceeding the 110% limit, successful sell (holding reduced, cash credited)

All repositories (`TradeOrderRepository`, `OrderLogRepository`, `PortfolioRepository`, `InstrumentRepository`, `HoldingRepository`) and `CurrentUserService` are mocked with Mockito — no database or Spring context is started, so tests run fast.

## Running the tests

From the `backend/` directory:

```powershell
# Run just this test class
.\mvnw.cmd -Dtest=OrdersServiceTest test

# Run the whole backend test suite
.\mvnw.cmd test
```

Or in VS Code: open [OrdersServiceTest.java](./OrdersServiceTest.java) and use the "Run Test" / "Debug Test" CodeLens above any `@Test` method or the class declaration.

## Adding new cases

Follow the existing pattern per method group (`placeOrder`/`acceptOrder`/`executeOrder`): build a `Portfolio`/`TradeOrder`/`Holding` fixture, stub the repository calls it needs with Mockito's `when(...)`, then assert the return value and/or resulting state changes, or assert a thrown `IllegalArgumentException` with `assertThatThrownBy`.
