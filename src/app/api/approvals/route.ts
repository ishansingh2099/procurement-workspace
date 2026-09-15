import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

type ApprovalDecision = "Pending approval" | "Approved" | "Returned for clarification";

const validDecisions: ApprovalDecision[] = ["Pending approval", "Approved", "Returned for clarification"];

function toStoredApproval(row: { request_id: string; decision: ApprovalDecision; decided_at: string | null }) {
  return { requestId: row.request_id, decision: row.decision, decidedAt: row.decided_at };
}

async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.slice(7);
  const {
    data: { user },
    error,
  } = await supabaseServer.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized: Please sign in first." }, { status: 401 });
  }

  const requestId = request.nextUrl.searchParams.get("requestId");
  if (!requestId) {
    return NextResponse.json({ error: "A requestId query parameter is required." }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("approvals")
    .select("request_id, decision, decided_at")
    .eq("request_id", requestId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "The approval could not be loaded from Supabase." }, { status: 500 });
  }

  return NextResponse.json({ approval: data ? toStoredApproval(data) : null });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized: Please sign in first." }, { status: 401 });
  }

  let body: { requestId?: string; decision?: ApprovalDecision };

  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body.requestId || !body.decision || !validDecisions.includes(body.decision)) {
    return NextResponse.json({ error: "A requestId and valid decision are required." }, { status: 400 });
  }

  const { data: existing } = await supabaseServer
    .from("approvals")
    .select("decision")
    .eq("request_id", body.requestId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing?.decision === "Approved") {
    return NextResponse.json({ error: "This request has already been approved." }, { status: 409 });
  }

  const decidedAt = body.decision === "Pending approval" ? null : new Date().toISOString();

  const { data, error } = await supabaseServer
    .from("approvals")
    .upsert(
      {
        request_id: body.requestId,
        user_id: user.id,
        decision: body.decision,
        decided_at: decidedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "request_id" }
    )
    .select("request_id, decision, decided_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "The approval could not be saved to Supabase." }, { status: 500 });
  }

  return NextResponse.json({ approval: toStoredApproval(data) });
}
