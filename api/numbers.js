// /api/numbers
//   GET -> { ok, people, nums }  every number collected on /szamok, for the
//   "our class" sample on /benford. Numbers only: no names, devices or times.

const S = require("./_lib/store");

module.exports = async (req, res) => {
  if (!S.configured()) return S.send(res, 503, { ok: false, error: "not_configured" });
  if (req.method !== "GET") return S.send(res, 405, { ok: false, error: "method" });

  try {
    const subs = await S.listSubs();
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    // the edge cache keeps a busy page from reading the whole hash on every click
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.end(JSON.stringify({ ok: true, people: subs.length, nums: subs.flatMap((s) => s.nums) }));
  } catch (err) {
    console.error(err);
    return S.send(res, 500, { ok: false, error: "server" });
  }
};
