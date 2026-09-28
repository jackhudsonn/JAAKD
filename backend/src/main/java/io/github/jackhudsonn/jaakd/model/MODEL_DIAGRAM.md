# Entity Relationship Diagram

## Domain Model

> **Architecture Note (2026-09-24):** `OrderLog` remains the source of truth. `Holding` is now a persisted projection keyed by `(portfolioID, instrumentID)` and updated by FIFO accounting using `PositionLot` and `LotMatch`.

```mermaid
erDiagram
  PROFILE ||--o{ PORTFOLIO : owns
  PORTFOLIO ||--o{ HOLDING : contains
  PORTFOLIO ||--o{ ORDER_LOG : logs
  PORTFOLIO ||--o{ WATCHLIST_ITEM : contains
  HOLDING }o--|| INSTRUMENT : "ref via UUID"
  ORDER_LOG }o--|| INSTRUMENT : "references"
  WATCHLIST_ITEM }o--|| INSTRUMENT : "references"

  PROFILE {
    uuid userID PK
    string email
    decimal userType
    string firstName
    string lastName
    string city
    string state
    string country
    string zipCode
    date dob
    string username
    string avatar
  }

  PORTFOLIO {
    uuid portfolioID PK
    uuid userID FK
    string portfolioName
  }

  HOLDING {
    uuid holdingID PK
    uuid portfolioID "UUID only"
    uuid instrumentID "UUID only"
    decimal currentQuantity
    decimal cumulativeRealizedPnl
    datetime updatedAt
  }

  POSITION_LOT {
    uuid positionLotID PK
    uuid holdingID FK
    uuid sourceBuyLogOrderID FK
    datetime openedAt
    decimal originalQuantity
    decimal remainingQuantity
    decimal unitCost
  }

  LOT_MATCH {
    uuid lotMatchID PK
    uuid sellLogOrderID FK
    uuid positionLotID FK
    uuid holdingID FK
    decimal matchedQuantity
    decimal sellUnitPrice
    decimal realizedPnlAmount
    datetime matchedAt
  }

  INSTRUMENT {
    uuid instrumentID PK
    string ticker
    string market
    string name
    enum instrumentClass
    string logoUrl
    string description
  }

  ORDER_LOG {
    uuid logOrderID PK
    uuid orderID "shared across statuses"
    uuid portfolioID FK
    uuid instrumentID FK
    enum side
    double quantity
    datetime timestamp
    string metadata
    enum status
    double executionPrice
  }

  WATCHLIST_ITEM {
    uuid listItemID PK
    uuid portfolioID FK
    uuid instrumentID FK
    string name
  }
```

## Key Relationships

### Ownership Hierarchy
- **Profile** → **Portfolio** (1:N)
- **Portfolio** → **Holding** (1:N)
- **Portfolio** → **WatchlistItem** (1:N)

### Reference Data
- **Holding** → **Instrument** (N:1) by UUID
- **OrderLog** → **Instrument** (N:1)
- **WatchlistItem** → **Instrument** (N:1)

### Execution / Aggregation
- **Portfolio** → **OrderLog** (1:N)
- **Holding** is a persisted projection updated on each EXECUTED BUY/SELL
- **PositionLot** stores FIFO buy lots
- **LotMatch** stores sell-to-lot realization slices for audit and realized PnL

## Special Fields

- **OrderLog.orderID**: Shared UUID for a logical order lifecycle (SUBMITTED → EXECUTED/FAILED).
- **OrderLog.logOrderID**: Unique row identifier for each lifecycle event.
