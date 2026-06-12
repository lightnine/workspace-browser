import { useCallback, useEffect, useMemo, useState } from 'react';
import { decodeBase64Utf8 } from '../api/workspaceClient';
import { workspaceApi } from '../api/workspaceClient';
import { gitApi, type GitCredentials } from '../api/gitClient';
import type { GitFileStatus, WorkspaceContext } from '../types';
import { buildLineDiff } from '../utils/diff';
import { basename } from '../utils/path';

const GIT_CRED_KEY = 'ws-browser-git-creds';

export function loadGitCredentials(): GitCredentials {
  try {
    const raw = localStorage.getItem(GIT_CRED_KEY);
    if (raw) return JSON.parse(raw) as GitCredentials;
  } catch {
    /* ignore */
  }
  return { git_username: '', git_token: '' };
}

export function saveGitCredentials(creds: GitCredentials) {
  localStorage.setItem(GIT_CRED_KEY, JSON.stringify(creds));
}

export type GitChangeKind = 'A' | 'M' | 'D' | '?';

export interface GitChangeEntry {
  path: string;
  name: string;
  kind: GitChangeKind;
  staged: boolean;
  raw: GitFileStatus;
}

function changeKind(f: GitFileStatus): GitChangeKind {
  if (f.worktree === 'untracked' || f.staging === 'untracked') return '?';
  if (f.staging === 'deleted' || f.worktree === 'deleted') return 'D';
  if (f.staging === 'added') return 'A';
  return 'M';
}

function isStaged(f: GitFileStatus): boolean {
  return f.staging !== 'unmodified' && f.staging !== 'untracked' && f.staging !== '';
}

function toChanges(files: GitFileStatus[]): GitChangeEntry[] {
  return files
    .filter((f) => f.worktree !== 'unmodified' || f.staging !== 'unmodified')
    .map((f) => ({
      path: f.path,
      name: basename(f.path),
      kind: changeKind(f),
      staged: isStaged(f),
      raw: f,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export function useGitFolder(ctx: WorkspaceContext, folderPath: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<GitFileStatus[]>([]);
  const [currentBranch, setCurrentBranch] = useState('main');
  const [branches, setBranches] = useState<string[]>([]);
  const [headCommit, setHeadCommit] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [diffLines, setDiffLines] = useState<string[]>([]);
  const [rawContent, setRawContent] = useState('');
  const [diffView, setDiffView] = useState<'code' | 'raw'>('code');
  const [commitMessage, setCommitMessage] = useState('');
  const [commitDescription, setCommitDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState<GitCredentials>(loadGitCredentials);
  const [repoURL, setRepoURL] = useState('');

  const folderName = basename(folderPath) || folderPath;
  const changes = useMemo(() => toChanges(status), [status]);
  const stagedPaths = useMemo(() => new Set(changes.filter((c) => c.staged).map((c) => c.path)), [changes]);
  const allStaged = changes.length > 0 && changes.every((c) => c.staged);

  const refresh = useCallback(async () => {
    if (!folderPath) return;
    setLoading(true);
    setError(null);
    try {
      const [st, br, hist, meta] = await Promise.all([
        gitApi.getStatus(ctx, folderPath),
        gitApi.listBranches(ctx, folderPath),
        gitApi.getCommitHistory(ctx, folderPath, 1),
        workspaceApi.getGitFolderStatus(ctx, folderPath).catch(() => null),
      ]);
      if (meta?.repo_url) setRepoURL(meta.repo_url);
      else if (meta?.branch) setRepoURL('');
      setStatus(st.files || []);
      setCurrentBranch(br.current_branch || 'main');
      setBranches(br.branches || []);
      const hash = hist.commits?.[0]?.hash || '';
      setHeadCommit(hash ? hash.slice(0, 7) : '');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [ctx, folderPath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadDiff = useCallback(
    async (file: string) => {
      setSelectedFile(file);
      try {
        const diff = await gitApi.getFileDiff(ctx, folderPath, file);
        const head = diff.head_content_base64 ? decodeBase64Utf8(diff.head_content_base64) : '';
        const work = diff.worktree_content_base64 ? decodeBase64Utf8(diff.worktree_content_base64) : '';
        setRawContent(work);
        setDiffLines(buildLineDiff(head, work));
      } catch (e) {
        setRawContent('');
        setDiffLines([`Error: ${e instanceof Error ? e.message : String(e)}`]);
      }
    },
    [ctx, folderPath],
  );

  useEffect(() => {
    if (changes.length > 0 && !selectedFile) {
      void loadDiff(changes[0].path);
    }
  }, [changes, selectedFile, loadDiff]);

  const toggleStage = async (entry: GitChangeEntry, staged: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (staged) {
        await gitApi.stageFiles(ctx, folderPath, [entry.path]);
      } else {
        await gitApi.unstageFiles(ctx, folderPath, [entry.path]);
      }
      await refresh();
      if (selectedFile === entry.path) void loadDiff(entry.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleStageAll = async (staged: boolean) => {
    setBusy(true);
    setError(null);
    try {
      if (staged) {
        await gitApi.stageFiles(ctx, folderPath, [], true);
      } else {
        await gitApi.unstageFiles(ctx, folderPath, [], true);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const commitAndPush = async () => {
    if (!commitMessage.trim()) {
      setError('Commit message is required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      saveGitCredentials(creds);
      await gitApi.commitAndPush(ctx, folderPath, commitMessage.trim(), creds, commitDescription.trim());
      setCommitMessage('');
      setCommitDescription('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pull = async () => {
    setBusy(true);
    setError(null);
    try {
      saveGitCredentials(creds);
      await gitApi.pullRepo(ctx, folderPath, creds, currentBranch);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const switchBranch = async (branch: string) => {
    if (branch === currentBranch) return;
    setBusy(true);
    setError(null);
    try {
      await gitApi.checkoutBranch(ctx, folderPath, branch);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const createBranch = async (name: string) => {
    const branch = name.trim();
    if (!branch) return;
    setBusy(true);
    setError(null);
    try {
      await gitApi.createBranch(ctx, folderPath, branch, true);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const discardAll = async () => {
    if (!window.confirm('Discard all uncommitted changes in this Git folder?')) return;
    setBusy(true);
    setError(null);
    try {
      await gitApi.discardChanges(ctx, folderPath);
      await refresh();
      setSelectedFile(null);
      setDiffLines([]);
      setRawContent('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return {
    folderName,
    folderPath,
    repoURL,
    loading,
    error,
    busy,
    changes,
    stagedPaths,
    allStaged,
    currentBranch,
    branches,
    headCommit,
    selectedFile,
    diffLines,
    rawContent,
    diffView,
    setDiffView,
    commitMessage,
    setCommitMessage,
    commitDescription,
    setCommitDescription,
    creds,
    setCreds,
    refresh,
    loadDiff,
    toggleStage,
    toggleStageAll,
    commitAndPush,
    pull,
    switchBranch,
    createBranch,
    discardAll,
  };
}
