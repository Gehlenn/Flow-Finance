type StorageLike = Pick<Storage, 'getItem'>;

export type E2EAuthBootstrap = {
  userId: string;
  userEmail: string;
  userName: string;
  token: string;
};

function readValue(params: URLSearchParams, storage: StorageLike | undefined, queryKey: string, storageKey: string, fallback: string): string {
  return params.get(queryKey) || storage?.getItem(storageKey) || fallback;
}

export function getE2EAuthBootstrap(search: string, storage?: StorageLike, enabled = false): E2EAuthBootstrap | null {
  if (!enabled) {
    return null;
  }

  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const isActive = params.get('e2eAuth') === '1' || storage?.getItem('flow_e2e_auth') === '1';

  if (!isActive) {
    return null;
  }

  return {
    userId: readValue(params, storage, 'userId', 'flow_e2e_user_id', 'e2e-user'),
    userEmail: readValue(params, storage, 'userEmail', 'flow_e2e_user_email', 'e2e@flowfinance.test'),
    userName: readValue(params, storage, 'userName', 'flow_e2e_user_name', 'E2E Flow'),
    token: readValue(params, storage, 'token', 'flow_e2e_auth_token', 'e2e-token'),
  };
}