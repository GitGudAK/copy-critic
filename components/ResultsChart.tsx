import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { VoteResult, MODEL_COLORS, ModelKey, MODELS } from '../types';
import { Trophy } from 'lucide-react';

interface ResultsChartProps {
  result: VoteResult;
}

export const ResultsChart: React.FC<ResultsChartProps> = ({ result }) => {
  const data = MODELS.map(key => ({
    name: key.replace('Writer ', '').replace('Mode', ''), // Shorten names for chart
    fullName: key,
    votes: result.counts[key],
    fill: MODEL_COLORS[key]
  }));

  // Sort data descending
  const sortedData = [...data].sort((a, b) => b.votes - a.votes);
  const winner = sortedData[0];

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Voting Distribution</h3>
        <div className="flex items-center gap-2 bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
          <Trophy className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-bold text-yellow-500">Winner: {winner.fullName} ({winner.votes}%)</span>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis 
                type="category" 
                dataKey="name" 
                width={100} 
                tick={{ fill: '#94a3b8', fontSize: 12 }} 
                axisLine={false}
                tickLine={false}
            />
            <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                itemStyle={{ color: '#f8fafc' }}
                formatter={(value: number) => [`${value} Votes`, 'Votes']}
            />
            <Bar dataKey="votes" radius={[0, 4, 4, 0]} barSize={32}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 pt-4 border-t border-slate-700">
        <h4 className="text-sm font-medium text-slate-400 mb-2">Panel Reasoning</h4>
        <p className="text-sm text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
            {result.reasoning}
        </p>
      </div>
    </div>
  );
};