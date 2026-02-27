
import React from 'react';
import { ProcessedRow } from '../types';
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, LabelList } from 'recharts';
import { Trophy, User, AlertOctagon, ThumbsUp, ThumbsDown, FileText } from 'lucide-react';

interface PdfReportProps {
  rows: ProcessedRow[];
  reportRef: React.RefObject<HTMLDivElement | null>;
  modelColumns: string[];
  colorMap: Record<string, string>;
}

export const PdfReport: React.FC<PdfReportProps> = ({ rows, reportRef, modelColumns, colorMap }) => {
  const completedRows = rows.filter(r => r.status === 'completed' && r.result);

  return (
    <div style={{ position: 'fixed', top: 0, left: '-10000px', width: '800px', zIndex: -50 }}>
      <div 
        ref={reportRef} 
        className="min-h-screen bg-white text-slate-900 p-12 font-sans"
        style={{ width: '800px', colorScheme: 'light' }}
      >
        {/* Title Page */}
        <div data-pdf-section className="mb-12 border-b-2 border-slate-900 pb-6 bg-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-600 p-2 rounded-lg">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                   <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
                </svg>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Copy Critic Validation Report</h1>
          </div>
          <p className="text-slate-500 text-lg">Synthetic Persona Panel Analysis</p>
          <div className="mt-4 text-sm text-slate-400">
            Generated on {new Date().toLocaleDateString()}
          </div>
        </div>

        {/* Executive Summary */}
        <div data-pdf-section className="mb-12 bg-white">
            <h2 className="text-xl font-bold mb-4 uppercase tracking-wider text-slate-700">Executive Summary</h2>
            <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-slate-100 border-b border-slate-200">
                        <tr>
                            <th className="p-3 text-left font-semibold text-slate-600">Test / Variation</th>
                            <th className="p-3 text-left font-semibold text-slate-600">Winning Model</th>
                            <th className="p-3 text-right font-semibold text-slate-600">Vote %</th>
                        </tr>
                    </thead>
                    <tbody>
                        {completedRows.map(row => {
                            const winner = row.result!.winner;
                            const voteCount = row.result?.counts?.[winner] ?? 0;
                            return (
                                <tr key={row.id} className="border-b border-slate-100">
                                    <td className="p-3 font-medium text-slate-800">{row.Test}</td>
                                    <td className="p-3">
                                        <span className="px-2 py-1 rounded text-xs font-bold text-white" style={{ backgroundColor: colorMap[winner] || '#94a3b8' }}>
                                            {winner}
                                        </span>
                                    </td>
                                    <td className="p-3 text-right text-slate-600">{voteCount}%</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Detailed Results */}
        <div className="space-y-12">
            {completedRows.map((row, idx) => {
                const winner = row.result?.winner || "";
                const losers = modelColumns.filter(m => m !== winner);
                const votes = row.result?.votes || [];
                const allRejections = votes.map(v => v.rejectionRationale).filter(Boolean);
                
                const specificRejections = allRejections.filter(r => 
                    losers.some(l => r.toLowerCase().includes(l.toLowerCase()))
                );
                const genericRejections = allRejections.filter(r => 
                    !losers.some(l => r.toLowerCase().includes(l.toLowerCase()))
                );
                
                const topRejections = [...new Set([...specificRejections, ...genericRejections])].slice(0, 3);

                // Chunk votes into groups of 15 to ensure they fit on pages and don't break canvas limits
                const VOTE_CHUNK_SIZE = 15;
                const voteChunks = [];
                for (let i = 0; i < votes.length; i += VOTE_CHUNK_SIZE) {
                    voteChunks.push(votes.slice(i, i + VOTE_CHUNK_SIZE));
                }

                return (
                    <React.Fragment key={row.id}>
                        {/* 1. Test Summary Section */}
                        <div data-pdf-section className="break-inside-avoid page-break-auto bg-white mb-8">
                            <div className="flex items-center gap-3 mb-4 pb-2 border-b border-slate-200">
                                <span className="text-2xl font-bold text-slate-300">#{idx + 1}</span>
                                <div>
                                    <h3 className="text-xl font-bold text-slate-900">{row.Test}</h3>
                                    <div className="text-xs text-slate-500 line-clamp-1">{row.Prompt.substring(0, 100)}...</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-12 gap-6 mb-6">
                                <div className="col-span-8">
                                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-4">
                                        <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">Overall Analysis</h4>
                                        <p className="text-sm text-slate-700 leading-relaxed">{row.result?.reasoning}</p>
                                    </div>

                                    <div className="h-40 w-full mb-4">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart 
                                                data={modelColumns.map(m => ({ name: m, votes: row.result?.counts?.[m] ?? 0 }))} 
                                                layout="vertical"
                                                margin={{ left: 50, right: 20 }}
                                            >
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                                                <Bar dataKey="votes" barSize={20} isAnimationActive={false} minPointSize={2}>
                                                    {modelColumns.map((m, i) => (
                                                        <Cell key={i} fill={colorMap[m] || '#94a3b8'} />
                                                    ))}
                                                    <LabelList dataKey="votes" position="right" fontSize={10} formatter={(v: number) => `${v}%`} />
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    
                                    {topRejections.length > 0 && (
                                        <div className="bg-red-50 p-4 rounded-lg border border-red-100">
                                            <h4 className="text-xs font-bold text-red-600 uppercase mb-2 flex items-center gap-1">
                                                <AlertOctagon className="w-3 h-3" /> Rejection Factors
                                            </h4>
                                            <ul className="space-y-1">
                                                {topRejections.map((reason, rIdx) => (
                                                    <li key={rIdx} className="text-xs text-slate-600 flex items-start gap-2">
                                                        <span className="text-red-400 font-bold">•</span>
                                                        {reason}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                <div className="col-span-4">
                                    <div className="flex flex-col gap-2">
                                        <div className="text-xs font-bold uppercase text-slate-500 mb-1">Winning Copy</div>
                                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-hidden relative">
                                            {row[row.result!.winner]}
                                            <div className="absolute top-2 right-2">
                                                <Trophy className="w-4 h-4 text-green-600" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        {/* 2. Candidate Outputs Comparison */}
                        <div data-pdf-section className="break-inside-avoid bg-white mb-8">
                            <h4 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-blue-500" />
                                Candidate Model Outputs
                            </h4>
                            <div className="grid grid-cols-1 gap-4">
                                {modelColumns.map((model) => (
                                    <div key={model} className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-700">{model}</span>
                                            </div>
                                            {model === winner && (
                                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold border border-green-200 flex items-center gap-1">
                                                    <Trophy className="w-3 h-3" /> Winner
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-600 whitespace-pre-wrap font-mono bg-white p-3 rounded border border-slate-100 leading-relaxed">
                                            {row[model]}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3. Detailed Voting Tables (Chunked) */}
                        {voteChunks.map((chunk, chunkIdx) => (
                             <div key={`${row.id}-chunk-${chunkIdx}`} data-pdf-section className="break-inside-avoid bg-white mb-8">
                                <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                                    <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        <User className="w-4 h-4 text-blue-500" />
                                        Detailed Feedback: {row.Test} 
                                        <span className="text-slate-400 font-normal text-xs ml-2">
                                            (Personas {chunkIdx * VOTE_CHUNK_SIZE + 1} - {Math.min((chunkIdx + 1) * VOTE_CHUNK_SIZE, votes.length)})
                                        </span>
                                    </h4>
                                </div>
                                <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                                    <table className="w-full text-xs table-fixed">
                                        <thead className="bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="p-2 text-left font-semibold text-slate-600 w-[20%]">Persona</th>
                                                <th className="p-2 text-left font-semibold text-slate-600 w-[15%]">Vote</th>
                                                <th className="p-2 text-left font-semibold text-slate-600 w-[65%]">Rationale (Positive & Negative)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {chunk.map((vote, vIdx) => (
                                                <tr key={vIdx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 align-top">
                                                    <td className="p-2">
                                                        <div className="font-bold text-slate-800 truncate" title={vote.personaName}>{vote.personaName}</div>
                                                        <div className="text-[10px] text-slate-500 truncate">{vote.personaRole}</div>
                                                    </td>
                                                    <td className="p-2">
                                                        <span 
                                                            className="px-2 py-1 rounded text-[10px] font-bold text-white whitespace-nowrap inline-block"
                                                            style={{ backgroundColor: colorMap[vote.votedFor] || '#94a3b8' }}
                                                        >
                                                            {vote.votedFor}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 text-slate-600 space-y-1">
                                                        <div className="flex gap-1.5 leading-snug">
                                                            <ThumbsUp className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />
                                                            <span>{vote.choiceRationale}</span>
                                                        </div>
                                                        {vote.rejectionRationale && (
                                                            <div className="flex gap-1.5 leading-snug">
                                                                <ThumbsDown className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />
                                                                <span className="text-slate-500">{vote.rejectionRationale}</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                             </div>
                        ))}
                    </React.Fragment>
                );
            })}
        </div>
        
        {/* Footer */}
        <div data-pdf-section className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400 bg-white">
            Copy Critic Validation System • Powered by Gemini
        </div>
      </div>
    </div>
  );
};
