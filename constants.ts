import { FileSystemItem } from './types';

export const INITIAL_FILES: FileSystemItem[] = [
  {
    id: 'root',
    parentId: null,
    name: 'root',
    type: 'folder',
    isOpen: true,
  }
];

export const GEMINI_MODEL_CODE = 'gemini-3-pro-preview';