import type { Server as SocketServer } from "socket.io";

/**
 * Socket.IO fan-out for order lifecycle changes.
 *
 * The HTTP controllers create and mutate orders, but the live views (customer
 * tracking page + restaurant dashboard) listen on Socket.IO. Rather than
 * importing the server instance into every controller (which would create a
 * circular dependency with `index.ts`), `index.ts` registers the server here
 * once at startup and controllers call the helpers below.
 *
 * Rooms:
 * - `order:<orderId>`      — the customer tracking page
 * - `restaurant:<id>`      — the owner dashboard (all owned restaurants)
 */
let io: SocketServer | null = null;

export const setSocketServer = (server: SocketServer): void => {
  io = server;
};

export interface OrderEventPayload {
  orderId: string;
  restaurantId: string;
  status: string;
  totalAmount?: number;
  cancellationReason?: string | null;
  cancelledAt?: Date | null;
  cancelledBy?: string | null;
  refundStatus?: string | null;
  paymentStatus?: string | null;
  createdAt?: Date;
}

const orderRoom = (orderId: string) => `order:${orderId}`;
const restaurantRoom = (restaurantId: string) => `restaurant:${restaurantId}`;

/**
 * Broadcast a status change to the customer viewing the order and to the
 * restaurant dashboard. Safe to call before the socket server exists (e.g. in
 * unit tests or a worker-only process): it becomes a no-op.
 */
export const emitOrderStatus = (payload: OrderEventPayload): void => {
  if (!io) return;
  io.to(orderRoom(payload.orderId)).emit("order:status", payload);
  io.to(restaurantRoom(payload.restaurantId)).emit("order:status", payload);
};

/**
 * Tell the restaurant dashboard that a new (payable) order exists so it can
 * refresh immediately instead of waiting for its polling interval.
 */
export const emitNewOrder = (payload: OrderEventPayload): void => {
  if (!io) return;
  io.to(restaurantRoom(payload.restaurantId)).emit("order:new", payload);
};
