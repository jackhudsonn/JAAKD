import { Transaction } from '../../core/models';

// TODO: replace with TransactionService.getHistory() once the backend endpoint exists.
export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'txn-1001',
    type: 'deposit',
    amount: 5000,
    method: 'bank_transfer',
    status: 'completed',
    createdAt: '2026-08-28T14:32:00Z',
  },
  {
    id: 'txn-1002',
    type: 'withdrawal',
    amount: 750,
    method: 'bank_transfer',
    status: 'completed',
    createdAt: '2026-08-26T09:05:00Z',
  },
  {
    id: 'txn-1003',
    type: 'deposit',
    amount: 1200,
    method: 'card',
    status: 'pending',
    createdAt: '2026-08-25T18:47:00Z',
  },
  {
    id: 'txn-1004',
    type: 'withdrawal',
    amount: 300,
    method: 'crypto_wallet',
    status: 'failed',
    createdAt: '2026-08-22T11:20:00Z',
  },
  {
    id: 'txn-1005',
    type: 'deposit',
    amount: 2500,
    method: 'crypto_wallet',
    status: 'completed',
    createdAt: '2026-08-19T07:58:00Z',
  },
  {
    id: 'txn-1006',
    type: 'withdrawal',
    amount: 1000,
    method: 'card',
    status: 'cancelled',
    createdAt: '2026-08-15T16:10:00Z',
  },
  {
    id: 'txn-1007',
    type: 'deposit',
    amount: 400,
    method: 'bank_transfer',
    status: 'completed',
    createdAt: '2026-08-10T13:03:00Z',
  },
  {
    id: 'txn-1008',
    type: 'withdrawal',
    amount: 150,
    method: 'crypto_wallet',
    status: 'pending',
    createdAt: '2026-08-05T20:44:00Z',
  },
];
