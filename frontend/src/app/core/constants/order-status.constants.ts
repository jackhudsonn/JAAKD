export const ORDER_STATUS = {
  SUBMITTED: 'SUBMITTED',
  PENDING: 'PENDING',
  CANCELLED: 'CANCELLED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXECUTED: 'EXECUTED',
  FAILED: 'FAILED',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

export const ACTIVE_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  ORDER_STATUS.SUBMITTED,
  ORDER_STATUS.PENDING,
  ORDER_STATUS.ACCEPTED,
]);

export const isActiveOrderStatus = (status: OrderStatus): boolean =>
  ACTIVE_ORDER_STATUSES.has(status);
