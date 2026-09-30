import * as SecureStore from 'expo-secure-store';

const KEY = 'itassel_alerts';
const NOTIF_KEY = 'itassel_notifications_enabled';

export type AlertType =
  | 'registered'
  | 'status_updated'
  | 'complement'
  | 'response_ready';

export type StoredAlert = {
  id: string;
  type: AlertType;
  reference: string;
  statutCode: string | null;
  read: boolean;
  createdAt: string;
};

async function readAll(): Promise<StoredAlert[]> {
  const raw = await SecureStore.getItemAsync(KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as StoredAlert[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(items: StoredAlert[]): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(items.slice(0, 100)));
}

export async function listAlerts(): Promise<StoredAlert[]> {
  const items = await readAll();
  return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function countUnreadAlerts(): Promise<number> {
  const items = await readAll();
  return items.filter((item) => !item.read).length;
}

export async function addAlert(
  type: AlertType,
  reference: string,
  statutCode: string | null = null,
): Promise<void> {
  const items = await readAll();
  items.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    reference: reference.trim().toUpperCase(),
    statutCode,
    read: false,
    createdAt: new Date().toISOString(),
  });
  await writeAll(items);
}

export async function markAlertRead(id: string): Promise<void> {
  const items = await readAll();
  const target = items.find((item) => item.id === id);
  if (target) {
    target.read = true;
    await writeAll(items);
  }
}

export async function markAllAlertsRead(): Promise<void> {
  const items = await readAll();
  items.forEach((item) => {
    item.read = true;
  });
  await writeAll(items);
}

export async function getNotificationsEnabled(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(NOTIF_KEY);
  if (value === null) {
    return true;
  }
  return value === '1';
}

export async function setNotificationsEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(NOTIF_KEY, enabled ? '1' : '0');
}
