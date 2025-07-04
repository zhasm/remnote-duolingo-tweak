// ==UserScript==
// @name         Audio Control Highlighter and Replay [duolingo]
// @namespace    http://tampermonkey.net/
// @version      1.001
// @description  Highlights audio controls and buttons, adds customizable
// @author       Me
// @match        https://www.duolingo.com/*
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

// Modify how we store and retrieve hotkeys
function getDomainKey() {
  return window.location.hostname.replace(/^www\./, '');
}

function getHotkeyForDomain() {
  const domain = getDomainKey();
  const allHotkeys = GM_getValue('audioReplayHotkeys', {});
  return allHotkeys[domain] || defaultHotkey;
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

// Reusable hotkey match function
function isHotkeyMatch(event, hotkey) {
  // Primary group
  const primaryMatch =
      (hotkey.key ? event.key.toLowerCase() === hotkey.key.toLowerCase() :
                    true) &&
      event.ctrlKey === hotkey.ctrlKey && event.altKey === hotkey.altKey &&
      event.metaKey === hotkey.metaKey && event.shiftKey === hotkey.shiftKey;

  // Special case: only ShiftRight pressed, all other modifiers false
  const specialCase =
      (event.code === 'ShiftRight' && event.key === 'Shift' &&
       event.shiftKey === true && event.ctrlKey === false &&
       event.altKey === false && event.metaKey === false &&
       (event.getModifierState && !event.getModifierState('ShiftLeft') &&
        !event.getModifierState('ShiftRight') &&
        !event.getModifierState('ControlLeft') &&
        !event.getModifierState('ControlRight') &&
        !event.getModifierState('AltLeft') &&
        !event.getModifierState('AltRight') &&
        !event.getModifierState('MetaLeft') &&
        !event.getModifierState('MetaRight')));

  return primaryMatch || specialCase;
}

function handleHotkey(event) {
  // if i pressed, focus on textarea
  if (event.key === 'i') {
    const textarea = document.querySelector('#content textarea');
    if (textarea && !textarea.hasFocus && event.key === 'i') {
      textarea.focus();
      event.preventDefault();
    }
  }

  // Skip if no hotkey is configured
  if (!hotkey.key && !hotkey.ctrlKey && !hotkey.altKey && !hotkey.metaKey &&
      !hotkey.shiftKey &&
      !(hotkey.secondary && Object.values(hotkey.secondary).some(Boolean))) {
    return;
  }

  if (isHotkeyMatch(event, hotkey)) {
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

// Keep track of initialized Remnote elements to avoid duplicate listeners

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
    log(LOG_LEVELS.INFO, '[✅initTextArea] Keydown event detected:', {
      key: event.key,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey
    });

    // Use the reusable hotkey match function
    if (isHotkeyMatch(event, hotkey)) {
      log(LOG_LEVELS.INFO,
          '[✅initTextArea] Global hotkey combination pressed in textarea');
      handleHotkey(event);
      event.preventDefault();
    }
  });

  log(LOG_LEVELS.INFO,
      '[✅initTextArea] Event listener added successfully with global hotkey configuration');
}

// Add event listener for the hotkey
document.addEventListener('keydown', handleHotkey);


log(LOG_LEVELS.INFO, 'Script setup complete');


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



// for duolingo.com
function setupDuolingoKeybindsAndBadges() {
  if (!window.location.hostname.includes('duolingo.com')) return;

  // Configuration - Define all button selectors here
  const BUTTON_SELECTORS = [
    'div[data-test="word-bank"] button[aria-disabled="false"]',
    'div[data-test="stories-element"] button[data-test="stories-choice"]'
  ];

  // Track current button mappings for both types
  const buttonMaps = {original: new Map(), new: new Map()};


  // Store last known button references for change detection
  let lastButtonRefs = [];

  // Unified function to setup labels and keybinds
  function setupButtonLabelsAndKeybinds(force = false) {
    // Gather current button references
    const currentButtonRefs = BUTTON_SELECTORS.flatMap(
        selector => Array.from(document.querySelectorAll(selector)));
    // Only rebuild if the set of buttons has changed or force is true
    if (!force && currentButtonRefs.length === lastButtonRefs.length &&
        currentButtonRefs.every((btn, i) => btn === lastButtonRefs[i])) {
      return;
    }
    lastButtonRefs = currentButtonRefs;
    // Clear previous state
    document.querySelectorAll('.kb-badge').forEach(badge => badge.remove());
    buttonMaps.original.clear();
    buttonMaps.new.clear();
    // Process all buttons together for correct indexing
    const allButtons = BUTTON_SELECTORS.flatMap(
        selector => Array.from(document.querySelectorAll(selector)));
    const uniqueButtons = Array.from(new Set(allButtons));
    const filteredButtons =
        uniqueButtons
            .filter((button, i) => {
              const btnText = button.textContent.trim();
              const isStoriesChoice = button.matches(
                  'div[data-test="stories-element"] button[data-test="stories-choice"]');
              if (btnText.length === 0 && !isStoriesChoice) {
                return false;
              }
              if (/^[0-9]/.test(btnText)) {
                return false;
              }
              return true;
            })
            .slice(0, 10);
    filteredButtons.forEach((button, buttonIndex) => {
      const buttonType =
          button.matches(BUTTON_SELECTORS[1]) ? 'new' : 'original';
      const btnText = button.textContent.trim();
      const label = buttonIndex < 9 ? (buttonIndex + 1).toString() : '0';
      // Add visual badge
      const badge = document.createElement('span');
      badge.className = `kb-badge kb-badge-${buttonType}`;
      badge.textContent = label;
      badge.style.cssText = `
              position: absolute;
              top: -10px;
              left: -5px;
              background: ${buttonType === 'original' ? '#555' : '#7d3c98'};
              color: white;
              border-radius: 50%;
              width: 18px;
              height: 18px;
              font-size: 11px;
              display: flex;
              align-items: center;
              justify-content: center;
              pointer-events: none;
              font-family: monospace;
            `;
      button.style.position = 'relative';
      button.appendChild(badge);
      // Map key to current button reference
      buttonMaps[buttonType].set(label, button);
    });
  }

  // Unified keyboard handler
  function handleKeyPress(e) {
    if (/^[0-9]$/.test(e.key)) {
      const key = e.key === '0' ? '0' : e.key;
      // Try original buttons first, then new buttons
      const button = buttonMaps.original.get(key) || buttonMaps.new.get(key);
      if (button) {
        const buttonType = buttonMaps.original.has(key) ? 'original' : 'new';
        console.log(`[Keybind] Clicking ${buttonType} button mapped to ${
            key}: "${button.textContent.trim()}"`);
        e.stopImmediatePropagation();
        e.preventDefault();
        button.dispatchEvent(
            new MouseEvent('click', {bubbles: true, cancelable: true}));
        setTimeout(() => setupButtonLabelsAndKeybinds(true), 50);
      }
    }
  }

  // Initialization
  function initialize() {
    document.removeEventListener('keydown', handleKeyPress, true);
    window.removeEventListener('keydown', handleKeyPress, true);
    document.addEventListener('keydown', handleKeyPress, true);
    window.addEventListener('keydown', handleKeyPress, true);
    setupButtonLabelsAndKeybinds(true);
    // Compact refresh button (unchanged)
    if (!document.getElementById('kb-refresh-btn')) {
      const btn = document.createElement('button');
      btn.id = 'kb-refresh-btn';
      btn.title = 'Refresh Keybinds (Debug)';
      btn.innerHTML = '🔁';
      btn.style.cssText = `
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 9999;
            width: 24px;
            height: 24px;
            padding: 0;
            border-radius: 50%;
            background: #2196F3;
            color: white;
            border: none;
            cursor: pointer;
            font-size: 14px;
            line-height: 24px;
            text-align: center;
            overflow: hidden;
            white-space: nowrap;
            transition: all 0.3s ease;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            opacity: 0.7;
          `;
      btn.addEventListener('mouseenter', () => {
        btn.style.width = '120px';
        btn.style.borderRadius = '4px';
        btn.innerHTML = 'Refresh Keybinds';
        btn.style.opacity = '1';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.width = '24px';
        btn.style.borderRadius = '50%';
        btn.innerHTML = '🔁';
        btn.style.opacity = '0.7';
      });
      btn.addEventListener('click', () => setupButtonLabelsAndKeybinds(true));
      document.body.appendChild(btn);
      setTimeout(() => {
        btn.style.opacity = '0.3';
        btn.style.transform = 'scale(0.9)';
      }, 3000);
    }
  }

  // Start when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

  // Watch for DOM changes, debounce and only rebuild if changed
  let debounceTimeout = null;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimeout);
    debounceTimeout =
        setTimeout(() => setupButtonLabelsAndKeybinds(false), 150);
  });
  observer.observe(document.body, {childList: true, subtree: true});
}

// Register for duolingo.com only
setupDuolingoKeybindsAndBadges();

// Statistics tracking system
const STATS_KEYS = {
  INNERMOST_DIV_CLICK: 'duolingo_stats_innermost_div_click',
  CORRECT_SOLUTION_CLICK: 'duolingo_stats_correct_solution_click',
  TAP_COMPLETE: 'duolingo_stats_tap_complete'
};

function getStats(key) {
  return parseInt(localStorage.getItem(key) || '0');
}

function incrementStats(key) {
  const current = getStats(key);
  const newValue = current + 1;
  localStorage.setItem(key, newValue.toString());
  return newValue;
}

function logStats(key, action) {
  const count = incrementStats(key);
  console.log(`📊 [${action}] Triggered ${count} times`);
}

// Generic click handler factory for dynamic content
function createDynamicClickHandler(config) {
  const {
    selector,
    textExtractor,
    notificationPrefix,
    preventDuplicates = true,
    attributeName = 'click_handled',
    statsKey
  } = config;

  function attachHandlers() {
    const elements = document.querySelectorAll(selector);
    elements.forEach(element => {
      // Skip if already handled and preventDuplicates is true
      if (preventDuplicates && element.getAttribute(attributeName) === 'true') {
        return;
      }

      element.addEventListener('click', async () => {
        // Track statistics
        if (statsKey) {
          logStats(statsKey, notificationPrefix);
        }

        const textContent = textExtractor(element);

        if (!textContent) {
          console.log(`${notificationPrefix} No text found`);
          return;
        }

        try {
          await copyToClipboard(textContent);
          showNotification(`${notificationPrefix}: [${textContent}]`);
        } catch (error) {
          console.error(`${notificationPrefix} Copy failed:`, error);
        }
      });

      if (preventDuplicates) {
        element.setAttribute(attributeName, 'true');
      }
    });
  }

  // Initial attach
  attachHandlers();

  // Observe DOM changes for dynamic content
  const observer = new MutationObserver(() => {
    attachHandlers();
  });
  observer.observe(document.body, {childList: true, subtree: true});

  return {attachHandlers, observer};
}

// Function to register click-to-copy on innermost div, robust for dynamic
// content
function registerInnermostDivClickCopy() {
  createDynamicClickHandler({
    selector:
        'div[data-test*="challenge"] div[dir="ltr"]:not([click_handled="true"])',
    textExtractor: (node) => {
      // First try: span[aria-hidden="true"]
      let ele = node.querySelectorAll('span[aria-hidden="true"]');
      let textContent = Array.from(ele).map(span => span.textContent).join('');

      if (!textContent) {
        console.log('🦉 1st try failed.');
        // Second try: span[data-test]
        ele = node.querySelectorAll('span[data-test]');
        textContent =
            Array.from(ele).map(span => span.textContent).join(' ').trim();
        // Only add punctuation if textContent is not empty
        if (textContent && !/[.!?]$/.test(textContent)) {
          textContent += '.';
        }
      }

      return textContent;
    },
    notificationPrefix: '1️⃣🦉',
    statsKey: STATS_KEYS.INNERMOST_DIV_CLICK
  });
}

// Function to register click event on parent of <h2>Correct solution:</h2>
function registerCorrectSolutionClickLogger() {
  createDynamicClickHandler({
    selector: 'div#session\\/PlayerFooter div:has(> h2)',
    textExtractor: (footer) => {
      const answerzone = footer;
      if (!answerzone) return '';
      const solutionDiv = answerzone.querySelector('div div');
      return solutionDiv?.textContent.trim().replace(/Meaning:\s*/g, '') || '';
    },
    notificationPrefix: '2️⃣📋',
    preventDuplicates: false,  // We'll handle duplicates manually with WeakMap
    attributeName: 'solution_click_handled',
    statsKey: STATS_KEYS.CORRECT_SOLUTION_CLICK
  });
}

// Generic content processor factory for automatic processing
function createContentProcessor(config) {
  const {
    selector,
    contentExtractor,
    notificationPrefix,
    processOnChange = true,
    statsKey
  } = config;

  let lastProcessedContent = null;

  function processContent() {
    const elements = document.querySelectorAll(selector);
    const currentContent = contentExtractor(elements);

    // Check if content has changed to avoid unnecessary processing
    if (processOnChange && currentContent === lastProcessedContent) {
      return;
    }
    lastProcessedContent = currentContent;

    if (currentContent) {
      // Track statistics
      if (statsKey) {
        logStats(statsKey, notificationPrefix);
      }

      copyToClipboard(currentContent);
      console.log(`${notificationPrefix} Copied result:`, currentContent);
      showNotification(`${notificationPrefix}[${currentContent}]`);
    }
  }

  // Initial processing
  processContent();

  // Observe DOM changes for dynamic content
  const observer = new MutationObserver(() => {
    processContent();
  });
  observer.observe(document.body, {childList: true, subtree: true});

  return {processContent, observer};
}

// Function to register tap complete challenge processing
function registerTapComplete() {
  createContentProcessor({
    selector:
        'div[data-test="challenge challenge-tapComplete"] span[aria-hidden="true"], div[data-test="challenge challenge-tapComplete"] span > span > button[data-test]',
    contentExtractor: (hintTokens) => {
      let result = '';

      Array.from(hintTokens).forEach(element => {
        if (element.matches('span[aria-hidden="true"]')) {
          // Handle span[aria-hidden="true"] case
          result += element.textContent;
        } else if (element.matches('span > span > button[data-test]')) {
          // Handle button case - check if parent span has multiple classes
          const parentSpanClass =
              element.parentElement?.parentElement?.className;
          if (parentSpanClass && !parentSpanClass.includes(' ')) {
            result += element.textContent;
          }
        }
      });

      return result.trim();
    },
    notificationPrefix: '3️⃣🐟',
    statsKey: STATS_KEYS.TAP_COMPLETE
  });
}

// Function to display current statistics
function displayStats() {
  console.log('📊 === DUOLINGO PLUGIN STATISTICS ===');
  console.log(`1️⃣🦉 Innermost Div Click: ${
      getStats(STATS_KEYS.INNERMOST_DIV_CLICK)} times`);
  console.log(`2️⃣📋 Correct Solution Click: ${
      getStats(STATS_KEYS.CORRECT_SOLUTION_CLICK)} times`);
  console.log(`3️⃣🐟 Tap Complete: ${getStats(STATS_KEYS.TAP_COMPLETE)} times`);
  console.log('📊 ================================');
}

// Function to reset statistics
function resetStats() {
  Object.values(STATS_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
  console.log('📊 Statistics reset');
  displayStats();
}

// Add menu commands for statistics
GM_registerMenuCommand('Show Statistics', displayStats);
GM_registerMenuCommand('Reset Statistics', resetStats);

// Register all handlers
registerInnermostDivClickCopy();
registerCorrectSolutionClickLogger();
registerTapComplete();

// Display initial statistics
displayStats();
})();
