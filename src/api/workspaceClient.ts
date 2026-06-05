import type {
  ApiBody,
  FileEntry,
  FolderNodesData,
  GitFolderStatus,
  ListFilesData,
  ReadFileData,
  ValidatePathData,
  WorkspaceContext,
} from '../types';

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as ApiBody<T>;
  if (!res.ok || json.common.code !== 0) {
    throw new Error(json.common?.msg || `HTTP ${res.status}`);
  }
  return json.data as T;
}

function withCtx(ctx: WorkspaceContext, extra: Record<string, unknown> = {}) {
  return { ...ctx, ...extra };
}

export const workspaceApi = {
  healthz: () => fetch('/healthz').then((r) => r.ok),

  listFiles: (ctx: WorkspaceContext, path: string, recursive = false) =>
    post<ListFilesData>('/ListFiles', withCtx(ctx, { path, recursive })),

  getFolderNodePath: (ctx: WorkspaceContext, path: string) =>
    post<FolderNodesData>('/GetFolderNodePath', withCtx(ctx, { path })),

  validatePath: (ctx: WorkspaceContext, parentPath: string, name: string) =>
    post<ValidatePathData>('/ValidatePath', withCtx(ctx, { parent_path: parentPath, name })),

  createFolder: (ctx: WorkspaceContext, path: string) =>
    post<FileEntry>('/CreateFolder', withCtx(ctx, { path })),

  createFile: (ctx: WorkspaceContext, path: string, contentBase64 = '', overwrite = false) =>
    post<FileEntry>('/CreateFile', withCtx(ctx, { path, content_base64: contentBase64, overwrite })),

  createNotebook: (ctx: WorkspaceContext, path: string, kernelName = 'python3', overwrite = false) =>
    post<FileEntry>('/CreateNotebook', withCtx(ctx, { path, kernel_name: kernelName, overwrite })),

  readFile: (ctx: WorkspaceContext, path: string) =>
    post<ReadFileData>('/ReadFile', withCtx(ctx, { path })),

  writeFile: (ctx: WorkspaceContext, path: string, contentBase64: string, overwrite = true) =>
    post<FileEntry>('/WriteFile', withCtx(ctx, { path, content_base64: contentBase64, overwrite })),

  getFileInfo: (ctx: WorkspaceContext, path: string) =>
    post<FileEntry>('/GetFileInfo', withCtx(ctx, { path })),

  renamePath: (ctx: WorkspaceContext, path: string, newName: string, overwrite = false) =>
    post<FileEntry>('/RenamePath', withCtx(ctx, { path, new_name: newName, overwrite })),

  movePath: (ctx: WorkspaceContext, srcPath: string, destPath: string, overwrite = false) =>
    post<FileEntry>('/MovePath', withCtx(ctx, { src_path: srcPath, dest_path: destPath, overwrite })),

  copyPath: (ctx: WorkspaceContext, srcPath: string, destPath: string, overwrite = false) =>
    post<FileEntry>('/CopyPath', withCtx(ctx, { src_path: srcPath, dest_path: destPath, overwrite })),

  deletePath: (ctx: WorkspaceContext, path: string, softDelete = true) =>
    post<unknown>('/DeletePath', withCtx(ctx, { path, soft_delete: softDelete, permanent: !softDelete })),

  listRecycleBin: (ctx: WorkspaceContext) => post<ListFilesData>('/ListRecycleBin', withCtx(ctx)),

  restorePath: (ctx: WorkspaceContext, trashPath: string, targetParent = '') =>
    post<FileEntry>('/RestorePath', withCtx(ctx, { trash_path: trashPath, target_parent: targetParent })),

  emptyRecycleBin: (ctx: WorkspaceContext) => post<unknown>('/EmptyRecycleBin', withCtx(ctx)),

  createGitFolder: (
    ctx: WorkspaceContext,
    targetPath: string,
    repoUrl: string,
    branch: string,
    gitUsername = '',
    gitToken = '',
  ) =>
    post<GitFolderStatus>('/CreateGitFolder', withCtx(ctx, {
      target_path: targetPath,
      repo_url: repoUrl,
      branch,
      git_username: gitUsername,
      git_token: gitToken,
    })),

  getGitFolderStatus: (ctx: WorkspaceContext, path: string) =>
    post<GitFolderStatus>('/GetGitFolderStatus', withCtx(ctx, { path })),

  downloadFile: async (ctx: WorkspaceContext, path: string): Promise<Blob> => {
    const res = await fetch('/DownloadFile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withCtx(ctx, { path })),
    });
    if (!res.ok) {
      try {
        const json = (await res.json()) as ApiBody<unknown>;
        throw new Error(json.common?.msg || `HTTP ${res.status}`);
      } catch {
        throw new Error(`Download failed: HTTP ${res.status}`);
      }
    }
    return res.blob();
  },
};

export function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function encodeBase64Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export function encodeBase64Bytes(bytes: ArrayBuffer): string {
  const u8 = new Uint8Array(bytes);
  let binary = '';
  u8.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}
