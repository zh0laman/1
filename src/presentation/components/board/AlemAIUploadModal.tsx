import React, { useState, useRef } from 'react';
import MaterialSymbol from '../../../shared/ui/MaterialSymbol';

interface AlemAIUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
  isProcessing: boolean;
}

export const AlemAIUploadModal: React.FC<AlemAIUploadModalProps> = ({
  isOpen,
  onClose,
  onUpload,
  isProcessing,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    inputRef.current?.click();
  };

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  return (
    <div className="fixed inset-0 z-[700] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-[500px] overflow-hidden rounded-2xl bg-[#FFF9F5] shadow-2xl transition-all animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="bg-[#1E72E7] px-6 py-5 text-center">
          <h3 className="text-lg font-bold text-white">Создать с Alem AI</h3>
          <p className="mt-1 text-xs text-blue-50 opacity-90">
            Загрузите техническое задание, и нейросеть подготовит задачи для Kanban
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          <div
            className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all ${
              dragActive 
                ? 'border-[#1E72E7] bg-[#EBF4FE]' 
                : 'border-[#DDE3EE] hover:border-[#1E72E7] bg-white'
            } p-10`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={onButtonClick}
          >
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".txt,.md,.pdf,.docx"
              onChange={handleChange}
            />

            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-[#1E72E7]">
              <MaterialSymbol name="cloud_upload" size={32} color="currentColor" />
            </div>

            <p className="text-center text-sm font-medium text-[#374C6B]">
              {selectedFile ? (
                <span className="text-[#1E72E7]">{selectedFile.name}</span>
              ) : (
                <>
                  Перетащите файл сюда или <span className="text-[#1E72E7] font-bold">кликните</span> для загрузки
                </>
              )}
            </p>
            <p className="mt-2 text-[10px] text-[#8497B4]">
              Поддерживается .txt, .md, .pdf и .docx
            </p>
          </div>

          <button
            type="button"
            disabled={!selectedFile || isProcessing}
            onClick={handleUpload}
            className={`mt-6 flex h-11 w-full items-center justify-center rounded-xl text-sm font-bold text-white transition-all ${
              selectedFile && !isProcessing
                ? 'bg-[#1E72E7] shadow-lg shadow-blue-200 hover:bg-[#1861CA]'
                : 'bg-[#B0C9F0] cursor-not-allowed text-blue-50'
            }`}
          >
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Обработка...
              </div>
            ) : (
              'Создать с Alem AI'
            )}
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-white/80 transition hover:text-white"
        >
          <MaterialSymbol name="close" size={20} color="currentColor" />
        </button>
      </div>
    </div>
  );
};
