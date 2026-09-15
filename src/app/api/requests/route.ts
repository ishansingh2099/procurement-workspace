import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

type RequestStatus = "Draft" | "Submitted for review";
type ReviewDecision = "In review" | "Clarification requested" | "Ready for approval";

type RequestForm = {
  title: string;
  purpose: string;
  itemType: string;
  quantity: string;
  specifications: string;
  deliveryDate: string;
  budget: string;
  support: string;
};

function toStoredRequest(row: { id: string; form: RequestForm; status: RequestStatus; review_decision: ReviewDecision; saved_at: string }) {
  return { id: row.id, form: row.form, status: row.status, reviewDecision: row.review_decision, savedAt: row.saved_at };
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

  const { data, error } = await supabaseServer
    .from("requests")
    .select("id, form, status, review_decision, saved_at")
    .eq("user_id", user.id)
    .order("saved_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "The request could not be loaded from Supabase." }, { status: 500 });
  }

  return NextResponse.json({ request: data ? toStoredRequest(data) : null });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized: Please sign in first." }, { status: 401 });
  }

  let body: { id?: string; form?: RequestForm; status?: RequestStatus; reviewDecision?: ReviewDecision };

  try {
    body = await request.json() as typeof body;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body.form || (body.status !== "Draft" && body.status !== "Submitted for review")) {
    return NextResponse.json({ error: "A form and valid request status are required." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const reviewDecision = body.reviewDecision ?? "In review";

  const query = body.id
    ? supabaseServer
        .from("requests")
        .update({ form: body.form, status: body.status, review_decision: reviewDecision, saved_at: now, updated_at: now })
        .eq("id", body.id)
        .eq("user_id", user.id)
    : supabaseServer
        .from("requests")
        .insert({ form: body.form, status: body.status, review_decision: reviewDecision, saved_at: now, updated_at: now, user_id: user.id });

  const { data, error } = await query.select("id, form, status, review_decision, saved_at").single();

  if (error) {
    return NextResponse.json({ error: "The request could not be saved to Supabase." }, { status: 500 });
  }

  return NextResponse.json({ request: toStoredRequest(data) });
}
