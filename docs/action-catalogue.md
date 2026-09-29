# Action catalogue

Status: reviewed and approved. Source for the report's recommended actions.

## How this catalogue works

Each entry is triggered by a situation the dashboard can produce (an indicator
state, a low score, or a Layer 0 state). When an assessment contains that
situation, the entry is added to the report's recommended actions. The AI
(step C) may later choose and order matching entries, but can never add new
ones or change their text.

Rules the entries follow:

- **No judgement on missing evidence.** "Not measurable" and "not verifiable"
  entries are about making the next assessment measurable, never about
  performance.
- **Programme gaps are about establishing something**, not fixing a failure.
- **"Low score"** means a measured score of 2 or lower (below Good),
  including a measured 0. Score 3 gets a target, not an action.
- **Vulnerability entries** follow the dashboard's own action flags, so the
  report never disagrees with the dashboard.
- **Non-events** (`no_qualifying_event`, `no_qualifying_disruption`,
  `no_qualifying_vulnerability`, `no_remediated_vulnerabilities`) have no
  entry by design.
- **References:** a NIS2 point is only given where the link is direct.
  "(supports)" marks an indirect link. Where no clean link exists, the field
  is left empty on purpose.

Fields: **Trigger** (with internal keys for implementation) · **Action** ·
**Steps** · **Why it matters** · **Who** · **NIS2** · **Standard**

NIS2 references are to Article 21(2) of Directive (EU) 2022/2555.

Entry IDs (`ACT-…`) are stable: step C lets the AI choose entries by ID. The
`ACT-` prefix keeps them apart from indicator and item IDs (`BC-08` is RTO
Achievement Rate; `ACT-BC-08` defines recovery point objectives). IDs are
never shown in the report. Each entry stands on its own and never refers to
another entry: any subset of entries can match an assessment.

The code copy is `src/data/actionCatalogue.js`; a test keeps it identical
to this file (IDs, order, every text field, triggers, references).

---

## Incident Handling

### ACT-IH-01 · Establish OT detection capability
- **Trigger:** Mean Time to Detect: no detection capability (`IH-06: capability_absent`)
- **Action:** Establish a detection capability for the OT network.
- **Steps:** Deploy passive network monitoring on the main OT zones (no active scanning in production). Define who receives and triages OT alerts, and during which hours. Start with a baseline of normal traffic so deviations can be detected.
- **Why it matters:** Without detection, incidents are found late or not at all, and detection time cannot be measured.
- **Who:** OT engineering with the security team
- **NIS2:** (b) incident handling
- **Standard:** IEC 62443-3-3 SR 6.2 (continuous monitoring)

### ACT-IH-02 · Shorten detection time
- **Trigger:** Mean Time to Detect: low score (`IH-06: measured, score ≤ 2`)
- **Action:** Reduce the time between an incident starting and it being detected.
- **Steps:** Review the last incidents: where was time lost before detection? Tune alerting on the OT baseline to reduce noise. Make sure OT alerts reach an owned triage queue with defined coverage outside office hours.
- **Why it matters:** Every hour of undetected activity in OT extends the window for disruption.
- **Who:** Security team with OT engineering
- **NIS2:** (b) incident handling
- **Standard:** IEC 62443-3-3 SR 6.2 (continuous monitoring)

### ACT-IH-03 · Establish an OT incident response procedure
- **Trigger:** Mean Time to Respond or Mean Time to Contain: no response capability (`IH-07` or `IH-08: capability_absent`)
- **Action:** Establish a documented incident response procedure for OT.
- **Steps:** Define roles and escalation, including OT engineering and plant operations. Write OT playbooks for the most likely incidents, covering how to isolate without stopping the process. Keep an up-to-date contact list including vendors and integrators.
- **Why it matters:** Without an agreed procedure, response depends on who happens to be available, and response and containment times cannot be measured.
- **Who:** Security team with plant operations
- **NIS2:** (b) incident handling
- **Standard:**

### ACT-IH-04 · Shorten response time
- **Trigger:** Mean Time to Respond: low score (`IH-07: measured, score ≤ 2`)
- **Action:** Reduce the time from detection to the start of a response.
- **Steps:** Set target response times per incident severity. Arrange on-call cover that includes someone with OT knowledge. Review recent incidents for hand-over delays between IT, security and operations.
- **Why it matters:** Delays between detection and response are often organisational, not technical, and can be fixed without new tooling.
- **Who:** Security team with plant operations
- **NIS2:** (b) incident handling
- **Standard:**

### ACT-IH-05 · Shorten containment time
- **Trigger:** Mean Time to Contain: low score (`IH-08: measured, score ≤ 2`)
- **Action:** Pre-approve containment actions per zone.
- **Steps:** For each zone, agree in advance which conduits can be closed and which hosts can be isolated without a safety or process impact. Document who may take these actions. Practise them in a tabletop exercise.
- **Why it matters:** In OT, containment is often slowed by uncertainty about process impact. Decisions made in advance remove that delay.
- **Who:** OT engineering with plant operations
- **NIS2:** (b) incident handling
- **Standard:**

### ACT-IH-06 · Make incident handling measurable
- **Trigger:** Any Incident Handling indicator not measurable (`IH-06`, `IH-07` or `IH-08: not_measurable`)
- **Action:** Record detection, response and containment times for every incident.
- **Steps:** Add mandatory timestamp fields to incident tickets: incident start (if known), detection, response start, containment. Agree which clock is authoritative. Check the fields are filled in when a ticket is closed.
- **Why it matters:** The next assessment can only score these indicators if the times are recorded. This says nothing about current performance.
- **Who:** Security team
- **NIS2:** (b) incident handling; (f) assessing the effectiveness of measures
- **Standard:**

---

## Business Continuity

### ACT-BC-01 · Improve network operability under disruption
- **Trigger:** Network Operability Under Disruption: low score (`BC-01: measured, score ≤ 2`)
- **Action:** Reduce single points of failure in the OT network for critical processes.
- **Steps:** Map the network paths that critical processes depend on. Identify single points of failure (switches, links, servers). Add redundancy where feasible, or document a manual fallback where it is not.
- **Why it matters:** When a single component fails, critical processes should keep the network functions they need.
- **Who:** OT engineering
- **NIS2:** (c) business continuity
- **Standard:** IEC 62443-3-3 FR 7 (resource availability)

### ACT-BC-02 · Improve zone availability
- **Trigger:** Zone Availability Rate: low score (`BC-02: measured, score ≤ 2`)
- **Action:** Address the main causes of zone outages.
- **Steps:** Use the disruption log to find the most common causes of zones becoming unavailable. Fix the top causes first. Check whether uncontrolled connections between zones, such as multi-homed devices, contribute.
- **Why it matters:** Zone outages directly affect the processes running in them.
- **Who:** OT engineering
- **NIS2:** (c) business continuity
- **Standard:** IEC 62443-3-3 FR 7 (resource availability)

### ACT-BC-03 · Reduce operational threshold violations
- **Trigger:** Operational Threshold Violation Rate: low score (`BC-04: measured, score ≤ 2`)
- **Action:** Reduce how often process parameters leave their safe operating range during disruptions.
- **Steps:** Review each violation: which disruption caused it, and how long it lasted. Improve operator procedures for degraded operation. Check that alarms for these parameters work and reach operators in time.
- **Why it matters:** Threshold violations are where a cyber disruption turns into a process or safety impact.
- **Who:** Plant operations with process engineering
- **NIS2:** (c) business continuity
- **Standard:**

### ACT-BC-04 · Define operational thresholds
- **Trigger:** Operational Threshold Violation Rate: no thresholds defined (`BC-04: no_thresholds_defined`)
- **Action:** Define safe operating limits for critical process parameters.
- **Steps:** With process engineering, list the critical parameters per process (for a water plant, e.g. dosing, pressure, levels). Record the safe operating range for each. Make sure deviations are logged.
- **Why it matters:** Without defined limits, the impact of a disruption on the process cannot be judged or measured.
- **Who:** Process engineering with plant operations
- **NIS2:** (c) business continuity (supports)
- **Standard:**

### ACT-BC-05 · Meet recovery time objectives
- **Trigger:** RTO Achievement Rate: low score (`BC-08: measured, score ≤ 2`)
- **Action:** Make recovery of OT systems faster and more predictable.
- **Steps:** Analyse recoveries that exceeded their RTO. Keep tested recovery media and system images for HMIs, servers and engineering workstations. Write step-by-step rebuild procedures and practise them.
- **Why it matters:** Recoveries that take longer than agreed extend process downtime.
- **Who:** OT engineering
- **NIS2:** (c) business continuity, disaster recovery
- **Standard:** IEC 62443-3-3 SR 7.4 (control system recovery and reconstitution)

### ACT-BC-06 · Define recovery time objectives
- **Trigger:** RTO Achievement Rate: no RTO defined (`BC-08: no_rto_defined`)
- **Action:** Define recovery time objectives for critical processes.
- **Steps:** With operations, agree the maximum acceptable downtime per critical process. Derive RTOs for the OT systems each process depends on. Record them in the BC plan.
- **Why it matters:** Without an RTO, recovery cannot be planned or measured, so the indicator stays at 0.
- **Who:** Plant operations with management
- **NIS2:** (c) business continuity
- **Standard:**

### ACT-BC-07 · Meet recovery point objectives
- **Trigger:** RPO Achievement Rate: low score (`BC-09: measured, score ≤ 2`)
- **Action:** Make sure backups are recent and restorable enough to meet the RPO.
- **Steps:** Check backup frequency against the RPO for each system. Verify backups by restoring them to a test system or spare hardware, not only by checking that the job ran. Include PLC programs and configurations, not only servers.
- **Why it matters:** Missing the RPO means losing more process data or configuration than agreed after an incident.
- **Who:** OT engineering
- **NIS2:** (c) business continuity, backup management
- **Standard:** IEC 62443-3-3 SR 7.3 (control system backup)

### ACT-BC-08 · Define recovery point objectives
- **Trigger:** RPO Achievement Rate: no RPO defined (`BC-09: no_rpo_defined`)
- **Action:** Define recovery point objectives for critical processes.
- **Steps:** Agree with operations the maximum acceptable data loss per critical process. Align backup frequency for historians, SCADA/PLC configurations and engineering workstations with it. Verify with a restore test on a test system or spare hardware.
- **Why it matters:** Without an RPO, recovery cannot be measured, so the indicator stays at 0.
- **Who:** Plant operations with OT engineering
- **NIS2:** (c) business continuity, backup management
- **Standard:** IEC 62443-3-3 SR 7.3 (control system backup)

### ACT-BC-09 · Make business continuity measurable
- **Trigger:** Any Business Continuity indicator not measurable (`BC-01`, `BC-02`, `BC-04`, `BC-08` or `BC-09: not_measurable`)
- **Action:** Keep a disruption log.
- **Steps:** For every disruption, record start and end time, affected zones and processes, which network functions stayed available, any threshold violations, and the recovery time and recovery point achieved.
- **Why it matters:** The next assessment can only score these indicators if disruptions are recorded. This says nothing about current performance.
- **Who:** Plant operations with OT engineering
- **NIS2:** (c) business continuity; (f) assessing the effectiveness of measures
- **Standard:**

---

## Foundational controls (Layer 0)

### ACT-L0-01 · Build and maintain the OT asset inventory
- **Trigger:** Asset inventory missing or incomplete/outdated (`L0-asset-inventory: missing | incomplete_outdated`)
- **Action:** Build a complete OT asset inventory and keep it current.
- **Steps:** Combine passive network discovery with site walkdowns. Record for each asset: type, location, zone, firmware version and owner. Agree how often it is reviewed and who updates it after changes.
- **Why it matters:** Almost every other control depends on knowing what is in the network.
- **Who:** OT engineering
- **NIS2:** (i) asset management
- **Standard:** IEC 62443-3-3 SR 7.8 (control system component inventory)

### ACT-L0-02 · Assess risk per zone
- **Trigger:** Risk assessment per zone missing or incomplete/outdated (`L0-risk-assessment: missing | incomplete_outdated`)
- **Action:** Perform a risk assessment for each OT zone.
- **Steps:** Define zones and conduits if not yet done. For each zone, assess threats, consequences for the process and existing controls. Set a review cycle and repeat after major changes.
- **Why it matters:** Risk per zone decides where security effort goes first.
- **Who:** Security team with OT engineering
- **NIS2:** (a) risk analysis
- **Standard:** IEC 62443-3-2 (security risk assessment, zones and conduits)

### ACT-L0-03 · Document asset interdependencies
- **Trigger:** Asset interdependency documentation missing or incomplete/outdated (`L0-interdependency: missing | incomplete_outdated`)
- **Action:** Document which assets and services each critical process depends on.
- **Steps:** For each critical process, list the PLCs, HMIs, servers, network paths and IT services it needs. Include external dependencies such as vendor remote access. Keep it linked to the asset inventory.
- **Why it matters:** Without this, the impact of losing an asset is guesswork, both during incidents and when planning recovery.
- **Who:** OT engineering with plant operations
- **NIS2:** (c) business continuity (supports)
- **Standard:**

### ACT-L0-04 · Establish a controlled IT/OT boundary
- **Trigger:** Controlled IT/OT boundary separation missing or incomplete/outdated (`L0-it-ot-boundary: missing | incomplete_outdated`)
- **Action:** Control all traffic between IT and OT at a defined boundary.
- **Steps:** Route all IT–OT traffic through a firewall or DMZ with explicit allow rules. Remove direct connections. Provide remote access only through a controlled jump host with multi-factor authentication.
- **Why it matters:** An uncontrolled boundary lets IT incidents, such as ransomware, spread into OT.
- **Who:** OT engineering with the security team
- **NIS2:** (j) multi-factor authentication (for the remote access part)
- **Standard:** IEC 62443-3-3 SR 5.2 (zone boundary protection), SR 1.13 (access via untrusted networks)

### ACT-L0-05 · Remove or control multi-homed devices
- **Trigger:** Uncontrolled multi-homed devices found (`L0-multi-homed: uncontrolled_multi_homing_found`)
- **Action:** Remove or control hosts connected to more than one zone.
- **Steps:** List every host with interfaces in more than one zone. Remove the second interface, or route that traffic through a controlled conduit with a firewall. Re-scan to confirm none remain.
- **Why it matters:** A dual-homed host bypasses the zone boundary and can connect zones that should be separated.
- **Who:** OT engineering
- **NIS2:**
- **Standard:** IEC 62443-3-3 SR 5.1 (network segmentation), SR 5.2 (zone boundary protection)

### ACT-L0-06 · Refresh the multi-homing evidence
- **Trigger:** Multi-homed devices: evidence incomplete or outdated (`L0-multi-homed: incomplete_outdated_evidence`)
- **Action:** Re-check all zones for hosts connected to more than one zone.
- **Steps:** Run a fresh check using the asset inventory and network configuration. Record the date and scope of the check.
- **Why it matters:** Without current evidence, it is unknown whether the zone boundaries are intact. This says nothing about the current state.
- **Who:** OT engineering
- **NIS2:**
- **Standard:** IEC 62443-3-3 SR 5.1 (network segmentation)

### ACT-L0-07 · Document the BC plan for critical processes
- **Trigger:** BC plan missing or incomplete/outdated (`L0-bc-plan-doc: missing | incomplete_outdated`)
- **Action:** Write or update the business continuity plan for critical processes.
- **Steps:** Cover each critical process: how to operate manually or in degraded mode, how to recover the OT systems it depends on, RTOs and RPOs, and contact lists. Assign an owner and a review date.
- **Why it matters:** During a disruption, people follow the plan that exists, or improvise.
- **Who:** Plant operations with management
- **NIS2:** (c) business continuity, crisis management
- **Standard:**

### ACT-L0-08 · Test the BC plan
- **Trigger:** No qualifying BC plan test, or test incomplete/outdated (`L0-bc-plan-tested: no_qualifying_test | incomplete_outdated`)
- **Action:** Test the BC plan within the defined period.
- **Steps:** Schedule a test: a tabletop exercise at minimum, ideally including a restore of at least one OT system to a test environment. Record the results and fix the gaps found.
- **Why it matters:** An untested plan often fails on details nobody noticed on paper.
- **Who:** Plant operations with OT engineering
- **NIS2:** (c) business continuity; (f) assessing the effectiveness of measures
- **Standard:**

### ACT-L0-09 · Make foundational controls verifiable
- **Trigger:** Any Layer 0 item not verifiable (`not_verifiable` on any foundational item)
- **Action:** Produce evidence that can be checked.
- **Steps:** For the item concerned, keep a dated document or record with a named owner and a review history, so an assessor can confirm its state.
- **Why it matters:** The next assessment can only confirm a control if there is evidence for it. This says nothing about whether the control is in place.
- **Who:** Owner of the control concerned
- **NIS2:** (f) assessing the effectiveness of measures (supports)
- **Standard:**

---

## Vulnerability management (process evidence)

### ACT-RM-01 · Establish a vulnerability management process
- **Trigger:** Vulnerability management process absent (`RM-04` or `RM-05: process_absent`)
- **Action:** Establish a vulnerability management process for OT.
- **Steps:** Decide how OT vulnerabilities are found (vendor advisories, asset inventory matching). Define how they are prioritised and who decides on remediation. Track them in a register.
- **Why it matters:** Without a process, vulnerabilities are handled ad hoc or not at all.
- **Who:** Security team with OT engineering
- **NIS2:** (e) vulnerability handling
- **Standard:** IEC TR 62443-2-3 (patch management in the IACS environment)

### ACT-RM-02 · Improve the remediation rate
- **Trigger:** Vulnerability Remediation Rate below target (`RM-04: measured` and the engine raises an action flag for it)
- **Action:** Remediate more of the known vulnerabilities, prioritising by risk.
- **Steps:** Prioritise by exposure and process criticality, for example known-exploited vulnerabilities on reachable systems first. Use vendor-approved patches. Where patching is not possible, apply and document compensating controls.
- **Why it matters:** In OT, not every vulnerability can be patched, but every one needs a decision.
- **Who:** OT engineering with the security team
- **NIS2:** (e) vulnerability handling
- **Standard:** IEC TR 62443-2-3 (patch management in the IACS environment)

### ACT-RM-03 · Shorten remediation time
- **Trigger:** Mean Time to Remediate above target (`RM-05: measured` and the engine raises an action flag for it)
- **Action:** Reduce the time from discovering a vulnerability to remediating it.
- **Steps:** Set remediation deadlines per severity. Plan patching into scheduled maintenance windows. Track overdue items and report them to management.
- **Why it matters:** The longer a known vulnerability stays open, the longer the exposure.
- **Who:** OT engineering with plant operations
- **NIS2:** (e) vulnerability handling
- **Standard:** IEC TR 62443-2-3 (patch management in the IACS environment)

### ACT-RM-04 · Make vulnerability handling measurable
- **Trigger:** Vulnerability Remediation Rate or Mean Time to Remediate not measurable (`RM-04` or `RM-05: not_measurable`)
- **Action:** Record discovery and remediation dates for each vulnerability.
- **Steps:** Keep a vulnerability register with, per entry, the date found, the decision taken, and the date remediated or mitigated.
- **Why it matters:** The next assessment can only report on remediation if these dates exist. This says nothing about current performance.
- **Who:** Security team
- **NIS2:** (e) vulnerability handling; (f) assessing the effectiveness of measures
- **Standard:**
