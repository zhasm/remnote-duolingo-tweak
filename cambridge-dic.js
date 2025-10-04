// ==UserScript==
// @name         Audio Control Highlighter and Replay [cambridge]
// @namespace    http://tampermonkey.net/
// @version      1.001-20251004-2130
// @description  Highlights audio controls and buttons, adds customizable
// @author       Me
// @match        https://dictionary.cambridge.org/dictionary/english/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=dictionary.cambridge.org
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
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


  function setupPronunciationElements() {
    // Select all the elements with the class 'dpron-i'
    document.querySelectorAll('span.dpron-i').forEach(eli => {
      // Add a click event listener to each element
      eli.addEventListener('click', (event) => {
        log(LOG_LEVELS.DEBUG, 'Element clicked:', eli); // Log which element was clicked
        log(LOG_LEVELS.DEBUG, 'Is option key pressed?', event.altKey); // Log the state of the option key

        // Check if the option key is pressed
        if (event.altKey) { // 'altKey' corresponds to the option key on Mac
          // Find the audio element within the clicked element
          const audio = eli.querySelector('audio');
          log(LOG_LEVELS.DEBUG, 'Audio element found:', audio); // Log the found audio element

          if (audio) {
            // Get the source element for audio/mpeg
            const source = audio.querySelector('source[type="audio/mpeg"]');
            log(LOG_LEVELS.DEBUG, 'Audio source found:', source); // Log the found source element

            if (source) {
              // Log the source URL
              log(LOG_LEVELS.INFO, 'Audio source URL:', source.src);
              copyToClipboard(source.src);
              showNotification(`Audio URL ${source.src} copied to clipboard!`);
            } else {
              log(LOG_LEVELS.WARN, 'No audio source of type "audio/mpeg" found.');
            }
          } else {
            log(LOG_LEVELS.WARN, 'No audio element found within the clicked span.');
          }
        } else {
          log(LOG_LEVELS.DEBUG, 'Option key is not pressed.');
        }
      });
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
  // Initialize pronunciation handlers on load
  try {
    setupPronunciationElements();
    log(LOG_LEVELS.INFO, 'setupPronunciationElements initialized successfully');
  } catch (err) {
    log(LOG_LEVELS.ERROR, 'Failed to initialize setupPronunciationElements:', err);
  }

})();
