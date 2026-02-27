
import React, { useState, useRef } from 'react';
import { Persona } from '../types';
import { Users, User, Zap, X, Filter, Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { PersonaProfilePdf } from './PersonaProfilePdf';

interface PersonaGridProps {
  personas: Persona[];
  isGenerating: boolean;
}

export const PersonaGrid: React.FC<PersonaGridProps> = ({ personas, isGenerating }) => {
  const [showRoster, setShowRoster] = useState(false);
  const [filterRole, setFilterRole] = useState<string>('All');
  const profilesPdfRef = useRef<HTMLDivElement>(null);

  const handleExportProfiles = async () => {
    if (!profilesPdfRef.current) return;
    
    const originalTitle = document.title;
    document.title = "Exporting Profiles...";
    
    try {
        const element = profilesPdfRef.current;
        const sections = Array.from(element.querySelectorAll('[data-pdf-section]'));
        
        await document.fonts.ready;
        
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const margin = 10;
        let currentY = margin;

        if (sections.length === 0) throw new Error("No content to export");

        for (let i = 0; i < sections.length; i++) {
            const section = sections[i] as HTMLElement;

            const canvas = await html2canvas(section, { 
                scale: 1.5, 
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false,
                scrollX: 0,
                scrollY: 0,
                windowWidth: 800
            });

            if (canvas.width === 0 || canvas.height === 0) continue;

            const imgData = canvas.toDataURL('image/png');
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            
            const pdfImgWidth = pdfWidth - (margin * 2);
            const pdfImgHeight = (imgHeight * pdfImgWidth) / imgWidth;

            // Check if fits on page
            if (currentY + pdfImgHeight > pdfHeight - margin) {
                pdf.addPage();
                currentY = margin;
            }

            pdf.addImage(imgData, 'PNG', margin, currentY, pdfImgWidth, pdfImgHeight);
            currentY += pdfImgHeight + 5;
        }

        pdf.save('CopyCritic_Persona_Profiles.pdf');
    } catch (e: any) {
        console.error(e);
        alert(`Export failed: ${e.message}`);
    } finally {
        document.title = originalTitle;
    }
  };

  if (isGenerating) {
    return (
      <div className="w-full py-12 flex flex-col items-center justify-center text-slate-400 animate-pulse">
        <Users className="w-16 h-16 mb-4 text-slate-600" />
        <p className="text-lg">Recruiting 100 synthetic experts from the database...</p>
      </div>
    );
  }

  if (personas.length === 0) return null;

  // Group by role for stats
  const roleCounts = personas.reduce((acc, p) => {
    acc[p.role] = (acc[p.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filteredPersonas = filterRole === 'All' 
    ? personas 
    : personas.filter(p => p.role === filterRole);

  return (
    <>
      <div className="mt-8 bg-slate-800/50 rounded-xl border border-slate-700 p-6">
        {/* Hidden PDF Render Target - Using fixed positioning to ensure it renders offscreen but in DOM */}
        <div style={{ position: 'fixed', top: 0, left: '-10000px', width: '800px', zIndex: -50 }}>
             <PersonaProfilePdf ref={profilesPdfRef} personas={personas} />
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="text-blue-400 w-5 h-5" />
              Recruited Panel ({personas.length})
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                  Synthetic Copywriters & Marketers with diverse ethnographics.
              </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
                onClick={handleExportProfiles}
                className="text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
                <Download className="w-3 h-3" />
                Export PDF
            </button>
            <button 
                onClick={() => setShowRoster(true)}
                className="text-xs font-semibold bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
                View Full Roster
            </button>
          </div>
        </div>

        {/* Compact Grid Preview */}
        <div className="flex flex-wrap gap-2 max-h-32 overflow-hidden relative">
          {personas.slice(0, 40).map((persona) => (
            <div 
              key={persona.id} 
              className="w-8 h-8 rounded-full bg-slate-700 hover:bg-blue-600 flex items-center justify-center text-[10px] font-bold text-slate-300 hover:text-white cursor-help transition-all"
              title={`${persona.name} (${persona.role})`}
            >
               {persona.name.charAt(0)}
            </div>
          ))}
          {personas.length > 40 && (
            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center text-[10px] text-slate-400">
                +{personas.length - 40}
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-900/90 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Full Roster Modal */}
      {showRoster && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 w-full max-w-5xl max-h-[90vh] rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div>
                <h3 className="text-2xl font-bold text-white mb-1">Panel Roster</h3>
                <p className="text-slate-400 text-sm">Review the 100 synthetic agents recruited for this study.</p>
              </div>
              <button onClick={() => setShowRoster(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                <X className="w-6 h-6 text-slate-400" />
              </button>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 p-4 bg-slate-800/30 border-b border-slate-800 overflow-x-auto">
              <Filter className="w-4 h-4 text-slate-500 ml-2" />
              <button 
                onClick={() => setFilterRole('All')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterRole === 'All' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
              >
                All ({personas.length})
              </button>
              {Object.keys(roleCounts).map(role => (
                <button 
                  key={role}
                  onClick={() => setFilterRole(role)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterRole === role ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                >
                  {role} ({roleCounts[role]})
                </button>
              ))}
            </div>

            {/* Scrollable List */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-900/50">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPersonas.map((p) => (
                  <div key={p.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-blue-500/50 transition-colors flex flex-col gap-2 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-inner">
                          {p.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-200 text-sm">{p.name}</div>
                          <div className="text-xs text-blue-400 font-medium">{p.role}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded">
                        {p.yearsExperience}y EXP
                      </span>
                    </div>
                    
                    <div className="mt-2 text-xs text-slate-300 leading-relaxed bg-slate-900/50 p-3 rounded-lg border border-slate-700/50">
                      {p.bias}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
