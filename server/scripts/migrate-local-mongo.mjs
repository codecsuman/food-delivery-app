// Copies the local app database into the user-space replica set used by
// `npm run mongo:start`. Safe by default: it refuses to write into a target
// database that already contains documents.
//
// Usage:
//   node scripts/migrate-local-mongo.mjs
//   SOURCE_MONGO_URI=... TARGET_MONGO_URI=... node scripts/migrate-local-mongo.mjs
import { MongoClient } from "mongodb";

const sourceUri = process.env.SOURCE_MONGO_URI || "mongodb://127.0.0.1:27017/suman_food";
const targetUri =
  process.env.TARGET_MONGO_URI ||
  "mongodb://127.0.0.1:27018/suman_food?replicaSet=rs0";
const force = process.env.FORCE_MIGRATION === "1";

const source = new MongoClient(sourceUri);
const target = new MongoClient(targetUri);

function indexOptions(index) {
  const options = {};
  const allowed = [
    "unique",
    "sparse",
    "expireAfterSeconds",
    "partialFilterExpression",
    "collation",
    "hidden",
    "wildcardProjection",
    "weights",
    "default_language",
    "language_override",
    "textIndexVersion",
    "2dsphereIndexVersion",
    "bits",
    "min",
    "max",
    "bucketSize",
  ];
  for (const key of allowed) {
    if (index[key] !== undefined) options[key] = index[key];
  }
  return options;
}

try {
  await source.connect();
  await target.connect();

  const sourceDb = source.db();
  const targetDb = target.db();
  const collections = await sourceDb.listCollections({}, { nameOnly: true }).toArray();

  const targetCounts = await Promise.all(
    collections.map(async ({ name }) => {
      try {
        return { name, count: await targetDb.collection(name).countDocuments() };
      } catch {
        return { name, count: 0 };
      }
    })
  );
  const nonEmpty = targetCounts.filter(({ count }) => count > 0);

  if (nonEmpty.length > 0 && !force) {
    console.error(
      `Target database "${targetDb.databaseName}" already has data (${nonEmpty
        .map(({ name, count }) => `${name}: ${count}`)
        .join(", ")}).`
    );
    console.error("Set FORCE_MIGRATION=1 only if you intentionally want to merge data.");
    process.exitCode = 1;
  } else {
    let totalDocs = 0;

    for (const { name } of collections) {
      const docs = await sourceDb.collection(name).find({}).toArray();
      if (docs.length > 0) {
        await targetDb.collection(name).insertMany(docs, { ordered: true });
      }
      totalDocs += docs.length;

      const indexes = await sourceDb.collection(name).indexes();
      for (const index of indexes) {
        if (index.name === "_id_") continue;
        await targetDb
          .collection(name)
          .createIndex(index.key, { ...indexOptions(index), name: index.name });
      }

      console.log(`Copied ${docs.length} document(s) from ${name}`);
    }

    console.log(
      `Migration complete: ${totalDocs} document(s) copied to "${targetDb.databaseName}".`
    );
  }
} finally {
  await source.close().catch(() => {});
  await target.close().catch(() => {});
}
