// /api/admin   POST { action, ... } with  Authorization: Bearer <ADMIN_PASSWORD>
//
//   state      { round? }         -> { current, rounds, round, subs }
//   newRound   { name }           -> start a round and make it the current one
//   setOpen    { round, open }    -> open or close collecting
//   setCurrent { round }          -> switch which round collects
//   remove     { round, id }      -> delete a submission (the device stays used)

const S = require("./_lib/store");

const body = (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
};

async function state(roundId) {
  const current = await S.currentRound();
  const raw = (await S.redis("HGETALL", S.K.rounds)) || [];
  const rounds = [];
  for (let i = 1; i < raw.length; i += 2) rounds.push(JSON.parse(raw[i]));
  rounds.sort((a, b) => b.created - a.created);
  const round = rounds.find((r) => r.id === roundId) || current;
  // device ids are for the duplicate check only; the page doesn't need them
  const subs = (await S.listSubs(round.id)).map(({ device, ...s }) => s);
  return { current: current.id, rounds, round, subs };
}

module.exports = async (req, res) => {
  if (!S.configured()) return S.send(res, 503, { error: "not_configured" });
  if (!S.hasPassword()) return S.send(res, 503, { error: "no_password" });
  if (req.method !== "POST") return S.send(res, 405, { error: "method" });

  try {
    const ip = S.clientIp(req);
    const failKey = S.K.authFail(ip);
    const fails = Number(await S.redis("GET", failKey)) || 0;
    if (fails >= 10) return S.send(res, 429, { error: "locked" });

    const auth = String(req.headers.authorization || "");
    if (!S.passwordOk(auth.replace(/^Bearer\s+/i, ""))) {
      await S.pipeline([["INCR", failKey], ["EXPIRE", failKey, "900"]]);
      return S.send(res, 401, { error: "password" });
    }

    const b = body(req);
    switch (b.action) {
      case "state":
        return S.send(res, 200, await state(b.round));

      case "newRound": {
        const name = String(b.name || "").trim().slice(0, 60) || new Date().toISOString().slice(0, 10);
        const round = await S.saveRound({ id: S.newId(), name, created: Date.now(), open: true });
        await S.redis("SET", S.K.current, round.id);
        return S.send(res, 200, await state(round.id));
      }

      case "setOpen": {
        const round = await S.getRound(String(b.round));
        if (!round) return S.send(res, 404, { error: "round" });
        round.open = !!b.open;
        await S.saveRound(round);
        return S.send(res, 200, await state(round.id));
      }

      case "setCurrent": {
        const round = await S.getRound(String(b.round));
        if (!round) return S.send(res, 404, { error: "round" });
        await S.redis("SET", S.K.current, round.id);
        return S.send(res, 200, await state(round.id));
      }

      case "remove": {
        await S.redis("HDEL", S.K.subs(String(b.round)), String(b.id));
        return S.send(res, 200, await state(String(b.round)));
      }

      default:
        return S.send(res, 400, { error: "action" });
    }
  } catch (err) {
    console.error(err);
    return S.send(res, 500, { error: "server" });
  }
};
