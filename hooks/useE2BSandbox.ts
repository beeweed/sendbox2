import { useState, useCallback, useRef, useEffect } from 'react';
import { Sandbox } from 'e2b';
import type { FileSystemItem } from '../types';

export interface E2BSandboxState {
  isConnected: boolean;
  isConnecting: boolean;
  sandboxId: string | null;
  error: string | null;
  apiKey: string;
  isSyncing: boolean;
}

export interface TerminalHandle {
  pid: number;
  onData: (callback: (data: Uint8Array) => void) => void;
}

export interface FileChangeEvent {
  type: 'created' | 'modified' | 'deleted';
  path: string;
  isDirectory: boolean;
}

export const useE2BSandbox = () => {
  const [state, setState] = useState<E2BSandboxState>({
    isConnected: false,
    isConnecting: false,
    sandboxId: null,
    error: null,
    apiKey: '',
    isSyncing: false,
  });

  const sandboxRef = useRef<Sandbox | null>(null);
  const terminalsRef = useRef<Map<string, { pid: number; dataCallback: (data: Uint8Array) => void }>>(new Map());
  const fileChangeListenersRef = useRef<((event: FileChangeEvent) => void)[]>([]);
  const watcherIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFilesHashRef = useRef<Map<string, number>>(new Map());

  const setApiKey = useCallback((key: string) => {
    setState(prev => ({ ...prev, apiKey: key, error: null }));
  }, []);

  const onFileChange = useCallback((callback: (event: FileChangeEvent) => void) => {
    fileChangeListenersRef.current.push(callback);
    return () => {
      fileChangeListenersRef.current = fileChangeListenersRef.current.filter(cb => cb !== callback);
    };
  }, []);

  const notifyFileChange = useCallback((event: FileChangeEvent) => {
    fileChangeListenersRef.current.forEach(cb => cb(event));
  }, []);

  // Recursive function to list all files in a directory
  const listAllFiles = useCallback(async (
    path: string,
    result: { path: string; isDir: boolean; content?: string }[] = []
  ): Promise<{ path: string; isDir: boolean; content?: string }[]> => {
    if (!sandboxRef.current) return result;

    try {
      const files = await sandboxRef.current.files.list(path);
      
      for (const file of files) {
        const fullPath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
        
        // E2B SDK uses 'type' property with value 'dir' for directories
        const isDirectory = file.type === 'dir';
        
        if (isDirectory) {
          result.push({ path: fullPath, isDir: true });
          await listAllFiles(fullPath, result);
        } else {
          try {
            const content = await sandboxRef.current.files.read(fullPath);
            result.push({ path: fullPath, isDir: false, content });
          } catch (e) {
            // Binary file or read error, skip content
            result.push({ path: fullPath, isDir: false });
          }
        }
      }
    } catch (error) {
      console.error(`Failed to list files at ${path}:`, error);
    }

    return result;
  }, []);

  // Sync all local files to E2B sandbox
  const syncLocalToSandbox = useCallback(async (files: FileSystemItem[], basePath = '/home/user') => {
    if (!sandboxRef.current) {
      console.error('No sandbox connected');
      return false;
    }

    setState(prev => ({ ...prev, isSyncing: true }));

    try {
      // Build file tree from local files
      const buildPath = (file: FileSystemItem, allFiles: FileSystemItem[]): string => {
        const parts: string[] = [file.name];
        let current = file;
        
        while (current.parentId && current.parentId !== 'root') {
          const parent = allFiles.find(f => f.id === current.parentId);
          if (parent) {
            parts.unshift(parent.name);
            current = parent;
          } else {
            break;
          }
        }
        
        return `${basePath}/${parts.join('/')}`;
      };

      // Sort to ensure folders are created before files
      const sortedFiles = [...files]
        .filter(f => f.id !== 'root')
        .sort((a, b) => {
          if (a.type === 'folder' && b.type !== 'folder') return -1;
          if (a.type !== 'folder' && b.type === 'folder') return 1;
          return 0;
        });

      for (const file of sortedFiles) {
        const fullPath = buildPath(file, files);
        
        if (file.type === 'folder') {
          try {
            await sandboxRef.current.files.makeDir(fullPath);
          } catch (e) {
            // Folder might already exist
          }
        } else if (file.content !== undefined) {
          await sandboxRef.current.files.write(fullPath, file.content);
        }
      }

      setState(prev => ({ ...prev, isSyncing: false }));
      return true;
    } catch (error: any) {
      console.error('Failed to sync local to sandbox:', error);
      setState(prev => ({ ...prev, isSyncing: false, error: error.message }));
      return false;
    }
  }, []);

  // Sync files from E2B sandbox to local
  const syncSandboxToLocal = useCallback(async (
    basePath = '/home/user'
  ): Promise<FileSystemItem[]> => {
    if (!sandboxRef.current) {
      console.error('No sandbox connected');
      return [];
    }

    setState(prev => ({ ...prev, isSyncing: true }));

    try {
      const allFiles = await listAllFiles(basePath);
      const newFiles: FileSystemItem[] = [];
      const pathToIdMap = new Map<string, string>();
      
      // First, create root
      pathToIdMap.set(basePath, 'root');

      // Process files and create FileSystemItem structure
      for (const file of allFiles) {
        const relativePath = file.path.replace(basePath + '/', '');
        const parts = relativePath.split('/');
        const fileName = parts[parts.length - 1];
        
        // Determine parent path and ID
        const parentPath = parts.length > 1 
          ? basePath + '/' + parts.slice(0, -1).join('/')
          : basePath;
        const parentId = pathToIdMap.get(parentPath) || 'root';
        
        // Create unique ID
        const id = `e2b-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        pathToIdMap.set(file.path, id);

        const newFile: FileSystemItem = {
          id,
          parentId,
          name: fileName,
          type: file.isDir ? 'folder' : 'file',
          content: file.isDir ? undefined : (file.content || ''),
          isOpen: file.isDir ? true : undefined,
        };

        newFiles.push(newFile);
      }

      setState(prev => ({ ...prev, isSyncing: false }));
      return newFiles;
    } catch (error: any) {
      console.error('Failed to sync sandbox to local:', error);
      setState(prev => ({ ...prev, isSyncing: false, error: error.message }));
      return [];
    }
  }, [listAllFiles]);

  // Start watching for file changes using polling (WebSocket alternative for E2B)
  const startFileWatcher = useCallback((basePath = '/home/user') => {
    if (watcherIntervalRef.current) {
      clearInterval(watcherIntervalRef.current);
    }

    const checkForChanges = async () => {
      if (!sandboxRef.current) return;

      try {
        const files = await listAllFiles(basePath);
        const currentHash = new Map<string, number>();

        for (const file of files) {
          const hash = file.content ? file.content.length : (file.isDir ? 0 : -1);
          currentHash.set(file.path, hash);

          const lastHash = lastFilesHashRef.current.get(file.path);
          if (lastHash === undefined) {
            // New file
            notifyFileChange({
              type: 'created',
              path: file.path,
              isDirectory: file.isDir,
            });
          } else if (lastHash !== hash) {
            // Modified file
            notifyFileChange({
              type: 'modified',
              path: file.path,
              isDirectory: file.isDir,
            });
          }
        }

        // Check for deleted files
        for (const [path] of lastFilesHashRef.current) {
          if (!currentHash.has(path)) {
            notifyFileChange({
              type: 'deleted',
              path,
              isDirectory: false,
            });
          }
        }

        lastFilesHashRef.current = currentHash;
      } catch (error) {
        console.error('Error checking for file changes:', error);
      }
    };

    // Poll every 2 seconds
    watcherIntervalRef.current = setInterval(checkForChanges, 2000);

    // Initial check
    checkForChanges();
  }, [listAllFiles, notifyFileChange]);

  const stopFileWatcher = useCallback(() => {
    if (watcherIntervalRef.current) {
      clearInterval(watcherIntervalRef.current);
      watcherIntervalRef.current = null;
    }
    lastFilesHashRef.current.clear();
  }, []);

  const createSandbox = useCallback(async () => {
    if (!state.apiKey) {
      setState(prev => ({ ...prev, error: 'Please enter your E2B API key' }));
      return null;
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

      // Start file watcher
      startFileWatcher('/home/user');

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
  }, [state.apiKey, startFileWatcher]);

  const createTerminal = useCallback(async (
    terminalId: string,
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
          const terminalInfo = terminalsRef.current.get(terminalId);
          if (terminalInfo?.dataCallback) {
            terminalInfo.dataCallback(data);
          }
        },
        timeoutMs: 0, // No timeout for terminal
      });

      terminalsRef.current.set(terminalId, { pid: terminal.pid, dataCallback: onData });
      return terminal;
    } catch (error: any) {
      console.error('Failed to create terminal:', error);
      setState(prev => ({ ...prev, error: error.message }));
      return null;
    }
  }, []);

  const sendTerminalInput = useCallback(async (terminalId: string, data: string) => {
    const terminalInfo = terminalsRef.current.get(terminalId);
    if (!sandboxRef.current || !terminalInfo) {
      return;
    }

    try {
      await sandboxRef.current.pty.sendInput(
        terminalInfo.pid,
        new TextEncoder().encode(data)
      );
    } catch (error: any) {
      console.error('Failed to send terminal input:', error);
    }
  }, []);

  const resizeTerminal = useCallback(async (terminalId: string, cols: number, rows: number) => {
    const terminalInfo = terminalsRef.current.get(terminalId);
    if (!sandboxRef.current || !terminalInfo) {
      return;
    }

    try {
      await sandboxRef.current.pty.resize(terminalInfo.pid, { cols, rows });
    } catch (error: any) {
      console.error('Failed to resize terminal:', error);
    }
  }, []);

  const closeTerminal = useCallback(async (terminalId: string) => {
    const terminalInfo = terminalsRef.current.get(terminalId);
    if (!sandboxRef.current || !terminalInfo) {
      return;
    }

    try {
      await sandboxRef.current.pty.kill(terminalInfo.pid);
      terminalsRef.current.delete(terminalId);
    } catch (error: any) {
      console.error('Failed to close terminal:', error);
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

  const deleteFile = useCallback(async (path: string) => {
    if (!sandboxRef.current) {
      return false;
    }

    try {
      await sandboxRef.current.files.remove(path);
      return true;
    } catch (error: any) {
      console.error('Failed to delete file:', error);
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
    stopFileWatcher();

    if (sandboxRef.current) {
      try {
        await sandboxRef.current.kill();
      } catch (error) {
        console.error('Error killing sandbox:', error);
      }
      sandboxRef.current = null;
      terminalsRef.current.clear();
    }

    setState(prev => ({
      ...prev,
      isConnected: false,
      sandboxId: null,
    }));
  }, [stopFileWatcher]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopFileWatcher();
    };
  }, [stopFileWatcher]);

  return {
    ...state,
    setApiKey,
    createSandbox,
    createTerminal,
    sendTerminalInput,
    resizeTerminal,
    closeTerminal,
    writeFile,
    readFile,
    listFiles,
    makeDirectory,
    deleteFile,
    getPreviewUrl,
    runCommand,
    disconnectSandbox,
    syncLocalToSandbox,
    syncSandboxToLocal,
    onFileChange,
    startFileWatcher,
    stopFileWatcher,
    sandbox: sandboxRef.current,
  };
};