import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { workspaceApi } from '../api/workspaceClient';
import type { FileEntry, WorkspaceContext } from '../types';
import { entryIcon } from '../utils/format';
import { dirname } from '../utils/path';
import type { RowAction } from './FileTable';

interface TreeNode {
  entry: FileEntry;
  children?: TreeNode[];
  expanded: boolean;
  loading: boolean;
}

interface Props {
  ctx: WorkspaceContext;
  currentPath: string;
  activeFilePath?: string | null;
  visible: boolean;
  onToggleVisible: (on: boolean) => void;
  onSelectFolder: (path: string) => void;
  onOpenEntry: (entry: FileEntry) => void;
  onAction: (action: RowAction, entry: FileEntry) => void;
  favorites: Set<string>;
  refreshSignal: number;
  onRefresh?: () => void;
}

export function ExplorerPanel({
  ctx,
  currentPath,
  activeFilePath,
  visible,
  onToggleVisible,
  onSelectFolder,
  onOpenEntry,
  onAction,
  favorites,
  refreshSignal,
  onRefresh,
}: Props) {
  const [root, setRoot] = useState<TreeNode[]>([]);
  const rootRef = useRef(root);
  rootRef.current = root;
  const [treeSearch, setTreeSearch] = useState('');
  const [loadingRoot, setLoadingRoot] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const userPrefix = `${ctx.app_id}/${ctx.workspace_id}/users/${ctx.uin}`;

  const loadChildren = useCallback(
    async (path: string) => {
      const data = await workspaceApi.listFiles(ctx, path);
      return (data.files || []).sort((a, b) => {
        if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    },
    [ctx],
  );

  const expandPaths = useMemo(() => {
    const paths = new Set<string>();
    const add = (path: string) => {
      let acc = '';
      for (const seg of path.split('/').filter(Boolean)) {
        acc = acc ? `${acc}/${seg}` : seg;
        paths.add(acc);
      }
    };
    add(currentPath);
    if (activeFilePath) add(dirname(activeFilePath));
    return paths;
  }, [currentPath, activeFilePath]);

  const reloadSubtree = useCallback(
    async (prevNodes: TreeNode[], folderPath: string): Promise<TreeNode[]> => {
      const entries = await loadChildren(folderPath);
      const prevByPath = new Map(prevNodes.map((n) => [n.entry.path, n]));
      const nodes: TreeNode[] = [];

      for (const entry of entries) {
        const prev = prevByPath.get(entry.path);
        const shouldExpand =
          entry.is_dir && (expandPaths.has(entry.path) || (prev?.expanded ?? false));

        let children: TreeNode[] | undefined;
        if (shouldExpand) {
          children = await reloadSubtree(prev?.children ?? [], entry.path);
        }

        nodes.push({
          entry,
          expanded: shouldExpand,
          loading: false,
          children: shouldExpand ? children : undefined,
        });
      }
      return nodes;
    },
    [expandPaths, loadChildren],
  );

  const refreshTree = useCallback(async () => {
    const isInitial = rootRef.current.length === 0;
    if (isInitial) setLoadingRoot(true);
    try {
      const next = await reloadSubtree(rootRef.current, '');
      setRoot(next);
    } finally {
      if (isInitial) setLoadingRoot(false);
    }
  }, [reloadSubtree]);

  useEffect(() => {
    if (visible) void refreshTree();
  }, [visible, refreshSignal, ctx, refreshTree]);

  const collapseAll = () => {
    const walk = (nodes: TreeNode[]): TreeNode[] =>
      nodes.map((n) => ({
        ...n,
        expanded: false,
        children: n.children ? walk(n.children) : undefined,
      }));
    setRoot((prev) => walk(prev));
  };

  const updateAtChain = (nodes: TreeNode[], chain: number[], updater: (n: TreeNode) => TreeNode): TreeNode[] => {
    if (chain.length === 0) return nodes;
    const [head, ...rest] = chain;
    return nodes.map((n, i) => {
      if (i !== head) return n;
      if (rest.length === 0) return updater(n);
      return { ...n, children: n.children ? updateAtChain(n.children, rest, updater) : n.children };
    });
  };

  const toggle = async (chain: number[]) => {
    let target: TreeNode | undefined;
    let cursor = root;
    for (let i = 0; i < chain.length; i++) {
      target = cursor[chain[i]];
      if (!target) return;
      if (i < chain.length - 1) cursor = target.children || [];
    }
    if (!target) return;

    if (target.expanded) {
      setRoot((prev) => updateAtChain(prev, chain, (n) => ({ ...n, expanded: false })));
      return;
    }

    setRoot((prev) => updateAtChain(prev, chain, (n) => ({ ...n, loading: true, expanded: true })));
    const children = await loadChildren(target.entry.path);
    setRoot((prev) =>
      updateAtChain(prev, chain, (n) => ({
        ...n,
        loading: false,
        expanded: true,
        children: children.map((entry) => ({ entry, expanded: false, loading: false })),
      })),
    );
  };

  const q = treeSearch.trim().toLowerCase();
  const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
    if (!q) return nodes;
    const out: TreeNode[] = [];
    for (const node of nodes) {
      const nameMatch = node.entry.name.toLowerCase().includes(q);
      const kids = node.children ? filterNodes(node.children) : [];
      if (nameMatch || kids.length > 0) {
        out.push({ ...node, expanded: true, children: kids.length ? kids : node.children });
      }
    }
    return out;
  };

  const displayNodes = useMemo(() => filterNodes(root), [root, q]);

  const renderNodes = (nodes: TreeNode[], chain: number[] = [], depth = 0) =>
    nodes.map((node, i) => {
      const pathChain = [...chain, i];
      const icon = entryIcon(node.entry);
      const isGit = node.entry.is_git_folder || node.entry.node_type === 'git_folder';
      const isFolder = node.entry.is_dir;
      const isActive =
        (isFolder && currentPath === node.entry.path) ||
        (!isFolder && activeFilePath === node.entry.path);
      const isFav = favorites.has(node.entry.path);
      const menuOpen = openMenu === node.entry.path;

      return (
        <div key={node.entry.path} className="explorer-node" style={{ paddingLeft: `${depth * 12}px` }}>
          <div className={`explorer-row ${isActive ? 'active' : ''} ${menuOpen ? 'menu-open' : ''}`}>
            {isFolder ? (
              <button
                type="button"
                className="explorer-toggle"
                onClick={() => void toggle(pathChain)}
                aria-label="expand"
              >
                {node.loading ? '…' : node.expanded ? '▾' : '▸'}
              </button>
            ) : (
              <span className="explorer-toggle spacer" />
            )}
            <button
              type="button"
              className="explorer-label"
              onClick={() => {
                if (isFolder) onSelectFolder(node.entry.path);
                else void onOpenEntry(node.entry);
              }}
            >
              <span className={`explorer-icon icon-${icon}`} />
              <span className="explorer-name">{node.entry.name}</span>
              {isGit && node.entry.git_branch && (
                <span className="git-branch-badge">{node.entry.git_branch}</span>
              )}
              {isGit && !node.entry.git_branch && <span className="git-branch-badge">Git</span>}
            </button>
            <div className="explorer-actions">
              <button
                type="button"
                className="overflow-btn explorer-overflow-btn"
                aria-label="Overflow actions"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenu(menuOpen ? null : node.entry.path);
                }}
              >
                ⋯
              </button>
              {menuOpen && (
                <>
                  <button
                    type="button"
                    className="menu-backdrop"
                    aria-label="Close menu"
                    onClick={() => setOpenMenu(null)}
                  />
                  <menu className="overflow-menu explorer-overflow-menu">
                    {isGit && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            onAction('git-editor', node.entry);
                            setOpenMenu(null);
                          }}
                        >
                          Open in Git folder editor
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onAction('git-editor', node.entry);
                            setOpenMenu(null);
                          }}
                        >
                          Git…
                        </button>
                        <hr />
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        onAction('open', node.entry);
                        setOpenMenu(null);
                      }}
                    >
                      Open in new browser tab
                    </button>
                    <button type="button" disabled title="后端缺失">
                      View details
                    </button>
                    <button type="button" disabled title="后端缺失">
                      Copy URL/path
                    </button>
                    <hr />
                    <button
                      type="button"
                      onClick={() => {
                        onAction('rename', node.entry);
                        setOpenMenu(null);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAction('move', node.entry);
                        setOpenMenu(null);
                      }}
                    >
                      Move
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAction('copy', node.entry);
                        setOpenMenu(null);
                      }}
                    >
                      Clone
                    </button>
                    <hr />
                    {!isFolder && (
                      <button
                        type="button"
                        onClick={() => {
                          onAction('download', node.entry);
                          setOpenMenu(null);
                        }}
                      >
                        Download as
                      </button>
                    )}
                    {!isFolder && <hr />}
                    <button type="button" disabled title="后端缺失 ACL API">
                      Share (Permissions)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onAction('favorite', node.entry);
                        setOpenMenu(null);
                      }}
                    >
                      {isFav ? 'Remove from favorites' : 'Add to favorites'}
                    </button>
                    <hr />
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        onAction('delete', node.entry);
                        setOpenMenu(null);
                      }}
                    >
                      Move this {isFolder ? 'folder' : 'file'} to Trash
                    </button>
                  </menu>
                </>
              )}
            </div>
          </div>
          {node.expanded && node.children && (
            <div className="explorer-children">{renderNodes(node.children, pathChain, depth + 1)}</div>
          )}
        </div>
      );
    });

  if (!visible) {
    return (
      <button type="button" className="explorer-collapsed-tab" onClick={() => onToggleVisible(true)}>
        Tree
      </button>
    );
  }

  return (
    <aside className="explorer-panel">
      <div className="explorer-toolbar">
        <label className="explorer-tree-toggle">
          <input type="checkbox" checked={visible} onChange={(e) => onToggleVisible(e.target.checked)} />
          Tree view: ON
        </label>
        <div className="explorer-toolbar-actions">
          <button type="button" title="Refresh" onClick={() => onRefresh?.()}>
            ↻
          </button>
          <button type="button" title="Collapse all" onClick={collapseAll}>
            ⊟
          </button>
        </div>
      </div>
      <input
        className="explorer-search"
        placeholder="Type to search"
        value={treeSearch}
        onChange={(e) => setTreeSearch(e.target.value)}
      />
      <div className="explorer-path muted" title={userPrefix}>
        … / {ctx.uin}
      </div>
      <div className="explorer-tree-body">
        {loadingRoot ? <p className="muted pad">Loading…</p> : renderNodes(displayNodes)}
      </div>
    </aside>
  );
}
