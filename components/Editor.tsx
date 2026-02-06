import React, { useRef, useCallback } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { FileSystemItem } from '../types';
import { FileCode } from 'lucide-react';

interface EditorProps {
  file: FileSystemItem | undefined;
  onChange: (id: string, content: string) => void;
}

const getLanguageFromFileName = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    'ts': 'typescript',
    'tsx': 'typescript',
    'js': 'javascript',
    'jsx': 'javascript',
    'json': 'json',
    'html': 'html',
    'htm': 'html',
    'css': 'css',
    'scss': 'scss',
    'less': 'less',
    'md': 'markdown',
    'py': 'python',
    'go': 'go',
    'rs': 'rust',
    'java': 'java',
    'c': 'c',
    'cpp': 'cpp',
    'h': 'c',
    'hpp': 'cpp',
    'yaml': 'yaml',
    'yml': 'yaml',
    'xml': 'xml',
    'sql': 'sql',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'dockerfile': 'dockerfile',
    'gitignore': 'plaintext',
    'env': 'plaintext',
  };
  return languageMap[ext] || 'plaintext';
};

export const CodeEditor: React.FC<EditorProps> = ({ file, onChange }) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleBeforeMount = useCallback((monaco: Monaco) => {
    // Disable all TypeScript/JavaScript diagnostics
    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
      noSuggestionDiagnostics: true,
    });
    monaco.languages.typescript.javascriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
      noSuggestionDiagnostics: true,
    });
  }, []);

  const handleEditorDidMount = useCallback((editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;
    
    // Clear all existing markers/decorations
    monaco.editor.setModelMarkers(editor.getModel()!, 'owner', []);
    
    editor.focus();
  }, []);

  const handleChange = useCallback((value: string | undefined) => {
    if (file && value !== undefined) {
      onChange(file.id, value);
    }
  }, [file, onChange]);

  if (!file) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-[#1e1e1e] h-full">
        <FileCode size={64} className="mb-4 opacity-20" />
        <p>Select a file to start editing</p>
      </div>
    );
  }

  const language = getLanguageFromFileName(file.name);

  return (
    <div className="h-full w-full overflow-hidden">
      <Editor
        height="100%"
        width="100%"
        language={language}
        value={file.content || ''}
        theme="vs-dark"
        onChange={handleChange}
        beforeMount={handleBeforeMount}
        onMount={handleEditorDidMount}
        options={{
          fontSize: 14,
          fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
          fontLigatures: true,
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          lineNumbers: 'on',
          // Disable ALL highlighting and decorations
          renderLineHighlight: 'none',
          highlightActiveIndentGuide: false,
          occurrencesHighlight: 'off',
          selectionHighlight: false,
          renderValidationDecorations: 'off',
          // Disable indent guides completely
          guides: {
            indentation: false,
            highlightActiveIndentation: false,
            bracketPairs: false,
            bracketPairsHorizontal: false,
          },
          // Disable error/warning squiggles
          renderWhitespace: 'none',
          rulers: [],
          overviewRulerBorder: false,
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            useShadows: false,
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
          },
          padding: { top: 16, bottom: 16 },
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          smoothScrolling: true,
          bracketPairColorization: { enabled: false },
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          formatOnPaste: false,
          formatOnType: false,
          // Disable hover and suggestions that might show errors
          hover: { enabled: false },
          quickSuggestions: false,
          parameterHints: { enabled: false },
          suggestOnTriggerCharacters: false,
          acceptSuggestionOnEnter: 'off',
          tabCompletion: 'off',
          wordBasedSuggestions: 'off',
          // Disable code lens and other decorations
          codeLens: false,
          lightbulb: { enabled: 'off' },
          folding: true,
          glyphMargin: false,
        }}
        loading={
          <div className="flex items-center justify-center h-full bg-[#1e1e1e] text-gray-400">
            <div className="animate-pulse">Loading editor...</div>
          </div>
        }
      />
    </div>
  );
};