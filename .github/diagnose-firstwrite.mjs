/** Throwaway: one login, one read, one write — so a tail alongside it is legible. */
const base = process.env.STAGING_URL?.replace(/\/+$/, ""); // guard:allow-env-credential — diagnostic
const password = process.env.SEED_PASSWORD; // guard:allow-env-credential — diagnostic
let cookie = "";
const remember = (r) => {
  for (const v of r.headers.getSetCookie?.() ?? []) {
    const p = v.split(";")[0];
    if (p) cookie = cookie ? `${cookie}; ${p}` : p;
  }
};
const call = async (label, path, init = {}, ms = 70000) => {
  const t = Date.now();
  try {
    const r = await fetch(base + path, {
      ...init,
      headers: {
        origin: base,
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      signal: AbortSignal.timeout(ms),
      redirect: "manual",
    });
    remember(r);
    const body = await r.text();
    console.log(
      `${label.padEnd(24)} ${r.status} in ${Date.now() - t}ms ${body.slice(0, 80)}`,
    );
  } catch (e) {
    console.log(
      `${label.padEnd(24)} NO RESPONSE after ${Date.now() - t}ms (${e.name})`,
    );
  }
};
await call("login", "/_agent-native/auth/login", {
  method: "POST",
  body: JSON.stringify({ email: "owner@example.invalid", password }),
});
await call("read list-jobs", "/_agent-native/actions/list-jobs", {
  method: "GET",
});
await call("FIRST WRITE create-job", "/_agent-native/actions/create-job", {
  method: "POST",
  body: JSON.stringify({
    customerId: "cus_a",
    title: `First write ${Date.now()}`,
    scheduledAt: "2030-01-15T09:00:00.000Z",
    idempotencyKey: `fw-${Date.now()}`,
  }),
});
