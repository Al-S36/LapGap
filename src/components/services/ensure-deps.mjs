import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";

const ROOT = resolve(process.cwd());
const NODE_MODULES = resolve(ROOT, "node_modules");
const STAMP_DIR = resolve(NODE_MODULES, ".cache");
const STAMP = resolve(STAMP_DIR, "lock.sha256");

const LOCK_FILES = ["package-lock.json", "npm-shrinkwrap.json"];
const PKG_JSON = resolve(ROOT, "package.json");

function firstExistingLock() {
  for (const f of LOCK_FILES) {
    const p = resolve(ROOT, f);
    if (existsSync(p)) return p;
  }
  return null;
}

function fileSha256(path) {
  if (!path || !existsSync(path)) return "";
  const buf = readFileSync(path);
  return createHash("sha256").update(buf).digest("hex");
}

function ensureDir(p) {
  const dir = dirname(p);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: true, ...opts });
  if (r.status !== 0) process.exit(r.status || 1);
  return r;
}

const lockPath = firstExistingLock();
const basisForHash = lockPath || PKG_JSON;
const currentHash = fileSha256(basisForHash);
const haveNM = existsSync(NODE_MODULES);

let stampedHash = "";
try {
  if (existsSync(STAMP)) stampedHash = readFileSync(STAMP, "utf8").trim();
} catch {}

let needsInstall = !haveNM || !stampedHash || stampedHash !== currentHash;

let needsRepair = false;
if (!needsInstall && haveNM) {
  const r = spawnSync("npm", ["ls", "--depth=0", "--omit=optional"], {
    stdio: "ignore",
    shell: true,
  });
  needsRepair = r.status !== 0;
}

if (needsInstall || needsRepair) {
  console.log("• Installing dependencies…");
  if (lockPath) {
    sh("npm", ["ci", "--no-audit", "--no-fund"]);
  } else {
    sh("npm", ["install", "--no-audit", "--no-fund"]);
  }
  const newLock = firstExistingLock() || PKG_JSON;
  const newHash = fileSha256(newLock);
  ensureDir(STAMP);
  writeFileSync(STAMP, newHash, "utf8");
}
