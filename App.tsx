import React, { useState, useEffect } from 'react';
import { useFileSystem } from './hooks/useFileSystem';
import { useE2BSandbox } from './hooks/useE2BSandbox';
import { FileTree } from './components/FileTree';
import { Editor } from './components/Editor';
import { AIPanel } from './components/AIPanel';
import { Terminal } from './components/Terminal';
import { PreviewPanel } from './components/PreviewPanel';
import { SandboxControls } from './components/SandboxControls';
import { 
  Menu, 
  X, 
  FolderPlus, 
  FilePlus,
  MessageSquare,
  TerminalSquare,
  Globe,
  PanelRightOpen,
  PanelRightClose
} from 'lucide-react';

type RightPanelTab = 'ai' | 'preview';
type BottomPanelTab = 'terminal';

const App = () => {
  const {
    files,
    activeFileId,
    openFiles,
    isSyncing,
    createFile,
    updateFileContent,
    toggleFolder,
    expandFolder,
    openFile,
    closeFile,
    setActiveFileId,
    getActiveFile,
    setSyncCallbacks,
  } = useFileSystem();

  const {
    apiKey,
    isConnected,
    isConnecting,
    sandboxId,
    error: sandboxError,
    setApiKey,
    createSandbox,
    createTerminal,
    sendTerminalInput,
    resizeTerminal,
    writeFile,
    makeDirectory,
    disconnectSandbox,
  } = useE2BSandbox();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('preview');
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(true);
  const [creationState, setCreationState] = useState<{ parentId: string; type: 'file' | 'folder' } | null>(null);
  
  const activeFile = getActiveFile();

  // Set up file sync callbacks when sandbox is connected
  useEffect(() => {
    if (isConnected) {
      setSyncCallbacks({
        writeFile,
        makeDirectory,
      });
    }
  }, [isConnected, writeFile, makeDirectory, setSyncCallbacks]);

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
          {/* E2B Sandbox Controls */}
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

          <div className="flex items-center space-x-2 ml-4">
             {/* Syncing Indicator */}
             {isSyncing && (
               <span className="text-[10px] text-yellow-400 animate-pulse">Syncing...</span>
             )}
             
             {/* Terminal Toggle */}
             <button 
                onClick={() => setIsBottomPanelOpen(!isBottomPanelOpen)}
                className={`p-1.5 rounded ${isBottomPanelOpen ? 'bg-[#444] text-green-400' : 'text-gray-500 hover:text-white'}`}
                title="Toggle Terminal"
             >
                <TerminalSquare size={16} />
             </button>

             {/* Preview Toggle */}
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
             
             {/* AI Assistant Toggle */}
             <button 
                onClick={() => {
                  setRightPanelTab('ai');
                  setIsRightPanelOpen(!isRightPanelOpen || rightPanelTab !== 'ai');
                }}
                className={`p-1.5 rounded ${isRightPanelOpen && rightPanelTab === 'ai' ? 'bg-[#444] text-purple-400' : 'text-gray-500 hover:text-white'}`}
                title="AI Assistant"
             >
                <MessageSquare size={16} />
             </button>

             {/* Right Panel Toggle */}
             <button 
                onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
                className="p-1.5 text-gray-500 hover:text-white"
                title={isRightPanelOpen ? 'Close Panel' : 'Open Panel'}
             >
                {isRightPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
             </button>
          </div>
        </div>

        {/* Center Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Editor + Bottom Panel */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Editor */}
            <div className={`${isBottomPanelOpen ? 'flex-1' : 'flex-1'} overflow-hidden`} style={{ minHeight: isBottomPanelOpen ? '40%' : '100%' }}>
              <Editor 
                  file={activeFile} 
                  onChange={updateFileContent}
              />
            </div>
            
            {/* Bottom Panel (Terminal) */}
            {isBottomPanelOpen && (
              <div className="h-64 border-t border-[#333] flex-shrink-0">
                <Terminal
                  isConnected={isConnected}
                  onCreateTerminal={createTerminal}
                  onSendInput={sendTerminalInput}
                  onResize={resizeTerminal}
                />
              </div>
            )}
          </div>
            
          {/* Right Panel (Preview / AI) */}
          {isRightPanelOpen && (
            <div className="w-[450px] border-l border-[#333] flex-shrink-0 flex flex-col">
              {/* Panel Tabs */}
              <div className="h-9 bg-[#2d2d2d] border-b border-[#333] flex items-center px-2 flex-shrink-0">
                <button
                  onClick={() => setRightPanelTab('preview')}
                  className={`px-3 py-1 text-xs rounded ${rightPanelTab === 'preview' ? 'bg-[#1e1e1e] text-blue-400' : 'text-gray-500 hover:text-white'}`}
                >
                  <Globe size={12} className="inline mr-1" />
                  Preview
                </button>
                <button
                  onClick={() => setRightPanelTab('ai')}
                  className={`px-3 py-1 text-xs rounded ${rightPanelTab === 'ai' ? 'bg-[#1e1e1e] text-purple-400' : 'text-gray-500 hover:text-white'}`}
                >
                  <MessageSquare size={12} className="inline mr-1" />
                  AI
                </button>
                <button
                  onClick={() => setIsRightPanelOpen(false)}
                  className="ml-auto p-1 text-gray-500 hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
              
              {/* Panel Content */}
              <div className="flex-1 overflow-hidden">
                {rightPanelTab === 'preview' ? (
                  <PreviewPanel
                    sandboxId={sandboxId}
                    isConnected={isConnected}
                  />
                ) : (
                  <AIPanel 
                    isOpen={true}
                    onClose={() => setIsRightPanelOpen(false)}
                    activeFile={activeFile}
                    onUpdateFileContent={(content) => {
                      if (activeFile) updateFileContent(activeFile.id, content);
                    }}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Status Bar */}
        <div className="h-6 bg-[#007acc] text-white text-[10px] flex items-center px-3 justify-between select-none flex-shrink-0">
          <div className="flex items-center space-x-4">
             <span>main*</span>
             {isConnected && (
               <span className="flex items-center">
                 <span className="w-2 h-2 rounded-full bg-green-400 mr-1.5 animate-pulse"></span>
                 E2B Connected
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