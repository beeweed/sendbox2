import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  RefreshCw, 
  ExternalLink, 
  Loader2, 
  AlertCircle,
  Monitor,
  Smartphone,
  Tablet
} from 'lucide-react';

interface PreviewPanelProps {
  sandboxId: string | null;
  isConnected: boolean;
  defaultPort?: number;
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const deviceSizes: Record<DeviceMode, { width: string; label: string }> = {
  desktop: { width: '100%', label: 'Desktop' },
  tablet: { width: '768px', label: 'Tablet' },
  mobile: { width: '375px', label: 'Mobile' },
};

export const PreviewPanel: React.FC<PreviewPanelProps> = ({
  sandboxId,
  isConnected,
  defaultPort = 3000,
}) => {
  const [port, setPort] = useState(defaultPort.toString());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [key, setKey] = useState(0); // For forcing iframe refresh

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
      {/* Header */}
      <div className="h-10 bg-[#2d2d2d] border-b border-[#333] flex items-center px-3 gap-2 flex-shrink-0">
        <Globe size={14} className="text-blue-400 flex-shrink-0" />
        <span className="text-xs text-gray-400 flex-shrink-0">Preview</span>
        
        {/* Port Input */}
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

        {/* Device Mode Buttons */}
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

        {/* Action Buttons */}
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

      {/* URL Bar */}
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

      {/* Preview Content */}
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

      {/* Status Bar */}
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