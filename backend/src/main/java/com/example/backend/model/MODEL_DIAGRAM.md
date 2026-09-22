# Entity Relationship Diagram

## Domain Model

```mermaid
erDiagram
    PROFILE ||--o{ PORTFOLIO : owns
    PORTFOLIO ||--o{ HOLDING : contains
    PORTFOLIO ||--o{ ORDER_LOG : logs
    PORTFOLIO ||--o{ WATCHLIST_ITEM : contains
    INSTRUMENT ||--o{ HOLDING : "referenced by"
    INSTRUMENT ||--o{ ORDER_LOG : "referenced by"
    INSTRUMENT ||--o{ WATCHLIST_ITEM : "referenced by"
    HOLDING ||--o{ TRADE : "creates"
    TRADE ||--o| ORDER_LOG : "executes"

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
        uuid portfolioID FK
        uuid instrumentID FK
        double currentQuantity
    }

    INSTRUMENT {
        uuid instrumentID PK
        string ticker
        string market
        string name
        enum instrumentClass
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

    TRADE {
        uuid tradeID PK
        uuid holdingID FK
        uuid orderLogID FK
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
- **Profile** → **Portfolio** (1:N) - Users own multiple portfolios
- **Portfolio** → **Holding** (1:N) - Portfolios contain multiple holdings with cascade delete
- **Portfolio** → **WatchlistItem** (1:N) - Portfolios contain multiple watchlist items with cascade delete

### Reference Data
- **Instrument** → **Holding** (1:N) - Reference data, no cascade
- **Instrument** → **OrderLog** (1:N) - Reference data, no cascade
- **Instrument** → **WatchlistItem** (1:N) - Reference data, no cascade

### Order & Trade Tracking
- **Portfolio** → **OrderLog** (1:N) - Historical order records grouped by orderId, no cascade
- **OrderLog** → **Trade** (0..1) - Orders may or may not be executed; executed orders create exactly one trade, no cascade
- **Holding** → **Trade** (1:N) - Trades linked to holdings with cascade delete

## Cascade Rules

| Relationship | Cascade Type | Orphan Removal |
|---|---|---|
| Portfolio → Holding | REMOVE | Yes |
| Portfolio → WatchlistItem | REMOVE | Yes |
| Holding → Trade | ALL | Yes |
| All others | None | No |

## Special Fields

- **OrderLog.orderID**: Shared UUID across multiple OrderLog records for the same logical order through its lifecycle (PENDING → EXECUTED/CANCELLED)
- **OrderLog.logOrderID**: Unique identifier for each individual state record
