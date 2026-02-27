
import React, { useState, useRef } from 'react';
import { ReportItem, MetaAnalysisResult, Job } from '../types';
import { analyzeSessionResults } from '../services/geminiService';
import { Trophy, TrendingUp, Shield, Smile, Briefcase, PenTool, Loader2, ArrowLeft, FileText, CheckCircle, Database, Clock } from 'lucide-react';

interface Props {
  currentItems: ReportItem[];
  onBack: () => void;
  colorMap: Record<string, string>;
  savedJobs?: Job[];
}

const ICONS = {
  zap: TrendingUp,
  shield: Shield,
  smile: Smile,
  briefcase: Briefcase,
  pen: PenTool
};

export const InsightsDashboard: React.FC<Props> = ({ currentItems, onBack, colorMap, savedJobs = [] }) => {
  const [analysis, setAnalysis] = useState<MetaAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyzeItems = async (items: ReportItem[], jobId: string) => {
    setLoading(true);
    setError(null);
    setActiveJobId(jobId);
    try {
      const result = await analyzeSessionResults(items);
      setAnalysis(result);
    } catch (e: any) {
      setError(e.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center animate-in fade-in">
            <div className="relative">
                <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                <Loader2 className="w-16 h-16 text-blue-500 animate-spin relative z-10" />
            </div>
            <h2 className="mt-8 text-2xl font-bold text-white">Generating Meta-Analysis</h2>
            <p className="text-slate-400 mt-2">Our Senior Analyst AI is reading the rationales (this may take a moment for large files)...</p>
        </div>
    );
  }

  if (analysis) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
                <button onClick={() => setAnalysis(null)} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Selection
                </button>
            </div>

            {/* Main Dashboard View */}
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between mb-10">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Validation Insights</h1>
                    <p className="text-slate-400 max-w-2xl">{analysis.executiveSummary}</p>
                </div>
                <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl flex items-center gap-4">
                    <div className="bg-yellow-500/20 p-3 rounded-full">
                        <Trophy className="w-8 h-8 text-yellow-500" />
                    </div>
                    <div>
                        <div className="text-xs font-bold text-yellow-500 uppercase tracking-wider">Overall Champion</div>
                        <div className="text-2xl font-bold text-white">{analysis.overallChampion}</div>
                    </div>
                </div>
            </div>

            {/* Scenarios Grid */}
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" />
                Scenario Superlatives
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
                {analysis.scenarios?.map((scenario, idx) => {
                    const Icon = ICONS[scenario.icon] || Trophy;
                    return (
                        <div key={idx} className="bg-slate-800 border border-slate-700 p-5 rounded-xl hover:border-slate-600 transition-all">
                            <div className="flex items-start justify-between mb-3">
                                <div className="bg-slate-700/50 p-2 rounded-lg text-slate-300">
                                    <Icon className="w-5 h-5" />
                                </div>
                                <span className="text-xs font-bold px-2 py-1 rounded text-white" style={{ backgroundColor: colorMap[scenario.winner] || '#64748b' }}>
                                    {scenario.winner}
                                </span>
                            </div>
                            <h4 className="font-bold text-white mb-1">{scenario.title}</h4>
                            <p className="text-sm text-slate-400 leading-snug">{scenario.description}</p>
                        </div>
                    );
                })}
            </div>

            {/* Model Deep Dives */}
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-400" />
                Model Deep Dives
            </h3>
            <div className="space-y-6">
                {analysis.modelInsights?.map((model, idx) => (
                    <div key={idx} className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                        <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
                            <h4 className="font-bold text-lg text-white flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorMap[model.modelName] || '#64748b' }}></div>
                                {model.modelName}
                            </h4>
                            <div className="text-sm font-mono text-slate-400">Win Rate: <span className="text-white font-bold">{model.winRate}%</span></div>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div>
                                <div className="text-xs font-bold text-green-400 uppercase mb-3 flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" /> Strengths
                                </div>
                                <ul className="space-y-2">
                                    {model.strengths?.map((s, i) => (
                                        <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                            <span className="w-1 h-1 bg-green-500 rounded-full mt-1.5 shrink-0"></span>
                                            {s}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-red-400 uppercase mb-3 flex items-center gap-2">
                                    <Shield className="w-4 h-4" /> Weaknesses
                                </div>
                                <ul className="space-y-2">
                                    {model.weaknesses?.map((w, i) => (
                                        <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                                            <span className="w-1 h-1 bg-red-500 rounded-full mt-1.5 shrink-0"></span>
                                            {w}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-blue-400 uppercase mb-3 flex items-center gap-2">
                                    <Briefcase className="w-4 h-4" /> Best Use Cases
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {model.bestUseCases?.map((uc, i) => (
                                        <span key={i} className="text-xs bg-slate-900 border border-slate-700 text-slate-300 px-3 py-1.5 rounded-full">
                                            {uc}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
  }

  // Initial Selection View
  return (
    <div className="w-full max-w-4xl mx-auto py-10 animate-in fade-in slide-in-from-bottom-8">
        <button onClick={onBack} className="mb-8 flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Testing
        </button>

        <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Meta-Analysis Dashboard</h2>
            <p className="text-slate-400">Discover strategic insights across multiple test cases.</p>
        </div>
        
        {error && (
             <div className="mb-8 bg-red-500/10 border border-red-500/20 p-4 rounded-lg text-red-400 text-sm text-center">
                 {error}
             </div>
        )}

        <div className="grid grid-cols-1 gap-6">
            {/* Option 1: Current Session */}
            <button 
                onClick={() => handleAnalyzeItems(currentItems, 'current')}
                disabled={currentItems.filter(i => i.status === 'done').length === 0}
                className="bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-500/50 rounded-2xl p-8 flex flex-col items-center text-center transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Trophy className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Analyze Current Session</h3>
                <p className="text-sm text-slate-400 mb-6">
                    Generate insights from the {currentItems.filter(i => i.status === 'done').length} completed tests.
                </p>
                <div className="mt-auto px-6 py-2 bg-blue-600 group-hover:bg-blue-500 text-white rounded-lg font-bold text-sm">
                    Generate Report
                </div>
            </button>
        </div>
        
        {/* Option 3: Saved Jobs */}
        {savedJobs.length > 0 && (
            <div className="mt-12">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Database className="w-5 h-5 text-purple-400" />
                    Saved Job History
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {savedJobs.map((job) => (
                        <div 
                            key={job.id}
                            onClick={() => handleAnalyzeItems(job.items, job.id)}
                            className="bg-slate-800 border border-slate-700 hover:border-purple-500/50 p-4 rounded-xl cursor-pointer transition-colors group"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-bold text-white">{job.name}</span>
                                <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">{job.items.filter(i => i.status === 'done').length} Tests</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Clock className="w-3 h-3" />
                                {new Date(job.timestamp).toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
  );
};
