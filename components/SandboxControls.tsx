import React, { useState } from 'react';
import { 
  Key, 
  Play, 
  Square, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  Eye,
  EyeOff,
  Cloud,
  CloudOff
} from 'lucide-react';

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

export const SandboxControls: React.FC<SandboxControlsProps> = ({
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
      {/* Header - Always Visible */}
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

      {/* Expandable Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* API Key Input */}
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

          {/* Error Message */}
          {error && (
            <div className="flex items-start space-x-2 p-2 bg-red-900/20 border border-red-800/50 rounded">
              <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {/* Action Buttons */}
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

          {/* Sandbox Info when connected */}
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