
export interface Persona {
  id: string;
  name: string;
  role: 'Copywriter' | 'Marketer' | 'Creative Director' | 'Growth Hacker';
  specialty: string;
  yearsExperience: number;
  bias: string; // e.g., "Prefers punchy, short copy", "Loves storytelling"
  avatarId: number;
}

export interface ExcelRow {
  Test: string;
  Prompt: string;
  'Writer (Agent Mode)': string;
  'Writer (Chat mode)': string;
  'GPT 5.2': string;
  'GS PeM': string;
  'Gemini': string;
}

export interface SegmentAnalysis {
  name: string;
  winner: string;
  reason: string;
}

export interface VoteResult {
  winner: string;
  counts: {
    'Writer (Agent Mode)': number;
    'Writer (Chat mode)': number;
    'GPT 5.2': number;
    'GS PeM': number;
    'Gemini': number;
  };
  reasoning: string;
  segments: SegmentAnalysis[];
}

export interface ProcessedRow extends ExcelRow {
  id: string;
  status: 'pending' | 'analyzing' | 'completed';
  result?: VoteResult;
}

export type ModelKey = 'Writer (Agent Mode)' | 'Writer (Chat mode)' | 'GPT 5.2' | 'GS PeM' | 'Gemini';

export const MODELS: ModelKey[] = [
  'Writer (Agent Mode)',
  'Writer (Chat mode)',
  'GPT 5.2',
  'GS PeM',
  'Gemini'
];

export const MODEL_COLORS: Record<ModelKey, string> = {
  'Writer (Agent Mode)': '#8b5cf6', // Violet
  'Writer (Chat mode)': '#ec4899', // Pink
  'GPT 5.2': '#10b981', // Emerald
  'GS PeM': '#f59e0b', // Amber
  'Gemini': '#3b82f6', // Blue
};
