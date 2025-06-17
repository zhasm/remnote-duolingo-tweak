// ==UserScript==
// @name         Audio Control Highlighter and Replay
// @namespace    http://tampermonkey.net/
// @version      1.043
// @description  Highlights audio controls and buttons, adds customizable
// @author       Me
// @match        https://www.remnote.com/*
// @match        https://www.duolingo.com/*
// @match        https://tts-v3.pages.dev/*
// @match        https://www.collinsdictionary.com/dictionary/french-english/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=workers.dev
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

log(LOG_LEVELS.INFO, 'Script loaded');

// Customizable hotkey (default to Control+A)
const defaultHotkey = {
  key: '',
  ctrlKey: true,
  altKey: false,
  metaKey: false,
  shiftKey: false
};

// Modify how we store and retrieve hotkeys
function getDomainKey() {
  return window.location.hostname.replace(/^www\./, '');
}

function getHotkeyForDomain() {
  const domain = getDomainKey();
  const allHotkeys = GM_getValue('audioReplayHotkeys', {});
  return allHotkeys[domain] || defaultHotkey;
}

function setNewHotkey(newHotkey) {
  const domain = getDomainKey();
  const allHotkeys = GM_getValue('audioReplayHotkeys', {});
  allHotkeys[domain] = newHotkey;
  GM_setValue('audioReplayHotkeys', allHotkeys);
  hotkey = newHotkey;
  log(LOG_LEVELS.INFO, `New hotkey set for ${domain}:`, newHotkey);
}

// Initialize hotkey for current domain
let hotkey = getHotkeyForDomain();

// Add custom CSS
GM_addStyle(`

      .AudioVideoNode {
          margin-right: 4px;
      }

      .AudioVideoNode audio {
          border: 1px solid green !important; /*#ff003c*/
          border-radius: 8px !important;¬
          padding: 4px !important;
          background-color: #f0f8ff !important;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
          transition: all 0.3s ease !important;
          width: 300px !important;
          max-width: 100% !important;
          display: block !important;
      }
      .AudioVideoNode audio:hover {
          box-shadow: 0 4px 8px rgba(0,0,0,0.15) !important;
      }
      span[dir="ltr"] button {
          border: 2px solid #ff003c !important;
          border-radius: 4px !important;
          background-color: #e6f3ff !important;
          color: #4a90e2 !important;
          font-weight: bold !important;
          padding: 6px 12px !important;
          transition: all 0.3s ease !important;
          cursor: pointer !important;
      }
      span[dir="ltr"] button:hover {
          background-color: #4a90e2 !important;
          color: white !important;
      }

      /* Style for line breaks after audio buttons */
      div[dir="ltr"] > span + br {
          content: '';
          display: block;
          margin-top: 8px;
          margin-bottom: 8px;
          line-height: 1.2;
      }

      /* Ensure consistent spacing around spans */
      div[dir="ltr"] > span {
          display: inline-block;
          margin-bottom: 4px;
      }

      /* Add spacing after French spans */
      span[lang="fr"]::after {
          content: ' ';
          white-space: pre;
      }

      /* Ensure French spans don't collapse */
      span[lang="fr"] {
          display: inline-block;
      }
  `);

function highlightAudioControl(audioElement) {
  log(LOG_LEVELS.DEBUG, 'Attempting to highlight audio control');
  if (audioElement) {
    log(LOG_LEVELS.INFO, 'Audio control found and highlighted');
    return audioElement;
  }
  log(LOG_LEVELS.WARN, 'No audio control found');
  return null;
}

function replayAudio(audioElement) {
  log(LOG_LEVELS.DEBUG, 'Attempting to replay audio');
  if (audioElement) {
    log(LOG_LEVELS.DEBUG, 'Audio element details:', {
      src: audioElement.src,
      paused: audioElement.paused,
      currentTime: audioElement.currentTime,
      duration: audioElement.duration
    });
    audioElement.currentTime = 0;
    const playPromise = audioElement.play();
    if (playPromise !== undefined) {
      playPromise
          .then(_ => {
            log(LOG_LEVELS.INFO, 'Audio playback started successfully');
          })
          .catch(error => {
            log(LOG_LEVELS.ERROR, 'Audio playback failed:', error);
          });
    }
  } else {
    log(LOG_LEVELS.DEBUG, 'No audio element to replay');
  }
}

function handleHotkey(event) {
  // Skip if no hotkey is configured
  if (!hotkey.key && !hotkey.ctrlKey && !hotkey.altKey && !hotkey.metaKey &&
      !hotkey.shiftKey) {
    return;
  }
  // Check if the event matches the configured hotkey
  if ((hotkey.key ? event.key.toLowerCase() === hotkey.key.toLowerCase() :
                    true) &&
      event.ctrlKey === hotkey.ctrlKey && event.altKey === hotkey.altKey &&
      event.metaKey === hotkey.metaKey && event.shiftKey === hotkey.shiftKey) {
    log(LOG_LEVELS.DEBUG, 'Hotkey detected');
    const audioElement = document.querySelector('audio');
    const button = document.querySelector('span[dir="ltr"] button');

    if (audioElement) {
      log(LOG_LEVELS.INFO, 'Replaying audio');
      replayAudio(audioElement);
    } else if (button) {
      log(LOG_LEVELS.INFO, 'Clicking button');
      button.click();
    } else {
      log(LOG_LEVELS.DEBUG, 'No audio or button found');
    }
  }
}

function waitForAudioElement() {
  return new Promise((resolve) => {
    const observer = new MutationObserver((mutations, obs) => {
      const audioElement = document.querySelector('audio');
      if (audioElement) {
        obs.disconnect();
        resolve(audioElement);
      }
    });

    observer.observe(document.body, {childList: true, subtree: true});
  });
}

// Set up the audio control when it appears
waitForAudioElement().then((audioElement) => {
  log(LOG_LEVELS.INFO, 'Audio element found');
  highlightAudioControl(audioElement);
});

// Keep track of initialized textareas to avoid duplicate listeners
let initializedTextareas = new WeakSet();

function initTextArea() {
  //  console.log('[✅initTextArea] Starting initialization with observer and
  //  interval...');

  // Function to check and initialize textarea
  function checkAndInitTextarea() {
    const textarea = document.querySelector('#content textarea');
    if (textarea && !initializedTextareas.has(textarea)) {
      log(LOG_LEVELS.INFO, '[✅initTextArea] New textarea found');
      setupTextareaListener(textarea);
      initializedTextareas.add(textarea);
    }
  }

  // Initial check
  checkAndInitTextarea();

  // Set up periodic checking
  const intervalId = setInterval(checkAndInitTextarea, 3000);

  // Set up observer for dynamic changes
  const observer = new MutationObserver((mutations) => {
    checkAndInitTextarea();
  });

  // Start observing the document with the configured parameters
  observer.observe(document.body, {childList: true, subtree: true});

  log(LOG_LEVELS.INFO, '[✅initTextArea] Observer and interval setup complete');
}

function setupTextareaListener(textarea) {
  textarea.addEventListener('keydown', (event) => {
    // Log the keydown event
    log(LOG_LEVELS.INFO, '[✅initTextArea] Keydown event detected:', {
      key: event.key,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey
    });

    // Check if the pressed keys match the global hotkey configuration
    if ((hotkey.key ? event.key.toLowerCase() === hotkey.key.toLowerCase() :
                      true) &&
        event.ctrlKey === hotkey.ctrlKey && event.altKey === hotkey.altKey &&
        event.metaKey === hotkey.metaKey &&
        event.shiftKey === hotkey.shiftKey) {
      log(LOG_LEVELS.INFO,
          '[✅initTextArea] Global hotkey combination pressed in textarea');
      // Trigger the global hotkey handler
      handleHotkey(event);
      // Prevent default behavior to avoid any conflicts
      event.preventDefault();
    }
  });

  log(LOG_LEVELS.INFO,
      '[✅initTextArea] Event listener added successfully with global hotkey configuration');
}

// Add event listener for the hotkey
document.addEventListener('keydown', handleHotkey);

initTextArea();

// Update the dialog to show domain-specific info
function promptForHotkey() {
  const domain = getDomainKey();
  const dialog = document.createElement('div');
  dialog.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: var(--background-color, #2d2d2d);
          color: var(--text-color, #e0e0e0);
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.4);
          z-index: 10000;
          min-width: 300px;
      `;

  const content = `
          <h3 style="margin-top: 0; color: var(--text-color, #e0e0e0);">Script Configuration for ${
      domain}</h3>
          <div style="margin-bottom: 15px;">
              <h4 style="margin: 10px 0; color: var(--text-color, #e0e0e0);">Hotkey Settings</h4>
              <label style="color: var(--text-color, #e0e0e0);">Key: <input type="text" id="hotkeyChar" maxlength="1"
              value="${hotkey.key}"
              style="width: 30px; background: var(--input-background, #3d3d3d); color: var(--text-color, #e0e0e0); border: 1px solid var(--border-color, #555);"></label>
          </div>
          <div style="margin-bottom: 15px;">
              <label style="color: var(--text-color, #e0e0e0);"><input type="checkbox" id="hotkeyCtrl" ${
      hotkey.ctrlKey ? 'checked' : ''}> ⌃(Ctrl)</label>
              <label style="margin-left: 10px; color: var(--text-color, #e0e0e0);"><input type="checkbox" id="hotkeyShift" ${
      hotkey.shiftKey ? 'checked' : ''}> ⇧(Shift)</label>
              <label style="margin-left: 10px; color: var(--text-color, #e0e0e0);"><input type="checkbox" id="hotkeyAlt" ${
      hotkey.altKey ? 'checked' : ''}> ⌥(Alt)</label>
              <label style="margin-left: 10px; color: var(--text-color, #e0e0e0);"><input type="checkbox" id="hotkeyMeta" ${
      hotkey.metaKey ? 'checked' : ''}> ⌘(Cmd)</label>
          </div>
          <div style="margin-bottom: 15px;">
              <h4 style="margin: 10px 0; color: var(--text-color, #e0e0e0);">Log Level</h4>
              <select id="logLevel" style="background: var(--input-background, #3d3d3d); color: var(--text-color, #e0e0e0); border: 1px solid var(--border-color, #555); padding: 5px;">
                  <option value="${LOG_LEVELS.ERROR}" ${
      currentLogLevel === LOG_LEVELS.ERROR ? 'selected' :
                                             ''}>Error Only</option>
                  <option value="${LOG_LEVELS.WARN}" ${
      currentLogLevel === LOG_LEVELS.WARN ? 'selected' :
                                            ''}>Warning & Error</option>
                  <option value="${LOG_LEVELS.INFO}" ${
      currentLogLevel === LOG_LEVELS.INFO ? 'selected' :
                                            ''}>Info & Above</option>
                  <option value="${LOG_LEVELS.DEBUG}" ${
      currentLogLevel === LOG_LEVELS.DEBUG ? 'selected' :
                                             ''}>Debug (All)</option>
              </select>
          </div>
          <div style="text-align: right;">
              <button id="configSave" style="margin-right: 10px; background: var(--button-background, #4a4a4a); color: var(--button-text, #e0e0e0); border: 1px solid var(--border-color, #555); padding: 5px 10px; border-radius: 4px; cursor: pointer;">Save</button>
              <button id="configCancel" style="background: var(--button-background, #4a4a4a); color: var(--button-text, #e0e0e0); border: 1px solid var(--border-color, #555); padding: 5px 10px; border-radius: 4px; cursor: pointer;">Cancel</button>
          </div>
      `;

  dialog.innerHTML = content;
  document.body.appendChild(dialog);

  // Add event listeners
  const saveBtn = dialog.querySelector('#configSave');
  const cancelBtn = dialog.querySelector('#configCancel');
  const charInput = dialog.querySelector('#hotkeyChar');
  const logLevelSelect = dialog.querySelector('#logLevel');

  saveBtn.addEventListener('click', () => {
    const newHotkey = {
      key: charInput.value.toLowerCase(),
      ctrlKey: dialog.querySelector('#hotkeyCtrl').checked,
      altKey: dialog.querySelector('#hotkeyAlt').checked,
      metaKey: dialog.querySelector('#hotkeyMeta').checked,
      shiftKey: dialog.querySelector('#hotkeyShift').checked
    };

    // Validate hotkey
    if (!newHotkey.key && !newHotkey.ctrlKey && !newHotkey.altKey &&
        !newHotkey.metaKey && !newHotkey.shiftKey) {
      alert('Please set at least one key or modifier');
      return;
    }

    // Save configurations
    setNewHotkey(newHotkey);
    currentLogLevel = parseInt(logLevelSelect.value);
    GM_setValue('logLevel', currentLogLevel);

    document.body.removeChild(dialog);

    // Show confirmation
    const modifiers = [
      newHotkey.ctrlKey ? 'Ctrl' : '', newHotkey.altKey ? 'Alt' : '',
      newHotkey.shiftKey ? 'Shift' : '', newHotkey.metaKey ? 'Meta' : ''
    ].filter(Boolean).join('+');

    const hotkeyStr =
        modifiers + (modifiers && newHotkey.key ? '+' : '') + newHotkey.key;
    showNotification(`Settings saved. Hotkey: ${hotkeyStr || 'None'}`);
  });

  cancelBtn.addEventListener('click', () => {
    document.body.removeChild(dialog);
  });

  // Allow only single character input
  charInput.addEventListener('input', (e) => {
    if (e.target.value.length > 1) {
      e.target.value = e.target.value.slice(-1);
    }
  });
}

// Register menu command inside the IIFE
GM_registerMenuCommand('Configure Audio Replay Hotkey', promptForHotkey);

log(LOG_LEVELS.INFO, 'Script setup complete');


// for remnote
// https://www.remnote.com/flashcards
if (window.location.href.match(/https:\/\/www\.remnote\.com\/flashcards/)) {
  console.log('Remnote detected');

  // Add CSS class definition
  const style = document.createElement('style');
  style.textContent = `
    .remnote-highlight {
      background-color: yellow !important;
      color: green !important;
      font-weight: bold !important;
      font-size: 18px !important;
    }
  `;
  document.head.appendChild(style);

  // Function to check and highlight 100% elements
  function checkAndHighlightRemnoteElements() {
    document.querySelectorAll('.font-medium').forEach(el => {
      if (el.textContent.trim() === '100%') {
        if (!el.classList.contains('remnote-highlight')) {
          el.classList.add('remnote-highlight');
        }
      }
    });
  }

  // Initial check
  checkAndHighlightRemnoteElements();

  // Register interval to check every 500 milliseconds
  setInterval(checkAndHighlightRemnoteElements, 500);
}

// Move Collins Dictionary code inside IIFE
if (window.location.href.match(
        /https:\/\/www\.collinsdictionary\.com\/dictionary\/french-english/)) {
  // Remove 'English Translation of ' from title
  const title = document.title;
  if (title.startsWith('English Translation of ')) {
    document.title = title.replace('English Translation of ', '')
                         .replace('| Collins French-English Dictionary', '')
                         .replace('"', '')
                         .replace('"', '')
                         .toLowerCase();
  }

  const pronunciationElements = document.querySelectorAll(
      'div.mini_h2.form, span.form.type-phr, span.hwd_sound');

  pronunciationElements.forEach(element => {
    const pronSpan = element.querySelector('span.pron') ||
        element.querySelector('span.orth') || element;
    const audioLink = element.querySelector('a[data-src-mp3]');

    if (audioLink) {
      // Highlight span when clicking the element
      element.addEventListener('click', () => {
        pronSpan.style.backgroundColor = 'yellow';
        setTimeout(() => {
          pronSpan.style.backgroundColor = '';
        }, 1000);
      });
      // Copy mp3 URL and text when clicking the span
      pronSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        let pronText = pronSpan.textContent.trim();
        const mp3Url = audioLink.getAttribute('data-src-mp3');

        // Check for punctuation spans and include them if present
        const punctuationSpans = element.querySelectorAll('span.punctuation');
        if (punctuationSpans.length === 2) {
          pronText = `${punctuationSpans[0].textContent.trim()}${pronText}${
              punctuationSpans[1].textContent.trim()}`;
        }

        if (e.altKey) {
          if (mp3Url.length === 0) {
            return;
          }
          // When Option/Alt is pressed, only copy
          navigator.clipboard.writeText(`${mp3Url}`)
              .then(() => {
                showNotification(
                    `🌐 ${pronText}'s URL has been copied to clipboard`);
              })
              .catch(err => {
                log(LOG_LEVELS.ERROR, 'Failed to copy pronunciation', err);
                showNotification(`Failed to copy ${pronText}`);
              });
        } else {
          // Default behavior: play audio and copy
          if (pronText.length === 0) {
            return;
          }
          navigator.clipboard.writeText(`${pronText}`)
              .then(() => {
                showNotification(`${pronText}'s copied to clipboard`);
              })
              .catch(err => {
                log(LOG_LEVELS.ERROR, 'Failed to copy pronunciation', err);
                showNotification(`Failed to copy ${pronText}'s pronunciation`);
              });
        }
      });
    }
  });
}

// Function to show notification
function showNotification(message) {
  const notification = document.createElement('div');
  notification.textContent = message;
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

// Add this function after waitForAudioElement function
function addLineBreakAfterFirstSpan() {
  log(LOG_LEVELS.DEBUG,
      'Checking for spans with buttons that need line breaks');

  // Skip if any audio is currently playing
  const activeAudio = document.querySelector('audio:not([paused])');
  if (activeAudio && !activeAudio.paused) {
    log(LOG_LEVELS.DEBUG, 'Audio is playing, skipping line break addition');
    return;
  }

  const divs = document.querySelectorAll('div[dir="ltr"]');
  divs.forEach(div => {
    const spans = div.querySelectorAll(':scope > span');
    const spanWithButton =
        Array.from(spans).find(span => span.querySelector('button'));

    if (spanWithButton) {
      const nextElement = spanWithButton.nextSibling;
      if (nextElement?.nodeName !== 'BR') {
        log(LOG_LEVELS.DEBUG, 'Adding line break after span with button');
        const br = document.createElement('br');
        br.className =
            'audio-button-break';  // Add class for potential specific styling
        spanWithButton.after(br);
      }
    }
  });
}

// Add observer to handle dynamic content with debouncing
let observerTimeout;
const contentObserver = new MutationObserver((mutations) => {
  // Cancel any pending execution
  if (observerTimeout) {
    clearTimeout(observerTimeout);
  }

  // Debounce the execution to avoid rapid consecutive calls
  observerTimeout = setTimeout(() => {
    // Only proceed if no audio is playing
    const activeAudio = document.querySelector('audio:not([paused])');
    if (!activeAudio || activeAudio.paused) {
      addLineBreakAfterFirstSpan();
    }
  }, 100);  // Wait 100ms after last mutation
});

// Configure observer to be more specific and efficient
contentObserver.observe(
    document.body,
    {childList: true, subtree: true, attributes: false, characterData: false});

// Initial check for existing content (only if no audio is playing)
const initialAudio = document.querySelector('audio:not([paused])');
if (!initialAudio || initialAudio.paused) {
  addLineBreakAfterFirstSpan();
}

/* Color Themes */
const ALL_COLOR_THEMES = {
  bubblegum: {
    name: '泡泡糖',
    colors: [
      'rgba(203, 239, 188, 0.8)',  // Blended: 薄雾玫瑰+淡绿
      'rgba(152, 251, 152, 0.8)',  // 淡绿
      'rgba(255, 160, 122, 0.8)',  // 浅鲑红
      'rgba(30, 144, 255, 0.8)',   // 道奇蓝
      'rgba(186, 85, 211, 0.8)',   // 中兰花紫
      'rgba(65, 105, 225, 0.8)',   // 皇家蓝
      'rgba(75, 0, 130, 0.8)',     // 靛紫
      'rgba(47, 79, 79, 0.9)'      // 深青灰
    ]
  },
  monoblue: {
    name: '蓝色渐变',
    colors: [
      'rgba(187, 227, 252, 0.8)',  // Blended: 爱丽丝蓝+淡天蓝
      'rgba(135, 206, 250, 0.8)',  // 淡天蓝
      'rgba(30, 144, 255, 0.8)',   // 道奇蓝
      'rgba(0, 127, 255, 0.8)',    // 蓝色
      'rgba(0, 0, 255, 0.8)',      // 纯蓝
      'rgba(0, 0, 205, 0.8)',      // 中蓝
      'rgba(0, 0, 139, 0.8)',      // 深蓝
      'rgba(0, 0, 80, 0.9)'        // 午夜蓝
    ]
  },
  neonNight: {
    name: '霓虹夜色',
    colors: [
      'rgba(191, 255, 255, 0.8)',  // Blended: 纯白+青色霓虹
      'rgba(0, 255, 255, 0.8)',    // 青色霓虹
      'rgba(255, 0, 255, 0.8)',    // 品红霓虹
      'rgba(255, 215, 0, 0.8)',    // 金色
      'rgba(138, 43, 226, 0.8)',   // 紫罗兰
      'rgba(75, 0, 130, 0.8)',     // 靛蓝
      'rgba(25, 25, 112, 0.8)',    // 午夜蓝
      'rgba(0, 0, 0, 0.9)'         // 纯黑
    ]
  },
  forestDawn: {
    name: '森林晨光',
    colors: [
      'rgba(199, 243, 182, 0.8)',  // Blended: 玉米丝白+淡绿
      'rgba(144, 238, 144, 0.8)',  // 淡绿
      'rgba(46, 139, 87, 0.8)',    // 海洋绿
      'rgba(85, 107, 47, 0.8)',    // 暗橄榄绿
      'rgba(34, 139, 34, 0.8)',    // 森林绿
      'rgba(0, 100, 0, 0.8)',      // 深绿
      'rgba(0, 71, 49, 0.8)',      // 深森林绿
      'rgba(0, 40, 26, 0.9)'       // 墨绿
    ]
  },
  purpleHaze: {
    name: '紫霭',
    colors: [
      'rgba(223, 210, 233, 0.8)',  // Blended: 薰衣草白+蓟紫
      'rgba(216, 191, 216, 0.8)',  // 蓟紫
      'rgba(221, 160, 221, 0.8)',  // 梅红
      'rgba(186, 85, 211, 0.8)',   // 中兰花紫
      'rgba(148, 0, 211, 0.8)',    // 暗紫
      'rgba(139, 0, 139, 0.8)',    // 深洋红
      'rgba(128, 0, 128, 0.8)',    // 紫色
      'rgba(75, 0, 130, 0.9)'      // 靛紫
    ]
  }
};

// Get current theme from storage or default to 'bubblegum'
let currentTheme = GM_getValue('treeTheme', 'bubblegum');
log(LOG_LEVELS.INFO, 'Retrieved theme from storage:', currentTheme);

// Validate the stored theme exists in current themes, reset to default if
// invalid
if (!ALL_COLOR_THEMES[currentTheme]) {
  log(LOG_LEVELS.WARN, 'Invalid theme found in storage, resetting to default');
  currentTheme = 'bubblegum';
  GM_setValue('treeTheme', currentTheme);
}

// Apply current theme on load - wrap in setTimeout to ensure DOM is ready
setTimeout(() => {
  log(LOG_LEVELS.INFO, 'Applying initial theme:', currentTheme);
  applyTheme(currentTheme);
}, 1000);

// Add a theme selector dialog
function showThemeSelector() {
  // Remove any existing dialog first
  const existingDialog = document.getElementById('theme-selector-dialog');
  if (existingDialog) {
    existingDialog.remove();
  }

  const dialog = document.createElement('div');
  dialog.id = 'theme-selector-dialog';
  dialog.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--background-color, #2d2d2d);
      color: var(--text-color, #e0e0e0);
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.4);
      z-index: 10000;
      min-width: 200px;
  `;

  // Replace the select element HTML with radio buttons
  const radioOptions = Object.entries(ALL_COLOR_THEMES)
                           .map(([key, theme]) => `
    <div style="margin: 8px 0;">
      <label style="display: flex; align-items: center; cursor: pointer; color: var(--text-color, #e0e0e0);">
        <input type="radio"
               name="themeRadio"
               value="${key}"
               ${key === currentTheme ? 'checked' : ''}
               style="margin-right: 10px;">
        <span>${theme.name}</span>
      </label>
    </div>
  `).join('');

  dialog.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h4 style="margin: 0; color: var(--text-color, #e0e0e0);">选择主题</h4>
          <button id="closeThemeDialog" style="border: none; background: none; color: var(--text-color, #e0e0e0); cursor: pointer; padding: 5px;">✕</button>
      </div>
      <div style="margin: 10px 0;">
          ${radioOptions}
      </div>
  `;

  document.body.appendChild(dialog);

  // Close dialog function
  const closeDialog = () => {
    if (dialog && dialog.parentNode) {
      dialog.parentNode.removeChild(dialog);
    }
  };

  // Event listeners
  dialog.querySelector('#closeThemeDialog')
      .addEventListener('click', closeDialog);

  // Replace the select event listener with radio event listeners
  dialog.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const newTheme = e.target.value;
      applyTheme(newTheme);
      closeDialog();
    });
  });

  // Close dialog when clicking outside
  const handleOutsideClick = (e) => {
    if (!dialog.contains(e.target)) {
      closeDialog();
      document.removeEventListener('click', handleOutsideClick);
    }
  };

  // Delay adding the outside click handler to prevent immediate closure
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
  }, 0);
}
// Register single menu command for theme selection
GM_registerMenuCommand('选择树形主题', showThemeSelector);

function applyTheme(themeName) {
  log(LOG_LEVELS.DEBUG, 'applyTheme called with:', themeName);

  const theme = ALL_COLOR_THEMES[themeName];
  if (!theme) {
    log(LOG_LEVELS.ERROR, 'Theme not found:', themeName);
    return;
  }

  // Remove any existing theme styles
  const existingStyle = document.getElementById('tree-theme-styles');
  if (existingStyle) {
    existingStyle.remove();
  }

  const styleElement = document.createElement('style');
  styleElement.id = 'tree-theme-styles';

  const css = `
    .border-gray-20 {
      border-color: ${theme.colors[0]} !important;
    }
    .TreeNode .border-gray-20 {
      border-color: ${theme.colors[1]} !important;
    }
    .TreeNode .TreeNode .border-gray-20 {
      border-color: ${theme.colors[2]} !important;
    }
    .TreeNode .TreeNode .TreeNode .border-gray-20 {
      border-color: ${theme.colors[3]} !important;
    }
    .TreeNode .TreeNode .TreeNode .TreeNode .border-gray-20 {
      border-color: ${theme.colors[4]} !important;
    }
    .TreeNode .TreeNode .TreeNode .TreeNode .TreeNode .border-gray-20 {
      border-color: ${theme.colors[5]} !important;
    }
    .TreeNode .TreeNode .TreeNode .TreeNode .TreeNode .TreeNode .border-gray-20 {
      border-color: ${theme.colors[6]} !important;
    }
    .TreeNode .TreeNode .TreeNode .TreeNode .TreeNode .TreeNode .TreeNode .border-gray-20 {
      border-color: ${theme.colors[7]} !important;
    }
  `;

  styleElement.textContent = css;
  document.head.appendChild(styleElement);

  currentTheme = themeName;
  GM_setValue('treeTheme', themeName);
  log(LOG_LEVELS.INFO, 'Theme applied and saved:', themeName);
}

// Modify the observer to be more specific and robust
function setupTreeObserver() {
  const treeObserver = new MutationObserver((mutations) => {
    // Check for both possible tree node selectors
    const hasTreeNodes = document.querySelector('.rem-container .TreeNode') ||
        document.querySelector('[data-rem-container-tags~="bullet-list-line"]');

    if (hasTreeNodes) {
      log(LOG_LEVELS.DEBUG, 'Tree nodes detected, applying theme');
      applyTheme(currentTheme);
    }
  });

  // Try to find the container with multiple possible selectors
  const container = document.querySelector('.rem-container') ||
      document.querySelector('#document-container') ||
      document.querySelector('main');

  if (container) {
    treeObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-rem-container-tags']
    });

    // Initial theme application
    applyTheme(currentTheme);
  } else {
    log(LOG_LEVELS.WARN, 'Container not found, retrying in 2 seconds');
    setTimeout(setupTreeObserver, 2000);
  }
}

// Start observing with initial delay
setTimeout(setupTreeObserver, 2000);
})();
