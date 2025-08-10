// ==UserScript==
// @name         Polish Grammar Table Copier [e-polish]
// @namespace    http://tampermonkey.net/
// @version      1.001-20250810-2015
// @description  Highlights audio controls and buttons, adds customizable
// @author       Me
// @match        https://dictionary.e-polish.eu/word/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=dictionary.e-polish.eu
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function() {
'use strict';

const LOG_LEVELS = {
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4
};

let currentLogLevel = GM_getValue('logLevel', LOG_LEVELS.INFO);

// Add logging utility function
function log(level, ...args) {
  if (level <= currentLogLevel) {
    const levelName =
        Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level);
    console.log(`[APH-MK][${levelName}]`, ...args);
  }
}

async function copyToClipboard(text) {
  try {
    // Check current clipboard content first
    const currentClipboard = await navigator.clipboard.readText();
    if (currentClipboard === text) {
      console.log('⚠ IGR DUP:', text);
      return;
    }

    await navigator.clipboard.writeText(text);
    console.log('✅✅ Text copied to clipboard:', text);
  } catch (err) {
    console.error('❌❌ Failed to copy:', err);
  }
}

function GrammarTableHandler() {
  const selector = 'div[data-name="grammar"]';
  const q = document.querySelector(selector);

  q.addEventListener('click', () => {
    const lines = [];
    const rows = q.querySelectorAll('tbody tr');

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      if (cells.length > 1) {
        const caseName = cells[0].textContent.trim();
        const forms =
            Array.from(cells).slice(1).map(cell => cell.textContent.trim());
        lines.push(`${caseName}: ${forms.join(', ')}`);
      }
    });

    copyToClipboard(lines.join('\n'));
    showNotification('Table has been copied to clipboard');
  });
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.textContent = '📕 ' + message;
  notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background-color: rgba(0, 0, 0, 0.7);
          color: white;
          padding: 10px 20px;
          border-radius: 5px;
          z-index: 9999;
          opacity: 0;
          transition: opacity 0.3s ease-in-out;
      `;
  document.body.appendChild(notification);

  // Fade in
  setTimeout(() => {
    notification.style.opacity = '1';
  }, 10);

  // Fade out and remove
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 300);
  }, 2000);
}

function InitTab() {
  const grammarTab = document.querySelector('li[data-name="grammar"]');
  const grammarLink = grammarTab.querySelector('a');

  grammarLink.click();
}

InitTab();
GrammarTableHandler();
})();
