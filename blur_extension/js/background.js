/**
 * Blur & Lock Privacy Extension — Background Service Worker (Manifest V3)
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  blurIntensity: 10,
  blurChatList: false,
  blurContactNames: true,
  blurProfilePhotos: true,
  blurConversation: false,
  blurMedia: true,
  blurLatestMessage: true,
  blurGroupInfo: true,
  blurStatusInfo: true,
  unblurOnHover: true,
  isLocked: false,
  securityPin: ''
};

// Initialize settings on installation
chrome.runtime.onInstalled.addListener(async () => {
  try {
    const existing = await chrome.storage.local.get(null);
    const toSave = {};
    for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
      if (existing[key] === undefined) {
        toSave[key] = val;
      }
    }
    if (Object.keys(toSave).length > 0) {
      await chrome.storage.local.set(toSave);
    }
    updateBadge(existing.enabled !== false, existing.isLocked === true);
  } catch (e) {
    console.error('[Background] Error initializing settings:', e);
  }
});

// Update toolbar action badge
function updateBadge(isEnabled, isLocked) {
  try {
    if (isLocked) {
      chrome.action.setBadgeText({ text: 'LOCK' });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    } else if (isEnabled) {
      chrome.action.setBadgeText({ text: 'ON' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    } else {
      chrome.action.setBadgeText({ text: 'OFF' });
      chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
    }
  } catch (e) {}
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    chrome.storage.local.get(['enabled', 'isLocked'], (items) => {
      updateBadge(items.enabled !== false, items.isLocked === true);
    });
  }
});

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'LOCK_NOW') {
    chrome.storage.local.set({ isLocked: true }, () => {
      // Broadcast lock command to all WhatsApp Web tabs
      chrome.tabs.query({ url: '*://web.whatsapp.com/*' }, (tabs) => {
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { action: 'TRIGGER_LOCK' }).catch(() => {});
          }
        });
      });
      updateBadge(true, true);
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === 'UNLOCK_SUCCESS') {
    chrome.storage.local.set({ isLocked: false }, () => {
      chrome.storage.local.get(['enabled'], (items) => {
        updateBadge(items.enabled !== false, false);
      });
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === 'SYNC_SETTINGS') {
    chrome.tabs.query({ url: '*://web.whatsapp.com/*' }, (tabs) => {
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { action: 'APPLY_SETTINGS', settings: message.settings }).catch(() => {});
        }
      });
    });
    sendResponse({ success: true });
    return true;
  }
});
