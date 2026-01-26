'use client';

import React, { useRef, useState } from 'react';
import { Upload, AlertCircle, FileCode } from 'lucide-react';
import { useWorkspace } from '@/app/(editor)/stores/workspace-provider';
import { isValidZipFile, createSampleReactProject } from '@/lib/workspace';
import { useToast } from '@/components/ui/Toast';

export const ImportProject = () => {
  const toast = useToast();
  const { importFromZip, loadWorkspace, isLoading, error, workspace } = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Don't show import UI if workspace is already loaded
  if (workspace) {
    return null;
  }

  const handleFileSelect = async (file: File) => {
    if (!isValidZipFile(file)) {
      toast.warning('Please select a valid ZIP file');
      return;
    }

    try {
      await importFromZip(file);
    } catch (err) {
      console.error('Import failed:', err);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleCreateSample = () => {
    const sampleWorkspace = createSampleReactProject();
    loadWorkspace(sampleWorkspace);
  };

  return (
    <div className="p-3 border-b border-neutral-800">
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        className="hidden"
        onChange={handleFileInputChange}
        disabled={isLoading}
      />

      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors
          ${dragOver 
            ? 'border-blue-500 bg-blue-500/10' 
            : 'border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800/50'
          }
          ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-neutral-500" />
        <p className="text-sm text-neutral-400 mb-1">
          {isLoading ? 'Importing...' : 'Import Project from ZIP'}
        </p>
        <p className="text-xs text-neutral-600">
          Click or drag & drop a .zip file
        </p>
      </div>

      {error && (
        <div className="mt-3 p-2 bg-red-900/20 border border-red-800 rounded text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <span className="text-red-300">{error}</span>
        </div>
      )}
    </div>
  );
};

