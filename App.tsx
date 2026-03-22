import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Sandbox } from 'e2b';
import { 
  TerminalSquare,
  Loader2,
  CheckCircle, 
  AlertCircle,
  Cloud,
  CloudOff,
  Play, 
  Square, 
  Maximize2, 
  Minimize2,
  RefreshCw
} from 'lucide-react';

// Get E2B API Key from environment variable
const E2B_API_KEY = import.meta.env.VITE_E2B_API_KEY || '';

// ============================================================================
// TYPES
// ============================================================================

interface E2BSandboxState {
  isConnected: boolean;
  isConnecting: boolean;
  sandboxId: string | null;
  error: string | null;
}

// ============================================================================
// HOOKS
// ============================================================================

const useE2BSandbox = () => {
  const [state, setState] = useState<E2BSandboxState>({
    isConnected: false,
    isConnecting: false,
    sandboxId: null,
    error: null,
  });

  const sandboxRef = useRef<Sandbox | null>(null);
  const terminalRef = useRef<{ pid: number; dataCallback: (data: Uint8Array) => void } | null>(null);

  const createSandbox = useCallback(async () => {
    if (!E2B_API_KEY) {
      setState(prev => ({ ...prev, error: 'E2B API key not configured. Please set VITE_E2B_API_KEY in your .env file.' }));
      return null;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const sandbox = await Sandbox.create({
        apiKey: E2B_API_KEY,
        timeoutMs: 60 * 60 * 1000,
      });

      sandboxRef.current = sandbox;

      setState(prev => ({
        ...prev,
        isConnected: true,
        isConnecting: false,
        sandboxId: sandbox.sandboxId,
        error: null,
      }));

      return sandbox;
    } catch (error: any) {
      console.error('Failed to create sandbox:', error);
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error.message || 'Failed to create sandbox',
      }));
      return null;
    }
  }, []);

  const createTerminal = useCallback(async (
    cols: number,
    rows: number,
    onData: (data: Uint8Array) => void
  ) => {
    if (!sandboxRef.current) {
      console.error('No sandbox connected');
      return null;
    }

    try {
      const terminal = await sandboxRef.current.pty.create({
        cols,
        rows,
        onData: (data: Uint8Array) => {
          if (terminalRef.current?.dataCallback) {
            terminalRef.current.dataCallback(data);
          }
        },
        timeoutMs: 0,
      });

      terminalRef.current = { pid: terminal.pid, dataCallback: onData };
      return terminal;
    } catch (error: any) {
      console.error('Failed to create terminal:', error);
      setState(prev => ({ ...prev, error: error.message }));
      return null;
    }
  }, []);

  const sendTerminalInput = useCallback(async (data: string) => {
    if (!sandboxRef.current || !terminalRef.current) {
      return;
    }

    try {
      await sandboxRef.current.pty.sendInput(
        terminalRef.current.pid,
        new TextEncoder().encode(data)
      );
    } catch (error: any) {
      console.error('Failed to send terminal input:', error);
    }
  }, []);

  const resizeTerminal = useCallback(async (cols: number, rows: number) => {
    if (!sandboxRef.current || !terminalRef.current) {
      return;
    }

    try {
      await sandboxRef.current.pty.resize(terminalRef.current.pid, { cols, rows });
    } catch (error: any) {
      console.error('Failed to resize terminal:', error);
    }
  }, []);

  const disconnectSandbox = useCallback(async () => {
    if (sandboxRef.current) {
      try {
        await sandboxRef.current.kill();
      } catch (error) {
        console.error('Error killing sandbox:', error);
      }
      sandboxRef.current = null;
      terminalRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      sandboxId: null,
    }));
  }, []);

  return {
    ...state,
    createSandbox,
    createTerminal,
    sendTerminalInput,
    resizeTerminal,
    disconnectSandbox,
  };
};

// ============================================================================
// TERMINAL COMPONENT
// ============================================================================

interface TerminalComponentProps {
  isConnected: boolean;
  onCreateTerminal: (cols: number, rows: number, onData: (data: Uint8Array) => void) => Promise<any>;
  onSendInput: (data: string) => Promise<void>;
  onResize: (cols: number, rows: number) => Promise<void>;
}

const TerminalComponent: React.FC<TerminalComponentProps> = ({
  isConnected,
  onCreateTerminal,
  onSendInput,
  onResize,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalDivRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const initializeTerminal = useCallback(async () => {
    if (!terminalDivRef.current || xtermRef.current) return;

    setIsInitializing(true);

    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#264f78',
        black: '#484f58',
        red: '#ff7b72',
        green: '#3fb950',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
      allowProposedApi: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);
    xterm.open(terminalDivRef.current);

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    setTimeout(() => {
      fitAddon.fit();
    }, 100);

    const cols = xterm.cols;
    const rows = xterm.rows;

    const terminal = await onCreateTerminal(cols, rows, (data: Uint8Array) => {
      xterm.write(data);
    });

    if (terminal) {
      xterm.onData((data) => {
        onSendInput(data);
      });
      setIsReady(true);
    }

    setIsInitializing(false);
  }, [onCreateTerminal, onSendInput]);

  useEffect(() => {
    if (isConnected && !xtermRef.current) {
      const timer = setTimeout(() => {
        initializeTerminal();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isConnected, initializeTerminal]);

  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        onResize(xtermRef.current.cols, xtermRef.current.rows);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [onResize]);

  useEffect(() => {
    if (fitAddonRef.current && xtermRef.current) {
      setTimeout(() => {
        fitAddonRef.current?.fit();
        xtermRef.current?.focus();
      }, 100);
    }
  }, [isExpanded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
        fitAddonRef.current = null;
      }
    };
  }, []);

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-[#0d1117]">
        <TerminalSquare size={64} className="mb-6 opacity-30" />
        <p className="text-lg font-medium">Terminal Not Available</p>
        <p className="text-sm text-gray-500 mt-2">Create a sandbox to access the terminal</p>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={`flex flex-col bg-[#0d1117] ${isExpanded ? 'fixed inset-0 z-50' : 'h-full'}`}
    >
      <div className="h-10 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center">
          <TerminalSquare size={16} className="text-green-400 mr-2" />
          <span className="text-sm font-medium text-gray-200">Terminal</span>
          {isInitializing && (
            <Loader2 size={14} className="animate-spin ml-2 text-blue-400" />
          )}
          {isReady && (
            <span className="ml-2 text-xs text-green-400 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 mr-1"></span>
              Connected
            </span>
          )}
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-white p-1.5 hover:bg-[#30363d] rounded transition-colors"
          title={isExpanded ? 'Minimize' : 'Maximize'}
        >
          {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div
          ref={terminalDivRef}
          className="absolute inset-0 p-2"
          style={{ minHeight: isExpanded ? 'calc(100vh - 40px)' : '100%' }}
        />
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

const App = () => {
  const {
    isConnected,
    isConnecting,
    sandboxId,
    error: sandboxError,
    createSandbox,
    createTerminal,
    sendTerminalInput,
    resizeTerminal,
    disconnectSandbox,
  } = useE2BSandbox();

  const hasApiKey = !!E2B_API_KEY;

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-gray-300 font-sans overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center space-x-3">
          <TerminalSquare size={24} className="text-green-400" />
          <h1 className="text-lg font-semibold text-white">E2B Terminal</h1>
        </div>

        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <span className="flex items-center text-sm text-green-400">
                <Cloud size={16} className="mr-1.5" />
                <span className="hidden sm:inline">Connected</span>
              </span>
            ) : isConnecting ? (
              <span className="flex items-center text-sm text-blue-400">
                <Loader2 size={16} className="mr-1.5 animate-spin" />
                <span className="hidden sm:inline">Connecting...</span>
              </span>
            ) : (
              <span className="flex items-center text-sm text-gray-500">
                <CloudOff size={16} className="mr-1.5" />
                <span className="hidden sm:inline">Disconnected</span>
              </span>
            )}
          </div>

          {/* Sandbox ID */}
          {isConnected && sandboxId && (
            <span className="hidden md:flex items-center text-xs text-gray-500 bg-[#0d1117] px-3 py-1.5 rounded-md border border-[#30363d]">
              <span className="text-gray-400 mr-1">ID:</span>
              {sandboxId.substring(0, 12)}...
            </span>
          )}

          {/* Connect/Disconnect Button */}
          {!isConnected ? (
            <button
              onClick={createSandbox}
              disabled={isConnecting || !hasApiKey}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 
                disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg py-2 px-4 text-sm font-medium
                transition-colors"
            >
              {isConnecting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Play size={16} />
                  <span>Create Sandbox</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={disconnectSandbox}
              className="flex items-center space-x-2 bg-red-600 hover:bg-red-700 
                text-white rounded-lg py-2 px-4 text-sm font-medium transition-colors"
            >
              <Square size={16} />
              <span>Stop</span>
            </button>
          )}
        </div>
      </header>

      {/* Error Banner */}
      {sandboxError && (
        <div className="bg-red-900/30 border-b border-red-800/50 px-6 py-3 flex items-center">
          <AlertCircle size={18} className="text-red-400 mr-3 flex-shrink-0" />
          <p className="text-sm text-red-300">{sandboxError}</p>
        </div>
      )}

      {/* API Key Warning */}
      {!hasApiKey && !sandboxError && (
        <div className="bg-yellow-900/30 border-b border-yellow-800/50 px-6 py-3 flex items-center">
          <AlertCircle size={18} className="text-yellow-400 mr-3 flex-shrink-0" />
          <p className="text-sm text-yellow-300">
            E2B API key not configured. Please create a <code className="bg-[#0d1117] px-1.5 py-0.5 rounded text-yellow-200">.env</code> file with <code className="bg-[#0d1117] px-1.5 py-0.5 rounded text-yellow-200">VITE_E2B_API_KEY=your_api_key</code>
          </p>
        </div>
      )}

      {/* Main Content - Terminal */}
      <main className="flex-1 overflow-hidden">
        {isConnected ? (
          <TerminalComponent
            isConnected={isConnected}
            onCreateTerminal={createTerminal}
            onSendInput={sendTerminalInput}
            onResize={resizeTerminal}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-[#0d1117] p-8">
            <div className="max-w-md text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#161b22] flex items-center justify-center">
                <TerminalSquare size={40} className="text-green-400 opacity-60" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-3">E2B Cloud Terminal</h2>
              <p className="text-gray-400 mb-6">
                Create a sandbox to get instant access to a cloud-based terminal environment. 
                Run commands, install packages, and execute code in an isolated container.
              </p>
              
              {hasApiKey ? (
                <button
                  onClick={createSandbox}
                  disabled={isConnecting}
                  className="inline-flex items-center space-x-2 bg-green-600 hover:bg-green-700 
                    disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg py-3 px-6 text-base font-medium
                    transition-colors"
                >
                  {isConnecting ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Creating Sandbox...</span>
                    </>
                  ) : (
                    <>
                      <Play size={20} />
                      <span>Create Sandbox</span>
                    </>
                  )}
                </button>
              ) : (
                <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-4 text-left">
                  <p className="text-sm text-gray-300 mb-3">To get started, configure your E2B API key:</p>
                  <ol className="text-sm text-gray-400 space-y-2">
                    <li className="flex items-start">
                      <span className="bg-[#30363d] text-gray-300 w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">1</span>
                      <span>Get your API key from <a href="https://e2b.dev/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">e2b.dev/dashboard</a></span>
                    </li>
                    <li className="flex items-start">
                      <span className="bg-[#30363d] text-gray-300 w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">2</span>
                      <span>Create a <code className="bg-[#0d1117] px-1.5 py-0.5 rounded">.env</code> file in the project root</span>
                    </li>
                    <li className="flex items-start">
                      <span className="bg-[#30363d] text-gray-300 w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">3</span>
                      <span>Add <code className="bg-[#0d1117] px-1.5 py-0.5 rounded">VITE_E2B_API_KEY=your_key</code></span>
                    </li>
                    <li className="flex items-start">
                      <span className="bg-[#30363d] text-gray-300 w-5 h-5 rounded-full flex items-center justify-center text-xs mr-2 mt-0.5 flex-shrink-0">4</span>
                      <span>Restart the development server</span>
                    </li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="h-7 bg-[#161b22] border-t border-[#30363d] flex items-center px-4 text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          {isConnected && (
            <span className="flex items-center text-green-400">
              <CheckCircle size={12} className="mr-1" />
              Sandbox Active
            </span>
          )}
          <span>E2B Terminal</span>
        </div>
        <div className="ml-auto flex items-center space-x-4">
          {sandboxId && (
            <span className="text-gray-600">
              {sandboxId}
            </span>
          )}
        </div>
      </footer>
    </div>
  );
};

export default App;