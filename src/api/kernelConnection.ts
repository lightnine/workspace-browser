import type { WorkspaceContext } from '../types';
import { gatewayApi } from './gatewayClient';

interface JupyterMessage {
  header: { msg_id: string; msg_type: string; session: string; username: string; date: string; version: string };
  parent_header: { msg_id?: string };
  content: Record<string, unknown>;
}

interface ExecutionContext {
  outputs: string[];
  executionCount: number;
  shellReply: boolean;
  idle: boolean;
  resolve: (result: { execution_count: number; outputs: string[] }) => void;
  reject: (error: Error) => void;
}

function newId(): string {
  return crypto.randomUUID();
}

function formatMessageOutput(message: JupyterMessage): string | null {
  const type = message.header.msg_type;
  if (type === 'stream') return String(message.content.text ?? '');
  if (type === 'error') {
    const traceback = message.content.traceback as string[] | undefined;
    if (traceback?.length) return traceback.join('\n');
    return `${message.content.ename}: ${message.content.evalue}`;
  }
  if (type === 'execute_result' || type === 'display_data') {
    const data = message.content.data as Record<string, unknown> | undefined;
    if (data?.['text/plain'] != null) return String(data['text/plain']);
    if (data?.['text/html'] != null) return String(data['text/html']);
  }
  return null;
}

async function waitForKernel(ctx: WorkspaceContext, kernelId: string): Promise<void> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const kernel = await gatewayApi.getKernel(ctx, kernelId);
    if (kernel.execution_state === 'idle' || kernel.execution_state === 'busy') return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Kernel did not become ready within 60s');
}

export class KernelConnection {
  private ws: WebSocket | null = null;
  private readonly sessionId = newId();
  private readonly pending = new Map<string, ExecutionContext>();
  readonly kernelId: string;
  private readonly ctx: WorkspaceContext;

  constructor(ctx: WorkspaceContext, kernelId: string) {
    this.ctx = ctx;
    this.kernelId = kernelId;
  }

  static async connect(ctx: WorkspaceContext, kernelName: string): Promise<KernelConnection> {
    const kernel = await gatewayApi.createKernel(ctx, kernelName);
    await waitForKernel(ctx, kernel.id);
    const conn = new KernelConnection(ctx, kernel.id);
    await conn.openWebSocket();
    return conn;
  }

  private openWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/api/kernels/${this.kernelId}/channels?session_id=${this.sessionId}`;
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => resolve();
      ws.onerror = () => reject(new Error('WebSocket connection failed'));
      ws.onmessage = (event) => {
        try {
          this.onMessage(JSON.parse(String(event.data)) as JupyterMessage);
        } catch {
          /* ignore malformed frames */
        }
      };
    });
  }

  execute(code: string): Promise<{ execution_count: number; outputs: string[] }> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Kernel WebSocket is not connected'));
    }

    return new Promise((resolve, reject) => {
      const msgId = newId();
      const ctx: ExecutionContext = {
        outputs: [],
        executionCount: 0,
        shellReply: false,
        idle: false,
        resolve,
        reject,
      };
      this.pending.set(msgId, ctx);

      const message = {
        header: {
          msg_id: msgId,
          msg_type: 'execute_request',
          username: 'workspace-browser',
          session: this.sessionId,
          date: new Date().toISOString(),
          version: '5.3',
        },
        parent_header: {},
        content: {
          code,
          silent: false,
          store_history: true,
          user_expressions: {},
          allow_stdin: false,
          stop_on_error: true,
        },
        metadata: {},
        buffers: [],
        channel: 'shell',
      };

      this.ws!.send(JSON.stringify(message));
    });
  }

  private onMessage(message: JupyterMessage): void {
    const parentId = message.parent_header?.msg_id;
    if (!parentId) return;

    const ctx = this.pending.get(parentId);
    if (!ctx) return;

    const type = message.header.msg_type;
    const output = formatMessageOutput(message);
    if (output != null) ctx.outputs.push(output);

    if (type === 'execute_reply') {
      ctx.executionCount = Number(message.content.execution_count) || ctx.executionCount;
      ctx.shellReply = true;
    } else if (type === 'status' && message.content.execution_state === 'idle') {
      ctx.idle = true;
    }

    if (ctx.shellReply && ctx.idle) {
      this.pending.delete(parentId);
      ctx.resolve({ execution_count: ctx.executionCount, outputs: ctx.outputs });
    }
  }

  close(): void {
    this.ws?.close();
    this.ws = null;
    for (const [, ctx] of this.pending) ctx.reject(new Error('Kernel disconnected'));
    this.pending.clear();
  }

  async shutdown(): Promise<void> {
    this.close();
    await gatewayApi.deleteKernel(this.ctx, this.kernelId);
  }
}
