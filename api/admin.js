// /api/admin   POST { action, ... } with  Authorization: Bearer <ADMIN_PASSWORD>
//
//   state      {}          -> { open, subs }
//   setOpen    { open }    -> open or pause collecting
//   remove     { id }      -> delete a submission (the device stays used)

const S = require("./_lib/store");

const body = (req) => {
  if (req.body && typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body || "{}"); } catch { return {}; }
};

async function state() {
  const open = await S.isOpen();
  // device ids are for the duplicate check only; the page doesn't need them
  const subs = (await S.listSubs()).map(({ device, ...s }) => s);
  return { open, subs };
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
        return S.send(res, 200, await state());

      case "setOpen":
        await S.setOpen(!!b.open);
        return S.send(res, 200, await state());

      case "remove":
        await S.redis("HDEL", S.K.subs, String(b.id));
        return S.send(res, 200, await state());

      default:
        return S.send(res, 400, { error: "action" });
    }
  } catch (err) {
    console.error(err);
    return S.send(res, 500, { error: "server" });
  }
};
