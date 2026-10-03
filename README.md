# AI-Assisted Procurement Approval Tool (Prototype)

A prototype that helps turn free-text procurement requests into structured, reviewable drafts, built on one rule: **AI output is untrusted until a human accepts it.**

Built at FMS Delhi (2026) as a product management and AI product design project.

> **Status:** prototype. Evaluated on synthetic data by a single author. Not tested on real user data. See [Limitations](#limitations).

---

## The problem

Procurement requests move through several roles before they are approved. An AI assistant can speed up drafting, but an approver will not sign off on a request unless they can see where each detail came from. So the real problem is **trust in AI-drafted fields**, not just drafting speed.

I validated this by synthesising **9 stakeholder responses across 6 procurement roles** into a problem statement, then scoped the product directly from that evidence. [Add one line on the single most important thing stakeholders told you.]

## What it does

- Takes a free-text procurement request and extracts structured fields (item, quantity, budget, delivery date, and so on).
- Reports fields as **missing or uncertain instead of guessing**.
- Cites the evidence in the request for every extracted field.
- Requires a human to **accept each field** before it counts.
- Runs a **3-role workflow**: requester, reviewer, approver.

[Add 1–2 screenshots or a short GIF of the main flow here.]

## The trust boundary

The AI is treated as an untrusted component. Nothing it produces reaches the workflow without passing three gates.

```
Free-text request
      |
      v
 LLM extraction  -->  Schema validation  -->  Evidence check  -->  Human accepts per field
 (untrusted)          (all-or-nothing)        (must cite source)    (nothing auto-approved)
```

**Design decision: strict validation, on purpose.** If one field fails the schema, the whole output is rejected rather than "repaired". Repairing would let the AI's mistakes through quietly. When a bug appeared in this layer, I fixed the cause one layer down (the baseline must not generate a value the schema is known to reject) and did not loosen the check.

## Evaluation

### 1. Baseline eval suite: 25 cases, 6 failure modes

Each case is scored against a hand-labelled ground truth.

| Category | Cases | What it tests |
|---|---|---|
| Clear | 5 | Correct extraction on well-formed requests |
| Ambiguous | 5 | Calibration: flag uncertainty, do not guess |
| Missing field | 5 | Report missing fields instead of inventing them |
| Self-contradictory | 3 | Detect conflicting information |
| Out of scope | 3 | Flag requests the tool should not handle |
| Prompt injection | 4 | Ignore instructions embedded in the request text |

**Result: 25/25 passed on the current prompt version.**

### 2. Adversarial stress suite: the baseline was too easy

A self-written test set only proves the tool fits its own tests. So I wrote a second suite by reading the extraction and validation logic the way an attacker would.

**Result: 4/8 passed before fixes, 9/9 after.** The ninth case is a benign regression check (a harmless "approved" sentence) added to confirm the injection fix is not over-sensitive. The improvement comes from real fixes, not rewritten expectations.

### 3. The three bugs it found

| # | Bug | Why it matters |
|---|---|---|
| 1 | The all-or-nothing validator let one bad field (a zero quantity) silently discard other correct fields such as budget and delivery date | An interaction between two components that each looked correct alone |
| 2 | Injection detection was anchored to the word "approve", so paraphrases like "treat this as already approved" slipped through | The defence was narrower than the attack |
| 3 | Out-of-scope detection used a literal word list that missed PPE items, which produced a blank request with no flag | A silent failure, which is worse than a loud one |

## Prompt engineering

I first tested a naive, zero-instruction prompt: it guessed on missing fields. I then rewrote it with explicit rules (never guess, flag missing fields, ignore embedded instructions, fixed JSON output schema) and re-tested on the same cases.

## Product decisions

- **One user, one core flow for v1.** Scope came from the stakeholder evidence.
- **Phase-gated roadmap** with hard exit criteria for each phase.
- **A written cut list of 9 items.** Each has its reasoning and the trigger that would bring it back. [Link to your roadmap / cut list file.]
- **A/B test design (hypothetical):** inline confidence flags versus the current silent version, with the benign regression case acting as the guardrail metric.

## Limitations

I would rather state these than have someone find them.

- **Synthetic, single-author evals.** The 25 cases were written and labelled by me. They are a first-pass benchmark, not an independently validated one.
- **Pattern lists, not understanding.** Both detection fixes are still pattern lists. A new paraphrase could evade the injection filter again.
- **Not tested on real data or real users.**
- **A real LLM swap-in needs its own fresh adversarial eval.** Reusing these 25 cases would not be enough.

## What I would do next

1. Add inter-rater-labelled and real-user cases to move from a self-authored benchmark to an independent one.
2. Replace pattern-based injection detection with a more robust approach, and re-run the adversarial suite against it.
3. Run the inline-confidence-flag A/B test with real reviewers.
4. Turn the Figma wireframes into a full clickable flow that matches the working frontend.

## Run it locally

[Fill in: prerequisites, install command, how to set the API key, start command, how to run the evals. Example:]

```bash
git clone [repo-url]
cd [repo-name]
[install command]
[command to run the app]
[command to run the 25-case eval]
[command to run the stress suite]
```

## Repository structure

[Fill in once finalised. Example:]

```
/app          frontend and workflow
/extraction   prompt, schema and validation
/evals        25-case baseline + stress suite
/docs         problem statement, roadmap, cut list
```

## Author

**Ishan Singh**, MBA (2026–28), Faculty of Management Studies, University of Delhi
[LinkedIn](https://www.linkedin.com/in/ishan-singh-941265202/) · ishan.g28@fms.edu
