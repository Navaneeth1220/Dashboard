# AI narrative: manual check log

Results of `npm run check:narrative` (docs/ai-report-spec.md, Step 4
"Manual check"). The script appends each run set; the Review part is
filled in by hand.

## Run set 2026-09-28 13:50 UTC

- Model: qwen2.5:7b · Ollama 0.34.4 · options `{"temperature":0.2,"num_ctx":4096,"num_predict":1024}`
- Scenario: scenarios/Westmaas_2026-01-01_assessment.json (22 facts)

| `/api/ps` | Model | Size | In VRAM | CPU/GPU | Context |
|---|---|---|---|---|---|
| before | (no model loaded) | | | | |
| after | qwen2.5:7b | 5.12 GB | 4.33 GB | 16%/84% | 4096 |

### Summary

| Measure | Value |
|---|---|
| ok | 0 of 5 |
| attempts per run | 3, 3, 1, 1, 1 |
| errors by rule (all attempts) | numbers ×13, causal ×3, leakedIds ×2, noScoreWording ×4, unscoredScore ×1 |
| max prompt_eval_count | 1398 (warning above 3000) |
| output speed, end to end | 6.8 tokens/s (eval_count / attempt time; run 1 includes model load) |

### Runs

| Run | Status | Attempt | Time | prompt_eval_count | eval_count | done_reason | Errors |
|---|---|---|---|---|---|---|---|
| 1 | failed | 1 | 118.1 s | 1161 | 511 | stop | numbers ×1 |
| 1 | failed | 2 | 40.5 s | 1221 | 543 | stop | numbers ×4 |
| 1 | failed | 3 | 59.1 s | 1398 | 595 | stop | numbers ×2, causal ×2 |
| 2 | failed | 1 | 58.9 s | 1161 | 552 | stop | numbers ×1, leakedIds ×1, noScoreWording ×1 |
| 2 | failed | 2 | 83.0 s | 1342 | 612 | stop | numbers ×1, noScoreWording ×1 |
| 2 | failed | 3 | 117.7 s | 1292 | 613 | stop | numbers ×1, causal ×1, noScoreWording ×2 |
| 3 | unavailable | 1 | 102.7 s | 1161 | 540 | stop | numbers ×1 |
| 4 | unavailable | 1 | 172.8 s | 1161 | 565 | stop | numbers ×1, leakedIds ×1 |
| 5 | unavailable | 1 | 174.2 s | 1161 | 515 | stop | numbers ×1, unscoredScore ×1 |

#### Run 1: failed (3 attempt(s), 217.7 s)

Attempt 1: prompt_eval_count 1161, eval_count 511, done_reason stop, 118.1 s
- `numbers` overview, "The assessment covered 8 effectiveness indicators, with a focus on incident handling and business continuity.": The number "8" does not appear in any fact cited by this section.

<details><summary>Attempt 1 draft (rejected)</summary>

**headline** (F11, F18, F19, F20): The assessment of Westmaas highlights critical gaps in RPO Achievement Rate and several areas with scores of 2, including Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.

**overview** (F1, F2, F3): The assessment covered 8 effectiveness indicators, with a focus on incident handling and business continuity. However, due to the incomplete Incident Handling dimension, the overall score is not available.

**measuredPerformance** (F4, F5, F6, F7, F8, F9, F10): Measurable performance indicators showed Mean Time to Detect at 18 hours, Mean Time to Respond at 30 hours, Network Operability Under Disruption at 85%, Zone Availability Rate at 40%, Operational Threshold Violation Rate at 12.5%, and RTO Achievement Rate at 50%.

**gapsAndMissingEvidence** (F11, F6): The assessment identified a programme gap in RPO Achievement Rate, scoring 0, and noted that Mean Time to Contain is not measurable due to insufficient evidence.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17): Foundational controls such as asset inventory, risk assessment, and controlled IT/OT boundary separation were in place. However, critical issues like uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation were flagged. Additionally, there was no BC plan test during the assessment period, and the vulnerability remediation rate was below target.

**priorities** (F20): The lowest results, prioritized in catalogue order, are RPO Achievement Rate (programme gap, 0), followed by Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate, all scoring 2.

</details>

Attempt 2: prompt_eval_count 1221, eval_count 543, done_reason stop, 40.5 s
- `numbers` headline, "Assessment of Westmaas, dated 2026-01-001.": The number "2026" does not appear in any fact cited by this section.
- `numbers` headline, "Assessment of Westmaas, dated 2026-01-001.": The number "01" does not appear in any fact cited by this section.
- `numbers` overview, "The assessment covered 6 of the 8 effectiveness indicators, focusing on business continuity, mean time to detect, mean time to respond, network operability under disruption, zone availability rate, and operational threshold violation rate.": The number "6" does not appear in any fact cited by this section.
- `numbers` overview, "The assessment covered 6 of the 8 effectiveness indicators, focusing on business continuity, mean time to detect, mean time to respond, network operability under disruption, zone availability rate, and operational threshold violation rate.": The number "8" does not appear in any fact cited by this section.

<details><summary>Attempt 2 draft (rejected)</summary>

**headline** (C1): Assessment of Westmaas, dated 2026-01-001.

**overview** (F2, F4, F5, F7, F8, F9): The assessment covered 6 of the 8 effectiveness indicators, focusing on business continuity, mean time to detect, mean time to respond, network operability under disruption, zone availability rate, and operational threshold violation rate.

**measuredPerformance** (F4, F5, F7, F8, F9): Indicators measured and scored include mean time to detect (3), mean time to respond (2), network operability under disruption (3), zone availability rate (2), and operational threshold violation rate (2).

**gapsAndMissingEvidence** (F1, F6, F11): Incident Handling is incomplete due to the absence of a score for Mean Time to Contain. RPO Achievement Rate is a programme gap, as the recovery point objective has not been established. Mean Time to Contain is not measurable due to insufficient evidence.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17, F18, F19): Foundational controls include asset inventory, risk assessment per zone, controlled IT/OT boundary separation, and documented BC plan for critical processes. Critical issues include uncontrolled inter-zone multi-homed devices, incomplete asset interdependency documentation, and a lack of BC plan tests. The vulnerability remediation rate is 60%, and the mean time to remediate is 75 days. Establishing the architecture foundation and the evidence needed to measure Mean Time to Contain are both measurement-readiness actions. Uncontrolled multi-homed devices may be related to the poor zone availability rate.

**priorities** (F20): The lowest results, as prioritized, are RPO Achievement Rate (programme gap, 0); then, at score 2 and of equal priority, listed in catalogue order: Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.

</details>

Attempt 3: prompt_eval_count 1398, eval_count 595, done_reason stop, 59.1 s
- `numbers` overview, "The assessment covered 7 of the 8 effectiveness indicators, focusing on incident handling, business continuity, overall score, mean time to detect, mean time to respond, network operability under disruption, and zone availability rate.": The number "7" does not appear in any fact cited by this section.
- `numbers` overview, "The assessment covered 7 of the 8 effectiveness indicators, focusing on incident handling, business continuity, overall score, mean time to detect, mean time to respond, network operability under disruption, and zone availability rate.": The number "8" does not appear in any fact cited by this section.
- `causal` gapsAndMissingEvidence, "Incident Handling is incomplete due to the absence of a score for Mean Time to Contain, resulting in no overall score.": A cited fact says "may be related"; do not claim a cause ("due to").
- `causal` gapsAndMissingEvidence, "The Mean Time to Contain is not measurable due to insufficient evidence.": A cited fact says "may be related"; do not claim a cause ("due to").

<details><summary>Attempt 3 draft (rejected)</summary>

**headline** (C1): Assessment of Westmaas, dated 2026-01-01.

**overview** (F1, F2, F3): The assessment covered 7 of the 8 effectiveness indicators, focusing on incident handling, business continuity, overall score, mean time to detect, mean time to respond, network operability under disruption, and zone availability rate. The overall score is not available due to the incomplete incident handling dimension.

**measuredPerformance** (F4, F5, F7, F8, F9): Indicators measured and scored include mean time to detect at 3, mean time to respond at 2, network operability under disruption at 3, zone availability rate at 2, and operational threshold violation rate at 2.

**gapsAndMissingEvidence** (F1, F2, F3, F6, F11, F18, F19): Incident Handling is incomplete due to the absence of a score for Mean Time to Contain, resulting in no overall score. Business Continuity has a score of 1.80, but the RPO Achievement Rate is a programme gap, scoring 0. The Mean Time to Contain is not measurable due to insufficient evidence. Additionally, the architecture foundation is weak, and uncontrolled multi-homed devices may be related to the poor Zone Availability Rate.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17): Foundational controls are in place, including asset inventory, risk assessment per zone, controlled IT/OT boundary separation, and documented BC plan for critical processes. However, uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are flagged as high priority issues. No BC plan test was performed during the assessment period. Vulnerability remediation rate is 60%, which is below target, and mean time to remediate is satisfactory.

**priorities** (F20): The lowest effectiveness results are: RPO Achievement Rate (programme gap, 0); then, at score 2 and of equal priority, Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.

</details>

#### Run 2: failed (3 attempt(s), 259.6 s)

Attempt 1: prompt_eval_count 1161, eval_count 552, done_reason stop, 58.9 s
- `numbers` overview, "The assessment of Westmaas covered 8 effectiveness indicators, with a dimension score for Business Continuity and an overall score that is not available due to the incomplete Incident Handling dimension.": The number "8" does not appear in any fact cited by this section.
- `leakedIds` foundationsAndFlags, "Westmaas has foundational controls in place such as asset inventory, risk assessment, IT/OT boundary separation, and documented BC plans.": The abbreviation "BC" appears in the text. Write "Business Continuity" instead.
- `noScoreWording` foundationsAndFlags, "Additionally, a BC plan test was not performed during the assessment period, and the architecture foundation for Mean Time to Contain is weak.": Mean Time to Contain has no score; do not describe it as "weak".

<details><summary>Attempt 1 draft (rejected)</summary>

**headline** (F11, F4, F5, F19, F20): Westmaas has a programme gap in RPO Achievement Rate and lower scores in Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.

**overview** (F1, F2, F3): The assessment of Westmaas covered 8 effectiveness indicators, with a dimension score for Business Continuity and an overall score that is not available due to the incomplete Incident Handling dimension.

**measuredPerformance** (F4, F5, F7, F8, F9, F10, F16, F17): Measurable performance indicators show Mean Time to Detect at 18 hours, Mean Time to Respond at 30 hours, Network Operability Under Disruption at 85%, Zone Availability Rate at 40%, Operational Threshold Violation Rate at 12.5%, and RTO Achievement Rate at 50%. The Vulnerability Remediation Rate is 60%, and the Mean Time to Remediate is 75 days.

**gapsAndMissingEvidence** (F1, F6, F11): Incident Handling is incomplete due to the absence of a score for Mean Time to Contain. RPO Achievement Rate is a programme gap with a score of 0, indicating the objective or capability does not exist yet.

**foundationsAndFlags** (F12, F13, F14, F15, F18): Westmaas has foundational controls in place such as asset inventory, risk assessment, IT/OT boundary separation, and documented BC plans. However, there are critical issues with uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation. Additionally, a BC plan test was not performed during the assessment period, and the architecture foundation for Mean Time to Contain is weak.

**priorities** (F20): The lowest results are prioritized as follows: RPO Achievement Rate (programme gap, 0); then, at score 2 and of equal priority, Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.

</details>

Attempt 2: prompt_eval_count 1342, eval_count 612, done_reason stop, 83.0 s
- `numbers` overview, "The assessment of Westmaas covered 8 effectiveness indicators, with a dimension score for Business Continuity and an overall score that is not available due to the incomplete Incident Handling dimension.": The number "8" does not appear in any fact cited by this section.
- `noScoreWording` foundationsAndFlags, "Additionally, a Business Continuity plan test was not performed during the assessment period, and the architecture foundation for Mean Time to Contain is weak.": Mean Time to Contain has no score; do not describe it as "weak".

<details><summary>Attempt 2 draft (rejected)</summary>

**headline** (F11, F19, F20): The lowest effectiveness results are the programme gap in RPO Achievement Rate (0) and the scores of 2 for Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.

**overview** (F1, F2, F3): The assessment of Westmaas covered 8 effectiveness indicators, with a dimension score for Business Continuity and an overall score that is not available due to the incomplete Incident Handling dimension.

**measuredPerformance** (F4, F5, F7, F8, F9, F10, F16, F17): Measurable performance indicators include Mean Time to Detect (3), Mean Time to Respond (2), Network Operability Under Disruption (3), Zone Availability Rate (2), Operational Threshold Violation Rate (2), RTO Achievement Rate (2), Vulnerability Remediation Rate (60%), and Mean Time to Remediate (75 days).

**gapsAndMissingEvidence** (F11, F12, F13, F14, F15, F18, F19): There are programme gaps and missing evidence, including the absence of a RPO Achievement Rate, uncontrolled inter-zone multi-homed devices, incomplete or outdated asset interdependency documentation, a lack of Business Continuity plan testing, and the need to establish the architecture foundation for Mean Time to Contain.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17, F18, F19): Westmaas has foundational controls in place such as asset inventory, risk assessment, IT/OT boundary separation, and documented Business Continuity plans. However, uncontrolled inter-zone multi-homed devices were identified, and the asset interdependency documentation is incomplete or outdated. Additionally, a Business Continuity plan test was not performed during the assessment period, and the architecture foundation for Mean Time to Contain is weak. These issues may be related and should be reviewed together.

**priorities** (F20): The priorities for improvement are the programme gap in RPO Achievement Rate (0) and the scores of 2 for Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.

</details>

Attempt 3: prompt_eval_count 1292, eval_count 613, done_reason stop, 117.7 s
- `numbers` overview, "The assessment covered 8 effectiveness indicators, with a complete Business Continuity score of 1.80 out of 4.": The number "8" does not appear in any fact cited by this section.
- `causal` gapsAndMissingEvidence, "Incident Handling is incomplete due to the absence of a score for Mean Time to Contain.": A cited fact says "may be related"; do not claim a cause ("due to").
- `noScoreWording` gapsAndMissingEvidence, "The architecture foundation for Mean Time to Contain is weak, and a segmentation bypass may be related to the poor Zone Availability Rate.": Mean Time to Contain has no score; do not describe it as "weak".
- `noScoreWording` foundationsAndFlags, "A BC plan test was not performed, and the architecture foundation for Mean Time to Contain is weak.": Mean Time to Contain has no score; do not describe it as "weak".

<details><summary>Attempt 3 draft (rejected)</summary>

**headline** (C1): Cybersecurity assessment of Westmaas, dated 2026-01-01.

**overview** (F2, F1, F3): The assessment covered 8 effectiveness indicators, with a complete Business Continuity score of 1.80 out of 4. The overall score is not available due to the incomplete Incident Handling dimension.

**measuredPerformance** (F4, F5, F7, F8, F9, F10, F16, F17): Indicators measured include Mean Time to Detect (3), Mean Time to Respond (2), Network Operability Under Disruption (3), Zone Availability Rate (2), Operational Threshold Violation Rate (2), RTO Achievement Rate (2), Vulnerability Remediation Rate (60%), and Mean Time to Remediate (75 days).

**gapsAndMissingEvidence** (F1, F11, F12, F13, F14, F15, F18, F19): Incident Handling is incomplete due to the absence of a score for Mean Time to Contain. RPO Achievement Rate is a programme gap with a score of 0. The asset inventory, risk assessment, IT/OT boundary separation, and BC plan for critical processes are in place. Uncontrolled inter-zone multi-homed devices were identified, and the interdependency documentation is incomplete. No BC plan test was performed during the assessment period. The architecture foundation for Mean Time to Contain is weak, and a segmentation bypass may be related to the poor Zone Availability Rate.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17, F18, F19): Foundational controls include asset inventory, risk assessment, IT/OT boundary separation, and BC plan documentation. Critical issues include uncontrolled inter-zone multi-homed devices and incomplete interdependency documentation. A BC plan test was not performed, and the architecture foundation for Mean Time to Contain is weak. The vulnerability remediation rate is below target, and the Mean Time to Contain is not measurable.

**priorities** (F20): The lowest results are: RPO Achievement Rate (programme gap, 0); then, at score 2 and of equal priority, Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.

</details>

#### Run 3: unavailable (1 attempt(s), 282.7 s)

Unavailable: `timeout`: No response from Ollama within 180 s.

Attempt 1: prompt_eval_count 1161, eval_count 540, done_reason stop, 102.7 s
- `numbers` overview, "The assessment covered 8 effectiveness indicators across various dimensions.": The number "8" does not appear in any fact cited by this section.

<details><summary>Attempt 1 draft (rejected)</summary>

**headline** (F11, F18, F19, F20): The assessment of Westmaas reveals critical gaps in RPO Achievement Rate and several areas requiring improvement, including Mean Time to Respond, Zone Availability Rate, and Operational Threshold Violation Rate.

**overview** (F1, F2, F3): The assessment covered 8 effectiveness indicators across various dimensions. Incident Handling is incomplete due to the absence of Mean Time to Contain data, while Business Continuity has a score of 1.80. The overall score is not available due to the incomplete dimension.

**measuredPerformance** (F4, F5, F6, F7, F8, F9, F10): Indicators like Mean Time to Detect (3) and Mean Time to Respond (2) are measured and scored. Network Operability Under Disruption (3) and Zone Availability Rate (3) are also measured, while Operational Threshold Violation Rate (2) and RTO Achievement Rate (2) are measured but scored lower.

**gapsAndMissingEvidence** (F11, F18, F19): RPO Achievement Rate is a programme gap with a score of 0, indicating the objective does not exist. Additionally, the architecture foundation and Mean Time to Contain measurement readiness need improvement, and uncontrolled multi-homed devices may be related to poor Zone Availability Rate.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17): Foundational controls like asset inventory and IT/OT boundary separation are in place. However, uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are flagged as critical and high priority issues. No BC plan test was conducted during the assessment period, and the vulnerability remediation rate is below target.

**priorities** (F20): The lowest results, as prioritized, are RPO Achievement Rate (programme gap, 0), followed by Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate, all scored 2.

</details>

#### Run 4: unavailable (1 attempt(s), 352.8 s)

Unavailable: `timeout`: No response from Ollama within 180 s.

Attempt 1: prompt_eval_count 1161, eval_count 565, done_reason stop, 172.8 s
- `numbers` overview, "The assessment covered 8 effectiveness indicators across various dimensions.": The number "8" does not appear in any fact cited by this section.
- `leakedIds` foundationsAndFlags, "Foundational controls and process evidence are in place, including asset inventory, risk assessment, IT/OT boundary separation, and documented BC plans.": The abbreviation "BC" appears in the text. Write "Business Continuity" instead.

<details><summary>Attempt 1 draft (rejected)</summary>

**headline** (F11, F19, F20): The assessment of Westmaas reveals critical gaps and areas for improvement, particularly in RPO Achievement Rate and Mean Time to Respond.

**overview** (F1, F2, F3): The assessment covered 8 effectiveness indicators across various dimensions. Due to the incomplete Incident Handling dimension, the overall score is not available. Business Continuity achieved a score of 1.80 out of 4.

**measuredPerformance** (F4, F5, F7, F8, F9, F10, F16, F17): Measurable performance indicators showed Mean Time to Detect at 18 hours, Mean Time to Respond at 30 hours, Network Operability Under Disruption at 85%, Zone Availability Rate at 40%, Operational Threshold Violation Rate at 12.5%, and RTO Achievement Rate at 50%. The Vulnerability Remediation Rate was 60%, and the Mean Time to Remediate was 75 days.

**gapsAndMissingEvidence** (F1, F11, F18): Incident Handling is incomplete due to the absence of a Mean Time to Contain score. RPO Achievement Rate is a programme gap, scoring 0 as the objective does not exist yet. Establishing the architecture foundation and the evidence needed to measure Mean Time to Contain are both measurement-readiness actions.

**foundationsAndFlags** (F12, F13, F14, F15, F19): Foundational controls and process evidence are in place, including asset inventory, risk assessment, IT/OT boundary separation, and documented BC plans. However, uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation were identified. Additionally, a BC plan test was not performed during the assessment period, and a segmentation bypass may be related to the poor Zone Availability Rate.

**priorities** (F20): The lowest results, as prioritized, are RPO Achievement Rate (programme gap, 0), followed by Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate, all scoring 2.

</details>

#### Run 5: unavailable (1 attempt(s), 354.2 s)

Unavailable: `timeout`: No response from Ollama within 180 s.

Attempt 1: prompt_eval_count 1161, eval_count 515, done_reason stop, 174.2 s
- `numbers` overview, "The assessment covered eight effectiveness indicators, with a focus on incident handling and business continuity.": The number "eight" does not appear in any fact cited by this section.
- `unscoredScore` measuredPerformance, "Indicators such as mean time to detect and mean time to contain were measured, with mean time to detect scoring 3 and mean time to contain scoring 2.": Mean Time to Contain has no score; do not give it a score.

<details><summary>Attempt 1 draft (rejected)</summary>

**headline** (F11, F19, F20): The assessment of Westmaas highlights critical gaps, including the absence of a recovery point objective (RPO) achievement rate, and areas with poor performance such as the zone availability rate and mean time to respond.

**overview** (F1, F2, F3): The assessment covered eight effectiveness indicators, with a focus on incident handling and business continuity. However, due to the incomplete incident handling dimension, the overall score is not available.

**measuredPerformance** (F4, F5, F6, F7, F8, F9, F10): Indicators such as mean time to detect and mean time to contain were measured, with mean time to detect scoring 3 and mean time to contain scoring 2. Network operability under disruption and zone availability rate scored 3 and 2, respectively, while operational threshold violation rate and RTO achievement rate scored 2.

**gapsAndMissingEvidence** (F11, F12, F13, F14, F15): The assessment identified a programme gap for RPO achievement rate, scoring 0. Additionally, uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation were noted as high-risk issues. A BC plan test was also not performed during the assessment period.

**foundationsAndFlags** (F16, F17, F18, F19): While the asset inventory and risk assessment were maintained, there were critical issues with uncontrolled multi-homed devices and incomplete BC plan tests. The vulnerability remediation rate was below target, but the process evidence was not scored. The assessment also highlighted the need to address the architecture foundation and measurement readiness for mean time to contain.

**priorities** (F20): The lowest results, as prioritized, are the RPO achievement rate (programme gap, 0), followed by mean time to respond, zone availability rate, operational threshold violation rate, and RTO achievement rate, all scoring 2.

</details>

### Review

No accepted narrative. Runs 1–2 failed validation three times; runs 3–5
timed out on attempt 2 (see Performance). No draft was rejected only by a
wrong validator error: every rejected attempt also had at least one correct
error.

1. **Invariant breaks the validator missed**
   - Run 3 att. 1: "Zone Availability Rate (3)": the score is 2. Passes the
     numbers check because 3 is in other cited facts (F4, F7). The draft was
     rejected only for "8"; without that it would have been accepted.
   - Run 5 att. 1: "mean time to detect and mean time to contain were
     measured": Mean Time to Contain was not measurable (invariant 2).
     Caught only because the same sentence also gave it a score.
   - Run 1 att. 3: "mean time to detect at 3" reads as 3 hours (18 hours,
     score 3). Value/score conflation.
   - Run 2 att. 2: "These issues may be related and should be reviewed
     together" extends the one "may be related" pair to all listed flags.
   - Run 2 att. 2: flags described as "programme gaps and missing evidence"
     (blurs invariant 1: a programme gap is a score-0 objective).
   - Severity misattributed: "critical gaps in RPO Achievement Rate"
     (runs 1, 3, 4 headlines; CRITICAL belongs to the multi-homing flag);
     multi-homing "flagged as high priority" (run 1 att. 3; it is CRITICAL).
   - Rule 8: "particularly in … Mean Time to Respond" singles out one of four
     equal-priority items (run 4). "poor performance such as … mean time to
     respond" (run 5): no fact calls it poor.
   - Run 5: "incomplete BC plan tests" (fact: no test was performed).
2. **Validator errors that look wrong** (23 errors: 18 right, 5 wrong)
   - Right: all 13 `numbers` ("8"/"eight" ×9 with C2 uncited; "6 of the 8",
     "7 of the 8" are counting; "2026-01-001" is a malformed date), all 4
     `noScoreWording` ("the architecture foundation for Mean Time to Contain
     is weak" moves F18's "weak" from the multi-homing item onto Mean Time to
     Contain), the `unscoredScore` ("mean time to contain scoring 2").
   - Wrong, `leakedIds` ×2 (runs 2, 4): "documented BC plans". The allowed
     list matches the exact next word "plan", not the plural. Validator bug.
   - Wrong as a finding, `causal` ×3 (runs 1, 2): "Incident Handling is
     incomplete due to the absence of a score…", "not measurable due to
     insufficient evidence". The "due to" explains the no-score rule, not
     the may-be-related pair; the check is section-wide by spec, and the
     sections cited F18/F19.
3. **Paraphrased item names**: indicators and dimensions always appeared by
   full name (case varies; matched). Foundational items were paraphrased:
   "asset inventory", "risk assessment", "IT/OT boundary separation",
   "BC plan(s)" / "documented BC plan(s)" / "BC plan documentation",
   "BC plan test(s)", "multi-homed devices" / "uncontrolled inter-zone
   multi-homed devices" / "multi-homing", "interdependency documentation",
   "recovery point objective (RPO) achievement rate".
4. **Prompt conformance**
   - Headline one sentence: yes in all 9 drafts, but 3 of 4 retry headlines
     shrank to "Assessment of Westmaas, dated 2026-01-01." (no main point).
   - 2–4 sentences per section: often broken (measuredPerformance usually 1
     sentence; gapsAndMissingEvidence up to 6; foundationsAndFlags up to 5).
   - No bullets: yes.
   - Section fit: C2 was never cited in any draft (root of every "8" error);
     process facts F16/F17 in measuredPerformance (runs 2, 4); flags and
     in-place controls in gapsAndMissingEvidence (runs 2, 5); F6 cited in
     measuredPerformance without being mentioned (runs 1, 3, 5).
5. **Items named without their fact cited**: the indicator count (C2) in
   every run; run 5 foundationsAndFlags names asset inventory, risk
   assessment and BC plan tests while citing only F16–F19. Moderate evidence
   for a check 8.
6. **Band ranges**: no failure observed. Drafts said "below target" (the
   engine's words) and "satisfactory", never quoting "(50–69%)" or
   "(31–90 days)", so this was only weakly exercised.

**Performance**: generation speed fell steadily from 14.8 to 3.0 tokens/s
over ~25 minutes (Ollama server log, identical workload, prompt cached), on a
GTX 1060 Max-Q with 26/29 layers on the GPU: consistent with thermal
throttling. At ~3 tokens/s a ~550-token draft takes ~3 minutes, hence the
timeouts. Timed-out requests were cancelled server-side (no queueing).
