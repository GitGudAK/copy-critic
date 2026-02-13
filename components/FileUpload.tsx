import React, { useCallback } from 'react';
import { Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ExcelRow } from '../types';

interface FileUploadProps {
  onDataLoaded: (data: ExcelRow[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json<ExcelRow>(ws);
      
      // Basic validation to ensure columns exist
      const validData = data.filter(row => row.Test && row.Prompt && row.Gemini); // Check a few key fields
      onDataLoaded(validData);
    };
    reader.readAsBinaryString(file);
  }, [onDataLoaded]);

  return (
    <div className="w-full max-w-2xl mx-auto p-8 border-2 border-dashed border-slate-600 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors cursor-pointer group text-center">
      <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center">
        <div className="p-4 bg-blue-500/10 rounded-full mb-4 group-hover:scale-110 transition-transform">
          <Upload className="w-8 h-8 text-blue-500" />
        </div>
        <h3 className="text-xl font-semibold text-slate-200 mb-2">Upload Data Sheet</h3>
        <p className="text-slate-400 mb-6">Support for .xlsx files containing model outputs</p>
        <div className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-medium transition-colors">
          Select Excel File
        </div>
        <input 
          id="file-upload" 
          type="file" 
          accept=".xlsx, .xls, .csv" 
          className="hidden" 
          onChange={handleFileUpload}
        />
      </label>
    </div>
  );
};