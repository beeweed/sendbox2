import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { TerminalSquare, Loader2, Maximize2, Minimize2, RefreshCw, Plus, X } from 'lucide-react';

interface TerminalInstance {
  id: string;
  name: string;
  xterm: XTerm | null;
  fitAddon: FitAddon | null;
  isReady: boolean;
}

interface TerminalProps {
  isConnected: boolean;
  onCreateTerminal: (terminalId: string, cols: number, rows: number, onData: (data: Uint8Array) => void) => Promise<any>;
  onSendInput: (terminalId: string, data: string) => Promise<void>;
  onResize: (terminalId: string, cols: number, rows: number) => Promise<void>;
  onCloseTerminal: (terminalId: string) => Promise<void>;
  onCommandComplete?: () => void;
}

export const Terminal: React.FC<TerminalProps> = ({
  isConnected,
  onCreateTerminal,
  onSendInput,
  onResize,
  onCloseTerminal,
  onCommandComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoSync, setAutoSync] = useState(true);
  const [terminalCounter, setTerminalCounter] = useState(1);
  
  const syncDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const xtermInstancesRef = useRef<Map<string, { xterm: XTerm; fitAddon: FitAddon }>>(new Map());

  const triggerSync = useCallback(() => {
    if (!autoSync || !onCommandComplete) return;
    
    if (syncDebounceRef.current) {
      clearTimeout(syncDebounceRef.current);
    }
    
    syncDebounceRef.current = setTimeout(() => {
      onCommandComplete();
    }, 1500);
  }, [autoSync, onCommandComplete]);

  const createNewTerminal = useCallback(async () => {
    if (!isConnected) return;

    const terminalId = `terminal-${Date.now()}`;
    const terminalName = `Terminal ${terminalCounter}`;
    setTerminalCounter(prev => prev + 1);

    const newTerminal: TerminalInstance = {
      id: terminalId,
      name: terminalName,
      xterm: null,
      fitAddon: null,
      isReady: false,
    };

    setTerminals(prev => [...prev, newTerminal]);
    setActiveTerminalId(terminalId);
    setIsInitializing(terminalId);
  }, [isConnected, terminalCounter]);

  const initializeTerminal = useCallback(async (terminalId: string) => {
    const terminalDiv = terminalRefs.current.get(terminalId);
    if (!terminalDiv || xtermInstancesRef.current.has(terminalId)) return;

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
    xterm.open(terminalDiv);

    xtermInstancesRef.current.set(terminalId, { xterm, fitAddon });

    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    const cols = xterm.cols;
    const rows = xterm.rows;

    const terminal = await onCreateTerminal(terminalId, cols, rows, (data: Uint8Array) => {
      xterm.write(data);
      
      const text = new TextDecoder().decode(data);
      const promptPatterns = [
        /\$\s*$/,
        />\s*$/,
        /#\s*$/,
        /\]\s*$/,
        /\~\]\$/,
      ];
      
      const hasPrompt = promptPatterns.some(pattern => pattern.test(text));
      
      if (hasPrompt) {
        triggerSync();
      }
    });

    if (terminal) {
      xterm.onData((data) => {
        onSendInput(terminalId, data);
      });

      setTerminals(prev => prev.map(t => 
        t.id === terminalId ? { ...t, xterm, fitAddon, isReady: true } : t
      ));
    }

    setIsInitializing(null);
  }, [onCreateTerminal, onSendInput, triggerSync]);

  useEffect(() => {
    if (isConnected && terminals.length === 0) {
      createNewTerminal();
    }
  }, [isConnected, terminals.length, createNewTerminal]);

  useEffect(() => {
    if (isInitializing) {
      const timer = setTimeout(() => {
        initializeTerminal(isInitializing);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isInitializing, initializeTerminal]);

  useEffect(() => {
    const handleResize = () => {
      xtermInstancesRef.current.forEach(({ xterm, fitAddon }, terminalId) => {
        fitAddon.fit();
        onResize(terminalId, xterm.cols, xterm.rows);
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [onResize]);

  useEffect(() => {
    if (activeTerminalId) {
      const instance = xtermInstancesRef.current.get(activeTerminalId);
      if (instance) {
        setTimeout(() => {
          instance.fitAddon.fit();
          instance.xterm.focus();
        }, 100);
      }
    }
  }, [activeTerminalId, isExpanded]);

  const handleCloseTerminal = useCallback(async (terminalId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const instance = xtermInstancesRef.current.get(terminalId);
    if (instance) {
      instance.xterm.dispose();
      xtermInstancesRef.current.delete(terminalId);
    }
    
    await onCloseTerminal(terminalId);
    terminalRefs.current.delete(terminalId);
    
    setTerminals(prev => {
      const newTerminals = prev.filter(t => t.id !== terminalId);
      if (activeTerminalId === terminalId && newTerminals.length > 0) {
        setActiveTerminalId(newTerminals[newTerminals.length - 1].id);
      } else if (newTerminals.length === 0) {
        setActiveTerminalId(null);
      }
      return newTerminals;
    });
  }, [activeTerminalId, onCloseTerminal]);

  const handleManualSync = () => {
    if (onCommandComplete) {
      onCommandComplete();
    }
  };

  const setTerminalRef = useCallback((terminalId: string, el: HTMLDivElement | null) => {
    if (el) {
      terminalRefs.current.set(terminalId, el);
    }
  }, []);

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-[#1e1e1e]">
        <TerminalSquare size={48} className="mb-4 opacity-20" />
        <p className="text-sm">Create a sandbox to access terminal</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`flex flex-col bg-[#1e1e1e] ${isExpanded ? 'fixed inset-0 z-50' : 'h-full'}`}>
      <div className="h-8 bg-[#2d2d2d] border-b border-[#333] flex items-center justify-between px-1 flex-shrink-0">
        <div className="flex items-center flex-1 overflow-x-auto no-scrollbar">
          {terminals.map((terminal) => (
            <div
              key={terminal.id}
              onClick={() => setActiveTerminalId(terminal.id)}
              className={`
                flex items-center px-3 py-1 text-xs cursor-pointer select-none min-w-[100px] max-w-[150px] group
                ${terminal.id === activeTerminalId 
                  ? 'bg-[#1e1e1e] text-green-400 border-t border-l border-r border-[#333]' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-[#333]'}
              `}
            >
              <TerminalSquare size={12} className="mr-1.5 flex-shrink-0" />
              <span className="truncate flex-1">{terminal.name}</span>
              {isInitializing === terminal.id && (
                <Loader2 size={10} className="animate-spin ml-1 flex-shrink-0" />
              )}
              {terminals.length > 1 && (
                <button
                  onClick={(e) => handleCloseTerminal(terminal.id, e)}
                  className="ml-1 p-0.5 opacity-0 group-hover:opacity-100 hover:bg-[#555] rounded flex-shrink-0"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
          
          <button
            onClick={createNewTerminal}
            className="flex items-center justify-center w-7 h-7 text-gray-500 hover:text-white hover:bg-[#444] rounded ml-1 flex-shrink-0"
            title="New Terminal"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
          <button
            onClick={() => setAutoSync(!autoSync)}
            className={`text-[10px] px-2 py-0.5 rounded ${autoSync ? 'bg-green-600/20 text-green-400' : 'bg-gray-600/20 text-gray-400'}`}
            title={autoSync ? 'Auto-sync enabled' : 'Auto-sync disabled'}
          >
            Auto-sync: {autoSync ? 'ON' : 'OFF'}
          </button>
          
          <button
            onClick={handleManualSync}
            className="text-gray-400 hover:text-white p-1"
            title="Sync files now"
          >
            <RefreshCw size={12} />
          </button>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-white p-1"
            title={isExpanded ? 'Minimize' : 'Maximize'}
          >
            {isExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {terminals.map((terminal) => (
          <div
            key={terminal.id}
            ref={(el) => setTerminalRef(terminal.id, el)}
            className={`absolute inset-0 p-2 ${terminal.id === activeTerminalId ? 'block' : 'hidden'}`}
            style={{ minHeight: isExpanded ? 'calc(100vh - 32px)' : '200px' }}
          />
        ))}
        
        {terminals.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <TerminalSquare size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Click + to create a terminal</p>
          </div>
        )}
      </div>
    </div>
  );
};