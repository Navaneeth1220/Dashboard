/**
 * Plain-language definitions shown in the info-icon tooltip next to each of the
 * 17 indicators / items. Display layer only — no scoring, bands, direction, or
 * NIS2 article references. Keyed by internal ID.
 */

export const INDICATOR_INFO = {
  // Layer 1 — scored
  'IH-06': 'Average time from when an incident begins to when the organisation confirms it.',
  'IH-07': 'Average time from confirming an incident to taking the first meaningful response action.',
  'IH-08': 'Average time from confirming an incident to isolating it at a network or zone boundary.',
  'BC-01': 'Share of network segments that stayed operational during a disruption.',
  'BC-02': 'Share of defined OT zones that kept performing their intended function during a disruption.',
  'BC-04': 'Share of critical parameters that breached their operating limits during a disruption.',
  'BC-08': 'Share of recovery events that met the defined recovery-time objective.',
  'BC-09': 'Share of restored items whose recovery point met the defined objective.',

  // Layer 0A — prerequisites
  'L0-asset-inventory': 'Whether the organisation keeps a current inventory of its OT assets.',
  'L0-risk-assessment': 'Whether each OT zone has a risk assessment within the defined review cycle.',
  'L0-interdependency': 'Whether dependencies between critical OT assets and zones are documented.',
  'L0-it-ot-boundary': 'Whether a demilitarised zone separates the IT and OT networks.',
  'L0-multi-homed': 'Whether any device connects across two OT zones in a way that bypasses segmentation.',
  'L0-bc-plan-doc': 'Whether a business continuity plan exists and covers the critical OT processes.',

  // Layer 0B — process evidence
  'RM-04': 'Share of identified vulnerabilities that have been remediated or formally accepted.',
  'RM-05': 'Average time from identifying a vulnerability to remediating or formally accepting it.',
  'L0-bc-plan-tested': 'Whether the business continuity plan has been exercised within the defined period.',
};
