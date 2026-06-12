import type {
  ApiBody,
  GitBranchData,
  GitCommitHistoryData,
  GitCredentials,
  GitFileDiffData,
  GitStatusData,
  WorkspaceContext,
} from '../types';

export type { GitCredentials };

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

export const gitApi = {
  getStatus: (ctx: WorkspaceContext, path: string) =>
    post<GitStatusData>('/GetStatus', withCtx(ctx, { path })),

  getFileDiff: (ctx: WorkspaceContext, path: string, file: string) =>
    post<GitFileDiffData>('/GetFileDiff', withCtx(ctx, { path, file })),

  listBranches: (ctx: WorkspaceContext, path: string) =>
    post<GitBranchData>('/ListBranches', withCtx(ctx, { path })),

  getCommitHistory: (ctx: WorkspaceContext, path: string, limit = 1) =>
    post<GitCommitHistoryData>('/GetCommitHistory', withCtx(ctx, { path, limit })),

  stageFiles: (ctx: WorkspaceContext, path: string, files: string[], all = false) =>
    post<{ staged: boolean }>('/StageFiles', withCtx(ctx, { path, files, all })),

  unstageFiles: (ctx: WorkspaceContext, path: string, files: string[], all = false) =>
    post<{ unstaged: boolean }>('/UnstageFiles', withCtx(ctx, { path, files, all })),

  commitAndPush: (
    ctx: WorkspaceContext,
    path: string,
    message: string,
    creds: GitCredentials = {},
    description = '',
  ) =>
    post<{ commit_hash?: string; pushed?: boolean; nothing_to_commit?: boolean }>(
      '/CommitAndPush',
      withCtx(ctx, {
        path,
        message: description ? `${message}\n\n${description}` : message,
        push: true,
        git_username: creds.git_username || '',
        git_token: creds.git_token || '',
      }),
    ),

  pullRepo: (ctx: WorkspaceContext, path: string, creds: GitCredentials = {}, branch = '') =>
    post<{ already_up_to_date?: boolean; head_commit?: string; current_branch?: string }>(
      '/PullRepo',
      withCtx(ctx, {
        path,
        branch,
        git_username: creds.git_username || '',
        git_token: creds.git_token || '',
      }),
    ),

  createBranch: (ctx: WorkspaceContext, path: string, branch: string, checkout = true) =>
    post<{ current_branch: string }>('/CreateBranch', withCtx(ctx, { path, branch, checkout })),

  checkoutBranch: (ctx: WorkspaceContext, path: string, branch: string) =>
    post<{ current_branch: string }>('/CheckoutBranch', withCtx(ctx, { path, branch })),

  discardChanges: (ctx: WorkspaceContext, path: string) =>
    post<{ discarded: boolean }>('/DiscardChanges', withCtx(ctx, { path })),
};
