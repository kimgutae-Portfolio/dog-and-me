export async function GET() {
  return Response.json({ status: "ok", service: "kimi-to-no-eiga", version: "mvp-0.1" });
}
