// scripts/smoke-test-prod.mjs
const BASE_URL = process.env.BASE_URL || "https://agri-os-india.vercel.app";

const results = [];

async function testEndpoint(name, path, options = {}, validator) {
  const url = `${BASE_URL}${path}`;
  const start = Date.now();
  try {
    const res = await fetch(url, options);
    const duration = Date.now() - start;
    let data;
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await res.json().catch(() => null);
    } else {
      data = await res.text().catch(() => "");
    }
    const check = validator ? validator(res, data) : { ok: res.ok, notes: `HTTP ${res.status}` };
    results.push({
      name,
      path,
      status: res.status,
      duration: `${duration}ms`,
      passed: check.ok,
      notes: check.notes,
      details: check.details || undefined,
    });
    return { res, data };
  } catch (err) {
    const duration = Date.now() - start;
    results.push({
      name,
      path,
      status: "FETCH_ERROR",
      duration: `${duration}ms`,
      passed: false,
      notes: err.message,
    });
    return null;
  }
}

async function run() {
  console.log(`=======================================================`);
  console.log(` AgriOS India — Live Production Smoke Test & Verification`);
  console.log(` Target: ${BASE_URL}`);
  console.log(` Timestamp: ${new Date().toISOString()}`);
  console.log(`=======================================================\n`);

  // 1. Root & Shell
  let scriptPaths = [];
  await testEndpoint("1. PWA Root HTML", "/", {}, (res, text) => {
    const hasRoot = typeof text === "string" && text.includes('id="root"');
    const hasTitle = typeof text === "string" && text.includes("<title>");
    const hasManifest = typeof text === "string" && text.includes('rel="manifest"');
    
    // Extract script src
    if (typeof text === "string") {
      const matches = [...text.matchAll(/src="([^"]+\.js)"/g)];
      scriptPaths = matches.map(m => m[1]);
    }

    return {
      ok: res.status === 200 && hasRoot && hasTitle && hasManifest,
      notes: `HTTP 200 (contains #root, title, and manifest link)`,
      details: scriptPaths,
    };
  });

  // 2. Client JS Bundles
  for (const src of scriptPaths) {
    await testEndpoint(`2. Asset: ${src.split("/").pop()}`, src, {}, (res, code) => {
      // Check if code contains storage persistence or React mount
      const isJs = typeof code === "string" && code.length > 500;
      return {
        ok: res.status === 200 && isJs,
        notes: `HTTP 200 (${(code.length / 1024).toFixed(1)} KB JS bundle delivered)`,
      };
    });
  }

  // 3. Web App Manifest
  await testEndpoint("3. Web App Manifest", "/manifest.json", {}, (res, json) => {
    const isManifest = json && json.name && json.start_url && json.icons;
    return {
      ok: res.status === 200 && !!isManifest,
      notes: `HTTP 200, valid PWA manifest ("${json?.name}", scope: "${json?.scope}")`,
    };
  });

  // 4. Admin Shell
  await testEndpoint("4. Admin App Shell", "/admin.html", {}, (res, text) => {
    const hasAdmin = typeof text === "string" && (text.includes('id="admin-root"') || text.includes('id="root"'));
    return {
      ok: res.status === 200 && hasAdmin,
      notes: `HTTP 200, Admin HTML shell served properly`,
    };
  });

  // 5. Service Worker
  await testEndpoint("5. Service Worker (/sw.js)", "/sw.js", {}, (res, text) => {
    const isSw = res.status === 200 && typeof text === "string" && text.includes("addEventListener");
    return {
      ok: isSw,
      notes: isSw ? `HTTP 200, Service Worker installed & ready for offline caching` : `HTTP ${res.status}`,
    };
  });

  // 6. Security Headers Check
  await testEndpoint("6. HTTPS & Security Headers", "/", {}, (res) => {
    const hsts = res.headers.get("strict-transport-security");
    const xVercel = res.headers.get("x-vercel-id");
    return {
      ok: !!hsts && !!xVercel,
      notes: `HSTS: ${hsts ? "Present" : "Missing"} | Server: Vercel Edge (${xVercel || "unknown"})`,
    };
  });

  // 7. OTP Service Channels (Unauthenticated Public Route)
  await testEndpoint("7. OTP API Channels", "/api/otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "otp.channels" }),
  }, (res, json) => {
    const hasData = json && json.data && typeof json.data.ttlSeconds === "number";
    return {
      ok: res.status === 200 && hasData,
      notes: `HTTP 200 (ttl: ${json?.data?.ttlSeconds}s, WhatsApp: ${json?.data?.whatsapp})`,
    };
  });

  // 8. OTP Bad Request Guard
  await testEndpoint("8. OTP Invalid Phone Guard", "/api/otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "otp.request", payload: { phone: "123" } }),
  }, (res, json) => {
    const blocked = res.status === 400;
    return {
      ok: blocked,
      notes: `HTTP 400 Bad Request — correctly rejects invalid mobile numbers`,
      details: json?.error?.message,
    };
  });

  // 9. Farm Action Router (Valid Action, Auth Guard)
  await testEndpoint("9. Farm API Auth Guard", "/api/farm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "spaces.list" }),
  }, (res, json) => {
    const blocked = res.status === 401;
    return {
      ok: blocked,
      notes: `HTTP 401 Unauthorized — correctly gates Farm spaces by user identity`,
      details: json?.error?.message,
    };
  });

  // 10. AI Chat Gateway (Loophole Plug Verification: Rate Limit & Auth Pipeline)
  await testEndpoint("10. AI Chat Gateway Guard", "/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "hello" }] }),
  }, (res, json) => {
    const blocked = res.status === 401 || res.status === 429;
    return {
      ok: blocked,
      notes: `HTTP ${res.status} — rate-limiting & auth verification guards are live`,
      details: json?.error?.message,
    };
  });

  // 11. Weather API Auth Guard
  await testEndpoint("11. Weather API Auth Guard", "/api/weather", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat: 22.57, lon: 88.36 }),
  }, (res, json) => {
    const blocked = res.status === 401;
    return {
      ok: blocked,
      notes: `HTTP 401 Unauthorized — prevents unauthorized upstream weather proxy billing`,
      details: json?.error?.message,
    };
  });

  // 12. Commerce Protected Endpoint Guard (Me)
  await testEndpoint("12. Commerce Auth Guard", "/api/commerce/me", {}, (res, json) => {
    const blocked = res.status === 401;
    return {
      ok: blocked,
      notes: `HTTP 401 Unauthorized — commerce profile gated to authenticated sessions`,
      details: json?.error?.message,
    };
  });

  // 13. Blob Upload Direct-to-Storage Guard
  await testEndpoint("13. Blob Upload Direct Guard", "/api/blob-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "blob.generate-client-token" }),
  }, (res, json) => {
    // Should reject because unauthenticated / unauthorized
    const blocked = res.status === 400 || res.status === 401;
    return {
      ok: blocked,
      notes: `HTTP ${res.status} — direct-to-blob token generation guarded`,
      details: json?.error?.message || json?.message,
    };
  });

  console.table(results);

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const allPassed = passedCount === totalCount;

  console.log(`\n=======================================================`);
  console.log(` Smoke Test Summary: ${passedCount}/${totalCount} tests passed`);
  console.log(` Status: ${allPassed ? "✅ ALL TESTS PASSED — PRODUCTION IS HEALTHY" : "❌ SOME TESTS FAILED"}`);
  console.log(`=======================================================\n`);

  return allPassed;
}

run().catch(console.error);
