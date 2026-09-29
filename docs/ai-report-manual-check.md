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
## Run set 2026-09-28 14:37 UTC

- Model: qwen2.5:7b · Ollama 0.34.4 · options `{"temperature":0.2,"num_ctx":4096,"num_predict":1024}`
- Timeout 300.0 s per attempt · 60.0 s cooldown between runs
- Scenario: scenarios/Westmaas_2026-01-01_assessment.json (22 facts)

| `/api/ps` | Model | Size | In VRAM | CPU/GPU | Context |
|---|---|---|---|---|---|
| before | (no model loaded) | | | | |
| after | qwen2.5:7b | 5.12 GB | 4.33 GB | 16%/84% | 4096 |

### Summary

| Measure | Value |
|---|---|
| ok | 0 of 5 |
| attempts per run | 3, 3, 3, 3, 3 |
| errors by rule (all attempts) | severity ×16, attribution ×8, causal ×10, numbers ×7, noScoreWording ×3 |
| max prompt_eval_count | 1654 (warning above 3000) |
| generation speed (tokens/s, eval_duration) | first 14.9, last 3.9, min 3.5, max 14.9 |

### Runs

| Run | Status | Attempt | Time | prompt_eval_count | eval_count | tokens/s | done_reason | Errors |
|---|---|---|---|---|---|---|---|---|
| 1 | failed | 1 | 61.8 s | 1261 | 557 | 14.9 | stop | severity ×1, attribution ×1, causal ×1 |
| 1 | failed | 2 | 41.0 s | 1486 | 558 | 13.9 | stop | severity ×2, causal ×1 |
| 1 | failed | 3 | 40.0 s | 1425 | 463 | 11.7 | stop | severity ×1 |
| 2 | failed | 1 | 34.6 s | 1261 | 507 | 14.8 | stop | numbers ×1, causal ×1 |
| 2 | failed | 2 | 87.8 s | 1356 | 901 | 10.3 | stop | causal ×4, severity ×2, noScoreWording ×2 |
| 2 | failed | 3 | 84.2 s | 1654 | 628 | 7.8 | stop | severity ×2 |
| 3 | failed | 1 | 40.8 s | 1261 | 548 | 13.6 | stop | severity ×2, attribution ×1, numbers ×1 |
| 3 | failed | 2 | 72.2 s | 1500 | 560 | 7.9 | stop | attribution ×1, numbers ×1, causal ×1 |
| 3 | failed | 3 | 102.6 s | 1438 | 589 | 5.8 | stop | attribution ×1, numbers ×1, causal ×1, severity ×1 |
| 4 | failed | 1 | 46.1 s | 1261 | 539 | 11.8 | stop | severity ×2, attribution ×2, numbers ×1 |
| 4 | failed | 2 | 110.6 s | 1608 | 527 | 4.9 | stop | attribution ×1, numbers ×1 |
| 4 | failed | 3 | 201.3 s | 1399 | 701 | 3.5 | stop | attribution ×1, noScoreWording ×1, numbers ×1 |
| 5 | failed | 1 | 34.7 s | 1261 | 467 | 13.6 | stop | severity ×1 |
| 5 | failed | 2 | 104.0 s | 1330 | 584 | 5.7 | stop | severity ×1 |
| 5 | failed | 3 | 182.1 s | 1330 | 701 | 3.9 | stop | severity ×1, causal ×1 |

#### Run 1: failed (3 attempt(s), 142.8 s)

Attempt 1: prompt_eval_count 1261, eval_count 557, 14.9 tokens/s, done_reason stop, 61.8 s
- `severity` headline, "Westmaas has critical gaps in RPO Achievement Rate and several areas with high priority issues, including uncontrolled multi-homed devices and poor zone availability.": RPO Achievement Rate is not marked CRITICAL in its fact; do not call it critical.
- `attribution` measuredPerformance, "The measured performance indicators showed a Mean Time to Detect of 18 hours, a Mean Time to Respond of 30 hours, a Network Operability Under Disruption score of 75%, a Zone Availability Rate of 40%, an Operational Threshold Violation Rate of 12.5%, and an RTO Achievement Rate of 50%.": The number "75" is not in the fact about Network Operability Under Disruption.
- `causal` gapsAndMissingEvidence, "Additionally, a BC plan test was not performed, and the Mean Time to Contain is not measurable due to insufficient evidence.": A cited fact says "may be related"; do not claim a cause ("due to").

<details><summary>Attempt 1 draft (rejected)</summary>

**headline** (F11, F4, F5, F18, F19, F20): Westmaas has critical gaps in RPO Achievement Rate and several areas with high priority issues, including uncontrolled multi-homed devices and poor zone availability.

**overview** (F1, F2, F3): The assessment of Westmaas covered 8 effectiveness indicators, with a focus on incident handling and business continuity. However, due to the incomplete Incident Handling dimension, the overall score is not available.

**measuredPerformance** (F4, F5, F7, F8, F9, F10, F16, F17): The measured performance indicators showed a Mean Time to Detect of 18 hours, a Mean Time to Respond of 30 hours, a Network Operability Under Disruption score of 75%, a Zone Availability Rate of 40%, an Operational Threshold Violation Rate of 12.5%, and an RTO Achievement Rate of 50%. Additionally, the Vulnerability Remediation Rate was 60%, and the Mean Time to Remediate was 75 days.

**gapsAndMissingEvidence** (F11, F12, F13, F14, F15, F18, F19): There are significant gaps, including the absence of a RPO Achievement Rate, uncontrolled multi-homed devices, and incomplete asset interdependency documentation. Additionally, a BC plan test was not performed, and the Mean Time to Contain is not measurable due to insufficient evidence.

**foundationsAndFlags** (F16, F17, F18, F19): The Vulnerability Remediation Rate is below target, and the Mean Time to Remediate is satisfactory. The assessment also flagged weak states for uncontrolled multi-homed devices and a segmentation bypass that may be related to the poor Zone Availability Rate.

**priorities** (F20): The lowest priority results are as follows: RPO Achievement Rate (programme gap, 0); Mean Time to Respond (2); Zone Availability Rate (2); Operational Threshold Violation Rate (2); RTO Achievement Rate (2).

</details>

Attempt 2: prompt_eval_count 1486, eval_count 558, 13.9 tokens/s, done_reason stop, 41.0 s
- `severity` headline, "Westmaas has critical gaps in RPO Achievement Rate and several areas with high priority issues, including uncontrolled multi-homed devices and poor zone availability.": RPO Achievement Rate is not marked CRITICAL in its fact; do not call it critical.
- `causal` gapsAndMissingEvidence, "Additionally, the Mean Time to Contain is not measurable due to insufficient evidence.": A cited fact says "may be related"; do not claim a cause ("due to").
- `severity` foundationsAndFlags, "However, uncontrolled multi-homed devices and incomplete asset interdependency documentation are flagged as critical issues.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 2 draft (rejected)</summary>

**headline** (C1): Westmaas has critical gaps in RPO Achievement Rate and several areas with high priority issues, including uncontrolled multi-homed devices and poor zone availability.

**overview** (F1, F2, F3): The assessment covered 8 effectiveness indicators, with the overall score not available due to an incomplete Incident Handling dimension. Business Continuity had a score of 1.80 out of 4.

**measuredPerformance** (F4, F5, F7, F8, F9): The measured performance indicators showed a Mean Time to Detect of 18 hours (score 3), Mean Time to Respond of 30 hours (score 2), Network Operability Under Disruption at 85% (score 3), Zone Availability Rate at 40% (score 2), and Operational Threshold Violation Rate at 12.5% (score 2).

**gapsAndMissingEvidence** (F11, F12, F13, F14, F15, F16, F17, F18, F19): There are programme gaps, including the absence of an RPO Achievement Rate, and several high-priority issues such as uncontrolled multi-homed devices, incomplete asset interdependency documentation, and a lack of BC plan testing. Additionally, the Mean Time to Contain is not measurable due to insufficient evidence.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17, F18, F19): Foundational controls and process evidence are in place, including asset inventory, risk assessment, IT/OT boundary separation, and documented BC plans. However, uncontrolled multi-homed devices and incomplete asset interdependency documentation are flagged as critical issues. A BC plan test was not performed, and the Mean Time to Contain is not measurable.

**priorities** (F20): The lowest effectiveness results are the RPO Achievement Rate (programme gap, 0), followed by Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate, all at score 2.

</details>

Attempt 3: prompt_eval_count 1425, eval_count 463, 11.7 tokens/s, done_reason stop, 40.0 s
- `severity` headline, "Westmaas has critical gaps in RPO Achievement Rate and several areas with high priority issues, including uncontrolled multi-homed devices and poor zone availability.": RPO Achievement Rate is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 3 draft (rejected)</summary>

**headline** (C1): Westmaas has critical gaps in RPO Achievement Rate and several areas with high priority issues, including uncontrolled multi-homed devices and poor zone availability.

**overview** (C2): The assessment covered 8 effectiveness indicators, with a focus on Incident Handling and Business Continuity. The overall score is not available due to the incomplete Incident Handling dimension.

**measuredPerformance** (F4, F5, F7, F8, F9, F10): Indicators measured and scored include Mean Time to Detect (3), Mean Time to Respond (2), Network Operability Under Disruption (3), Zone Availability Rate (2), Operational Threshold Violation Rate (2), and RTO Achievement Rate (2).

**gapsAndMissingEvidence** (F1, F6, F11, F18): Incident Handling is incomplete due to the absence of a Mean Time to Contain score. RPO Achievement Rate is a programme gap, scoring 0. The architecture foundation and evidence for Mean Time to Contain are not yet established.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17): Foundational controls are in place, including asset inventory, risk assessment, IT/OT boundary separation, and BC plan documentation. However, uncontrolled multi-homed devices and incomplete asset interdependency documentation are flagged as high priority issues. Additionally, a BC plan test was not performed during the assessment period.

**priorities** (F20): The lowest effectiveness results are RPO Achievement Rate (programme gap, 0), followed by Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate, all scoring 2.

</details>

#### Run 2: failed (3 attempt(s), 206.7 s)

Attempt 1: prompt_eval_count 1261, eval_count 507, 14.8 tokens/s, done_reason stop, 34.6 s
- `numbers` overview, "The assessment covered 8 effectiveness indicators across three dimensions.": The number "three" does not appear in any fact cited by this section.
- `causal` gapsAndMissingEvidence, "Additionally, the Mean Time to Contain is not measurable due to insufficient evidence.": A cited fact says "may be related"; do not claim a cause ("due to").

<details><summary>Attempt 1 draft (rejected)</summary>

**headline** (F11, F19, F20): The assessment of Westmaas reveals critical gaps and low scores in key areas, particularly the RPO Achievement Rate and Mean Time to Respond.

**overview** (F1, F2, F3): The assessment covered 8 effectiveness indicators across three dimensions. Incident Handling is incomplete due to the absence of a Mean Time to Contain score, while Business Continuity has a score of 1.80. The overall score is not available due to the incomplete dimension.

**measuredPerformance** (F4, F5, F6, F7, F8, F9, F10): Measurable performance indicators showed Mean Time to Detect at 3, Mean Time to Respond at 2, Network Operability Under Disruption at 3, Zone Availability Rate at 2, Operational Threshold Violation Rate at 2, and RTO Achievement Rate at 2.

**gapsAndMissingEvidence** (F11, F12, F13, F14, F15, F16, F17, F18, F19): There are significant gaps and missing evidence, including a programme gap in RPO Achievement Rate (score 0), uncontrolled inter-zone multi-homed devices, incomplete asset interdependency documentation, lack of BC plan test, and vulnerability remediation rate below target. Additionally, the Mean Time to Contain is not measurable due to insufficient evidence.

**foundationsAndFlags** (F18, F19): Foundational controls are in place, but there are critical issues such as uncontrolled multi-homed devices and poor Zone Availability Rate. These issues may be related and should be reviewed together.

**priorities** (F20): The lowest results are the RPO Achievement Rate (programme gap, 0), followed by Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate, all at score 2.

</details>

Attempt 2: prompt_eval_count 1356, eval_count 901, 10.3 tokens/s, done_reason stop, 87.8 s
- `causal` headline, "The assessment of Westmaas, covering 8 effectiveness indicators, resulted in an incomplete overall score due to gaps in Incident Handling.": A cited fact says "may be related"; do not claim a cause ("resulted in").
- `causal` overview, "Incident Handling is incomplete due to the absence of a score for Mean Time to Contain.": A cited fact says "may be related"; do not claim a cause ("due to").
- `causal` overview, "The overall score is not available due to the incomplete dimension.": A cited fact says "may be related"; do not claim a cause ("due to").
- `causal` gapsAndMissingEvidence, "Incident Handling is incomplete due to the lack of a score for Mean Time to Contain.": A cited fact says "may be related"; do not claim a cause ("due to").
- `severity` gapsAndMissingEvidence, "Uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are identified as critical and high priority issues, respectively.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.
- `noScoreWording` gapsAndMissingEvidence, "A BC plan test was not performed during the assessment period, and the architecture foundation for Mean Time to Contain is weak.": Mean Time to Contain has no score; do not describe it as "weak".
- `severity` foundationsAndFlags, "However, uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation were identified as critical and high priority issues, respectively.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.
- `noScoreWording` foundationsAndFlags, "A BC plan test was not performed, and the architecture foundation for Mean Time to Contain is weak.": Mean Time to Contain has no score; do not describe it as "weak".

<details><summary>Attempt 2 draft (rejected)</summary>

**headline** (F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11, F12, F13, F14, F15, F16, F17, F18, F19, F20): The assessment of Westmaas, covering 8 effectiveness indicators, resulted in an incomplete overall score due to gaps in Incident Handling. Business Continuity scored 1.80, and the lowest measured results were Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate, each at 2.

**overview** (F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11, F12, F13, F14, F15, F16, F17, F18, F19, F20): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to the absence of a score for Mean Time to Contain. Business Continuity scored 1.80, with a programme gap for RPO Achievement Rate. The overall score is not available due to the incomplete dimension.

**measuredPerformance** (F4, F5, F7, F8, F9, F10, F16, F17): Measured performance indicators include Mean Time to Detect at 18 hours, Mean Time to Respond at 30 hours, Network Operability Under Disruption at 85%, Zone Availability Rate at 40%, Operational Threshold Violation Rate at 12.5%, and RTO Achievement Rate at 50%. The Vulnerability Remediation Rate was 60%, and the Mean Time to Remediate was 75 days.

**gapsAndMissingEvidence** (F1, F2, F3, F6, F11, F12, F13, F14, F15, F18, F19, F20): Incident Handling is incomplete due to the lack of a score for Mean Time to Contain. Business Continuity has a programme gap for RPO Achievement Rate. Additionally, there is no score for Mean Time to Contain, and the Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate are each at 2. Uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are identified as critical and high priority issues, respectively. A BC plan test was not performed during the assessment period, and the architecture foundation for Mean Time to Contain is weak.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17, F18, F19): The assessment found that the asset inventory, risk assessment per zone, controlled IT/OT boundary separation, and BC plan for critical processes are in place. However, uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation were identified as critical and high priority issues, respectively. A BC plan test was not performed, and the architecture foundation for Mean Time to Contain is weak.

**priorities** (F20): The lowest effectiveness results are as follows: RPO Achievement Rate, which is a programme gap with a score of 0; Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate, each at 2.

</details>

Attempt 3: prompt_eval_count 1654, eval_count 628, 7.8 tokens/s, done_reason stop, 84.2 s
- `severity` gapsAndMissingEvidence, "Uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are identified as critical and high priority issues, respectively.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.
- `severity` foundationsAndFlags, "Uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are identified as critical and high priority issues, respectively.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 3 draft (rejected)</summary>

**headline** (C1): The assessment of Westmaas, dated 2026-01-01, covers 8 effectiveness indicators.

**overview** (F1, F2, F3): The assessment covered 8 effectiveness indicators, but the overall score is not available due to the incomplete Incident Handling dimension. Business Continuity has a score of 1.80 out of 4.

**measuredPerformance** (F4, F5, F7, F8, F9): Mean Time to Detect scored 3, and Mean Time to Respond scored 2. Network Operability Under Disruption scored 3, and Zone Availability Rate scored 2. Operational Threshold Violation Rate and RTO Achievement Rate both scored 2.

**gapsAndMissingEvidence** (F1, F11, F12, F13, F14, F15, F18, F19): Incident Handling is incomplete because Mean Time to Contain has no score. RPO Achievement Rate is a programme gap with a score of 0. Asset inventory, risk assessment, IT/OT boundary separation, and BC plan documentation are in place. Uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are identified as critical and high priority issues, respectively. A BC plan test was not performed during the assessment period. Establishing the architecture foundation and the evidence needed to measure Mean Time to Contain are both measurement-readiness actions.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17, F18, F19): Asset inventory, risk assessment, IT/OT boundary separation, and BC plan documentation are in place. Uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are identified as critical and high priority issues, respectively. A BC plan test was not performed during the assessment period. Vulnerability remediation rate is 60%, which is below target. Mean Time to Contain is not measurable. Uncontrolled multi-homed devices found while Zone Availability Rate is poor may be related.

**priorities** (F20): The lowest effectiveness results are RPO Achievement Rate (programme gap, 0), followed by Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate, all at score 2.

</details>

#### Run 3: failed (3 attempt(s), 215.7 s)

Attempt 1: prompt_eval_count 1261, eval_count 548, 13.6 tokens/s, done_reason stop, 40.8 s
- `severity` headline, "The assessment of Westmaas reveals critical gaps in RPO Achievement Rate and several areas with scores of 2, including Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.": RPO Achievement Rate is not marked CRITICAL in its fact; do not call it critical.
- `attribution` headline, "The assessment of Westmaas reveals critical gaps in RPO Achievement Rate and several areas with scores of 2, including Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.": The number "2" is not in the fact about RPO Achievement Rate.
- `numbers` overview, "The assessment covered 8 effectiveness indicators across three dimensions.": The number "three" does not appear in any fact cited by this section.
- `severity` foundationsAndFlags, "However, uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are flagged as critical and high priority issues.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 1 draft (rejected)</summary>

**headline** (F11, F18, F20): The assessment of Westmaas reveals critical gaps in RPO Achievement Rate and several areas with scores of 2, including Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.

**overview** (F1, F2, F3): The assessment covered 8 effectiveness indicators across three dimensions. Incident Handling is incomplete due to the absence of Mean Time to Contain, while Business Continuity has a score of 1.80. The overall score is not available due to the incomplete dimension.

**measuredPerformance** (F4, F5, F7, F8, F9, F10, F16, F17): Measurable performance indicators include Mean Time to Detect at 3, Mean Time to Respond at 2, Network Operability Under Disruption at 3, Zone Availability Rate at 2, Operational Threshold Violation Rate at 2, and RTO Achievement Rate at 2. The Vulnerability Remediation Rate is 60%, and the Mean Time to Remediate is 75 days, both within acceptable ranges.

**gapsAndMissingEvidence** (F11, F18): There is a programme gap in RPO Achievement Rate, scoring 0. Additionally, the architecture foundation and measurement-readiness actions for Mean Time to Contain are incomplete.

**foundationsAndFlags** (F12, F13, F14, F15, F19): Foundational controls are in place, including asset inventory, risk assessment, IT/OT boundary separation, and documented BC plans. However, uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are flagged as critical and high priority issues. No BC plan test was performed during the assessment period, and uncontrolled multi-homed devices are linked to poor Zone Availability Rate.

**priorities** (F20): The lowest results, listed in catalogue order, are RPO Achievement Rate (programme gap, 0), followed by Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate, all scoring 2.

</details>

Attempt 2: prompt_eval_count 1500, eval_count 560, 7.9 tokens/s, done_reason stop, 72.2 s
- `attribution` headline, "The assessment of Westmaas reveals a programme gap in RPO Achievement Rate and several areas with scores of 2, including Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.": The number "2" is not in the fact about RPO Achievement Rate.
- `numbers` overview, "The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity.": The number "two" does not appear in any fact cited by this section.
- `causal` gapsAndMissingEvidence, "There is a programme gap in RPO Achievement Rate, scored 0 due to the recovery point objective not being established.": A cited fact says "may be related"; do not claim a cause ("due to").

<details><summary>Attempt 2 draft (rejected)</summary>

**headline** (F11, F18, F19, F20): The assessment of Westmaas reveals a programme gap in RPO Achievement Rate and several areas with scores of 2, including Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.

**overview** (F1, F2, F3): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Due to the incomplete Incident Handling dimension, the overall score is not available.

**measuredPerformance** (F4, F5, F7, F8, F9, F14, F16, F17): Indicators measured and scored include Mean Time to Detect (3), Mean Time to Respond (2), Network Operability Under Disruption (3), Zone Availability Rate (2), Operational Threshold Violation Rate (2), and RTO Achievement Rate (2). Vulnerability Remediation Rate is below target at 60%, but process evidence is not scored. Mean Time to Remediate is satisfactory at 75 days.

**gapsAndMissingEvidence** (F11, F18, F19): There is a programme gap in RPO Achievement Rate, scored 0 due to the recovery point objective not being established. Additionally, the architecture foundation is incomplete, as Mean Time to Contain is not measurable, and uncontrolled multi-homed devices may be related to the poor Zone Availability Rate.

**foundationsAndFlags** (F12, F13, F14, F15, F18, F19): Foundational controls are in place, including asset inventory, risk assessment per zone, controlled IT/OT boundary separation, and documented BC plan for critical processes. However, uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are noted. A segmentation bypass may be related to the poor Zone Availability Rate.

**priorities** (F20): The lowest results are the programme gap in RPO Achievement Rate (0), followed by Mean Time to Respond (2), Zone Availability Rate (2), Operational Threshold Violation Rate (2), and RTO Achievement Rate (2).

</details>

Attempt 3: prompt_eval_count 1438, eval_count 589, 5.8 tokens/s, done_reason stop, 102.6 s
- `attribution` headline, "The assessment of Westmaas reveals a programme gap in RPO Achievement Rate and several areas with scores of 2, including Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.": The number "2" is not in the fact about RPO Achievement Rate.
- `numbers` overview, "The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity.": The number "two" does not appear in any fact cited by this section.
- `causal` gapsAndMissingEvidence, "There is a programme gap in RPO Achievement Rate, scored 0 due to the recovery point objective not being established.": A cited fact says "may be related"; do not claim a cause ("due to").
- `severity` foundationsAndFlags, "Uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are flagged as critical and high priority issues.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 3 draft (rejected)</summary>

**headline** (F11, F18, F19, F20): The assessment of Westmaas reveals a programme gap in RPO Achievement Rate and several areas with scores of 2, including Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.

**overview** (F1, F2, F3): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Due to the incomplete Incident Handling dimension, the overall score is not available.

**measuredPerformance** (F4, F5, F7, F8, F9, F14, F16, F17): Indicators measured and scored include Mean Time to Detect at 3, Mean Time to Respond at 2, Network Operability Under Disruption at 3, Zone Availability Rate at 2, Operational Threshold Violation Rate at 2, and RTO Achievement Rate at 2. The Vulnerability Remediation Rate is below target at 60%, and Mean Time to Remediate is satisfactory at 75 days.

**gapsAndMissingEvidence** (F11, F18, F19): There is a programme gap in RPO Achievement Rate, scored 0 due to the recovery point objective not being established. Additionally, the architecture foundation is weak, and Mean Time to Contain is not measurable. Uncontrolled multi-homed devices may be related to the poor Zone Availability Rate.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17): Foundational controls in place include asset inventory, risk assessment per zone, controlled IT/OT boundary separation, and documented BC plan for critical processes. Uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are flagged as critical and high priority issues. A BC plan test was not performed during the assessment period, and the Vulnerability Remediation Rate is below target.

**priorities** (F20): The lowest results, as the priority fact lists them, are RPO Achievement Rate (programme gap, 0); then, at score 2 and of equal priority, listed in catalogue order: Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.

</details>

#### Run 4: failed (3 attempt(s), 357.9 s)

Attempt 1: prompt_eval_count 1261, eval_count 539, 11.8 tokens/s, done_reason stop, 46.1 s
- `severity` headline, "The assessment of Westmaas reveals critical gaps in RPO Achievement Rate and several areas with scores of 2, including Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.": RPO Achievement Rate is not marked CRITICAL in its fact; do not call it critical.
- `attribution` headline, "The assessment of Westmaas reveals critical gaps in RPO Achievement Rate and several areas with scores of 2, including Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.": The number "2" is not in the fact about RPO Achievement Rate.
- `numbers` overview, "The assessment covered 8 effectiveness indicators across three dimensions, with Incident Handling being incomplete due to the absence of a Mean Time to Contain score.": The number "three" does not appear in any fact cited by this section.
- `attribution` measuredPerformance, "Measurable performance indicators showed Mean Time to Detect at 3, Mean Time to Respond at 2, Network Operability Under Disruption at 3, Zone Availability Rate at 3, Operational Threshold Violation Rate at 2, RTO Achievement Rate at 2, and RPO Achievement Rate at 0 due to a programme gap.": The number "3" is not in the fact about Zone Availability Rate.
- `severity` foundationsAndFlags, "However, uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are flagged as critical and high priority issues.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 1 draft (rejected)</summary>

**headline** (F11, F18, F20): The assessment of Westmaas reveals critical gaps in RPO Achievement Rate and several areas with scores of 2, including Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.

**overview** (F1, F2, F3): The assessment covered 8 effectiveness indicators across three dimensions, with Incident Handling being incomplete due to the absence of a Mean Time to Contain score. Business Continuity scored 1.80, and the overall score is not available due to the incomplete dimension.

**measuredPerformance** (F4, F5, F6, F7, F8, F9, F10): Measurable performance indicators showed Mean Time to Detect at 3, Mean Time to Respond at 2, Network Operability Under Disruption at 3, Zone Availability Rate at 3, Operational Threshold Violation Rate at 2, RTO Achievement Rate at 2, and RPO Achievement Rate at 0 due to a programme gap.

**gapsAndMissingEvidence** (F11, F6, F18): There is a programme gap in RPO Achievement Rate, scoring 0. Additionally, Mean Time to Contain is not measurable due to insufficient evidence, and establishing the architecture foundation and measuring Mean Time to Contain are both measurement-readiness actions.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17, F19): Foundational controls are in place, including asset inventory, risk assessment, IT/OT boundary separation, and documented BC plans. However, uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are flagged as critical and high priority issues. No BC plan test was performed, and the vulnerability remediation rate is below target.

**priorities** (F20): The lowest results are RPO Achievement Rate (programme gap, 0), followed by Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate, all scoring 2.

</details>

Attempt 2: prompt_eval_count 1608, eval_count 527, 4.9 tokens/s, done_reason stop, 110.6 s
- `attribution` headline, "The assessment of Westmaas reveals a programme gap in RPO Achievement Rate and several areas with scores of 2, including Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.": The number "2" is not in the fact about RPO Achievement Rate.
- `numbers` overview, "The assessment covered 8 effectiveness indicators across two dimensions, with Incident Handling being incomplete due to the absence of a Mean Time to Contain score.": The number "two" does not appear in any fact cited by this section.

<details><summary>Attempt 2 draft (rejected)</summary>

**headline** (F11, F18, F19, F20): The assessment of Westmaas reveals a programme gap in RPO Achievement Rate and several areas with scores of 2, including Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.

**overview** (F1, F2, F3): The assessment covered 8 effectiveness indicators across two dimensions, with Incident Handling being incomplete due to the absence of a Mean Time to Contain score. The overall score is not available due to the incomplete dimension.

**measuredPerformance** (F4, F5, F7, F8, F9, F10): Measurable performance indicators showed Mean Time to Detect at 3, Mean Time to Respond at 2, Network Operability Under Disruption at 3, Zone Availability Rate at 2, Operational Threshold Violation Rate at 2, and RTO Achievement Rate at 2.

**gapsAndMissingEvidence** (F11, F18): RPO Achievement Rate is a programme gap, scored 0 due to the recovery point objective not being established. Additionally, Mean Time to Contain is not measurable, as evidence to compute the value is absent or unreliable.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17, F18, F19): Foundational controls, process evidence, and action flags include an asset inventory maintained, risk assessment per zone, controlled IT/OT boundary separation, and a documented BC plan for critical processes. However, uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are flagged as high priority issues.

**priorities** (F20): The lowest results are as follows: RPO Achievement Rate (programme gap, 0); then, at score 2 and of equal priority, listed in catalogue order: Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.

</details>

Attempt 3: prompt_eval_count 1399, eval_count 701, 3.5 tokens/s, done_reason stop, 201.3 s
- `attribution` headline, "The assessment of Westmaas reveals a programme gap in RPO Achievement Rate and several areas with scores of 2, including Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.": The number "2" is not in the fact about RPO Achievement Rate.
- `noScoreWording` headline, "Additionally, the assessment found that the architecture foundation for measuring Mean Time to Contain is not yet established, and several process evidence items are incomplete or weak.": Mean Time to Contain has no score; do not describe it as "weak".
- `numbers` overview, "The assessment covered 8 effectiveness indicators across two dimensions.": The number "two" does not appear in any fact cited by this section.

<details><summary>Attempt 3 draft (rejected)</summary>

**headline** (F11, F18, F20): The assessment of Westmaas reveals a programme gap in RPO Achievement Rate and several areas with scores of 2, including Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate. The programme gap in RPO Achievement Rate is due to the recovery point objective not being established. Additionally, the assessment found that the architecture foundation for measuring Mean Time to Contain is not yet established, and several process evidence items are incomplete or weak.

**overview** (F1, F2, F3): The assessment covered 8 effectiveness indicators across two dimensions. Incident Handling is incomplete due to the absence of a Mean Time to Contain score. The Overall score is not available due to the incomplete dimension. Business Continuity has a complete score of 1.80 out of 4.

**measuredPerformance** (F4, F5, F7, F8, F9, F10): Mean Time to Detect was measured at 18 hours, scoring 3. Mean Time to Respond was measured at 30 hours, scoring 2. Network Operability Under Disruption was measured at 85%, scoring 3. Zone Availability Rate was measured at 40%, scoring 2. Operational Threshold Violation Rate was measured at 12.5%, scoring 2. RTO Achievement Rate was measured at 50%, scoring 2.

**gapsAndMissingEvidence** (F11, F18): RPO Achievement Rate is a programme gap, scored 0 as the objective or capability does not exist yet. The architecture foundation for measuring Mean Time to Contain is not established, and the evidence needed to measure it is absent or unreliable.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17): The assessment found that asset inventory, risk assessment per zone, controlled IT/OT boundary separation, and a BC plan for critical processes are in place. However, uncontrolled inter-zone multi-homed devices were identified, which is CRITICAL. Asset interdependency documentation is incomplete or outdated, and no BC plan test was performed during the assessment period, which is a HIGH priority issue. The Vulnerability Remediation Rate is 60%, which is below target, and the Mean Time to Remediate is 75 days, which is satisfactory.

**priorities** (F20): The lowest effectiveness results are as follows: RPO Achievement Rate (programme gap, 0); then, at score 2 and of equal priority, listed in catalogue order: Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.

</details>

#### Run 5: failed (3 attempt(s), 320.8 s)

Attempt 1: prompt_eval_count 1261, eval_count 467, 13.6 tokens/s, done_reason stop, 34.7 s
- `severity` headline, "The assessment of Westmaas reveals critical gaps in RPO Achievement Rate and several areas with high and medium priority issues.": RPO Achievement Rate is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 1 draft (rejected)</summary>

**headline** (F11, F19, F20): The assessment of Westmaas reveals critical gaps in RPO Achievement Rate and several areas with high and medium priority issues.

**overview** (F1, F2, F3): The assessment covered 8 effectiveness indicators across four dimensions. Due to the incomplete Incident Handling dimension, the overall score is not available. Business Continuity scored 1.80 out of 4.

**measuredPerformance** (F4, F5, F7, F8, F9, F10, F16, F17): Mean Time to Detect scored 3, and Mean Time to Respond scored 2. Network Operability Under Disruption scored 3, while Zone Availability Rate and Operational Threshold Violation Rate scored 2 and 2, respectively. The Vulnerability Remediation Rate was 60%, and the Mean Time to Remediate was 75 days, which is satisfactory.

**gapsAndMissingEvidence** (F11, F12, F13, F14, F15, F18): RPO Achievement Rate is a programme gap with a score of 0. The assessment found uncontrolled inter-zone multi-homed devices, incomplete asset interdependency documentation, and a lack of BC plan tests. Additionally, establishing the architecture foundation and measuring Mean Time to Contain are both measurement-readiness actions.

**foundationsAndFlags** (F19): Uncontrolled multi-homed devices were found while Zone Availability Rate is poor, suggesting a possible relationship between these issues.

**priorities** (F20): The lowest results are RPO Achievement Rate (programme gap, 0), followed by Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate, all at score 2.

</details>

Attempt 2: prompt_eval_count 1330, eval_count 584, 5.7 tokens/s, done_reason stop, 104.0 s
- `severity` headline, "The assessment of Westmaas reveals critical gaps in RPO Achievement Rate and several areas with high and medium priority issues.": RPO Achievement Rate is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 2 draft (rejected)</summary>

**headline** (C1): The assessment of Westmaas reveals critical gaps in RPO Achievement Rate and several areas with high and medium priority issues.

**overview** (F1, F2, F3, F4, F5, F6, F7, F8, F9, F10): The assessment covered 8 effectiveness indicators, with a focus on Incident Handling and Business Continuity. The overall score is not available due to the incomplete Incident Handling dimension. Scores range from 1.80 to 4, with Mean Time to Detect at 3 and Mean Time to Respond at 2.

**measuredPerformance** (F4, F5, F7, F8, F9, F10): Measurable performance indicators include Mean Time to Detect at 3, Mean Time to Respond at 2, Network Operability Under Disruption at 3, Zone Availability Rate at 2, Operational Threshold Violation Rate at 2, and RTO Achievement Rate at 2.

**gapsAndMissingEvidence** (F11, F12, F13, F14, F15, F16, F17, F18, F19): There are programme gaps and missing evidence, including the absence of a RPO Achievement Rate, uncontrolled inter-zone multi-homed devices, incomplete asset interdependency documentation, and no BC plan test during the assessment period. Additionally, the vulnerability remediation rate is below target, and the Mean Time to Contain is not measurable.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17, F18, F19): The assessment identified several foundational controls and process evidence, including an asset inventory, risk assessments, and a documented BC plan. However, there are critical and high priority issues, such as uncontrolled inter-zone multi-homed devices, incomplete asset interdependency documentation, and no BC plan test.

**priorities** (F20): The lowest effectiveness results are the RPO Achievement Rate at 0 (programme gap) and Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate, all at 2.

</details>

Attempt 3: prompt_eval_count 1330, eval_count 701, 3.9 tokens/s, done_reason stop, 182.1 s
- `severity` headline, "The assessment of Westmaas reveals critical gaps in RPO Achievement Rate and several areas with high and medium priority issues.": RPO Achievement Rate is not marked CRITICAL in its fact; do not call it critical.
- `causal` gapsAndMissingEvidence, "Incident Handling is incomplete due to the lack of a Mean Time to Contain score.": A cited fact says "may be related"; do not claim a cause ("due to").

<details><summary>Attempt 3 draft (rejected)</summary>

**headline** (C1): The assessment of Westmaas reveals critical gaps in RPO Achievement Rate and several areas with high and medium priority issues.

**overview** (C2, F1, F2, F3): The assessment covered 8 effectiveness indicators across various dimensions. Incident Handling is incomplete due to the absence of a Mean Time to Contain score. Business Continuity has a score of 1.80, and the overall score is not available due to the incomplete Incident Handling dimension.

**measuredPerformance** (F4, F5, F7, F8, F9, F10, F11, F16, F17): Measurable performance indicators include Mean Time to Detect at 18 hours (score 3), Mean Time to Respond at 30 hours (score 2), Network Operability Under Disruption at 85% (score 3), Zone Availability Rate at 40% (score 2), Operational Threshold Violation Rate at 12.5% (score 2), RTO Achievement Rate at 50% (score 2), and RPO Achievement Rate at 0 (programme gap). The Vulnerability Remediation Rate is 60%, which is below target, and the Mean Time to Remediate is satisfactory.

**gapsAndMissingEvidence** (F1, F11, F12, F13, F14, F15, F18, F19): Incident Handling is incomplete due to the lack of a Mean Time to Contain score. RPO Achievement Rate is a programme gap with a score of 0. Asset inventory, risk assessment, IT/OT boundary separation, and BC plan documentation are in place. However, uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are identified as high-priority issues. Additionally, a BC plan test was not performed during the assessment period. The architecture foundation and measurement readiness for Mean Time to Contain are both incomplete.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17, F18, F19): Foundational controls are in place, including asset inventory, risk assessment, IT/OT boundary separation, and BC plan documentation. However, uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation are flagged as high-priority issues. A BC plan test was not performed, and the Vulnerability Remediation Rate is below target. The architecture foundation and measurement readiness for Mean Time to Contain are both incomplete.

**priorities** (F20): The lowest effectiveness results are RPO Achievement Rate (programme gap, 0), followed by Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate, all at score 2.

</details>

### Review

No accepted narrative; no timeouts. Every run used all 3 attempts. Only one
attempt (run 2 att. 3) was rejected solely by errors that are wrong as
findings (the "respectively" severity errors); every other rejection had at
least one correct error.

The model largely ignores the new prompt rules and the retry feedback:
"critical gaps in RPO Achievement Rate" opened 4 of 5 first headlines and
was repeated word for word in all three attempts of runs 1 and 5 (on
retries the headline cited only C1 but kept the text); "due to" appears in
every run despite rule 7; "respectively" in runs 2 and 5 despite rule 2;
dimensions counted ("two", "three", "four") in 4 runs.

1. **Invariant breaks the validator missed**
   - Run 5 att. 1: "8 effectiveness indicators across four dimensions":
     "four" passes because 4 is in C2, which now counts as cited everywhere.
   - Run 5 att. 2: "Scores range from 1.80 to 4": no score is 4; both
     numbers pass (F2 cited, 4 in C2).
   - Run 3 att. 1: Vulnerability Remediation Rate 60% and Mean Time to
     Remediate "both within acceptable ranges": the fact says below target.
   - Run 3 att. 1: multi-homed devices "are linked to" poor Zone
     Availability Rate (replaces "may be related"; not in the causal list).
   - Run 2 att. 1: "critical issues such as … poor Zone Availability Rate":
     the "and" split puts "critical" in a clause with only the multi-homing.
   - Scores written as "Mean Time to Detect at 3" (runs 2, 3, 4, 5) still
     read as values.
2. **Validator errors that look wrong** (44 errors)
   - Right (21): severity "critical gaps in RPO Achievement Rate" ×8 and
     "interdependency … flagged as critical issues" ×1; attribution
     "Network Operability Under Disruption score of 75%" (it is 85%; 75 is
     in F17, so check 2 passed) and "Zone Availability Rate at 3"; numbers
     "three dimensions" ×3 (false) and "two dimensions" ×4 (true, but a
     count no fact states); noScoreWording "architecture foundation for
     Mean Time to Contain is weak" ×2.
   - Borderline (3): "…and asset interdependency documentation are flagged
     as critical and high priority issues" (no "respectively").
   - Wrong as findings (20):
     - attribution ×6: "RPO Achievement Rate and several areas with scores
       of 2, including…" (runs 3, 4): the forward-reference limitation. 6 of
       the 8 attribution errors; the inherited-clause case produced no true
       positive in these runs.
     - severity ×4: "…identified as critical and high priority issues,
       respectively" (run 2): accurate sentence, but it breaks prompt rule 2.
     - causal ×10: every one is "due to" / "resulted in" explaining the
       no-score or incomplete-dimension rule in a section that cites F18/F19;
       none is a causal claim about the may-be-related pair. All break the
       new prompt rule 7.
     - noScoreWording ×1: "…Mean Time to Contain is not yet established,
       and several process evidence items are incomplete or weak" (run 4
       att. 3): "weak" belongs to the new subject "several process evidence
       items", not the inherited Mean Time to Contain.
3. **Paraphrased item names**: aliases matched ("documented BC plan", "BC
   plan documentation", "risk assessments", "zone availability"). New
   candidate: "BC plan for critical processes" (the engine's own message
   wording, used in runs 2 and 4).
4. **Prompt conformance**: headlines of 2–3 sentences (run 2 att. 2, run 4
   att. 3); run 2 att. 2 cited all 20 facts in the headline and overview;
   process facts in measuredPerformance and flags in gapsAndMissingEvidence
   in most runs; gapsAndMissingEvidence up to 6 sentences.
5. **Items named without their fact cited**: retry headlines citing only C1
   while naming RPO Achievement Rate, multi-homed devices and Zone
   Availability Rate (runs 1, 5); dimensions counted without a fact. Strong
   evidence for a check 10.
6. **Band ranges**: one failure. Run 3 att. 1 called Vulnerability
   Remediation Rate 60% "within acceptable ranges", apparently reading
   "(50–69%)" as an acceptable band. Once so far.

**Performance**: no timeouts (longest attempt 201 s). After each 60 s
cooldown the first attempt ran at 11.8–14.9 tokens/s; within a run it fell
to 3.5–10.3 by attempt 3. Total ~25 minutes.

**Replay with the changes from this check** (new C2/C3, check 8 on named
clauses only, checks 10 and 11; drafts citing the old C2 mapped to C2 + C3):
44 → 33 errors. Gone: the 6 forward-reference attribution errors; the 4
"respectively" severity errors became `respectively` errors; "two
dimensions" ×4 now passes. Still caught: "three dimensions" ×3 and "four
dimensions" (check 11). New: `respectively` for "scored 2 and 2,
respectively" (run 5 att. 1); numbers for "RPO Achievement Rate at 0" in a
section citing neither F11 nor C3 (run 4 att. 1). Still passing: "Scores
range from 1.80 to 4" (known limitation).

Run 4 att. 2 now passes. Its flaws are known limitations, with no checks
for now: it calls the CRITICAL multi-homed devices "high priority" ("high"
is not checked); it writes scores as "Mean Time to Detect at 3", which
reads as a value; and a garbled sentence lists the in-place controls as
"action flags".
## Run set 2026-09-28 18:34 UTC

- Model: qwen2.5:7b · Ollama 0.34.4 · options `{"temperature":0.2,"num_ctx":4096,"num_predict":1024}`
- Timeout 300.0 s per call · 60.0 s cooldown between runs · retries at temperature 0.5, repairing failing sections only
- Scenario: scenarios/Westmaas_2026-01-01_assessment.json (23 facts)

| `/api/ps` | Model | Size | In VRAM | CPU/GPU | Context |
|---|---|---|---|---|---|
| before | (no model loaded) | | | | |
| after | qwen2.5:7b | 5.12 GB | 4.33 GB | 16%/84% | 4096 |

### Summary

| Measure | Value |
|---|---|
| ok | 2 of 5 |
| attempts per run (calls) | 0 (0), 3 (4), 2 (3), 3 (4), 2 (4) |
| errors by rule (all attempts) | severity ×7, noScoreWording ×1, causal ×7, programmeGap ×1 |
| max prompt_eval_count | 1283 (warning above 3000) |
| generation speed (tokens/s, eval_duration) | first 12.9, last 7.1, min 7.1, max 13.0 |

### Runs

| Run | Status | Attempt | Call | Time | prompt_eval_count | eval_count | tokens/s | done_reason | Errors |
|---|---|---|---|---|---|---|---|---|---|
| 2 | failed | 1 | whole | 51.2 s | 1283 | 514 | 12.9 | stop | severity ×2, noScoreWording ×1 |
| 2 | failed | 2 | headline | 7.2 s | 954 | 72 | 13.0 | stop | severity ×1, causal ×1 |
| 2 | failed | 2 | foundationsAndFlags | 8.3 s | 787 | 94 | 12.9 | stop | — |
| 2 | failed | 3 | headline | 6.3 s | 963 | 57 | 12.9 | stop | programmeGap ×1 |
| 3 | ok | 1 | whole | 52.3 s | 1283 | 614 | 12.5 | stop | severity ×1, causal ×1 |
| 3 | ok | 2 | headline | 7.7 s | 900 | 67 | 11.3 | stop | — |
| 3 | ok | 2 | gapsAndMissingEvidence | 8.8 s | 930 | 77 | 11.1 | stop | — |
| 4 | failed | 1 | whole | 50.4 s | 1283 | 566 | 12.0 | stop | severity ×1, causal ×1 |
| 4 | failed | 2 | headline | 8.6 s | 896 | 73 | 10.7 | stop | causal ×1 |
| 4 | failed | 2 | gapsAndMissingEvidence | 10.1 s | 930 | 82 | 10.4 | stop | — |
| 4 | failed | 3 | headline | 9.7 s | 919 | 74 | 9.8 | stop | causal ×1 |
| 5 | ok | 1 | whole | 52.8 s | 1283 | 572 | 11.5 | stop | severity ×2, causal ×2 |
| 5 | ok | 2 | headline | 8.6 s | 936 | 54 | 8.6 | stop | — |
| 5 | ok | 2 | gapsAndMissingEvidence | 14.7 s | 917 | 98 | 7.9 | stop | — |
| 5 | ok | 2 | foundationsAndFlags | 23.9 s | 826 | 151 | 7.1 | stop | — |

#### Run 1: unavailable (0 attempt(s), 0 call(s), 82.5 s)

Unavailable: `provider_error`: llama-server process has terminated: exit status 0xc0000409: The system detected an overrun of a stack-based buffer in this application. This overrun could potentially allow a malicious user to gain control of this application.: CUDA error: shared object initialization failed

#### Run 2: failed (3 attempt(s), 4 call(s), 73.1 s)

Attempt 1, whole narrative: prompt_eval_count 1283, eval_count 514, 12.9 tokens/s, done_reason stop, 51.2 s
- `severity` headline, "Westmaas's cybersecurity assessment shows critical gaps in Mean Time to Contain and RPO Achievement Rate, with overall scores hampered by incomplete dimensions and high-risk process issues.": Mean Time to Contain is not marked CRITICAL in its fact; do not call it critical.
- `noScoreWording` headline, "Westmaas's cybersecurity assessment shows critical gaps in Mean Time to Contain and RPO Achievement Rate, with overall scores hampered by incomplete dimensions and high-risk process issues.": Overall score is incomplete and has no score; do not describe it as "high".
- `severity` foundationsAndFlags, "However, uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation pose critical and high-risk issues.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F1, F2, F3, F18, F19, F20): Westmaas's cybersecurity assessment shows critical gaps in Mean Time to Contain and RPO Achievement Rate, with overall scores hampered by incomplete dimensions and high-risk process issues.

**overview** (C2, F2, F3): The assessment covered 8 effectiveness indicators across 2 dimensions: Incident Handling and Business Continuity. Business Continuity scored 1.80, but the overall score is unavailable due to the incomplete Incident Handling dimension.

**measuredPerformance** (F4, F5, F7, F8, F9, F16, F17): Measurable performance indicators showed Mean Time to Detect at 3, Mean Time to Respond at 2, Network Operability Under Disruption at 3, Zone Availability Rate at 2, Operational Threshold Violation Rate at 2, and a Vulnerability Remediation Rate of 60%. The Mean Time to Remediate was satisfactory at 75 days.

**gapsAndMissingEvidence** (F1, F11, F18): Incident Handling is incomplete due to the absence of a Mean Time to Contain score. RPO Achievement Rate is a programme gap, scoring 0 as the objective does not exist. The architecture foundation and measurement-readiness actions for Mean Time to Contain need addressing.

**foundationsAndFlags** (F12, F13, F14, F15, F19): Foundational controls are in place, including asset inventory, risk assessments, and BC plan documentation. However, uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation pose critical and high-risk issues. Additionally, a BC plan test was not performed during the assessment period.

**priorities** (F20): The lowest results are the programme gap RPO Achievement Rate (0), followed by Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate, all scoring 2.

</details>

Attempt 2, repair of headline: prompt_eval_count 954, eval_count 72, 13.0 tokens/s, done_reason stop, 7.2 s
- `severity` headline, "The assessment highlights critical gaps in Mean Time to Contain and RPO Achievement Rate, with Zone Availability Rate and other indicators scoring poorly due to incomplete dimensions and process issues.": Mean Time to Contain is not marked CRITICAL in its fact; do not call it critical.
- `causal` headline, "The assessment highlights critical gaps in Mean Time to Contain and RPO Achievement Rate, with Zone Availability Rate and other indicators scoring poorly due to incomplete dimensions and process issues.": Do not write "due to": a cited fact says "may be related", and "due to" claims a cause. Use the fact's own wording (for example "so") or leave the explanation out.

<details><summary>Attempt 2 reply (repair of headline)</summary>

**headline** (F1, F2, F18, F19, F20): The assessment highlights critical gaps in Mean Time to Contain and RPO Achievement Rate, with Zone Availability Rate and other indicators scoring poorly due to incomplete dimensions and process issues.

</details>

Attempt 2, repair of foundationsAndFlags: prompt_eval_count 787, eval_count 94, 12.9 tokens/s, done_reason stop, 8.3 s
- no validator errors

<details><summary>Attempt 2 reply (repair of foundationsAndFlags)</summary>

**foundationsAndFlags** (F12, F14, F15): The asset inventory, risk assessment per zone, controlled IT/OT boundary separation, and documented BC plan for critical processes are in place. However, the asset interdependency documentation is incomplete or outdated, which is marked HIGH. Additionally, there has been no BC plan test performed during the assessment period, also noted as HIGH. 

</details>

Attempt 3, repair of headline: prompt_eval_count 963, eval_count 57, 12.9 tokens/s, done_reason stop, 6.3 s
- `programmeGap` headline, "The assessment shows poor scores in RPO Achievement Rate and Zone Availability Rate, with Mean Time to Contain and other indicators also scoring below expectations due to incomplete dimensions.": RPO Achievement Rate is a programme gap, not a measured failure; do not describe it as "poor".

<details><summary>Attempt 3 reply (repair of headline)</summary>

**headline** (F2, F20): The assessment shows poor scores in RPO Achievement Rate and Zone Availability Rate, with Mean Time to Contain and other indicators also scoring below expectations due to incomplete dimensions.

</details>

#### Run 3: ok (2 attempt(s), 3 call(s), 68.7 s)

Attempt 1, whole narrative: prompt_eval_count 1283, eval_count 614, 12.5 tokens/s, done_reason stop, 52.3 s
- `severity` headline, "Westmaas's assessment shows critical gaps in Mean Time to Contain and RPO Achievement Rate, with overall scores hampered by incomplete dimensions and uncontrolled multi-homed devices.": Mean Time to Contain is not marked CRITICAL in its fact; do not call it critical.
- `causal` gapsAndMissingEvidence, "Incident Handling is incomplete due to the absence of a Mean Time to Contain score.": Do not write "due to": a cited fact says "may be related", and "due to" claims a cause. Use the fact's own wording (for example "so") or leave the explanation out.

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F1, F2, F3, F18, F19, F20): Westmaas's assessment shows critical gaps in Mean Time to Contain and RPO Achievement Rate, with overall scores hampered by incomplete dimensions and uncontrolled multi-homed devices.

**overview** (C2, F2, F3): The assessment covered 8 effectiveness indicators across 2 dimensions: Incident Handling and Business Continuity. Business Continuity achieved a score of 1.80, but the overall score is unavailable due to the incomplete Incident Handling dimension.

**measuredPerformance** (F4, F5, F7, F8, F9, F16, F17): Measurable performance indicators include Mean Time to Detect (3), Mean Time to Respond (2), Network Operability Under Disruption (3), Zone Availability Rate (2), Operational Threshold Violation Rate (2), and satisfactory Mean Time to Remediate (75 days, 31–90 days). Vulnerability Remediation Rate was measured at 60%, indicating moderate improvement is needed.

**gapsAndMissingEvidence** (F1, F11, F12, F13, F14, F15, F18, F19): Incident Handling is incomplete due to the absence of a Mean Time to Contain score. RPO Achievement Rate is a programme gap with a score of 0, indicating the objective does not exist yet. Foundational controls are in place, but uncontrolled multi-homed devices and incomplete asset interdependency documentation pose significant risks. Additionally, a BC plan test was not performed during the assessment period.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17, F18, F19): Foundational controls such as asset inventory, risk assessment, and controlled IT/OT boundary separation are in place. However, critical issues include uncontrolled multi-homed devices and incomplete asset interdependency documentation. High priority flags include uncontrolled multi-homed devices and incomplete BC plan testing. Vulnerability remediation and mean time to remediate are at satisfactory levels.

**priorities** (F20): The lowest results are: RPO Achievement Rate (programme gap, 0); followed by Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate, all at score 2.

</details>

Attempt 2, repair of headline: prompt_eval_count 900, eval_count 67, 11.3 tokens/s, done_reason stop, 7.7 s
- no validator errors

<details><summary>Attempt 2 reply (repair of headline)</summary>

**headline** (F1, F2, F18, F19, F20): The assessment shows incomplete Incident Handling and a low Business Continuity score, with uncontrolled multi-homed devices and measurement-readiness actions impacting overall performance.

</details>

Attempt 2, repair of gapsAndMissingEvidence: prompt_eval_count 930, eval_count 77, 11.1 tokens/s, done_reason stop, 8.8 s
- no validator errors

<details><summary>Attempt 2 reply (repair of gapsAndMissingEvidence)</summary>

**gapsAndMissingEvidence** (F11, F12): There is a programme gap in RPO Achievement Rate, as the recovery point objective has not been established. Additionally, the asset inventory, risk assessment per zone, controlled IT/OT boundary separation, and documented business continuity plan for critical processes are in place.

</details>

<details><summary>Final narrative (accepted)</summary>

**headline** (F1, F2, F18, F19, F20): The assessment shows incomplete Incident Handling and a low Business Continuity score, with uncontrolled multi-homed devices and measurement-readiness actions impacting overall performance.

**overview** (C2, F2, F3): The assessment covered 8 effectiveness indicators across 2 dimensions: Incident Handling and Business Continuity. Business Continuity achieved a score of 1.80, but the overall score is unavailable due to the incomplete Incident Handling dimension.

**measuredPerformance** (F4, F5, F7, F8, F9, F16, F17): Measurable performance indicators include Mean Time to Detect (3), Mean Time to Respond (2), Network Operability Under Disruption (3), Zone Availability Rate (2), Operational Threshold Violation Rate (2), and satisfactory Mean Time to Remediate (75 days, 31–90 days). Vulnerability Remediation Rate was measured at 60%, indicating moderate improvement is needed.

**gapsAndMissingEvidence** (F11, F12): There is a programme gap in RPO Achievement Rate, as the recovery point objective has not been established. Additionally, the asset inventory, risk assessment per zone, controlled IT/OT boundary separation, and documented business continuity plan for critical processes are in place.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17, F18, F19): Foundational controls such as asset inventory, risk assessment, and controlled IT/OT boundary separation are in place. However, critical issues include uncontrolled multi-homed devices and incomplete asset interdependency documentation. High priority flags include uncontrolled multi-homed devices and incomplete BC plan testing. Vulnerability remediation and mean time to remediate are at satisfactory levels.

**priorities** (F20): The lowest results are: RPO Achievement Rate (programme gap, 0); followed by Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate, all at score 2.

</details>

#### Run 4: failed (3 attempt(s), 4 call(s), 78.9 s)

Attempt 1, whole narrative: prompt_eval_count 1283, eval_count 566, 12.0 tokens/s, done_reason stop, 50.4 s
- `severity` headline, "Westmaas's assessment shows critical gaps in Mean Time to Contain and RPO Achievement Rate, with overall scores hampered by incomplete dimensions and process evidence.": Mean Time to Contain is not marked CRITICAL in its fact; do not call it critical.
- `causal` gapsAndMissingEvidence, "Incident Handling is incomplete due to the absence of a Mean Time to Contain score.": Do not write "due to": a cited fact says "may be related", and "due to" claims a cause. Use the fact's own wording (for example "so") or leave the explanation out.

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F1, F2, F3, F18, F19, F20): Westmaas's assessment shows critical gaps in Mean Time to Contain and RPO Achievement Rate, with overall scores hampered by incomplete dimensions and process evidence.

**overview** (C2, F2, F3): The assessment covered 8 effectiveness indicators across 2 dimensions: Incident Handling and Business Continuity. Business Continuity scored 1.80, but the overall score is unavailable due to the incomplete Incident Handling dimension.

**measuredPerformance** (F4, F5, F7, F8, F9, F16, F17): Measurable performance indicators include Mean Time to Detect (3), Mean Time to Respond (2), Network Operability Under Disruption (3), Zone Availability Rate (2), Operational Threshold Violation Rate (2), and satisfactory Mean Time to Remediate (75 days, 31–90 days). Vulnerability Remediation Rate is below target at 60%.

**gapsAndMissingEvidence** (F1, F11, F12, F13, F14, F15, F18, F19): Incident Handling is incomplete due to the absence of a Mean Time to Contain score. RPO Achievement Rate is a programme gap with a score of 0. Asset interdependency documentation is incomplete, and there are uncontrolled inter-zone multi-homed devices. Additionally, there is no BC plan test, and the architecture foundation is weak.

**foundationsAndFlags** (F16, F17, F18, F19): Process evidence items like Vulnerability Remediation Rate and Mean Time to Remediate are below target but not scored. Zero uncontrolled multi-homed devices and the inability to measure Mean Time to Contain are both measurement-readiness actions. Uncontrolled multi-homed devices may be related to the poor Zone Availability Rate.

**priorities** (F20): The lowest results are: RPO Achievement Rate (programme gap, 0); then, at score 2 and of equal priority, Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate, and RTO Achievement Rate.

</details>

Attempt 2, repair of headline: prompt_eval_count 896, eval_count 73, 10.7 tokens/s, done_reason stop, 8.6 s
- `causal` headline, "The assessment shows incomplete Incident Handling, a score of 1.80 for Business Continuity, and no overall score due to incomplete dimensions and process evidence.": Do not write "due to": a cited fact says "may be related", and "due to" claims a cause. Use the fact's own wording (for example "so") or leave the explanation out.

<details><summary>Attempt 2 reply (repair of headline)</summary>

**headline** (F1, F2, F3, F18, F19, F20): The assessment shows incomplete Incident Handling, a score of 1.80 for Business Continuity, and no overall score due to incomplete dimensions and process evidence.

</details>

Attempt 2, repair of gapsAndMissingEvidence: prompt_eval_count 930, eval_count 82, 10.4 tokens/s, done_reason stop, 10.1 s
- no validator errors

<details><summary>Attempt 2 reply (repair of gapsAndMissingEvidence)</summary>

**gapsAndMissingEvidence** (F11, F18): The assessment identified a programme gap for the Recovery Point Objective (RPO) Achievement Rate, where the objective or capability does not exist yet. Additionally, the Mean Time to Contain score is not measurable, and establishing the necessary architecture foundation is required before this can be addressed. 

</details>

Attempt 3, repair of headline: prompt_eval_count 919, eval_count 74, 9.8 tokens/s, done_reason stop, 9.7 s
- `causal` headline, "The assessment shows incomplete Incident Handling, a score of 1.80 for Business Continuity, and no overall score due to incomplete Incident Handling and process evidence.": Do not write "due to": a cited fact says "may be related", and "due to" claims a cause. Use the fact's own wording (for example "so") or leave the explanation out.

<details><summary>Attempt 3 reply (repair of headline)</summary>

**headline** (F1, F2, F3, F18, F19, F20): The assessment shows incomplete Incident Handling, a score of 1.80 for Business Continuity, and no overall score due to incomplete Incident Handling and process evidence.

</details>

#### Run 5: ok (2 attempt(s), 4 call(s), 100.0 s)

Attempt 1, whole narrative: prompt_eval_count 1283, eval_count 572, 11.5 tokens/s, done_reason stop, 52.8 s
- `severity` headline, "Westmaas's OT cybersecurity assessment shows a critical gap in RPO Achievement Rate and several areas of concern, including uncontrolled multi-homed devices and poor Zone Availability Rate.": RPO Achievement Rate is not marked CRITICAL in its fact; do not call it critical.
- `causal` gapsAndMissingEvidence, "Incident Handling is incomplete due to the absence of a score for Mean Time to Contain.": Do not write "due to": a cited fact says "may be related", and "due to" claims a cause. Use the fact's own wording (for example "so") or leave the explanation out.
- `causal` gapsAndMissingEvidence, "Additionally, Mean Time to Contain is not measurable due to insufficient evidence, and uncontrolled multi-homed devices are a significant risk.": Do not write "due to": a cited fact says "may be related", and "due to" claims a cause. Use the fact's own wording (for example "so") or leave the explanation out.
- `severity` foundationsAndFlags, "However, uncontrolled multi-homed devices and incomplete asset interdependency documentation are flagged as critical and high priority issues.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F1, F2, F3, F11, F18, F19, F20): Westmaas's OT cybersecurity assessment shows a critical gap in RPO Achievement Rate and several areas of concern, including uncontrolled multi-homed devices and poor Zone Availability Rate.

**overview** (C2, F2, F3): The assessment covered 8 effectiveness indicators across 2 dimensions: Incident Handling and Business Continuity. Business Continuity scored 1.80, but the overall score is unavailable due to the incomplete Incident Handling dimension.

**measuredPerformance** (F4, F5, F7, F8, F9, F10, F16, F17): Measurable performance indicators include Mean Time to Detect (3), Mean Time to Respond (2), Network Operability Under Disruption (3), Zone Availability Rate (2), Operational Threshold Violation Rate (2), RTO Achievement Rate (2), and satisfactory Mean Time to Remediate (75 days, 31–90 days). Vulnerability Remediation Rate is below target at 60%.

**gapsAndMissingEvidence** (F1, F11, F18, F19): Incident Handling is incomplete due to the absence of a score for Mean Time to Contain. RPO Achievement Rate is a programme gap, scoring 0. Additionally, Mean Time to Contain is not measurable due to insufficient evidence, and uncontrolled multi-homed devices are a significant risk.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17): Foundational controls are in place, including asset inventory, risk assessment, IT/OT boundary separation, and documented BC plans. However, uncontrolled multi-homed devices and incomplete asset interdependency documentation are flagged as critical and high priority issues. Vulnerability remediation is below target, but process evidence is not scored.

**priorities** (F20): The lowest results are: RPO Achievement Rate (programme gap, 0); followed by Mean Time to Respond (2), Zone Availability Rate (2), Operational Threshold Violation Rate (2), and RTO Achievement Rate (2), all of equal priority.

</details>

Attempt 2, repair of headline: prompt_eval_count 936, eval_count 54, 8.6 tokens/s, done_reason stop, 8.6 s
- no validator errors

<details><summary>Attempt 2 reply (repair of headline)</summary>

**headline** (F3, F20): The assessment indicates an incomplete Incident Handling dimension and multiple areas of concern, including a programme gap in RPO Achievement Rate and low scores in several key indicators.

</details>

Attempt 2, repair of gapsAndMissingEvidence: prompt_eval_count 917, eval_count 98, 7.9 tokens/s, done_reason stop, 14.7 s
- no validator errors

<details><summary>Attempt 2 reply (repair of gapsAndMissingEvidence)</summary>

**gapsAndMissingEvidence** (F11, F18): The assessment identified a programme gap in RPO Achievement Rate, where the recovery point objective has not been established. Additionally, there is no score for Mean Time to Contain in Incident Handling, making the overall Incident Handling score unavailable. The architecture foundation for establishing Mean Time to Contain is incomplete, and uncontrolled multi-homed devices are in a weak state.

</details>

Attempt 2, repair of foundationsAndFlags: prompt_eval_count 826, eval_count 151, 7.1 tokens/s, done_reason stop, 23.9 s
- no validator errors

<details><summary>Attempt 2 reply (repair of foundationsAndFlags)</summary>

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17): The asset inventory and risk assessment per zone are in place, along with a controlled IT/OT boundary separation and a documented BC plan for critical processes. However, uncontrolled inter-zone multi-homed devices were identified as a critical issue, and incomplete or outdated asset interdependency documentation was noted as a high priority concern. Additionally, there has been no BC plan test performed during the assessment period, and the vulnerability remediation rate is below target at 60%, with a mean time to remediate of 75 days. 

</details>

<details><summary>Final narrative (accepted)</summary>

**headline** (F3, F20): The assessment indicates an incomplete Incident Handling dimension and multiple areas of concern, including a programme gap in RPO Achievement Rate and low scores in several key indicators.

**overview** (C2, F2, F3): The assessment covered 8 effectiveness indicators across 2 dimensions: Incident Handling and Business Continuity. Business Continuity scored 1.80, but the overall score is unavailable due to the incomplete Incident Handling dimension.

**measuredPerformance** (F4, F5, F7, F8, F9, F10, F16, F17): Measurable performance indicators include Mean Time to Detect (3), Mean Time to Respond (2), Network Operability Under Disruption (3), Zone Availability Rate (2), Operational Threshold Violation Rate (2), RTO Achievement Rate (2), and satisfactory Mean Time to Remediate (75 days, 31–90 days). Vulnerability Remediation Rate is below target at 60%.

**gapsAndMissingEvidence** (F11, F18): The assessment identified a programme gap in RPO Achievement Rate, where the recovery point objective has not been established. Additionally, there is no score for Mean Time to Contain in Incident Handling, making the overall Incident Handling score unavailable. The architecture foundation for establishing Mean Time to Contain is incomplete, and uncontrolled multi-homed devices are in a weak state.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17): The asset inventory and risk assessment per zone are in place, along with a controlled IT/OT boundary separation and a documented BC plan for critical processes. However, uncontrolled inter-zone multi-homed devices were identified as a critical issue, and incomplete or outdated asset interdependency documentation was noted as a high priority concern. Additionally, there has been no BC plan test performed during the assessment period, and the vulnerability remediation rate is below target at 60%, with a mean time to remediate of 75 days. 

**priorities** (F20): The lowest results are: RPO Achievement Rate (programme gap, 0); followed by Mean Time to Respond (2), Zone Availability Rate (2), Operational Threshold Violation Rate (2), and RTO Achievement Rate (2), all of equal priority.

</details>

### Review

2 of 5 accepted (runs 3 and 5). Run 1 never produced a draft: Ollama's
llama-server crashed while loading the model ("exit status 0xc0000409 …
CUDA error: shared object initialization failed"); the code reported it as
`unavailable/provider_error` with no retry, as specified. Section repair
works: repairs took 6–24 s against ~51 s for a whole narrative, the
gapsAndMissingEvidence and foundationsAndFlags repairs passed first time
(5 of 5), and at temperature 0.5 the model no longer repeated a rejected
sentence word for word. The headline is still the hard part (runs 2 and 4
failed on it).

**Run 5 (accepted) is faithful.** Minor: it states that Incident Handling
is incomplete without citing F1, and "the architecture foundation for
establishing Mean Time to Contain is incomplete" garbles F18.

**Run 3 (accepted) is not.** It says "Vulnerability remediation and mean
time to remediate are at satisfactory levels" (F16: below target); its
headline invents a causal link ("…measurement-readiness actions impacting
overall performance") and calls the Business Continuity score "low" (no
fact does); the gapsAndMissingEvidence repair dropped Mean Time to Contain,
so the narrative never says why Incident Handling is incomplete; it calls
the CRITICAL multi-homing "high priority"; and "incomplete BC plan testing"
misstates "no test was performed".

1. **Invariant breaks the validator missed**: the run 3 items above (the
   process-evidence contradiction is the most serious). Also run 2 att. 3:
   Mean Time to Contain "scoring below expectations" ("below expectations"
   is not a performance word) with an invented cause ("due to incomplete
   dimensions"; that headline cited no "may be related" fact); run 4 att. 2:
   the architecture foundation "is required before this can be addressed"
   (an order the facts do not state).
2. **Validator errors** (16): right 9: severity "critical gap(s) in Mean
   Time to Contain / RPO Achievement Rate" ×5; causal ×3 where the sentence
   invents a cause ("scoring poorly due to incomplete dimensions and
   process issues", "no overall score due to … process evidence" ×2);
   programmeGap "poor scores in RPO Achievement Rate". Borderline 2:
   "…pose critical and high-risk issues", "…flagged as critical and high
   priority issues". Prompt-rule breaks only 4: "due to" explaining the
   no-score rule (content harmless). Wrong 1: noScoreWording on "…with
   overall scores hampered by incomplete dimensions and high-risk process
   issues": "high" belongs to the new subject "process issues", and
   "high-risk" is a risk phrase, not a performance word.
3. **Paraphrased item names**: "Recovery Point Objective (RPO) Achievement
   Rate", "documented business continuity plan for critical processes" (BC
   spelled out), "vulnerability remediation" without "rate".
4. **Prompt conformance**: headlines one sentence in every draft. Process
   facts still land in measuredPerformance (all runs); run 3's
   gapsAndMissingEvidence repair filled the section with in-place controls
   (F12) instead of the missing evidence.
5. **Items named without their fact cited**: run 5 gapsAndMissingEvidence
   (Incident Handling incomplete, F1 uncited).
6. **Band ranges**: second failure (after run set 2, run 3). Run 3 called
   the 60% remediation rate "satisfactory", merging it with Mean Time to
   Remediate. Per the spec, a repeated failure here points at the fact
   wording.

**Performance**: 12.9 → 7.1 tokens/s; whole narratives ~51 s, section
repairs 6–24 s; the whole run set took about 7 minutes of generation plus
cooldowns. No timeouts.
## Run set 2026-09-28 22:20 UTC

- Model: qwen2.5:7b · Ollama 0.34.4 · options `{"temperature":0.2,"num_ctx":4096,"num_predict":1024}`
- Timeout 300.0 s per call · 60.0 s cooldown between runs · retries at temperature 0.5, repairing failing sections only
- Scenario: scenarios/Westmaas_2026-01-01_assessment.json (23 facts)

| `/api/ps` | Model | Size | In VRAM | CPU/GPU | Context |
|---|---|---|---|---|---|
| before | (no model loaded) | | | | |
| after | qwen2.5:7b | 5.12 GB | 4.33 GB | 16%/84% | 4096 |

### Summary

| Measure | Value |
|---|---|
| ok | 5 of 5 |
| generated sections identical and valid | 5 of 5 |
| attempts per run (calls) | 1 (1), 1 (1), 1 (1), 1 (1), 1 (1) |
| errors by rule (all attempts) | — |
| max prompt_eval_count | 816 (warning above 3000) |
| generation speed (tokens/s, eval_duration) | first 12.5, last 14.1, min 12.5, max 14.1 |

### Generated sections

Built from the facts by templates (no model); every run asserts it gets exactly this.

The reference copy passes the validator.

**measuredPerformance** (C3, F4, F5, F7, F8, F9, F10): Each effectiveness indicator is scored from 0 to 4, where 4 is best. In Incident Handling, Mean Time to Detect was 18 hours (score 3, Good) and Mean Time to Respond was 30 hours (score 2, Developing). In Business Continuity, Network Operability Under Disruption was 85% (score 3, Good), Zone Availability Rate was 40% (score 2, Developing), Operational Threshold Violation Rate was 12.5% (score 2, Developing) and RTO Achievement Rate was 50% (score 2, Developing). For Mean Time to Detect, Mean Time to Respond and Operational Threshold Violation Rate, lower values are better.

**gapsAndMissingEvidence** (F1, F3, F6, F11): Mean Time to Contain is not measurable: evidence to compute the value is absent or unreliable, and no reason was recorded. This says nothing about how Mean Time to Contain performs, but without it Incident Handling has no score, so there is no overall score either.

No recovery point objective has been established for RPO Achievement Rate, so it scores 0 as a programme gap; this is not a measured failure.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17, F18, F19): In place: Asset inventory maintained, Risk assessment per zone, Controlled IT/OT boundary separation and BC plan documented for critical processes.

The following issues were flagged (listed by severity; this is not an order of action). Critical: uncontrolled inter-zone multi-homed devices were identified. High: asset interdependency documentation is incomplete or outdated, and no BC plan test was performed during the assessment period — a scheduled action was not completed.

Process evidence is reported without a score. Vulnerability Remediation Rate is 60%, in the 50–69% band, which is below target — moderate programme improvement warranted (medium note). Mean Time to Remediate is 75 days, in the 31–90 days band, which is satisfactory — continue monitoring.

Read together (advisory only; no scores change): the uncontrolled multi-homed devices and Zone Availability Rate (score 2, Developing) may be related, because a segmentation bypass can affect zone availability; review them together. Removing the multi-homed devices and establishing the evidence to measure Mean Time to Contain are both measurement-readiness actions; address them together.

**priorities** (F6, F20): Ranked by score, where a lower score is more urgent: the lowest effectiveness result is RPO Achievement Rate, a programme gap at score 0. Next, at score 2 and of equal priority, are Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate and RTO Achievement Rate, listed in catalogue order. Mean Time to Contain is not ranked because it has no score.

### Runs

| Run | Status | Attempt | Call | Time | prompt_eval_count | eval_count | tokens/s | done_reason | Errors |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ok | 1 | whole | 100.5 s | 816 | 172 | 12.5 | stop | — |
| 2 | ok | 1 | whole | 12.1 s | 816 | 161 | 13.8 | stop | — |
| 3 | ok | 1 | whole | 13.1 s | 816 | 180 | 14.0 | stop | — |
| 4 | ok | 1 | whole | 12.8 s | 816 | 178 | 14.1 | stop | — |
| 5 | ok | 1 | whole | 14.0 s | 816 | 194 | 14.1 | stop | — |

#### Run 1: ok (1 attempt(s), 1 call(s), 100.5 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 816, eval_count 172, 12.5 tokens/s, done_reason stop, 100.5 s
- no validator errors

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (C1): OT Cybersecurity Assessment of Westmaas as of 2026-01-01

**overview** (C2, F1, F2, F13, F14, F15): The assessment covered 8 effectiveness indicators in two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to missing data, while Business Continuity scored 1.80 out of 4. Critical issues include uncontrolled inter-zone multi-homed devices, and high priority issues are incomplete asset interdependency documentation and a lack of BC plan tests. The overall score is not available due to the incomplete dimension.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (C1): OT Cybersecurity Assessment of Westmaas as of 2026-01-01

**overview** (C2, F1, F2, F13, F14, F15): The assessment covered 8 effectiveness indicators in two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to missing data, while Business Continuity scored 1.80 out of 4. Critical issues include uncontrolled inter-zone multi-homed devices, and high priority issues are incomplete asset interdependency documentation and a lack of BC plan tests. The overall score is not available due to the incomplete dimension.

</details>

#### Run 2: ok (1 attempt(s), 1 call(s), 12.1 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 816, eval_count 161, 13.8 tokens/s, done_reason stop, 12.1 s
- no validator errors

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (C1): OT Cybersecurity Assessment of Westmaas as of 2026-01-01

**overview** (C2, F1, F2, F13, F14, F15): The assessment covered 8 effectiveness indicators in 2 dimensions. Incident Handling is incomplete due to missing data, while Business Continuity scored 1.80. Critical issues include uncontrolled inter-zone multi-homed devices, and high priority issues are incomplete asset interdependency documentation and unperformed BC plan tests. The overall score is not available due to the incomplete dimension.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (C1): OT Cybersecurity Assessment of Westmaas as of 2026-01-01

**overview** (C2, F1, F2, F13, F14, F15): The assessment covered 8 effectiveness indicators in 2 dimensions. Incident Handling is incomplete due to missing data, while Business Continuity scored 1.80. Critical issues include uncontrolled inter-zone multi-homed devices, and high priority issues are incomplete asset interdependency documentation and unperformed BC plan tests. The overall score is not available due to the incomplete dimension.

</details>

#### Run 3: ok (1 attempt(s), 1 call(s), 13.1 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 816, eval_count 180, 14.0 tokens/s, done_reason stop, 13.1 s
- no validator errors

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (C1): OT Cybersecurity Assessment of Westmaas as of 2026-01-01

**overview** (C2, F1, F2, F13, F14, F15): The assessment covered 8 effectiveness indicators in two dimensions: Incident Handling and Business Continuity. Business Continuity scored 1.80 out of 4, with a programme gap noted for RPO Achievement Rate. Incident Handling is incomplete due to a missing indicator, resulting in no overall score. Critical and high priority issues include uncontrolled inter-zone multi-homed devices, incomplete asset interdependency documentation, and the lack of a BC plan test during the assessment period.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (C1): OT Cybersecurity Assessment of Westmaas as of 2026-01-01

**overview** (C2, F1, F2, F13, F14, F15): The assessment covered 8 effectiveness indicators in two dimensions: Incident Handling and Business Continuity. Business Continuity scored 1.80 out of 4, with a programme gap noted for RPO Achievement Rate. Incident Handling is incomplete due to a missing indicator, resulting in no overall score. Critical and high priority issues include uncontrolled inter-zone multi-homed devices, incomplete asset interdependency documentation, and the lack of a BC plan test during the assessment period.

</details>

#### Run 4: ok (1 attempt(s), 1 call(s), 12.8 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 816, eval_count 178, 14.1 tokens/s, done_reason stop, 12.8 s
- no validator errors

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (C1): OT Cybersecurity Assessment of Westmaas as of 2026-01-01.

**overview** (C2, F1, F2, F13, F14, F15): The assessment covered 8 effectiveness indicators in 2 dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to a missing Mean Time to Contain score, resulting in no overall score. Business Continuity scored 1.80 out of 4. Critical issues include uncontrolled inter-zone multi-homed devices, and high-priority issues are incomplete asset interdependency documentation and the lack of a BC plan test during the assessment period.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (C1): OT Cybersecurity Assessment of Westmaas as of 2026-01-01.

**overview** (C2, F1, F2, F13, F14, F15): The assessment covered 8 effectiveness indicators in 2 dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to a missing Mean Time to Contain score, resulting in no overall score. Business Continuity scored 1.80 out of 4. Critical issues include uncontrolled inter-zone multi-homed devices, and high-priority issues are incomplete asset interdependency documentation and the lack of a BC plan test during the assessment period.

</details>

#### Run 5: ok (1 attempt(s), 1 call(s), 14.0 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 816, eval_count 194, 14.1 tokens/s, done_reason stop, 14.0 s
- no validator errors

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (C1): OT Cybersecurity Assessment of Westmaas, dated 2026-01-01.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators in 2 dimensions: Incident Handling and Business Continuity. Business Continuity scored 1.80 out of 4, with a programme gap for RPO Achievement Rate. Incident Handling is incomplete due to the absence of a Mean Time to Contain score. The overall score is not available. Critical issues include uncontrolled inter-zone multi-homed devices, and high-priority issues are incomplete asset interdependency documentation and a lack of BC plan tests during the assessment period.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (C1): OT Cybersecurity Assessment of Westmaas, dated 2026-01-01.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators in 2 dimensions: Incident Handling and Business Continuity. Business Continuity scored 1.80 out of 4, with a programme gap for RPO Achievement Rate. Incident Handling is incomplete due to the absence of a Mean Time to Contain score. The overall score is not available. Critical issues include uncontrolled inter-zone multi-homed devices, and high-priority issues are incomplete asset interdependency documentation and a lack of BC plan tests during the assessment period.

</details>

### Review

First run set of the hybrid report. 5 of 5 accepted, all on the first
attempt, with no validator errors (previous run set: 2 of 5, 16 errors).
The generated sections were identical to the reference copy and passed the
validator in every run. The model now writes 161–194 tokens from a
816-token prompt, in 12–14 s once loaded (run 1's 100.5 s includes loading
the model; nothing was loaded before the run).

The overviews are faithful: dimension results, the incomplete Incident
Handling dimension, no overall score, and the three critical and high
flags, all as the facts state them. The weak point moved to the headline:
**all five headlines are a title** ("OT Cybersecurity Assessment of
Westmaas as of 2026-01-01", citing only C1), not "one sentence with the
most important point". The validator cannot see this; it is a prompt
conformance failure in 5 of 5.

1. **Invariant breaks the validator missed**: none. Borderline, all runs:
   the flags are called "high priority" / "high-priority issues", but the
   severity is not a priority; the generated foundationsAndFlags says
   "listed by severity; this is not an order of action", so the overview
   contradicts it in wording. Minor: run 3 "due to a missing indicator"
   (the indicator exists, its score is missing); "Critical issues include"
   when there is exactly one.
2. **Validator errors that look wrong**: none (no errors).
3. **Paraphrased item names**: none; flag messages paraphrased faithfully
   ("a lack of BC plan tests", "unperformed BC plan tests").
4. **Prompt conformance**: headline is a title, not a sentence with the most
   important point, in 5 of 5. Overview 4 sentences in runs 1–4, 5 in run 5
   (limit 2–4). No bullets. Cited facts fit the overview.
5. **Items named without their fact cited**: runs 1–4 state that there is no
   overall score without citing F3 (only run 5 cites it).
6. **Band ranges**: no longer applies to the model (process facts are not in
   its fact set). The generated section states both as the band the value
   falls in ("60%, in the 50–69% band, which is below target").

**Performance**: 12.5 → 14.1 tokens/s, no throttling (previous run set
12.9 → 7.1); max prompt_eval_count 816 of 3000; 16%/84% CPU/GPU split at
4096 context. No timeouts.
## Run set 2026-09-29 00:41 UTC

- Model: qwen2.5:7b · Ollama 0.34.4 · options `{"temperature":0.2,"num_ctx":4096,"num_predict":1024}`
- Timeout 300.0 s per call · 60.0 s cooldown between runs · retries at temperature 0.5, repairing failing sections only
- Scenario: scenarios/Westmaas_2026-01-01_assessment.json (23 facts)

| `/api/ps` | Model | Size | In VRAM | CPU/GPU | Context |
|---|---|---|---|---|---|
| before | (no model loaded) | | | | |
| after | qwen2.5:7b | 5.12 GB | 4.33 GB | 16%/84% | 4096 |

### Summary

| Measure | Value |
|---|---|
| ok | 5 of 5 |
| generated sections identical and valid | 5 of 5 |
| attempts per run (calls) | 1 (1), 1 (1), 1 (1), 1 (1), 1 (1) |
| errors by rule (all attempts) | — |
| max prompt_eval_count | 856 (warning above 3000) |
| generation speed (tokens/s, eval_duration) | first 14.8, last 14.7, min 14.5, max 14.8 |

### Generated sections

Built from the facts by templates (no model); every run asserts it gets exactly this.

The reference copy passes the validator.

**measuredPerformance** (C3, F4, F5, F7, F8, F9, F10): Each effectiveness indicator is scored from 0 to 4, where 4 is best. In Incident Handling, Mean Time to Detect was 18 hours (score 3, Good) and Mean Time to Respond was 30 hours (score 2, Developing). In Business Continuity, Network Operability Under Disruption was 85% (score 3, Good), Zone Availability Rate was 40% (score 2, Developing), Operational Threshold Violation Rate was 12.5% (score 2, Developing) and RTO Achievement Rate was 50% (score 2, Developing). For Mean Time to Detect, Mean Time to Respond and Operational Threshold Violation Rate, lower values are better.

**gapsAndMissingEvidence** (F1, F3, F6, F11): Mean Time to Contain is not measurable: evidence to compute the value is absent or unreliable, and no reason was recorded. This says nothing about how Mean Time to Contain performs, but without it Incident Handling has no score, so there is no overall score either.

No recovery point objective has been established for RPO Achievement Rate, so it scores 0 as a programme gap; this is not a measured failure.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17, F18, F19): In place: Asset inventory maintained, Risk assessment per zone, Controlled IT/OT boundary separation and BC plan documented for critical processes.

The following issues were flagged (listed by severity; this is not an order of action). Critical: uncontrolled inter-zone multi-homed devices were identified. High: asset interdependency documentation is incomplete or outdated, and no BC plan test was performed during the assessment period — a scheduled action was not completed.

Process evidence is reported without a score. Vulnerability Remediation Rate is 60%, in the 50–69% band, which is below target — moderate programme improvement warranted (medium note). Mean Time to Remediate is 75 days, in the 31–90 days band, which is satisfactory — continue monitoring.

Read together (advisory only; no scores change): the uncontrolled multi-homed devices and Zone Availability Rate (score 2, Developing) may be related, because a segmentation bypass can affect zone availability; review them together. Removing the multi-homed devices and establishing the evidence to measure Mean Time to Contain are both measurement-readiness actions; address them together.

**priorities** (F6, F20): Ranked by score, where a lower score is more urgent: the lowest effectiveness result is RPO Achievement Rate, a programme gap at score 0. Next, at score 2 and of equal priority, are Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate and RTO Achievement Rate, listed in catalogue order. Mean Time to Contain is not ranked because it has no score.

### Runs

| Run | Status | Attempt | Call | Time | prompt_eval_count | eval_count | tokens/s | done_reason | Errors |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ok | 1 | whole | 98.6 s | 856 | 184 | 14.8 | stop | — |
| 2 | ok | 1 | whole | 12.1 s | 856 | 175 | 14.7 | stop | — |
| 3 | ok | 1 | whole | 13.0 s | 856 | 189 | 14.8 | stop | — |
| 4 | ok | 1 | whole | 12.4 s | 856 | 175 | 14.5 | stop | — |
| 5 | ok | 1 | whole | 12.5 s | 856 | 179 | 14.7 | stop | — |

#### Run 1: ok (1 attempt(s), 1 call(s), 98.6 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 856, eval_count 184, 14.8 tokens/s, done_reason stop, 98.6 s
- no validator errors

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F13, F14, F15): The assessment identified critical and high severity issues, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to missing data on Mean Time to Contain, resulting in no overall score. Business Continuity scored 1.80 out of 4. Critical and high severity flags include uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation, along with a missing BC plan test.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (F13, F14, F15): The assessment identified critical and high severity issues, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to missing data on Mean Time to Contain, resulting in no overall score. Business Continuity scored 1.80 out of 4. Critical and high severity flags include uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation, along with a missing BC plan test.

</details>

#### Run 2: ok (1 attempt(s), 1 call(s), 12.1 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 856, eval_count 175, 14.7 tokens/s, done_reason stop, 12.1 s
- no validator errors

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F13, F14, F15): The assessment identified critical and high severity issues, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators in two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to a missing indicator, resulting in no overall score. Business Continuity scored 1.80 out of 4. Critical and high severity issues were identified, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (F13, F14, F15): The assessment identified critical and high severity issues, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators in two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to a missing indicator, resulting in no overall score. Business Continuity scored 1.80 out of 4. Critical and high severity issues were identified, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

</details>

#### Run 3: ok (1 attempt(s), 1 call(s), 13.0 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 856, eval_count 189, 14.8 tokens/s, done_reason stop, 13.0 s
- no validator errors

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F13, F14, F15): The assessment identified critical and high severity issues, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to missing data, while Business Continuity scored 1.80 out of 4. No overall score is available. Critical issues include uncontrolled inter-zone multi-homed devices, and high severity issues are asset interdependency documentation being incomplete or outdated, and a lack of BC plan testing during the assessment period.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (F13, F14, F15): The assessment identified critical and high severity issues, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to missing data, while Business Continuity scored 1.80 out of 4. No overall score is available. Critical issues include uncontrolled inter-zone multi-homed devices, and high severity issues are asset interdependency documentation being incomplete or outdated, and a lack of BC plan testing during the assessment period.

</details>

#### Run 4: ok (1 attempt(s), 1 call(s), 12.4 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 856, eval_count 175, 14.5 tokens/s, done_reason stop, 12.4 s
- no validator errors

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F13, F14, F15): The assessment identified critical and high severity issues, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to missing data, while Business Continuity scored 1.80 out of 4. Overall, the assessment flagged critical issues with uncontrolled inter-zone multi-homed devices and high severity problems related to asset interdependency documentation and BC plan testing.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (F13, F14, F15): The assessment identified critical and high severity issues, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to missing data, while Business Continuity scored 1.80 out of 4. Overall, the assessment flagged critical issues with uncontrolled inter-zone multi-homed devices and high severity problems related to asset interdependency documentation and BC plan testing.

</details>

#### Run 5: ok (1 attempt(s), 1 call(s), 12.5 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 856, eval_count 179, 14.7 tokens/s, done_reason stop, 12.5 s
- no validator errors

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F13, F14, F15): The assessment identified critical and high severity issues, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to a missing indicator, resulting in no overall score. Business Continuity scored 1.80 out of 4. Critical and high severity issues include uncontrolled inter-zone multi-homed devices, incomplete asset interdependency documentation, and a lack of BC plan testing.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (F13, F14, F15): The assessment identified critical and high severity issues, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to a missing indicator, resulting in no overall score. Business Continuity scored 1.80 out of 4. Critical and high severity issues include uncontrolled inter-zone multi-homed devices, incomplete asset interdependency documentation, and a lack of BC plan testing.

</details>

### Review

After the headline and severity prompt changes and validator check 12
(commits ebec410, f133cc2). 5 of 5 accepted on the first attempt, no
validator errors; check 12 never fired: the prompt alone fixed the
headline. Generated sections identical and valid in every run.

**Headline**: a finding in 5 of 5, citing F13–F15 and the same sentence
every time ("The assessment identified critical and high severity issues,
including uncontrolled inter-zone multi-homed devices and incomplete asset
interdependency documentation."). One sentence, no client name or date.
It leaves out the dimension results; whether the flags are the most
important finding is a judgement the facts do not make, but it is
accurate.

**Severity, not priority**: "priority" is gone from all five overviews;
the flags are "critical" and "high severity" throughout.

1. **Invariant breaks the validator missed**: none. Still, in all five
   overviews: "Incident Handling is incomplete due to missing data / a
   missing indicator". The content matches F1, but prompt rule 7 forbids
   "due to", and check 7 only looks for it when a cited fact says "may be
   related" (none of the model facts does). Runs 2 and 5 again say "a
   missing indicator" (the indicator exists; its score is missing).
2. **Validator errors that look wrong**: none (no errors).
3. **Paraphrased item names**: none; "incomplete asset interdependency
   documentation" drops "or outdated" (runs 1, 2, 4, 5 and the headline).
4. **Prompt conformance**: headline one sentence stating a finding, 5 of
   5. Overview 4 sentences (runs 1, 2, 3, 5) or 3 (run 4), within 2–4. No
   bullets. Rule 7 ("due to") broken in 5 of 5, see point 1.
5. **Items named without their fact cited**: none; F3 is now cited in
   every overview (previous run set: 1 of 5).
6. **Band ranges**: not applicable to the model parts.

**Performance**: 14.5–14.8 tokens/s, steady; max prompt_eval_count 856 of
3000 (the longer prompt added 40 tokens); 12–13 s per run once loaded,
run 1 98.6 s including the model load.
## Run set 2026-09-29 00:50 UTC

- Model: qwen2.5:7b · Ollama 0.34.4 · options `{"temperature":0.2,"num_ctx":4096,"num_predict":1024}`
- Timeout 300.0 s per call · 60.0 s cooldown between runs · retries at temperature 0.5, repairing failing sections only
- Scenario: scenarios/Westmaas_2026-01-01_assessment.json (23 facts)

| `/api/ps` | Model | Size | In VRAM | CPU/GPU | Context |
|---|---|---|---|---|---|
| before | qwen2.5:7b | 5.12 GB | 4.33 GB | 16%/84% | 4096 |
| after | qwen2.5:7b | 5.12 GB | 4.33 GB | 16%/84% | 4096 |

### Summary

| Measure | Value |
|---|---|
| ok | 5 of 5 |
| generated sections identical and valid | 5 of 5 |
| attempts per run (calls) | 1 (1), 1 (1), 1 (1), 1 (1), 1 (1) |
| errors by rule (all attempts) | — |
| max prompt_eval_count | 830 (warning above 3000) |
| generation speed (tokens/s, eval_duration) | first 14.6, last 14.7, min 14.6, max 14.8 |

### Generated sections

Built from the facts by templates (no model); every run asserts it gets exactly this.

The reference copy passes the validator.

**measuredPerformance** (C3, F4, F5, F7, F8, F9, F10): Each effectiveness indicator is scored from 0 to 4, where 4 is best. In Incident Handling, Mean Time to Detect was 18 hours (score 3, Good) and Mean Time to Respond was 30 hours (score 2, Developing). In Business Continuity, Network Operability Under Disruption was 85% (score 3, Good), Zone Availability Rate was 40% (score 2, Developing), Operational Threshold Violation Rate was 12.5% (score 2, Developing) and RTO Achievement Rate was 50% (score 2, Developing). For Mean Time to Detect, Mean Time to Respond and Operational Threshold Violation Rate, lower values are better.

**gapsAndMissingEvidence** (F1, F3, F6, F11): Mean Time to Contain is not measurable: evidence to compute the value is absent or unreliable, and no reason was recorded. This says nothing about how Mean Time to Contain performs, but without it Incident Handling has no score, so there is no overall score either.

No recovery point objective has been established for RPO Achievement Rate, so it scores 0 as a programme gap; this is not a measured failure.

**foundationsAndFlags** (F12, F13, F14, F15, F16, F17, F18, F19): In place: Asset inventory maintained, Risk assessment per zone, Controlled IT/OT boundary separation and BC plan documented for critical processes.

The following issues were flagged (listed by severity; this is not an order of action). Critical: uncontrolled inter-zone multi-homed devices were identified. High: asset interdependency documentation is incomplete or outdated, and no BC plan test was performed during the assessment period — a scheduled action was not completed.

Process evidence is reported without a score. Vulnerability Remediation Rate is 60%, in the 50–69% band, which is below target — moderate programme improvement warranted (medium note). Mean Time to Remediate is 75 days, in the 31–90 days band, which is satisfactory — continue monitoring.

Read together (advisory only; no scores change): the uncontrolled multi-homed devices and Zone Availability Rate (score 2, Developing) may be related, because a segmentation bypass can affect zone availability; review them together. Removing the multi-homed devices and establishing the evidence to measure Mean Time to Contain are both measurement-readiness actions; address them together.

**priorities** (F6, F20): Ranked by score, where a lower score is more urgent: the lowest effectiveness result is RPO Achievement Rate, a programme gap at score 0. Next, at score 2 and of equal priority, are Mean Time to Respond, Zone Availability Rate, Operational Threshold Violation Rate and RTO Achievement Rate, listed in catalogue order. Mean Time to Contain is not ranked because it has no score.

### Runs

| Run | Status | Attempt | Call | Time | prompt_eval_count | eval_count | tokens/s | done_reason | Errors |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ok | 1 | whole | 14.5 s | 830 | 180 | 14.6 | stop | — |
| 2 | ok | 1 | whole | 13.2 s | 830 | 190 | 14.6 | stop | — |
| 3 | ok | 1 | whole | 13.1 s | 830 | 187 | 14.6 | stop | — |
| 4 | ok | 1 | whole | 12.6 s | 830 | 182 | 14.8 | stop | — |
| 5 | ok | 1 | whole | 12.5 s | 830 | 180 | 14.7 | stop | — |

#### Run 1: ok (1 attempt(s), 1 call(s), 14.5 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 830, eval_count 180, 14.6 tokens/s, done_reason stop, 14.5 s
- no validator errors

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F13, F14, F15): The assessment identified critical and high severity issues, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to missing data, while Business Continuity scored 1.80 out of 4. The overall score is unavailable. Critical issues include uncontrolled inter-zone multi-homed devices, and high severity issues involve incomplete asset interdependency documentation and a lack of BC plan tests.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (F13, F14, F15): The assessment identified critical and high severity issues, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to missing data, while Business Continuity scored 1.80 out of 4. The overall score is unavailable. Critical issues include uncontrolled inter-zone multi-homed devices, and high severity issues involve incomplete asset interdependency documentation and a lack of BC plan tests.

</details>

#### Run 2: ok (1 attempt(s), 1 call(s), 13.2 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 830, eval_count 190, 14.6 tokens/s, done_reason stop, 13.2 s
- no validator errors

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F13, F14, F15): Critical and high severity issues were identified, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators in two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to missing data, while Business Continuity scored 1.80 out of 4. Overall, the assessment did not provide an overall score due to the incomplete dimension. Critical issues include uncontrolled inter-zone multi-homed devices, and high severity issues are incomplete asset interdependency documentation and the lack of BC plan testing.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (F13, F14, F15): Critical and high severity issues were identified, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators in two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to missing data, while Business Continuity scored 1.80 out of 4. Overall, the assessment did not provide an overall score due to the incomplete dimension. Critical issues include uncontrolled inter-zone multi-homed devices, and high severity issues are incomplete asset interdependency documentation and the lack of BC plan testing.

</details>

#### Run 3: ok (1 attempt(s), 1 call(s), 13.1 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 830, eval_count 187, 14.6 tokens/s, done_reason stop, 13.1 s
- no validator errors

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F13, F14, F15): Critical and high severity issues were identified, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to missing data, while Business Continuity scored 1.80 out of 4. Due to the incomplete dimension, the overall score is not available. Critical issues include uncontrolled inter-zone multi-homed devices, and high severity issues are incomplete asset interdependency documentation and a lack of BC plan tests.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (F13, F14, F15): Critical and high severity issues were identified, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to missing data, while Business Continuity scored 1.80 out of 4. Due to the incomplete dimension, the overall score is not available. Critical issues include uncontrolled inter-zone multi-homed devices, and high severity issues are incomplete asset interdependency documentation and a lack of BC plan tests.

</details>

#### Run 4: ok (1 attempt(s), 1 call(s), 12.6 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 830, eval_count 182, 14.8 tokens/s, done_reason stop, 12.6 s
- no validator errors

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F13, F14, F15): Critical and high severity issues were identified, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to a missing indicator, resulting in no overall score. Business Continuity scored 1.80 out of 4. The assessment flagged critical issues with uncontrolled inter-zone multi-homed devices and high severity issues related to incomplete asset interdependency documentation and a lack of BC plan testing.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (F13, F14, F15): Critical and high severity issues were identified, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to a missing indicator, resulting in no overall score. Business Continuity scored 1.80 out of 4. The assessment flagged critical issues with uncontrolled inter-zone multi-homed devices and high severity issues related to incomplete asset interdependency documentation and a lack of BC plan testing.

</details>

#### Run 5: ok (1 attempt(s), 1 call(s), 12.5 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 830, eval_count 180, 14.7 tokens/s, done_reason stop, 12.5 s
- no validator errors

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F13, F14, F15): The assessment identified critical and high severity issues, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to missing data, while Business Continuity scored 1.80 out of 4. The overall score is unavailable. Critical issues include uncontrolled inter-zone multi-homed devices, and high severity issues are incomplete asset interdependency documentation and a lack of BC plan tests.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (F13, F14, F15): The assessment identified critical and high severity issues, including uncontrolled inter-zone multi-homed devices and incomplete asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13, F14, F15): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Incident Handling is incomplete due to missing data, while Business Continuity scored 1.80 out of 4. The overall score is unavailable. Critical issues include uncontrolled inter-zone multi-homed devices, and high severity issues are incomplete asset interdependency documentation and a lack of BC plan tests.

</details>

### Review

After narrowing prompt rule 7 and adding "never call it or its indicator
missing" to rule 3 (commits 9f2696c, 0ace997). 5 of 5 accepted on the
first attempt, no validator errors; generated sections identical and valid
in every run. The model was still loaded from the previous run set, so
run 1 took 14.5 s.

**Headline**: a finding in 5 of 5, two wordings of the same sentence
("The assessment identified critical and high severity issues…" in runs
1 and 5, "Critical and high severity issues were identified…" in runs
2–4), citing F13–F15.

**"due to"**: now allowed and used accurately: "Incident Handling is
incomplete due to missing data" (runs 1, 2, 3, 5), "did not provide an
overall score due to the incomplete dimension" (run 2), "Due to the
incomplete dimension, the overall score is not available" (run 3). All
match F1 and F3.

**"missing"**: run 4 still says "due to a missing indicator" (1 of 5,
previous run set 2 of 5): a break of the new rule 3 sentence, below the
3-of-5 threshold. "missing data" (runs 1, 2, 3, 5) calls the evidence
missing, not the item or its indicator; accurate (F6: evidence absent),
so not counted as a break.

1. **Invariant breaks the validator missed**: none. Run 4's "missing
   indicator" is a prompt-rule break, not an invariant break (it does not
   judge performance).
2. **Validator errors that look wrong**: none (no errors).
3. **Paraphrased item names**: none; "incomplete asset interdependency
   documentation" still drops "or outdated".
4. **Prompt conformance**: headline one sentence stating a finding, 5 of
   5; overview 4 sentences in every run; no bullets; rule 3 ("missing")
   broken in run 4 only. Run 2's "Overall, the assessment did not provide
   an overall score" is clumsy but correct.
5. **Items named without their fact cited**: none; F3 cited in every
   overview.
6. **Band ranges**: not applicable to the model parts.

**Performance**: 14.6–14.8 tokens/s; max prompt_eval_count 830 of 3000
(26 fewer than before: the rule 7 list is gone); 12.5–14.5 s per run.
## Run set 2026-09-29 01:00 UTC: Westmaas_2026-06-01_assessment.json

- Model: qwen2.5:7b · Ollama 0.34.4 · options `{"temperature":0.2,"num_ctx":4096,"num_predict":1024}`
- Timeout 300.0 s per call · 60.0 s cooldown between runs · retries at temperature 0.5, repairing failing sections only
- Scenario: scenarios/Westmaas_2026-06-01_assessment.json (19 facts)

| `/api/ps` | Model | Size | In VRAM | CPU/GPU | Context |
|---|---|---|---|---|---|
| before | qwen2.5:7b | 5.12 GB | 4.33 GB | 16%/84% | 4096 |
| after | qwen2.5:7b | 5.12 GB | 4.33 GB | 16%/84% | 4096 |

### Summary

| Measure | Value |
|---|---|
| ok | 3 of 5 |
| generated sections identical and valid | 5 of 5 |
| attempts per run (calls) | 3 (4), 2 (3), 3 (4), 3 (4), 2 (3) |
| errors by rule (all attempts) | severity ×13, respectively ×6, numbers ×2, leakedIds ×2 |
| max prompt_eval_count | 868 (warning above 3000) |
| generation speed (tokens/s, eval_duration) | first 14.4, last 14.3, min 13.9, max 14.9 |

### Generated sections

Built from the facts by templates (no model); every run asserts it gets exactly this.

The reference copy passes the validator.

**measuredPerformance** (C3, F4, F5, F6, F7, F8, F9, F10, F11): Each effectiveness indicator is scored from 0 to 4, where 4 is best. In Incident Handling, Mean Time to Detect was 18 hours (score 3, Good), Mean Time to Respond was 30 hours (score 2, Developing) and Mean Time to Contain was 20 hours (score 3, Good). In Business Continuity, Network Operability Under Disruption was 85% (score 3, Good), Zone Availability Rate was 82% (score 3, Good), Operational Threshold Violation Rate was 12.5% (score 2, Developing), RTO Achievement Rate was 50% (score 2, Developing) and RPO Achievement Rate was 100% (score 4, Excellent). For Mean Time to Detect, Mean Time to Respond, Mean Time to Contain and Operational Threshold Violation Rate, lower values are better.

**gapsAndMissingEvidence** (F1, F2, F3): No evidence is missing and no programme gaps were found: every effectiveness indicator has a score.

**foundationsAndFlags** (F12, F13, F14, F15): In place: Asset inventory maintained, Risk assessment per zone, Controlled IT/OT boundary separation, Zero uncontrolled multi-homed devices, BC plan documented for critical processes and BC plan tested within defined period.

The following issues were flagged (listed by severity; this is not an order of action). High: asset interdependency documentation is incomplete or outdated.

Process evidence is reported without a score. Vulnerability Remediation Rate is 60%, in the 50–69% band, which is below target — moderate programme improvement warranted (medium note). Mean Time to Remediate is 75 days, in the 31–90 days band, which is satisfactory — continue monitoring.

**priorities** (F16): Ranked by score, where a lower score is more urgent: the lowest effectiveness results, at score 2 and of equal priority, are Mean Time to Respond, Operational Threshold Violation Rate and RTO Achievement Rate, listed in catalogue order.

### Runs

| Run | Status | Attempt | Call | Time | prompt_eval_count | eval_count | tokens/s | done_reason | Errors |
|---|---|---|---|---|---|---|---|---|---|
| 1 | failed | 1 | whole | 12.9 s | 780 | 170 | 14.4 | stop | severity ×2, respectively ×1 |
| 1 | failed | 2 | headline | 4.3 s | 685 | 53 | 14.8 | stop | — |
| 1 | failed | 2 | overview | 10.7 s | 856 | 139 | 14.5 | stop | numbers ×1, severity ×1 |
| 1 | failed | 3 | overview | 7.3 s | 782 | 92 | 14.0 | stop | respectively ×1 |
| 2 | ok | 1 | whole | 14.1 s | 780 | 190 | 14.6 | stop | severity ×2, respectively ×1 |
| 2 | ok | 2 | headline | 2.9 s | 672 | 36 | 14.8 | stop | — |
| 2 | ok | 2 | overview | 11.6 s | 846 | 151 | 14.4 | stop | — |
| 3 | failed | 1 | whole | 13.0 s | 780 | 173 | 14.7 | stop | severity ×2, respectively ×1 |
| 3 | failed | 2 | headline | 2.8 s | 647 | 33 | 14.4 | stop | — |
| 3 | failed | 2 | overview | 13.2 s | 861 | 173 | 14.6 | stop | leakedIds ×2 |
| 3 | failed | 3 | overview | 9.3 s | 848 | 122 | 13.9 | stop | severity ×1 |
| 4 | ok | 1 | whole | 12.7 s | 780 | 170 | 14.6 | stop | severity ×2, respectively ×1 |
| 4 | ok | 2 | headline | 3.0 s | 647 | 36 | 14.4 | stop | — |
| 4 | ok | 2 | overview | 8.8 s | 868 | 105 | 14.1 | stop | numbers ×1, severity ×1 |
| 4 | ok | 3 | overview | 7.4 s | 745 | 97 | 14.3 | stop | — |
| 5 | ok | 1 | whole | 14.0 s | 780 | 190 | 14.7 | stop | severity ×2, respectively ×1 |
| 5 | ok | 2 | headline | 3.2 s | 675 | 41 | 14.9 | stop | — |
| 5 | ok | 2 | overview | 8.8 s | 843 | 109 | 14.3 | stop | — |

#### Run 1: failed (3 attempt(s), 4 call(s), 35.1 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 780, eval_count 170, 14.4 tokens/s, done_reason stop, 12.9 s
- `severity` headline, "The assessment identifies critical gaps in asset interdependency documentation and low scores in key effectiveness indicators.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.
- `respectively` overview, "Both dimensions are complete, with scores of 2.67 and 2.80, respectively, leading to an overall score of 2.73.": Give each item its own number or label; do not write "respectively".
- `severity` overview, "Critical issues include incomplete asset interdependency documentation, and low scores in Mean Time to Respond, Operational Threshold Violation Rate, and RTO Achievement Rate.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F13, F16): The assessment identifies critical gaps in asset interdependency documentation and low scores in key effectiveness indicators.

**overview** (C2, F1, F2, F3, F13, F16): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Both dimensions are complete, with scores of 2.67 and 2.80, respectively, leading to an overall score of 2.73. Critical issues include incomplete asset interdependency documentation, and low scores in Mean Time to Respond, Operational Threshold Violation Rate, and RTO Achievement Rate.

</details>

Attempt 2, repair of headline: prompt_eval_count 685, eval_count 53, 14.8 tokens/s, done_reason stop, 4.3 s
- no validator errors

<details><summary>Attempt 2 reply (repair of headline)</summary>

**headline** (F16): The assessment finds low scores in key effectiveness indicators, including Mean Time to Respond, Operational Threshold Violation Rate, and RTO Achievement Rate, all at score 2.

</details>

Attempt 2, repair of overview: prompt_eval_count 856, eval_count 139, 14.5 tokens/s, done_reason stop, 10.7 s
- `numbers` overview, "The overall score was 2.73 out of 4.": The number "2.73" does not appear in any fact cited by this section.
- `severity` overview, "There is a critical issue with incomplete or outdated asset interdependency documentation.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 2 reply (repair of overview)</summary>

**overview** (C2, F1, F2, F13, F16): The assessment covered two dimensions: Incident Handling and Business Continuity. Incident Handling had a score of 2.67 out of 4, while Business Continuity scored 2.80 out of 4. The overall score was 2.73 out of 4. There is a critical issue with incomplete or outdated asset interdependency documentation. Additionally, the lowest effectiveness results were in Mean Time to Respond, Operational Threshold Violation Rate, and RTO Achievement Rate, each scoring 2.

</details>

Attempt 3, repair of overview: prompt_eval_count 782, eval_count 92, 14.0 tokens/s, done_reason stop, 7.3 s
- `respectively` overview, "The assessment covered Incident Handling and Business Continuity, each with three and five indicators respectively.": Give each item its own number or label; do not write "respectively".

<details><summary>Attempt 3 reply (repair of overview)</summary>

**overview** (C2, F1, F2, F13): The assessment covered Incident Handling and Business Continuity, each with three and five indicators respectively. Incident Handling scored 2.67 out of 4, while Business Continuity scored 2.80 out of 4. There is a HIGH flag for incomplete or outdated asset interdependency documentation.

</details>

#### Run 2: ok (2 attempt(s), 3 call(s), 28.6 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 780, eval_count 190, 14.6 tokens/s, done_reason stop, 14.1 s
- `severity` headline, "Westmaas has a critical issue with asset interdependency documentation, which could significantly impact incident handling.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.
- `respectively` overview, "Both dimensions are complete, with scores of 2.67 and 2.80, respectively, leading to an overall score of 2.73.": Give each item its own number or label; do not write "respectively".
- `severity` overview, "The critical issue is the incomplete or outdated asset interdependency documentation, which may severely affect incident handling.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (C1, F13): Westmaas has a critical issue with asset interdependency documentation, which could significantly impact incident handling.

**overview** (C2, F1, F2, F3, F13, F16): The assessment covered 8 effectiveness indicators in two dimensions: Incident Handling and Business Continuity. Both dimensions are complete, with scores of 2.67 and 2.80, respectively, leading to an overall score of 2.73. The critical issue is the incomplete or outdated asset interdependency documentation, which may severely affect incident handling. The lowest effectiveness results are found in Mean Time to Respond, Operational Threshold Violation Rate, and RTO Achievement Rate, all scoring 2.

</details>

Attempt 2, repair of headline: prompt_eval_count 672, eval_count 36, 14.8 tokens/s, done_reason stop, 2.9 s
- no validator errors

<details><summary>Attempt 2 reply (repair of headline)</summary>

**headline** (F13): The asset interdependency documentation is incomplete or outdated, resulting in a high severity flag.

</details>

Attempt 2, repair of overview: prompt_eval_count 846, eval_count 151, 14.4 tokens/s, done_reason stop, 11.6 s
- no validator errors

<details><summary>Attempt 2 reply (repair of overview)</summary>

**overview** (C2, F1, F2, F3, F13, F16): The assessment covered two dimensions: Incident Handling with a score of 2.67 out of 4 and Business Continuity with a score of 2.80 out of 4. The overall score is 2.73, the average of the two dimension scores. There is a HIGH flag for incomplete or outdated asset interdependency documentation, which may be related to the Incident Handling score. The lowest effectiveness results are at score 2, specifically for Mean Time to Respond, Operational Threshold Violation Rate, and RTO Achievement Rate.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (F13): The asset interdependency documentation is incomplete or outdated, resulting in a high severity flag.

**overview** (C2, F1, F2, F3, F13, F16): The assessment covered two dimensions: Incident Handling with a score of 2.67 out of 4 and Business Continuity with a score of 2.80 out of 4. The overall score is 2.73, the average of the two dimension scores. There is a HIGH flag for incomplete or outdated asset interdependency documentation, which may be related to the Incident Handling score. The lowest effectiveness results are at score 2, specifically for Mean Time to Respond, Operational Threshold Violation Rate, and RTO Achievement Rate.

</details>

#### Run 3: failed (3 attempt(s), 4 call(s), 38.2 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 780, eval_count 173, 14.7 tokens/s, done_reason stop, 13.0 s
- `severity` headline, "The assessment identifies a critical issue with asset interdependency documentation, which is incomplete or outdated.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.
- `respectively` overview, "Both dimensions are complete but scored below average, with overall scores of 2.67 and 2.80, respectively.": Give each item its own number or label; do not write "respectively".
- `severity` overview, "A critical flag has been raised for incomplete asset interdependency documentation, and the lowest effectiveness results are for Mean Time to Respond, Operational Threshold Violation Rate, and RTO Achievement Rate, each scoring 2.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F13): The assessment identifies a critical issue with asset interdependency documentation, which is incomplete or outdated.

**overview** (C2, F1, F2, F3, F13, F16): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Both dimensions are complete but scored below average, with overall scores of 2.67 and 2.80, respectively. The overall score is 2.73. A critical flag has been raised for incomplete asset interdependency documentation, and the lowest effectiveness results are for Mean Time to Respond, Operational Threshold Violation Rate, and RTO Achievement Rate, each scoring 2.

</details>

Attempt 2, repair of headline: prompt_eval_count 647, eval_count 33, 14.4 tokens/s, done_reason stop, 2.8 s
- no validator errors

<details><summary>Attempt 2 reply (repair of headline)</summary>

**headline** (F13): Asset interdependency documentation is incomplete or outdated, posing a high risk.

</details>

Attempt 2, repair of overview: prompt_eval_count 861, eval_count 173, 14.6 tokens/s, done_reason stop, 13.2 s
- `leakedIds` overview, "There are no critical flags, but a high flag is present for incomplete or outdated asset interdependency documentation (F13).": Fact ID "F13" appears in the text. Never write fact IDs.
- `leakedIds` overview, "The lowest effectiveness results are for Mean Time to Respond, Operational Threshold Violation Rate, and RTO Achievement Rate, each scoring 2 (F16).": Fact ID "F16" appears in the text. Never write fact IDs.

<details><summary>Attempt 2 reply (repair of overview)</summary>

**overview** (C2, F1, F2, F3, F13, F16): The assessment covered two dimensions: Incident Handling and Business Continuity. Incident Handling was complete with a score of 2.67 out of 4, while Business Continuity was also complete with a score of 2.80 out of 4. The overall score is 2.73 out of 4, the mean of the two dimension scores. There are no critical flags, but a high flag is present for incomplete or outdated asset interdependency documentation (F13). The lowest effectiveness results are for Mean Time to Respond, Operational Threshold Violation Rate, and RTO Achievement Rate, each scoring 2 (F16). 

</details>

Attempt 3, repair of overview: prompt_eval_count 848, eval_count 122, 13.9 tokens/s, done_reason stop, 9.3 s
- `severity` overview, "There is a critical flag for incomplete or outdated asset interdependency documentation.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 3 reply (repair of overview)</summary>

**overview** (C2, F1, F2, F3, F13): The assessment covered Incident Handling and Business Continuity, with scores of 2.67 out of 4 for Incident Handling and 2.80 out of 4 for Business Continuity. The overall score is 2.73 out of 4. There is a critical flag for incomplete or outdated asset interdependency documentation. The lowest effectiveness results are at score 2.67 for Incident Handling. }

</details>

#### Run 4: ok (3 attempt(s), 4 call(s), 31.8 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 780, eval_count 170, 14.6 tokens/s, done_reason stop, 12.7 s
- `severity` headline, "The assessment highlights a critical issue with asset interdependency documentation, which is incomplete or outdated.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.
- `respectively` overview, "Both dimensions are complete, with scores of 2.67 and 2.80, respectively, resulting in an overall score of 2.73.": Give each item its own number or label; do not write "respectively".
- `severity` overview, "The critical flag is raised for incomplete asset interdependency documentation, and the lowest effectiveness results are found in Mean Time to Respond, Operational Threshold Violation Rate, and RTO Achievement Rate, all scoring 2.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F13): The assessment highlights a critical issue with asset interdependency documentation, which is incomplete or outdated.

**overview** (C2, F1, F2, F3, F13, F16): The assessment covered 8 effectiveness indicators in two dimensions: Incident Handling and Business Continuity. Both dimensions are complete, with scores of 2.67 and 2.80, respectively, resulting in an overall score of 2.73. The critical flag is raised for incomplete asset interdependency documentation, and the lowest effectiveness results are found in Mean Time to Respond, Operational Threshold Violation Rate, and RTO Achievement Rate, all scoring 2.

</details>

Attempt 2, repair of headline: prompt_eval_count 647, eval_count 36, 14.4 tokens/s, done_reason stop, 3.0 s
- no validator errors

<details><summary>Attempt 2 reply (repair of headline)</summary>

**headline** (F13): Asset interdependency documentation is incomplete or outdated, posing a high risk to the organization.

</details>

Attempt 2, repair of overview: prompt_eval_count 868, eval_count 105, 14.1 tokens/s, done_reason stop, 8.8 s
- `numbers` overview, "The overall score is 2.73 out of 4.": The number "2.73" does not appear in any fact cited by this section.
- `severity` overview, "A critical flag is raised for incomplete or outdated asset interdependency documentation. }": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 2 reply (repair of overview)</summary>

**overview** (C2, F1, F2, F13): The assessment covered two dimensions: Incident Handling, with a score of 2.67 out of 4, and Business Continuity, with a score of 2.80 out of 4. The overall score is 2.73 out of 4. A critical flag is raised for incomplete or outdated asset interdependency documentation. }

</details>

Attempt 3, repair of overview: prompt_eval_count 745, eval_count 97, 14.3 tokens/s, done_reason stop, 7.4 s
- no validator errors

<details><summary>Attempt 3 reply (repair of overview)</summary>

**overview** (C2, F1, F2, F13): The assessment covered the Incident Handling and Business Continuity dimensions, each with multiple effectiveness indicators. Incident Handling had a score of 2.67 out of 4, while Business Continuity scored 2.80 out of 4. A HIGH flag was raised for incomplete or outdated asset interdependency documentation. }

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (F13): Asset interdependency documentation is incomplete or outdated, posing a high risk to the organization.

**overview** (C2, F1, F2, F13): The assessment covered the Incident Handling and Business Continuity dimensions, each with multiple effectiveness indicators. Incident Handling had a score of 2.67 out of 4, while Business Continuity scored 2.80 out of 4. A HIGH flag was raised for incomplete or outdated asset interdependency documentation. }

</details>

#### Run 5: ok (2 attempt(s), 3 call(s), 26.0 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 780, eval_count 190, 14.7 tokens/s, done_reason stop, 14.0 s
- `severity` headline, "Westmaas' OT cybersecurity assessment revealed critical gaps in asset interdependency documentation, highlighting the need for immediate attention.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.
- `respectively` overview, "Both dimensions are complete, with scores of 2.67 and 2.80, respectively, resulting in an overall score of 2.73.": Give each item its own number or label; do not write "respectively".
- `severity` overview, "The critical flag for incomplete asset interdependency documentation underscores the urgency of addressing this issue.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (C1, F13): Westmaas' OT cybersecurity assessment revealed critical gaps in asset interdependency documentation, highlighting the need for immediate attention.

**overview** (C2, F1, F2, F3, F13, F16): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Both dimensions are complete, with scores of 2.67 and 2.80, respectively, resulting in an overall score of 2.73. The critical flag for incomplete asset interdependency documentation underscores the urgency of addressing this issue. The lowest effectiveness results are found in Mean Time to Respond, Operational Threshold Violation Rate, and RTO Achievement Rate, all scoring 2.

</details>

Attempt 2, repair of headline: prompt_eval_count 675, eval_count 41, 14.9 tokens/s, done_reason stop, 3.2 s
- no validator errors

<details><summary>Attempt 2 reply (repair of headline)</summary>

**headline** (F13): The assessment found that asset interdependency documentation is incomplete or outdated, marking a high severity issue that requires attention.

</details>

Attempt 2, repair of overview: prompt_eval_count 843, eval_count 109, 14.3 tokens/s, done_reason stop, 8.8 s
- no validator errors

<details><summary>Attempt 2 reply (repair of overview)</summary>

**overview** (C2, F1, F2, F3, F13): The assessment covered two dimensions: Incident Handling and Business Continuity. Incident Handling had a score of 2.67 out of 4, while Business Continuity scored 2.80 out of 4. The overall score was 2.73 out of 4. There is a HIGH flag for incomplete or outdated asset interdependency documentation.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (F13): The assessment found that asset interdependency documentation is incomplete or outdated, marking a high severity issue that requires attention.

**overview** (C2, F1, F2, F3, F13): The assessment covered two dimensions: Incident Handling and Business Continuity. Incident Handling had a score of 2.67 out of 4, while Business Continuity scored 2.80 out of 4. The overall score was 2.73 out of 4. There is a HIGH flag for incomplete or outdated asset interdependency documentation.

</details>

### Review

First run on the June follow-up (all dimensions complete, one HIGH flag,
no CRITICAL flag). 3 of 5 accepted (runs 2, 4, 5); runs 1 and 3 failed
after 3 attempts. The Westmaas baseline's 5 of 5 does not carry over.
Every attempt 1 failed the same way: the single HIGH flag called
"critical" (headline and overview, 5 of 5) and the two dimension scores
given "respectively" (5 of 5). Likely prompt priming: the overview
description says "the critical and high flags" and rule 13 says
"(critical, high)", but June has no critical flag. No text compared June
with January or claimed an improvement.

1. **Invariant breaks the validator missed** (in accepted parts):
   - Run 2 overview: "a HIGH flag for incomplete or outdated asset
     interdependency documentation, which may be related to the Incident
     Handling score". An invented "may be related": no fact relates the
     two. Check 7 does not fire because no cited fact says "may be
     related".
   - Run 4 overview ends with a stray " }" (JSON leaking into the text);
     also in rejected repairs of runs 3 and 4.
   - Headlines add claims no fact makes: "posing a high risk to the
     organization" (run 4), "a high severity issue that requires
     attention" (run 5). Rejected or failed parts also had "low scores in
     key effectiveness indicators" for score 2 (run 1 headline repair),
     "scored below average" (run 3) and "the urgency of addressing this
     issue" (run 5).
2. **Validator errors** (23), all right: severity ×13 (HIGH item called
   critical); respectively ×6 (accurate content, rule by design); numbers
   ×2 ("2.73" in an overview that did not cite F3; accurate, citation
   rule); leakedIds ×2 ("(F13)", "(F16)").
3. **Paraphrased item names**: none.
4. **Prompt conformance**: headlines one sentence; overviews 3–4
   sentences; no bullets. Run 3 attempt 3 wrote "The lowest effectiveness
   results are at score 2.67 for Incident Handling" (a dimension as a
   priority; rejected for severity anyway).
5. **Items named without their fact cited**: run 4's accepted overview
   drops F3 and the overall score (fine), and run 3 attempt 3 names
   priorities without F16.
6. **Band ranges**: not applicable to the model parts.

**Performance**: 13.9–14.9 tokens/s; max prompt_eval_count 868; repairs
3–13 s, runs 26–38 s.

## Run set 2026-09-29 01:06 UTC: Oudendijk_2026-03-01_assessment.json

- Model: qwen2.5:7b · Ollama 0.34.4 · options `{"temperature":0.2,"num_ctx":4096,"num_predict":1024}`
- Timeout 300.0 s per call · 60.0 s cooldown between runs · retries at temperature 0.5, repairing failing sections only
- Scenario: scenarios/Oudendijk_2026-03-01_assessment.json (18 facts)

| `/api/ps` | Model | Size | In VRAM | CPU/GPU | Context |
|---|---|---|---|---|---|
| before | qwen2.5:7b | 5.12 GB | 4.33 GB | 16%/84% | 4096 |
| after | qwen2.5:7b | 5.12 GB | 4.33 GB | 16%/84% | 4096 |

### Summary

| Measure | Value |
|---|---|
| ok | 5 of 5 |
| generated sections identical and valid | 5 of 5 |
| attempts per run (calls) | 3 (3), 3 (3), 3 (3), 1 (1), 2 (2) |
| errors by rule (all attempts) | severity ×7 |
| max prompt_eval_count | 762 (warning above 3000) |
| generation speed (tokens/s, eval_duration) | first 14.4, last 14.3, min 14.2, max 14.9 |

### Generated sections

Built from the facts by templates (no model); every run asserts it gets exactly this.

The reference copy passes the validator.

**measuredPerformance** (C3, F4, F7): Each effectiveness indicator is scored from 0 to 4, where 4 is best. In Incident Handling, Mean Time to Detect was 20 hours (score 3, Good). In Business Continuity, Network Operability Under Disruption was 90% (score 4, Excellent). For Mean Time to Detect, lower values are better.

**gapsAndMissingEvidence** (F1, F2, F3, F5, F6, F8, F9, F10, F11): Mean Time to Respond is not yet assessed. Mean Time to Contain is not yet assessed. Zone Availability Rate is not yet assessed. Operational Threshold Violation Rate is not yet assessed. RTO Achievement Rate is not yet assessed. RPO Achievement Rate is not yet assessed. This says nothing about how Mean Time to Respond, Mean Time to Contain, Zone Availability Rate, Operational Threshold Violation Rate, RTO Achievement Rate and RPO Achievement Rate perform, but without them Incident Handling and Business Continuity have no score, so there is no overall score either.

**foundationsAndFlags** (F12, F13, F14): In place: Asset inventory maintained. Not yet assessed: Risk assessment per zone, Controlled IT/OT boundary separation, Zero uncontrolled multi-homed devices, BC plan documented for critical processes, Vulnerability Remediation Rate, Mean Time to Remediate and BC plan tested within defined period. This says nothing about whether they are in place.

The following issues were flagged (listed by severity; this is not an order of action). High: asset interdependency documentation is incomplete or outdated.

**priorities** (F5, F6, F8, F9, F10, F11, F15): No scored effectiveness indicator is below 3 (Good). Mean Time to Respond, Mean Time to Contain, Zone Availability Rate, Operational Threshold Violation Rate, RTO Achievement Rate and RPO Achievement Rate are not ranked because they have no score.

### Runs

| Run | Status | Attempt | Call | Time | prompt_eval_count | eval_count | tokens/s | done_reason | Errors |
|---|---|---|---|---|---|---|---|---|---|
| 1 | ok | 1 | whole | 10.4 s | 762 | 135 | 14.4 | stop | severity ×1 |
| 1 | ok | 2 | headline | 2.5 s | 664 | 29 | 14.7 | stop | severity ×1 |
| 1 | ok | 3 | headline | 2.8 s | 640 | 34 | 14.2 | stop | — |
| 2 | ok | 1 | whole | 10.3 s | 762 | 131 | 14.7 | stop | severity ×1 |
| 2 | ok | 2 | headline | 2.6 s | 664 | 30 | 14.5 | stop | severity ×1 |
| 2 | ok | 3 | headline | 3.0 s | 640 | 37 | 14.2 | stop | — |
| 3 | ok | 1 | whole | 10.3 s | 762 | 135 | 14.7 | stop | severity ×1 |
| 3 | ok | 2 | headline | 2.6 s | 664 | 31 | 14.9 | stop | severity ×1 |
| 3 | ok | 3 | headline | 2.9 s | 641 | 36 | 14.6 | stop | — |
| 4 | ok | 1 | whole | 10.7 s | 762 | 140 | 14.7 | stop | — |
| 5 | ok | 1 | whole | 9.3 s | 762 | 134 | 14.7 | stop | severity ×1 |
| 5 | ok | 2 | headline | 2.9 s | 664 | 35 | 14.3 | stop | — |

#### Run 1: ok (3 attempt(s), 3 call(s), 15.7 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 762, eval_count 135, 14.4 tokens/s, done_reason stop, 10.4 s
- `severity` headline, "The assessment identifies critical gaps in asset interdependency documentation and confirms that all scored indicators are performing well.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F13, F15): The assessment identifies critical gaps in asset interdependency documentation and confirms that all scored indicators are performing well.

**overview** (C2, F1, F2, F3): The assessment evaluated 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Both dimensions are incomplete due to missing scores, resulting in no overall assessment score. All scored indicators are performing at a good level, with no critical or high flags raised for scored items.

</details>

Attempt 2, repair of headline: prompt_eval_count 664, eval_count 29, 14.7 tokens/s, done_reason stop, 2.5 s
- `severity` headline, "The assessment identifies critical gaps in asset interdependency documentation.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 2 reply (repair of headline)</summary>

**headline** (F13): The assessment identifies critical gaps in asset interdependency documentation.

</details>

Attempt 3, repair of headline: prompt_eval_count 640, eval_count 34, 14.2 tokens/s, done_reason stop, 2.8 s
- no validator errors

<details><summary>Attempt 3 reply (repair of headline)</summary>

**headline** (F13): Asset interdependency documentation is incomplete or outdated, posing a high risk.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (F13): Asset interdependency documentation is incomplete or outdated, posing a high risk.

**overview** (C2, F1, F2, F3): The assessment evaluated 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Both dimensions are incomplete due to missing scores, resulting in no overall assessment score. All scored indicators are performing at a good level, with no critical or high flags raised for scored items.

</details>

#### Run 2: ok (3 attempt(s), 3 call(s), 15.9 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 762, eval_count 131, 14.7 tokens/s, done_reason stop, 10.3 s
- `severity` headline, "The assessment identifies critical gaps in asset interdependency documentation and confirms that all scored indicators are performing well.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F13, F15): The assessment identifies critical gaps in asset interdependency documentation and confirms that all scored indicators are performing well.

**overview** (C2, F1, F2, F3): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Both dimensions are incomplete due to missing scores, resulting in no overall assessment score. All scored indicators are performing at a good level, with no scores below 3.

</details>

Attempt 2, repair of headline: prompt_eval_count 664, eval_count 30, 14.5 tokens/s, done_reason stop, 2.6 s
- `severity` headline, "The assessment identifies critical gaps in asset interdependency documentation.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 2 reply (repair of headline)</summary>

**headline** (F13): The assessment identifies critical gaps in asset interdependency documentation.

</details>

Attempt 3, repair of headline: prompt_eval_count 640, eval_count 37, 14.2 tokens/s, done_reason stop, 3.0 s
- no validator errors

<details><summary>Attempt 3 reply (repair of headline)</summary>

**headline** (F13): Asset interdependency documentation is incomplete or outdated, posing a high risk to the organization.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (F13): Asset interdependency documentation is incomplete or outdated, posing a high risk to the organization.

**overview** (C2, F1, F2, F3): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Both dimensions are incomplete due to missing scores, resulting in no overall assessment score. All scored indicators are performing at a good level, with no scores below 3.

</details>

#### Run 3: ok (3 attempt(s), 3 call(s), 15.7 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 762, eval_count 135, 14.7 tokens/s, done_reason stop, 10.3 s
- `severity` headline, "The assessment identifies critical gaps in asset interdependency documentation and confirms that all scored indicators are performing well.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F13, F15): The assessment identifies critical gaps in asset interdependency documentation and confirms that all scored indicators are performing well.

**overview** (C2, F1, F2, F3): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Both dimensions are incomplete due to missing scores, resulting in no overall assessment score. All scored indicators are performing at a good level, with no critical or high flags in the scored areas.

</details>

Attempt 2, repair of headline: prompt_eval_count 664, eval_count 31, 14.9 tokens/s, done_reason stop, 2.6 s
- `severity` headline, "The assessment identifies a critical gap in asset interdependency documentation.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 2 reply (repair of headline)</summary>

**headline** (F13): The assessment identifies a critical gap in asset interdependency documentation.

</details>

Attempt 3, repair of headline: prompt_eval_count 641, eval_count 36, 14.6 tokens/s, done_reason stop, 2.9 s
- no validator errors

<details><summary>Attempt 3 reply (repair of headline)</summary>

**headline** (F13): Asset interdependency documentation is incomplete or outdated, posing a high risk to the organization.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (F13): Asset interdependency documentation is incomplete or outdated, posing a high risk to the organization.

**overview** (C2, F1, F2, F3): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Both dimensions are incomplete due to missing scores, resulting in no overall assessment score. All scored indicators are performing at a good level, with no critical or high flags in the scored areas.

</details>

#### Run 4: ok (1 attempt(s), 1 call(s), 10.7 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 762, eval_count 140, 14.7 tokens/s, done_reason stop, 10.7 s
- no validator errors

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (C1, F3, F13): Oudendijk's cybersecurity assessment shows no overall score due to incomplete dimensions and a high severity flag for asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Both dimensions are incomplete, resulting in no overall score. Additionally, a high severity flag was raised for incomplete or outdated asset interdependency documentation.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (C1, F3, F13): Oudendijk's cybersecurity assessment shows no overall score due to incomplete dimensions and a high severity flag for asset interdependency documentation.

**overview** (C2, F1, F2, F3, F13): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Both dimensions are incomplete, resulting in no overall score. Additionally, a high severity flag was raised for incomplete or outdated asset interdependency documentation.

</details>

#### Run 5: ok (2 attempt(s), 2 call(s), 12.3 s)

Generated sections: identical to the reference copy, pass the validator.

Attempt 1, whole narrative: prompt_eval_count 762, eval_count 134, 14.7 tokens/s, done_reason stop, 9.3 s
- `severity` headline, "The assessment identifies critical gaps in asset interdependency documentation and confirms that all scored indicators are performing well.": Asset interdependency documentation is not marked CRITICAL in its fact; do not call it critical.

<details><summary>Attempt 1 reply (whole narrative)</summary>

**headline** (F13, F15): The assessment identifies critical gaps in asset interdependency documentation and confirms that all scored indicators are performing well.

**overview** (C2, F1, F2, F3): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Both dimensions are incomplete due to missing scores, resulting in no overall score. All scored indicators are performing at a good level, with no critical or high flags in the scored areas.

</details>

Attempt 2, repair of headline: prompt_eval_count 664, eval_count 35, 14.3 tokens/s, done_reason stop, 2.9 s
- no validator errors

<details><summary>Attempt 2 reply (repair of headline)</summary>

**headline** (F13): The assessment finds a high severity gap in incomplete or outdated asset interdependency documentation.

</details>

<details><summary>Final model parts (accepted)</summary>

**headline** (F13): The assessment finds a high severity gap in incomplete or outdated asset interdependency documentation.

**overview** (C2, F1, F2, F3): The assessment covered 8 effectiveness indicators across two dimensions: Incident Handling and Business Continuity. Both dimensions are incomplete due to missing scores, resulting in no overall score. All scored indicators are performing at a good level, with no critical or high flags in the scored areas.

</details>

### Review

First run on the synthetic sparse scenario (new file; fictional client
"Oudendijk"; 2 of 8 indicators and 2 of 9 Layer 0 items assessed; one HIGH
flag, no CRITICAL). 5 of 5 accepted, but only run 4 on the first attempt.
The generated sections handle the sparse case correctly (every unassessed
item "not yet assessed", "This says nothing about…", no ranking).

**The accepted overviews are misleading in 4 of 5 runs (1, 2, 3, 5).**
Each says "All scored indicators are performing at a good level", and
runs 1, 3 and 5 add "with no critical or high flags in the scored areas"
/ "raised for scored items", while never mentioning the HIGH flag (F13 is
not cited in those overviews). The claim about the two scored indicators
comes from F15 ("No scored effectiveness indicator is below 3 (Good)"),
which the overview does not cite; with 6 of 8 indicators unassessed, a
manager will read it as good performance overall. The "no high flags"
wording contradicts F13 in effect.

1. **Invariant breaks the validator missed**:
   - The overview pattern above (4 of 5): not literally false, but it
     turns the only performance statement in a mostly unassessed
     assessment into the overview's conclusion (invariant 2 in spirit),
     and hides the only flag.
   - Headlines add claims no fact makes: "posing a high risk" /
     "posing a high risk to the organization" (runs 1–3, accepted).
   - Run 4's headline ("shows no overall score due to incomplete
     dimensions and a high severity flag…") can be read as the flag
     causing the missing score.
2. **Validator errors** (7), all right: severity ×7, the HIGH item called
   "critical gaps" (attempt 1 in 4 of 5 runs, and again in the first
   headline repair in runs 1–3).
3. **Paraphrased item names**: none.
4. **Prompt conformance**: headlines one sentence; overviews 3 sentences;
   no bullets. "Both dimensions are incomplete due to missing scores"
   (runs 1, 2, 3, 5) calls the scores missing, not the items: allowed.
5. **Items named without their fact cited**: runs 1, 2, 3, 5 overviews
   state the F15 claim without citing F15.
6. **Band ranges**: not applicable (no process evidence assessed).

**Performance**: 14.2–14.9 tokens/s; max prompt_eval_count 762; 10–16 s
per run.
