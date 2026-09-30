/**
 * Client HTTP public ITASSEL.
 * Base : EXPO_PUBLIC_API_URL (doit se terminer par /api)
 *
 * Après toute modification du .env : relancer avec
 *   npx expo start -c
 */
import axios, { AxiosError } from 'axios';
import Constants from 'expo-constants';

import type { Lang } from '@/i18n/fr';

let currentLang: Lang = 'fr';

export function setApiLanguage(lang: Lang): void {
  currentLang = lang;
}

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const fromExtra =
    typeof Constants.expoConfig?.extra?.apiUrl === 'string'
      ? Constants.expoConfig.extra.apiUrl
      : undefined;

  let url = (fromEnv || fromExtra || '').trim();
  // Retirer un éventuel slash final : les chemins commencent déjà par /
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }
  return url;
}

export const API_BASE_URL = resolveBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    Accept: 'application/json',
  },
});

api.interceptors.request.use((config) => {
  config.headers['Accept-Language'] = currentLang;
  return config;
});

export type FieldErrors = Record<string, string>;

export type ApiErrorInfo = {
  status: number | null;
  messageKey: string;
  message?: string;
  fieldErrors: FieldErrors;
};

export function parseApiError(error: unknown): ApiErrorInfo {
  if (!axios.isAxiosError(error)) {
    return {
      status: null,
      messageKey: 'errors.generic',
      fieldErrors: {},
    };
  }

  const axiosError = error as AxiosError<{
    message?: string;
    errors?: Record<string, string[] | string>;
  }>;

  if (axiosError.code === 'ERR_NETWORK') {
    return { status: null, messageKey: 'errors.offline', fieldErrors: {} };
  }
  if (axiosError.code === 'ECONNABORTED') {
    return { status: null, messageKey: 'errors.timeout', fieldErrors: {} };
  }

  const status = axiosError.response?.status ?? null;
  const data = axiosError.response?.data;
  const fieldErrors: FieldErrors = {};

  if (data?.errors) {
    Object.keys(data.errors).forEach((key) => {
      const value = data.errors?.[key];
      if (Array.isArray(value) && value[0]) {
        fieldErrors[key] = value[0];
      } else if (typeof value === 'string') {
        fieldErrors[key] = value;
      }
    });
  }

  if (status === 429) {
    return {
      status,
      messageKey: 'errors.tooMany',
      message: data?.message,
      fieldErrors,
    };
  }
  if (status === 422) {
    return {
      status,
      messageKey: 'errors.validation',
      message: data?.message,
      fieldErrors,
    };
  }
  if (status === 401) {
    return {
      status,
      messageKey: 'dossier.sessionExpired',
      message: data?.message,
      fieldErrors,
    };
  }
  if (status !== null && status >= 500) {
    return {
      status,
      messageKey: 'errors.server',
      message: data?.message,
      fieldErrors,
    };
  }

  return {
    status,
    messageKey: 'errors.generic',
    message: data?.message,
    fieldErrors,
  };
}
