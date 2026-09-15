/**
 * Throwaway diagnostic — see .github/workflows/diagnose-staging.yml.
 * Prints status, elapsed time and the serving Cloudflare colo per request.
 * No secret is printed.
 */
// guard:allow-env-credential — throwaway diagnostic; the workflow supplies these and nothing is logged
const base = process.env.STAGING_URL?.replace(/\/+$/, "");
// guard:allow-env-credential — throwaway diagnostic; the value is sent to the app and never printed
const password = process.env.SEED_PASSWORD;
if (!base || !password)
  throw new Error("STAGING_URL and SEED_PASSWORD are required");

let cookie = "";
function remember(r) {
  for (const v of r.headers.getSetCookie?.() ?? []) {
    const p = v.split(";")[0];
    if (p) cookie = cookie ? `${cookie}; ${p}` : p;
  }
}
async function call(label, path, { method = "GET", body, ms = 20000 } = {}) {
  const started = Date.now();
  try {
    const r = await fetch(base + path, {
      method,
      headers: {
        ...(method === "GET"
          ? {}
          : { origin: base, "content-type": "application/json" }),
        ...(cookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: "manual",
      signal: AbortSignal.timeout(ms),
    });
    remember(r);
    const ray = r.headers.get("cf-ray") ?? "(none)";
    const text = await r.text();
    console.log(
      `${label.padEnd(30)} ${String(r.status).padEnd(12)} ${String(Date.now() - started).padStart(6)}ms  colo=${ray.split("-")[1] ?? "?"}  ray=${ray}  ${text.replace(/\s+/g, " ").slice(0, 90)}`,
    );
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  } catch (error) {
    console.log(
      `${label.padEnd(30)} ${"NO RESPONSE".padEnd(12)} ${String(Date.now() - started).padStart(6)}ms  ${error.name}`,
    );
    return undefined;
  }
}

console.log("request                        status         elapsed  colo\n");
await call("GET  ping", "/_agent-native/ping");
await call("GET  health", "/_agent-native/health");
// A POST that writes through Better Auth — the control: this one passes in CI.
await call("POST auth/login", "/_agent-native/auth/login", {
  method: "POST",
  body: { email: "owner@example.invalid", password },
});
await call("GET  list-customers", "/_agent-native/actions/list-customers");
await call("GET  list-jobs", "/_agent-native/actions/list-jobs");
// The suspect: the only path through `runAtomic` -> D1 `atomicBatch`.
const runId = `diag-${Date.now()}`;
await call(
  "POST create-job (atomicBatch)",
  "/_agent-native/actions/create-job",
  {
    method: "POST",
    body: {
      customerId: "cus_a",
      title: `Diag ${runId}`,
      scheduledAt: "2030-01-15T09:00:00.000Z",
      idempotencyKey: runId,
    },
  },
);
// Again, with a longer ceiling: does it ever finish, or never?
await call(
  "POST create-job (60s ceiling)",
  "/_agent-native/actions/create-job",
  {
    method: "POST",
    ms: 60000,
    body: {
      customerId: "cus_a",
      title: `Diag ${runId}-b`,
      scheduledAt: "2030-01-15T09:00:00.000Z",
      idempotencyKey: `${runId}-b`,
    },
  },
);
console.log(
  "\nIf the writes never answer but login did, the difference is the batch write, not POST or auth.",
);
console.log(
  "Compare the colo above with a run of the same probe from a developer machine.",
);
