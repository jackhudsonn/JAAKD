# Transact Page Implementation

## Dual Section Layout

- Top: Deposit/Withdrawal forms (side by side on desktop, tabs to toggle between them in mobile)
- Bottom: Transaction history table

## Key Components

- transact.component.ts (main container)
- DepositFormComponent & WithdrawalFormComponent
- TransactionHistoryComponent (reusable, also sortable/filterable)
- Models: Transaction, Deposit, Withdrawal interfaces in core/models/index.ts

## Mock Data

- Create client/src/app/features/transact/mock-data.ts
- Pre-populate with sample transactions

## Shared Components to Create

- StatusBadge (reusable status indicator: pending → filled → cancelled, etc.)
- FormCard

## Data Flow

- Mock data initially (easy migration to real APIs later with TODO comments)
- Reuse existing scrollable-list for both order & transaction tables
- Typed models in core/models for consistency
