// Shared helpers for the /szamok collection API.
// Vercel skips files under an underscore folder when it builds routes, so
// this is only ever required by the functions next to it.
//
// Storage is Upstash Redis over its REST API (plain fetch, no packages).
// Connecting an Upstash database to the Vercel project adds the env vars;
// both naming schemes it has used are accepted.

const crypto = require("crypto");

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
// the admin password, set in Vercel as ADMIN_PASSWORD or simply "pass"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || process.env.pass || "";

const configured = () => Boolean(URL_ && TOKEN);

async function call(path, body) {
  const res = await fetch(URL_ + path, {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("redis " + res.status);
  return res.json();
}

// one command: redis("HGET", key, field)
async function redis(...cmd) {
  const out = await call("", cmd);
  if (out.error) throw new Error(out.error);
  return out.result;
}

// several commands in one round trip: pipeline([["SET", k, v], ["GET", k]])
async function pipeline(cmds) {
  const out = await call("/pipeline", cmds);
  return out.map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

/* ---------------- keys ---------------- */

// One collection: everyone submits into the same list, once per device.
const K = {
  open: "szamok:open", // "1" while collecting, "0" while paused
  subs: "szamok:subs", // hash: submission id -> JSON
  devices: "szamok:devices", // set of device ids that already submitted
  rate: (ip, bucket) => `szamok:rate:${ip}:${bucket}`,
  authFail: (ip) => `szamok:authfail:${ip}`,
};

const newId = () => Date.now().toString(36) + crypto.randomBytes(3).toString("hex");

const setOpen = (open) => redis("SET", K.open, open ? "1" : "0");

// Earlier versions collected in rounds. The first call after the switch
// moves the round that was collecting into the single collection.
// Returns whether that round was open.
async function migrateRounds() {
  const id = await redis("GET", "szamok:current");
  if (!id) return true;
  const raw = await redis("HGET", "szamok:rounds", id);
  const [hasSubs, hasDevices] = await pipeline([["EXISTS", `szamok:r:${id}:subs`], ["EXISTS", `szamok:r:${id}:devices`]]);
  const moves = [["DEL", "szamok:current"]];
  if (hasSubs) moves.push(["RENAME", `szamok:r:${id}:subs`, K.subs]);
  if (hasDevices) moves.push(["RENAME", `szamok:r:${id}:devices`, K.devices]);
  await pipeline(moves);
  return raw ? JSON.parse(raw).open !== false : true;
}

// Whether submissions are accepted right now.
async function isOpen() {
  const v = await redis("GET", K.open);
  if (v != null) return v === "1";
  // SET … NX: only the first request ever runs the migration
  if (!(await redis("SET", K.open, "1", "NX"))) return (await redis("GET", K.open)) === "1";
  const open = await migrateRounds();
  if (!open) await setOpen(false);
  return open;
}

async function listSubs() {
  const raw = (await redis("HGETALL", K.subs)) || [];
  // Upstash returns HGETALL as a flat [field, value, field, value…] list
  const subs = [];
  for (let i = 1; i < raw.length; i += 2) subs.push(JSON.parse(raw[i]));
  return subs.sort((a, b) => a.t - b.t);
}

/* ---------------- request helpers ---------------- */

function clientIp(req) {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || String(req.headers["x-real-ip"] || "") || "unknown";
}

// Fixed-window counter. Returns true while under the limit.
async function underLimit(key, limit, windowSec) {
  // SET … NX starts the window only if it isn't running; INCR then counts
  const [, count] = await pipeline([["SET", key, "0", "EX", String(windowSec), "NX"], ["INCR", key]]);
  return count <= limit;
}

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

// constant-time password check
function passwordOk(given) {
  if (!ADMIN_PASSWORD || typeof given !== "string") return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(ADMIN_PASSWORD).digest();
  return crypto.timingSafeEqual(a, b);
}

/* ---------------- the rules ---------------- */

const COUNT = 10, MIN = 1, MAX = 9999;

const isRepdigit = (n) => n >= 11 && /^(\d)\1+$/.test(String(n));

// Hard rules reject a submission outright; the person is told what to fix.
// They only catch sets that aren't a real attempt, so they don't steer what
// people make up. Returns an error code or null.
function reject(nums, others) {
  if (!Array.isArray(nums) || nums.length !== COUNT) return "count";
  if (!nums.every((n) => Number.isInteger(n) && n >= MIN && n <= MAX)) return "range";
  if (new Set(nums).size !== COUNT) return "repeat";

  // 1 2 3 … or 100 200 300 …: an evenly spaced run, in any order
  const sorted = [...nums].sort((a, b) => a - b);
  const step = sorted[1] - sorted[0];
  if (sorted.every((n, i) => i === 0 || n - sorted[i - 1] === step)) return "sequence";

  // mostly 11, 222, 3333…
  if (nums.filter(isRepdigit).length >= 6) return "pattern";

  // a copy (or near copy) of a set already submitted
  const mine = new Set(nums);
  for (const o of others) {
    let same = 0;
    for (const n of o.nums) if (mine.has(n)) same++;
    if (same >= 7) return "copy";
  }
  return null;
}

const hasPassword = () => Boolean(ADMIN_PASSWORD);

module.exports = {
  configured, hasPassword, redis, pipeline, K, newId, isOpen, setOpen, listSubs,
  clientIp, underLimit, send, passwordOk, reject, COUNT, MIN, MAX,
};
