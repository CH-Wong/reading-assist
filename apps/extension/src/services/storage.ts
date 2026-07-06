/**
 * Storage helper — wraps chrome.storage.sync/local with a simple API.
 * Falls back to localStorage for development outside extension context.
 */

const API_KEY_STORAGE_KEY = 'reading-assist-api-key';
const SETTINGS_STORAGE_KEY = 'reading-assist-settings';
const ENABLED_STORAGE_KEY = 'reading-assist-enabled';

export interface ExtensionSettings {
  sourceLang: string;
  targetLang: string;
}

const defaultSettings: ExtensionSettings = {
  sourceLang: 'zh-CN',
  targetLang: 'en',
};

function isExtensionContext(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage;
}

export async function getApiKey(): Promise<string> {
  if (isExtensionContext()) {
    const result = await chrome.storage.sync.get(API_KEY_STORAGE_KEY);
    return result[API_KEY_STORAGE_KEY] ?? '';
  }
  return localStorage.getItem(API_KEY_STORAGE_KEY) ?? '';
}

export async function setApiKey(key: string): Promise<void> {
  if (isExtensionContext()) {
    await chrome.storage.sync.set({ [API_KEY_STORAGE_KEY]: key });
  } else {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
  }
}

export async function getSettings(): Promise<ExtensionSettings> {
  if (isExtensionContext()) {
    const result = await chrome.storage.sync.get(SETTINGS_STORAGE_KEY);
    return result[SETTINGS_STORAGE_KEY] ?? defaultSettings;
  }
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export async function setSettings(settings: ExtensionSettings): Promise<void> {
  if (isExtensionContext()) {
    await chrome.storage.sync.set({ [SETTINGS_STORAGE_KEY]: settings });
  } else {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }
}

/** Listen for storage changes (e.g., settings changed in popup) */
export function onSettingsChanged(
  callback: (settings: ExtensionSettings) => void
): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName === 'sync' && changes[SETTINGS_STORAGE_KEY]) {
      callback(changes[SETTINGS_STORAGE_KEY].newValue ?? defaultSettings);
    }
  };

  if (isExtensionContext()) {
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }
  return () => {};
}

/** Enable/disable the content script overlay */
export async function getEnabled(): Promise<boolean> {
  if (isExtensionContext()) {
    const result = await chrome.storage.sync.get(ENABLED_STORAGE_KEY);
    return result[ENABLED_STORAGE_KEY] ?? true;
  }
  return localStorage.getItem(ENABLED_STORAGE_KEY) !== 'false';
}

export async function setEnabled(enabled: boolean): Promise<void> {
  if (isExtensionContext()) {
    await chrome.storage.sync.set({ [ENABLED_STORAGE_KEY]: enabled });
  } else {
    localStorage.setItem(ENABLED_STORAGE_KEY, String(enabled));
  }
}

export function onEnabledChanged(callback: (enabled: boolean) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string
  ) => {
    if (areaName === 'sync' && changes[ENABLED_STORAGE_KEY]) {
      callback(changes[ENABLED_STORAGE_KEY].newValue ?? true);
    }
  };

  if (isExtensionContext()) {
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }
  return () => {};
}
