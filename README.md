# NIS2 OT Effectiveness Measurement Dashboard

Prototype artifact of the MSc thesis **"Designing a Measurement System to
Evaluate the Effectiveness of NIS2-Related Cybersecurity Measures in OT
Environments"** — Navaneeth Sathiyanarayanan, University of Twente (EEMCS),
in partnership with CGI Netherlands, 2026.

The thesis is available via the University of Twente thesis repository
(essay.utwente.nl).

## What this is

A React dashboard implementing a two-layer measurement system for
NIS2-related cybersecurity effectiveness in Operational Technology (OT)
environments: eight scored effectiveness indicators across Incident
Handling and Business Continuity, nine unscored prerequisite and
process-evidence items, a four-state evidence model, and a
transition-classified before/after comparison. The design, analysis,
demonstration, and evaluation of the system are documented in the thesis;
this repository contains the artifact as evaluated (release `v1.0-thesis`).

## Repository structure

- `/src` — dashboard source code
- `/analysis` — sensitivity analysis script (`sensitivity_analysis_v3.py`,
  thesis Chapter 5) and its output files
- `/scenarios` — the Westmaas Water Treatment assessment data used for the
  demonstration and evaluation (thesis Chapter 6): baseline and follow-up
  assessment files

## Running the dashboard

    npm install
    npm run dev

To reproduce the thesis demonstration: start the dashboard, load
`scenarios/Westmaas_2026-01-01_assessment.json` as an assessment, and load both scenario
files in the comparison view.

## Running the analysis

    python analysis/sensitivity_analysis_v3.py

The committed output files correspond to the results reported in thesis
Chapter 5.

## Note on the data

All assessment data in this repository, including the Westmaas Water
Treatment scenario, is **fictional** and was constructed for the thesis
demonstration. It describes no real facility, organisation, or incident.

## Status

This repository reflects the prototype at thesis submission and is not
maintained as a product. The thesis records its known limitations and the
future work that a production version would require.