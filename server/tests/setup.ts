import { beforeAll, afterAll, beforeEach, vi } from "vitest";
import fs from "fs";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// =========================
// TEST ENVIRONMENT
// =========================
// These must be set before any application module is imported (Stripe,
// JWT, checkout URLs, etc. read them at module load time).
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.SECRET_KEY =
  process.env.SECRET_KEY || "test-secret-key-that-is-at-least-32-chars-long";
process.env.FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_dummy";
process.env.WEBHOOK_ENDPOINT_SECRET =
  process.env.WEBHOOK_ENDPOINT_SECRET || "whsec_test_dummy";
process.env.OPENCAGE_API_KEY = process.env.OPENCAGE_API_KEY || "test-opencage-key";
process.env.CLOUDINARY_CLOUD_NAME =
  process.env.CLOUDINARY_CLOUD_NAME || "test-cloud";
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "test-key";
process.env.CLOUDINARY_API_SECRET =
  process.env.CLOUDINARY_API_SECRET || "test-secret";

// =========================
// MONGODB TEST SERVER
// =========================
// Prefer an already-installed `mongod` binary. This avoids a 700+ MB
// download at test time and keeps CI/dev runs offline-friendly. A standalone
// mongod cannot run transactions (used by checkout/webhooks), therefore we
// always start a single-node replica set.
const findSystemMongoBinary = (): string | undefined => {
  if (process.env.MONGOMS_SYSTEM_BINARY) {
    return process.env.MONGOMS_SYSTEM_BINARY;
  }

  const candidates: string[] = [
    "/usr/bin/mongod",
    "/usr/local/bin/mongod",
    "/opt/homebrew/bin/mongod",
  ];

  // Windows: pick the newest installed server version.
  const windowsRoot = "C:\\Program Files\\MongoDB\\Server";
  try {
    if (fs.existsSync(windowsRoot)) {
      const versions = fs
        .readdirSync(windowsRoot)
        .filter((name) => fs.existsSync(`${windowsRoot}\\${name}\\bin\\mongod.exe`))
        .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      for (const version of versions) {
        candidates.unshift(`${windowsRoot}\\${version}\\bin\\mongod.exe`);
      }
    }
  } catch {
    // Ignore filesystem permission issues and fall back to auto-download.
  }

  return candidates.find((candidate) => fs.existsSync(candidate));
};

let mongod: MongoMemoryReplSet | null = null;
const externalUri = process.env.MONGODB_TEST_URI;

beforeAll(async () => {
  if (externalUri) {
    await mongoose.connect(externalUri);
    return;
  }

  const systemBinary = findSystemMongoBinary();
  if (systemBinary) {
    process.env.MONGOMS_SYSTEM_BINARY = systemBinary;
  }

  mongod = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(mongod.getUri());
}, 180_000);

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}, 60_000);

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

// =========================
// EXTERNAL SERVICE MOCKS
// =========================
vi.mock("axios", () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { results: [] } }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

vi.mock("../services/mapService.js", () => ({
  default: {
    geocodeAddress: vi.fn().mockResolvedValue({
      success: true,
      coordinates: [88.3639, 22.5726],
      formattedAddress: "Test Address, Kolkata, India",
      confidence: 0.9,
    }),
    reverseGeocode: vi.fn().mockResolvedValue({
      success: true,
      address: "Test Address, Kolkata, India",
      components: { postcode: "700001" },
    }),
    validatePincode: vi.fn().mockResolvedValue({
      valid: true,
      message: "Pincode verified",
      city: "Kolkata",
      district: "Kolkata",
      state: "West Bengal",
      country: "India",
    }),
    lookupPincode: vi.fn().mockResolvedValue({
      success: true,
      pincode: "700001",
      city: "Kolkata",
      district: "Kolkata",
      state: "West Bengal",
      country: "India",
      postOffices: [],
    }),
    getDistanceAndTime: vi.fn().mockResolvedValue({
      success: true,
      distanceKm: 5,
      estimatedMinutes: 15,
      estimatedTimeFormatted: "15 min",
      withinRange: true,
      maxRadius: 10,
    }),
    checkDeliveryRange: vi.fn().mockResolvedValue({
      success: true,
      deliverable: true,
      distanceKm: 5,
      estimatedMinutes: 15,
      estimatedTimeFormatted: "15 min",
      withinRange: true,
      maxRadius: 10,
    }),
    getRouteCoordinates: vi.fn().mockReturnValue([[88.3639, 22.5726], [88.3739, 22.5826]]),
    calculateDistanceKm: vi.fn().mockReturnValue(5),
  },
}));

vi.mock("../utils/cloudinary.js", () => ({
  uploadImage: vi.fn().mockResolvedValue({
    secure_url: "https://test.cloudinary.com/image.jpg",
    public_id: "test/image",
  }),
  deleteImage: vi.fn().mockResolvedValue(undefined),
  getPublicIdFromUrl: vi.fn().mockReturnValue("test/image"),
}));

// Mock Stripe. `default` must be constructible because the app does
// `new Stripe(...)` at module load; arrow-function implementations are not
// constructors, hence the small class wrapper.
vi.mock("stripe", () => {
  const mockStripeInstance = {
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: "cs_test_123",
          url: "https://checkout.stripe.com/test",
          payment_intent: "pi_test_123",
        }),
        retrieve: vi.fn().mockResolvedValue({
          id: "cs_test_123",
          metadata: { orderId: "507f1f77bcf86cd799439011" },
          amount_total: 50000,
          payment_intent: "pi_test_123",
        }),
      },
    },
    webhooks: {
      constructEvent: vi.fn((payload: Buffer | string, signature: string) => {
        if (signature !== "valid-signature") {
          throw new Error("No signatures found matching the expected signature");
        }
        return JSON.parse(payload.toString());
      }),
    },
    refunds: {
      create: vi.fn().mockResolvedValue({ id: "re_test_123" }),
    },
  };

  class MockStripe {
    constructor() {
      return mockStripeInstance as unknown as MockStripe;
    }
  }

  return { default: MockStripe };
});

// Mock logger to reduce noise in tests
vi.mock("../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  createChildLogger: vi.fn(),
}));
