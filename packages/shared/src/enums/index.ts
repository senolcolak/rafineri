/**
 * UI display enums and mappings for Rafineri
 */

import type {
  VerifiabilityLabel,
  SortOption,
  SourceType,
  ClaimType,
  ClaimStatus,
  EvidenceStance,
} from '../types/index.js';

// ============================================
// Verifiability Label Display
// ============================================

export interface LabelDisplay {
  label: VerifiabilityLabel;
  displayName: string;
  description: string;
  color: string;
  bgColor: string;
  icon: string;
  order: number;
}

export const VERIFIABILITY_LABELS: Record<VerifiabilityLabel, LabelDisplay> = {
  verified: {
    label: 'verified',
    displayName: 'Verified',
    description: 'Claims have strong evidence from authoritative sources',
    color: '#16a34a', // green-600
    bgColor: '#dcfce7', // green-100
    icon: 'CheckCircle',
    order: 1,
  },
  likely: {
    label: 'likely',
    displayName: 'Likely True',
    description: 'Claims appear credible but lack full verification',
    color: '#0284c7', // sky-600
    bgColor: '#e0f2fe', // sky-100
    icon: 'ShieldCheck',
    order: 2,
  },
  contested: {
    label: 'contested',
    displayName: 'Contested',
    description: 'Claims have conflicting evidence or significant disputes',
    color: '#ea580c', // orange-600
    bgColor: '#ffedd5', // orange-100
    icon: 'Scale',
    order: 3,
  },
  unverified: {
    label: 'unverified',
    displayName: 'Unverified',
    description: 'Not enough information to verify claims',
    color: '#6b7280', // gray-500
    bgColor: '#f3f4f6', // gray-100
    icon: 'HelpCircle',
    order: 4,
  },
};

export const VERIFIABILITY_LABEL_LIST = Object.values(VERIFIABILITY_LABELS).sort(
  (a, b) => a.order - b.order
);

// ============================================
// Sort Option Display
// ============================================

export interface SortOptionDisplay {
  value: SortOption;
  displayName: string;
  description: string;
  icon: string;
}

export const SORT_OPTIONS: Record<SortOption, SortOptionDisplay> = {
  hot: {
    value: 'hot',
    displayName: 'Hot',
    description: 'Trending stories right now',
    icon: 'Flame',
  },
  most_verified: {
    value: 'most_verified',
    displayName: 'Most Verified',
    description: 'Stories with the highest verification confidence',
    icon: 'CheckCircle',
  },
  most_contested: {
    value: 'most_contested',
    displayName: 'Most Contested',
    description: 'Stories with conflicting evidence',
    icon: 'AlertTriangle',
  },
  newest: {
    value: 'newest',
    displayName: 'Newest',
    description: 'Recently discovered stories',
    icon: 'Clock',
  },
};

export const SORT_OPTION_LIST = Object.values(SORT_OPTIONS);

// ============================================
// Source Type Display
// ============================================

export interface SourceTypeDisplay {
  value: SourceType;
  displayName: string;
  description: string;
  icon: string;
  color: string;
  domain: string;
}

export const SOURCE_TYPES: Record<SourceType, SourceTypeDisplay> = {
  hackernews: {
    value: 'hackernews',
    displayName: 'Hacker News',
    description: 'Tech-focused community from Y Combinator',
    icon: 'Y',
    color: '#ff6600',
    domain: 'news.ycombinator.com',
  },
  reddit: {
    value: 'reddit',
    displayName: 'Reddit',
    description: 'Community discussions from Reddit',
    icon: 'MessageCircle',
    color: '#ff4500',
    domain: 'reddit.com',
  },
  manual: {
    value: 'manual',
    displayName: 'Manual',
    description: 'Manually curated content',
    icon: 'User',
    color: '#6b7280',
    domain: '',
  },
};

export const SOURCE_TYPE_LIST = Object.values(SOURCE_TYPES);

// ============================================
// Claim Type Display
// ============================================

export interface ClaimTypeDisplay {
  value: ClaimType;
  displayName: string;
  description: string;
  icon: string;
}

export const CLAIM_TYPES: Record<ClaimType, ClaimTypeDisplay> = {
  fact: {
    value: 'fact',
    displayName: 'Fact',
    description: 'An objectively verifiable statement',
    icon: 'FileCheck',
  },
  opinion: {
    value: 'opinion',
    displayName: 'Opinion',
    description: 'A subjective view or judgment',
    icon: 'MessageSquare',
  },
  prediction: {
    value: 'prediction',
    displayName: 'Prediction',
    description: 'A forecast about future events',
    icon: 'TrendingUp',
  },
  quote: {
    value: 'quote',
    displayName: 'Quote',
    description: 'A direct statement attributed to someone',
    icon: 'Quote',
  },
};

export const CLAIM_TYPE_LIST = Object.values(CLAIM_TYPES);

// ============================================
// Claim Status Display
// ============================================

export interface ClaimStatusDisplay {
  value: ClaimStatus;
  displayName: string;
  description: string;
  color: string;
  bgColor: string;
  icon: string;
}

export const CLAIM_STATUSES: Record<ClaimStatus, ClaimStatusDisplay> = {
  pending: {
    value: 'pending',
    displayName: 'Pending Review',
    description: 'Awaiting verification',
    color: '#6b7280',
    bgColor: '#f3f4f6',
    icon: 'Clock',
  },
  verified: {
    value: 'verified',
    displayName: 'Verified',
    description: 'Confirmed by evidence',
    color: '#16a34a',
    bgColor: '#dcfce7',
    icon: 'CheckCircle',
  },
  disputed: {
    value: 'disputed',
    displayName: 'Disputed',
    description: 'Has conflicting evidence',
    color: '#ca8a04',
    bgColor: '#fef9c3',
    icon: 'AlertCircle',
  },
  debunked: {
    value: 'debunked',
    displayName: 'Debunked',
    description: 'Proven false by evidence',
    color: '#dc2626',
    bgColor: '#fee2e2',
    icon: 'XCircle',
  },
};

export const CLAIM_STATUS_LIST = Object.values(CLAIM_STATUSES);

// ============================================
// Evidence Stance Display
// ============================================

export interface EvidenceStanceDisplay {
  value: EvidenceStance;
  displayName: string;
  description: string;
  color: string;
  bgColor: string;
  icon: string;
}

export const EVIDENCE_STANCES: Record<EvidenceStance, EvidenceStanceDisplay> = {
  supporting: {
    value: 'supporting',
    displayName: 'Supporting',
    description: 'Evidence supports the claims',
    color: '#16a34a',
    bgColor: '#dcfce7',
    icon: 'ThumbsUp',
  },
  contradicting: {
    value: 'contradicting',
    displayName: 'Contradicting',
    description: 'Evidence contradicts the claims',
    color: '#dc2626',
    bgColor: '#fee2e2',
    icon: 'ThumbsDown',
  },
  neutral: {
    value: 'neutral',
    displayName: 'Neutral',
    description: 'Evidence provides context without taking a stance',
    color: '#6b7280',
    bgColor: '#f3f4f6',
    icon: 'Minus',
  },
};

export const EVIDENCE_STANCE_LIST = Object.values(EVIDENCE_STANCES);

// ============================================
// Helper Functions
// ============================================

/**
 * Get display info for a verifiability label
 */
export function getLabelDisplay(label: VerifiabilityLabel): LabelDisplay {
  return VERIFIABILITY_LABELS[label];
}

/**
 * Get display info for a sort option
 */
export function getSortOptionDisplay(sort: SortOption): SortOptionDisplay {
  return SORT_OPTIONS[sort];
}

/**
 * Get display info for a source type
 */
export function getSourceTypeDisplay(type: SourceType): SourceTypeDisplay {
  return SOURCE_TYPES[type];
}

/**
 * Get display info for a claim type
 */
export function getClaimTypeDisplay(type: ClaimType): ClaimTypeDisplay {
  return CLAIM_TYPES[type];
}

/**
 * Get display info for a claim status
 */
export function getClaimStatusDisplay(status: ClaimStatus): ClaimStatusDisplay {
  return CLAIM_STATUSES[status];
}

/**
 * Get display info for an evidence stance
 */
export function getEvidenceStanceDisplay(stance: EvidenceStance): EvidenceStanceDisplay {
  return EVIDENCE_STANCES[stance];
}

/**
 * Get all labels ordered by verification level
 */
export function getOrderedLabels(): LabelDisplay[] {
  return VERIFIABILITY_LABEL_LIST;
}

/**
 * Check if a label indicates verified content
 */
export function isVerified(label: VerifiabilityLabel): boolean {
  return label === 'verified' || label === 'likely';
}

/**
 * Check if a label indicates disputed content
 */
export function isDisputed(label: VerifiabilityLabel): boolean {
  return label === 'contested';
}
