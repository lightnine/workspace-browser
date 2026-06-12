export interface WorkspaceContext {
  owner_uin: string;
  uin: string;
  app_id: string;
  workspace_id: string;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modify_time: string;
  inode_id?: number;
  owner_uin?: string;
  creator_uin?: string;
  node_type?: string;
  is_git_folder?: boolean;
  git_branch?: string;
  in_recycle?: boolean;
  origin_path?: string;
  file_id?: string;
}

export interface ApiBody<T> {
  common: { code: number; msg: string };
  data?: T;
  request_id?: string;
}

export interface ListFilesData {
  files: FileEntry[];
}

export interface FolderNodesData {
  nodes: FileEntry[];
}

export interface ReadFileData {
  file: FileEntry;
  content_base64: string;
  size: number;
}

export interface ValidatePathData {
  exists: boolean;
}

export interface GitFolderStatus {
  path: string;
  status: number;
  message?: string;
  branch?: string;
  repo_url?: string;
}

export interface GitFileStatus {
  path: string;
  staging: string;
  worktree: string;
}

export interface GitStatusData {
  clean: boolean;
  files: GitFileStatus[];
}

export interface GitFileDiffData {
  file: string;
  head_content_base64?: string;
  worktree_content_base64?: string;
  head_missing?: boolean;
  worktree_missing?: boolean;
}

export interface GitBranchData {
  current_branch: string;
  branches: string[];
}

export interface GitCommitInfo {
  hash: string;
  author: string;
  email: string;
  message: string;
  when: string;
}

export interface GitCommitHistoryData {
  commits: GitCommitInfo[];
}

export interface GitCredentials {
  git_username?: string;
  git_token?: string;
}

export interface NotebookKernelState {
  kernelName: string;
  state: 'disconnected' | 'connecting' | 'connected' | 'error';
  sessionId?: string;
  kernelId?: string;
  executionState?: string;
  error?: string;
}

export interface NotebookTab {
  kind: 'notebook';
  path: string;
  name: string;
  fileId?: string;
  modifyTime?: string;
  content: string;
  cells: import('./utils/notebook').NotebookCell[];
  notebookMeta: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
  dirty: boolean;
  loading?: boolean;
  kernel: NotebookKernelState;
}

export interface FileTab {
  kind: 'file';
  path: string;
  name: string;
  content: string;
  dirty: boolean;
  loading?: boolean;
}

export type OpenTab = FileTab | NotebookTab;
