
export interface Persona {
  id: string;
  name: string;
  role: string;
  bias: string;
  specialty: string;
  yearsExperience: number;
  avatarId: number;
}

// Allow dynamic columns for different models
export interface ExcelRow {
  Test: string;
  Prompt: string;
  [key: string]: any; 
}

export const COLOR_PALETTE = [
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#6366f1', // Indigo
  '#84cc16', // Lime
  '#14b8a6', // Teal
  '#d946ef', // Fuchsia
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

export interface Vote {
  personaName: string;
  personaRole: string;
  votedFor: string;
  reason: string;
}

export interface IndividualVote {
  personaId: string;
  personaName: string;
  personaRole: string;
  vote: string;
  comment: string;
}

export interface AnalysisResult {
  winner: string;
  counts: Record<string, number>;
  votes: Vote[];
  summary: string;
}

export interface VoteResult {
  winner: string;
  counts: Record<string, number>;
  votes?: Vote[];
  reasoning?: string;
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

// --- META ANALYSIS TYPES ---

export interface ModelInsight {
  modelName: string;
  strengths: string[];
  weaknesses: string[];
  bestUseCases: string[];
  winRate: number;
}

export interface ScenarioAward {
  title: string;
  winner: string;
  description: string;
  icon: 'zap' | 'shield' | 'smile' | 'briefcase' | 'pen';
}

export interface MetaAnalysisResult {
  overallChampion: string;
  executiveSummary: string;
  scenarios: ScenarioAward[];
  modelInsights: ModelInsight[];
}
