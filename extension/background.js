/**
 * Background Service Worker
 * Mengelola badge, notifikasi, dan komunikasi antar komponen extension
 */

// Update badge count di ikon extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'UPDATE_BADGE') {
    const count = message.count || 0;
    if (count > 0) {
      chrome.action.setBadgeText({ text: String(count) });
      chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  }

  if (message.type === 'OPEN_POPUP') {
    // Buka popup extension (buka action popup)
    chrome.action.openPopup().catch(() => {});
  }

  if (message.type === 'CLEAR_BADGE') {
    chrome.action.setBadgeText({ text: '' });
  }
});

// Inisialisasi badge saat startup
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['detectedJobs'], (result) => {
    const jobs = result.detectedJobs || [];
    if (jobs.length > 0) {
      chrome.action.setBadgeText({ text: String(jobs.length) });
      chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
    }
  });
});

// Install handler
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Job Bot Extension] Terpasang! Siap mendeteksi lowongan dari LinkedIn & Jobstreet.');
  chrome.storage.local.set({ detectedJobs: [], addedJobs: [] });
});
