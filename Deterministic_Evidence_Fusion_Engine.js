// ================================================================
// DETERMINISTIC EVIDENCE FUSION ENGINE - INSTITUTIONAL GRADE
// Research-prototype quality evidence fusion for investment committees
// ================================================================
//
// FIXES (this revision):
// 1. foundry.flashLoansSupported -> foundry.flashLoanSupported. The real
//    schema (ValidationResult.sol, and every actual /validate output)
//    uses the singular "Loan". The plural typo meant this field was
//    always undefined/falsy regardless of the real value -- flash loan
//    evidence never actually got read correctly.
// 2. validated_properties is now built conditionally from actual
//    evidence instead of being a static, always-true array. The
//    previous version unconditionally claimed "Flash Loan Capability
//    Confirmed" and "Contract Deployment Confirmed" even when those
//    were false -- a factually incorrect claim landing in an
//    institutional/investment-committee-facing report.
// 3. sourcesExpected changed from a hardcoded 5 to 4, matching what is
//    actually evaluated at this pre-audit fusion stage (runtime,
//    architecture, historical, temporal -- audit is explicitly
//    deferred, per this node's own fusion_reasoning text and
//    sources_pending: ["AUDIT"]). Previously support_ratio was capped
//    at a maximum of 0.8 even when all 4 real sources fully agreed.
//    metadata.sources_evaluated is now derived from sourcesAvailable
//    (the actual count of sources that returned usable evidence) rather
//    than a separate hardcoded literal "4" that could silently diverge
//    from reality (e.g. when temporal evidence was unavailable).
// 4. institutional_readiness.ready_for_audit,
//    institutional_readiness.ready_for_final_assessment, and the
//    top-level institutional_assessment_ready were previously static
//    literals (true / false / true) -- never derived from any actual
//    evidence, confidence score, or pending-source state. That's why
//    institutional_assessment_ready (hardcoded true) and
//    ready_for_final_assessment (hardcoded false) could read as
//    contradictory: neither one meant anything relative to real
//    evidence, they just happened to be set to opposite constants.
//    Now: ready_for_audit requires runtime validation to have
//    succeeded AND at least one other evidence source (architecture /
//    historical / temporal) to have returned usable confidence.
//    ready_for_final_assessment is computed from sources_pending, so it
//    is only ever true once nothing (including the audit stage) is
//    still outstanding -- by this node's own design that is always
//    false at this pre-audit stage, but it is now genuinely computed
//    rather than coincidentally hardcoded to the right-looking value.
//    The top-level institutional_assessment_ready is kept for backward
//    compatibility with any downstream node reading it directly, but is
//    now an explicit alias of ready_for_audit instead of an
//    independent hardcoded literal.
// 5. CORRECTED after checking the actual Solidity validators (initial
//    version of this fix was wrong): flashLoanSupported is declared
//    once in the shared ValidationResult.sol struct, defaulting to
//    Solidity's bool zero-value false. Only AaveValidator.sol ever
//    actively determines it (a real try/catch on
//    FLASHLOAN_PREMIUM_TOTAL()) -- VenusValidator.sol and
//    CompoundValidator.sol never touch the field at all, so their
//    false is an unset default, not a verified answer. A JSON bool can
//    never be "undefined", so there is no way to tell "actively
//    verified false" from "defaulted false" from the payload alone --
//    an earlier version of this fix claimed flashLoanSupported: false
//    was always "explicitly checked... verified, not merely
//    unreported", which only read correctly for Compound by
//    coincidence (Compound V2 genuinely has no flash loans), not
//    because the validator actually checked. Reverted to language that
//    does not claim verification either way -- "detected" / "no
//    ... detected via the runtime interface" -- which is accurate for
//    all three protocols regardless of which validator actually
//    performs the check. validated_properties no longer claims a
//    "Confirmed Absent" property for the same reason: absence was
//    never actually confirmed for Venus or Compound, only defaulted.
//    A real fix requires an explicit flashLoanChecked field added to
//    ValidationResult.sol / each validator (Solidity-layer change,
//    out of scope for this file).
// 6. historicalConfidence previously averaged item.confidence across ALL
//    historical assessments, including entries where the Historical
//    Intelligence Agent explicitly returned precedent_found: false
//    (correctly declining to force a weak match -- exactly the behaviour
//    its prompt is designed to reward). Averaging those in as
//    confidence-0 data points penalized the agent for being
//    appropriately conservative and materially understated real
//    historical support -- confirmed on real Compound data, where 4
//    genuine precedent matches averaging 0.85 were dragged down to 0.57
//    by 2 no-precedent zeros, flipping the reported support tier from
//    SUPPORTED to LOW_CONFIDENCE and pulling deterministic_confidence
//    down by roughly 0.05. Fixed by averaging only over assessments
//    where precedent_found === true; the no-precedent count is now
//    reported separately in the evidence/reasoning text instead of
//    being silently folded into the confidence number. Also checked
//    against real Aave data (1 no-precedent case of 11, scored 0.3, not
//    0) -- same dilution mechanism, much smaller effect there, which is
//    why it went unnoticed until Compound's higher no-precedent
//    proportion and zero-scoring made it visible.
// 7. Three additional self-consistency fixes found on review, none of
//    which change deterministic_confidence, but all of which could make
//    an institutional-grade report internally contradict itself:
//    a) runtime_validation_status was hardcoded "SUCCESS" regardless of
//       contractExists, while evidence_fusion.runtime and
//       institutional_readiness were correctly conditional -- a
//       contract that failed to be located on-chain would still show
//       top-level "SUCCESS" next to "runtime: FAILED" and
//       "ready_for_audit: false". Now contractExists ? "SUCCESS" : "FAILED".
//    b) metadata.confidence_calculation.historical_samples_averaged
//       reported historicalAssessments.length (the full assessment
//       count) even after FIX 6 changed the actual averaging to only
//       use historicalAssessmentsWithPrecedent -- so this field
//       overstated its own sample size. Now reports the true averaged
//       count, with historical_samples_assessed and
//       historical_no_precedent_count added alongside so the full
//       picture (assessed vs. averaged vs. excluded) stays visible.
//    c) sourcesAvailableList (which drives metadata.sources_evaluated)
//       unconditionally included "RUNTIME" regardless of contractExists,
//       while the separate sourcesAvailable counter (which drives
//       evidence_quality.sources_available) only counted it when
//       contractExists was true -- the two counts could silently
//       disagree by one whenever a contract wasn't found on-chain.
//       "RUNTIME" is now conditional on contractExists in both places.
//    Also aligned historicalSupport's SUPPORTED threshold from 0.75 to
//    0.80 to match the threshold already used in evidenceSummary /
//    fusionReasoning text, so the enum and the prose can't disagree in
//    the 0.75-0.79 band.
// ================================================================
// Extract evidence from all sources
const foundry = $("10_Foundry_Validation").first().json || {};
const architecture = $("06_AI_Architecture_Reasoner").first().json || {};
const historical = $("09_AI_Historical_Exploit_Reasoner").first().json || {};
let temporal = null;
try {
  const temporalNode = $("12_Temporal_Evidence_Engine").first();
  if (temporalNode && temporalNode.json && temporalNode.json.temporal_evidence) {
    temporal = temporalNode.json.temporal_evidence;
  }
} catch (e) {
  // Temporal evidence not available
}
// ================================================================
// CONFIDENCE EXTRACTION
// ================================================================
const architectureConfidence = Number(
  architecture?.output?.contract_profile?.confidence ?? 0
);
const historicalAssessments =
  historical?.output?.historical_security_assessment ?? [];
// FIX 6: only average confidence over assessments where a precedent was
// actually found. A precedent_found: false entry is the agent correctly
// declining to force a weak match -- it should not be averaged in as a
// confidence-0 data point, which would penalize exactly the conservative
// behaviour the agent's prompt is designed to reward.
const historicalAssessmentsWithPrecedent = historicalAssessments.filter(
  item => item?.precedent_found === true
);
const historicalNoPrecedentCount =
  historicalAssessments.length - historicalAssessmentsWithPrecedent.length;
const historicalConfidence =
  historicalAssessmentsWithPrecedent.length > 0
    ? historicalAssessmentsWithPrecedent.reduce(
        (sum, item) => sum + (item.confidence || 0),
        0
      ) / historicalAssessmentsWithPrecedent.length
    : 0;
// Runtime validation
const listedMarkets = foundry.listedMarkets || 0;
const contractCodeSize = foundry.contractCodeSize || 0;
const exchangeRate = foundry.exchangeRate || 0;
const borrowIndex = foundry.borrowIndex || 0;
const totalBorrows = foundry.totalBorrows || 0;
const totalReserves = foundry.totalReserves || 0;
const cash = foundry.cash || 0;
const reserveFactorMantissa = foundry.reserveFactorMantissa || 0;
const contractExists = foundry.contractExists === true;
// FIX 1: singular "Loan", matching the real schema field name.
// FIX 5 (corrected): flashLoanRaw's false cannot be distinguished from
// "never checked, defaulted to false" at this layer -- see header note.
// Only treat true as a positive signal; false is reported as "not
// detected", never as a verified absence.
const flashLoanRaw = foundry.flashLoanSupported;
const flashLoanSupported = flashLoanRaw === true;
// Temporal confidence level
const temporalConfidenceLevel = temporal?.temporal_confidence || "UNKNOWN";
function getTemporalValue(level) {
  switch(level) {
    case "HIGH": return 1.0;
    case "MEDIUM": return 0.7;
    case "LOW": return 0.4;
    default: return 0;
  }
}
const temporalValue = getTemporalValue(temporalConfidenceLevel);
// ================================================================
// EVIDENCE SUMMARY
// ================================================================
const evidenceSummary = [];
// Foundry Runtime Evidence
if (contractExists) {
  evidenceSummary.push("Contract successfully deployed on-chain.");
} else {
  evidenceSummary.push("Contract could not be located on-chain.");
}
// FIX 5 (corrected): does not claim verified absence -- see header
// note on why "false" cannot be distinguished from "never checked"
// given the current Solidity validators.
if (flashLoanSupported) {
  evidenceSummary.push("Flash loan capability detected.");
} else {
  evidenceSummary.push("No flash loan capability detected via the available runtime interface.");
}
if (listedMarkets > 0) {
  evidenceSummary.push(`${listedMarkets} listed markets detected.`);
}
if (totalReserves > 0) {
  evidenceSummary.push(`Total reserves: ${totalReserves}.`);
}
if (contractCodeSize > 0) {
  evidenceSummary.push(`Runtime contract code size: ${contractCodeSize} bytes.`);
}
// Architecture Evidence
if (architectureConfidence >= 0.80) {
  evidenceSummary.push(
    `Architecture reconstruction successfully validated (confidence: ${(architectureConfidence * 100).toFixed(0)}%).`
  );
} else if (architectureConfidence > 0) {
  evidenceSummary.push(
    `Architecture reconstruction completed (confidence: ${(architectureConfidence * 100).toFixed(0)}%).`
  );
}
// Historical Evidence
// FIX 6: precedent count now reflects historicalAssessmentsWithPrecedent
// (the entries that actually matched something), not the full assessment
// count -- previously this text overstated how many real precedents were
// found by counting no-precedent entries as if they were precedents. The
// no-precedent count is reported separately instead of being dropped.
const noPrecedentNote = historicalNoPrecedentCount > 0
  ? ` (${historicalNoPrecedentCount} of ${historicalAssessments.length} assessed risk categories had no comparable historical precedent identified.)`
  : "";
if (historicalConfidence >= 0.80) {
  evidenceSummary.push(
    `Historical intelligence identified ${historicalAssessmentsWithPrecedent.length} comparable architectural precedents with an average confidence of ${(historicalConfidence * 100).toFixed(0)}%, partially corroborating the reconstructed architecture.${noPrecedentNote}`
  );
} else if (historicalConfidence > 0) {
  evidenceSummary.push(
    `Historical intelligence identified ${historicalAssessmentsWithPrecedent.length} architectural precedents with an average confidence of ${(historicalConfidence * 100).toFixed(0)}%, partially supporting the architectural assessment.${noPrecedentNote}`
  );
} else if (historicalAssessments.length > 0) {
  evidenceSummary.push(
    `Historical intelligence assessed ${historicalAssessments.length} architectural risk categories but identified no comparable historical precedent for any of them.`
  );
}
// Temporal Evidence
if (temporal) {
  const windowDays = temporal.summary?.analysis_window_days || "unknown";
  if (temporalConfidenceLevel === "HIGH") {
    evidenceSummary.push(
      `Temporal monitoring indicates stable architectural behaviour (window: ${windowDays} days).`
    );
  } else if (temporalConfidenceLevel === "MEDIUM") {
    evidenceSummary.push(
      `Temporal monitoring indicates moderate architectural evolution (window: ${windowDays} days).`
    );
  } else if (temporalConfidenceLevel === "LOW") {
    evidenceSummary.push(
      `Temporal monitoring suggests elevated architectural uncertainty (window: ${windowDays} days).`
    );
  } else {
    evidenceSummary.push(
      "Temporal evidence was unavailable during deterministic evidence fusion and therefore was excluded from confidence weighting."
    );
  }
} else {
  evidenceSummary.push(
    "Temporal evidence was unavailable during deterministic evidence fusion and therefore was excluded from confidence weighting."
  );
}
// ================================================================
// WEIGHTED CONFIDENCE CALCULATION
// ================================================================
let confidence = 0;
let totalWeight = 0;
if (contractExists) {
  confidence += 0.35;
  totalWeight += 0.35;
}
if (architectureConfidence > 0) {
  confidence += architectureConfidence * 0.30;
  totalWeight += 0.30;
}
if (historicalConfidence > 0) {
  confidence += historicalConfidence * 0.20;
  totalWeight += 0.20;
}
if (temporalValue > 0) {
  confidence += temporalValue * 0.15;
  totalWeight += 0.15;
}
// Normalize by total weight
const fusedConfidence = totalWeight > 0 ? confidence / totalWeight : 0;
const finalConfidence = Math.round(fusedConfidence * 100) / 100;
// ================================================================
// SUPPORTING EVIDENCE COUNT
// ================================================================
let sourcesAvailable = 0;
let sourcesSupporting = 0;
if (contractExists) {
  sourcesAvailable++;
  sourcesSupporting++;
}
if (architectureConfidence > 0) {
    sourcesAvailable++;
    sourcesSupporting++;
}
if (historicalConfidence > 0) {
    sourcesAvailable++;
    sourcesSupporting++;
}
if (temporal) {
    sourcesAvailable++;
    if (
        temporalConfidenceLevel !== "UNKNOWN"
    ) {
        sourcesSupporting++;
    }
}
// FIX 3: 4, not 5 -- audit is explicitly deferred to a later pipeline
// stage (sources_pending below), so only 4 sources can actually be
// evaluated here. Previously this was hardcoded to 5, which silently
// capped support_ratio at 0.8 even when all 4 real sources fully
// agreed, and diverged from metadata.sources_evaluated (also fixed
// below to derive from real data instead of its own separate literal).
const sourcesExpected = 4;
const supportRatio = sourcesSupporting / sourcesExpected;
let agreementLevel;
if (supportRatio >= 0.75) {
  agreementLevel = "HIGH";
} else if (supportRatio >= 0.50) {
  agreementLevel = "MODERATE";
} else {
  agreementLevel = "LOW";
}
// ================================================================
// CONTRADICTION DETECTION
// ================================================================
const contradictions = [];
if (contractExists && architectureConfidence > 0 && architectureConfidence < 0.40) {
  contradictions.push(
    "Runtime validation succeeded but architecture confidence is low (potential implementation risk)."
  );
}
if (temporalConfidenceLevel === "HIGH" && historicalConfidence > 0 && historicalConfidence < 0.40) {
  contradictions.push(
    "Temporal stability observed but historical intelligence suggests concerns (historical patterns may be evolving)."
  );
}
if (temporalConfidenceLevel === "LOW" && sourcesSupporting >= 2) {
  contradictions.push(
    "Multiple evidence sources support assessment but temporal monitoring is uncertain (recency or data scope limitations)."
  );
}
// ================================================================
// EVIDENCE QUALITY (Improved Structure)
// ================================================================
const evidenceQuality = {
  sources_expected: sourcesExpected,
  sources_available: sourcesAvailable,
  sources_supporting: sourcesSupporting,
  contradictions: contradictions.length,
  overall_quality: contradictions.length === 0 ? agreementLevel : "MIXED"
};
// ================================================================
// FUSION REASONING
// ================================================================
const fusionReasoning = [];
if (contractExists) {
  fusionReasoning.push("Runtime validation successfully verified contract deployment.");
} else {
  fusionReasoning.push("Runtime validation could not verify contract deployment.");
}
if (architectureConfidence > 0) {
  fusionReasoning.push(
    `Architecture reconstruction identified protocol topology (confidence: ${(
      architectureConfidence * 100
    ).toFixed(0)}%).`
  );
}
if (historicalConfidence > 0) {
  fusionReasoning.push(
    `Historical intelligence identified ${historicalAssessmentsWithPrecedent.length} comparable architectural precedents with an average confidence of ${(historicalConfidence * 100).toFixed(0)}%, partially corroborating the reconstructed architecture.${noPrecedentNote}`
  );
} else if (historicalAssessments.length > 0) {
  fusionReasoning.push(
    `Historical intelligence assessed ${historicalAssessments.length} architectural risk categories but identified no comparable historical precedent for any of them.`
  );
}
if (temporal) {
  if (temporalConfidenceLevel === "HIGH") {
    fusionReasoning.push(
      "Temporal monitoring detected low architectural change frequency, indicating stable governance."
    );
  } else if (temporalConfidenceLevel === "MEDIUM") {
    fusionReasoning.push(
      "Temporal monitoring detected moderate architectural change, indicating evolving governance."
    );
  } else if (temporalConfidenceLevel === "LOW") {
    fusionReasoning.push(
      "Temporal monitoring detected high architectural uncertainty or limited governance activity."
    );
  } else {
    fusionReasoning.push(
      "Temporal evidence was unavailable during deterministic evidence fusion."
    );
  }
} else {
  fusionReasoning.push(
    "Temporal evidence was unavailable during deterministic evidence fusion."
  );
}
if (contradictions.length > 0) {
  fusionReasoning.push(
    `${contradictions.length} evidence contradiction(s) detected requiring further investigation.`
  );
}
fusionReasoning.push(
  "Independent audit intelligence has not yet been incorporated at this stage of the pipeline and will be used to validate the deterministic evidence during the subsequent AI Audit phase."
);
// ================================================================
// EVIDENCE FUSION STRUCTURE (Confidence-Based)
// ================================================================
const architectureSupport =
  architectureConfidence >= 0.80
    ? "SUPPORTED"
    : architectureConfidence > 0
    ? "LOW_CONFIDENCE"
    : "UNAVAILABLE";
const historicalSupport =
  historicalConfidence >= 0.80
    ? "SUPPORTED"
    : historicalConfidence > 0
    ? "LOW_CONFIDENCE"
    : "UNAVAILABLE";
const runtimeSupport = contractExists ? "VERIFIED" : "FAILED";
const temporalSupport = temporalConfidenceLevel;
// ================================================================
// VALIDATED PROPERTIES (FIX 2 -- now computed, not static)
// ================================================================
const validatedProperties = [];
if (contractExists) {
  validatedProperties.push("Contract Deployment Confirmed");
}
if (flashLoanSupported) {
  validatedProperties.push("Flash Loan Capability Confirmed");
}
// FIX 5 (corrected): no "Confirmed Absent" claim -- absence was never
// actually verified for every protocol (see header note), only
// defaulted, so only the positive case is asserted here.
if (contractCodeSize > 0) {
  validatedProperties.push("Runtime Bytecode Successfully Retrieved");
}
// ================================================================
// SOURCES AVAILABLE (for metadata -- also drives sources_evaluated)
// ================================================================
const sourcesAvailableList = [
  contractExists ? "RUNTIME" : null,
  architectureConfidence > 0 ? "ARCHITECTURE" : null,
  historicalConfidence > 0 ? "HISTORICAL" : null,
  temporal ? "TEMPORAL" : null
].filter(Boolean);
// ================================================================
// INSTITUTIONAL READINESS (FIX 4 -- now computed, not hardcoded)
// ================================================================
const sourcesPending = ["AUDIT"];
// Ready to proceed to the (later) independent audit stage: runtime
// deployment must be verified, and at least one other evidence source
// must have returned usable confidence -- otherwise there isn't enough
// here yet to be worth an auditor's time.
const readyForAudit = contractExists && sourcesSupporting >= 2;
// Ready for a genuinely FINAL institutional assessment: only true once
// nothing remains outstanding, including the audit itself. By this
// node's own design (see fusion_reasoning and sources_pending above),
// audit is always deferred at this pipeline stage, so this is always
// false here -- but it is now computed from sourcesPending rather than
// a hardcoded literal, so it will correctly flip once this node (or its
// downstream counterpart) is ever evaluated post-audit.
const readyForFinalAssessment = sourcesPending.length === 0;
// ================================================================
// RETURN FUSED EVIDENCE
// ================================================================
return [
  {
    json: {
      runtime_validation_status: contractExists ? "SUCCESS" : "FAILED",
      evidence_summary: evidenceSummary,
      evidence_fusion: {
        architecture: architectureSupport,
        historical: historicalSupport,
        audit: "PENDING",
        runtime: runtimeSupport,
        temporal: temporalSupport,
        agreement: agreementLevel,
        supporting_sources: sourcesSupporting,
        support_ratio: Number((supportRatio * 100).toFixed(0)) / 100
      },
      contradictions: contradictions,
      evidence_quality: evidenceQuality,
      fusion_reasoning: fusionReasoning,
      validated_properties: validatedProperties,
      runtime_evidence: {
        contract_exists: contractExists,
        contract_code_size: contractCodeSize,
        listed_markets: listedMarkets,
        exchange_rate: exchangeRate,
        borrow_index: borrowIndex,
        total_borrows: totalBorrows,
        total_reserves: totalReserves,
        cash: cash,
        reserve_factor_mantissa: reserveFactorMantissa
      },
      deterministic_confidence: finalConfidence,
      institutional_readiness: {
        ready_for_audit: readyForAudit,
        ready_for_final_assessment: readyForFinalAssessment
      },
      metadata: {
        pipeline_stage: "Deterministic Evidence Fusion (Pre-Audit)",
        analysis_stage: "Pre-Audit",
        generated_by: "Neuro-Symbolic Evidence Fusion Engine",
        // FIX 3 (continued): derived from the real count of sources that
        // returned usable evidence, not a separate hardcoded literal
        // that could silently diverge from sourcesAvailableList.
        sources_evaluated: sourcesAvailableList.length,
        sources_available: sourcesAvailableList,
        sources_pending: sourcesPending,
        confidence_calculation: {
          method: "Weighted fusion (4 sources with confidence-based evaluation)",
          runtime_weight: 0.35,
          architecture_weight: 0.30,
          historical_weight: 0.20,
          temporal_weight: 0.15,
          // FIX 8: displayed at 4 decimal places, not 2. `final` below is
          // computed from the raw, unrounded architectureConfidence /
          // historicalConfidence values -- rounding these display inputs to
          // 2dp (e.g. 0.98, 0.88) meant a reader manually checking the
          // documented formula (0.35 + arch*0.30 + hist*0.20 + temporal*0.15)
          // against the displayed inputs could get a different, and wrong,
          // 2dp "final" than what's actually reported (confirmed: displayed
          // 0.98/0.88/0.70 recompute to 0.93, but the true raw inputs
          // produced a reported final of 0.92) -- a report meant to be
          // independently verified by an investment committee should not
          // fail its own advertised formula. 4dp keeps the mismatch below
          // the rounding threshold of `final` in all but pathological cases.
          architecture_confidence_input: Math.round(architectureConfidence * 10000) / 10000,
          historical_confidence_input: Math.round(historicalConfidence * 10000) / 10000,
          // FIX 7: this must report what was actually averaged. Post-FIX-6,
          // only assessments with precedent_found === true are averaged --
          // reporting the full historicalAssessments.length here (as before)
          // silently overstated the sample size behind historical_confidence_input,
          // e.g. claiming "6 samples averaged" when only 4 with real precedent
          // were used and 2 zero-scored no-precedent entries were correctly
          // excluded. historical_samples_assessed keeps the total count visible
          // separately so nothing is lost, just no longer conflated.
          historical_samples_averaged: historicalAssessmentsWithPrecedent.length,
          historical_samples_assessed: historicalAssessments.length,
          historical_no_precedent_count: historicalNoPrecedentCount,
          temporal_confidence_input: temporalValue,
          final: finalConfidence
        }
      },
      // FIX 4: kept for backward compatibility with any downstream node
      // reading this top-level field directly, but now an explicit
      // alias of institutional_readiness.ready_for_audit instead of an
      // independent hardcoded literal that could silently disagree with
      // it.
      institutional_assessment_ready: readyForAudit
    }
  }
];
