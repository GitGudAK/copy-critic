import React, { useState, useCallback, useMemo, useRef } from 'react';
import { FileUpload } from './components/FileUpload';
import { PersonaGrid } from './components/PersonaGrid';
import { ResultsChart } from './components/ResultsChart';
import { PdfReport } from './components/PdfReport';
import { generatePersonas, evaluateCopyRow } from './services/geminiService';
import { ExcelRow, Persona, ProcessedRow, MODELS, MODEL_COLORS, ModelKey } from './types';
import { Brain, Play, CheckCircle2, ChevronRight, BarChart3, AlertCircle, Layers, Fingerprint, RefreshCcw, Database, FileDown, Loader2, User } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export default function App() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [dataRows, setDataRows] = useState<ProcessedRow[]>([]);
  const [isGeneratingPersonas, setIsGeneratingPersonas] = useState(false);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // Ref for PDF Report
  const reportRef = useRef<HTMLDivElement>(null);
  
  // App Steps
  const [hasRecruited, setHasRecruited] = useState(false);

  const handleDataLoaded = useCallback((rows: ExcelRow[]) => {
    // Transform into processed rows with unique IDs
    const processed = rows.map((row, idx) => ({
      ...row,
      id: `row-${idx}`,
      status: 'pending' as const
    }));
    setDataRows(processed);
    if (processed.length > 0) setSelectedRowId(processed[0].id);
  }, []);

  const handleRecruitPersonas = async (useAi: boolean) => {
    setIsGeneratingPersonas(true);
    // Pass flag to determine if we load static (fast) or generate (slow)
    const recruited = await generatePersonas(useAi);
    setPersonas(recruited);
    setIsGeneratingPersonas(false);
    setHasRecruited(true);
  };

  const handleRunEvaluation = async (rowId: string) => {
    // Note: We use the functional update pattern for state to ensure thread safety
    // during parallel execution, but we need to read the initial data from current state
    // to pass to the service. 
    // Since dataRows doesn't change structure (only status), reading from closure is safe 
    // for the content data.
    const row = dataRows.find(r => r.id === rowId);
    if (!row) return;

    // Optimistic update
    setDataRows(prev => prev.map(r => r.id === rowId ? { ...r, status: 'analyzing' } : r));

    const modelOutputs = {
        'Writer (Agent Mode)': row['Writer (Agent Mode)'],
        'Writer (Chat mode)': row['Writer (Chat mode)'],
        'GPT 5.2': row['GPT 5.2'],
        'GS PeM': row['GS PeM'],
        'Gemini': row['Gemini']
    };

    const result = await evaluateCopyRow(row.Prompt, modelOutputs, personas);

    setDataRows(prev => prev.map(r => r.id === rowId ? { ...r, status: 'completed', result } : r));
  };

  const handleRunAll = async () => {
    // Filter pending rows
    const pendingRows = dataRows.filter(r => r.status === 'pending');
    if (pendingRows.length === 0) return;

    // Process in parallel batches to speed up execution massively
    // Gemini Flash has high concurrency limits.
    const BATCH_SIZE = 5; 
    
    for (let i = 0; i < pendingRows.length; i += BATCH_SIZE) {
        const batch = pendingRows.slice(i, i + BATCH_SIZE);
        // Run batch in parallel
        await Promise.all(batch.map(row => handleRunEvaluation(row.id)));
    }
  };

  const handleExportPdf = async () => {
    if (!reportRef.current) return;
    const completedCount = dataRows.filter(r => r.status === 'completed').length;
    if (completedCount === 0) {
        alert("Please run at least one evaluation before exporting.");
        return;
    }

    setIsExporting(true);
    
    // Wait a brief moment for the hidden component to fully render if it was conditional
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2, // Higher quality
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      
      // Calculate PDF dimensions (A4)
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      // Calculate height maintaining aspect ratio
      const ratio = pdfWidth / imgWidth;
      const finalHeight = imgHeight * ratio;

      // Handle multi-page if content is long
      let heightLeft = finalHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, finalHeight);
      heightLeft -= pdfHeight;

      while (heightLeft >= 0) {
        position = heightLeft - finalHeight; // Move up
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, finalHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save('copy-critic-report.pdf');
    } catch (err) {
      console.error("PDF Export failed:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Group rows by Prompt to avoid duplicates in sidebar
  const groupedRows = useMemo(() => {
    const groups: Record<string, ProcessedRow[]> = {};
    dataRows.forEach(row => {
      const key = row.Prompt.trim();
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(row);
    });
    return groups;
  }, [dataRows]);

  const selectedRow = dataRows.find(r => r.id === selectedRowId);
  const completedCount = dataRows.filter(r => r.status === 'completed').length;
  const totalCount = dataRows.length;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-blue-500/30">
      
      {/* Hidden PDF Report Container */}
      <PdfReport rows={dataRows} reportRef={reportRef} />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
                <Brain className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Copy Critic <span className="text-blue-400 font-normal">| Synthetic Persona Validation</span></h1>
          </div>
          <div className="flex items-center gap-4">
             {personas.length > 0 && (
                 <div className="flex items-center gap-2 text-sm text-green-400 bg-green-400/10 px-3 py-1 rounded-full border border-green-400/20">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{personas.length} Experts Active</span>
                 </div>
             )}
             {dataRows.length > 0 && (
                <button
                    onClick={handleExportPdf}
                    disabled={isExporting || completedCount === 0}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                    Export Report
                </button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {/* Step 1: Data Upload */}
        {dataRows.length === 0 && (
            <div className="mt-12 flex flex-col items-center animate-fade-in">
                <h2 className="text-3xl font-bold mb-4 text-center">Validate Copy with 100 Synthetic Personas</h2>
                <p className="text-slate-400 mb-12 text-center max-w-2xl text-lg">
                    Upload your Excel test results. We'll recruit 100 synthetic marketing experts to vote on the best performing copy for every test case.
                </p>
                <FileUpload onDataLoaded={handleDataLoaded} />
            </div>
        )}

        {/* Main Dashboard */}
        {dataRows.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Left Sidebar: Test List */}
                <div className="lg:col-span-3 space-y-4 h-[calc(100vh-140px)] flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex flex-col">
                            <h3 className="font-semibold text-slate-300 flex items-center gap-2">
                                <Layers className="w-4 h-4" />
                                Test Prompts
                            </h3>
                            <span className="text-xs text-slate-500 mt-1">{completedCount} / {totalCount} Completed</span>
                        </div>
                        {hasRecruited && completedCount < totalCount && (
                             <button 
                                onClick={handleRunAll}
                                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors font-medium shadow-lg shadow-blue-900/20"
                             >
                                Run All
                             </button>
                        )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar pb-10">
                        {Object.entries(groupedRows).map(([prompt, rowsUntyped]) => {
                            // Fix TS error: explicit cast because Object.entries inference might vary
                            const rows = rowsUntyped as ProcessedRow[];
                            const isGroupActive = rows.some(r => r.id === selectedRowId);
                            
                            return (
                                <div 
                                    key={prompt}
                                    className={`p-3 rounded-xl border transition-all duration-200 ${
                                        isGroupActive 
                                        ? 'bg-slate-800 border-slate-600 shadow-lg' 
                                        : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                                    }`}
                                >
                                    <div className="mb-3">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
                                            <span>Prompt Group</span>
                                            {isGroupActive && <span className="text-blue-400">Active</span>}
                                        </div>
                                        <div 
                                            className={`text-sm line-clamp-2 leading-relaxed ${isGroupActive ? 'text-white font-medium' : 'text-slate-400'}`}
                                            title={prompt}
                                        >
                                            {prompt}
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-2">
                                        {rows.map((row, idx) => {
                                            const isSelected = selectedRowId === row.id;
                                            // Extract "Test X" or just use index+1 if format varies
                                            const label = row.Test || `Var ${idx + 1}`;
                                            
                                            return (
                                                <button
                                                    key={row.id}
                                                    onClick={() => setSelectedRowId(row.id)}
                                                    className={`
                                                        px-2.5 py-1.5 text-xs font-mono rounded-md border transition-all flex items-center gap-2
                                                        ${isSelected 
                                                            ? 'bg-blue-600 border-blue-500 text-white shadow-md ring-1 ring-blue-400/50' 
                                                            : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200 hover:bg-slate-800'
                                                        }
                                                    `}
                                                    title={`Switch to ${label}`}
                                                >
                                                    {label}
                                                    {row.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-green-400" />}
                                                    {row.status === 'analyzing' && <div className="w-2 h-2 rounded-full border border-current border-t-transparent animate-spin" />}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Center/Right: Action & Analysis */}
                <div className="lg:col-span-9 flex flex-col gap-6">
                    
                    {/* Persona Recruitment Section (Sticky if not recruited) */}
                    <div className={`bg-slate-800 rounded-xl border border-slate-700 p-6 shadow-xl transition-all ${!hasRecruited ? 'ring-2 ring-blue-500/20' : ''}`}>
                        {!hasRecruited ? (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mb-4">
                                    <Fingerprint className="w-8 h-8 text-blue-500" />
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-2">Recruit Your Synthetic Panel</h3>
                                <p className="text-slate-400 mb-8 max-w-lg text-lg">
                                    Load 100 diverse personas (marketers, copywriters) to critique your copy.
                                </p>
                                
                                <div className="flex gap-4">
                                    <button 
                                        onClick={() => handleRecruitPersonas(false)}
                                        disabled={isGeneratingPersonas}
                                        className="flex items-center gap-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-blue-500/20 hover:scale-105 active:scale-95"
                                    >
                                        <Database className="w-5 h-5" />
                                        Load Standard Panel (Instant)
                                    </button>
                                    
                                    <button 
                                        onClick={() => handleRecruitPersonas(true)}
                                        disabled={isGeneratingPersonas}
                                        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-200 px-6 py-3 rounded-xl font-semibold text-sm transition-all border border-slate-600 hover:border-slate-500"
                                    >
                                        {isGeneratingPersonas ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                                                Generating...
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCcw className="w-4 h-4" />
                                                Generate New via AI
                                            </>
                                        )}
                                    </button>
                                </div>

                                <PersonaGrid personas={personas} isGenerating={isGeneratingPersonas} />
                            </div>
                        ) : (
                             <PersonaGrid personas={personas} isGenerating={false} />
                        )}
                    </div>

                    {/* Analysis Section */}
                    {selectedRow && hasRecruited && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in-up">
                            
                            {/* Copy Comparison */}
                            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col h-[600px]">
                                <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
                                    <div className="flex flex-col">
                                        <h3 className="text-lg font-semibold text-white">Ad Copy Candidates</h3>
                                        <span className="text-xs text-slate-400 font-mono mt-1 px-2 py-0.5 bg-slate-700 rounded-full w-fit">
                                            Variation: <span className="text-blue-300">{selectedRow.Test}</span>
                                        </span>
                                    </div>
                                    
                                    {selectedRow.status !== 'completed' && selectedRow.status !== 'analyzing' && (
                                        <button 
                                            onClick={() => handleRunEvaluation(selectedRow.id)}
                                            className="text-sm bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-lg hover:shadow-green-500/20"
                                        >
                                            <Play className="w-3 h-3 fill-current" />
                                            Run Vote
                                        </button>
                                    )}
                                </div>
                                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                                    {MODELS.map(model => (
                                        <div key={model} className="bg-slate-900 rounded-lg p-4 border border-slate-700/50 hover:border-slate-600 transition-colors group">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-2.5 h-2.5 rounded-full ring-2 ring-slate-800" style={{ backgroundColor: MODEL_COLORS[model] }} />
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider group-hover:text-slate-300 transition-colors">{model}</span>
                                            </div>
                                            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed font-light">
                                                {selectedRow[model]}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Results */}
                            <div className="h-[600px]">
                                {selectedRow.status === 'completed' && selectedRow.result ? (
                                    <div className="h-full flex flex-col gap-4">
                                        <ResultsChart result={selectedRow.result} />
                                        
                                        {/* New Segment Analysis Card in Dashboard */}
                                        {selectedRow.result.segments && selectedRow.result.segments.length > 0 && (
                                            <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex-1 overflow-y-auto custom-scrollbar">
                                                <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                                                    <User className="w-4 h-4 text-blue-400" />
                                                    Segment Insights
                                                </h4>
                                                <div className="space-y-3">
                                                    {selectedRow.result.segments.map((seg, idx) => (
                                                        <div key={idx} className="bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-xs font-bold text-slate-200">{seg.name}</span>
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: MODEL_COLORS[seg.winner as ModelKey] }}>
                                                                    {seg.winner}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-400 leading-snug">{seg.reason}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : selectedRow.status === 'analyzing' ? (
                                    <div className="h-full bg-slate-800 rounded-xl border border-slate-700 flex flex-col items-center justify-center text-center p-8 relative overflow-hidden">
                                        <div className="absolute inset-0 bg-blue-500/5 animate-pulse" />
                                        <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-6 relative z-10" />
                                        <h3 className="text-xl font-bold text-white mb-2 relative z-10">Panel is Voting...</h3>
                                        <p className="text-slate-400 relative z-10">100 personas are analyzing the prompt and 5 model outputs based on their biases.</p>
                                    </div>
                                ) : (
                                    <div className="h-full bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-700 flex flex-col items-center justify-center text-center p-8">
                                        <div className="p-4 bg-slate-800 rounded-full mb-4">
                                            <BarChart3 className="w-8 h-8 text-slate-500" />
                                        </div>
                                        <h3 className="text-lg font-medium text-slate-400 mb-1">Awaiting Analysis</h3>
                                        <p className="text-slate-500 text-sm max-w-xs">Select a test variation and click "Run Vote" to let the synthetic panel decide the winner.</p>
                                    </div>
                                )}
                            </div>

                        </div>
                    )}
                </div>
            </div>
        )}
      </main>
    </div>
  );
}