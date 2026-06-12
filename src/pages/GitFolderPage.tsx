import { useState } from 'react';
import { AppShell } from '../components/AppShell';
import { useGitFolder } from '../hooks/useGitFolder';
import type { WorkspaceContext } from '../types';

interface Props {
  ctx: WorkspaceContext;
  folderPath: string;
  onBack: () => void;
}

export function GitFolderPage({ ctx, folderPath, onBack }: Props) {
  const git = useGitFolder(ctx, folderPath);
  const [tab, setTab] = useState<'changes' | 'settings'>('changes');
  const [newBranch, setNewBranch] = useState('');

  const canCommit = git.commitMessage.trim().length > 0 && git.stagedPaths.size > 0 && !git.busy;
  const isNotebook = git.selectedFile?.endsWith('.ipynb');

  return (
    <AppShell userLabel={`uin ${ctx.uin}`} workspaceLabel={ctx.workspace_id}>
      <div className="git-editor">
        <header className="git-editor-header">
          <button type="button" className="git-back-btn" onClick={onBack}>
            ← Workspace
          </button>
          <h1 className="git-repo-name">{git.folderName}</h1>
          <div className="git-toolbar">
            <label className="git-branch-select">
              Branch:
              <select
                value={git.currentBranch}
                disabled={git.busy}
                onChange={(e) => void git.switchBranch(e.target.value)}
              >
                {git.branches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
            <form
              className="git-create-branch"
              onSubmit={(e) => {
                e.preventDefault();
                void git.createBranch(newBranch);
                setNewBranch('');
              }}
            >
              <input
                type="text"
                placeholder="New branch"
                value={newBranch}
                onChange={(e) => setNewBranch(e.target.value)}
                disabled={git.busy}
              />
              <button type="submit" disabled={git.busy || !newBranch.trim()}>
                Create branch
              </button>
            </form>
            {git.headCommit && (
              <a className="git-head-hash" href={`#${git.headCommit}`} title="HEAD commit">
                {git.headCommit}
              </a>
            )}
            <button type="button" className="git-pull-btn" disabled={git.busy} onClick={() => void git.pull()}>
              ↓ Pull
            </button>
          </div>
        </header>

        <div className="git-tabs">
          <button
            type="button"
            className={tab === 'changes' ? 'active' : ''}
            onClick={() => setTab('changes')}
          >
            Changes
          </button>
          <button
            type="button"
            className={tab === 'settings' ? 'active' : ''}
            onClick={() => setTab('settings')}
          >
            Settings
          </button>
        </div>

        {git.error && <div className="git-error-banner">{git.error}</div>}
        {git.loading && <div className="git-loading">Loading Git status…</div>}

        {tab === 'changes' && !git.loading && (
          <div className="git-split">
            <aside className="git-changes-panel">
              <div className="git-changes-head">
                <label className="git-select-all">
                  <input
                    type="checkbox"
                    checked={git.allStaged}
                    disabled={git.busy || git.changes.length === 0}
                    onChange={(e) => void git.toggleStageAll(e.target.checked)}
                  />
                  <span>{git.changes.length} changed file{git.changes.length === 1 ? '' : 's'}</span>
                </label>
              </div>
              <ul className="git-file-list">
                <li className="git-tree-root">/</li>
                {git.changes.map((entry) => (
                  <li
                    key={entry.path}
                    className={`git-file-item ${git.selectedFile === entry.path ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={entry.staged}
                      disabled={git.busy}
                      onChange={(e) => void git.toggleStage(entry, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      type="button"
                      className="git-file-btn"
                      onClick={() => void git.loadDiff(entry.path)}
                    >
                      <span className={`git-file-icon ${entry.path.endsWith('.ipynb') ? 'notebook' : 'file'}`} />
                      <span className="git-file-name">{entry.name}</span>
                    </button>
                    <span className={`git-status-badge kind-${entry.kind}`}>{entry.kind}</span>
                  </li>
                ))}
                {git.changes.length === 0 && (
                  <li className="git-empty">No changes — working tree clean</li>
                )}
              </ul>

              <div className="git-commit-form">
                <label>
                  Commit message (required)
                  <input
                    type="text"
                    value={git.commitMessage}
                    onChange={(e) => git.setCommitMessage(e.target.value)}
                    disabled={git.busy}
                    placeholder="Describe your changes"
                  />
                </label>
                <label>
                  Description (optional)
                  <textarea
                    rows={3}
                    value={git.commitDescription}
                    onChange={(e) => git.setCommitDescription(e.target.value)}
                    disabled={git.busy}
                  />
                </label>
                <button
                  type="button"
                  className="git-commit-push-btn"
                  disabled={!canCommit}
                  onClick={() => void git.commitAndPush()}
                >
                  Commit &amp; Push
                </button>
              </div>
            </aside>

            <section className="git-diff-panel">
              {git.selectedFile ? (
                <>
                  <header className="git-diff-header">
                    <span className="git-diff-title">{git.selectedFile.split('/').pop()}</span>
                    <div className="git-diff-view-toggle">
                      <button
                        type="button"
                        className={git.diffView === 'code' ? 'active' : ''}
                        onClick={() => git.setDiffView('code')}
                      >
                        Code
                      </button>
                      <button
                        type="button"
                        className={git.diffView === 'raw' ? 'active' : ''}
                        onClick={() => git.setDiffView('raw')}
                      >
                        Raw file
                      </button>
                    </div>
                  </header>
                  {isNotebook && git.diffView === 'code' && (
                    <p className="git-ipynb-hint">
                      See <strong>Raw file</strong> diff to see metadata or output changes.
                    </p>
                  )}
                  <pre className="git-diff-body">
                    {git.diffView === 'raw'
                      ? git.rawContent || '(empty file)'
                      : git.diffLines.map((line, i) => (
                          <span
                            key={`${i}-${line.slice(0, 8)}`}
                            className={
                              line.startsWith('+')
                                ? 'diff-add'
                                : line.startsWith('-')
                                  ? 'diff-del'
                                  : 'diff-ctx'
                            }
                          >
                            {line}
                            {'\n'}
                          </span>
                        ))}
                  </pre>
                </>
              ) : (
                <div className="git-diff-empty">Select a changed file to view diff</div>
              )}
            </section>
          </div>
        )}

        {tab === 'settings' && (
          <div className="git-settings">
            <h2>Git credentials</h2>
            <p className="muted">Used for Pull and Commit &amp; Push to private remotes.</p>
            <label>
              Username
              <input
                value={git.creds.git_username}
                onChange={(e) => git.setCreds({ ...git.creds, git_username: e.target.value })}
              />
            </label>
            <label>
              Token / password
              <input
                type="password"
                value={git.creds.git_token}
                onChange={(e) => git.setCreds({ ...git.creds, git_token: e.target.value })}
              />
            </label>
            <hr />
            <h2>Repository</h2>
            {git.repoURL && <p className="mono">{git.repoURL}</p>}
            <p className="mono muted">{git.folderPath}</p>
            <p className="muted">
              使用 HTTPS 克隆（与 Databricks 一致）。SSH URL 会在创建时自动转为 HTTPS；私有仓库请在上方填写 token。
            </p>
            <button type="button" className="danger-btn" disabled={git.busy} onClick={() => void git.discardAll()}>
              Discard all changes
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
