import { useState, useMemo } from 'react';
import { IH_INDICATOR_IDS, BC_INDICATOR_IDS } from './data/indicatorDefinitions.js';
import { computeAssessment, createBlankAssessment } from './engine/scoring.js';
import { computeLayer0, createBlankLayer0 } from './engine/layer0.js';
import { computePriorityView } from './engine/priorityView.js';
import { computeCrossIndicator } from './engine/crossIndicator.js';
import { computePairFindings } from './data/pairFindings.js';
import { computeGapAnalysis, computeProjection } from './engine/projection.js';
import { serializeAssessment, parseAndValidateImport } from './engine/persistence.js';
import MeasureCard from './components/MeasureCard.jsx';
import OverallPanel from './components/OverallPanel.jsx';
import Layer0ReferenceView from './components/Layer0ReferenceView.jsx';
import Layer0ActionPanel from './components/Layer0ActionPanel.jsx';
import PriorityView from './components/PriorityView.jsx';
import CrossIndicatorPanel from './components/CrossIndicatorPanel.jsx';
import GapProjectionPanel from './components/GapProjectionPanel.jsx';
import TimelineView from './components/TimelineView.jsx';
import NarrativePanel from './components/NarrativePanel.jsx';
import { useNarrative } from './hooks/useNarrative.js';
import { DEFAULT_MODEL } from './report/generate.js';

function App() {
  const [assessment, setAssessment] = useState(() => ({
    ...createBlankAssessment(),
    layer0: createBlankLayer0(),
  }));
  const [clientId, setClientId] = useState('');
  const [assessmentDate, setAssessmentDate] = useState('');
  const [targets, setTargets] = useState({});   // projection target selections: { indicatorId: targetScore }
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'compare'

  // Layer 1 and Layer 0 engines are called independently; neither reads the other's data
  const results = useMemo(
    () => computeAssessment({ ...assessment, meta: { clientId, assessmentDate } }),
    [assessment, clientId, assessmentDate]
  );

  const layer0Result = useMemo(
    () => computeLayer0(assessment),
    [assessment]
  );

  // Priority view (F) reads the resolved outputs of both engines; recomputes nothing of theirs
  const priorityResult = useMemo(
    () => computePriorityView(assessment, results, layer0Result),
    [assessment, results, layer0Result]
  );

  // Gap analysis + projection (Stage 4). Projection math stays in the engine;
  // the UI only collects target selections (`targets`) and renders the result.
  const gapResult = useMemo(
    () => computeGapAnalysis(assessment, results),
    [assessment, results]
  );
  const projectionResult = useMemo(
    () => computeProjection(assessment, results, { targets }),
    [assessment, results, targets]
  );

  // Cross-indicator advisories (Rules A/B/C/D); advisory only, alters no score
  const cross = useMemo(
    () => computeCrossIndicator(assessment, results, layer0Result),
    [assessment, results, layer0Result]
  );

  // AI-drafted narrative (Step 5): the snapshot the report is generated from;
  // a draft is stale once the assessment no longer matches its snapshot.
  const narrative = useNarrative();
  const narrativeSnapshot = useMemo(
    () => ({ meta: { clientId, assessmentDate }, indicators: assessment.indicators, layer0: assessment.layer0 }),
    [clientId, assessmentDate, assessment]
  );
  const narrativeStale = narrative.phase === 'done' && narrative.snapshot !== JSON.stringify(narrativeSnapshot);

  // Rule A notes grouped by target indicator; Rule D hints keyed by target indicator
  const aNotesByIndicator = useMemo(() => {
    const map = {};
    for (const note of cross.ihDependencyNotes) {
      (map[note.target] ??= []).push(note);
    }
    return map;
  }, [cross]);

  const dHintByIndicator = useMemo(() => {
    const map = {};
    for (const h of cross.bcPlanHints) map[h.targetIndicatorId] = h;
    return map;
  }, [cross]);

  // Rule B relative-comparison findings (display-layer; reads engine outputs)
  const pairFindings = useMemo(
    () => computePairFindings(results, layer0Result, assessment),
    [results, layer0Result, assessment]
  );

  // Which Rule B pair members have data (drives the graceful pairs-scaffold empty state)
  const membersWithData = useMemo(() => {
    const s = [];
    for (const id of [...IH_INDICATOR_IDS, ...BC_INDICATOR_IDS]) {
      if (assessment.indicators[id]?.state != null) s.push(id);
    }
    if (BC_INDICATOR_IDS.some(id => assessment.indicators[id]?.state != null)) s.push('BC');
    for (const id of ['RM-04', 'RM-05']) {
      if (assessment.layer0[id]?.state != null) s.push(id);
    }
    return s;
  }, [assessment]);

  function handleIndicatorChange(id, newInput) {
    setAssessment(prev => ({
      ...prev,
      indicators: { ...prev.indicators, [id]: newInput },
    }));
  }

  function handleLayer0Change(id, newInput) {
    setAssessment(prev => ({
      ...prev,
      layer0: { ...prev.layer0, [id]: newInput },
    }));
  }

  // Clearing a target (score === null) DELETES the key so the baseline is genuinely
  // restored — no stale entry left behind.
  function handleTargetChange(id, score) {
    setTargets(prev => {
      if (score === null) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: score };
    });
  }

  function handleReset() {
    if (window.confirm('Reset all inputs?')) {
      setAssessment({ ...createBlankAssessment(), layer0: createBlankLayer0() });
      setClientId('');
      setAssessmentDate('');
      setTargets({});
    }
  }

  // ── Persistence (Stage 5-i): file export / import; thin DOM I/O only ────────
  function handleExport() {
    const { json, filename } = serializeAssessment({
      clientId, assessmentDate,
      indicators: assessment.indicators,
      layer0: assessment.layer0,
      targets,
      results,   // derived snapshot only — non-authoritative, ignored on import
    });
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';   // allow re-importing the same file later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = parseAndValidateImport(String(reader.result));
      if (!res.ok) {
        window.alert(`Import failed: ${res.error}`);
        return;   // no state change on failure — no partial load
      }
      if (!window.confirm('Loading will replace the current assessment. Continue?')) return;
      setClientId(res.data.clientId);
      setAssessmentDate(res.data.assessmentDate);
      setAssessment({
        meta: { clientId: res.data.clientId, assessmentDate: res.data.assessmentDate },
        indicators: res.data.indicators,
        layer0: res.data.layer0,
      });
      setTargets(res.data.targets);
      if (res.warnings.length > 0) window.alert(`Loaded with warnings:\n${res.warnings.join('\n')}`);
    };
    reader.onerror = () => window.alert('Import failed: could not read the file.');
    reader.readAsText(file);
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f3f4f6',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
    }}>
      <header style={{
        backgroundColor: '#0f2d52',
        color: '#fff',
        padding: '14px 24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '17px', letterSpacing: '0.01em' }}>
            NIS2 OT Effectiveness Dashboard
          </div>
          <div style={{ fontSize: '11px', opacity: 0.65, marginTop: '2px' }}>
            University of Twente · CGI Netherlands · Stage 1 — Scoring Core
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {(() => {
            const btn = {
              padding: '6px 14px', fontSize: '12px', backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.4)', color: '#fff',
              borderRadius: '4px', cursor: 'pointer',
            };
            const activeBtn = { ...btn, backgroundColor: 'rgba(255,255,255,0.18)', fontWeight: 700 };
            return (
              <>
                <button onClick={() => setView('dashboard')} style={view === 'dashboard' ? activeBtn : btn}>Dashboard</button>
                <button onClick={() => setView('compare')} style={view === 'compare' ? activeBtn : btn}>Compare</button>
                <span style={{ width: '1px', alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.25)', margin: '0 2px' }} />
                <button onClick={handleExport} style={btn}>Export</button>
                <label style={{ ...btn, display: 'inline-block' }}>
                  Import
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportFile}
                    style={{ display: 'none' }}
                  />
                </label>
                <button onClick={handleReset} style={btn}>Reset</button>
              </>
            );
          })()}
        </div>
      </header>

      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px 16px' }}>
        {view === 'compare' && <TimelineView />}
        {view === 'dashboard' && (
        <>
        <div style={{
          backgroundColor: '#fff',
          border: '1px solid #d1d5db',
          borderRadius: '8px',
          padding: '14px 16px',
          marginBottom: '16px',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              Client identifier
            </label>
            <input
              type="text"
              placeholder="e.g. Client A"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              style={{
                width: '100%', padding: '6px 10px',
                border: '1px solid #d1d5db', borderRadius: '4px',
                fontSize: '13px', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>
              Assessment date
            </label>
            <input
              type="date"
              value={assessmentDate}
              onChange={e => setAssessmentDate(e.target.value)}
              style={{
                width: '100%', padding: '6px 10px',
                border: '1px solid #d1d5db', borderRadius: '4px',
                fontSize: '13px', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <OverallPanel
            ih={results.ih}
            bc={results.bc}
            overall={results.overall}
            indicatorResults={results.indicators}
          />
        </div>

        {/* Layer 0 — Foundation Status */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px', marginBottom: '16px' }}>
          <Layer0ReferenceView
            layer0Result={layer0Result}
            inputs={assessment.layer0}
            onItemChange={handleLayer0Change}
          />
          <Layer0ActionPanel actionFlags={layer0Result.actionFlags} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <MeasureCard
            title="Incident Handling"
            subtitle="Mean Time to Detect · Respond · Contain — NIS2 Art. 21(2)(b)"
            indicatorIds={IH_INDICATOR_IDS}
            inputs={assessment.indicators}
            results={results.indicators}
            dimensionResult={results.ih}
            onIndicatorChange={handleIndicatorChange}
            aNotesByIndicator={aNotesByIndicator}
            dHintByIndicator={dHintByIndicator}
          />
          <MeasureCard
            title="Business Continuity"
            subtitle="Network Operability · Zone Availability · Threshold Violation · RTO · RPO — NIS2 Art. 21(2)(c)"
            indicatorIds={BC_INDICATOR_IDS}
            inputs={assessment.indicators}
            results={results.indicators}
            dimensionResult={results.bc}
            onIndicatorChange={handleIndicatorChange}
            aNotesByIndicator={aNotesByIndicator}
            dHintByIndicator={dHintByIndicator}
          />
        </div>

        {/* Cross-Indicator Interpretation (Rules B + C) */}
        <div style={{ marginTop: '20px' }}>
          <CrossIndicatorPanel
            interpretivePairs={cross.interpretivePairs}
            architectureAdvisories={cross.architectureAdvisories}
            membersWithData={membersWithData}
            pairFindings={pairFindings}
          />
        </div>

        {/* Layer 1 Priority View (F) */}
        <div style={{ marginTop: '20px' }}>
          <PriorityView priorityResult={priorityResult} />
        </div>

        {/* Gap Analysis & Projection (Stage 4) */}
        <div style={{ marginTop: '20px' }}>
          <GapProjectionPanel
            gapResult={gapResult}
            projectionResult={projectionResult}
            onTargetChange={handleTargetChange}
          />
        </div>

        {/* AI-drafted narrative report (Step 5) */}
        <div style={{ marginTop: '20px' }}>
          <NarrativePanel
            phase={narrative.phase}
            attempt={narrative.attempt}
            maxAttempts={narrative.maxAttempts}
            result={narrative.result}
            model={DEFAULT_MODEL}
            stale={narrativeStale}
            onGenerate={() => narrative.generate(narrativeSnapshot)}
            onCancel={narrative.cancel}
          />
        </div>
        </>
        )}
      </main>
    </div>
  );
}

export default App;
