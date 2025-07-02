// ==UserScript==
// @name         Audio Control Highlighter and Replay [collinsdictionary]
// @namespace    http://tampermonkey.net/
// @version      1.000
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



})();
