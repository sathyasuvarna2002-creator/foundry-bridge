/********************************************************************
 * TEMPORAL EVIDENCE ENGINE - n8n Code Node
 *
 * Simplified architecture: receives pre-fetched temporal data from HTTP node
 * and performs reasoning to produce temporal evidence for neuro-symbolic calibration.
 *
 * Input: Foundry Validation (Node 10) + Temporal Data (Node 11 HTTP)
 * Output: Temporal evidence metrics and confidence classification
 *
 * This node has a single, well-defined responsibility:
 * Transform temporal/historical data into evidence that feeds confidence calibration.
 *
 * FIX (this revision): calculateGovernanceStability() previously computed
 * avgDaysBetweenTxs as windowDays / (governanceTxs.length - 1). With
 * exactly 2 governance transactions this always collapses to windowDays
 * itself, regardless of how the events are actually spaced -- meaning "2
 * governance events" and "0 governance events" produced the identical
 * stability label. Combined with a 180-day MODERATE threshold, any
 * protocol observed over a window shorter than 180 days with sparse
 * governance activity was unconditionally classified HIGHLY_DYNAMIC,
 * which then drags stabilityFactor down to 0.4 (lowest tier, 30% weight
 * in temporal_evidence_strength) -- actively penalizing protocols with
 * LOW governance activity, the opposite of the intended signal.
 * Fixed by: requiring >=3 governance transactions before computing a
 * real average gap (from actual consecutive-transaction spacing, not
 * windowDays / (count-1)), and returning INSUFFICIENT_DATA rather than
 * forcing a label from too little data. calculateTemporalEvidence()
 * updated to treat INSUFFICIENT_DATA as a neutral 0.7 factor, same as
 * MODERATE, rather than defaulting into the penalizing 0.4 branch.
 */
// ============================================================================
// SYMBOLIC CONSTANTS
// ============================================================================
const ARCHITECTURAL_CRITICALITY = {
  IMPLEMENTATION: 0.40,
  GOVERNANCE: 0.30,
  POLICY_ENGINE: 0.20,
  ECONOMIC_MODEL: 0.10
};
const DRIFT_IMPORTANCE = {
  IMPLEMENTATION: 0.35,
  GOVERNANCE: 0.25,
  POLICY_ENGINE: 0.25,
  ECONOMIC_MODEL: 0.15
};
const TEMPORAL_EVIDENCE_MODEL = {
  CHANGE_PROFILE: 0.30,
  DRIFT: 0.40,
  STABILITY: 0.30
};
const TEMPORAL_CONFIDENCE_THRESHOLD = {
  HIGH: 0.80,
  MEDIUM: 0.60,
  LOW: 0.0
};
// ============================================================================
// INPUT EXTRACTION
// ============================================================================
const foundry = $("10_Foundry_Validation").first().json;
const temporal = $("11_Temporal_Data").first().json;

// analysisAddress MUST match whatever address 11_Temporal_Data actually fetched
// transaction history for (the market/token contract itself -- e.g. cUSDC for
// Compound). foundry.contractAddress is that address (camelCase -- the real
// field name in the Foundry Validation output; the old snake_case
// `foundry.contract_address` never existed on this object and was silently
// always undefined).
const analysisAddress = foundry.contractAddress || foundry.contract_address;

// Separate, explicitly-labeled governance/policy-controller address (Comptroller
// for Compound, PoolAddressesProvider for Aave, etc). This is NOT the contract
// whose transaction history was analyzed -- it's kept only as extra context.
// Previously this was wrongly given priority and mislabeled as the analysis
// target via `analysisAddress = foundry.comptroller || ... `.
const governanceAddress =
    foundry.comptroller ||
    foundry.poolAddressesProvider ||
    foundry.proxy ||
    null;

const network =
    foundry.chainId === 56 ? "bsc" : "ethereum";
const protocol = foundry.protocolName || "Unknown";
if (!analysisAddress) {
  return [{json: {error: 'No contract address provided from Foundry'}}];
}
const txs = Array.isArray(temporal.result)
    ? temporal.result
    : [];
if (txs.length === 0) {
  return [{json: {error: 'No temporal data available from HTTP fetch'}}];
}
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function timestampToDate(timestamp) {
  if (!timestamp) return null;
  const date = new Date(parseInt(timestamp) * 1000);
  return date.toISOString().split('T')[0];
}
function calculateDaysSince(dateString) {
  if (!dateString) return null;
  const date = new Date(dateString);
  const now = new Date();
  const days = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  return days;
}
function isGovernanceTransaction(tx) {
  const fn = (tx.functionName || "").toLowerCase();
  return (
    fn.includes("setpendingadmin") ||
    fn.includes("acceptadmin") ||
    fn.includes("setpendingimplementation") ||
    fn.includes("acceptimplementation") ||
    fn.includes("upgrade") ||
    fn.includes("timelock") ||
    fn.includes("transferownership")
  );
}
// ============================================================================
// BUILD TIMELINE
// ============================================================================
function buildTimeline() {
  const timeline = [];

  for (const tx of txs) {
    timeline.push({
      date: timestampToDate(tx.timeStamp),
      block: tx.blockNumber,
      txHash: tx.hash,
      functionName: tx.functionName,
      input: tx.input,
      isError: tx.isError,
      event: tx.functionName || "Transaction",
      change: tx.functionName || "Unknown"
    });
  }

  timeline.sort((a, b) => Number(a.block) - Number(b.block));

  return timeline;
}
// ============================================================================
// CALCULATE ARCHITECTURAL CHANGE PROFILE
// ============================================================================
function calculateArchitecturalChangeProfile(timeline, windowDays) {
  if (!timeline || timeline.length < 2) {
    return {
      change_score: 0,
      change_level: 'UNKNOWN',
      transactions_per_day: 0,
      description: 'Insufficient transaction history'
    };
  }

  const governanceTxs = timeline.filter(tx => isGovernanceTransaction(tx));

  const txsPerDay = windowDays > 0 ? governanceTxs.length / windowDays : 0;
  const changeScore = Math.min(txsPerDay / 0.5, 1.0);

  let changeLevel = 'LOW';
  if (changeScore >= 0.3 && changeScore < 0.6) changeLevel = 'MEDIUM';
  else if (changeScore >= 0.6) changeLevel = 'HIGH';

  return {
    change_score: Math.round(changeScore * 100) / 100,
    change_level: changeLevel,
    transactions_per_day: Math.round(txsPerDay * 100) / 100,
    governance_transactions: governanceTxs.length,
    description: `${changeLevel} architectural activity: ${governanceTxs.length} governance transactions over ${windowDays} day observation window`
  };
}
// ============================================================================
// CALCULATE GOVERNANCE STABILITY - FIX 1 (original), FIX 3 (this revision)
// Measures governance transaction frequency, not all protocol usage.
//
// FIX 3: avgDaysBetweenTxs now requires >=3 governance transactions and is
// computed from actual gaps between consecutive transaction dates, not
// windowDays / (count - 1) -- which degenerated to "the whole window
// length" whenever there were exactly 0, 1, or 2 events, making the
// resulting HIGHLY_DYNAMIC/MODERATE/STABLE label meaningless for sparse
// governance activity (the common case for a healthy, low-churn protocol
// observed over a period shorter than the 180-day threshold).
// ============================================================================
function calculateGovernanceStability(timeline) {
  if (!timeline || timeline.length < 2) {
    return {
      stability_index: 'UNKNOWN',
      avg_days_between_governance_txs: null,
      governance_change_density: 0,
      governance_transactions: 0,
      description: 'Insufficient governance transaction history'
    };
  }

  const governanceTxs = timeline.filter(tx => isGovernanceTransaction(tx));

  const windowDays = timeline.length > 1
    ? (new Date(timeline[timeline.length - 1].date) - new Date(timeline[0].date)) / (1000 * 60 * 60 * 24)
    : 1;

  let stabilityIndex;
  let avgDaysBetweenTxs;

  if (governanceTxs.length < 3) {
    // Fewer than 3 events can't support a meaningful "average gap"
    // between events -- don't force a HIGHLY_DYNAMIC/MODERATE/STABLE
    // label out of statistical noise. Zero governance transactions is
    // still a genuine STABLE signal; 1-2 events is genuinely
    // insufficient data to characterise spacing.
    stabilityIndex = governanceTxs.length === 0 ? 'STABLE' : 'INSUFFICIENT_DATA';
    avgDaysBetweenTxs = governanceTxs.length > 0 ? windowDays : null;
  } else {
    // Real average gap between consecutive governance transactions,
    // computed from actual sorted event dates -- not
    // windowDays / (count - 1), which only reflects the window length,
    // not how the events are actually distributed within it.
    const sortedDates = governanceTxs
      .map(tx => new Date(tx.date).getTime())
      .sort((a, b) => a - b);

    let totalGap = 0;
    for (let i = 1; i < sortedDates.length; i++) {
      totalGap += (sortedDates[i] - sortedDates[i - 1]) / (1000 * 60 * 60 * 24);
    }
    avgDaysBetweenTxs = totalGap / (sortedDates.length - 1);

    if (avgDaysBetweenTxs >= 180 && avgDaysBetweenTxs < 365) {
      stabilityIndex = 'MODERATE';
    } else if (avgDaysBetweenTxs < 180) {
      stabilityIndex = 'HIGHLY_DYNAMIC';
    } else {
      stabilityIndex = 'STABLE';
    }
  }

  const governanceChangeDensity = windowDays > 0
    ? (governanceTxs.length / windowDays) * 365
    : 0;

  return {
    stability_index: stabilityIndex,
    avg_days_between_governance_txs: avgDaysBetweenTxs !== null ? Math.round(avgDaysBetweenTxs) : null,
    governance_change_density: Math.round(governanceChangeDensity * 100) / 100,
    governance_transactions: governanceTxs.length,
    description: `${stabilityIndex.toLowerCase()} governance: ${governanceTxs.length} governance transactions, avg ${avgDaysBetweenTxs !== null ? Math.round(avgDaysBetweenTxs) : 'N/A'} days between governance events`
  };
}
// ============================================================================
// CALCULATE ARCHITECTURAL DRIFT - FIX 2
// Compares activity in first half of observation period vs second half
// ============================================================================
function calculateArchitecturalDrift(timeline) {
  if (!timeline || timeline.length < 2) {
    return {
      drift_score: 0,
      drift_level: 'MINIMAL',
      description: 'Insufficient data for drift calculation'
    };
  }

  const start = new Date(timeline[0].date);
  const end = new Date(timeline[timeline.length - 1].date);

  const midpointTime = start.getTime() + ((end.getTime() - start.getTime()) / 2);

  const historicalTxs = timeline.filter(tx =>
    new Date(tx.date).getTime() < midpointTime
  );

  const recentTxs = timeline.filter(tx =>
    new Date(tx.date).getTime() >= midpointTime
  );

  const historicalRate = historicalTxs.length;
  const recentRate = recentTxs.length;

  const denominator = historicalRate === 0 ? 1 : historicalRate;
  const rateChange = Math.abs(recentRate - historicalRate) / denominator;
  const driftScore = Math.min(rateChange, 1.0);

  let driftLevel = 'MINIMAL';
  if (driftScore >= 0.2 && driftScore < 0.5) driftLevel = 'MODERATE';
  else if (driftScore >= 0.5) driftLevel = 'SIGNIFICANT';

  const trend = recentRate > historicalRate ? 'accelerating' : 'decelerating';

  return {
    drift_score: Math.round(driftScore * 100) / 100,
    drift_level: driftLevel,
    historical_transactions: historicalTxs.length,
    recent_transactions: recentTxs.length,
    trend: trend,
    description: `${driftLevel.toLowerCase()} drift: activity is ${trend} (${historicalTxs.length} transactions in first half vs ${recentTxs.length} in second half of observation window)`
  };
}
// ============================================================================
// CALCULATE TEMPORAL EVIDENCE
//
// FIX 3 (continued): stabilityFactor now handles INSUFFICIENT_DATA as a
// neutral 0.7 (same tier as MODERATE) rather than falling through to the
// penalizing 0.4 branch, which previously applied to both genuinely
// volatile governance AND simply-unmeasurable governance alike.
// ============================================================================
function calculateTemporalEvidence(changeProfile, drift, stability) {
  const changeProfileFactor = Math.max(0, Math.min(1, 1 - changeProfile.change_score));
  const driftFactor = Math.max(0, Math.min(1, 1 - drift.drift_score));
  const stabilityFactor =
    stability.stability_index === "STABLE" ? 1.0
    : (stability.stability_index === "MODERATE" || stability.stability_index === "INSUFFICIENT_DATA") ? 0.7
    : 0.4;
  const temporalEvidence =
    changeProfileFactor * TEMPORAL_EVIDENCE_MODEL.CHANGE_PROFILE +
    driftFactor * TEMPORAL_EVIDENCE_MODEL.DRIFT +
    stabilityFactor * TEMPORAL_EVIDENCE_MODEL.STABILITY;
  return {
    temporal_evidence_strength: Math.round(temporalEvidence * 100) / 100,
    evidence_breakdown: {
      architectural_change_profile: Math.round(changeProfileFactor * 100) / 100,
      architectural_drift: Math.round(driftFactor * 100) / 100,
      governance_stability: Math.round(stabilityFactor * 100) / 100
    }
  };
}
// ============================================================================
// CLASSIFY TEMPORAL CONFIDENCE
// ============================================================================
function classifyTemporalConfidence(temporalEvidence) {
  if (temporalEvidence >= TEMPORAL_CONFIDENCE_THRESHOLD.HIGH) {
    return 'HIGH';
  } else if (temporalEvidence >= TEMPORAL_CONFIDENCE_THRESHOLD.MEDIUM) {
    return 'MEDIUM';
  } else {
    return 'LOW';
  }
}
// ============================================================================
// CALCULATE OVERALL METRICS - ANALYSIS WINDOW FOCUSED
// ============================================================================
function calculateMetrics(timeline) {
  if (!timeline || timeline.length === 0) {
    return {
      analysis_window_start: null,
      analysis_window_end: null,
      analysis_window_days: 0,
      transactions_analyzed: 0,
      last_activity: null,
      days_since_last_activity: null
    };
  }

  const firstTx = timeline[0];
  const lastTx = timeline[timeline.length - 1];

  const windowMs = new Date(lastTx.date) - new Date(firstTx.date);
  const windowDays = Math.round(windowMs / (1000 * 60 * 60 * 24));

  return {
    analysis_window_start: firstTx.date,
    analysis_window_end: lastTx.date,
    analysis_window_days: windowDays,
    transactions_analyzed: timeline.length,
    last_activity: lastTx.date,
    days_since_last_activity: calculateDaysSince(lastTx.date)
  };
}
// ============================================================================
// MAIN EXECUTION
// ============================================================================
async function main() {
  try {
    console.log(`[Temporal Evidence Engine] Analyzing ${protocol} (${analysisAddress}) on ${network} [governance contract: ${governanceAddress || "n/a"}]...`);

    const timeline = buildTimeline();
    console.log(`[Temporal Evidence Engine] Processed ${timeline.length} transactions`);

    if (!timeline || timeline.length === 0) {
      return [{
        json: {
          temporal_evidence: {
            evidence_source: "Blockchain Transaction History",
            protocol: protocol,
            network: network,
            validated_contract: analysisAddress,
            analysis_contract: analysisAddress,
            governance_contract: governanceAddress,
            error: 'No transaction history available',
            temporal_evidence_strength: null,
            temporal_confidence: null,
            generated_at: new Date().toISOString()
          }
        }
      }];
    }

    const metrics = calculateMetrics(timeline);
    const changeProfile = calculateArchitecturalChangeProfile(timeline, metrics.analysis_window_days);
    const stability = calculateGovernanceStability(timeline);
    const drift = calculateArchitecturalDrift(timeline);
    const temporalEvidence = calculateTemporalEvidence(changeProfile, drift, stability);
    const temporalConfidence = classifyTemporalConfidence(temporalEvidence.temporal_evidence_strength);

    return [{
      json: {
        temporal_evidence: {
          evidence_source: "Blockchain Transaction History",
          protocol: protocol,
          network: network,
          validated_contract: analysisAddress,
          analysis_contract: analysisAddress,
          governance_contract: governanceAddress,
          metrics: metrics,
          architectural_change_profile: changeProfile,
          stability: stability,
          drift: drift,
          temporal_evidence_strength: temporalEvidence.temporal_evidence_strength,
          evidence_breakdown: temporalEvidence.evidence_breakdown,
          temporal_confidence: temporalConfidence,
          summary: {
            analysis_window_days: metrics.analysis_window_days,
            transactions_analyzed: metrics.transactions_analyzed,
            architectural_change_profile_level: changeProfile.change_level,
            stability_index: stability.stability_index,
            drift_level: drift.drift_level,
            temporal_evidence_strength: temporalEvidence.temporal_evidence_strength,
            confidence: temporalConfidence
          },
          interpretation: `Analysis of the most recent ${metrics.transactions_analyzed} on-chain transactions (${metrics.analysis_window_days} day observation window) indicates ${changeProfile.change_level.toLowerCase()} architectural activity, ${stability.stability_index.toLowerCase()} governance stability, and ${drift.drift_level.toLowerCase()} architectural drift. Temporal evidence contributes ${temporalConfidence.toLowerCase()} confidence to the neuro-symbolic assessment.${governanceAddress && governanceAddress.toLowerCase() !== analysisAddress.toLowerCase() ? ` Note: transaction history was analyzed for ${analysisAddress} (the validated market/token contract); the separately-tracked governance/policy contract is ${governanceAddress}.` : ''}`,
          generated_at: new Date().toISOString()
        }
      }
    }];

  } catch (error) {
    console.error(`[Temporal Evidence Engine] Error: ${error.message}`);
    return [{
      json: {
        error: error.message,
        temporal_evidence: null
      }
    }];
  }
}
// Execute
return main();