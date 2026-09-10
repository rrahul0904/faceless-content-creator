const base = process.env.APP_URL || "http://localhost:3000";
const health = await fetch(`${base}/api/health`);
if (!health.ok) throw new Error(`health failed: ${health.status}`);
const json = await health.json();
if (!json.ok) throw new Error("health response not ok");
console.log("Smoke test passed", json);
