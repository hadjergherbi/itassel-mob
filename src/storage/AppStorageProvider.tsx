import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  addAlert as persistAlert,
  countUnreadAlerts,
  getNotificationsEnabled,
  listAlerts,
  markAllAlertsRead as persistMarkAll,
  markAlertRead as persistMarkOne,
  setNotificationsEnabled as persistNotif,
  type AlertType,
  type StoredAlert,
} from '@/storage/alerts';
import {
  addReference as persistReference,
  listReferences,
  removeReference as persistRemove,
  updateDossierMeta as persistMeta,
  updateReferenceStatut,
  type StoredDossier,
} from '@/storage/dossiers';

type AppStorageContextValue = {
  ready: boolean;
  dossiers: StoredDossier[];
  alerts: StoredAlert[];
  unreadCount: number;
  notificationsEnabled: boolean;
  refresh: () => Promise<void>;
  addDossier: (
    reference: string,
    statut?: string | null,
    objet?: string | null,
  ) => Promise<void>;
  updateDossierMeta: (
    reference: string,
    meta: { objet?: string | null; updatedAt?: string },
  ) => Promise<void>;
  removeDossier: (reference: string) => Promise<void>;
  syncStatutAndAlert: (reference: string, statutCode: string) => Promise<void>;
  createLocalAlert: (
    type: AlertType,
    reference: string,
    statutCode?: string | null,
  ) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  setNotifications: (enabled: boolean) => Promise<void>;
};

const AppStorageContext = createContext<AppStorageContextValue | null>(null);

export function AppStorageProvider(props: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [dossiers, setDossiers] = useState<StoredDossier[]>([]);
  const [alerts, setAlerts] = useState<StoredAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const refresh = useCallback(async () => {
    const [nextDossiers, nextAlerts, unread, notif] = await Promise.all([
      listReferences(),
      listAlerts(),
      countUnreadAlerts(),
      getNotificationsEnabled(),
    ]);
    setDossiers(nextDossiers);
    setAlerts(nextAlerts);
    setUnreadCount(unread);
    setNotificationsEnabled(notif);
    setReady(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addDossier = useCallback(
    async (
      reference: string,
      statut: string | null = null,
      objet: string | null = null,
    ) => {
      await persistReference(reference, statut, objet);
      await refresh();
    },
    [refresh],
  );

  const updateDossierMeta = useCallback(
    async (
      reference: string,
      meta: { objet?: string | null; updatedAt?: string },
    ) => {
      await persistMeta(reference, meta);
      await refresh();
    },
    [refresh],
  );

  const removeDossier = useCallback(
    async (reference: string) => {
      await persistRemove(reference);
      await refresh();
    },
    [refresh],
  );

  const createLocalAlert = useCallback(
    async (type: AlertType, reference: string, statutCode: string | null = null) => {
      await persistAlert(type, reference, statutCode);
      await refresh();
    },
    [refresh],
  );

  const syncStatutAndAlert = useCallback(
    async (reference: string, statutCode: string) => {
      const previous = await updateReferenceStatut(reference, statutCode);
      if (previous && previous !== statutCode) {
        if (statutCode === 'information_demandee') {
          await persistAlert('complement', reference, statutCode);
        } else if (statutCode === 'resolue' || statutCode === 'reponse_apportee') {
          await persistAlert('response_ready', reference, statutCode);
        } else {
          await persistAlert('status_updated', reference, statutCode);
        }
      }
      await refresh();
    },
    [refresh],
  );

  const markRead = useCallback(
    async (id: string) => {
      await persistMarkOne(id);
      await refresh();
    },
    [refresh],
  );

  const markAllRead = useCallback(async () => {
    await persistMarkAll();
    await refresh();
  }, [refresh]);

  const setNotifications = useCallback(async (enabled: boolean) => {
    await persistNotif(enabled);
    setNotificationsEnabled(enabled);
  }, []);

  const value = useMemo(
    () => ({
      ready,
      dossiers,
      alerts,
      unreadCount,
      notificationsEnabled,
      refresh,
      addDossier,
      updateDossierMeta,
      removeDossier,
      syncStatutAndAlert,
      createLocalAlert,
      markRead,
      markAllRead,
      setNotifications,
    }),
    [
      ready,
      dossiers,
      alerts,
      unreadCount,
      notificationsEnabled,
      refresh,
      addDossier,
      updateDossierMeta,
      removeDossier,
      syncStatutAndAlert,
      createLocalAlert,
      markRead,
      markAllRead,
      setNotifications,
    ],
  );

  return (
    <AppStorageContext.Provider value={value}>{props.children}</AppStorageContext.Provider>
  );
}

export function useAppStorage(): AppStorageContextValue {
  const ctx = useContext(AppStorageContext);
  if (!ctx) {
    throw new Error('useAppStorage must be used within AppStorageProvider');
  }
  return ctx;
}
