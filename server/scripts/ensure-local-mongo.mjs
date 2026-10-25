import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(scriptDir, "..");
const envPath = path.join(serverDir, ".env");

function readEnvValue(key) {
  if (process.env[key]) return process.env[key];
  if (!existsSync(envPath)) return "";

  const match = readFileSync(envPath, "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
  return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };

    socket.setTimeout(1000);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

const mongoUri = readEnvValue("MONGO_URI");
const localReplica = mongoUri.match(/^mongodb:\/\/(?:127\.0\.0\.1|localhost):(\d+)\//);

if (!localReplica) {
  // Atlas or a remote MongoDB is used; do not start a local process.
  process.exit(0);
}

const port = Number(localReplica[1]);
if (port !== 27018) {
  // Some other local MongoDB (for example the Windows service on 27017).
  // The app supports it, but this script only manages its own replica set.
  process.exit(0);
}

if (process.platform !== "win32") {
  if (await isPortOpen(port)) {
    process.exit(0);
  }

  console.error(`Local MongoDB is not running on port ${port}.`);
  console.error("Start a single-node replica set, for example:");
  console.error(`  mongod --replSet rs0 --port ${port} --dbpath /path/to/data`);
  console.error(`  mongosh --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'127.0.0.1:${port}'}]})"`);
  process.exit(1);
}

// Runs idempotently: starts mongod if needed and verifies that rs0 is primary.
const startScript = path.join(scriptDir, "start-local-mongo.ps1");
try {
  execFileSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", startScript],
    { stdio: "inherit", cwd: serverDir }
  );
} catch {
  process.exit(1);
}
