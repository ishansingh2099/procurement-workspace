import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

type ClarificationAnswers = {
  requirements: string;
  vendors: string;
  controls: string;
  questions: string;
};

type ClarificationRow = ClarificationAnswers & { request_id: string; submitted_at: string };

function toStoredClarification(row: ClarificationRow) {
  return {
    requestId: row.request_id,
    requirements: row.requirements,
    vendors: row.vendors,
    controls: row.controls,
    questions: row.questions,
    submittedAt: row.submitted_at,
  };
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
    .from("clarifications")
    .select("request_id, requirements, vendors, controls, questions, submitted_at")
    .eq("request_id", requestId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "The clarification could not be loaded from Supabase." }, { status: 500 });
  }

  return NextResponse.json({ clarification: data ? toStoredClarification(data) : null });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized: Please sign in first." }, { status: 401 });
  }

  let body: { requestId?: string; answers?: ClarificationAnswers };

  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body.requestId || !body.answers) {
    return NextResponse.json({ error: "A requestId and answers are required." }, { status: 400 });
  }

  const { requirements, vendors, controls, questions } = body.answers;
  if (!requirements?.trim() || !vendors?.trim() || !controls?.trim() || !questions?.trim()) {
    return NextResponse.json({ error: "Every clarification section requires a response." }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("clarifications")
    .upsert(
      {
        request_id: body.requestId,
        user_id: user.id,
        requirements,
        vendors,
        controls,
        questions,
        submitted_at: new Date().toISOString(),
      },
      { onConflict: "request_id" }
    )
    .select("request_id, requirements, vendors, controls, questions, submitted_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "The clarification could not be saved to Supabase." }, { status: 500 });
  }

  return NextResponse.json({ clarification: toStoredClarification(data) });
}
