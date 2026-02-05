import React, { useState, useEffect, useRef } from 'react';
import { FileSystemItem } from '../types';
import { 
  Folder, 
  FolderOpen, 
  FileCode, 
  File, 
  ChevronRight, 
  ChevronDown, 
  FilePlus,
  FolderPlus
} from 'lucide-react';

interface CreationState {
  parentId: string;
  type: 'file' | 'folder';
}

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
        onBlur={() => { 
           // Optional: Cancel on blur
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
             onCancel();
          }
        }}
      />
    </form>
  );
};

export const FileTree: React.FC<FileTreeProps> = ({
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
      {/* Creation Form at the top of the list if active for this folder */}
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

            {/* Hover Actions (Creation only) */}
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

          {/* Recursion for Folders */}
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