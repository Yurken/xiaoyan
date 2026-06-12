export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  dirty: boolean;
}

export interface FileNode {
  entry: DirEntry;
  expanded: boolean;
  children: FileNode[];
}
