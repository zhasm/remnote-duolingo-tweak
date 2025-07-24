// ==UserScript==
// @name         Audio Control Highlighter and Replay [collinsdictionary]
// @namespace    http://tampermonkey.net/
// @version      1.003-20250724-1128
// @description  Highlights audio controls and buttons, adds customizable
// @author       Me
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

// Collins Dictionary functionality
function setupCollinsDictionary() {
  // Remove 'English Translation of ' from title
  const title = document.title;
  if (title.startsWith('English Translation of ')) {
    document.title = title.replace('English Translation of ', '')
                         .replace('| Collins French-English Dictionary', '')
                         .replace('"', '')
                         .replace('"', '')
                         .toLowerCase();
  }

  setupPronunciationElements();
  setupConjugationElements();
}

function setupPronunciationElements() {
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
          // When Option/Alt is pressed, only copy URL
          copyToClipboard(`${mp3Url}`)
              .then(() => {
                showNotification(
                    `${pronText}'s URL has been copied to clipboard`);
              })
              .catch(err => {
                log(LOG_LEVELS.ERROR, 'Failed to copy pronunciation', err);
                showNotification(`Failed to copy ${pronText}`);
              });
        } else {
          // Default behavior: copy pronunciation text
          if (pronText.length === 0) {
            return;
          }
          copyToClipboard(`${pronText}`)
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

function setupConjugationElements() {
  log(LOG_LEVELS.INFO, 'Setting up conjugation elements');

  // Function to extract and format title and infl elements
  function getFormattedConjugationText(node) {
    const eles = node.querySelectorAll('span.title, span.infl');
    return Array.from(eles)
        .map(inflNode => inflNode.textContent.trim())
        .join('\n - ');
  }

  // Function to setup conjugation elements
  function setupConjugationListeners() {
    // Select all span elements with the class 'conjugation' inside
    // 'div.short_verb_table'
    const nodes =
        document.querySelectorAll('div.short_verb_table span.conjugation');
    log(LOG_LEVELS.INFO, `Found ${nodes.length} conjugation nodes`);

    if (nodes.length === 0) {
      log(LOG_LEVELS.WARN, 'No conjugation nodes found, will retry later');
      return false;
    }

    // Loop through each node and add a click event listener
    nodes.forEach((node, index) => {
      // Skip if already has our event listener
      if (node.hasAttribute('data-conjugation-setup')) {
        return;
      }

      log(LOG_LEVELS.DEBUG, `Setting up conjugation node ${index + 1}`);
      node.setAttribute('data-conjugation-setup', 'true');

      node.addEventListener('click', (event) => {
        log(LOG_LEVELS.DEBUG, 'Conjugation node clicked');

        // Check if the Option key is pressed
        const isOptionKeyPressed =
            event.altKey;  // Option key is represented by altKey in the event

        let ret = '';
        let msg = '';

        if (isOptionKeyPressed) {
          // Copy all nodes if Option key is pressed
          msg = 'All all conjugation nodes are copied ! ';
          log(LOG_LEVELS.DEBUG,
              'Option key is pressed, copying all conjugation nodes');

          const allInfl =
              Array.from(nodes).map(node => getFormattedConjugationText(node));
          ret = allInfl.join('\n');
        } else {
          // Get the formatted text for the clicked node
          ret = getFormattedConjugationText(node);
          const title = node.querySelector('span.title')?.textContent || '';
          msg = `${title} conjugation is copied ! `;
        }

        log(LOG_LEVELS.DEBUG, `Formatted conjugation text: ${ret}`);

        // Copy to clipboard
        copyToClipboard(ret)
            .then(() => {
              log(LOG_LEVELS.INFO,
                  `Conjugation copied to clipboard successfully`);
              showNotification(msg);
            })
            .catch(err => {
              log(LOG_LEVELS.ERROR, 'Failed to copy conjugation', err);
              showNotification(`Failed to copy conjugation(s) ! `);
            });
      });
    });

    return true;
  }

  // Initial setup
  let setupSuccess = setupConjugationListeners();

  // If no nodes found initially, set up a retry mechanism for dynamic content
  if (!setupSuccess) {
    log(LOG_LEVELS.INFO,
        'Setting up retry mechanism for dynamic conjugation content');

    // Retry every 2 seconds for up to 30 seconds
    let retryCount = 0;
    const maxRetries = 15;
    const retryInterval = setInterval(() => {
      retryCount++;
      log(LOG_LEVELS.DEBUG,
          `Retry ${retryCount}/${maxRetries} for conjugation elements`);

      if (setupConjugationListeners()) {
        log(LOG_LEVELS.INFO, 'Conjugation elements found and setup on retry');
        clearInterval(retryInterval);
      } else if (retryCount >= maxRetries) {
        log(LOG_LEVELS.WARN, 'Max retries reached for conjugation elements');
        clearInterval(retryInterval);
      }
    }, 2000);
  }
}

// Initialize Collins Dictionary functionality
setupCollinsDictionary();

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
})();
