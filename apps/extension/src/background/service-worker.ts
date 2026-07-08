/**
 * Background service worker for Reading Assist.
 *
 * Responsibilities:
 * - Set toolbar icon (color when enabled, grayscale when disabled)
 * - React to enable/disable changes from the popup
 */

const ENABLED_KEY = 'reading-assist-enabled';
const COLOR_ICON = { 16: 'icons/icon16.png', 48: 'icons/icon48.png', 128: 'icons/icon128.png' };
const GRAY_ICON = { 16: 'icons/icon-off16.png', 48: 'icons/icon-off48.png', 128: 'icons/icon-off128.png' };

/** Set the toolbar icon based on current enabled state */
async function updateIcon(): Promise<void> {
  const result = await chrome.storage.sync.get(ENABLED_KEY);
  const enabled = result[ENABLED_KEY] ?? true;
  await chrome.action.setIcon({ path: enabled ? COLOR_ICON : GRAY_ICON });
}

// Set icon on startup
updateIcon();

// React to changes from the popup
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes[ENABLED_KEY]) {
    updateIcon();
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.action.openPopup();
  }
});

export {};
