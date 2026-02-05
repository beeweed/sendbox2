import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Bot, Loader2 } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { FileSystemItem } from '../types';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface AIPanelProps {
  isOpen: boolean;
  onClose: () => void;
  activeFile: FileSystemItem | undefined;
  onUpdateFileContent: (content: string) => void;
}

export const AIPanel: React.FC<AIPanelProps> = ({ isOpen, onClose, activeFile, onUpdateFileContent }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      // Using gemini-3-flash-preview as recommended for basic text tasks/assistant
      const model = 'gemini-3-flash-preview'; 
      
      const systemPrompt = `You are a helpful coding assistant. 
      The user is currently editing a file named "${activeFile?.name || 'unknown'}".
      ${activeFile?.content ? `Current file content:\n\`\`\`${activeFile.name.split('.').pop()}\n${activeFile.content}\n\`\`\`` : ''}
      
      If the user asks to update the code, you can provide the full updated code block, but you should also explain the changes.`;

      const result = await ai.models.generateContent({
        model: model,
        contents: [
            ...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
            { role: 'user', parts: [{ text: input }] }
        ],
        config: {
            systemInstruction: systemPrompt
        }
      });

      const responseText = result.text || "I couldn't generate a response.";
      
      const botMessage: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: responseText 
      };
      setMessages(prev => [...prev, botMessage]);

    } catch (error: any) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'model', 
        text: "Error: " + (error.message || "Failed to generate response") 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 bg-[#252526] border-l border-[#333] flex flex-col h-full absolute right-0 top-0 z-10 shadow-xl">
      <div className="h-12 border-b border-[#333] flex items-center justify-between px-4 bg-[#2d2d2d]">
        <span className="font-bold text-gray-300 flex items-center">
            <Bot size={18} className="mr-2 text-blue-400"/> AI Assistant
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-10">
                <Bot size={48} className="mx-auto mb-4 opacity-20"/>
                <p className="text-sm">Ask me anything about your code!</p>
            </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded p-3 text-sm ${
              msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-[#3e3e3e] text-gray-200'
            }`}>
              <div className="whitespace-pre-wrap">{msg.text}</div>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="bg-[#3e3e3e] rounded p-3 text-sm flex items-center text-gray-400">
                    <Loader2 size={14} className="animate-spin mr-2"/> Thinking...
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-[#333] bg-[#252526]">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask a question..."
            className="w-full bg-[#1e1e1e] border border-[#333] rounded pl-3 pr-10 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-2 text-gray-400 hover:text-white disabled:opacity-50"
          >
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};