const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:4000";
const googleIdToken = process.env.SMOKE_GOOGLE_ID_TOKEN;

async function main() {
  const health = await fetch(`${baseUrl}/health`);
  if (!health.ok) {
    throw new Error(`health check failed (${health.status})`);
  }

  if (!googleIdToken) {
    console.log("Smoke test passed (health only). Set SMOKE_GOOGLE_ID_TOKEN to test auth flow.");
    return;
  }

  const googleAuth = await fetch(`${baseUrl}/v1/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: googleIdToken }),
  });

  if (!googleAuth.ok) {
    const body = await googleAuth.text();
    throw new Error(`google auth failed (${googleAuth.status}): ${body}`);
  }

  const payload = (await googleAuth.json()) as { accessToken: string };

  const me = await fetch(`${baseUrl}/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${payload.accessToken}`,
    },
  });

  if (!me.ok) {
    const body = await me.text();
    throw new Error(`me failed (${me.status}): ${body}`);
  }

  console.log("Smoke test passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
