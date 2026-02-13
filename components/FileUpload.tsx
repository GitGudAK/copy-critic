
import React, { useCallback, useState } from 'react';
import { Upload, AlertCircle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ExcelRow } from '../types';

interface FileUploadProps {
  onDataLoaded: (data: ExcelRow[]) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded }) => {
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);
        
        // Basic validation: Check if we have data
        if (!data || data.length === 0) {
           setError("The uploaded file appears to be empty.");
           return;
        }

        // Check for essential columns in the first row
        const firstRow = data[0];
        if (!firstRow || !('Test' in firstRow) || !('Prompt' in firstRow)) {
            setError("Missing required columns. Please ensure your Excel file has headers 'Test' and 'Prompt'.");
            return;
        }

        // Filter valid rows
        const validData = data.filter((row: any) => row.Test && row.Prompt) as ExcelRow[];
        
        if (validData.length === 0) {
            setError("No valid rows found. Please check your data formatting.");
            return;
        }
        
        onDataLoaded(validData);
      } catch (err) {
        console.error(err);
        setError("Failed to parse the Excel file. Please try again.");
      }
    };
    reader.readAsBinaryString(file);
  }, [onDataLoaded]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className={`p-8 border-2 border-dashed rounded-xl transition-all cursor-pointer group text-center relative overflow-hidden ${error ? 'border-red-500/50 bg-red-500/5' : 'border-slate-600 bg-slate-800/50 hover:bg-slate-800'}`}>
        <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center relative z-10">
          <div className={`p-4 rounded-full mb-4 transition-transform group-hover:scale-110 ${error ? 'bg-red-500/10' : 'bg-blue-500/10'}`}>
            {error ? <AlertCircle className="w-8 h-8 text-red-500" /> : <Upload className="w-8 h-8 text-blue-500" />}
          </div>
          
          <h3 className="text-xl font-semibold text-slate-200 mb-2">
            {error ? "Upload Failed" : "Upload Data Sheet"}
          </h3>
          
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            {error || "Support for .xlsx files. Must contain columns: 'Test', 'Prompt', and model output columns."}
          </p>

          <div className={`px-6 py-2 rounded-lg font-medium transition-colors ${error ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
            {error ? "Try Again" : "Select Excel File"}
          </div>
          
          <input 
            id="file-upload" 
            type="file" 
            accept=".xlsx, .xls, .csv" 
            className="hidden" 
            onChange={handleFileUpload}
            onClick={(e) => (e.currentTarget.value = '')} // Allow re-selecting same file
          />
        </label>
      </div>
      
      {/* Sample Data Format Hint */}
      {!error && (
        <div className="mt-6 flex items-start gap-3 text-xs text-slate-500 bg-slate-900/50 p-4 rounded-lg border border-slate-800">
           <FileSpreadsheet className="w-4 h-4 mt-0.5 shrink-0" />
           <div>
              <span className="font-semibold block mb-1">Required Excel Format:</span>
              <p>Columns: <code className="bg-slate-800 px-1 rounded">Test</code>, <code className="bg-slate-800 px-1 rounded">Prompt</code>, plus any model columns (e.g. <code className="bg-slate-800 px-1 rounded">Gemini</code>, <code className="bg-slate-800 px-1 rounded">GPT 5.2</code>).</p>
           </div>
        </div>
      )}
    </div>
  );
};
