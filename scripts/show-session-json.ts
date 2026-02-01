/**
 * Fetch and print session JSON by ID.
 * Usage: npx ts-node scripts/show-session-json.ts <sessionId>
 * Or with auth: ACCESS_TOKEN=your-token npx ts-node scripts/show-session-json.ts <sessionId>
 */

const sessionId = process.argv[2] || "cd237f5d-5aa1-40cb-be40-ac611fe32679";
const API_BASE = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const token = process.env.ACCESS_TOKEN;

async function main() {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/vault/sessions/${sessionId}`, { headers });
  const data = await res.json();

  if (!res.ok) {
    console.error("Error:", res.status, data);
    process.exit(1);
  }

  console.log(JSON.stringify(data.session ?? data, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
