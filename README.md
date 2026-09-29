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
the artifact as evaluated is tagged `v1.0-thesis`.

Since the thesis, the dashboard has gained an optional assessment report:
a short management summary of an assessment, drafted locally and
downloadable as a PDF (see
[Assessment report](#assessment-report-optional)).

## Repository structure

- `/src` — dashboard source code
- `/analysis` — sensitivity analysis script (`sensitivity_analysis_v3.py`,
  thesis Chapter 5) and its output files
- `/scenarios` — the Westmaas Water Treatment assessment data used for the
  demonstration and evaluation (thesis Chapter 6): baseline and follow-up
  assessment files; plus `Oudendijk_2026-03-01_assessment.json`, a
  synthetic, mostly unassessed assessment used to test the assessment report
- `/docs` — the assessment report specification (`ai-report-spec.md`),
  the log of its manual checks against the model
  (`ai-report-manual-check.md`) and the action catalogue behind the
  recommended actions (`action-catalogue.md`)
- `/scripts` — `narrative-check.mjs`, the manual check of the assessment
  report

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

## Assessment report (optional)

Below the dashboard's panels, **Generate report** produces a short
management summary of the current assessment. It is a hybrid:

- Six sections (measured performance, gaps and missing evidence,
  foundations and flags, priorities, targets, recommended actions) are
  generated from the
  assessment by fixed templates, using the dashboard's own labels. They are
  labelled "Generated from the assessment" and need no model. Targets gives,
  for each measured indicator below score 4, the value it needs for the
  next score level, taken from the scoring bands; a programme gap gets the
  step that comes first (define the objective, or establish the
  capability) instead of a number, and an indicator without a score gets
  no target. Recommended actions lists the entries of the reviewed action
  catalogue (`docs/action-catalogue.md`) that match the assessment, with
  steps, why each matters, who acts, and the NIS2 and IEC 62443
  references; missing evidence only ever leads to an action that makes the
  next assessment measurable.
- The headline and the overview are drafted by a local language model
  (Ollama, `qwen2.5:7b`) from a pre-worded list of facts, and checked by a
  validator before they are shown. They are labelled "AI-drafted — review
  before use". A draft that still fails validation after three attempts is
  not shown; the generated sections still are.

The model runs on your own machine; no assessment data leaves it. Every
part can be edited before copying; edited parts are labelled as such and
listed in the copied text. The design, its rules and the validator's
checks are in `docs/ai-report-spec.md`.

**Download PDF** saves the report as a PDF file in one click (for example
`Westmaas_2026-01-01_report.pdf`), with the current text including edits,
each part's label, a "Scores at a glance" table, page numbers and the
model name. It is made in the browser and works offline; the font
(Liberation Sans, SIL Open Font License) is bundled in
`src/assets/fonts/`. When the assessment has changed since the report was
generated, the button is disabled until the report is generated again.

### Setup

1. Install Ollama from https://ollama.com/download and start it (on
   Windows and macOS the app runs it in the background; otherwise run
   `ollama serve`).
2. Optional: to keep models off the system drive, set the environment
   variable `OLLAMA_MODELS` to a folder of your choice (for example
   `D:\ollama\models`) before starting Ollama.
3. Download the model (about 4.7 GB):

       ollama pull qwen2.5:7b

4. Start the dashboard:

       npm run dev

The development server forwards `/ollama` to Ollama at `localhost:11434`;
a production build (`npm run build`) has no such proxy, so its panel
reports that Ollama is not running. On a laptop with a 6 GB GPU a draft
takes about 13 seconds once the model is loaded; the first request loads
it and takes longer.

### Manual check

    npm run check:narrative
    npm run check:narrative -- --scenario scenarios/Westmaas_2026-06-01_assessment.json

Generates the report five times for a scenario (default: the Westmaas
baseline) against the running Ollama and appends the results (every
draft, every validator error, timings) to `docs/ai-report-manual-check.md`
for review.

## Note on the data

All assessment data in this repository, including the Westmaas Water
Treatment scenario, is **fictional** and was constructed for the thesis
demonstration. It describes no real facility, organisation, or incident.

## Status

The tag `v1.0-thesis` reflects the prototype at thesis submission. Later
work (the assessment report) continues as a hobby project and is not
maintained as a product. The thesis records the measurement system's known
limitations and the future work that a production version would require;
the assessment report's limitations are listed in `docs/ai-report-spec.md`.