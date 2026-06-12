import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '^/(ListFiles|CreateFolder|CreateFile|CreateNotebook|DeletePath|MovePath|CopyPath|RenamePath|GetFolderNodePath|ValidatePath|ListRecycleBin|RestorePath|EmptyRecycleBin|GetFileInfo|ReadFile|WriteFile|DownloadFile|CreateGitFolder|GetGitFolderStatus|CloneRepo|PullRepo|StageFiles|UnstageFiles|Commit|PushRepo|CommitAndPush|CreateBranch|CheckoutBranch|ListBranches|GetStatus|GetFileDiff|GetCommitHistory|DiscardChanges|DeleteRepo|healthz)':
        {
          target: 'http://127.0.0.1:8080',
          changeOrigin: true,
        },
      '^/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
