import React, { useState, useEffect } from 'react';
import { FileSystemItem } from '../types';
import { Bot, FileCode } from 'lucide-react';

interface EditorProps {
  file: FileSystemItem | undefined;
  onChange: (id: string, content: string) => void;
}

export const Editor: React.FC<EditorProps> = ({ file, onChange }) => {
  const [content, setContent] = useState('');

  // Sync internal state when file changes
  useEffect(() => {
    if (file) {
      setContent(file.content || '');
    }
  }, [file]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    if (file) {
      onChange(file.id, newContent);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Simple tab support
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const value = target.value;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      
      setContent(newValue);
      if (file) onChange(file.id, newValue);
      
      // Need to reset cursor position after render, simplified here
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  if (!file) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-[#1e1e1e]">
        <FileCode size={64} className="mb-4 opacity-20" />
        <p>Select a file to start editing</p>
      </div>
    );
  }

  // Calculate line numbers
  const lines = content.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1);

  return (
    <div className="flex-1 flex flex-col relative bg-[#1e1e1e] overflow-hidden">
      <div className="flex-1 flex overflow-hidden">
        {/* Line Numbers */}
        <div className="w-12 bg-[#1e1e1e] border-r border-[#333] text-right pr-3 pt-4 text-gray-600 select-none font-mono text-sm leading-6 overflow-hidden">
          {lineNumbers.map(n => (
            <div key={n}>{n}</div>
          ))}
        </div>
        
        {/* Editor Area */}
        <textarea
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-[#1e1e1e] text-gray-300 p-4 font-mono text-sm leading-6 outline-none resize-none whitespace-pre border-none"
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
        />
      </div>
    </div>
  );
};