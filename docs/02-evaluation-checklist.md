# Evaluation Checklist

Mastra Agent Lab · Quality, regression, and safety verification

**Status:** Recommended process; targets below are examples, not measured results.  
**Reviewed:** 24 November 2026

## Purpose

Evaluate from the first lab. Keep deterministic software tests separate from probabilistic model evaluations, and measure retrieval, tool behavior, and final answers independently.

Mastra scorers support model-graded, rule-based, and statistical evaluation approaches. Verify scorer names, packages, and invocation APIs against the installed version. [Evals](https://mastra.ai/docs/evals/overview) · [Built-in scorers](https://mastra.ai/docs/evals/built-in-scorers)

## Evaluation layers

| Layer | Verify | Default execution |
|---|---|---|
| Unit | Business rules, schemas, permissions, tool logic | Every pull request; no live LLM |
| Contract | Tool/API request and response compatibility | Every pull request using fixtures |
| Integration | Storage, retrieval, providers, workflow persistence | Controlled CI or staging |
| Agent behavior | Task completion, evidence use, tool selection | Small release-gating dataset |
| Adversarial | Injection, data leakage, unauthorized actions | Changes to relevant boundaries and releases |
| Operational | Latency, cost, retries, cancellation, recovery | Staging and production monitoring |

## Dataset design

Start with 20–50 representative cases as a practical lab baseline, then expand based on failures and risk. A small dataset is not proof of production safety.

- [ ] Include ordinary successful requests.
- [ ] Include ambiguous requests requiring clarification.
- [ ] Include missing evidence and legitimate abstention.
- [ ] Include invalid input and schema violations.
- [ ] Include tool timeout, provider failure, and rate-limit cases.
- [ ] Include long contexts and truncated or oversized tool output.
- [ ] Include unauthorized and cross-tenant requests.
- [ ] Include injection attempts in user input, documents, and tool results.
- [ ] Include repeated requests and duplicate side effects.
- [ ] Include memory conflicts and document update/deletion cases where applicable.
- [ ] Keep a held-out set separate from prompt-development examples.
- [ ] Remove secrets and use synthetic or approved, de-identified data.
- [ ] Record fixture versions, source permissions, and expected outcomes.

Suggested application-level fixture format; this is not a Mastra API schema:

```json
{
  "id": "rag-no-evidence-001",
  "category": "abstention",
  "input": "What is the policy for an undocumented product?",
  "identity": { "tenantId": "tenant-a", "role": "reader" },
  "fixtures": { "retrievedDocuments": [] },
  "expected": {
    "outcome": "insufficient_evidence",
    "forbiddenTools": ["deleteRecord"],
    "mustNotReveal": ["tenant-b-secret"]
  }
}
```

Do not trust a client-supplied identity object in production. Evaluation identities are controlled fixtures; runtime identity must come from authentication.

## Scorer selection

| Quality dimension | Recommended method | Important limitation |
|---|---|---|
| Output validity | Parse schema and apply business rules | Valid JSON can still be factually wrong |
| Tool permissions | Deterministic allow/deny assertions | Inspect actual execution, not promised behavior |
| Tool selection | Compare tool trace with expected allowed paths | Multiple paths may be acceptable |
| Tool arguments | Validate schema, scope, and semantic correctness | Correct types do not imply correct record IDs |
| Task completion | Explicit rubric plus human-reviewed judge | Avoid rewarding polished but incomplete answers |
| Grounding | Verify claim support against retrieved passages | Citation presence alone is insufficient |
| Retrieval | Recall@k, precision@k, or ranking metrics | Needs labeled relevant documents |
| Safety | Deterministic checks plus adversarial review | No single score proves safety |
| Performance | Runtime, tokens, cost, retries | Measure representative workloads |

Calibrate model judges against human-reviewed examples. Pin the judge configuration, audit disagreements, and do not use a model judge as the only control for authorization or high-impact actions.

## Metrics and definitions

- **Task completion rate:** completed cases divided by eligible evaluated cases.
- **Schema validity rate:** parseable, business-valid outputs divided by applicable outputs.
- **Tool argument accuracy:** correct argument sets divided by evaluated tool calls.
- **Recall@k:** relevant documents retrieved in the top k divided by all labeled relevant documents for that query.
- **Precision@k:** relevant documents in the top k divided by k, using a documented convention when fewer than k are returned.
- **Citation support:** supported cited claims divided by assessed cited claims; also measure uncited factual claims.
- **Safety violation count:** observed prohibited actions or disclosures, reported by severity.
- **Latency:** report p50 and p95 end-to-end; report time to first token separately for streaming.
- **Cost:** include all model calls, retries, embeddings, and model-based judges; report infrastructure separately.

Report denominators, sample sizes, dataset versions, and exclusions. Avoid presenting unstable small-sample percentages as conclusive evidence.

## Example release gates

These are starting points for discussion, not universal standards. Set final targets per lab and product risk.

| Gate | Example policy |
|---|---|
| Deterministic tests | All required checks pass |
| Output contracts | All required schema fixtures pass |
| Authorization | Zero observed unauthorized executions in the release suite |
| Data isolation | Zero observed cross-tenant disclosures in the release suite |
| Approval | Every protected write requires valid approval |
| Task completion | No unexplained regression beyond the agreed tolerance |
| Retrieval | Meet the project-specific baseline on held-out queries |
| Latency and cost | Stay within documented workload-specific budgets |
| Human review | Required for consequential actions and material judge disagreements |

Zero observed failures means only that no failures were found in the tested cases; it is not a guarantee of zero risk.

## Regression procedure

1. Freeze dataset, fixture, scorer, and judge versions.
2. Record the current model, prompt, tool, and configuration baseline.
3. Change one major variable where practical.
4. Run deterministic checks first.
5. Run the same held-out cases against baseline and candidate.
6. Repeat probabilistic cases enough to understand run-to-run variation.
7. Compare aggregate results and individual failures by category.
8. Review new failure modes, even when the overall score improves.
9. Approve or reject the change with evidence and an owner.
10. Save reports and add confirmed failures as regression cases.

A provider alias can change behavior without a code change. Record provider model identifiers and run periodic evaluations when fixed model revisions are unavailable.

## CI tiers

- **Pull requests:** Typecheck, lint, unit tests, contract tests, deterministic safety checks.
- **Scheduled or approved runs:** Budget-limited live-model evaluations and provider compatibility tests.
- **Release candidates:** Held-out evaluation, adversarial suite, persistence recovery, and staging checks.
- **Production:** Sample approved/redacted traces, monitor drift, and convert incidents into fixtures.

Never expose production secrets to untrusted pull-request code. Live-model runs require explicit budgets, bounded concurrency, timeouts, and controlled credentials.

## Minimum checklist per lab

- [ ] One happy-path case.
- [ ] One invalid-input case.
- [ ] One dependency-failure case when applicable.
- [ ] One permission or safety case when applicable.
- [ ] Clear completion or abstention criteria.
- [ ] Trace inspection with sensitive content redacted.
- [ ] Known limitations documented.

## Evaluation report template

```markdown
# Evaluation: <change or release>

- Commit:
- Dataset / fixture version:
- Model and configuration:
- Judge and scorer versions:
- Cases / repetitions:
- Baseline:
- Candidate:
- Budget and actual cost:

## Results
Metrics, sample sizes, and per-category comparisons.

## Failures
Case IDs, trace references, severity, and owner.

## Decision
Approve / reject / limited rollout, with rationale.
```

## Related documents

- [Architecture decisions](01-architecture-decisions.md)
- [Production checklist](03-production-checklist.md)
- [Mastra experiments](https://mastra.ai/docs/evals/experiments)
