export type FileType = 'file' | 'folder';

export interface FileSystemItem {
  id: string;
  parentId: string | null;
  name: string;
  type: FileType;
  content?: string;
  isOpen?: boolean; // For folders
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}