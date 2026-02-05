import { useState, useCallback, useRef } from 'react';
import { Sandbox } from 'e2b';

export interface E2BSandboxState {
  isConnected: boolean;
  isConnecting: boolean;
  sandboxId: string | null;
  error: string | null;
  apiKey: string;
}

export interface TerminalHandle {
  pid: number;
  onData: (callback: (data: Uint8Array) => void) => void;
}

export const useE2BSandbox = () => {
  const [state, setState] = useState<E2BSandboxState>({
    isConnected: false,
    isConnecting: false,
    sandboxId: null,
    error: null,
    apiKey: '',
  });

  const sandboxRef = useRef<Sandbox | null>(null);
  const terminalPidRef = useRef<number | null>(null);
  const dataCallbackRef = useRef<((data: Uint8Array) => void) | null>(null);

  const setApiKey = useCallback((key: string) => {
    setState(prev => ({ ...prev, apiKey: key, error: null }));
  }, []);

  const createSandbox = useCallback(async () => {
    if (!state.apiKey) {
      setState(prev => ({ ...prev, error: 'Please enter your E2B API key' }));
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const sandbox = await Sandbox.create({
        apiKey: state.apiKey,
        timeoutMs: 60 * 60 * 1000, // 1 hour timeout
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
  }, [state.apiKey]);

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
      dataCallbackRef.current = onData;
      
      const terminal = await sandboxRef.current.pty.create({
        cols,
        rows,
        onData: (data: Uint8Array) => {
          if (dataCallbackRef.current) {
            dataCallbackRef.current(data);
          }
        },
        timeoutMs: 0, // No timeout for terminal
      });

      terminalPidRef.current = terminal.pid;
      return terminal;
    } catch (error: any) {
      console.error('Failed to create terminal:', error);
      setState(prev => ({ ...prev, error: error.message }));
      return null;
    }
  }, []);

  const sendTerminalInput = useCallback(async (data: string) => {
    if (!sandboxRef.current || terminalPidRef.current === null) {
      return;
    }

    try {
      await sandboxRef.current.pty.sendInput(
        terminalPidRef.current,
        new TextEncoder().encode(data)
      );
    } catch (error: any) {
      console.error('Failed to send terminal input:', error);
    }
  }, []);

  const resizeTerminal = useCallback(async (cols: number, rows: number) => {
    if (!sandboxRef.current || terminalPidRef.current === null) {
      return;
    }

    try {
      await sandboxRef.current.pty.resize(terminalPidRef.current, { cols, rows });
    } catch (error: any) {
      console.error('Failed to resize terminal:', error);
    }
  }, []);

  const writeFile = useCallback(async (path: string, content: string) => {
    if (!sandboxRef.current) {
      return false;
    }

    try {
      await sandboxRef.current.files.write(path, content);
      return true;
    } catch (error: any) {
      console.error('Failed to write file:', error);
      return false;
    }
  }, []);

  const readFile = useCallback(async (path: string): Promise<string | null> => {
    if (!sandboxRef.current) {
      return null;
    }

    try {
      const content = await sandboxRef.current.files.read(path);
      return content;
    } catch (error: any) {
      console.error('Failed to read file:', error);
      return null;
    }
  }, []);

  const listFiles = useCallback(async (path: string) => {
    if (!sandboxRef.current) {
      return [];
    }

    try {
      const files = await sandboxRef.current.files.list(path);
      return files;
    } catch (error: any) {
      console.error('Failed to list files:', error);
      return [];
    }
  }, []);

  const makeDirectory = useCallback(async (path: string) => {
    if (!sandboxRef.current) {
      return false;
    }

    try {
      await sandboxRef.current.files.makeDir(path);
      return true;
    } catch (error: any) {
      console.error('Failed to create directory:', error);
      return false;
    }
  }, []);

  const getPreviewUrl = useCallback((port: number): string | null => {
    if (!state.sandboxId) {
      return null;
    }
    return `https://${port}-${state.sandboxId}.e2b.app`;
  }, [state.sandboxId]);

  const runCommand = useCallback(async (command: string, background: boolean = false) => {
    if (!sandboxRef.current) {
      return null;
    }

    try {
      const result = await sandboxRef.current.commands.run(command, { background });
      return result;
    } catch (error: any) {
      console.error('Failed to run command:', error);
      return null;
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
      terminalPidRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      sandboxId: null,
    }));
  }, []);

  return {
    ...state,
    setApiKey,
    createSandbox,
    createTerminal,
    sendTerminalInput,
    resizeTerminal,
    writeFile,
    readFile,
    listFiles,
    makeDirectory,
    getPreviewUrl,
    runCommand,
    disconnectSandbox,
    sandbox: sandboxRef.current,
  };
};