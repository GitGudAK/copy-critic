

export interface Persona {
  id: string;
  name: string;
  role: string;
  bias: string;
  specialty: string;
  yearsExperience: number;
  avatarId: number;
}

// Matches the Excel columns exactly
export interface ExcelRow {
  Test: string;
  Prompt: string;
  'Writer (Agent Mode)': string;
  'Writer (Chat mode)': string;
  'GPT 5.2': string;
  'GS PeM': string;
  'Gemini': string;
}

// The specific keys for the models
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

export interface Vote {
  personaName: string;
  personaRole: string;
  votedFor: ModelKey;
  reason: string;
}

export interface IndividualVote {
  personaId: string;
  personaName: string;
  personaRole: string;
  vote: ModelKey;
  comment: string;
}

export interface AnalysisResult {
  winner: ModelKey;
  counts: Record<ModelKey, number>;
  votes: Vote[];
  summary: string;
}

export interface SegmentAnalysis {
  name: string;
  winner: string;
  reason: string;
}

export interface VoteResult {
  winner: ModelKey;
  counts: Record<ModelKey, number>;
  votes?: Vote[];
  reasoning?: string;
  segments?: SegmentAnalysis[];
}

export interface ReportItem extends ExcelRow {
  id: string;
  status: 'idle' | 'running' | 'done' | 'error';
  analysis?: AnalysisResult;
  errorMessage?: string;
}

export interface ProcessedRow extends ExcelRow {
  id: string;
  status: 'completed' | 'pending' | 'failed';
  result?: VoteResult;
}
