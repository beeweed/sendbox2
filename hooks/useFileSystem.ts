import React, { useState, useCallback, useRef } from 'react';
import { FileSystemItem } from '../types';
import { INITIAL_FILES } from '../constants';

interface SyncCallbacks {
  writeFile?: (path: string, content: string) => Promise<boolean>;
  makeDirectory?: (path: string) => Promise<boolean>;
}

export const useFileSystem = () => {
  const [files, setFiles] = useState<FileSystemItem[]>(INITIAL_FILES);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const syncCallbacksRef = useRef<SyncCallbacks>({});

  const setSyncCallbacks = useCallback((callbacks: SyncCallbacks) => {
    syncCallbacksRef.current = callbacks;
  }, []);

  const getFilePath = useCallback((fileId: string): string => {
    const file = files.find(f => f.id === fileId);
    if (!file) return '';
    
    const pathParts: string[] = [file.name];
    let currentParentId = file.parentId;
    
    while (currentParentId && currentParentId !== 'root') {
      const parent = files.find(f => f.id === currentParentId);
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
    
    // Sync to E2B sandbox
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
  }, [files]);

  const updateFileContent = useCallback(async (id: string, newContent: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, content: newContent } : f));
    
    // Debounced sync to E2B sandbox
    const file = files.find(f => f.id === id);
    if (file && syncCallbacksRef.current.writeFile) {
      const filePath = getFilePath(id);
      if (filePath) {
        // Note: In production, you'd want to debounce this
        await syncCallbacksRef.current.writeFile(filePath, newContent);
      }
    }
  }, [files, getFilePath]);

  const toggleFolder = useCallback((id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, isOpen: !f.isOpen } : f));
  }, []);

  const expandFolder = useCallback((id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, isOpen: true } : f));
  }, []);

  const openFileById = useCallback((id: string) => {
    setOpenFiles(prev => {
      if (!prev.includes(id)) {
        return [...prev, id];
      }
      return prev;
    });
    setActiveFileId(id);
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

  return {
    files,
    activeFileId,
    openFiles,
    isSyncing,
    getChildren,
    createFile,
    updateFileContent,
    toggleFolder,
    expandFolder,
    openFile,
    closeFile,
    setActiveFileId,
    getActiveFile,
    setSyncCallbacks,
    getFilePath,
    resetFiles,
  };
};