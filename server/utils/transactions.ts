import mongoose, { ClientSession } from "mongoose";
import { logger } from "./logger.js";

export type MongoTopology = "replica-set" | "sharded" | "standalone" | "unknown";

export type TransactionSupport = {
  supported: boolean;
  topology: MongoTopology;
};

let cachedSupport: Promise<TransactionSupport> | null = null;

/**
 * Clear the cached topology result after a reconnect. This lets the app pick
 * up a MongoDB instance that was converted from standalone to a replica set
 * without requiring a full process restart.
 */
export function resetTransactionSupportCache() {
  cachedSupport = null;
}

async function detectTransactionSupport(): Promise<TransactionSupport> {
  const db = mongoose.connection.db;
  if (!db) {
    return { supported: false, topology: "unknown" };
  }

  try {
    const hello = await db.admin().command({ hello: 1 });
    const topology: MongoTopology =
      hello?.msg === "isdbgrid"
        ? "sharded"
        : typeof hello?.setName === "string"
          ? "replica-set"
          : "standalone";

    return { supported: topology !== "standalone", topology };
  } catch (error) {
    // Do not cache a failed probe. A later request can retry after the
    // connection has settled.
    cachedSupport = null;
    logger.warn({ err: error }, "Unable to detect MongoDB transaction support");
    return { supported: false, topology: "unknown" };
  }
}

/**
 * Detect whether the connected MongoDB deployment supports multi-document
 * transactions (replica set or mongos). A standalone server does not.
 */
export async function getTransactionSupport(): Promise<TransactionSupport> {
  if (!mongoose.connection.db) {
    return { supported: false, topology: "unknown" };
  }

  if (!cachedSupport) {
    cachedSupport = detectTransactionSupport();
  }

  return cachedSupport;
}

/**
 * Log the transaction capability once at startup. Standalone MongoDB still
 * works thanks to the compensating-write fallback below, but production
 * should use Atlas or a replica set for true atomicity.
 */
export async function logTransactionSupport(): Promise<void> {
  const support = await getTransactionSupport();

  if (support.supported) {
    logger.info({ topology: support.topology }, "MongoDB transactions enabled");
    return;
  }

  if (support.topology === "standalone") {
    const message =
      "MongoDB is running as a standalone server. Checkout will use compensating writes " +
      "instead of atomic transactions. Use MongoDB Atlas or a local replica set in production.";
    if (process.env.NODE_ENV === "production") {
      logger.error(message);
    } else {
      logger.warn(message);
    }
    return;
  }

  logger.warn(
    "MongoDB transaction support could not be confirmed; checkout will use compensating writes"
  );
}

function isUnsupportedTransactionError(error: unknown): boolean {
  const err = error as { code?: number; codeName?: string; message?: string };
  return (
    err?.code === 20 ||
    err?.codeName === "IllegalOperation" ||
    /Transaction numbers are only allowed/i.test(err?.message ?? "")
  );
}

/**
 * Run `work` inside a MongoDB transaction when the deployment supports one.
 *
 * On a standalone server (or if transaction support is unexpectedly missing),
 * `work` runs without a session and `compensate` is called if it fails. That
 * keeps local development usable while still using real transactions in
 * production (Atlas / replica set / mongos).
 */
export async function runWithOptionalTransaction<T>(
  work: (session: ClientSession | null) => Promise<T>,
  compensate?: () => Promise<void>
): Promise<T> {
  const runFallback = async (): Promise<T> => {
    try {
      return await work(null);
    } catch (error) {
      if (compensate) {
        try {
          await compensate();
        } catch (compensationError) {
          logger.error(
            { err: compensationError },
            "Failed to compensate partial MongoDB writes"
          );
        }
      }
      throw error;
    }
  };

  const support = await getTransactionSupport();
  if (!support.supported) {
    return runFallback();
  }

  const session = await mongoose.startSession();
  try {
    try {
      return await session.withTransaction(() => work(session));
    } catch (error) {
      // Defensive fallback: if the server still rejects transactions (for
      // example the topology changed after the capability probe), retry once
      // with compensating writes instead of failing checkout.
      if (isUnsupportedTransactionError(error)) {
        resetTransactionSupportCache();
        logger.warn(
          { err: error },
          "MongoDB rejected the transaction; retrying with compensating writes"
        );
        return await runFallback();
      }
      throw error;
    }
  } finally {
    await session.endSession();
  }
}
