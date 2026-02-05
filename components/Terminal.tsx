import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { TerminalSquare, Loader2, X, Maximize2, Minimize2 } from 'lucide-react';

interface TerminalProps {
  isConnected: boolean;
  onCreateTerminal: (cols: number, rows: number, onData: (data: Uint8Array) => void) => Promise<any>;
  onSendInput: (data: string) => Promise<void>;
  onResize: (cols: number, rows: number) => Promise<void>;
}

export const Terminal: React.FC<TerminalProps> = ({
  isConnected,
  onCreateTerminal,
  onSendInput,
  onResize,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isTerminalReady, setIsTerminalReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!isConnected || !terminalRef.current || xtermRef.current) {
      return;
    }

    const initTerminal = async () => {
      setIsInitializing(true);

      const xterm = new XTerm({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, "Courier New", monospace',
        theme: {
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#d4d4d4',
          cursorAccent: '#1e1e1e',
          selectionBackground: '#264f78',
          black: '#000000',
          red: '#cd3131',
          green: '#0dbc79',
          yellow: '#e5e510',
          blue: '#2472c8',
          magenta: '#bc3fbc',
          cyan: '#11a8cd',
          white: '#e5e5e5',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#e5e5e5',
        },
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      xterm.loadAddon(fitAddon);
      xterm.open(terminalRef.current!);
      
      xtermRef.current = xterm;
      fitAddonRef.current = fitAddon;

      // Fit after a short delay to ensure DOM is ready
      setTimeout(() => {
        fitAddon.fit();
      }, 100);

      const cols = xterm.cols;
      const rows = xterm.rows;

      // Create PTY in sandbox
      const terminal = await onCreateTerminal(cols, rows, (data: Uint8Array) => {
        xterm.write(data);
      });

      if (terminal) {
        // Handle user input
        xterm.onData((data) => {
          onSendInput(data);
        });

        setIsTerminalReady(true);
      }

      setIsInitializing(false);
    };

    initTerminal();

    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, [isConnected, onCreateTerminal, onSendInput]);

  // Handle resize
  useEffect(() => {
    if (!fitAddonRef.current || !xtermRef.current || !isTerminalReady) {
      return;
    }

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        onResize(xtermRef.current.cols, xtermRef.current.rows);
      }
    };

    window.addEventListener('resize', handleResize);
    
    // Also resize when expanded state changes
    setTimeout(handleResize, 100);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isTerminalReady, onResize, isExpanded]);

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-[#1e1e1e]">
        <TerminalSquare size={48} className="mb-4 opacity-20" />
        <p className="text-sm">Create a sandbox to access terminal</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-[#1e1e1e] ${isExpanded ? 'fixed inset-0 z-50' : 'h-full'}`}>
      <div className="h-8 bg-[#2d2d2d] border-b border-[#333] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <TerminalSquare size={14} className="text-green-400" />
          <span className="text-xs text-gray-400">Terminal</span>
          {isInitializing && (
            <Loader2 size={12} className="animate-spin text-blue-400" />
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white p-1"
            title={isExpanded ? 'Minimize' : 'Maximize'}
          >
            {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>
      <div 
        ref={terminalRef} 
        className="flex-1 p-2 overflow-hidden"
        style={{ minHeight: isExpanded ? 'calc(100vh - 32px)' : '200px' }}
      />
    </div>
  );
};