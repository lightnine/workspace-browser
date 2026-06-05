import { useState } from 'react';
import { BrowsePage } from './pages/BrowsePage';
import type { WorkspaceContext } from './types';
import './App.css';

const DEFAULT_CTX: WorkspaceContext = {
  owner_uin: '100001',
  uin: '200001',
  app_id: '260073493',
  workspace_id: 'ws-test',
};

export default function App() {
  const [ctx, setCtx] = useState<WorkspaceContext>(() => {
    const saved = localStorage.getItem('ws-browser-ctx');
    if (saved) {
      try {
        return JSON.parse(saved) as WorkspaceContext;
      } catch {
        /* ignore */
      }
    }
    return DEFAULT_CTX;
  });
  const [showCtx, setShowCtx] = useState(false);

  const updateCtx = (patch: Partial<WorkspaceContext>) => {
    setCtx((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem('ws-browser-ctx', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="app-root">
      <BrowsePage ctx={ctx} />
      <button type="button" className="ctx-fab" onClick={() => setShowCtx((v) => !v)}>
        Context
      </button>
      {showCtx && (
        <div className="ctx-drawer">
          <h3>workspace-service 上下文</h3>
          <label>owner_uin<input value={ctx.owner_uin} onChange={(e) => updateCtx({ owner_uin: e.target.value })} /></label>
          <label>uin<input value={ctx.uin} onChange={(e) => updateCtx({ uin: e.target.value })} /></label>
          <label>app_id<input value={ctx.app_id} onChange={(e) => updateCtx({ app_id: e.target.value })} /></label>
          <label>workspace_id<input value={ctx.workspace_id} onChange={(e) => updateCtx({ workspace_id: e.target.value })} /></label>
          <p className="muted">挂载: {`{app_id}/{workspace_id}/users/{uin}/`}</p>
        </div>
      )}
    </div>
  );
}
