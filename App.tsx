
import React, { useState, useRef, useEffect } from 'react';
import { FileUpload } from './components/FileUpload';
import { TestReportCard } from './components/TestReportCard';
import { PersonaGrid } from './components/PersonaGrid';
import { InsightsDashboard } from './components/InsightsDashboard';
import { generatePersonas, runVotingSession, setManualApiKey } from './services/geminiService';
import { ExcelRow, Persona, ReportItem, ProcessedRow, COLOR_PALETTE, Job } from './types';
import { Brain, Users, Play, Loader2, Zap, RefreshCw, AlertTriangle, Tag, PieChart, Key, ExternalLink, Download, Save, Eye, EyeOff } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { PdfReport } from './components/PdfReport';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [manualKey, setManualKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [step, setStep] = useState<'upload' | 'recruit' | 'report' | 'insights'>('upload');
  const [previousStep, setPreviousStep] = useState<'upload' | 'recruit' | 'report'>('upload');
  const [items, setItems] = useState<ReportItem[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecruiting, setIsRecruiting] = useState(false);
  
  // Job History State
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);

  // Dynamic Columns & Colors
  const [modelColumns, setModelColumns] = useState<string[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});

  const pdfReportRef = useRef<HTMLDivElement>(null);
  const reportContainerRef = useRef<HTMLDivElement>(null);

  // Check for API key on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('copyCritic_manual_key');
    if (savedKey) {
      setManualApiKey(savedKey);
      setManualKey(savedKey);
      setHasKey(true);
      return;
    }

    const checkKey = async () => {
      if (!window.aistudio) {
        setHasKey(false);
        return;
      }
      try {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } catch (e) {
        console.error("Failed to check API key", e);
        setHasKey(false);
      }
    };
    checkKey();
  }, []);

  // Load jobs from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('copyCritic_jobs');
    if (saved) {
        try {
            setSavedJobs(JSON.parse(saved));
        } catch (e) {
            console.error("Failed to load saved jobs", e);
        }
    }
  }, []);

  const handleSaveManualKey = () => {
    if (!manualKey.trim()) {
      alert("Please enter a valid API key.");
      return;
    }
    setManualApiKey(manualKey);
    localStorage.setItem('copyCritic_manual_key', manualKey);
    setHasKey(true);
  };

  const handleClearKey = () => {
    setManualApiKey(null);
    localStorage.removeItem('copyCritic_manual_key');
    setManualKey('');
    setHasKey(false);
  };

  const handleOpenKeyDialog = async () => {
    if (!window.aistudio) {
      alert("The API key selection dialog is not available in this environment.");
      return;
    }
    try {
      await window.aistudio.openSelectKey();
      setHasKey(true);
    } catch (e) {
      console.error("Failed to open key dialog", e);
    }
  };

  // 1. Upload Handler
  const handleDataLoaded = (data: ExcelRow[]) => {
    if (data.length > 0) {
      // Dynamically detect model columns (exclude Test, Prompt, and any system keys)
      const firstRow = data[0];
      const cols = Object.keys(firstRow).filter(k => 
        k !== 'Test' && 
        k !== 'Prompt' && 
        k !== '__rowNum__' && 
        k !== 'id'
      );
      
      setModelColumns(cols);

      // Assign colors round-robin
      const newColors: Record<string, string> = {};
      cols.forEach((col, i) => {
        newColors[col] = COLOR_PALETTE[i % COLOR_PALETTE.length];
      });
      setColorMap(newColors);
    }

    const reportItems: ReportItem[] = data.map((row, i) => ({
      ...row,
      id: `test-${i}`,
      status: 'idle'
    }));
    setItems(reportItems);
    setStep('recruit');
  };

  // 2. Recruit Handler
  const handleRecruit = async () => {
    setIsRecruiting(true);
    await new Promise(r => setTimeout(r, 800));
    const p = await generatePersonas(false);
    setPersonas(p);
    setIsRecruiting(false);
    setStep('report');
  };

  // 3. Run All Handler
  const handleRunAll = async () => {
    setIsProcessing(true);
    
    const pendingIndices = items.map((item, index) => item.status !== 'done' ? index : -1).filter(i => i !== -1);
    const BATCH_SIZE = 1;
    
    for (let i = 0; i < pendingIndices.length; i += BATCH_SIZE) {
        const batchIndices = pendingIndices.slice(i, i + BATCH_SIZE);
        
        setItems(prev => {
            const next = [...prev];
            batchIndices.forEach(idx => {
                next[idx] = { ...next[idx], status: 'running', errorMessage: undefined };
            });
            return next;
        });

        await Promise.all(batchIndices.map(async (index) => {
            const item = items[index];
            
            // Construct dynamic candidates object
            const candidates: Record<string, string> = {};
            modelColumns.forEach(col => {
                candidates[col] = item[col] || "";
            });

            try {
                const analysis = await runVotingSession(item.Prompt, candidates, personas);
                
                setItems(prev => {
                    const next = [...prev];
                    next[index] = { ...next[index], status: 'done', analysis };
                    return next;
                });
            } catch (error: any) {
                console.error(`Error processing item ${index}`, error);
                setItems(prev => {
                    const next = [...prev];
                    next[index] = { 
                        ...next[index], 
                        status: 'error',
                        errorMessage: error.message || "Unknown error occurred"
                    };
                    return next;
                });
            }
        }));

        if (i + BATCH_SIZE < pendingIndices.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    setIsProcessing(false);
  };

  const handleSaveJob = () => {
    const jobName = prompt("Enter a name for this job run:", `Run ${new Date().toLocaleTimeString()}`);
    if (!jobName) return;

    const newJob: Job = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        name: jobName,
        items,
        personas
    };

    const updatedJobs = [newJob, ...savedJobs];
    setSavedJobs(updatedJobs);
    localStorage.setItem('copyCritic_jobs', JSON.stringify(updatedJobs));
    alert("Job saved successfully!");
  };

  const handleExportPDF = async () => {
    if (!pdfReportRef.current) {
        alert("Report reference not found. Please try again.");
        return;
    }
    
    const originalTitle = document.title;
    document.title = "Generating PDF...";

    try {
        const element = pdfReportRef.current;
        const sections = Array.from(element.querySelectorAll('[data-pdf-section]'));

        if (sections.length === 0) {
            throw new Error("No report sections found to export.");
        }
        
        // Ensure fonts are loaded before capture
        await document.fonts.ready;

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 10; // mm
        let currentY = margin;

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i] as HTMLElement;

            // Render each section individually to avoid giant canvas issues
            const canvas = await html2canvas(section, { 
                scale: 1.5, // Better quality than 1, safe due to chunking
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                // Crucial: resets scroll so capture isn't blank
                scrollX: 0,
                scrollY: 0,
                windowWidth: 800
            });
            
            if (canvas.width === 0 || canvas.height === 0) continue;

            const imgData = canvas.toDataURL('image/png');
            if (imgData.length < 100) continue; // Skip empty/invalid

            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            
            const pdfImgWidth = pdfWidth - (margin * 2);
            const pdfImgHeight = (imgHeight * pdfImgWidth) / imgWidth;

            // Check if content fits on current page
            if (currentY + pdfImgHeight > pdfHeight - margin) {
                pdf.addPage();
                currentY = margin;
            }

            pdf.addImage(imgData, 'PNG', margin, currentY, pdfImgWidth, pdfImgHeight);
            currentY += pdfImgHeight + 5; // 5mm gap between sections
        }
        
        pdf.save('CopyCritic_Report.pdf');
    } catch (e: any) {
        console.error(e);
        alert(`Export failed: ${e.message || 'Unknown error'}`);
    } finally {
        document.title = originalTitle;
    }
  };

  const completedCount = items.filter(i => i.status === 'done').length;

  const processedRows: ProcessedRow[] = items.map(item => ({
      ...item,
      id: item.id,
      status: item.status === 'done' ? 'completed' : item.status === 'idle' ? 'pending' : 'failed',
      result: item.analysis ? {
          winner: item.analysis.winner,
          counts: item.analysis.counts,
          votes: item.analysis.votes,
          reasoning: item.analysis.summary
      } : undefined
  }));

  const goToInsights = () => {
    if (step !== 'insights') {
        setPreviousStep(step);
        setStep('insights');
    }
  };

  const backFromInsights = () => {
    setStep(previousStep);
  };

  if (hasKey === false) {
    const isPlatformMissing = typeof window.aistudio === 'undefined';

    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Key className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Connect Gemini API</h1>
          <p className="text-slate-400 text-sm mb-8">
            Provide your Gemini API key to start using CopyCritic.
          </p>
          
          <div className="space-y-6 text-left">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Manual API Key</label>
              <div className="relative">
                <input 
                  type={showKey ? "text" : "password"}
                  value={manualKey}
                  onChange={(e) => setManualKey(e.target.value)}
                  placeholder="Paste your API key here..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors pr-12"
                />
                <button 
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button 
              onClick={handleSaveManualKey}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Save & Connect
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-800 px-2 text-slate-500">Or use platform</span></div>
            </div>

            <button 
              onClick={handleOpenKeyDialog}
              disabled={isPlatformMissing}
              className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                isPlatformMissing 
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                : 'bg-slate-700 hover:bg-slate-600 text-white'
              }`}
            >
              <Zap className="w-4 h-4" />
              Select via AI Studio
            </button>

            {isPlatformMissing && (
              <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                AI Studio platform detection failed. Please use the manual key input above if you are viewing this outside of the preview pane.
              </p>
            )}
            
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-blue-400 transition-colors pt-2"
            >
              Get a free API key from Google AI Studio <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (hasKey === null) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-20">
      
      {/* Hidden PDF Render Target - Always rendered but hidden via fixed positioning */}
      <PdfReport 
        rows={processedRows} 
        reportRef={pdfReportRef} 
        modelColumns={modelColumns}
        colorMap={colorMap}
      />

      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl cursor-pointer" onClick={() => step === 'insights' ? backFromInsights() : null}>
            <Brain className="text-blue-500" />
            CopyCritic
            <span className="text-[10px] font-medium bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20 flex items-center gap-1">
              <Tag className="w-3 h-3" />
              v1.5.1
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-slate-500">
               {personas.length > 0 ? `${personas.length} Personas Active` : ''}
            </div>
            <button 
                onClick={handleClearKey}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-2"
                title="Change API Key"
            >
                <Key className="w-3 h-3 text-blue-400" />
                {manualKey ? 'Manual Key Active' : 'BYOK Active'}
            </button>
            {step !== 'insights' && (
                <button 
                    onClick={goToInsights}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                    <PieChart className="w-3 h-3" />
                    Meta Analysis
                </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        
        {step === 'insights' ? (
            <InsightsDashboard 
                currentItems={items} 
                onBack={backFromInsights}
                colorMap={colorMap}
                savedJobs={savedJobs}
            />
        ) : (
            <>
                {step === 'upload' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <h1 className="text-3xl font-bold text-center mb-4">Upload Validation Data</h1>
                    <p className="text-center text-slate-400 mb-10">Upload your Excel sheet containing tests and model outputs.</p>
                    <FileUpload onDataLoaded={handleDataLoaded} />
                  </div>
                )}

                {step === 'recruit' && (
                  <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 text-center py-10">
                    <div className="inline-flex p-6 bg-blue-500/10 rounded-full mb-6">
                      <Users className="w-12 h-12 text-blue-500" />
                    </div>
                    <h2 className="text-2xl font-bold mb-4">Recruit Synthetic Panel</h2>
                    <p className="text-slate-400 mb-8 max-w-md mx-auto">
                      We need to instantiate 100 unique marketing personas to judge your {modelColumns.length} models: <br/>
                      <span className="text-blue-400 font-mono text-xs">{modelColumns.join(', ')}</span>
                    </p>
                    <button 
                      onClick={handleRecruit}
                      disabled={isRecruiting}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 mx-auto"
                    >
                      {isRecruiting ? <Loader2 className="animate-spin" /> : <Users className="w-5 h-5" />}
                      Recruit 100 Personas
                    </button>
                  </div>
                )}

                {step === 'report' && (
                  <div className="space-y-8 animate-in fade-in duration-500">
                    
                    <PersonaGrid personas={personas} isGenerating={isRecruiting} />

                    {items.length === 0 ? (
                        <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center animate-in fade-in zoom-in-95">
                            <div className="w-16 h-16 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <RefreshCw className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">No Test Cases Loaded</h3>
                            <button onClick={() => setStep('upload')} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-bold transition-colors">
                                Upload Different File
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between sticky top-20 z-40 shadow-xl">
                              <div className="flex items-center gap-4">
                                <div className="text-sm text-slate-400">
                                  <span className="text-white font-bold">{completedCount}</span> / {items.length} Evaluated
                                </div>
                                {isProcessing && (
                                    <div className="text-xs text-blue-400 animate-pulse flex items-center gap-1">
                                        <Zap className="w-3 h-3" />
                                        Processing...
                                    </div>
                                )}
                              </div>
                              
                              <div className="flex gap-3">
                                 {completedCount > 0 && !isProcessing && (
                                     <button 
                                        onClick={handleSaveJob}
                                        className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white" 
                                        title="Save Job to History"
                                    >
                                        <Save className="w-5 h-5" />
                                    </button>
                                 )}
                                 {completedCount > 0 && (
                                     <button onClick={handleExportPDF} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white" title="Export PDF">
                                         <Download className="w-5 h-5" />
                                     </button>
                                 )}
                                 {completedCount < items.length && (
                                    <button 
                                        onClick={handleRunAll}
                                        disabled={isProcessing}
                                        className="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all"
                                    >
                                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                                        {items.some(i => i.status !== 'done') && completedCount > 0 ? "Resume Tests" : "Run All Tests"}
                                    </button>
                                 )}
                              </div>
                            </div>

                            <div className="space-y-8" ref={reportContainerRef}>
                              {items.map((item) => (
                                <div key={item.id}>
                                    {item.status === 'idle' ? (
                                         <div className="bg-slate-800/30 border border-slate-800 p-6 rounded-xl flex items-center justify-between opacity-50">
                                             <div>
                                                 <div className="text-xs font-bold text-slate-600 uppercase">Pending Test</div>
                                                 <div className="text-slate-400">{item.Test}</div>
                                             </div>
                                             <div className="h-2 w-2 bg-slate-700 rounded-full"></div>
                                         </div>
                                    ) : item.status === 'running' ? (
                                        <div className="bg-slate-800 border border-blue-500/30 p-8 rounded-xl flex flex-col items-center justify-center text-center animate-pulse">
                                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                                            <h3 className="text-lg font-bold text-white mb-1">Panel is Voting...</h3>
                                            <p className="text-slate-400 text-sm">100 personas reading prompt "{item.Prompt.substring(0, 30)}..."</p>
                                        </div>
                                    ) : item.status === 'error' ? (
                                        <div className="bg-red-900/10 border border-red-500/30 p-6 rounded-xl flex flex-col items-center justify-center text-center">
                                            <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
                                            <h3 className="text-lg font-bold text-red-400 mb-1">Analysis Failed</h3>
                                            <p className="text-red-200/60 text-sm mb-4 max-w-lg">{item.errorMessage}</p>
                                        </div>
                                    ) : (
                                        <TestReportCard 
                                            item={item} 
                                            modelColumns={modelColumns} 
                                            colorMap={colorMap} 
                                        />
                                    )}
                                </div>
                              ))}
                            </div>
                        </>
                    )}
                  </div>
                )}
            </>
        )}
      </main>
    </div>
  );
}
