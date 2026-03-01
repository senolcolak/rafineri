import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format } from 'date-fns';
import type { Label } from '@rafineri/shared';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

export function formatDate(date: string | Date, formatStr: string = 'PPP'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, formatStr);
}

export function getLabelColor(label: Label): {
  bg: string;
  text: string;
  border: string;
  description: string;
} {
  switch (label) {
    case 'verified':
      return {
        bg: 'bg-verified/10',
        text: 'text-verified-dark',
        border: 'border-verified/30',
        description: 'Multiple credible sources confirm this information',
      };
    case 'likely':
      return {
        bg: 'bg-likely/10',
        text: 'text-likely-dark',
        border: 'border-likely/30',
        description: 'Evidence supports this, but more verification needed',
      };
    case 'contested':
      return {
        bg: 'bg-contested/10',
        text: 'text-contested-dark',
        border: 'border-contested/30',
        description: 'Conflicting evidence exists',
      };
    case 'unverified':
      return {
        bg: 'bg-unverified/10',
        text: 'text-unverified-dark',
        border: 'border-unverified/30',
        description: 'No sufficient evidence to verify',
      };
    default:
      return {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        border: 'border-gray-200',
        description: 'Status unknown',
      };
  }
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-verified';
  if (score >= 60) return 'text-likely';
  if (score >= 40) return 'text-contested';
  return 'text-unverified';
}

export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-verified';
  if (score >= 60) return 'bg-likely';
  if (score >= 40) return 'bg-contested';
  return 'bg-unverified';
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
