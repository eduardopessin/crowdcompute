# CrowdCompute — the proposal

Pool demand from a few hundred people, fund one dedicated 8×H200 node in Europe, and run a
frontier open-weight model on it. This document is the argument, the arithmetic and the parts
that are not solved yet.

It is a proposal, not an offer. Nothing here is a contract, a price or a guarantee.

**Status (22 September 2026):** live demand test at [crowdcompute.eu](https://crowdcompute.eu).
49 of 300 target responses say "yes, at approximately €59/month", out of 61 total responses.
No infrastructure contract signed, no payments collected, no legal entity formed.

---

## 1. The problem

Running capable open-weight models yourself is not economically sensible alone. A single 8×H200
node costs more per month than most individuals or small teams can justify, and it sits idle
most of the time. So people rent from proprietary providers instead — which is cheap, effective,
and comes with three properties you cannot inspect:

- **The model changes underneath you.** Version, quantisation and routing are opaque. A prompt
  that worked last month may behave differently today, with no changelog you can diff.
- **Your inputs are someone else's training signal**, subject to retention policies you read
  once and cannot verify.
- **The alignment and system-prompt layer is not yours.** You get a model shaped by someone
  else's policy decisions, and you cannot see the shaping.

None of this makes those providers bad. It makes them unsuitable for people whose work depends
on knowing exactly what is running.

## 2. The hypothesis

Individually the hardware is unaffordable. Collectively it is not.

One 8×H200 SXM node — roughly 1.1 TB of HBM — holds a frontier open-weight model in memory with
room for real context. Split across a few hundred people who do not all generate tokens at the
same second, the per-person cost lands near a normal software subscription.

That is the whole idea. The rest of this document is whether the arithmetic survives contact
with reality.

## 3. The arithmetic

The landing page states the headline: **300 × €59 ≈ €17,700/month**. That figure is gross
revenue, and presenting it as the infrastructure budget would be misleading. Here is the full
path from what members pay to what is actually available for GPUs.

### 3.1 From gross to available

Assuming €59 is the final consumer price and VAT is included (EU digital services are taxed in
the customer's country of residence under the OSS scheme; the blended rate below is an estimate,
since the real rate depends on where members actually live):

| Line                                            | Monthly     |
| ----------------------------------------------- | ----------- |
| Gross revenue (300 × €59)                       | €17,700     |
| − VAT (OSS, ~21% blended estimate)              | −€3,072     |
| − Payment processing (~1.5% + €0.25 per charge) | −€340       |
| − Storage, networking, monitoring _(estimate)_  | −€1,000     |
| **= Available for compute**                     | **€13,288** |

**VAT is the single biggest correction to the headline number, and it is absent from the
landing page.** For a project whose stated principle is "know what you're funding", that gap
needs closing.

### 3.2 What 8×H200 actually costs in Europe

From public market pricing (September 2026). **These are published list ranges, not a quote.
No provider has been contacted and no contract negotiated.**

| Tier                                                 | Monthly range  |
| ---------------------------------------------------- | -------------- |
| Reserved / committed (12-month, wholesale GPU cloud) | €11,000–16,000 |
| European managed bare metal, enterprise SLA          | €16,000–25,000 |
| Hyperscaler on-demand                                | €27,000–37,000 |

€13,288 available lands **inside the reserved tier, toward its lower half.** The model works
only with a committed long-term contract at competitive wholesale pricing. On-demand pricing is
out of reach by a factor of two to three, and that is not a rounding error — it is a structural
constraint on how this can ever be bought.

### 3.3 Sensitivity to membership

Fixed infrastructure cost, variable member count. This is where the proposal is fragile:

| Members | Gross   | Available for compute | Covers €11k floor? |
| ------- | ------- | --------------------- | ------------------ |
| 200     | €11,800 | €8,525                | No                 |
| 250     | €14,750 | €10,906               | No — €94 short     |
| **300** | €17,700 | **€13,288**           | Yes, +€2,288       |
| 350     | €20,650 | €15,669               | Yes, +€4,669       |
| 400     | €23,600 | €18,050               | Yes, +€7,050       |

At 250 members the project does not cover even the cheapest observed rate. **The 300 target is
not a marketing round number — it is roughly where the model becomes viable at all.**

Inverted, against different infrastructure costs:

| If infrastructure costs | Required price per member (300 members) |
| ----------------------- | --------------------------------------- |
| €11,000/month           | €49.77                                  |
| €13,000/month           | €57.84                                  |
| €16,000/month           | €69.94                                  |

€59 is a bet that a €12–13k/month contract is achievable. If the best real quote is €16k, the
honest options are a higher price or no cluster — not a thinner reserve.

### 3.4 What the €2,288 has to cover

At 300 members and an €11k contract, the surplus is €2,288/month. That single figure is
simultaneously the operational reserve, the churn buffer, the incident budget and any
compensation for the person running it. It is thin. Anyone evaluating this proposal should treat
it as the least comfortable number in the document.

## 4. What this is not

- **Not GPU ownership.** Members fund access to infrastructure. They do not own hardware and
  hold no equity, title or residual claim.
- **Not a service level agreement.** No uptime, latency or throughput guarantee is offered.
- **Not a guaranteed model.** GLM, Kimi and Qwen are candidates. The actual choice depends on
  licensing, memory footprint and deployment testing.
- **Not unlimited capacity.** 300 members share one node. Fair scheduling, continuous batching,
  prefix caching and usage limits are how that is managed. Very large context requests would be
  queued or fair-use, not the default experience.
- **Not a purchase.** The current site collects expressions of interest. No payment instrument
  is collected and no money changes hands.

## 5. How the number on the site is counted

The progress figure is deliberately conservative, and the logic is auditable in
[`functions/lib/`](../functions/lib/):

- Only responses with `would_pay_59 = 'yes'` increment the committed count. "Maybe" and "no" are
  stored and reported separately in `totalResponses`, and never inflate the headline.
- Model votes count **all** responses, including "maybe", "no" and "community decides", because
  preference is informative even from people who would not join.
- Emails are normalised and uniquely constrained, so one address counts once.

What this cannot do: prove that 300 distinct humans are behind 300 addresses. Turnstile and
email uniqueness raise the cost of gaming the number; they do not verify identity or email
ownership. Disposable addresses remain possible. **The count is a demand signal, not a
verified roster** — and it should not be treated as one when the decision to spend money arrives.

## 6. Open questions

These are unresolved. They are listed because a proposal that hides them is not worth reading.

1. **Legal entity.** 300 × €59 × 12 ≈ €212k/year flowing through someone. This needs a company,
   VAT registration under OSS, terms of service and a refund policy. None exist today. This is
   the hardest blocker and it is not technical.
2. **Who holds the contract risk.** Committed GPU pricing means a 12-month obligation. If
   membership falls below the viability floor in month 4, someone is personally liable for the
   remaining term. That risk has no owner yet.
3. **Provider selection.** No provider contacted. Section 3.2 is market research, not a quote.
4. **Fair-use policy.** "Fair scheduling" needs concrete numbers — tokens per member, concurrency
   limits, queue behaviour under load — derived from benchmarks that have not been run.
5. **Model selection process.** The vote is advisory. Who decides, and how ties or licensing
   conflicts are resolved, is undefined.
6. **What happens to the interest list if this stops.** Members have given an email address and a
   country. The retention policy targets deletion within 12 months; the wind-down path should be
   stated before, not after.

## 7. Decision criteria

The cluster launches only if all of the following hold:

- **≥300 "yes" responses** — below that the arithmetic in §3.3 does not close.
- **A signed quote at ≤€13,000/month** for committed 8×H200 capacity in an EU datacenter.
- **A legal entity and VAT registration in place** before a single euro is collected.
- **A benchmarked capacity model** showing the node serves the projected concurrent load at
  acceptable latency.

If any fails, the honest outcome is to publish the numbers, delete the interest list and stop.
A project built on transparency does not get to quietly fade out.

---

_Figures dated 22 September 2026. Market pricing from public sources; the VAT rate, ancillary
costs and per-member economics are estimates. Nothing in this document is a price, an offer or
a commitment._
