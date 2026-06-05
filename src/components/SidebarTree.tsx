import { useEffect, useState } from 'react';
import type { FileEntry, WorkspaceContext } from '../types';
import { workspaceApi } from '../api/workspaceClient';

interface TreeNode {
  entry: FileEntry;
  children?: TreeNode[];
  expanded: boolean;
  loading: boolean;
}

interface Props {
  ctx: WorkspaceContext;
  currentPath: string;
  onSelect: (path: string) => void;
  onTrash: () => void;
  view: 'workspace' | 'trash';
}

export function SidebarTree({ ctx, currentPath, onSelect, onTrash, view }: Props) {
  const [root, setRoot] = useState<TreeNode[]>([]);

  const loadChildren = async (path: string): Promise<FileEntry[]> => {
    const data = await workspaceApi.listFiles(ctx, path);
    return (data.files || []).filter((f) => f.is_dir);
  };

  useEffect(() => {
    void (async () => {
      const dirs = await loadChildren('');
      setRoot(
        dirs.map((entry) => ({
          entry,
          expanded: false,
          loading: false,
        })),
      );
    })();
  }, [ctx]);

  const toggle = async (node: TreeNode, pathChain: number[]) => {
    const next = [...root];
    let cursor: TreeNode[] = next;
    let target = node;
    for (let i = 0; i < pathChain.length - 1; i++) {
      cursor = cursor[pathChain[i]].children!;
    }
    const idx = pathChain[pathChain.length - 1];
    target = cursor[idx];

    if (target.expanded) {
      target.expanded = false;
      setRoot([...next]);
      return;
    }

    target.loading = true;
    target.expanded = true;
    setRoot([...next]);

    const children = await loadChildren(target.entry.path);
    target.children = children.map((entry) => ({
      entry,
      expanded: false,
      loading: false,
    }));
    target.loading = false;
    setRoot([...next]);
  };

  const renderNodes = (nodes: TreeNode[], chain: number[] = []) =>
    nodes.map((node, i) => {
      const pathChain = [...chain, i];
      const active = view === 'workspace' && currentPath === node.entry.path;
      return (
        <div key={node.entry.path} className="tree-node">
          <div className={`tree-row ${active ? 'active' : ''}`}>
            {node.entry.is_dir && (
              <button
                type="button"
                className="tree-toggle"
                onClick={() => void toggle(node, pathChain)}
                aria-label="expand"
              >
                {node.loading ? '…' : node.expanded ? '▾' : '▸'}
              </button>
            )}
            <button type="button" className="tree-label" onClick={() => onSelect(node.entry.path)}>
              <span className={`icon-${node.entry.is_git_folder ? 'git' : 'folder'}`} />
              {node.entry.name}
            </button>
          </div>
          {node.expanded && node.children && (
            <div className="tree-children">{renderNodes(node.children, pathChain)}</div>
          )}
        </div>
      );
    });

  return (
    <nav className="sidebar-tree">
      <button
        type="button"
        className={`tree-root ${view === 'workspace' && currentPath === '' ? 'active' : ''}`}
        onClick={() => onSelect('')}
      >
        <span className="icon-home" /> Home
      </button>
      <button
        type="button"
        className={`tree-root ${view === 'trash' ? 'active' : ''}`}
        onClick={onTrash}
      >
        <span className="icon-trash" /> Trash
      </button>
      <div className="tree-section-label">Folders</div>
      {renderNodes(root)}
    </nav>
  );
}
