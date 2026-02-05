import React, { useState, useCallback } from 'react';
import { FileSystemItem } from '../types';
import { INITIAL_FILES } from '../constants';

export const useFileSystem = () => {
  const [files, setFiles] = useState<FileSystemItem[]>(INITIAL_FILES);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [openFiles, setOpenFiles] = useState<string[]>([]);

  // Get children of a folder
  const getChildren = useCallback((parentId: string | null) => {
    return files.filter(f => f.parentId === parentId).sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'folder' ? -1 : 1;
    });
  }, [files]);

  const createFile = (parentId: string, name: string, type: 'file' | 'folder') => {
    const newFile: FileSystemItem = {
      id: `${Date.now()}`, // Simple ID generation
      parentId,
      name,
      type,
      content: type === 'file' ? '' : undefined,
      isOpen: type === 'folder' ? true : undefined,
    };
    setFiles(prev => [...prev, newFile]);
    if (type === 'file') {
      openFile(newFile.id);
    }
  };

  const updateFileContent = (id: string, newContent: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, content: newContent } : f));
  };

  const toggleFolder = (id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, isOpen: !f.isOpen } : f));
  };

  const expandFolder = (id: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, isOpen: true } : f));
  };

  const openFile = (id: string) => {
    if (!openFiles.includes(id)) {
      setOpenFiles(prev => [...prev, id]);
    }
    setActiveFileId(id);
  };

  const closeFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newOpen = openFiles.filter(fid => fid !== id);
    setOpenFiles(newOpen);
    if (activeFileId === id) {
      setActiveFileId(newOpen.length > 0 ? newOpen[newOpen.length - 1] : null);
    }
  };

  const getActiveFile = () => files.find(f => f.id === activeFileId);

  return {
    files,
    activeFileId,
    openFiles,
    getChildren,
    createFile,
    updateFileContent,
    toggleFolder,
    expandFolder,
    openFile,
    closeFile,
    setActiveFileId,
    getActiveFile
  };
};