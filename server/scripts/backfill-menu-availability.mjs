/**
 * Backfill `isAvailable: true` for menu items created before the field existed.
 *
 * Usage:
 *   node scripts/backfill-menu-availability.mjs           # dry run (default)
 *   node scripts/backfill-menu-availability.mjs --apply   # write changes
 *
 * Safe and idempotent: only documents missing the field are touched, and the
 * value written is `true` (i.e. nothing a customer can currently order
 * disappears).
 */
import "dotenv/config";
import mongoose from "mongoose";

const apply = process.argv.includes("--apply");

const run = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("MONGO_URI is not set");
    process.exit(1);
  }

  await mongoose.connect(uri);
  const menus = mongoose.connection.collection("menus");

  const filter = { isAvailable: { $exists: false } };
  const total = await menus.countDocuments(filter);

  console.log(
    `${apply ? "Applying" : "Dry run:"} ${total} menu item(s) without isAvailable`,
  );

  if (total === 0 || !apply) {
    await mongoose.disconnect();
    return;
  }

  const result = await menus.updateMany(filter, {
    $set: { isAvailable: true },
  });

  console.log(`Backfill complete: ${result.modifiedCount} menu item(s) updated`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Backfill failed:", error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
