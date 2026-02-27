
import React, { forwardRef } from 'react';
import { Persona } from '../types';

interface Props {
  personas: Persona[];
}

export const PersonaProfilePdf = forwardRef<HTMLDivElement, Props>(({ personas }, ref) => {
  // Chunk personas into groups of 10 for safe rendering
  const chunkSize = 10;
  const chunks = [];
  for (let i = 0; i < personas.length; i += chunkSize) {
    chunks.push(personas.slice(i, i + chunkSize));
  }

  return (
    <div ref={ref} className="min-h-screen bg-white text-slate-900 p-12 font-sans" style={{ width: '800px', colorScheme: 'light' }}>
      
      {/* Title Page */}
      <div data-pdf-section className="mb-10 border-b-2 border-slate-900 pb-6 bg-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-blue-600 p-2 rounded-lg">
                <div className="w-6 h-6 border-2 border-white rounded-full"></div>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Persona Roster</h1>
          </div>
          <p className="text-slate-500 text-lg">Detailed Profiles of the 100-Person Synthetic Jury</p>
          <div className="mt-4 text-sm text-slate-400">
            Generated on {new Date().toLocaleDateString()}
          </div>
      </div>

      {/* Render Chunks */}
      {chunks.map((chunk, chunkIndex) => (
        <div key={chunkIndex} data-pdf-section className="mb-4 bg-white">
            <div className="grid grid-cols-2 gap-4">
                {chunk.map((p, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-4 break-inside-avoid">
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 border border-slate-300">
                                {p.name.charAt(0)}
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm">{p.name}</h4>
                                <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">{p.role}</span>
                            </div>
                        </div>
                        <div className="text-xs font-mono text-slate-500 border border-slate-200 px-2 py-1 rounded bg-white">
                            {p.yearsExperience}y EXP
                        </div>
                    </div>
                    
                    <div className="text-xs text-slate-600 leading-relaxed pl-1 border-l-2 border-blue-200">
                        {p.bias}
                    </div>
                </div>
                ))}
            </div>
        </div>
      ))}

      {/* Footer */}
      <div data-pdf-section className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-400 bg-white">
        Copy Critic • Synthetic Panel Validation
      </div>

    </div>
  );
});

PersonaProfilePdf.displayName = 'PersonaProfilePdf';
