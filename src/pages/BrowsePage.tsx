import { useRef, useState } from 'react';
import { AppShell } from '../components/AppShell';
import { CreateMenu } from '../components/CreateMenu';
import { Modal } from '../components/Modal';
import { ExplorerPanel } from '../components/ExplorerPanel';
import { FileEditorTabs } from '../components/FileEditorTabs';
import { FileTable, type RowAction } from '../components/FileTable';
import { WorkspaceTree } from '../components/WorkspaceTree';
import { BackendGapPanel } from '../components/BackendGapPanel';
import { useWorkspaceBrowser } from '../hooks/useWorkspaceBrowser';
import type { FileEntry, WorkspaceContext } from '../types';
import { FILE_TYPE_OPTIONS } from '../utils/format';
import { basename, joinPath } from '../utils/path';

interface Props {
  ctx: WorkspaceContext;
  onOpenGitEditor: (folderPath: string) => void;
}

export function BrowsePage({ ctx, onOpenGitEditor }: Props) {
  const ws = useWorkspaceBrowser(ctx);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createKind, setCreateKind] = useState<'folder' | 'file' | 'git' | 'notebook'>('folder');
  const [nameInput, setNameInput] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [actionTarget, setActionTarget] = useState<{ action: RowAction; entry: FileEntry } | null>(null);
  const [destInput, setDestInput] = useState('');
  const [showGap, setShowGap] = useState(false);
  const [globalSearchMsg, setGlobalSearchMsg] = useState<string | null>(null);
  const [explorerOn, setExplorerOn] = useState(true);
  const editorOpen = ws.tabs.length > 0;
  const showExplorer =
    !ws.isTrash && ws.treeView !== 'shared' && ws.treeView !== 'favorites' && (explorerOn || editorOpen);

  const run = async (fn: () => Promise<void>) => {
    setDialogError(null);
    try {
      await fn();
      setCreateOpen(false);
      setActionTarget(null);
      setNameInput('');
    } catch (e) {
      setDialogError(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCreate = (kind: 'folder' | 'file' | 'git' | 'notebook' | 'query') => {
    if (kind === 'query') {
      alert('Query 需业务层 t_file API，见 BACKEND_GAP.md P1');
      return;
    }
    setCreateKind(kind);
    setCreateOpen(true);
  };

  const handleRowAction = (action: RowAction, entry: FileEntry) => {
    if (action === 'favorite') {
      ws.toggleFavorite(entry.path);
      return;
    }
    if (action === 'git-editor') {
      onOpenGitEditor(entry.path);
      return;
    }
    if (action === 'open') {
      void ws.openEntry(entry);
      return;
    }
    if (action === 'download') {
      void run(() => ws.download(entry));
      return;
    }
    if (action === 'delete') {
      if (window.confirm(`Move "${entry.name}" to trash?`)) void run(() => ws.remove(entry, false));
      return;
    }
    if (action === 'permanent-delete') {
      if (window.confirm(`Permanently delete "${entry.name}"?`)) void run(() => ws.remove(entry, true));
      return;
    }
    if (action === 'restore') {
      void run(() => ws.restore(entry));
      return;
    }
    setActionTarget({ action, entry });
    if (action === 'rename') setDestInput(entry.name);
    if (action === 'move' || action === 'copy') setDestInput(entry.path);
  };

  const submitCreate = () =>
    run(async () => {
      if (createKind === 'folder') await ws.createFolder(nameInput.trim());
      else if (createKind === 'file') await ws.createFile(nameInput.trim());
      else if (createKind === 'notebook') await ws.createNotebook(nameInput.trim());
      else await ws.createGitFolder(nameInput.trim(), repoUrl.trim(), branch.trim());
    });

  const submitAction = () =>
    run(async () => {
      if (!actionTarget) return;
      const { action, entry } = actionTarget;
      if (action === 'rename') await ws.rename(entry, destInput.trim());
      if (action === 'move') await ws.move(entry, destInput.trim());
      if (action === 'copy') await ws.copy(entry, destInput.trim());
    });

  const onImport = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        await ws.importFile(file);
      } catch (e) {
        alert(e instanceof Error ? e.message : String(e));
        break;
      }
    }
  };

  const selectedEntry = ws.allFiles.find((f) => ws.selectedPaths.has(f.path)) ?? null;

  return (
    <AppShell
      userLabel={`uin ${ctx.uin}`}
      workspaceLabel={ctx.workspace_id}
      onGlobalSearch={(q) => {
        setGlobalSearchMsg(`全局搜索「${q}」需 SearchFiles API（P1）`);
        setTimeout(() => setGlobalSearchMsg(null), 4000);
      }}
    >
      <div className="dbx-workspace-page">
        <WorkspaceTree active={ws.treeView} onSelect={ws.selectTreeView} />

        <main className={`dbx-ws-main ${editorOpen ? 'editor-mode' : ''}`}>
          {globalSearchMsg && <div className="banner info">{globalSearchMsg}</div>}
          {ws.error && <div className="banner err">{ws.error}</div>}

          <div className={editorOpen ? 'dbx-editor-layout' : 'dbx-browse-layout'}>
            {showExplorer && (
              <ExplorerPanel
                ctx={ctx}
                currentPath={ws.currentPath}
                activeFilePath={ws.activeTab}
                visible={explorerOn}
                onToggleVisible={setExplorerOn}
                onSelectFolder={ws.openFolder}
                onOpenEntry={(e) => void ws.openEntry(e)}
                onAction={handleRowAction}
                favorites={ws.favorites}
                refreshSignal={ws.listVersion}
                onRefresh={() => void ws.refresh()}
              />
            )}
            <div className={editorOpen ? 'dbx-editor-main' : 'dbx-browse-main'}>
          {editorOpen ? (
                <FileEditorTabs
                  ctx={ctx}
                  tabs={ws.tabs}
                  activeTab={ws.activeTab}
                  onSelect={ws.setActiveTab}
                  onClose={ws.closeTab}
                  onChange={ws.updateTabContent}
                  onNotebookCells={ws.updateNotebookCells}
                  onNotebookKernel={ws.updateNotebookKernel}
                  onSave={(p) => void run(() => ws.saveTab(p))}
                  fullHeight
                />
          ) : (
          <>
          <div className="dbx-ws-header">
            <nav className="dbx-breadcrumb" aria-label="Breadcrumb">
              {ws.breadcrumbTrail.map((crumb, i) => (
                <span key={crumb.path + i}>
                  {i > 0 && <span className="sep">›</span>}
                  <button type="button" onClick={() => ws.openFolder(crumb.path)}>
                    {crumb.name}
                  </button>
                </span>
              ))}
              {ws.breadcrumbTrail.length === 0 && ws.treeView !== 'home' && (
                <span>{ws.folderTitle}</span>
              )}
            </nav>
          </div>

          <div className="dbx-folder-bar">
            <h2 className="folder-title">
              {ws.folderTitle}
              <button
                type="button"
                className={`fav-btn header ${ws.folderFavorite ? 'on' : ''}`}
                aria-label="Favorite folder"
                onClick={() => ws.setFolderFavorite((v) => !v)}
              >
                {ws.folderFavorite ? '★' : '☆'}
              </button>
            </h2>
            <div className="folder-actions">
              {!ws.isTrash && ws.treeView !== 'shared' && (
                <>
                  <button type="button" disabled title="后端缺失 SharePath API">
                    Share
                  </button>
                  <CreateMenu onCreate={handleCreate} />
                  <button type="button" onClick={() => fileInputRef.current?.click()}>
                    Import
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    hidden
                    onChange={(e) => void onImport(e.target.files)}
                  />
                </>
              )}
              {ws.isTrash && (
                <button type="button" className="danger" onClick={() => void ws.emptyTrash()}>
                  Empty trash
                </button>
              )}
              <span className={`dbx-pill ${ws.backendOk ? 'ok' : ws.backendOk === false ? 'err' : ''}`}>
                {ws.backendOk === null ? '…' : ws.backendOk ? 'API OK' : 'Offline'}
              </span>
            </div>
          </div>

          <div className="dbx-filter-bar">
            <input
              className="folder-search"
              placeholder="Search"
              value={ws.search}
              onChange={(e) => ws.setSearch(e.target.value)}
            />
            <select
              className="filter-select"
              value={ws.typeFilter}
              onChange={(e) => ws.setTypeFilter(e.target.value as typeof ws.typeFilter)}
            >
              {FILE_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t === 'All' ? 'Type' : t}
                </option>
              ))}
            </select>
            <select
              className="filter-select"
              value={ws.ownerFilter}
              onChange={(e) => ws.setOwnerFilter(e.target.value)}
            >
              <option value="">Owner</option>
              {ws.owners.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <select className="filter-select" disabled title="后端无 last_modified 独立字段">
              <option>Last modified</option>
            </select>
          </div>

          {ws.treeView === 'shared' && (
            <div className="empty-state">
              <p>Shared with me — 需 ACL / 共享索引 API（BACKEND_GAP P1）</p>
            </div>
          )}

          <div
            className="drop-zone"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!ws.isTrash) void onImport(e.dataTransfer.files);
            }}
          >
            {ws.loading ? (
              <p className="muted pad">Loading…</p>
            ) : ws.treeView !== 'shared' ? (
              <FileTable
                files={ws.files}
                view={ws.isTrash ? 'trash' : 'workspace'}
                selectedPaths={ws.selectedPaths}
                favorites={ws.favorites}
                onSelectRow={(entry, checked) => {
                  ws.setSelectedPaths((prev) => {
                    const next = new Set(prev);
                    if (checked) next.add(entry.path);
                    else next.delete(entry.path);
                    return next;
                  });
                }}
                onSelectAll={(checked) => {
                  ws.setSelectedPaths(checked ? new Set(ws.files.map((f) => f.path)) : new Set());
                }}
                onOpen={(e) => void ws.openEntry(e)}
                onAction={handleRowAction}
                onDropMove={(src, dest) => {
                  if (src === dest) return;
                  const name = basename(src);
                  void run(() =>
                    ws.move({ path: src, name, is_dir: false, size: 0, modify_time: '' }, joinPath(dest, name)),
                  );
                }}
              />
            ) : null}
          </div>
          </>
          )}
            </div>
          </div>

          <div className="gap-toggle-row">
            <button type="button" onClick={() => setShowGap((v) => !v)}>
              {showGap ? 'Hide' : 'Show'} backend gap panel
            </button>
          </div>
          {showGap && <BackendGapPanel apiLog={ws.apiLog} selected={selectedEntry} />}
        </main>
      </div>

      <Modal
        title={
          createKind === 'git'
            ? 'Create Git folder'
            : createKind === 'file'
              ? 'Create file'
              : createKind === 'notebook'
                ? 'Create Notebook'
                : 'Create folder'
        }
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <button type="button" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={() => void submitCreate()}>
              Create
            </button>
          </>
        }
      >
        <label>
          {createKind === 'notebook' ? 'Notebook name' : 'Name'}
          <input
            value={nameInput}
            placeholder={createKind === 'notebook' ? 'My Notebook' : undefined}
            onChange={(e) => setNameInput(e.target.value)}
          />
          {createKind === 'notebook' && <span className="muted">自动追加 .ipynb</span>}
        </label>
        {createKind === 'git' && (
          <>
            <label>
              Repository URL
              <input
                value={repoUrl}
                placeholder="git@github.com:lightnine/mini.git"
                onChange={(e) => setRepoUrl(e.target.value)}
              />
              <span className="muted">SSH 会自动转为 HTTPS；克隆需轮询完成（约数秒）</span>
            </label>
            <label>
              Branch
              <input value={branch} onChange={(e) => setBranch(e.target.value)} />
            </label>
          </>
        )}
        {dialogError && <p className="form-err">{dialogError}</p>}
      </Modal>

      <Modal
        title={actionTarget?.action === 'rename' ? 'Rename' : actionTarget?.action === 'move' ? 'Move' : 'Clone'}
        open={!!actionTarget}
        onClose={() => setActionTarget(null)}
        footer={
          <>
            <button type="button" onClick={() => setActionTarget(null)}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={() => void submitAction()}>
              OK
            </button>
          </>
        }
      >
        <label>
          {actionTarget?.action === 'rename' ? 'New name' : 'Destination path'}
          <input value={destInput} onChange={(e) => setDestInput(e.target.value)} />
        </label>
        {dialogError && <p className="form-err">{dialogError}</p>}
      </Modal>
    </AppShell>
  );
}
