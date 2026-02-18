
import React, { useState, useRef } from 'react';
import { ReportItem, MetaAnalysisResult } from '../types';
import { analyzeSessionResults, analyzePdfReport } from '../services/geminiService';
import { Trophy, TrendingUp, Shield, Smile, Briefcase, PenTool, Upload, Loader2, ArrowLeft, FileText, CheckCircle, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Props {
  currentItems: ReportItem[];
  onBack: () => void;
  colorMap: Record<string, string>;
}

const ICONS = {
  zap: TrendingUp,
  shield: Shield,
  smile: Smile,
  briefcase: Briefcase,
  pen: PenTool
};

export const InsightsDashboard: React.FC<Props> = ({ currentItems, onBack, colorMap }) => {
  const [analysis, setAnalysis] = useState<MetaAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handleAnalyzeCurrent = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await analyzeSessionResults(currentItems);
      setAnalysis(result);
    } catch (e: any) {
      setError(e.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const base64 = (evt.target?.result as string).split(',')[1];
            const result = await analyzePdfReport(base64);
            setAnalysis(result);
        } catch (e: any) {
            console.error("PDF Analysis Error:", e);
            setError(e.message || "Failed to analyze PDF. The file might be too large or complex for the current model.");
        } finally {
            setLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    
    try {
        const element = printRef.current;
        const canvas = await html2canvas(element, {
            scale: 2,
            backgroundColor: '#ffffff',
            windowWidth: 800
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const finalHeight = (canvas.height * pdfWidth) / canvas.width;
        
        let heightLeft = finalHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, finalHeight);
        heightLeft -= pdfHeight;

        while (heightLeft >= 0) {
          position = heightLeft - finalHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, finalHeight);
          heightLeft -= pdfHeight;
        }

        pdf.save('Meta_Analysis_Insights.pdf');
    } catch (e) {
        console.error("Export failed", e);
        alert("Failed to generate PDF. Please try again.");
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
            <p className="text-slate-400 mt-2">Our Senior Analyst AI is reading your reports...</p>
        </div>
    );
  }

  if (analysis) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between mb-6">
                <button onClick={() => setAnalysis(null)} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Upload
                </button>
                
                <button 
                    onClick={handleDownloadPdf}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-lg shadow-blue-500/20"
                >
                    <Download className="w-4 h-4" /> Download Report
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

            {/* Hidden Print Container */}
            <div className="fixed left-[-9999px] top-0">
                <div 
                    ref={printRef} 
                    className="w-[800px] min-h-screen bg-white text-slate-900 p-12 font-sans"
                >
                     {/* Print Header */}
                    <div className="border-b-2 border-slate-900 pb-6 mb-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-blue-600 p-2 rounded-lg">
                                {/* Simple Logo SVG */}
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <path d="M2 20h20M22 20V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v16M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6" />
                                </svg>
                            </div>
                            <h1 className="text-3xl font-bold text-slate-900">Validation Insights</h1>
                        </div>
                        <p className="text-slate-500 text-lg">Meta-Analysis Report</p>
                        <div className="mt-2 text-sm text-slate-400">Generated on {new Date().toLocaleDateString()}</div>
                    </div>

                    {/* Executive Summary */}
                    <div className="mb-10 p-6 bg-slate-50 rounded-xl border border-slate-100">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-3">Executive Summary</h2>
                        <p className="text-lg font-medium text-slate-800 leading-relaxed">{analysis.executiveSummary}</p>
                    </div>

                    {/* Overall Champion */}
                    <div className="mb-12 flex items-center gap-6 p-6 border-l-4 border-yellow-500 bg-yellow-50 rounded-r-xl">
                        <div className="bg-yellow-100 p-4 rounded-full">
                             <Trophy className="w-10 h-10 text-yellow-600" />
                        </div>
                        <div>
                             <div className="text-sm font-bold text-yellow-700 uppercase">Overall Champion</div>
                             <div className="text-3xl font-bold text-slate-900">{analysis.overallChampion}</div>
                        </div>
                    </div>

                    {/* Scenario Table */}
                    <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        Scenario Superlatives
                    </h3>
                    <div className="grid grid-cols-2 gap-4 mb-12">
                         {analysis.scenarios?.map((s, i) => (
                             <div key={i} className="border border-slate-200 p-4 rounded-lg break-inside-avoid">
                                 <div className="flex justify-between items-start mb-2">
                                     <h4 className="font-bold text-slate-800">{s.title}</h4>
                                     <span className="text-xs px-2 py-1 rounded font-bold text-white" style={{ backgroundColor: colorMap[s.winner] || '#64748b' }}>
                                         {s.winner}
                                     </span>
                                 </div>
                                 <p className="text-sm text-slate-600">{s.description}</p>
                             </div>
                         ))}
                    </div>

                    {/* Model Breakdown */}
                    <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-green-600" />
                        Strategic Analysis
                    </h3>
                    <div className="space-y-8">
                        {analysis.modelInsights?.map((m, i) => (
                            <div key={i} className="border-t border-slate-200 pt-6 break-inside-avoid">
                                <div className="flex items-center justify-between mb-4">
                                     <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                         <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colorMap[m.modelName] || '#64748b' }}></div>
                                         {m.modelName}
                                     </h4>
                                     <span className="font-mono text-sm text-slate-500">Win Rate: {m.winRate}%</span>
                                </div>
                                <div className="grid grid-cols-3 gap-6">
                                    <div>
                                        <div className="text-xs font-bold text-green-600 uppercase mb-2">Strengths</div>
                                        <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                                            {m.strengths?.map((s, idx) => <li key={idx}>{s}</li>)}
                                        </ul>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-red-500 uppercase mb-2">Weaknesses</div>
                                        <ul className="list-disc list-inside text-xs text-slate-600 space-y-1">
                                            {m.weaknesses?.map((w, idx) => <li key={idx}>{w}</li>)}
                                        </ul>
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-blue-600 uppercase mb-2">Best For</div>
                                        <div className="flex flex-wrap gap-1">
                                            {m.bestUseCases?.map((u, idx) => (
                                                <span key={idx} className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs border border-slate-200">{u}</span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
                        Generated by CopyCritic AI Validation Suite
                    </div>
                </div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Option 1: Current Session */}
            <button 
                onClick={handleAnalyzeCurrent}
                disabled={currentItems.filter(i => i.status === 'done').length === 0}
                className="bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-blue-500/50 rounded-2xl p-8 flex flex-col items-center text-center transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Trophy className="w-8 h-8 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Analyze Current Session</h3>
                <p className="text-sm text-slate-400 mb-6">
                    Generate insights from the {currentItems.filter(i => i.status === 'done').length} completed tests in your current workspace.
                </p>
                <div className="mt-auto px-6 py-2 bg-blue-600 group-hover:bg-blue-500 text-white rounded-lg font-bold text-sm">
                    Generate Report
                </div>
            </button>

            {/* Option 2: Upload PDF */}
            <div 
                onClick={() => fileInputRef.current?.click()}
                className="bg-slate-800 hover:bg-slate-750 border border-slate-700 hover:border-green-500/50 rounded-2xl p-8 flex flex-col items-center text-center transition-all cursor-pointer group"
            >
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Analyze Historical Report</h3>
                <p className="text-sm text-slate-400 mb-6">
                    Upload a previously generated "CopyCritic Report.pdf" to extract insights.
                </p>
                <div className="mt-auto px-6 py-2 bg-green-600 group-hover:bg-green-500 text-white rounded-lg font-bold text-sm">
                    Upload PDF
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef}
                    accept="application/pdf"
                    className="hidden"
                    onChange={handlePdfUpload}
                />
            </div>
        </div>
    </div>
  );
};
