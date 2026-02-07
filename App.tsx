import React, { useState, useEffect, useCallback, useRef } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { Sandbox } from 'e2b';
import { 
  Menu, 
  X, 
  FolderPlus, 
  FilePlus,
  TerminalSquare,
  Globe,
  PanelRightOpen,
  PanelRightClose,
  RefreshCw,
  Upload,
  Download,
  Loader2,
  Folder, 
  FolderOpen, 
  FileCode, 
  File, 
  ChevronRight, 
  ChevronDown,
  Key, 
  Play, 
  Square, 
  CheckCircle, 
  AlertCircle,
  Eye,
  EyeOff,
  Cloud,
  CloudOff,
  ExternalLink,
  Monitor,
  Smartphone,
  Tablet,
  Maximize2, 
  Minimize2,
  Plus
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type FileType = 'file' | 'folder';

export interface FileSystemItem {
  id: string;
  parentId: string | null;
  name: string;
  type: FileType;
  content?: string;
  isOpen?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

interface CreationState {
  parentId: string;
  type: 'file' | 'folder';
}

interface SyncCallbacks {
  writeFile?: (path: string, content: string) => Promise<boolean>;
  makeDirectory?: (path: string) => Promise<boolean>;
  deleteFile?: (path: string) => Promise<boolean>;
}

interface E2BSandboxState {
  isConnected: boolean;
  isConnecting: boolean;
  sandboxId: string | null;
  error: string | null;
  apiKey: string;
  isSyncing: boolean;
}

interface TerminalHandle {
  pid: number;
  onData: (callback: (data: Uint8Array) => void) => void;
}

interface FileChangeEvent {
  type: 'created' | 'modified' | 'deleted';
  path: string;
  isDirectory: boolean;
}

interface TerminalInstance {
  id: string;
  name: string;
  xterm: XTerm | null;
  fitAddon: FitAddon | null;
  isReady: boolean;
}

type RightPanelTab = 'preview';
type BottomPanelTab = 'terminal';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';

// ============================================================================
// CONSTANTS
// ============================================================================

const INITIAL_FILES: FileSystemItem[] = [
  {
    id: 'root',
    parentId: null,
    name: 'root',
    type: 'folder',
    isOpen: true,
  }
];

const GEMINI_MODEL_CODE = 'gemini-3-pro-preview';

const deviceSizes: Record<DeviceMode, { width: string; label: string }> = {
  desktop: { width: '100%', label: 'Desktop' },
  tablet: { width: '768px', label: 'Tablet' },
  mobile: { width: '375px', label: 'Mobile' },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

// ============================================================================
// HOOKS
// ============================================================================

// useFileSystem Hook
const useFileSystem = () => {
  const [files, setFiles] = useState<FileSystemItem[]>(INITIAL_FILES);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const syncCallbacksRef = useRef<SyncCallbacks>({});

  const setSyncCallbacks = useCallback((callbacks: SyncCallbacks) => {
    syncCallbacksRef.current = callbacks;
  }, []);

  const getFilePath = useCallback((fileId: string, fileList?: FileSystemItem[]): string => {
    const currentFiles = fileList || files;
    const file = currentFiles.find(f => f.id === fileId);
    if (!file) return '';
    
    const pathParts: string[] = [file.name];
    let currentParentId = file.parentId;
    
    while (currentParentId && currentParentId !== 'root') {
      const parent = currentFiles.find(f => f.id === currentParentId);
      if (parent) {
        pathParts.unshift(parent.name);
        currentParentId = parent.parentId;
      } else {
        break;
      }
    }
    
    return '/home/user/' + pathParts.join('/');
  }, [files]);

  const getChildren = useCallback((parentId: string | null) => {
    return files.filter(f => f.parentId === parentId).sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'folder' ? -1 : 1;
    });
  }, [files]);

  const openFileById = useCallback((id: string) => {
    setOpenFiles(prev => {
      if (!prev.includes(id)) {
        return [...prev, id];
      }
      return prev;
    });
    setActiveFileId(id);
  }, []);

  const createFile = useCallback(async (parentId: string, name: string, type: 'file' | 'folder') => {
    const newFile: FileSystemItem = {
      id: `${Date.now()}`,
      parentId,
      name,
      type,
      content: type === 'file' ? '' : undefined,
      isOpen: type === 'folder' ? true : undefined,
    };
    
    setFiles(prev => [...prev, newFile]);
    
    const filePath = (() => {
      const pathParts: string[] = [name];
      let currentParentId = parentId;
      
      const currentFiles = [...files, newFile];
      while (currentParentId && currentParentId !== 'root') {
        const parent = currentFiles.find(f => f.id === currentParentId);
        if (parent) {
          pathParts.unshift(parent.name);
          currentParentId = parent.parentId;
        } else {
          break;
        }
      }
      
      return '/home/user/' + pathParts.join('/');
    })();

    if (type === 'folder' && syncCallbacksRef.current.makeDirectory) {
      setIsSyncing(true);
      await syncCallbacksRef.current.makeDirectory(filePath);
      setIsSyncing(false);
    } else if (type === 'file' && syncCallbacksRef.current.writeFile) {
      setIsSyncing(true);
      await syncCallbacksRef.current.writeFile(filePath, '');
      setIsSyncing(false);
      openFileById(newFile.id);
    }
    
    if (type === 'file') {
      openFileById(newFile.id);
    }
  }, [files, openFileById]);

  const updateFileContent = useCallback(async (id: string, newContent: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, content: newContent } : f));
    
    const file = files.find(f => f.id === id);
    if (file && syncCallbacksRef.current.writeFile) {
      const filePath = getFilePath(id);
      if (filePath) {
        await syncCallbacksRef.current.writeFile(filePath, newContent);
      }
    }
  }, [files, getFilePath]);

  const deleteFileItem = useCallback(async (id: string) => {
    const file = files.find(f => f.id === id);
    if (!file) return;

    const filePath = getFilePath(id);
    
    const getDescendants = (parentId: string): string[] => {
      const children = files.filter(f => f.parentId === parentId);
      let descendants: string[] = [];
      for (const child of children) {
        descendants.push(child.id);
        if (child.type === 'folder') {
          descendants = [...descendants, ...getDescendants(child.id)];
        }
      }
      return descendants;
    };

    const idsToDelete = [id, ...getDescendants(id)];
    
    setOpenFiles(prev => prev.filter(fid => !idsToDelete.includes(fid)));
    
    if (activeFileId && idsToDelete.includes(activeFileId)) {
      const remainingOpen = openFiles.filter(fid => !idsToDelete.includes(fid));
      setActiveFileId(remainingOpen.length > 0 ? remainingOpen[remainingOpen.length - 1] : null);
    }
    
    setFiles(prev => prev.filter(f => !idsToDelete.includes(f.id)));
    
    if (syncCallbacksRef.current.deleteFile && filePath) {
      setIsSyncing(true);
      await syncCallbacksRef.current.deleteFile(filePath);
      setIsSyncing(false);
    }
  }, [files, activeFileId, openFiles, getFilePath]);

  const toggleFolder = useCallback((id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, isOpen: !f.isOpen } : f));
  }, []);

  const expandFolder = useCallback((id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, isOpen: true } : f));
  }, []);

  const openFile = useCallback((id: string) => {
    openFileById(id);
  }, [openFileById]);

  const closeFile = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenFiles(prev => {
      const newOpen = prev.filter(fid => fid !== id);
      if (activeFileId === id) {
        setActiveFileId(newOpen.length > 0 ? newOpen[newOpen.length - 1] : null);
      }
      return newOpen;
    });
  }, [activeFileId]);

  const getActiveFile = useCallback(() => files.find(f => f.id === activeFileId), [files, activeFileId]);

  const resetFiles = useCallback(() => {
    setFiles(INITIAL_FILES);
    setOpenFiles([]);
    setActiveFileId(null);
  }, []);

  const replaceWithSandboxFiles = useCallback((newFiles: FileSystemItem[]) => {
    const root = INITIAL_FILES.find(f => f.id === 'root');
    setFiles([root!, ...newFiles]);
    setOpenFiles([]);
    setActiveFileId(null);
  }, []);

  const mergeWithSandboxFiles = useCallback((sandboxFiles: FileSystemItem[]) => {
    setFiles(prev => {
      const existingPaths = new Map<string, string>();
      
      for (const file of prev) {
        const path = getFilePath(file.id, prev);
        existingPaths.set(path, file.id);
      }

      const newFiles = [...prev];
      
      for (const sandboxFile of sandboxFiles) {
        const sandboxPath = getFilePath(sandboxFile.id, [{ id: 'root', parentId: null, name: 'root', type: 'folder' }, ...sandboxFiles]);
        
        if (!existingPaths.has(sandboxPath)) {
          newFiles.push(sandboxFile);
        } else {
          const existingId = existingPaths.get(sandboxPath);
          if (existingId && sandboxFile.type === 'file') {
            const idx = newFiles.findIndex(f => f.id === existingId);
            if (idx !== -1 && sandboxFile.content !== undefined) {
              newFiles[idx] = { ...newFiles[idx], content: sandboxFile.content };
            }
          }
        }
      }

      return newFiles;
    });
  }, [getFilePath]);

  const getAllFiles = useCallback(() => {
    return files;
  }, [files]);

  return {
    files,
    activeFileId,
    openFiles,
    isSyncing,
    getChildren,
    createFile,
    updateFileContent,
    deleteFileItem,
    toggleFolder,
    expandFolder,
    openFile,
    closeFile,
    setActiveFileId,
    getActiveFile,
    setSyncCallbacks,
    getFilePath,
    resetFiles,
    replaceWithSandboxFiles,
    mergeWithSandboxFiles,
    getAllFiles,
    setFiles,
  };
};

// useE2BSandbox Hook
const useE2BSandbox = () => {
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

  const listAllFiles = useCallback(async (
    path: string,
    result: { path: string; isDir: boolean; content?: string }[] = []
  ): Promise<{ path: string; isDir: boolean; content?: string }[]> => {
    if (!sandboxRef.current) return result;

    try {
      const files = await sandboxRef.current.files.list(path);
      
      for (const file of files) {
        const fullPath = path === '/' ? `/${file.name}` : `${path}/${file.name}`;
        const isDirectory = file.type === 'dir';
        
        if (isDirectory) {
          result.push({ path: fullPath, isDir: true });
          await listAllFiles(fullPath, result);
        } else {
          try {
            const content = await sandboxRef.current.files.read(fullPath);
            result.push({ path: fullPath, isDir: false, content });
          } catch (e) {
            result.push({ path: fullPath, isDir: false });
          }
        }
      }
    } catch (error) {
      console.error(`Failed to list files at ${path}:`, error);
    }

    return result;
  }, []);

  const syncLocalToSandbox = useCallback(async (files: FileSystemItem[], basePath = '/home/user') => {
    if (!sandboxRef.current) {
      console.error('No sandbox connected');
      return false;
    }

    setState(prev => ({ ...prev, isSyncing: true }));

    try {
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
      
      pathToIdMap.set(basePath, 'root');

      for (const file of allFiles) {
        const relativePath = file.path.replace(basePath + '/', '');
        const parts = relativePath.split('/');
        const fileName = parts[parts.length - 1];
        
        const parentPath = parts.length > 1 
          ? basePath + '/' + parts.slice(0, -1).join('/')
          : basePath;
        const parentId = pathToIdMap.get(parentPath) || 'root';
        
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
            notifyFileChange({
              type: 'created',
              path: file.path,
              isDirectory: file.isDir,
            });
          } else if (lastHash !== hash) {
            notifyFileChange({
              type: 'modified',
              path: file.path,
              isDirectory: file.isDir,
            });
          }
        }

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

    watcherIntervalRef.current = setInterval(checkForChanges, 2000);
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
        timeoutMs: 0,
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

// ============================================================================
// COMPONENTS
// ============================================================================

// CodeEditor Component
interface EditorProps {
  file: FileSystemItem | undefined;
  onChange: (id: string, content: string) => void;
}

const CodeEditor: React.FC<EditorProps> = ({ file, onChange }) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleBeforeMount = useCallback((monaco: Monaco) => {
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
          renderLineHighlight: 'none',
          highlightActiveIndentGuide: false,
          occurrencesHighlight: 'off',
          selectionHighlight: false,
          renderValidationDecorations: 'off',
          guides: {
            indentation: false,
            highlightActiveIndentation: false,
            bracketPairs: false,
            bracketPairsHorizontal: false,
          },
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
          hover: { enabled: false },
          quickSuggestions: false,
          parameterHints: { enabled: false },
          suggestOnTriggerCharacters: false,
          acceptSuggestionOnEnter: 'off',
          tabCompletion: 'off',
          wordBasedSuggestions: 'off',
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

// CreationForm Component
const CreationForm: React.FC<{
  type: 'file' | 'folder';
  level: number;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}> = ({ type, level, onSubmit, onCancel }) => {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    } else {
      onCancel();
    }
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="flex items-center px-2 py-1 bg-[#2a2a2b] border-l-2 border-blue-500"
      style={{ paddingLeft: `${level * 12 + 8}px` }}
      onClick={e => e.stopPropagation()}
    >
      <span className="mr-2 text-gray-400">
        {type === 'folder' ? <Folder size={16} className="text-yellow-500"/> : <File size={16} className="text-blue-400"/>}
      </span>
      <input
        ref={inputRef}
        type="text"
        className="bg-transparent text-white outline-none w-full text-xs placeholder-gray-500"
        placeholder={type === 'folder' ? "Folder name..." : "File name..."}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
             onCancel();
          }
        }}
      />
    </form>
  );
};

// FileTree Component
interface FileTreeProps {
  parentId: string | null;
  level?: number;
  files: FileSystemItem[];
  activeFileId: string | null;
  creationState: CreationState | null;
  onToggleFolder: (id: string) => void;
  onOpenFile: (id: string) => void;
  onStartCreating: (parentId: string, type: 'file' | 'folder') => void;
  onCancelCreating: () => void;
  onCreate: (parentId: string, name: string, type: 'file' | 'folder') => void;
}

const FileTree: React.FC<FileTreeProps> = ({
  parentId,
  level = 0,
  files,
  activeFileId,
  creationState,
  onToggleFolder,
  onOpenFile,
  onStartCreating,
  onCancelCreating,
  onCreate
}) => {
  const getChildren = (pid: string | null) => {
    return files.filter(f => f.parentId === pid).sort((a, b) => {
        if (a.type === b.type) return a.name.localeCompare(b.name);
        return a.type === 'folder' ? -1 : 1;
    });
  };

  const handleItemClick = (e: React.MouseEvent, item: FileSystemItem) => {
    if (item.type === 'folder') {
      onToggleFolder(item.id);
    } else {
      onOpenFile(item.id);
    }
  };

  const children = getChildren(parentId);
  const isCreatingHere = creationState?.parentId === parentId;

  return (
    <div className="select-none text-sm">
      {isCreatingHere && creationState && (
        <CreationForm
          type={creationState.type}
          level={level}
          onSubmit={(name) => onCreate(parentId!, name, creationState.type)}
          onCancel={onCancelCreating}
        />
      )}

      {children.map(item => (
        <div key={item.id}>
          <div 
            className={`
              flex items-center group px-2 py-1 cursor-pointer transition-colors relative
              ${item.id === activeFileId ? 'bg-blue-900/40 text-blue-300' : 'text-gray-400 hover:bg-[#2a2a2b] hover:text-gray-200'}
            `}
            style={{ paddingLeft: `${level * 12 + 8}px` }}
            onClick={(e) => handleItemClick(e, item)}
          >
            <span className="mr-1 opacity-70">
              {item.type === 'folder' ? (
                item.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              ) : <span className="w-3.5 inline-block" />}
            </span>
            
            <span className={`mr-2 ${item.type === 'folder' ? 'text-yellow-500' : 'text-blue-400'}`}>
              {item.type === 'folder' ? (
                item.isOpen ? <FolderOpen size={16} /> : <Folder size={16} />
              ) : (
                <FileCode size={16} />
              )}
            </span>

            <span className="truncate flex-1">{item.name}</span>

            <div className="hidden group-hover:flex items-center space-x-1 ml-2">
                {item.type === 'folder' && (
                  <>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onStartCreating(item.id, 'file'); }}
                      className="p-0.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                      title="New File"
                    >
                      <FilePlus size={12} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onStartCreating(item.id, 'folder'); }}
                      className="p-0.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
                      title="New Folder"
                    >
                      <FolderPlus size={12} />
                    </button>
                  </>
                )}
            </div>
          </div>

          {item.type === 'folder' && item.isOpen && (
            <div>
              <FileTree 
                parentId={item.id} 
                level={level + 1} 
                files={files} 
                activeFileId={activeFileId}
                creationState={creationState}
                onToggleFolder={onToggleFolder}
                onOpenFile={onOpenFile}
                onStartCreating={onStartCreating}
                onCancelCreating={onCancelCreating}
                onCreate={onCreate}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// PreviewPanel Component
interface PreviewPanelProps {
  sandboxId: string | null;
  isConnected: boolean;
  defaultPort?: number;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({
  sandboxId,
  isConnected,
  defaultPort = 3000,
}) => {
  const [port, setPort] = useState(defaultPort.toString());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (sandboxId && port) {
      const portNum = parseInt(port, 10);
      if (!isNaN(portNum) && portNum > 0 && portNum < 65536) {
        setPreviewUrl(`https://${portNum}-${sandboxId}.e2b.app`);
        setError(null);
      } else {
        setPreviewUrl(null);
        setError('Invalid port number');
      }
    } else {
      setPreviewUrl(null);
    }
  }, [sandboxId, port]);

  const handleRefresh = () => {
    setKey(prev => prev + 1);
    setIsLoading(true);
  };

  const handleOpenExternal = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setIsLoading(false);
    setError('Failed to load preview. Make sure your server is running on the specified port.');
  };

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 bg-[#1e1e1e]">
        <Globe size={48} className="mb-4 opacity-20" />
        <p className="text-sm">Create a sandbox to see preview</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      <div className="h-10 bg-[#2d2d2d] border-b border-[#333] flex items-center px-3 gap-2 flex-shrink-0">
        <Globe size={14} className="text-blue-400 flex-shrink-0" />
        <span className="text-xs text-gray-400 flex-shrink-0">Preview</span>
        
        <div className="flex items-center ml-2">
          <span className="text-xs text-gray-500 mr-1">Port:</span>
          <input
            type="text"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            className="w-16 bg-[#1e1e1e] border border-[#444] rounded px-2 py-0.5 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
            placeholder="3000"
          />
        </div>

        <div className="flex items-center ml-auto space-x-1">
          <button
            onClick={() => setDeviceMode('desktop')}
            className={`p-1.5 rounded ${deviceMode === 'desktop' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#444]'}`}
            title="Desktop view"
          >
            <Monitor size={12} />
          </button>
          <button
            onClick={() => setDeviceMode('tablet')}
            className={`p-1.5 rounded ${deviceMode === 'tablet' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#444]'}`}
            title="Tablet view"
          >
            <Tablet size={12} />
          </button>
          <button
            onClick={() => setDeviceMode('mobile')}
            className={`p-1.5 rounded ${deviceMode === 'mobile' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-[#444]'}`}
            title="Mobile view"
          >
            <Smartphone size={12} />
          </button>
        </div>

        <div className="flex items-center space-x-1 ml-2">
          <button
            onClick={handleRefresh}
            disabled={!previewUrl}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#444] rounded disabled:opacity-50"
            title="Refresh preview"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleOpenExternal}
            disabled={!previewUrl}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-[#444] rounded disabled:opacity-50"
            title="Open in new tab"
          >
            <ExternalLink size={12} />
          </button>
        </div>
      </div>

      <div className="h-8 bg-[#252526] border-b border-[#333] flex items-center px-3">
        <div className="flex-1 bg-[#1e1e1e] border border-[#444] rounded px-2 py-1 flex items-center">
          {previewUrl ? (
            <>
              <span className="text-green-400 text-xs mr-1">🔒</span>
              <span className="text-xs text-gray-300 truncate">{previewUrl}</span>
            </>
          ) : (
            <span className="text-xs text-gray-500">No preview URL</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex items-center justify-center bg-[#0f0f10] p-4">
        {error ? (
          <div className="text-center">
            <AlertCircle size={48} className="mx-auto mb-4 text-yellow-500 opacity-50" />
            <p className="text-sm text-gray-400">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white"
            >
              Try Again
            </button>
          </div>
        ) : previewUrl ? (
          <div 
            className="h-full bg-white rounded-lg overflow-hidden shadow-2xl transition-all duration-300"
            style={{ 
              width: deviceSizes[deviceMode].width,
              maxWidth: '100%',
            }}
          >
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#1e1e1e] z-10">
                <Loader2 size={32} className="animate-spin text-blue-400" />
              </div>
            )}
            <iframe
              key={key}
              src={previewUrl}
              className="w-full h-full border-0"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              title="Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
          </div>
        ) : (
          <div className="text-center">
            <Globe size={48} className="mx-auto mb-4 opacity-20 text-gray-500" />
            <p className="text-sm text-gray-500">Enter a valid port to preview</p>
          </div>
        )}
      </div>

      <div className="h-6 bg-[#252526] border-t border-[#333] flex items-center px-3 text-[10px] text-gray-500">
        <span>{deviceSizes[deviceMode].label}</span>
        {sandboxId && (
          <span className="ml-auto truncate max-w-[200px]">
            Sandbox: {sandboxId.substring(0, 12)}...
          </span>
        )}
      </div>
    </div>
  );
};

// SandboxControls Component
interface SandboxControlsProps {
  apiKey: string;
  isConnected: boolean;
  isConnecting: boolean;
  sandboxId: string | null;
  error: string | null;
  onApiKeyChange: (key: string) => void;
  onCreateSandbox: () => Promise<any>;
  onDisconnect: () => Promise<void>;
}

const SandboxControls: React.FC<SandboxControlsProps> = ({
  apiKey,
  isConnected,
  isConnecting,
  sandboxId,
  error,
  onApiKeyChange,
  onCreateSandbox,
  onDisconnect,
}) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!isConnected);

  return (
    <div className="bg-[#252526] border-b border-[#333]">
      <div 
        className="h-10 flex items-center justify-between px-4 cursor-pointer hover:bg-[#2a2a2b]"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <Cloud size={16} className="text-green-400" />
          ) : (
            <CloudOff size={16} className="text-gray-500" />
          )}
          <span className="text-xs font-medium text-gray-300">
            E2B Sandbox
          </span>
          {isConnected && sandboxId && (
            <span className="text-[10px] text-gray-500 bg-[#1e1e1e] px-2 py-0.5 rounded">
              {sandboxId.substring(0, 8)}...
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <span className="flex items-center text-[10px] text-green-400">
              <CheckCircle size={12} className="mr-1" />
              Connected
            </span>
          ) : isConnecting ? (
            <span className="flex items-center text-[10px] text-blue-400">
              <Loader2 size={12} className="mr-1 animate-spin" />
              Connecting...
            </span>
          ) : (
            <span className="flex items-center text-[10px] text-gray-500">
              <AlertCircle size={12} className="mr-1" />
              Disconnected
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center">
              <Key size={10} className="mr-1" />
              E2B API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                placeholder="e2b_..."
                disabled={isConnected}
                className="w-full bg-[#1e1e1e] border border-[#444] rounded px-3 py-2 pr-10 text-sm text-gray-300 
                  placeholder-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            <p className="text-[10px] text-gray-600">
              Get your API key from{' '}
              <a 
                href="https://e2b.dev/dashboard" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                e2b.dev/dashboard
              </a>
            </p>
          </div>

          {error && (
            <div className="flex items-start space-x-2 p-2 bg-red-900/20 border border-red-800/50 rounded">
              <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          <div className="flex space-x-2">
            {!isConnected ? (
              <button
                onClick={onCreateSandbox}
                disabled={isConnecting || !apiKey}
                className="flex-1 flex items-center justify-center space-x-2 bg-green-600 hover:bg-green-700 
                  disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded py-2 px-4 text-sm font-medium
                  transition-colors"
              >
                {isConnecting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Creating Sandbox...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    <span>Create Sandbox</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={onDisconnect}
                className="flex-1 flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-700 
                  text-white rounded py-2 px-4 text-sm font-medium transition-colors"
              >
                <Square size={14} />
                <span>Stop Sandbox</span>
              </button>
            )}
          </div>

          {isConnected && sandboxId && (
            <div className="p-2 bg-[#1e1e1e] rounded border border-[#333]">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Sandbox ID</p>
              <p className="text-xs text-gray-300 font-mono break-all">{sandboxId}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Terminal Component
interface TerminalComponentProps {
  isConnected: boolean;
  onCreateTerminal: (terminalId: string, cols: number, rows: number, onData: (data: Uint8Array) => void) => Promise<any>;
  onSendInput: (terminalId: string, data: string) => Promise<void>;
  onResize: (terminalId: string, cols: number, rows: number) => Promise<void>;
  onCloseTerminal: (terminalId: string) => Promise<void>;
  onCommandComplete?: () => void;
}

const TerminalComponent: React.FC<TerminalComponentProps> = ({
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

// ============================================================================
// MAIN APP COMPONENT
// ============================================================================

const App = () => {
  const {
    files,
    activeFileId,
    openFiles,
    isSyncing: isLocalSyncing,
    createFile,
    updateFileContent,
    deleteFileItem,
    toggleFolder,
    expandFolder,
    openFile,
    closeFile,
    setActiveFileId,
    getActiveFile,
    setSyncCallbacks,
    getAllFiles,
    replaceWithSandboxFiles,
  } = useFileSystem();

  const {
    apiKey,
    isConnected,
    isConnecting,
    sandboxId,
    error: sandboxError,
    isSyncing: isSandboxSyncing,
    setApiKey,
    createSandbox,
    createTerminal,
    sendTerminalInput,
    resizeTerminal,
    closeTerminal,
    writeFile,
    makeDirectory,
    deleteFile,
    disconnectSandbox,
    syncLocalToSandbox,
    syncSandboxToLocal,
    onFileChange,
  } = useE2BSandbox();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('preview');
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(true);
  const [creationState, setCreationState] = useState<{ parentId: string; type: 'file' | 'folder' } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [rightPanelWidth, setRightPanelWidth] = useState(450);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(256);
  const [isResizing, setIsResizing] = useState<'sidebar' | 'right' | 'bottom' | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const editorAreaRef = useRef<HTMLDivElement>(null);
  
  const activeFile = getActiveFile();
  const isSyncing = isLocalSyncing || isSandboxSyncing;

  useEffect(() => {
    if (isConnected) {
      setSyncCallbacks({
        writeFile,
        makeDirectory,
        deleteFile,
      });
    }
  }, [isConnected, writeFile, makeDirectory, deleteFile, setSyncCallbacks]);

  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = onFileChange((event) => {
      console.log('File change event:', event);
      if (event.type === 'created' || event.type === 'modified') {
        setSyncStatus('idle');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [isConnected, onFileChange]);

  const handleInitialSync = useCallback(async () => {
    if (!isConnected) return;
    
    setSyncStatus('syncing');
    const allFiles = getAllFiles();
    const success = await syncLocalToSandbox(allFiles);
    setSyncStatus(success ? 'success' : 'error');
    if (success) {
      setLastSyncTime(new Date());
    }
  }, [isConnected, getAllFiles, syncLocalToSandbox]);

  const handlePushToSandbox = useCallback(async () => {
    setSyncStatus('syncing');
    const allFiles = getAllFiles();
    const success = await syncLocalToSandbox(allFiles);
    setSyncStatus(success ? 'success' : 'error');
    if (success) {
      setLastSyncTime(new Date());
    }
  }, [getAllFiles, syncLocalToSandbox]);

  const handlePullFromSandbox = useCallback(async () => {
    setSyncStatus('syncing');
    const sandboxFiles = await syncSandboxToLocal();
    if (sandboxFiles.length > 0) {
      replaceWithSandboxFiles(sandboxFiles);
      setSyncStatus('success');
      setLastSyncTime(new Date());
    } else {
      setSyncStatus('error');
    }
  }, [syncSandboxToLocal, replaceWithSandboxFiles]);

  const handleFullSync = useCallback(async () => {
    await handlePullFromSandbox();
  }, [handlePullFromSandbox]);

  const handleStartCreating = (parentId: string, type: 'file' | 'folder') => {
    setCreationState({ parentId, type });
    if (parentId !== 'root') {
      expandFolder(parentId);
    }
  };

  const handleCancelCreating = () => {
    setCreationState(null);
  };

  const handleCreateSubmit = (parentId: string, name: string, type: 'file' | 'folder') => {
    createFile(parentId, name, type);
    setCreationState(null);
  };

  const startResize = useCallback((panel: 'sidebar' | 'right' | 'bottom') => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsResizing(panel);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const getClientCoords = (e: MouseEvent | TouchEvent): { clientX: number; clientY: number } => {
      if ('touches' in e && e.touches.length > 0) {
        return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
      }
      if ('changedTouches' in e && e.changedTouches.length > 0) {
        return { clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY };
      }
      return { clientX: (e as MouseEvent).clientX, clientY: (e as MouseEvent).clientY };
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return;
      
      if ('touches' in e) {
        e.preventDefault();
      }

      const { clientX, clientY } = getClientCoords(e);
      const containerRect = containerRef.current.getBoundingClientRect();

      if (isResizing === 'sidebar') {
        const newWidth = clientX - containerRect.left;
        setSidebarWidth(Math.max(180, Math.min(500, newWidth)));
      } else if (isResizing === 'right') {
        const newWidth = containerRect.right - clientX;
        setRightPanelWidth(Math.max(250, Math.min(800, newWidth)));
      } else if (isResizing === 'bottom' && editorAreaRef.current) {
        const editorRect = editorAreaRef.current.getBoundingClientRect();
        const newHeight = editorRect.bottom - clientY;
        setBottomPanelHeight(Math.max(100, Math.min(500, newHeight)));
      }
    };

    const handleEnd = () => {
      setIsResizing(null);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleEnd);
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('touchcancel', handleEnd);
    
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('touchcancel', handleEnd);
    };
  }, [isResizing]);

  const resizeCursor = isResizing === 'bottom' ? 'row-resize' : isResizing ? 'col-resize' : undefined;

  return (
    <div 
      ref={containerRef} 
      className="flex h-screen w-screen bg-[#1e1e1e] text-gray-300 font-sans overflow-hidden"
      style={{ cursor: resizeCursor }}
    >
      {isResizing && (
        <div className="fixed inset-0 z-50 touch-none" style={{ cursor: resizeCursor }} />
      )}
      
      {isSidebarOpen && (
        <>
          <div 
            className="bg-[#252526] flex flex-col border-r border-[#333] flex-shrink-0"
            style={{ width: sidebarWidth }}
          >
            <SandboxControls
              apiKey={apiKey}
              isConnected={isConnected}
              isConnecting={isConnecting}
              sandboxId={sandboxId}
              error={sandboxError}
              onApiKeyChange={setApiKey}
              onCreateSandbox={createSandbox}
              onDisconnect={disconnectSandbox}
            />

            {isConnected && (
              <div className="px-3 py-2 border-b border-[#333]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wide">File Sync</span>
                  {isSyncing && (
                    <Loader2 size={12} className="animate-spin text-blue-400" />
                  )}
                  {syncStatus === 'success' && !isSyncing && (
                    <span className="text-[10px] text-green-400">✓ Synced</span>
                  )}
                </div>
                <div className="flex space-x-1">
                  <button
                    onClick={handlePushToSandbox}
                    disabled={isSyncing}
                    className="flex-1 flex items-center justify-center px-2 py-1.5 bg-[#333] hover:bg-[#444] rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Push local files to sandbox"
                  >
                    <Upload size={12} className="mr-1" />
                    Push
                  </button>
                  <button
                    onClick={handlePullFromSandbox}
                    disabled={isSyncing}
                    className="flex-1 flex items-center justify-center px-2 py-1.5 bg-[#333] hover:bg-[#444] rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Pull files from sandbox"
                  >
                    <Download size={12} className="mr-1" />
                    Pull
                  </button>
                  <button
                    onClick={handleFullSync}
                    disabled={isSyncing}
                    className="flex items-center justify-center px-2 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Sync files with sandbox"
                  >
                    <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                  </button>
                </div>
                {lastSyncTime && (
                  <p className="text-[10px] text-gray-500 mt-1.5 text-center">
                    Last sync: {lastSyncTime.toLocaleTimeString()}
                  </p>
                )}
              </div>
            )}

            <div className="h-12 flex items-center justify-between px-4 border-b border-[#333]">
              <span className="text-xs font-bold tracking-wider text-gray-400 uppercase">Explorer</span>
              <div className="flex space-x-2">
                 <button 
                  onClick={() => handleStartCreating('root', 'folder')}
                  className="hover:text-white text-gray-500" title="New Root Folder"
                >
                   <FolderPlus size={16}/>
                 </button>
                 <button 
                  onClick={() => handleStartCreating('root', 'file')}
                  className="hover:text-white text-gray-500" title="New Root File"
                >
                   <FilePlus size={16}/>
                 </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              <FileTree
                parentId="root"
                files={files}
                activeFileId={activeFileId}
                creationState={creationState}
                onToggleFolder={toggleFolder}
                onOpenFile={openFile}
                onStartCreating={handleStartCreating}
                onCancelCreating={handleCancelCreating}
                onCreate={handleCreateSubmit}
              />
            </div>
          </div>
          
          <div
            onMouseDown={startResize('sidebar')}
            onTouchStart={startResize('sidebar')}
            className={`w-3 cursor-col-resize flex-shrink-0 flex items-center justify-center group touch-none
              ${isResizing === 'sidebar' ? 'bg-blue-500' : 'bg-[#333] hover:bg-blue-500/50 active:bg-blue-500/50'}`}
          >
            <div className={`w-0.5 h-16 rounded-full transition-colors
              ${isResizing === 'sidebar' ? 'bg-white' : 'bg-transparent group-hover:bg-blue-400'}`} 
            />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col relative min-w-0">
        <div className="h-12 bg-[#2d2d2d] flex items-center justify-between px-4 border-b border-[#1e1e1e] flex-shrink-0">
          <div className="flex items-center min-w-0 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="mr-4 text-gray-400 hover:text-white"
            >
              <Menu size={20} />
            </button>
            
            <div className="flex space-x-1 overflow-x-auto no-scrollbar mask-gradient flex-1">
              {openFiles.map(fileId => {
                  const file = files.find(f => f.id === fileId);
                  if (!file) return null;
                  const isActive = fileId === activeFileId;
                  return (
                  <div
                      key={file.id}
                      onClick={() => setActiveFileId(file.id)}
                      className={`
                      flex items-center px-3 py-1.5 rounded-t-md text-xs cursor-pointer select-none min-w-[100px] max-w-[200px] flex-shrink-0
                      ${isActive ? 'bg-[#1e1e1e] text-blue-400 font-medium' : 'bg-[#2d2d2d] text-gray-500 hover:bg-[#333] hover:text-gray-300'}
                      `}
                  >
                      <span className="truncate mr-2 flex-1">{file.name}</span>
                      <button
                      onClick={(e) => closeFile(file.id, e)}
                      className="hover:bg-gray-700 rounded-full p-0.5"
                      >
                      <X size={12} />
                      </button>
                  </div>
                  );
              })}
            </div>
          </div>

          <div className="flex items-center space-x-2 ml-4">
             {isSyncing && (
               <span className="text-[10px] text-yellow-400 animate-pulse flex items-center">
                 <Loader2 size={10} className="animate-spin mr-1" />
                 Syncing...
               </span>
             )}
             
             <button 
                onClick={() => setIsBottomPanelOpen(!isBottomPanelOpen)}
                className={`p-1.5 rounded ${isBottomPanelOpen ? 'bg-[#444] text-green-400' : 'text-gray-500 hover:text-white'}`}
                title="Toggle Terminal"
             >
                <TerminalSquare size={16} />
             </button>

             <button 
                onClick={() => {
                  setRightPanelTab('preview');
                  setIsRightPanelOpen(!isRightPanelOpen || rightPanelTab !== 'preview');
                }}
                className={`p-1.5 rounded ${isRightPanelOpen && rightPanelTab === 'preview' ? 'bg-[#444] text-blue-400' : 'text-gray-500 hover:text-white'}`}
                title="Toggle Preview"
             >
                <Globe size={16} />
             </button>
             
             <button 
                onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
                className="p-1.5 text-gray-500 hover:text-white"
                title={isRightPanelOpen ? 'Close Panel' : 'Open Panel'}
             >
                {isRightPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
             </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div ref={editorAreaRef} className="flex-1 flex flex-col min-w-0">
            <div className="flex-1 overflow-hidden" style={{ minHeight: isBottomPanelOpen ? '100px' : '100%' }}>
              <CodeEditor 
                  file={activeFile} 
                  onChange={updateFileContent}
              />
            </div>
            
            {isBottomPanelOpen && (
              <>
                <div
                  onMouseDown={startResize('bottom')}
                  onTouchStart={startResize('bottom')}
                  className={`h-3 cursor-row-resize flex-shrink-0 flex items-center justify-center group touch-none
                    ${isResizing === 'bottom' ? 'bg-blue-500' : 'bg-[#333] hover:bg-blue-500/50 active:bg-blue-500/50'}`}
                >
                  <div className={`h-0.5 w-16 rounded-full transition-colors
                    ${isResizing === 'bottom' ? 'bg-white' : 'bg-transparent group-hover:bg-blue-400'}`} 
                  />
                </div>
                <div className="flex-shrink-0 overflow-hidden" style={{ height: bottomPanelHeight }}>
                  <TerminalComponent
                    isConnected={isConnected}
                    onCreateTerminal={createTerminal}
                    onSendInput={sendTerminalInput}
                    onResize={resizeTerminal}
                    onCloseTerminal={closeTerminal}
                    onCommandComplete={handlePullFromSandbox}
                  />
                </div>
              </>
            )}
          </div>
            
          {isRightPanelOpen && (
            <>
              <div
                onMouseDown={startResize('right')}
                onTouchStart={startResize('right')}
                className={`w-3 cursor-col-resize flex-shrink-0 flex items-center justify-center group touch-none
                  ${isResizing === 'right' ? 'bg-blue-500' : 'bg-[#333] hover:bg-blue-500/50 active:bg-blue-500/50'}`}
              >
                <div className={`w-0.5 h-16 rounded-full transition-colors
                  ${isResizing === 'right' ? 'bg-white' : 'bg-transparent group-hover:bg-blue-400'}`} 
                />
              </div>
              
              <div 
                className="flex-shrink-0 flex flex-col"
                style={{ width: rightPanelWidth }}
              >
                <div className="h-9 bg-[#2d2d2d] border-b border-[#333] flex items-center px-2 flex-shrink-0">
                  <button
                    onClick={() => setRightPanelTab('preview')}
                    className={`px-3 py-1 text-xs rounded ${rightPanelTab === 'preview' ? 'bg-[#1e1e1e] text-blue-400' : 'text-gray-500 hover:text-white'}`}
                  >
                    <Globe size={12} className="inline mr-1" />
                    Preview
                  </button>
                  <button
                    onClick={() => setIsRightPanelOpen(false)}
                    className="ml-auto p-1 text-gray-500 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
                
                <div className="flex-1 overflow-hidden">
                  <PreviewPanel
                    sandboxId={sandboxId}
                    isConnected={isConnected}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="h-6 bg-[#007acc] text-white text-[10px] flex items-center px-3 justify-between select-none flex-shrink-0">
          <div className="flex items-center space-x-4">
             <span>main*</span>
             {isConnected && (
               <span className="flex items-center">
                 <span className="w-2 h-2 rounded-full bg-green-400 mr-1.5 animate-pulse"></span>
                 E2B Connected
               </span>
             )}
             {isSyncing && (
               <span className="flex items-center text-yellow-300">
                 <RefreshCw size={10} className="animate-spin mr-1" />
                 Syncing...
               </span>
             )}
          </div>
          <div className="flex items-center space-x-4">
            <span>{activeFile ? 'TypeScript React' : 'Plain Text'}</span>
            <span>UTF-8</span>
            {sandboxId && (
              <span className="opacity-70">Sandbox: {sandboxId.substring(0, 8)}...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;