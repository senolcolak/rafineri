import { describe, it, expect } from 'vitest';

/**
 * Label Aggregation Tests
 * 
 * These tests verify that verifiability labels are correctly aggregated
 * from claims and evidence to determine overall story labels.
 */

type VerifiabilityLabel = 'verified' | 'likely' | 'contested' | 'unverified';
type ClaimStatus = 'pending' | 'verified' | 'disputed' | 'debunked';
type EvidenceStance = 'supporting' | 'contradicting' | 'neutral';

interface Claim {
  status: ClaimStatus;
  type: string;
}

interface Evidence {
  stance: EvidenceStance;
}

function calculateLabel(
  claims: Claim[],
  evidence: Evidence[]
): { label: VerifiabilityLabel; confidence: number } {
  // Default for empty data
  if (claims.length === 0 && evidence.length === 0) {
    return { label: 'unverified', confidence: 0 };
  }

  // Count claim statuses
  const verifiedClaims = claims.filter(c => c.status === 'verified').length;
  const disputedClaims = claims.filter(c => c.status === 'disputed').length;
  const debunkedClaims = claims.filter(c => c.status === 'debunked').length;
  const pendingClaims = claims.filter(c => c.status === 'pending').length;

  // Count evidence stances
  const supportingEvidence = evidence.filter(e => e.stance === 'supporting').length;
  const contradictingEvidence = evidence.filter(e => e.stance === 'contradicting').length;
  const totalEvidence = evidence.length;

  // Calculate evidence ratio
  const evidenceRatio = totalEvidence > 0 
    ? (supportingEvidence - contradictingEvidence) / totalEvidence 
    : 0;

  // Determine label based on claims and evidence
  let label: VerifiabilityLabel = 'unverified';
  let confidence = 0;

  // Debunked claims make the story contested
  if (debunkedClaims > 0 || (disputedClaims > 0 && verifiedClaims === 0)) {
    label = 'contested';
    confidence = Math.min(1, (debunkedClaims * 0.3 + disputedClaims * 0.2));
  }
  // Strong verified claims with supporting evidence
  else if (verifiedClaims > 0 && evidenceRatio > 0.3) {
    label = 'verified';
    confidence = Math.min(1, 0.6 + (verifiedClaims * 0.1) + (evidenceRatio * 0.2));
  }
  // Some verified claims but not strong evidence
  else if (verifiedClaims > 0 || evidenceRatio > 0) {
    label = 'likely';
    confidence = Math.min(1, 0.4 + (verifiedClaims * 0.15) + (evidenceRatio * 0.2));
  }
  // Disputed claims without verification
  else if (disputedClaims > 0) {
    label = 'contested';
    confidence = Math.min(1, 0.4 + disputedClaims * 0.15);
  }
  // Pending claims only
  else if (pendingClaims > 0) {
    label = 'unverified';
    confidence = 0.2;
  }

  // Adjust confidence based on total evidence amount
  if (totalEvidence > 0) {
    confidence = Math.min(1, confidence + Math.log10(totalEvidence + 1) * 0.05);
  }

  return { label, confidence: Math.round(confidence * 100) / 100 };
}

describe('Label Aggregation', () => {
  describe('empty data', () => {
    it('should return unverified for no claims or evidence', () => {
      const result = calculateLabel([], []);
      expect(result.label).toBe('unverified');
      expect(result.confidence).toBe(0);
    });
  });

  describe('verified label', () => {
    it('should label verified when claims are verified with supporting evidence', () => {
      const claims: Claim[] = [
        { status: 'verified', type: 'fact' },
        { status: 'verified', type: 'fact' },
      ];
      const evidence: Evidence[] = [
        { stance: 'supporting' },
        { stance: 'supporting' },
        { stance: 'neutral' },
      ];
      
      const result = calculateLabel(claims, evidence);
      expect(result.label).toBe('verified');
      expect(result.confidence).toBeGreaterThan(0.6);
    });

    it('should have higher confidence with more verified claims', () => {
      const claims5: Claim[] = Array(5).fill(null).map(() => ({ status: 'verified', type: 'fact' }));
      const claims1: Claim[] = [{ status: 'verified', type: 'fact' }];
      const evidence: Evidence[] = [{ stance: 'supporting' }];
      
      const result5 = calculateLabel(claims5, evidence);
      const result1 = calculateLabel(claims1, evidence);
      
      expect(result5.confidence).toBeGreaterThan(result1.confidence);
    });
  });

  describe('likely label', () => {
    it('should label likely with some verified claims', () => {
      const claims: Claim[] = [
        { status: 'verified', type: 'fact' },
        { status: 'pending', type: 'fact' },
      ];
      const evidence: Evidence[] = [];
      
      const result = calculateLabel(claims, evidence);
      expect(result.label).toBe('likely');
    });

    it('should label likely with mostly supporting evidence', () => {
      const claims: Claim[] = [{ status: 'pending', type: 'fact' }];
      const evidence: Evidence[] = [
        { stance: 'supporting' },
        { stance: 'supporting' },
        { stance: 'neutral' },
      ];
      
      const result = calculateLabel(claims, evidence);
      expect(result.label).toBe('likely');
    });
  });

  describe('contested label', () => {
    it('should label contested when claims are disputed', () => {
      const claims: Claim[] = [
        { status: 'disputed', type: 'fact' },
        { status: 'disputed', type: 'fact' },
      ];
      const evidence: Evidence[] = [];
      
      const result = calculateLabel(claims, evidence);
      expect(result.label).toBe('contested');
    });

    it('should label contested when claims are debunked', () => {
      const claims: Claim[] = [
        { status: 'verified', type: 'fact' },
        { status: 'debunked', type: 'fact' },
      ];
      const evidence: Evidence[] = [];
      
      const result = calculateLabel(claims, evidence);
      expect(result.label).toBe('contested');
    });

    it('should have higher confidence with more disputed claims', () => {
      const claims1: Claim[] = [{ status: 'disputed', type: 'fact' }];
      const claims3: Claim[] = Array(3).fill(null).map(() => ({ status: 'disputed', type: 'fact' }));
      
      const result1 = calculateLabel(claims1, []);
      const result3 = calculateLabel(claims3, []);
      
      expect(result3.confidence).toBeGreaterThan(result1.confidence);
    });
  });

  describe('unverified label', () => {
    it('should label unverified with only pending claims', () => {
      const claims: Claim[] = [
        { status: 'pending', type: 'fact' },
        { status: 'pending', type: 'fact' },
      ];
      
      const result = calculateLabel(claims, []);
      expect(result.label).toBe('unverified');
    });
  });

  describe('evidence impact', () => {
    it('should increase confidence with more evidence', () => {
      const claims: Claim[] = [{ status: 'verified', type: 'fact' }];
      const littleEvidence: Evidence[] = [{ stance: 'supporting' }];
      const lotsOfEvidence: Evidence[] = Array(10).fill(null).map(() => ({ stance: 'supporting' }));
      
      const resultLittle = calculateLabel(claims, littleEvidence);
      const resultLots = calculateLabel(claims, lotsOfEvidence);
      
      expect(resultLots.confidence).toBeGreaterThan(resultLittle.confidence);
    });

    it('should decrease confidence with contradicting evidence', () => {
      const claims: Claim[] = [{ status: 'verified', type: 'fact' }];
      const supporting: Evidence[] = [
        { stance: 'supporting' },
        { stance: 'supporting' },
      ];
      const mixed: Evidence[] = [
        { stance: 'supporting' },
        { stance: 'contradicting' },
      ];
      
      const resultSupporting = calculateLabel(claims, supporting);
      const resultMixed = calculateLabel(claims, mixed);
      
      expect(resultMixed.confidence).toBeLessThan(resultSupporting.confidence);
    });
  });

  describe('edge cases', () => {
    it('should handle mix of all claim types', () => {
      const claims: Claim[] = [
        { status: 'verified', type: 'fact' },
        { status: 'verified', type: 'fact' },
        { status: 'disputed', type: 'fact' },
        { status: 'pending', type: 'fact' },
        { status: 'debunked', type: 'fact' },
      ];
      
      const result = calculateLabel(claims, []);
      // Debunked claims should make it contested
      expect(result.label).toBe('contested');
    });

    it('should handle only neutral evidence', () => {
      const claims: Claim[] = [{ status: 'pending', type: 'fact' }];
      const evidence: Evidence[] = [
        { stance: 'neutral' },
        { stance: 'neutral' },
      ];
      
      const result = calculateLabel(claims, evidence);
      expect(result.label).toBe('unverified');
    });
  });
});
