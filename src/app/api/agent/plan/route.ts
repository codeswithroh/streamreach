import { agentMode, AGENT_MODEL, runAgent, type AgentEvent } from "@/lib/agent/run";
import { json } from "@/lib/http";
import { getSite } from "@/lib/sites";
import { countAgentRun, listPlans, savePlan } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const REUSE_MS = 60 * 60_000; // reuse a fresh draft for an hour unless the officer asks for a new one
const DAILY_CAP = Number(process.env.STREAMREACH_AGENT_DAILY_CAP) || 200;
const IP_COOLDOWN_MS = 15_000;

const g = globalThis as unknown as { __srAgentIps?: Map<string, number> };
const lastRunByIp = () => (g.__srAgentIps ??= new Map());

export type StreamEvent = AgentEvent | { type: "saved"; planId: string; reused: boolean; createdAt: string; status: "draft" | "approved" | "discarded" };

/** Runs the duty-officer agent and streams its progress as server-sent events. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const siteId = typeof body?.siteId === "string" ? body.siteId : "";
  const fresh = body?.fresh === true;
  if (!getSite(siteId)) return json({ error: "unknown siteId" }, 400);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: StreamEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        if (!fresh) {
          const recent = (await listPlans(siteId)).find(
            (p) => p.status !== "discarded" && Date.now() - new Date(p.createdAt).getTime() < REUSE_MS,
          );
          if (recent) {
            for (const e of recent.trace as AgentEvent[]) send(e);
            send({ type: "saved", planId: recent.id, reused: true, createdAt: recent.createdAt, status: recent.status });
            return;
          }
        }

        const mode = agentMode();
        if (mode === "live") {
          const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
          const last = lastRunByIp().get(ip) ?? 0;
          if (Date.now() - last < IP_COOLDOWN_MS) {
            send({ type: "error", message: "Please wait a few seconds before drafting another plan." });
            return;
          }
          lastRunByIp().set(ip, Date.now());
          if ((await countAgentRun()) > DAILY_CAP) {
            send({ type: "error", message: "Today's AI drafting limit for this demo has been reached. Try again tomorrow." });
            return;
          }
        }

        const trace: AgentEvent[] = [];
        const plan = await runAgent(
          siteId,
          (e) => {
            trace.push(e);
            send(e);
          },
          req.signal,
        );
        if (plan) {
          const id = `plan-${crypto.randomUUID().slice(0, 8)}`;
          const createdAt = new Date().toISOString();
          await savePlan({ id, siteId, status: "draft", plan, trace, model: mode === "mock" ? "mock" : AGENT_MODEL, createdAt });
          send({ type: "saved", planId: id, reused: false, createdAt, status: "draft" });
        }
      } catch (e) {
        console.error(e);
        send({ type: "error", message: "The agent failed unexpectedly." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}

export function GET() {
  return json({ mode: agentMode(), model: AGENT_MODEL });
}
