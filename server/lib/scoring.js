// ---------------------------------------------------------------------------
// scoring.js — Quantum Risk Score (0–100, higher = more risk).
//
// Transparent and explainable on purpose, so it can be defended to judges:
//   1. Each finding contributes its risk weight; repeats add at 25% (capped).
//   2. The weighted sum is squashed into 0–100 with a saturating curve so a
//      few criticals approach — but never falsely hit — 100.
//   3. Detecting post-quantum / crypto-agile design applies a mitigation
//      discount, rewarding good architecture.
// ---------------------------------------------------------------------------
import { RISK_WEIGHT, CATEGORIES } from './scanner.js';

const SATURATION_K = 60; // larger = score climbs more slowly
const REPEAT_FACTOR = 0.25;
const MAX_REPEAT_WEIGHT = 3; // cap extra weight per rule at 3x the base

function gradeFor(score) {
  if (score >= 80) return 'F';
  if (score >= 60) return 'D';
  if (score >= 40) return 'C';
  if (score >= 20) return 'B';
  return 'A';
}

function labelFor(score) {
  if (score >= 80) return 'Critical exposure';
  if (score >= 60) return 'High exposure';
  if (score >= 40) return 'Moderate exposure';
  if (score >= 20) return 'Low exposure';
  return 'Minimal exposure';
}

/**
 * @param {Array} findings  from the scanner
 * @param {{ pqcReady?: boolean }} [signals]
 */
export function computeScore(findings = [], signals = {}) {
  const byRisk = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  const byCategory = {
    [CATEGORIES.QUANTUM]: 0,
    [CATEGORIES.CLASSICAL]: 0,
    [CATEGORIES.PRACTICE]: 0,
  };

  // Group occurrences per rule so repeats get diminishing weight.
  const perRule = new Map();
  for (const f of findings) {
    byRisk[f.risk] = (byRisk[f.risk] || 0) + 1;
    byCategory[f.category] = (byCategory[f.category] || 0) + 1;
    const g = perRule.get(f.ruleId) || { risk: f.risk, category: f.category, count: 0 };
    g.count++;
    perRule.set(f.ruleId, g);
  }

  let raw = 0;
  const categoryWeight = {
    [CATEGORIES.QUANTUM]: 0,
    [CATEGORIES.CLASSICAL]: 0,
    [CATEGORIES.PRACTICE]: 0,
  };
  for (const { risk, category, count } of perRule.values()) {
    const base = RISK_WEIGHT[risk] || 0;
    const repeats = Math.min((count - 1) * REPEAT_FACTOR, MAX_REPEAT_WEIGHT);
    const weight = base * (1 + repeats);
    raw += weight;
    categoryWeight[category] += weight;
  }

  // Reward crypto-agile / post-quantum-ready design.
  const mitigationApplied = Boolean(signals.pqcReady) && findings.length > 0;
  if (mitigationApplied) raw *= 0.8;

  const riskScore = findings.length === 0 ? 0 : Math.round(100 * (1 - Math.exp(-raw / SATURATION_K)));
  const squash = (w) => Math.round(100 * (1 - Math.exp(-w / SATURATION_K)));

  return {
    riskScore, // 0–100, higher = more risk
    postureScore: 100 - riskScore, // for "security posture" style gauges
    grade: gradeFor(riskScore),
    label: labelFor(riskScore),
    totals: {
      findings: findings.length,
      byRisk,
      byCategory,
    },
    exposure: {
      quantum: squash(categoryWeight[CATEGORIES.QUANTUM]),
      classical: squash(categoryWeight[CATEGORIES.CLASSICAL]),
      practice: squash(categoryWeight[CATEGORIES.PRACTICE]),
    },
    mitigationApplied,
    method:
      'Weighted findings (Critical 40 / High 22 / Medium 10 / Low 4), repeats at 25% up to 3x, ' +
      'squashed via 100·(1−e^(−Σ/60)). Post-quantum-ready design applies a 20% discount.',
  };
}
