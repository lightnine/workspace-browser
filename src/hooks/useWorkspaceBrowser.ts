import { useCallback, useEffect, useMemo, useState } from 'react';
import { decodeBase64Utf8, encodeBase64Utf8, encodeBase64Bytes, workspaceApi } from '../api/workspaceClient';
import type { WorkspaceTreeView } from '../components/WorkspaceTree';
import type { FileEntry, OpenTab, WorkspaceContext } from '../types';
import { entryTypeLabel, type FileTypeFilter } from '../utils/format';
import { joinPath } from '../utils/path';

const FAV_KEY = 'ws-browser-favorites';

function loadFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

function saveFavorites(favs: Set<string>) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));
}

export function useWorkspaceBrowser(ctx: WorkspaceContext) {
  const [treeView, setTreeView] = useState<WorkspaceTreeView>('home');
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<FileEntry[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>('All');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [apiLog, setApiLog] = useState<string[]>([]);
  const [folderFavorite, setFolderFavorite] = useState(false);

  const logApi = (msg: string) =>
    setApiLog((prev) => [`${new Date().toLocaleTimeString()} ${msg}`, ...prev].slice(0, 20));

  const isTrash = treeView === 'trash';

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ok = await workspaceApi.healthz();
      setBackendOk(ok);
      if (!ok) throw new Error('workspace-service 未启动（:8080）');

      if (isTrash) {
        logApi('ListRecycleBin');
        const data = await workspaceApi.listRecycleBin(ctx);
        setFiles(data.files || []);
        setBreadcrumbs([]);
      } else if (treeView === 'shared') {
        setFiles([]);
        setBreadcrumbs([]);
      } else if (treeView === 'favorites') {
        logApi('ListFiles (favorites aggregate)');
        const data = await workspaceApi.listFiles(ctx, '');
        const all = data.files || [];
        setFiles(all.filter((f) => favorites.has(f.path)));
        setBreadcrumbs([]);
      } else {
        logApi(`ListFiles path=${currentPath || '/'}`);
        const [list, crumbs] = await Promise.all([
          workspaceApi.listFiles(ctx, currentPath),
          workspaceApi.getFolderNodePath(ctx, currentPath),
        ]);
        setFiles(list.files || []);
        setBreadcrumbs(crumbs.nodes || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [ctx, currentPath, isTrash, treeView, favorites]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    for (const f of files) {
      const o = f.owner_uin || f.creator_uin;
      if (o) set.add(o);
    }
    return [...set].sort();
  }, [files]);

  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = [...files].sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    if (q) list = list.filter((f) => f.name.toLowerCase().includes(q));
    if (typeFilter !== 'All') {
      list = list.filter((f) => entryTypeLabel(f) === typeFilter);
    }
    if (ownerFilter) {
      list = list.filter((f) => (f.owner_uin || f.creator_uin || '') === ownerFilter);
    }
    return list;
  }, [files, search, typeFilter, ownerFilter]);

  const folderTitle = useMemo(() => {
    if (isTrash) return 'Trash';
    if (treeView === 'favorites') return 'Favorites';
    if (treeView === 'shared') return 'Shared with me';
    if (breadcrumbs.length) return breadcrumbs[breadcrumbs.length - 1].name || 'Home';
    return 'Home';
  }, [breadcrumbs, isTrash, treeView]);

  const breadcrumbTrail = useMemo(() => {
    if (isTrash || treeView === 'favorites' || treeView === 'shared') return [];
    const trail = [{ name: 'Workspace', path: '' }];
    if (currentPath === '' && breadcrumbs.length === 0) return trail;
    for (const n of breadcrumbs) {
      trail.push({ name: n.name || 'Home', path: n.path });
    }
    return trail;
  }, [breadcrumbs, currentPath, isTrash, treeView]);

  const selectTreeView = (view: WorkspaceTreeView) => {
    setTreeView(view);
    setSelectedPaths(new Set());
    if (view === 'home' || view === 'workspace') {
      setCurrentPath('');
    }
  };

  const openFolder = (path: string) => {
    setTreeView('home');
    setCurrentPath(path);
    setSelectedPaths(new Set());
  };

  const toggleFavorite = (path: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      saveFavorites(next);
      return next;
    });
  };

  const openFileTab = async (entry: FileEntry) => {
    const existing = tabs.find((t) => t.path === entry.path);
    if (existing) {
      setActiveTab(entry.path);
      return;
    }
    const tab: OpenTab = { path: entry.path, name: entry.name, content: '', dirty: false, loading: true };
    setTabs((prev) => [...prev, tab]);
    setActiveTab(entry.path);
    try {
      logApi(`ReadFile ${entry.path}`);
      const data = await workspaceApi.readFile(ctx, entry.path);
      const text = decodeBase64Utf8(data.content_base64 || '');
      setTabs((prev) =>
        prev.map((t) => (t.path === entry.path ? { ...t, content: text, loading: false } : t)),
      );
    } catch (e) {
      setTabs((prev) =>
        prev.map((t) =>
          t.path === entry.path
            ? { ...t, content: `# 无法打开\n\n${e instanceof Error ? e.message : String(e)}`, loading: false }
            : t,
        ),
      );
    }
  };

  const openEntry = async (entry: FileEntry) => {
    if (entry.is_dir && !entry.in_recycle) {
      openFolder(entry.path);
      return;
    }
    if (!entry.is_dir) await openFileTab(entry);
  };

  const saveTab = async (path: string) => {
    const tab = tabs.find((t) => t.path === path);
    if (!tab) return;
    logApi(`WriteFile ${path}`);
    await workspaceApi.writeFile(ctx, path, encodeBase64Utf8(tab.content), true);
    setTabs((prev) => prev.map((t) => (t.path === path ? { ...t, dirty: false } : t)));
  };

  const updateTabContent = (path: string, content: string) => {
    setTabs((prev) => prev.map((t) => (t.path === path ? { ...t, content, dirty: true } : t)));
  };

  const closeTab = (path: string) => {
    setTabs((prev) => prev.filter((t) => t.path !== path));
    if (activeTab === path) setActiveTab(null);
  };

  const createFolder = async (name: string) => {
    const path = joinPath(currentPath, name);
    const v = await workspaceApi.validatePath(ctx, currentPath, name);
    if (v.exists) throw new Error('名称已存在');
    logApi(`CreateFolder ${path}`);
    await workspaceApi.createFolder(ctx, path);
    await refresh();
  };

  const createFile = async (name: string, content = '') => {
    const path = joinPath(currentPath, name);
    logApi(`CreateFile ${path}`);
    await workspaceApi.createFile(ctx, path, encodeBase64Utf8(content), false);
    await refresh();
  };

  const importFile = async (file: File) => {
    const path = joinPath(currentPath, file.name);
    const buf = await file.arrayBuffer();
    if (buf.byteLength > 10 * 1024 * 1024) {
      throw new Error('文件 >10MB：workspace-service 尚无 STS 直传 API（见 BACKEND_GAP.md P0）');
    }
    logApi(`CreateFile import ${path} (${buf.byteLength} bytes)`);
    await workspaceApi.createFile(ctx, path, encodeBase64Bytes(buf), true);
    await refresh();
  };

  const rename = async (entry: FileEntry, newName: string) => {
    logApi(`RenamePath ${entry.path} -> ${newName}`);
    await workspaceApi.renamePath(ctx, entry.path, newName);
    await refresh();
  };

  const move = async (entry: FileEntry, destPath: string) => {
    logApi(`MovePath ${entry.path} -> ${destPath}`);
    await workspaceApi.movePath(ctx, entry.path, destPath);
    await refresh();
  };

  const copy = async (entry: FileEntry, destPath: string) => {
    logApi(`CopyPath ${entry.path} -> ${destPath}`);
    await workspaceApi.copyPath(ctx, entry.path, destPath);
    await refresh();
  };

  const remove = async (entry: FileEntry, permanent = false) => {
    logApi(`DeletePath ${entry.path} permanent=${permanent}`);
    await workspaceApi.deletePath(ctx, entry.path, !permanent);
    closeTab(entry.path);
    await refresh();
  };

  const restore = async (entry: FileEntry) => {
    logApi(`RestorePath ${entry.path}`);
    await workspaceApi.restorePath(ctx, entry.path);
    await refresh();
  };

  const emptyTrash = async () => {
    logApi('EmptyRecycleBin');
    await workspaceApi.emptyRecycleBin(ctx);
    await refresh();
  };

  const download = async (entry: FileEntry) => {
    logApi(`DownloadFile ${entry.path}`);
    const blob = await workspaceApi.downloadFile(ctx, entry.path);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = entry.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createGitFolder = async (name: string, repoUrl: string, branch: string) => {
    const path = joinPath(currentPath, name);
    logApi(`CreateGitFolder ${path}`);
    await workspaceApi.createGitFolder(ctx, path, repoUrl, branch);
    await refresh();
  };

  const createNotebook = async (name: string, kernelName = 'python3') => {
    const base = name.trim();
    const fileName = base.toLowerCase().endsWith('.ipynb') ? base : `${base}.ipynb`;
    const path = joinPath(currentPath, fileName);
    const v = await workspaceApi.validatePath(ctx, currentPath, fileName);
    if (v.exists) throw new Error('名称已存在');
    logApi(`CreateNotebook ${path}`);
    await workspaceApi.createNotebook(ctx, path, kernelName);
    await refresh();
  };

  return {
    treeView,
    selectTreeView,
    currentPath,
    openFolder,
    files: filteredFiles,
    allFiles: files,
    breadcrumbs,
    breadcrumbTrail,
    folderTitle,
    selectedPaths,
    setSelectedPaths,
    favorites,
    toggleFavorite,
    folderFavorite,
    setFolderFavorite,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    ownerFilter,
    setOwnerFilter,
    owners,
    loading,
    error,
    backendOk,
    tabs,
    activeTab,
    setActiveTab,
    apiLog,
    refresh,
    openEntry,
    saveTab,
    updateTabContent,
    closeTab,
    createFolder,
    createFile,
    importFile,
    rename,
    move,
    copy,
    remove,
    restore,
    emptyTrash,
    download,
    createGitFolder,
    createNotebook,
    isTrash,
  };
}
