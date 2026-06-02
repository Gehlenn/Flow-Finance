type DeveloperAccessInput = {
  isDevMode: boolean;
  email?: string | null;
};

function parseAllowlist(raw?: string): string[] {
  return (raw || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function hasLocalDevOverride(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem('flow_dev_tools') === '1';
}

export function canAccessDeveloperTools({ isDevMode, email }: DeveloperAccessInput): boolean {
  if (!isDevMode) {
    return false;
  }

  const normalizedEmail = email?.trim().toLowerCase();
  const allowlist = parseAllowlist(import.meta.env.VITE_DEV_ACCOUNT_EMAILS);

  return Boolean(
    hasLocalDevOverride()
    || (normalizedEmail && allowlist.includes(normalizedEmail))
  );
}
