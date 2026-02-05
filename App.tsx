import React, { useState } from 'react';
import { useFileSystem } from './hooks/useFileSystem';
import { FileTree } from './components/FileTree';
import { Editor } from './components/Editor';
import { AIPanel } from './components/AIPanel';
import { 
  Menu, 
  X, 
  FolderPlus, 
  FilePlus,
  MessageSquare
} from 'lucide-react';

const App = () => {
  const {
    files,
    activeFileId,
    openFiles,
    createFile,
    updateFileContent,
    toggleFolder,
    expandFolder,
    openFile,
    closeFile,
    setActiveFileId,
    getActiveFile
  } = useFileSystem();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [creationState, setCreationState] = useState<{ parentId: string; type: 'file' | 'folder' } | null>(null);
  
  const activeFile = getActiveFile();

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

  return (
    <div className="flex h-screen w-screen bg-[#1e1e1e] text-gray-300 font-sans overflow-hidden">
      {/* Sidebar */}
      {isSidebarOpen && (
        <div className="w-64 bg-[#252526] flex flex-col border-r border-[#333] flex-shrink-0">
          {/* Sidebar Header */}
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

          {/* File Tree */}
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
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative min-w-0">
        {/* Top Bar */}
        <div className="h-12 bg-[#2d2d2d] flex items-center justify-between px-4 border-b border-[#1e1e1e] flex-shrink-0">
          <div className="flex items-center min-w-0 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="mr-4 text-gray-400 hover:text-white"
            >
              <Menu size={20} />
            </button>
            
            {/* File Tabs */}
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

          <div className="flex items-center space-x-3 ml-4">
             <button 
                onClick={() => setIsAIPanelOpen(!isAIPanelOpen)}
                className={`text-gray-500 hover:text-white ${isAIPanelOpen ? 'text-blue-400' : ''}`}
                title="AI Assistant"
             >
                <MessageSquare size={16} />
             </button>
          </div>
        </div>

        {/* Center Area (Editor) */}
        <div className="flex-1 flex overflow-hidden relative">
            <Editor 
                file={activeFile} 
                onChange={updateFileContent}
            />
            
            {/* AI Panel */}
            <AIPanel 
                isOpen={isAIPanelOpen} 
                onClose={() => setIsAIPanelOpen(false)} 
                activeFile={activeFile}
                onUpdateFileContent={(content) => {
                    if (activeFile) updateFileContent(activeFile.id, content);
                }}
            />
        </div>

        {/* Status Bar */}
        <div className="h-6 bg-[#007acc] text-white text-[10px] flex items-center px-3 justify-between select-none flex-shrink-0">
          <div className="flex items-center space-x-4">
             <span>main*</span>
          </div>
          <div className="flex items-center space-x-4">
            <span>{activeFile ? 'TypeScript React' : 'Plain Text'}</span>
            <span>UTF-8</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;