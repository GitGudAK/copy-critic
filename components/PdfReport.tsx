import React from 'react';
import { ProcessedRow, MODEL_COLORS, ModelKey, MODELS } from '../types';
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer } from 'recharts';
import { Trophy, CheckCircle2, User, FileText } from 'lucide-react';

interface PdfReportProps {
  rows: ProcessedRow[];
  reportRef: React.RefObject<HTMLDivElement | null>;
}

export const PdfReport: React.FC<PdfReportProps> = ({ rows, reportRef }) => {
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
                {/* Simple SVG logo for PDF */}
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
                            const winner = row.result!.winner as ModelKey;
                            const voteCount = row.result!.counts[winner];
                            return (
                                <tr key={row.id} className="border-b border-slate-100">
                                    <td className="p-3 font-medium text-slate-800">{row.Test}</td>
                                    <td className="p-3">
                                        <span className="px-2 py-1 rounded text-xs font-bold text-white" style={{ backgroundColor: MODEL_COLORS[winner] }}>
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
                <div key={row.id} className="break-inside-avoid">
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
                                        data={MODELS.map(m => ({ name: m, votes: row.result!.counts[m] }))} 
                                        layout="vertical"
                                        margin={{ left: 50 }}
                                    >
                                        <XAxis type="number" hide />
                                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                                        <Bar dataKey="votes" barSize={20} isAnimationActive={false}>
                                            {MODELS.map((m, i) => (
                                                <Cell key={i} fill={MODEL_COLORS[m]} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                             </div>
                        </div>

                        <div className="col-span-4">
                            <div className="flex flex-col gap-2">
                                <div className="text-xs font-bold uppercase text-slate-500 mb-1">Winning Copy</div>
                                <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-hidden relative">
                                    {row[row.result!.winner as ModelKey]}
                                    <div className="absolute top-2 right-2">
                                        <Trophy className="w-4 h-4 text-green-600" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Segments */}
                    <div>
                        <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                            <User className="w-4 h-4" />
                            Segment Breakdown
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            {row.result?.segments?.map((seg, i) => (
                                <div key={i} className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-bold text-xs text-slate-900">{seg.name}</span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: MODEL_COLORS[seg.winner as ModelKey] || '#94a3b8' }}>
                                            {seg.winner}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 leading-snug">{seg.reason}</p>
                                </div>
                            ))}
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