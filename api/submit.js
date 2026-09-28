// /api/submit
//   GET  -> { round, open }            which round is collecting right now
//   POST { nums, name?, device, website } -> { ok } or { ok: false, error }
//
// Error codes the page turns into messages: count, range, repeat, sequence,
// pattern, copy, already, closed, busy, not_configured.

const S = require("./_lib/store");

const body = (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
};

// letters, digits, spaces and a little punctuation, at most 40 characters
const cleanName = (s) => String(s || "").replace(/[^\p{L}\p{N} .'\-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 40);

module.exports = async (req, res) => {
  if (!S.configured()) return S.send(res, 503, { ok: false, error: "not_configured" });

  try {
    if (req.method === "GET") {
      const round = await S.currentRound();
      return S.send(res, 200, { round: round.id, open: round.open });
    }
    if (req.method !== "POST") return S.send(res, 405, { ok: false, error: "method" });

    const b = body(req);

    // a field people never see: bots fill it in, so pretend it worked
    if (b.website) return S.send(res, 200, { ok: true });

    // generous enough for a whole school behind one address, tight enough for scripts
    const ip = S.clientIp(req);
    if (!(await S.underLimit(S.K.rate(ip, "submit"), 60, 600))) return S.send(res, 429, { ok: false, error: "busy" });

    const round = await S.currentRound();
    if (!round.open) return S.send(res, 200, { ok: false, error: "closed" });

    const device = String(b.device || "").slice(0, 64);
    if (!/^[\w-]{8,64}$/.test(device)) return S.send(res, 400, { ok: false, error: "device" });
    if (await S.redis("SISMEMBER", S.K.devices(round.id), device)) return S.send(res, 200, { ok: false, error: "already" });

    const nums = Array.isArray(b.nums) ? b.nums.map(Number) : null;
    const others = await S.listSubs(round.id);
    const problem = S.reject(nums, others);
    if (problem) return S.send(res, 200, { ok: false, error: problem });

    // SADD answers 0 if this device got in first from another tab
    if (!(await S.redis("SADD", S.K.devices(round.id), device))) return S.send(res, 200, { ok: false, error: "already" });

    const sub = { id: S.newId(), t: Date.now(), name: cleanName(b.name), nums, flags: S.flagsFor(nums), device };
    await S.redis("HSET", S.K.subs(round.id), sub.id, JSON.stringify(sub));
    return S.send(res, 200, { ok: true });
  } catch (err) {
    console.error(err);
    return S.send(res, 500, { ok: false, error: "server" });
  }
};
