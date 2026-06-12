import type { WorkspaceContext } from '../types';

export interface KernelSpecEntry {
  name: string;
}

export interface JupyterSession {
  id: string;
  path: string;
  name: string;
  type: string;
  kernel?: {
    id: string;
    name: string;
    execution_state?: string;
  };
}

function wedataHeaders(ctx: WorkspaceContext): Record<string, string> {
  return {
    'X-Wedata-Owner-Uin': ctx.owner_uin,
    'X-Wedata-Uin': ctx.uin,
    'X-Wedata-App-Id': ctx.app_id,
    'X-Wedata-Workspace-Id': ctx.workspace_id,
  };
}

async function readGatewayError(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return `HTTP ${res.status}`;
  try {
    const json = JSON.parse(text) as { message?: string; reason?: string };
    const message = json.message || json.reason;
    if (message) return message;
  } catch {
    /* plain text */
  }
  return text.length > 400 ? `${text.slice(0, 400)}…` : text;
}

export const gatewayApi = {
  listKernelSpecs: async (ctx: WorkspaceContext): Promise<string[]> => {
    const res = await fetch('/api/kernelspecs', { headers: wedataHeaders(ctx) });
    if (!res.ok) throw new Error(`kernelspecs HTTP ${res.status}`);
    const data = (await res.json()) as { default?: string; kernelspecs?: Record<string, unknown> };
    const names = Object.keys(data.kernelspecs || {});
    if (names.length === 0) return [data.default || 'python3'];
    return names;
  },

  createSession: async (
    ctx: WorkspaceContext,
    path: string,
    name: string,
    kernelName: string,
  ): Promise<JupyterSession> => {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...wedataHeaders(ctx) },
      body: JSON.stringify({
        path: path.startsWith('/') ? path : `/${path}`,
        name,
        type: 'notebook',
        kernel: { name: kernelName },
      }),
    });
    if (!res.ok) throw new Error(await readGatewayError(res));
    return res.json() as Promise<JupyterSession>;
  },

  createKernel: async (
    ctx: WorkspaceContext,
    name: string,
  ): Promise<{ id: string; name: string; execution_state?: string }> => {
    const res = await fetch('/api/kernels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...wedataHeaders(ctx) },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(await readGatewayError(res));
    return res.json() as Promise<{ id: string; name: string; execution_state?: string }>;
  },

  deleteKernel: async (ctx: WorkspaceContext, kernelId: string): Promise<void> => {
    const res = await fetch(`/api/kernels/${kernelId}`, {
      method: 'DELETE',
      headers: wedataHeaders(ctx),
    });
    if (!res.ok && res.status !== 404) throw new Error(await readGatewayError(res));
  },

  deleteSession: async (ctx: WorkspaceContext, sessionId: string): Promise<void> => {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: wedataHeaders(ctx),
    });
    if (!res.ok && res.status !== 404) throw new Error(await readGatewayError(res));
  },

  getKernel: async (
    ctx: WorkspaceContext,
    kernelId: string,
  ): Promise<{ id: string; execution_state?: string; name?: string }> => {
    const res = await fetch(`/api/kernels/${kernelId}`, { headers: wedataHeaders(ctx) });
    if (!res.ok) throw new Error(`get kernel HTTP ${res.status}`);
    return res.json() as Promise<{ id: string; execution_state?: string; name?: string }>;
  },
};
