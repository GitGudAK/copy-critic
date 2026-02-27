
import React, { useState } from 'react';
import { ReportItem } from '../types';
import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, LabelList } from 'recharts';
import { Trophy, ChevronDown, ChevronUp, User, Quote, ThumbsUp, ThumbsDown, AlertOctagon } from 'lucide-react';

interface Props {
  item: ReportItem;
  modelColumns: string[];
  colorMap: Record<string, string>;
}

export const TestReportCard: React.FC<Props> = ({ item, modelColumns, colorMap }) => {
  const [showDetails, setShowDetails] = useState(false);

  if (item.status !== 'done' || !item.analysis) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 opacity-60">
        <div className="h-6 w-1/3 bg-slate-700 rounded mb-4 animate-pulse"></div>
        <div className="h-20 w-full bg-slate-700/50 rounded animate-pulse"></div>
      </div>
    );
  }

  const { winner, counts, votes, summary } = item.analysis;
  
  const chartData = modelColumns.map(m => ({
    name: m,
    // Truncate name if too long for axis
    shortName: m.length > 20 ? m.substring(0, 18) + '..' : m,
    value: counts[m] || 0,
    color: colorMap[m] || '#94a3b8'
  })).sort((a, b) => b.value - a.value);

  // Derive Top Rejection Reasons
  // We prioritize rationales that explicitly mention the names of losing models.
  const losers = modelColumns.filter(m => m !== winner);
  const allRejections = votes.map(v => v.rejectionRationale).filter(Boolean);
  
  const specificRejections = allRejections.filter(r => 
    losers.some(l => r.toLowerCase().includes(l.toLowerCase()))
  );
  
  const genericRejections = allRejections.filter(r => 
    !losers.some(l => r.toLowerCase().includes(l.toLowerCase()))
  );

  // Mix specific and generic, favoring specific
  const uniqueRejections = [...new Set([...specificRejections, ...genericRejections])];
  const topRejections = uniqueRejections.slice(0, 3);

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
      
      {/* Header: Test & Winner */}
      <div className="p-6 border-b border-slate-700 bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
            Test Case: {item.Test}
          </div>
          <h3 className="text-lg font-medium text-slate-200 line-clamp-2" title={item.Prompt}>
            {item.Prompt}
          </h3>
        </div>

        <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 px-4 py-2 rounded-lg min-w-fit shadow-[0_0_15px_rgba(234,179,8,0.1)]">
          <Trophy className="w-6 h-6 text-yellow-500" />
          <div>
            <div className="text-[10px] text-yellow-500/80 uppercase font-bold">Winner</div>
            <div className="text-yellow-400 font-bold text-lg leading-none">{winner}</div>
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Col: Chart & Summary */}
        <div className="space-y-6">
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 40 }}>
                <XAxis type="number" hide />
                <YAxis 
                  type="category" 
                  dataKey="shortName" 
                  width={140} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }} 
                  axisLine={false}
                  tickLine={false}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24} minPointSize={2}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                  <LabelList dataKey="value" position="right" fill="#cbd5e1" fontSize={12} formatter={(v: number) => `${v}%`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4 relative">
             <Quote className="w-8 h-8 text-slate-700 absolute -top-3 -left-2 bg-slate-900 p-1 rounded-full" />
             <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 ml-4">Panel Consensus</h4>
             <p className="text-sm text-slate-300 leading-relaxed italic">
               "{summary}"
             </p>
          </div>

          {/* New Rejection Section */}
          {topRejections.length > 0 && (
             <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-4">
               <h4 className="text-xs font-bold text-red-400 uppercase mb-2 flex items-center gap-2">
                 <AlertOctagon className="w-3 h-3" /> Key Rejection Factors
               </h4>
               <ul className="space-y-2">
                 {topRejections.map((reason, idx) => (
                   <li key={idx} className="text-xs text-slate-400 flex items-start gap-2">
                     <span className="text-red-500/50 mt-0.5">•</span>
                     {reason}
                   </li>
                 ))}
               </ul>
             </div>
          )}
        </div>

        {/* Right Col: Winning Text Sample */}
        <div className="space-y-3">
          <div className="text-sm text-slate-400 font-medium flex items-center justify-between">
             <span>Winning Copy ({winner})</span>
             <span className="text-xs bg-slate-700 px-2 py-1 rounded text-slate-300">Preview</span>
          </div>
          <div className="p-4 bg-slate-900/80 rounded border border-slate-700 text-sm text-slate-300 italic h-full max-h-[350px] overflow-y-auto custom-scrollbar shadow-inner whitespace-pre-wrap">
            {(item as any)[winner]}
          </div>
        </div>
      </div>

      {/* Expandable Votes */}
      <div className="border-t border-slate-700">
        <button 
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-center gap-2 p-3 text-sm text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
        >
          {showDetails ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
          {showDetails ? 'Hide Individual Votes' : `View 100 Individual Votes`}
        </button>
        
        {showDetails && (
          <div className="bg-slate-900/80 p-4 max-h-[500px] overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-3 animate-in slide-in-from-top-2">
            {votes.map((vote, i) => (
              <div key={i} className="bg-slate-800 p-4 rounded border border-slate-700/50 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-slate-500" />
                    <span className="text-xs font-bold text-slate-300">{vote.personaName}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{vote.personaRole}</span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded text-white font-bold" style={{ backgroundColor: colorMap[vote.votedFor] || '#64748b' }}>
                    {vote.votedFor}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                    <div className="text-xs">
                        <div className="flex items-center gap-1 text-green-400 font-bold mb-0.5">
                            <ThumbsUp className="w-3 h-3" /> Why I chose it:
                        </div>
                        <p className="text-slate-400 pl-4">{vote.choiceRationale || vote.reason}</p>
                    </div>
                    {vote.rejectionRationale && (
                        <div className="text-xs">
                            <div className="flex items-center gap-1 text-red-400 font-bold mb-0.5">
                                <ThumbsDown className="w-3 h-3" /> Comparison:
                            </div>
                            <p className="text-slate-400 pl-4">{vote.rejectionRationale}</p>
                        </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
