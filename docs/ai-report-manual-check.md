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
