/**
 * Backfill `paymentStatus` / `paymentEvents` for orders created before those
 * fields existed.
 *
 * Usage:
 *   node scripts/backfill-order-payments.mjs           # dry run (default)
 *   node scripts/backfill-order-payments.mjs --apply   # write changes
 *
 * The script is idempotent: it only touches documents that do not have a
 * `paymentStatus` yet, and it never rewrites existing audit events.
 */
import "dotenv/config";
import mongoose from "mongoose";

const apply = process.argv.includes("--apply");

const derivePaymentStatus = (order) => {
  if (order.paymentMethod === "cod") {
    if (order.status === "delivered") return "paid";
    if (order.status === "cancelled") return "not_required";
    return "unpaid";
  }

  switch (order.status) {
    case "confirmed":
    case "preparing":
    case "outfordelivery":
    case "delivered":
      return "paid";
    case "payment_failed":
      return "failed";
    case "cancelled":
      if (order.refundStatus === "refunded") return "refunded";
      if (order.refundStatus === "pending") return "pending";
      if (order.refundStatus === "failed") return "paid";
      return "unpaid";
    case "pending":
    default:
      return "unpaid";
  }
};

const initialEvent = (order, status) => {
  if (order.paymentMethod === "cod") {
    return {
      type: "cod_order_confirmed",
      status,
      amount: order.totalAmount,
      note: "Backfilled from pre-existing order",
      createdAt: order.createdAt || new Date(),
    };
  }
  return {
    type: "payment_initiated",
    status,
    amount: order.totalAmount,
    note: "Backfilled from pre-existing order",
    createdAt: order.createdAt || new Date(),
  };
};

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const orders = mongoose.connection.collection("orders");

  const filter = { paymentStatus: { $exists: false } };
  const total = await orders.countDocuments(filter);

  console.log(
    `${apply ? "Applying" : "Dry run:"} ${total} order(s) without paymentStatus`,
  );

  if (total === 0 || !apply) {
    if (total > 0) {
      const sample = await orders
        .find(filter, {
          projection: { status: 1, paymentMethod: 1, refundStatus: 1 },
        })
        .limit(5)
        .toArray();
      console.log("Sample:", JSON.stringify(sample, null, 2));
    }
    await mongoose.disconnect();
    return;
  }

  const cursor = orders.find(filter, {
    projection: {
      status: 1,
      paymentMethod: 1,
      refundStatus: 1,
      totalAmount: 1,
      createdAt: 1,
      paymentEvents: 1,
    },
  });

  let updated = 0;
  let operations = [];

  for await (const order of cursor) {
    const paymentStatus = derivePaymentStatus(order);

    operations.push({
      updateOne: {
        filter: { _id: order._id, paymentStatus: { $exists: false } },
        update: {
          $set: {
            paymentStatus,
            ...(order.paymentEvents?.length
              ? {}
              : { paymentEvents: [initialEvent(order, paymentStatus)] }),
          },
        },
      },
    });

    if (operations.length >= 500) {
      const result = await orders.bulkWrite(operations, { ordered: false });
      updated += result.modifiedCount ?? 0;
      operations = [];
    }
  }

  if (operations.length > 0) {
    const result = await orders.bulkWrite(operations, { ordered: false });
    updated += result.modifiedCount ?? 0;
  }

  console.log(`Backfill complete: ${updated} order(s) updated`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Backfill failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
