"use client";

import { FormEvent, startTransition, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabaseClient } from "@/lib/supabase-client";

type RequestStatus = "Draft" | "Submitted for review";
type ReviewDecision = "In review" | "Clarification requested" | "Ready for approval";
type WorkflowView = "intake" | "review" | "clarification" | "approval" | "auth";
type ApprovalDecision = "Pending approval" | "Approved" | "Returned for clarification";

type FormState = {
  title: string;
  purpose: string;
  itemType: string;
  quantity: string;
  specifications: string;
  deliveryDate: string;
  budget: string;
  support: string;
};

const initialForm: FormState = {
  title: "",
  purpose: "",
  itemType: "Laptop",
  quantity: "1",
  specifications: "",
  deliveryDate: "",
  budget: "",
  support: "",
};

const requiredFields: Array<[keyof FormState, string]> = [
  ["title", "Request title"],
  ["purpose", "Business purpose"],
  ["itemType", "Item type"],
  ["quantity", "Quantity"],
  ["specifications", "Must-have specifications"],
  ["deliveryDate", "Required delivery date"],
  ["budget", "Budget"],
];

export default function Home() {
  const { user, loading, signUp, signIn, signOut } = useAuth();
  const [requestId, setRequestId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState<RequestStatus>("Draft");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("Your request will be saved to the demo server.");
  const [reviewDecision, setReviewDecision] = useState<ReviewDecision>("In review");
  const [workflowView, setWorkflowView] = useState<WorkflowView>("intake");
  const [clarificationAnswers, setClarificationAnswers] = useState({ requirements: "", vendors: "", controls: "", questions: "" });
  const [approvalDecision, setApprovalDecision] = useState<ApprovalDecision>("Pending approval");
  const [approvalTimestamp, setApprovalTimestamp] = useState<string | null>(null);

  // Auth UI state
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    let active = true;

    async function loadRequest() {
      if (!user) return;

      const { data } = await supabaseClient.auth.getSession();
      const token = data?.session?.access_token;

      if (!token) {
        setNotice("Authentication required. Please sign in.");
        return;
      }

      try {
        const response = await fetch("/api/requests", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) throw new Error("Request could not be loaded");
        const data = await response.json() as {
          request: { id: string; form: FormState; status: RequestStatus; reviewDecision: ReviewDecision; savedAt: string } | null;
        };

        if (!active || !data.request) return;
        const restored = data.request;

        const [clarificationResponse, approvalResponse] = await Promise.all([
          fetch(`/api/clarifications?requestId=${restored.id}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/approvals?requestId=${restored.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        const clarificationData = clarificationResponse.ok
          ? await clarificationResponse.json() as { clarification: (typeof clarificationAnswers & { requestId: string; submittedAt: string }) | null }
          : { clarification: null };
        const approvalData = approvalResponse.ok
          ? await approvalResponse.json() as { approval: { decision: ApprovalDecision; decidedAt: string | null } | null }
          : { approval: null };

        if (!active) return;
        startTransition(() => {
          setRequestId(restored.id);
          setForm(restored.form);
          setStatus(restored.status);
          setReviewDecision(restored.reviewDecision);
          setWorkflowView(restored.status === "Draft" ? "intake" : restored.reviewDecision === "Ready for approval" ? "approval" : "review");
          setSavedAt(restored.savedAt);
          if (clarificationData.clarification) {
            const { requirements, vendors, controls, questions } = clarificationData.clarification;
            setClarificationAnswers({ requirements, vendors, controls, questions });
          }
          if (approvalData.approval) {
            setApprovalDecision(approvalData.approval.decision);
            setApprovalTimestamp(approvalData.approval.decidedAt);
          }
          setNotice("Request restored from the demo server.");
        });
      } catch {
        if (active) setNotice("The demo server is unavailable. Changes cannot be saved yet.");
      }
    }

    if (user) loadRequest();

    return () => {
      active = false;
    };
  }, [user]);

  // Show auth screen if not logged in
  if (loading) {
    return (
      <main className="shell">
        <header className="topbar">
          <div className="brand-mark">RD</div>
          <div><p className="eyebrow">Procurement workspace</p><h1>Request to Decision</h1></div>
        </header>
        <section className="intro" style={{ textAlign: "center", padding: "40px 20px" }}>
          <p>Loading authentication...</p>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="shell">
        <header className="topbar">
          <div className="brand-mark">RD</div>
          <div><p className="eyebrow">Procurement workspace</p><h1>Request to Decision</h1></div>
        </header>
        <section className="intro" style={{ maxWidth: "400px", margin: "60px auto" }}>
          <h2 style={{ marginBottom: "20px" }}>{authMode === "signin" ? "Sign In" : "Create Account"}</h2>
          {authError && <div style={{ color: "#c92a2a", marginBottom: "15px", padding: "10px", backgroundColor: "#ffe0e0", borderRadius: "4px" }}>{authError}</div>}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setAuthError("");
              try {
                if (authMode === "signin") {
                  await signIn(authEmail, authPassword);
                } else {
                  await signUp(authEmail, authPassword);
                }
                setAuthEmail("");
                setAuthPassword("");
              } catch (err) {
                setAuthError(err instanceof Error ? err.message : "Authentication failed");
              }
            }}
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="Email"
              required
              style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px" }}
            />
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Password"
              required
              style={{ padding: "10px", border: "1px solid #ccc", borderRadius: "4px", fontSize: "14px" }}
            />
            <button type="submit" style={{ padding: "10px", backgroundColor: "#0f7770", color: "white", border: "none", borderRadius: "4px", fontSize: "14px", fontWeight: "bold", cursor: "pointer" }}>
              {authMode === "signin" ? "Sign In" : "Sign Up"}
            </button>
          </form>
          <p style={{ textAlign: "center", marginTop: "15px", fontSize: "14px" }}>
            {authMode === "signin" ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => {
                setAuthMode(authMode === "signin" ? "signup" : "signin");
                setAuthError("");
              }}
              style={{ background: "none", border: "none", color: "#0f7770", textDecoration: "underline", cursor: "pointer", fontSize: "14px" }}
            >
              {authMode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
        </section>
      </main>
    );
  }

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setNotice("Unsaved changes");
  }

  async function saveRequest(nextStatus: RequestStatus, nextReviewDecision: ReviewDecision) {
    try {
      const { data } = await supabaseClient.auth.getSession();
      const token = data?.session?.access_token;

      if (!token) {
        setNotice("Authentication required. Please sign in.");
        return false;
      }

      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: requestId, form, status: nextStatus, reviewDecision: nextReviewDecision }),
      });

      if (!response.ok) throw new Error("Request could not be saved");
      const data_response = await response.json() as { request: { id: string; savedAt: string } };
      setRequestId(data_response.request.id);
      setStatus(nextStatus);
      setReviewDecision(nextReviewDecision);
      setSavedAt(data_response.request.savedAt);
      setNotice(nextStatus === "Draft" ? "Draft saved to the demo server." : "Request submitted to the mock reviewer.");
      return true;
    } catch {
      setNotice("Unable to save to the demo server. Try again.");
      return false;
    }
  }

  async function persistClarification() {
    if (!requestId) return;
    const { data } = await supabaseClient.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) {
      setNotice("Authentication required. Please sign in.");
      return;
    }

    try {
      const response = await fetch("/api/clarifications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId, answers: clarificationAnswers }),
      });
      if (!response.ok) throw new Error("Clarification could not be saved");
    } catch {
      setNotice("Clarification recorded locally, but could not sync to the demo server.");
    }
  }

  async function persistApproval(decision: ApprovalDecision) {
    if (!requestId) return false;
    const { data } = await supabaseClient.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) {
      setNotice("Authentication required. Please sign in.");
      return false;
    }

    try {
      const response = await fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId, decision }),
      });

      if (response.status === 409) {
        setNotice("This request has already been approved.");
        return false;
      }
      if (!response.ok) throw new Error("Approval could not be saved");

      const data_response = await response.json() as { approval: { decision: ApprovalDecision; decidedAt: string | null } };
      setApprovalDecision(data_response.approval.decision);
      setApprovalTimestamp(data_response.approval.decidedAt);
      return true;
    } catch {
      setNotice("Unable to record the approval decision. Try again.");
      return false;
    }
  }

  function validate() {
    const missing = requiredFields
      .filter(([field]) => !form[field].trim())
      .map(([, label]) => label);
    const numericErrors: string[] = [];

    if (form.quantity && (!Number.isInteger(Number(form.quantity)) || Number(form.quantity) < 1)) {
      numericErrors.push("Quantity must be a whole number greater than zero");
    }
    if (form.budget && (Number(form.budget) < 0 || Number.isNaN(Number(form.budget)))) {
      numericErrors.push("Budget must be a non-negative number");
    }

    const nextErrors = [...missing.map((field) => `${field} is required`), ...numericErrors];
    setErrors(nextErrors);
    return nextErrors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    if (nextErrors.length) {
      setNotice("Complete the highlighted information before submitting.");
      return;
    }
    if (await saveRequest("Submitted for review", "In review")) setWorkflowView("review");
  }

  function editRequest() {
    setStatus("Draft");
    setWorkflowView("intake");
    setNotice("Editing request. Save or submit when ready.");
  }

  function updateClarification(section: keyof typeof clarificationAnswers, value: string) {
    setClarificationAnswers((current) => ({ ...current, [section]: value }));
  }

  async function submitClarification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkflowView("review");
    setNotice("Clarification request sent to the procurement requester.");
    await Promise.all([persistClarification(), saveRequest(status, "Clarification requested")]);
  }

  async function markForApproval() {
    setApprovalDecision("Pending approval");
    setApprovalTimestamp(null);
    setWorkflowView("approval");
    await Promise.all([persistApproval("Pending approval"), saveRequest(status, "Ready for approval")]);
  }

  async function approveRequest() {
    const ok = await persistApproval("Approved");
    if (ok) setNotice("Approval recorded in this prototype. No purchase was made.");
  }

  async function returnForClarification() {
    const ok = await persistApproval("Returned for clarification");
    if (ok) setNotice("Request returned to the requester for clarification.");
  }

  const updatedLabel = savedAt ? new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Not saved yet";

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-mark">RD</div>
        <div>
          <p className="eyebrow">Procurement workspace</p>
          <h1>Request to Decision</h1>
        </div>
        <div className="topbar-meta">
          <span className="environment">Demo environment</span>
          <span className="status-dot" aria-hidden="true" />
          <span>{workflowView === "intake" ? "Requester view" : workflowView === "review" ? "Procurement review" : workflowView === "clarification" ? "Clarification request" : "Approval prototype"}</span>
          <span style={{ marginLeft: "20px", fontSize: "12px", color: "#666" }}>{user?.email}</span>
          <button
            onClick={() => signOut()}
            style={{
              marginLeft: "15px",
              padding: "6px 12px",
              backgroundColor: "transparent",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "12px",
              cursor: "pointer",
              color: "#333",
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="eyebrow accent">New IT hardware request</p>
          <h2>Start with the capability,<br />not the model.</h2>
          <p className="intro-copy">Capture what your team needs. Procurement can compare suitable options after the requirements are clear.</p>
        </div>
        <div className="progress-card">
          <span className="progress-label">Request progress</span>
          <strong>{workflowView === "intake" ? "1 of 3" : workflowView === "approval" ? "3 of 3" : "2 of 3"}</strong>
          <div className="progress-track"><span style={{ width: workflowView === "intake" ? "33%" : workflowView === "approval" ? "100%" : "66%" }} /></div>
          <span className="progress-caption">{workflowView === "intake" ? "Requirements" : workflowView === "approval" ? "Approval" : workflowView === "clarification" ? "Clarification" : "With procurement"}</span>
        </div>
      </section>

      <div className="workspace-grid">
        {status === "Draft" ? (
        <form className="request-form" onSubmit={handleSubmit}>
          <div className="section-heading">
            <div className="section-number">01</div>
            <div><h3>What do you need?</h3><p>Describe the outcome and the constraints. A preferred model is optional.</p></div>
          </div>

          <div className="field-group full-width">
            <label htmlFor="title">Request title <span>*</span></label>
            <input id="title" value={form.title} onChange={(event) => updateField("title", event.target.value)} placeholder="e.g. Workstations for the new design team" />
          </div>

          <div className="field-group full-width">
            <label htmlFor="purpose">Business purpose <span>*</span></label>
            <textarea id="purpose" rows={3} value={form.purpose} onChange={(event) => updateField("purpose", event.target.value)} placeholder="What work will this hardware enable? What problem does it solve?" />
            <span className="field-help">Write in plain language. You do not need to know the exact specifications yet.</span>
          </div>

          <div className="form-grid">
            <div className="field-group"><label htmlFor="itemType">Item type <span>*</span></label><select id="itemType" value={form.itemType} onChange={(event) => updateField("itemType", event.target.value)}><option>Laptop</option><option>Desktop workstation</option><option>Monitor</option><option>Network equipment</option><option>Other IT hardware</option></select></div>
            <div className="field-group"><label htmlFor="quantity">Quantity <span>*</span></label><input id="quantity" type="number" min="1" value={form.quantity} onChange={(event) => updateField("quantity", event.target.value)} /></div>
          </div>

          <div className="field-group full-width"><label htmlFor="specifications">Must-have specifications <span>*</span></label><textarea id="specifications" rows={4} value={form.specifications} onChange={(event) => updateField("specifications", event.target.value)} placeholder="e.g. 32 GB RAM, dedicated graphics, compatible with existing CAD software" /><span className="field-help">Separate must-haves from preferences. Procurement will use this to compare alternatives.</span></div>

          <div className="section-heading second-heading"><div className="section-number">02</div><div><h3>When and under what conditions?</h3><p>These details help the reviewer assess feasibility and readiness.</p></div></div>

          <div className="form-grid"><div className="field-group"><label htmlFor="deliveryDate">Required delivery date <span>*</span></label><input id="deliveryDate" type="date" value={form.deliveryDate} onChange={(event) => updateField("deliveryDate", event.target.value)} /></div><div className="field-group"><label htmlFor="budget">Budget (INR) <span>*</span></label><input id="budget" type="number" min="0" value={form.budget} onChange={(event) => updateField("budget", event.target.value)} placeholder="e.g. 150000" /></div></div>

          <div className="field-group full-width"><label htmlFor="support">Warranty and support needs</label><textarea id="support" rows={3} value={form.support} onChange={(event) => updateField("support", event.target.value)} placeholder="Warranty period, installation, response time, or other support expectations" /></div>

          {errors.length > 0 && <div className="error-box" role="alert"><strong>Before you submit</strong><ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul></div>}

          <div className="form-actions"><button type="button" className="button secondary" onClick={() => { setErrors([]); saveRequest("Draft", reviewDecision); }}>Save draft</button><button type="submit" className="button primary">Validate and submit <span aria-hidden="true">→</span></button></div>
          <p className="save-note"><span className="save-icon">✓</span>{notice} <span className="save-time">{updatedLabel}</span></p>
        </form>
        ) : workflowView === "clarification" ? (
          <form className="request-form clarification-stage" onSubmit={submitClarification} aria-labelledby="clarification-heading">
            <div className="review-success"><span className="success-mark">?</span><div><p className="eyebrow accent">Clarification request</p><h3 id="clarification-heading">Ask the requester to resolve the open doubts.</h3><p>Review every section below. Write a question, concern, or `NA` when there is no doubt. The completed request will be sent back to the procurement requester.</p></div></div>
            <div className="review-summary"><div><span>Request</span><strong>{form.title}</strong></div><div><span>Item</span><strong>{form.quantity} × {form.itemType}</strong></div><div><span>Current status</span><strong>{reviewDecision}</strong></div></div>
            <div className="clarification-section"><div className="clarification-heading"><div><p className="eyebrow accent">01 / Requirement checks</p><h4>Technical requirements and business need</h4></div><span className="status-pill pending-text">Needs confirmation</span></div><p className="section-evidence">Submitted specifications: {form.specifications}</p><label htmlFor="clarification-requirements">What is your doubt about this section? Write `NA` if there is no doubt.</label><textarea id="clarification-requirements" required rows={3} value={clarificationAnswers.requirements} onChange={(event) => updateClarification("requirements", event.target.value)} placeholder="e.g. Please confirm whether dedicated graphics are mandatory. / NA" /></div>
            <div className="clarification-section"><div className="clarification-heading"><div><p className="eyebrow accent">02 / Vendor comparison</p><h4>Options, availability, and technical fit</h4></div><span className="status-pill pending-text">Evidence needed</span></div><p className="section-evidence">Synthetic vendor options are shown for comparison only. No option is selected.</p><label htmlFor="clarification-vendors">What is your doubt about this section? Write `NA` if there is no doubt.</label><textarea id="clarification-vendors" required rows={3} value={clarificationAnswers.vendors} onChange={(event) => updateClarification("vendors", event.target.value)} placeholder="e.g. Please provide a source quote for the preferred option. / NA" /></div>
            <div className="clarification-section"><div className="clarification-heading"><div><p className="eyebrow accent">03 / Benchmark and controls</p><h4>Cost, budget, supplier, and payment checks</h4></div><span className="status-pill pending-text">Incomplete</span></div><p className="section-evidence">Benchmark: Not added · Supplier details: Not verified · Payment terms: Not checked</p><label htmlFor="clarification-controls">What is your doubt about this section? Write `NA` if there is no doubt.</label><textarea id="clarification-controls" required rows={3} value={clarificationAnswers.controls} onChange={(event) => updateClarification("controls", event.target.value)} placeholder="e.g. Please attach the market benchmark supporting the budget. / NA" /></div>
            <div className="clarification-section"><div className="clarification-heading"><div><p className="eyebrow accent">04 / Open questions</p><h4>Questions and ownership</h4></div><span className="status-pill pending-text">2 open</span></div><p className="section-evidence">Q1: Which specifications are mandatory? Q2: What source supports the proposed budget?</p><label htmlFor="clarification-questions">What is your doubt about this section? Write `NA` if there is no doubt.</label><textarea id="clarification-questions" required rows={3} value={clarificationAnswers.questions} onChange={(event) => updateClarification("questions", event.target.value)} placeholder="e.g. Assign Q1 to the engineering requester. / NA" /></div>
            <div className="review-actions"><div><p className="review-label">Before sending</p><span>Every section needs a response. `NA` is accepted when no doubt remains.</span></div><button type="submit" className="button primary">Submit clarification request <span aria-hidden="true">→</span></button></div>
          </form>
        ) : workflowView === "approval" ? (
          <section className="request-form approval-stage" aria-labelledby="approval-heading">
            <div className="review-success"><span className="success-mark">✓</span><div><p className="eyebrow accent">Stage 03 / Approval prototype</p><h3 id="approval-heading">The request is ready for human approval.</h3><p>This is the next-stage prototype. An approver reviews the evidence packet and chooses what happens next. The system does not approve automatically.</p></div></div>
            <div className={`approval-banner ${approvalDecision === "Approved" ? "approved-banner" : ""}`}><span className="human-badge">{approvalDecision === "Approved" ? "Decision recorded" : "Human decision required"}</span><strong>{approvalDecision === "Approved" ? "This request has been approved by the approver." : approvalDecision === "Returned for clarification" ? "This request has been returned for clarification." : "Procurement marked this request ready for approval."}</strong></div>
            <div className="review-summary"><div><span>Request</span><strong>{form.title}</strong></div><div><span>Requested by</span><strong>Engineering requester</strong></div><div><span>Budget</span><strong>₹{Number(form.budget).toLocaleString("en-IN")}</strong></div><div><span>Decision</span><strong>{approvalDecision}</strong>{approvalTimestamp && <small className="decision-time">{new Date(approvalTimestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</small>}</div></div>
            <section className="approval-packet"><p className="eyebrow accent">Approval packet</p><h4>Evidence available to the approver</h4><div className="packet-list"><div><span className="check-icon done">✓</span><strong>Original request and business purpose</strong><span className="done-text">Available</span></div><div><span className="check-icon pending">!</span><strong>Technical evaluation of selected option</strong><span className="pending-text">Needs evidence</span></div><div><span className="check-icon pending">!</span><strong>Market benchmark and supplier checks</strong><span className="pending-text">Incomplete</span></div><div><span className="check-icon done">✓</span><strong>Clarification response record</strong><span className="done-text">Recorded</span></div></div></section>
            <div className="approval-actions"><button type="button" className="button secondary" onClick={() => setWorkflowView("review")}>Return to review</button><button type="button" className="button secondary" onClick={returnForClarification} disabled={approvalDecision === "Approved"}>Return for clarification</button><button type="button" className="button primary" onClick={approveRequest} disabled={approvalDecision === "Approved"}>Approve request <span aria-hidden="true">→</span></button></div>
          </section>
        ) : (
          <section className="request-form review-stage" aria-labelledby="review-heading">
            <div className="review-success"><span className="success-mark">✓</span><div><p className="eyebrow accent">Request submitted</p><h3 id="review-heading">Your request is with procurement.</h3><p>The reviewer can now compare suitable options against your requirements and follow up on any open questions.</p></div></div>
            <div className="review-summary">
              <div><span>Request</span><strong>{form.title}</strong></div>
              <div><span>Item</span><strong>{form.quantity} × {form.itemType}</strong></div>
              <div><span>Delivery</span><strong>{form.deliveryDate}</strong></div>
              <div><span>Budget</span><strong>₹{Number(form.budget).toLocaleString("en-IN")}</strong></div>
            </div>
            <div className="review-status-row"><div><span className="review-label">Review status</span><strong className="review-status">{reviewDecision}</strong></div><span className="human-badge">Human decision required</span></div>

            <section className="review-section" aria-labelledby="requirements-heading"><div className="review-section-heading"><div><p className="eyebrow accent">01 / Requirement checks</p><h4 id="requirements-heading">Is the request clear enough to compare?</h4></div><span className="review-count">2 of 4 checked</span></div><div className="check-grid"><div className="check-item"><span className="check-icon pending">!</span><div><strong>Technical requirements</strong><p>{form.specifications}</p></div><span className="check-state pending-text">Needs confirmation</span></div><div className="check-item"><span className="check-icon done">✓</span><div><strong>Business purpose</strong><p>{form.purpose}</p></div><span className="check-state done-text">Clear</span></div><div className="check-item"><span className="check-icon done">✓</span><div><strong>Quantity and delivery</strong><p>{form.quantity} unit(s) needed by {form.deliveryDate}.</p></div><span className="check-state done-text">Clear</span></div><div className="check-item"><span className="check-icon pending">!</span><div><strong>Support expectation</strong><p>{form.support || "No support preference provided."}</p></div><span className="check-state pending-text">Needs confirmation</span></div></div></section>

            <section className="review-section" aria-labelledby="vendors-heading"><div className="review-section-heading"><div><p className="eyebrow accent">02 / Vendor comparison</p><h4 id="vendors-heading">Synthetic options for reviewer evaluation</h4></div><span className="review-count">No option selected</span></div><div className="vendor-table"><div className="vendor-row vendor-header"><span>Option</span><span>Price</span><span>Availability</span><span>Technical fit</span><span>Evidence</span></div><div className="vendor-row"><strong>Northstar Systems · NS Pro 14</strong><span>₹{Number(form.budget).toLocaleString("en-IN")}</span><span className="table-status">Available</span><span className="table-status warning">Unverified</span><span className="table-status warning">Quote needed</span></div><div className="vendor-row"><strong>Orbit Devices · Orbit Work 15</strong><span>₹{Math.round(Number(form.budget) * 0.82).toLocaleString("en-IN")}</span><span className="table-status warning">Check lead time</span><span className="table-status warning">Needs review</span><span className="table-status warning">Specs needed</span></div><div className="vendor-row"><strong>Requester preferred option</strong><span>Not provided</span><span className="table-status warning">Unknown</span><span className="table-status warning">Not assessed</span><span className="table-status warning">No source</span></div></div><p className="table-note">These are synthetic placeholders for the prototype. The reviewer must verify every option against source evidence.</p></section>

            <section className="review-section review-two-column"><div><p className="eyebrow accent">03 / Benchmark and controls</p><h4>Readiness checks</h4><div className="control-list"><div><span>Market benchmark</span><strong className="pending-text">Not added</strong></div><div><span>Budget check</span><strong className="done-text">Within request</strong></div><div><span>Supplier details</span><strong className="pending-text">Not verified</strong></div><div><span>Payment terms</span><strong className="pending-text">Not checked</strong></div></div></div><div><p className="eyebrow accent">04 / Open questions</p><h4>Clarifications to resolve</h4><div className="question-list"><div><span className="question-number">Q1</span><p>Which specifications are mandatory versus preferred?</p><button type="button" className="link-button">Assign to requester</button></div><div><span className="question-number">Q2</span><p>What market source supports the proposed budget?</p><button type="button" className="link-button">Add evidence</button></div></div></div></section>

            <div className="review-actions"><div><p className="review-label">Reviewer action</p><span>Choose an action after checking the evidence. No vendor is selected automatically.</span></div><div className="action-buttons"><button type="button" className="button secondary" onClick={() => setWorkflowView("clarification")}>Request clarification</button><button type="button" className="button primary" onClick={markForApproval}>Mark ready for approval <span aria-hidden="true">→</span></button></div></div>
            <div className="form-actions"><button type="button" className="button secondary" onClick={editRequest}>Edit request</button></div>
          </section>
        )}

        <aside className="side-panel">
          <div className="side-panel-header"><span className="live-line" /> <span>What happens next</span></div>
          <div className="timeline"><div className={`timeline-item ${status === "Draft" ? "active" : "complete"}`}><span className="timeline-marker">01</span><div><strong>Requirements captured</strong><p>Clarify the capability before choosing a model.</p></div></div><div className={`timeline-item ${status === "Submitted for review" ? "active" : ""}`}><span className="timeline-marker">02</span><div><strong>Procurement review</strong><p>Compare vendors, availability, delivery, and cost.</p></div></div><div className="timeline-item"><span className="timeline-marker">03</span><div><strong>Approval decision</strong><p>Review the evidence packet and open concerns.</p></div></div></div>
          <div className="principle"><span className="principle-mark">↗</span><div><strong>Keep your options open</strong><p>A preferred model can be added, but the clearest requirements help us evaluate alternatives fairly.</p></div></div>
          <div className="reviewer-note"><span className="avatar">P</span><div><span className="note-label">Reviewer note</span><p>“The more specific the outcome, the easier it is to find an equivalent option.”</p></div></div>
        </aside>
      </div>
    </main>
  );
}
