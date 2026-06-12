/** Convert git@host:org/repo.git to https://host/org/repo.git for server-side clone (HTTPS, no SSH keys). */
export function normalizeRepoUrl(url: string): string {
  const trimmed = url.trim();
  const ssh = /^git@([^:]+):(.+?)(?:\.git)?$/i.exec(trimmed);
  if (ssh) {
    const host = ssh[1];
    const path = ssh[2].replace(/^\//, '');
    return `https://${host}/${path}${path.endsWith('.git') ? '' : '.git'}`;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.endsWith('.git') ? trimmed : `${trimmed}.git`;
  }
  return trimmed;
}

export const GIT_FOLDER_STATUS = {
  UNSPECIFIED: 0,
  WAITING: 1,
  CLONING: 2,
  CHECKING_OUT: 3,
  READY: 4,
  FAILED: 5,
} as const;

export function gitFolderStatusLabel(status: number): string {
  switch (status) {
    case GIT_FOLDER_STATUS.WAITING:
      return 'Waiting to clone…';
    case GIT_FOLDER_STATUS.CLONING:
      return 'Cloning repository…';
    case GIT_FOLDER_STATUS.CHECKING_OUT:
      return 'Checking out branch…';
    case GIT_FOLDER_STATUS.READY:
      return 'Ready';
    case GIT_FOLDER_STATUS.FAILED:
      return 'Clone failed';
    default:
      return 'Unknown';
  }
}
