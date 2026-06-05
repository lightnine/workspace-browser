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
  repo_url?: string;
}

export interface OpenTab {
  path: string;
  name: string;
  content: string;
  dirty: boolean;
  loading?: boolean;
}
