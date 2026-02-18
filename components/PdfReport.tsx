
import React from 'react';
import { ProcessedRow } from '../types';
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, LabelList } from 'recharts';
import { Trophy, User } from 'lucide-react';

interface PdfReportProps {
  rows: ProcessedRow[];
  reportRef: React.RefObject<HTMLDivElement | null>;
  modelColumns: string[];
  colorMap: Record<string, string>;
}

export const PdfReport: React.FC<PdfReportProps> = ({ rows, reportRef, modelColumns, colorMap }) => {
  const completedRows = rows.filter(r => r.status === 'completed' && r.result);

  return (
    <div className="fixed left-[-9999px] top-0">
      <div 
        ref={reportRef} 
        className="w-[800px] min-h-screen bg-white text-slate-900 p-12 font-sans"
        style={{ colorScheme: 'light' }}
      >
        {/* Title Page */}
        <div className="mb-12 border-b-2 border-slate-900 pb-6">
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
        <div className="mb-12">
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
            {completedRows.map((row, idx) => (
                <div key={row.id} className="break-inside-avoid page-break-auto">
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

                             {/* Static Bar Chart for PDF */}
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

                    {/* Detailed Voting Table */}
                    <div className="mt-8">
                        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Individual Persona Votes (100)
                        </h4>
                        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="p-2 text-left font-semibold text-slate-600 w-1/4">Persona</th>
                                        <th className="p-2 text-left font-semibold text-slate-600 w-1/4">Role</th>
                                        <th className="p-2 text-left font-semibold text-slate-600 w-1/6">Vote</th>
                                        <th className="p-2 text-left font-semibold text-slate-600">Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {row.result?.votes?.map((vote, vIdx) => (
                                        <tr key={vIdx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                                            <td className="p-2 font-medium text-slate-800">{vote.personaName}</td>
                                            <td className="p-2 text-slate-500">{vote.personaRole}</td>
                                            <td className="p-2">
                                                <span 
                                                    className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white whitespace-nowrap"
                                                    style={{ backgroundColor: colorMap[vote.votedFor] || '#94a3b8' }}
                                                >
                                                    {vote.votedFor}
                                                </span>
                                            </td>
                                            <td className="p-2 text-slate-600 italic">"{vote.reason}"</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            ))}
        </div>
        
        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400">
            Copy Critic Validation System • Powered by Gemini
        </div>
      </div>
    </div>
  );
};
