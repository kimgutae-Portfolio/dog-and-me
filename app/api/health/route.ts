export async function GET() {
  return Response.json({ status: "ok", service: "wan-memory", version: "mvp-0.1" });
}
