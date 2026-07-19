"""
NIS2 OT Measurement System - Sensitivity Analysis / Ablation Test
University of Twente | Navaneeth Sathiyanarayanan | June 2026
 
System:
    IH Score = mean(IH-06, IH-07, IH-08)
    BC Score = mean(BC-01, BC-02, BC-04, BC-08-RTO, BC-09-RPO)
    Overall  = mean(IH, BC)
 
Analysis parts:
    A. Structural weight analysis
    B. Illustrative snapshot ablation using hypothetical stress-test profiles
    C. Longitudinal ablation using hypothetical before-after pathways
    D. Exhaustive structural summary across all 5^8 = 390,625 profiles
    E. RM evidence-type comparison
 
The hypothetical profiles test mathematical and decision-level behaviour.
They are not empirical client observations and must not be interpreted as
representative distributions of OT organisations.
 
Usage:
    python sensitivity_analysis_v3.py
    python sensitivity_analysis_v3.py --output-dir ./outputs
    python sensitivity_analysis_v3.py --include-provisional-bands
    python sensitivity_analysis_v3.py --skip-exhaustive
    python sensitivity_analysis_v3.py --export-raw
 
Warning:
    --export-raw writes 390,625 x 8 = 3,125,000 ablation records and can
    produce a very large CSV. Rows are streamed directly to disk.
"""
 
from __future__ import annotations
 
import argparse
import csv
import itertools
import math
import statistics
from pathlib import Path
from typing import Iterable, Mapping, Sequence
 
 
# -----------------------------------------------------------------------------
# Indicator definitions
# -----------------------------------------------------------------------------
 
IH_INDICATORS = ["IH-06", "IH-07", "IH-08"]
BC_INDICATORS = ["BC-01", "BC-02", "BC-04", "BC-08-RTO", "BC-09-RPO"]
ALL_INDICATORS = IH_INDICATORS + BC_INDICATORS
RM_INDICATORS = ["RM-04", "RM-05"]
 
INDICATOR_NAMES = {
    "IH-06": "Mean Time to Detect (MTTD)",
    "IH-07": "Mean Time to Respond (MTTR)",
    "IH-08": "Mean Time to Contain (MTTC)",
    "BC-01": "Network Operability Under Disruption",
    "BC-02": "Zone Availability Rate",
    "BC-04": "Operational Threshold Adherence Rate",
    "BC-08-RTO": "RTO Achievement Rate",
    "BC-09-RPO": "RPO Achievement Rate",
    "RM-04": "Vulnerability Remediation Rate",
    "RM-05": "Mean Time to Remediate (MTTRem)",
}
 
MEASURE_WEIGHT_IH = 0.5
MEASURE_WEIGHT_BC = 0.5
SCORE_MIN = 0
SCORE_MAX = 4
EPSILON = 1e-12
 
# Per-point coefficients in the overall score.
W_IH_PER_IND = MEASURE_WEIGHT_IH / len(IH_INDICATORS)  # 1/6
W_BC_PER_IND = MEASURE_WEIGHT_BC / len(BC_INDICATORS)  # 1/10
 
# Maximum absolute snapshot leave-one-out effect.
MAX_SNAPSHOT_IMPACT_IH = SCORE_MAX * W_IH_PER_IND      # 0.6667
MAX_SNAPSHOT_IMPACT_BC = SCORE_MAX * W_BC_PER_IND      # 0.4000
 
# Longitudinal ablation compares two snapshot effects. One can move from the
# negative extreme to the positive extreme, so the theoretical maximum doubles.
MAX_LONGITUDINAL_IMPACT_IH = 2 * MAX_SNAPSHOT_IMPACT_IH  # 1.3333
MAX_LONGITUDINAL_IMPACT_BC = 2 * MAX_SNAPSHOT_IMPACT_BC  # 0.8000
 
# These bands are analysis-only and are disabled by default. They should not be
# presented as validated thesis thresholds unless separately justified.
PROVISIONAL_BANDS = [
    (0.5, "None"),
    (1.5, "Initial"),
    (2.5, "Developing"),
    (3.5, "Good"),
    (math.inf, "Excellent"),
]
 
 
# -----------------------------------------------------------------------------
# General helpers
# -----------------------------------------------------------------------------
 
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run sensitivity and ablation analyses for the NIS2 OT scoring model."
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parent / "sensitivity_outputs",
        help="Directory for CSV outputs (default: ./sensitivity_outputs next to the script).",
    )
    parser.add_argument(
        "--export-raw",
        action="store_true",
        help="Stream all 3,125,000 exhaustive ablation records to exhaustive_raw.csv.",
    )
    parser.add_argument(
        "--skip-exhaustive",
        action="store_true",
        help="Skip the 390,625-profile exhaustive structural analysis.",
    )
    parser.add_argument(
        "--include-provisional-bands",
        action="store_true",
        help=(
            "Enable analysis-only aggregate bands. These thresholds are provisional "
            "and are not treated as validated scoring thresholds."
        ),
    )
    return parser.parse_args()
 
 
def validate_scores(scores: Mapping[str, int], required_keys: Sequence[str]) -> None:
    missing = set(required_keys) - set(scores)
    extra = set(scores) - set(required_keys)
 
    if missing:
        raise ValueError(f"Missing indicator scores: {sorted(missing)}")
    if extra:
        raise ValueError(f"Unexpected indicator scores: {sorted(extra)}")
 
    for key in required_keys:
        value = scores[key]
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError(
                f"{key} must be an integer from {SCORE_MIN} to {SCORE_MAX}; "
                f"got {value!r}."
            )
        if not SCORE_MIN <= value <= SCORE_MAX:
            raise ValueError(
                f"{key} must be between {SCORE_MIN} and {SCORE_MAX}; got {value!r}."
            )
 
 
def validate_score_list(values: Sequence[int], label: str) -> None:
    if len(values) != len(ALL_INDICATORS):
        raise ValueError(
            f"{label} must contain exactly {len(ALL_INDICATORS)} scores in this order: "
            f"{ALL_INDICATORS}. Got {len(values)} values."
        )
 
 
def validate_rm_scores(values: Sequence[int], label: str) -> None:
    if len(values) != len(RM_INDICATORS):
        raise ValueError(
            f"{label} must contain exactly {len(RM_INDICATORS)} RM scores."
        )
    for value in values:
        if isinstance(value, bool) or not isinstance(value, int):
            raise ValueError(f"{label} values must be integer scores from 0 to 4.")
        if not SCORE_MIN <= value <= SCORE_MAX:
            raise ValueError(f"{label} values must be between 0 and 4.")
 
 
def dict_from_list(values: Sequence[int], label: str) -> dict[str, int]:
    validate_score_list(values, label)
    result = dict(zip(ALL_INDICATORS, values))
    validate_scores(result, ALL_INDICATORS)
    return result
 
 
def compute_scores(
    scores: Mapping[str, int],
    ih_inds: Sequence[str] | None = None,
    bc_inds: Sequence[str] | None = None,
) -> tuple[float, float, float]:
    """Compute IH, BC, and Overall scores without intermediate rounding."""
    active_ih = IH_INDICATORS if ih_inds is None else list(ih_inds)
    active_bc = BC_INDICATORS if bc_inds is None else list(bc_inds)
 
    if not active_ih:
        raise ValueError("At least one IH indicator must remain active.")
    if not active_bc:
        raise ValueError("At least one BC indicator must remain active.")
 
    ih = statistics.mean(scores[indicator] for indicator in active_ih)
    bc = statistics.mean(scores[indicator] for indicator in active_bc)
    overall = MEASURE_WEIGHT_IH * ih + MEASURE_WEIGHT_BC * bc
    return ih, bc, overall
 
 
def weakest_measure(ih: float, bc: float) -> str:
    if math.isclose(ih, bc, abs_tol=EPSILON):
        return "Equal"
    return "IH" if ih < bc else "BC"
 
 
def change_direction(value: float) -> str:
    if value > EPSILON:
        return "improvement"
    if value < -EPSILON:
        return "deterioration"
    return "no change"
 
 
def is_sign_reversal(first: float, second: float) -> bool:
    return (
        (first > EPSILON and second < -EPSILON)
        or (first < -EPSILON and second > EPSILON)
    )
 
 
def score_band(value: float, enabled: bool) -> str:
    if not enabled:
        return "not evaluated"
    if value < SCORE_MIN - EPSILON or value > SCORE_MAX + EPSILON:
        return "out of range"
    for upper_bound, label in PROVISIONAL_BANDS:
        if value < upper_bound or math.isclose(value, upper_bound, abs_tol=EPSILON):
            return label
    return "out of range"
 
 
def percentile_nearest_rank(values: Sequence[float], percentile: float) -> float:
    if not values:
        raise ValueError("Cannot compute a percentile of an empty sequence.")
    if not 0 < percentile <= 1:
        raise ValueError("Percentile must be in the interval (0, 1].")
    ordered = sorted(values)
    index = max(0, math.ceil(percentile * len(ordered)) - 1)
    return ordered[index]
 
 
def maximum_snapshot_impact(indicator: str) -> float:
    return (
        MAX_SNAPSHOT_IMPACT_IH
        if indicator in IH_INDICATORS
        else MAX_SNAPSHOT_IMPACT_BC
    )
 
 
def maximum_longitudinal_impact(indicator: str) -> float:
    return (
        MAX_LONGITUDINAL_IMPACT_IH
        if indicator in IH_INDICATORS
        else MAX_LONGITUDINAL_IMPACT_BC
    )
 
 
def export_csv(path: Path, rows: Sequence[Mapping[str, object]]) -> None:
    if not rows:
        return
 
    fieldnames: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for key in row:
            if key not in seen:
                seen.add(key)
                fieldnames.append(key)
 
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=fieldnames,
            extrasaction="ignore",
            restval="",
        )
        writer.writeheader()
        writer.writerows(rows)
 
    print(f"  Exported: {path}")
 
 
# -----------------------------------------------------------------------------
# Part A: Structural weight analysis
# -----------------------------------------------------------------------------
 
def part_a_structural() -> list[dict[str, object]]:
    print("\n" + "=" * 92)
    print("PART A - STRUCTURAL WEIGHT ANALYSIS")
    print("=" * 92)
    print(
        """
The model assigns equal weights to IH and BC as an explicit and transparent
aggregation choice. Because the two measures contain different numbers of
indicators, equal measure weighting produces unequal per-indicator coefficients.
The sensitivity analysis examines the consequences of that design choice; it
does not treat unequal coefficients as automatically defective.
"""
    )
 
    rows: list[dict[str, object]] = []
    print(
        f"{'Indicator':<18} {'Full name':<42} {'Dim':<5} "
        f"{'Coefficient':>12} {'MaxSnap':>10} {'MaxLong':>10}"
    )
    print("-" * 104)
 
    for indicator in ALL_INDICATORS:
        dimension = "IH" if indicator in IH_INDICATORS else "BC"
        coefficient = W_IH_PER_IND if dimension == "IH" else W_BC_PER_IND
        max_snapshot = maximum_snapshot_impact(indicator)
        max_longitudinal = maximum_longitudinal_impact(indicator)
 
        print(
            f"{indicator:<18} {INDICATOR_NAMES[indicator]:<42} {dimension:<5} "
            f"{coefficient:>12.4f} {max_snapshot:>10.4f} {max_longitudinal:>10.4f}"
        )
        rows.append(
            {
                "indicator": indicator,
                "name": INDICATOR_NAMES[indicator],
                "dimension": dimension,
                "aggregation_coefficient": coefficient,
                "maximum_snapshot_ablation_impact": max_snapshot,
                "maximum_longitudinal_ablation_impact": max_longitudinal,
            }
        )
 
    print(f"\nIH per-indicator coefficient: {W_IH_PER_IND:.4f}")
    print(f"BC per-indicator coefficient: {W_BC_PER_IND:.4f}")
    print(f"Coefficient ratio (IH / BC):  {W_IH_PER_IND / W_BC_PER_IND:.4f}")
    return rows
 
 
# -----------------------------------------------------------------------------
# Part B: Illustrative snapshot ablation
# -----------------------------------------------------------------------------
 
SNAPSHOT_SCENARIOS = {
    "S1 - Low-performance profile": {
        "description": "Hypothetical profile with mostly low or absent measured performance.",
        "IH-06": 1,
        "IH-07": 1,
        "IH-08": 0,
        "BC-01": 1,
        "BC-02": 1,
        "BC-04": 0,
        "BC-08-RTO": 0,
        "BC-09-RPO": 0,
    },
    "S2 - Intermediate-performance profile": {
        "description": "Hypothetical profile with partial improvement across IH and BC.",
        "IH-06": 2,
        "IH-07": 2,
        "IH-08": 1,
        "BC-01": 2,
        "BC-02": 2,
        "BC-04": 2,
        "BC-08-RTO": 1,
        "BC-09-RPO": 1,
    },
    "S3 - High-performance profile": {
        "description": "Hypothetical profile with generally high measured performance.",
        "IH-06": 3,
        "IH-07": 3,
        "IH-08": 3,
        "BC-01": 3,
        "BC-02": 3,
        "BC-04": 3,
        "BC-08-RTO": 3,
        "BC-09-RPO": 2,
    },
    "S4 - IH-strong / BC-weak profile": {
        "description": "Hypothetical asymmetric profile with strong IH and weak BC.",
        "IH-06": 3,
        "IH-07": 3,
        "IH-08": 3,
        "BC-01": 1,
        "BC-02": 1,
        "BC-04": 1,
        "BC-08-RTO": 1,
        "BC-09-RPO": 1,
    },
}
 
 
def part_b_snapshot(include_bands: bool) -> list[dict[str, object]]:
    print("\n" + "=" * 92)
    print("PART B - ILLUSTRATIVE SNAPSHOT ABLATION")
    print("=" * 92)
    print(
        """
These profiles are hypothetical stress-test cases, not empirical client data.
Snapshot ablation reflects the distance between a dropped indicator's score and
the mean of the remaining indicators in its measure. It does not establish
conceptual importance or real-world prevalence.
"""
    )
 
    rows: list[dict[str, object]] = []
 
    for scenario_name, scenario_data in SNAPSHOT_SCENARIOS.items():
        description = str(scenario_data["description"])
        scores = {
            key: value
            for key, value in scenario_data.items()
            if key != "description"
        }
        validate_scores(scores, ALL_INDICATORS)
        ih_base, bc_base, overall_base = compute_scores(scores)
 
        print("\n" + "-" * 92)
        print(f"  {scenario_name}")
        print(f"  {description}")
        print(
            f"  Baseline: IH={ih_base:.4f}  BC={bc_base:.4f}  "
            f"Overall={overall_base:.4f}  "
            f"Band={score_band(overall_base, include_bands)}"
        )
        print(
            f"\n  {'Indicator':<18} {'IH(drop)':>10} {'BC(drop)':>10} "
            f"{'Overall(drop)':>14} {'Delta':>10} {'NormSens':>10}"
        )
        print("  " + "-" * 80)
 
        for dropped in ALL_INDICATORS:
            remaining_ih = [item for item in IH_INDICATORS if item != dropped]
            remaining_bc = [item for item in BC_INDICATORS if item != dropped]
            ih_drop, bc_drop, overall_drop = compute_scores(
                scores, remaining_ih, remaining_bc
            )
            delta = overall_base - overall_drop
            normalized = abs(delta) / maximum_snapshot_impact(dropped)
 
            print(
                f"  {dropped:<18} {ih_drop:>10.4f} {bc_drop:>10.4f} "
                f"{overall_drop:>14.4f} {delta:>+10.4f} {normalized:>10.4f}"
            )
 
            rows.append(
                {
                    "scenario": scenario_name,
                    "scenario_description": description,
                    "dropped_indicator": dropped,
                    "ih_base": ih_base,
                    "bc_base": bc_base,
                    "overall_base": overall_base,
                    "overall_base_band": score_band(overall_base, include_bands),
                    "ih_drop": ih_drop,
                    "bc_drop": bc_drop,
                    "overall_drop": overall_drop,
                    "delta_overall": delta,
                    "abs_delta_overall": abs(delta),
                    "normalized_snapshot_sensitivity": normalized,
                }
            )
 
    return rows
 
 
# -----------------------------------------------------------------------------
# Part C: Longitudinal ablation
# -----------------------------------------------------------------------------
 
LONGITUDINAL_PATHWAYS = [
    {
        "id": "L1",
        "name": "Balanced improvement",
        "purpose": "Sanity check: every indicator improves equally.",
        "before": [1, 1, 1, 1, 1, 1, 1, 1],
        "after": [2, 2, 2, 2, 2, 2, 2, 2],
    },
    {
        "id": "L2",
        "name": "IH-only improvement",
        "purpose": "IH improves while BC remains unchanged.",
        "before": [1, 1, 1, 1, 1, 1, 1, 1],
        "after": [3, 3, 3, 1, 1, 1, 1, 1],
    },
    {
        "id": "L3",
        "name": "BC-only improvement",
        "purpose": "BC improves while IH remains unchanged.",
        "before": [1, 1, 1, 1, 1, 1, 1, 1],
        "after": [1, 1, 1, 3, 3, 3, 3, 3],
    },
    {
        "id": "L4",
        "name": "Single-indicator-driven improvement",
        "purpose": (
            "The measured improvement is driven only by IH-08. IH-08 is used "
            "as a stress-test example, not as a claim of conceptual priority."
        ),
        "before": [1, 1, 1, 1, 1, 1, 1, 1],
        "after": [1, 1, 4, 1, 1, 1, 1, 1],
    },
    {
        "id": "L5",
        "name": "Mixed change and decision stability",
        "purpose": (
            "IH improves slightly while BC deteriorates. Removing IH-06 "
            "reverses the overall direction."
        ),
        "before": [2, 2, 2, 2, 2, 2, 2, 2],
        "after": [3, 2, 2, 1, 2, 2, 2, 2],
    },
    {
        "id": "L6",
        "name": "Boundary-constrained improvement",
        "purpose": "Tests ceiling effects in IH and floor effects in BC.",
        "before": [4, 4, 3, 0, 0, 1, 1, 1],
        "after": [4, 4, 4, 1, 1, 1, 1, 1],
    },
]
 
 
def part_c_longitudinal(include_bands: bool) -> list[dict[str, object]]:
    print("\n" + "=" * 92)
    print("PART C - LONGITUDINAL ABLATION")
    print("=" * 92)
    print(
        """
Each hypothetical pathway contains a before and after assessment. The same
indicator is removed from both assessments. The test examines whether the
reported direction and magnitude of change remain stable.
 
    Delta_full = Overall_after - Overall_before
    Delta_-i   = Overall_after,-i - Overall_before,-i
    Impact_i   = Delta_full - Delta_-i
 
Normalized longitudinal sensitivity uses the theoretical longitudinal maximum,
which is twice the corresponding snapshot maximum.
"""
    )
    if include_bands:
        print(
            "Provisional aggregate bands are enabled for analysis only. They are "
            "not treated as validated thesis thresholds.\n"
        )
    else:
        print(
            "Aggregate band analysis is disabled by default because aggregate "
            "thresholds have not been treated as validated.\n"
        )
 
    rows: list[dict[str, object]] = []
 
    for pathway in LONGITUDINAL_PATHWAYS:
        pathway_id = str(pathway["id"])
        pathway_name = str(pathway["name"])
        purpose = str(pathway["purpose"])
        before = dict_from_list(pathway["before"], f"{pathway_id} before")
        after = dict_from_list(pathway["after"], f"{pathway_id} after")
 
        ih_before, bc_before, overall_before = compute_scores(before)
        ih_after, bc_after, overall_after = compute_scores(after)
        delta_full = overall_after - overall_before
        delta_ih_full = ih_after - ih_before
        delta_bc_full = bc_after - bc_before
        full_direction = change_direction(delta_full)
 
        weakest_before = weakest_measure(ih_before, bc_before)
        weakest_after = weakest_measure(ih_after, bc_after)
        full_weakest_transition = f"{weakest_before} -> {weakest_after}"
 
        band_before = score_band(overall_before, include_bands)
        band_after = score_band(overall_after, include_bands)
        full_band_transition = f"{band_before} -> {band_after}"
 
        print("\n" + "-" * 92)
        print(f"  {pathway_id} - {pathway_name}")
        print(f"  Purpose: {purpose}")
        print(
            f"  Before: IH={ih_before:.4f}  BC={bc_before:.4f}  "
            f"Overall={overall_before:.4f}  Weakest={weakest_before}"
        )
        print(
            f"  After:  IH={ih_after:.4f}  BC={bc_after:.4f}  "
            f"Overall={overall_after:.4f}  Weakest={weakest_after}"
        )
        print(
            f"  Full change: DeltaIH={delta_ih_full:+.4f}  "
            f"DeltaBC={delta_bc_full:+.4f}  DeltaOverall={delta_full:+.4f}  "
            f"Direction={full_direction}"
        )
        if include_bands:
            print(f"  Provisional band path: {full_band_transition}")
 
        print(
            f"\n  {'Indicator':<18} {'Delta_-i':>10} {'Impact':>10} "
            f"{'NormSens':>10} {'Decision':>12} {'SignRev':>9} "
            f"{'WeakPath':>10} {'BandPath':>10} {'Impact%':>10}"
        )
        print("  " + "-" * 108)
 
        for dropped in ALL_INDICATORS:
            remaining_ih = [item for item in IH_INDICATORS if item != dropped]
            remaining_bc = [item for item in BC_INDICATORS if item != dropped]
 
            ih_before_drop, bc_before_drop, overall_before_drop = compute_scores(
                before, remaining_ih, remaining_bc
            )
            ih_after_drop, bc_after_drop, overall_after_drop = compute_scores(
                after, remaining_ih, remaining_bc
            )
 
            delta_drop = overall_after_drop - overall_before_drop
            impact = delta_full - delta_drop
            normalized = abs(impact) / maximum_longitudinal_impact(dropped)
 
            ablated_direction = change_direction(delta_drop)
            decision_changed = ablated_direction != full_direction
            sign_reversal = is_sign_reversal(delta_full, delta_drop)
 
            weakest_before_drop = weakest_measure(ih_before_drop, bc_before_drop)
            weakest_after_drop = weakest_measure(ih_after_drop, bc_after_drop)
            ablated_weakest_transition = (
                f"{weakest_before_drop} -> {weakest_after_drop}"
            )
            weakest_path_changed = (
                ablated_weakest_transition != full_weakest_transition
            )
 
            band_before_drop = score_band(overall_before_drop, include_bands)
            band_after_drop = score_band(overall_after_drop, include_bands)
            ablated_band_transition = f"{band_before_drop} -> {band_after_drop}"
            band_path_changed = (
                include_bands
                and ablated_band_transition != full_band_transition
            )
 
            if math.isclose(delta_full, 0.0, abs_tol=EPSILON):
                impact_pct = None
                impact_pct_text = "n/a"
            else:
                impact_pct = impact / delta_full * 100
                impact_pct_text = f"{impact_pct:+.1f}%"
 
            print(
                f"  {dropped:<18} {delta_drop:>+10.4f} {impact:>+10.4f} "
                f"{normalized:>10.4f} "
                f"{('CHANGED' if decision_changed else 'same'):>12} "
                f"{('YES' if sign_reversal else 'no'):>9} "
                f"{('CHANGED' if weakest_path_changed else 'same'):>10} "
                f"{('CHANGED' if band_path_changed else 'n/a' if not include_bands else 'same'):>10} "
                f"{impact_pct_text:>10}"
            )
 
            rows.append(
                {
                    "pathway_id": pathway_id,
                    "pathway_name": pathway_name,
                    "pathway_purpose": purpose,
                    "dropped_indicator": dropped,
                    "ih_before": ih_before,
                    "bc_before": bc_before,
                    "overall_before": overall_before,
                    "ih_after": ih_after,
                    "bc_after": bc_after,
                    "overall_after": overall_after,
                    "delta_ih_full": delta_ih_full,
                    "delta_bc_full": delta_bc_full,
                    "delta_overall_full": delta_full,
                    "full_direction": full_direction,
                    "ih_before_drop": ih_before_drop,
                    "bc_before_drop": bc_before_drop,
                    "overall_before_drop": overall_before_drop,
                    "ih_after_drop": ih_after_drop,
                    "bc_after_drop": bc_after_drop,
                    "overall_after_drop": overall_after_drop,
                    "delta_overall_drop": delta_drop,
                    "ablation_impact": impact,
                    "normalized_longitudinal_sensitivity": normalized,
                    "ablated_direction": ablated_direction,
                    "decision_changed": decision_changed,
                    "sign_reversal": sign_reversal,
                    "full_weakest_transition": full_weakest_transition,
                    "ablated_weakest_transition": ablated_weakest_transition,
                    "weakest_transition_changed": weakest_path_changed,
                    "bands_enabled": include_bands,
                    "full_band_transition": (
                        full_band_transition if include_bands else "not evaluated"
                    ),
                    "ablated_band_transition": (
                        ablated_band_transition if include_bands else "not evaluated"
                    ),
                    "band_transition_changed": (
                        band_path_changed if include_bands else "not evaluated"
                    ),
                    "ablation_impact_pct_of_full_delta": impact_pct,
                }
            )
 
    return rows
 
 
# -----------------------------------------------------------------------------
# Part D: Exhaustive structural summary
# -----------------------------------------------------------------------------
 
def stream_raw_header(writer: csv.DictWriter) -> None:
    writer.writeheader()
 
 
def part_d_exhaustive(
    output_dir: Path,
    export_raw: bool,
) -> tuple[list[dict[str, object]], Path | None]:
    print("\n" + "=" * 92)
    print("PART D - EXHAUSTIVE STRUCTURAL SUMMARY")
    print("=" * 92)
    print(
        f"""
All {5 ** len(ALL_INDICATORS):,} mathematically possible score profiles are
evaluated. This is a structural analysis under a uniform enumeration of the
score space. It does not estimate how frequently profiles occur in practice.
 
Because the formula is symmetric within each measure, one representative IH
indicator and one representative BC indicator are sufficient for the summary
distributions. The resulting statistics are then reported for every indicator
in the corresponding measure.
"""
    )
 
    ih_deltas: list[float] = []
    bc_deltas: list[float] = []
 
    raw_path: Path | None = None
    raw_handle = None
    raw_writer = None
 
    if export_raw:
        raw_path = output_dir / "exhaustive_raw.csv"
        raw_handle = raw_path.open("w", newline="", encoding="utf-8")
        raw_fieldnames = [
            "profile_index",
            *ALL_INDICATORS,
            "dropped_indicator",
            "overall_base",
            "overall_drop",
            "abs_delta",
        ]
        raw_writer = csv.DictWriter(raw_handle, fieldnames=raw_fieldnames)
        stream_raw_header(raw_writer)
        print(
            "Raw export enabled: streaming 3,125,000 records directly to "
            f"{raw_path}."
        )
 
    try:
        for profile_index, profile in enumerate(
            itertools.product(range(SCORE_MAX + 1), repeat=len(ALL_INDICATORS)),
            start=1,
        ):
            scores = dict(zip(ALL_INDICATORS, profile))
            _, _, overall_base = compute_scores(scores)
 
            # Representative IH ablation.
            remaining_ih = IH_INDICATORS[1:]
            _, _, overall_drop_ih = compute_scores(
                scores, remaining_ih, BC_INDICATORS
            )
            ih_deltas.append(abs(overall_base - overall_drop_ih))
 
            # Representative BC ablation.
            remaining_bc = BC_INDICATORS[1:]
            _, _, overall_drop_bc = compute_scores(
                scores, IH_INDICATORS, remaining_bc
            )
            bc_deltas.append(abs(overall_base - overall_drop_bc))
 
            if raw_writer is not None:
                profile_fields = {
                    indicator: scores[indicator] for indicator in ALL_INDICATORS
                }
                for dropped in ALL_INDICATORS:
                    active_ih = [item for item in IH_INDICATORS if item != dropped]
                    active_bc = [item for item in BC_INDICATORS if item != dropped]
                    _, _, overall_drop = compute_scores(scores, active_ih, active_bc)
                    raw_writer.writerow(
                        {
                            "profile_index": profile_index,
                            **profile_fields,
                            "dropped_indicator": dropped,
                            "overall_base": overall_base,
                            "overall_drop": overall_drop,
                            "abs_delta": abs(overall_base - overall_drop),
                        }
                    )
    finally:
        if raw_handle is not None:
            raw_handle.close()
 
    def summarize(values: Sequence[float], max_impact: float) -> dict[str, float]:
        mean_value = statistics.mean(values)
        return {
            "mean_abs_delta": mean_value,
            "median_abs_delta": statistics.median(values),
            "p95_abs_delta": percentile_nearest_rank(values, 0.95),
            "max_abs_delta": max(values),
            "zero_delta_pct": (
                sum(1 for value in values if math.isclose(value, 0.0, abs_tol=EPSILON))
                / len(values)
                * 100
            ),
            "normalized_mean_sensitivity": mean_value / max_impact,
        }
 
    ih_summary = summarize(ih_deltas, MAX_SNAPSHOT_IMPACT_IH)
    bc_summary = summarize(bc_deltas, MAX_SNAPSHOT_IMPACT_BC)
 
    rows: list[dict[str, object]] = []
    print(
        f"  {'Indicator':<18} {'Mean':>9} {'Median':>9} {'P95':>9} "
        f"{'Max':>9} {'Zero%':>9} {'NormMean':>10}"
    )
    print("  " + "-" * 82)
 
    for indicator in ALL_INDICATORS:
        dimension = "IH" if indicator in IH_INDICATORS else "BC"
        summary = ih_summary if dimension == "IH" else bc_summary
        print(
            f"  {indicator:<18} {summary['mean_abs_delta']:>9.4f} "
            f"{summary['median_abs_delta']:>9.4f} "
            f"{summary['p95_abs_delta']:>9.4f} "
            f"{summary['max_abs_delta']:>9.4f} "
            f"{summary['zero_delta_pct']:>8.2f}% "
            f"{summary['normalized_mean_sensitivity']:>10.4f}"
        )
        rows.append(
            {
                "indicator": indicator,
                "dimension": dimension,
                **summary,
                "profiles_evaluated": 5 ** len(ALL_INDICATORS),
                "interpretation": (
                    "Uniform mathematical score-space enumeration; not an empirical "
                    "distribution of OT organisations."
                ),
            }
        )
 
    print(f"\n  Total profiles evaluated: {5 ** len(ALL_INDICATORS):,}")
    print("  Within-measure symmetry: confirmed by construction")
    return rows, raw_path
 
 
# -----------------------------------------------------------------------------
# Part E: RM evidence-type comparison
# -----------------------------------------------------------------------------
 
RM_CASES = [
    {
        "id": "RM-A",
        "name": "RM stronger than outcomes",
        "description": "Snapshot case in which RM process outputs exceed IH and BC.",
        "ih_scores": [1, 1, 1],
        "bc_scores": [1, 1, 1, 1, 1],
        "rm_scores": [3, 3],
    },
    {
        "id": "RM-B",
        "name": "RM weaker than outcomes",
        "description": "Snapshot case in which RM process outputs trail IH and BC.",
        "ih_scores": [3, 3, 3],
        "bc_scores": [3, 3, 3, 3, 3],
        "rm_scores": [1, 1],
    },
    {
        "id": "RM-C",
        "name": "RM equal to outcomes",
        "description": "Snapshot case in which RM, IH, and BC have equal scores.",
        "ih_scores": [2, 2, 2],
        "bc_scores": [2, 2, 2, 2, 2],
        "rm_scores": [2, 2],
    },
    {
        "id": "RM-D",
        "name": "RM improvement masks modest outcome deterioration",
        "description": (
            "Deliberately constructed longitudinal reversal stress test. IH and BC "
            "deteriorate modestly while RM process outputs improve strongly."
        ),
        "longitudinal": True,
        "before_ih": [2, 2, 2],
        "before_bc": [2, 2, 2, 2, 2],
        "before_rm": [0, 0],
        "after_ih": [2, 2, 1],
        "after_bc": [2, 2, 2, 2, 1],
        "after_rm": [4, 4],
    },
    {
        "id": "RM-E",
        "name": "RM deterioration masks modest outcome improvement",
        "description": (
            "Deliberately constructed longitudinal reversal stress test. IH and BC "
            "improve modestly while RM process outputs deteriorate strongly."
        ),
        "longitudinal": True,
        "before_ih": [2, 2, 2],
        "before_bc": [2, 2, 2, 2, 2],
        "before_rm": [4, 4],
        "after_ih": [2, 2, 3],
        "after_bc": [2, 2, 2, 2, 3],
        "after_rm": [0, 0],
    },
]
 
 
def scores_from_dimension_lists(
    ih_values: Sequence[int], bc_values: Sequence[int]
) -> dict[str, int]:
    if len(ih_values) != len(IH_INDICATORS):
        raise ValueError("IH score list has an incorrect length.")
    if len(bc_values) != len(BC_INDICATORS):
        raise ValueError("BC score list has an incorrect length.")
    scores = {
        **dict(zip(IH_INDICATORS, ih_values)),
        **dict(zip(BC_INDICATORS, bc_values)),
    }
    validate_scores(scores, ALL_INDICATORS)
    return scores
 
 
def part_e_rm_comparison(include_bands: bool) -> list[dict[str, object]]:
    print("\n" + "=" * 92)
    print("PART E - RM EVIDENCE-TYPE COMPARISON")
    print("=" * 92)
    print(
        """
This section examines how adding RM process-output evidence as a third scored
measure changes an outcome-oriented composite. The comparison is descriptive,
not proof by itself that RM must be included or excluded. Its purpose is to
show how mixing evidence types can alter the value or direction of the result.
"""
    )
 
    rows: list[dict[str, object]] = []
 
    for case in RM_CASES:
        case_id = str(case["id"])
        case_name = str(case["name"])
        description = str(case["description"])
        print(f"\n  {case_id} - {case_name}")
        print(f"  {description}")
 
        if not case.get("longitudinal", False):
            scores = scores_from_dimension_lists(
                case["ih_scores"], case["bc_scores"]
            )
            validate_rm_scores(case["rm_scores"], f"{case_id} RM scores")
            ih, bc, layer1_overall = compute_scores(scores)
            rm_score = statistics.mean(case["rm_scores"])
            with_rm_overall = statistics.mean([ih, bc, rm_score])
            effect = with_rm_overall - layer1_overall
 
            print(
                f"  Layer 1: IH={ih:.4f}  BC={bc:.4f}  "
                f"Overall={layer1_overall:.4f}"
            )
            print(
                f"  With RM: RM={rm_score:.4f}  Overall={with_rm_overall:.4f}  "
                f"Effect={effect:+.4f}"
            )
 
            rows.append(
                {
                    "case_id": case_id,
                    "case_name": case_name,
                    "case_description": description,
                    "case_type": "snapshot",
                    "ih_score": ih,
                    "bc_score": bc,
                    "layer1_overall": layer1_overall,
                    "rm_score": rm_score,
                    "with_rm_overall": with_rm_overall,
                    "effect_of_adding_rm": effect,
                    "direction": (
                        "raises score"
                        if effect > EPSILON
                        else "lowers score"
                        if effect < -EPSILON
                        else "no change"
                    ),
                    "layer1_band": score_band(layer1_overall, include_bands),
                    "with_rm_band": score_band(with_rm_overall, include_bands),
                }
            )
        else:
            before_scores = scores_from_dimension_lists(
                case["before_ih"], case["before_bc"]
            )
            after_scores = scores_from_dimension_lists(
                case["after_ih"], case["after_bc"]
            )
            validate_rm_scores(case["before_rm"], f"{case_id} before RM")
            validate_rm_scores(case["after_rm"], f"{case_id} after RM")
 
            ih_before, bc_before, layer1_before = compute_scores(before_scores)
            ih_after, bc_after, layer1_after = compute_scores(after_scores)
            layer1_delta = layer1_after - layer1_before
 
            rm_before = statistics.mean(case["before_rm"])
            rm_after = statistics.mean(case["after_rm"])
            with_rm_before = statistics.mean([ih_before, bc_before, rm_before])
            with_rm_after = statistics.mean([ih_after, bc_after, rm_after])
            with_rm_delta = with_rm_after - with_rm_before
 
            direction_layer1 = change_direction(layer1_delta)
            direction_with_rm = change_direction(with_rm_delta)
            decision_changed = direction_layer1 != direction_with_rm
            sign_reversal = is_sign_reversal(layer1_delta, with_rm_delta)
 
            print(
                f"  Layer 1 only: Before={layer1_before:.4f}  "
                f"After={layer1_after:.4f}  Delta={layer1_delta:+.4f}  "
                f"Direction={direction_layer1}"
            )
            print(
                f"  With RM:      Before={with_rm_before:.4f}  "
                f"After={with_rm_after:.4f}  Delta={with_rm_delta:+.4f}  "
                f"Direction={direction_with_rm}"
            )
            print(
                f"  Decision changed: {'YES' if decision_changed else 'no'}  "
                f"Sign reversal: {'YES' if sign_reversal else 'no'}"
            )
 
            rows.append(
                {
                    "case_id": case_id,
                    "case_name": case_name,
                    "case_description": description,
                    "case_type": "longitudinal",
                    "layer1_before": layer1_before,
                    "layer1_after": layer1_after,
                    "layer1_delta": layer1_delta,
                    "layer1_direction": direction_layer1,
                    "rm_before": rm_before,
                    "rm_after": rm_after,
                    "with_rm_before": with_rm_before,
                    "with_rm_after": with_rm_after,
                    "with_rm_delta": with_rm_delta,
                    "with_rm_direction": direction_with_rm,
                    "decision_changed": decision_changed,
                    "sign_reversal": sign_reversal,
                }
            )
 
    print(
        """
  Interpretation: adding RM raises, lowers, or leaves a snapshot score unchanged
  according to its value relative to IH and BC. In deliberately constructed
  longitudinal stress tests, sufficiently strong opposing RM movement can even
  reverse the composite direction. This illustrates why evidence-type mixing
  requires explicit conceptual justification.
"""
    )
    return rows
 
 
# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
 
def main() -> None:
    args = parse_args()
    output_dir: Path = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
 
    print("NIS2 OT MEASUREMENT SYSTEM - SENSITIVITY ANALYSIS v3")
    print("University of Twente | Navaneeth Sathiyanarayanan | June 2026")
    print("=" * 92)
    print("System: Overall = 0.5 * IH + 0.5 * BC")
    print("        IH = mean(IH-06, IH-07, IH-08)")
    print("        BC = mean(BC-01, BC-02, BC-04, BC-08-RTO, BC-09-RPO)")
    print("All scenarios are hypothetical stress tests, not empirical client data.")
    print(f"Output directory: {output_dir}")
 
    structural_rows = part_a_structural()
    snapshot_rows = part_b_snapshot(args.include_provisional_bands)
    longitudinal_rows = part_c_longitudinal(args.include_provisional_bands)
 
    if args.skip_exhaustive:
        exhaustive_rows: list[dict[str, object]] = []
        raw_path = None
        print("\nPart D skipped by command-line option.")
    else:
        exhaustive_rows, raw_path = part_d_exhaustive(
            output_dir=output_dir,
            export_raw=args.export_raw,
        )
 
    rm_rows = part_e_rm_comparison(args.include_provisional_bands)
 
    print("\n" + "=" * 92)
    print("EXPORTING CSV FILES")
    print("=" * 92)
    export_csv(output_dir / "structural_weights.csv", structural_rows)
    export_csv(output_dir / "snapshot_ablation.csv", snapshot_rows)
    export_csv(output_dir / "longitudinal_ablation.csv", longitudinal_rows)
    if exhaustive_rows:
        export_csv(output_dir / "exhaustive_summary.csv", exhaustive_rows)
    export_csv(output_dir / "rm_comparison.csv", rm_rows)
    if raw_path is not None:
        print(f"  Exported: {raw_path}")
 
    print("\nDone.")
 
 
if __name__ == "__main__":
    main()