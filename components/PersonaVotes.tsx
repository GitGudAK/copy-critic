
import React from 'react';
import { IndividualVote } from '../types';
import { User } from 'lucide-react';

interface PersonaVotesProps {
  votes: IndividualVote[];
  colorMap: Record<string, string>;
}

export const PersonaVotes: React.FC<PersonaVotesProps> = ({ votes, colorMap }) => {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 flex flex-col h-[600px] overflow-hidden">
        <div className="p-4 border-b border-slate-700 bg-slate-800/50">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-blue-400" />
                Individual Persona Feedback ({votes.length})
            </h3>
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            <div className="space-y-2">
                {votes.map((vote, idx) => (
                    <div key={`${vote.personaId}-${idx}`} className="bg-slate-900/40 p-3 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-colors">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                                    {vote.personaName.charAt(0)}
                                </div>
                                <div>
                                    <div className="text-sm font-bold text-slate-200">{vote.personaName}</div>
                                    <div className="text-[10px] text-slate-500 uppercase font-medium tracking-wide">{vote.personaRole}</div>
                                </div>
                            </div>
                            <span 
                                className="text-[10px] px-2 py-1 rounded-md font-bold text-white whitespace-nowrap"
                                style={{ backgroundColor: colorMap[vote.vote] || '#64748b' }}
                            >
                                {vote.vote}
                            </span>
                        </div>
                        <div className="mt-2 ml-11 text-xs text-slate-300 italic">
                            "{vote.comment}"
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};
