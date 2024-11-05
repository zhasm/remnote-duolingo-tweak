// ==UserScript==
// @name         Audio Control Highlighter and Replay
// @namespace    http://tampermonkey.net/
// @version      1.030
// @description  Highlights audio controls and buttons, adds customizable hotkeys for replay and button click
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
            const levelName = Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === level);
            console.log(`[APH-MK][${levelName}]`, ...args);
        }
    }

    log(LOG_LEVELS.INFO, 'Script loaded');

    // Customizable hotkey (default to Control+A)
    const defaultHotkey = {
        key: 'a',
        ctrlKey: true,
        altKey: false,
        metaKey: false,
        shiftKey: false
    };
    let hotkey = GM_getValue('audioReplayHotkey', defaultHotkey);

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
                playPromise.then(_ => {
                    log(LOG_LEVELS.INFO, 'Audio playback started successfully');
                }).catch(error => {
                    log(LOG_LEVELS.ERROR, 'Audio playback failed:', error);
                });
            }
        } else {
            log(LOG_LEVELS.WARN, 'No audio element to replay');
        }
    }

    function handleHotkey(event) {
        // Skip if no hotkey is configured
        if (!hotkey.key && !hotkey.ctrlKey && !hotkey.altKey &&
            !hotkey.metaKey && !hotkey.shiftKey) {
            return;
        }
        // Check if the event matches the configured hotkey
        if ((hotkey.key ? event.key.toLowerCase() === hotkey.key.toLowerCase() : true) &&
            event.ctrlKey === hotkey.ctrlKey &&
            event.altKey === hotkey.altKey &&
            event.metaKey === hotkey.metaKey &&
            event.shiftKey === hotkey.shiftKey) {

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
                log(LOG_LEVELS.WARN, 'No audio or button found');
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

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    }

    // Set up the audio control when it appears
    waitForAudioElement().then((audioElement) => {
        log(LOG_LEVELS.INFO, 'Audio element found');
        highlightAudioControl(audioElement);
    });

    // Add event listener for the hotkey
    document.addEventListener('keydown', handleHotkey);

    // Function to set a new hotkey
    function setNewHotkey(newHotkey) {
        hotkey = newHotkey;
        GM_setValue('audioReplayHotkey', newHotkey);
        log(LOG_LEVELS.INFO, 'New hotkey set:', newHotkey);
    }

    // Instead, only set the default if no hotkey exists
    if (!GM_getValue('audioReplayHotkey')) {
        setNewHotkey(defaultHotkey);
    }

    // Move these functions inside the IIFE
    function promptForHotkey() {
        // Create dialog elements
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10000;
            min-width: 300px;
        `;

        const content = `
            <h3 style="margin-top: 0;">Script Configuration</h3>
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 10px 0;">Hotkey Settings</h4>
                <label>Key: <input type="text" id="hotkeyChar" maxlength="1" value="${hotkey.key}" style="width: 30px;"></label>
            </div>
            <div style="margin-bottom: 15px;">
                <label><input type="checkbox" id="hotkeyCtrl" ${hotkey.ctrlKey ? 'checked' : ''}> ⌃(Ctrl)</label>
                <label style="margin-left: 10px;"><input type="checkbox" id="hotkeyShift" ${hotkey.shiftKey ? 'checked' : ''}> ⇧(Shift)</label>
                <label style="margin-left: 10px;"><input type="checkbox" id="hotkeyAlt" ${hotkey.altKey ? 'checked' : ''}>⌥(Alt)</label>
                <label style="margin-left: 10px;"><input type="checkbox" id="hotkeyMeta" ${hotkey.metaKey ? 'checked' : ''}>⌘(Cmd)</label>
            </div>
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 10px 0;">Log Level</h4>
                <select id="logLevel">
                    <option value="${LOG_LEVELS.ERROR}" ${currentLogLevel === LOG_LEVELS.ERROR ? 'selected' : ''}>Error Only</option>
                    <option value="${LOG_LEVELS.WARN}" ${currentLogLevel === LOG_LEVELS.WARN ? 'selected' : ''}>Warning & Error</option>
                    <option value="${LOG_LEVELS.INFO}" ${currentLogLevel === LOG_LEVELS.INFO ? 'selected' : ''}>Info & Above</option>
                    <option value="${LOG_LEVELS.DEBUG}" ${currentLogLevel === LOG_LEVELS.DEBUG ? 'selected' : ''}>Debug (All)</option>
                </select>
            </div>
            <div style="text-align: right;">
                <button id="configSave" style="margin-right: 10px;">Save</button>
                <button id="configCancel">Cancel</button>
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
                newHotkey.ctrlKey ? 'Ctrl' : '',
                newHotkey.altKey ? 'Alt' : '',
                newHotkey.shiftKey ? 'Shift' : '',
                newHotkey.metaKey ? 'Meta' : ''
            ].filter(Boolean).join('+');

            const hotkeyStr = modifiers + (modifiers && newHotkey.key ? '+' : '') + newHotkey.key;
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

    // Move Collins Dictionary code inside IIFE
    if (window.location.href.match(/https:\/\/www\.collinsdictionary\.com\/dictionary\/french-english/)) {
        const pronunciationElements = document.querySelectorAll('div.mini_h2.form, span.form.type-phr');

        pronunciationElements.forEach(element => {
            const pronSpan = element.querySelector('span.pron') || element.querySelector('span.orth');
            const audioLink = element.querySelector('a[data-src-mp3]');

            if (pronSpan && audioLink) {
                // Highlight span when clicking the element
                element.addEventListener('click', () => {
                    pronSpan.style.backgroundColor = 'yellow';
                    setTimeout(() => { pronSpan.style.backgroundColor = ''; }, 1000);
                });
                // Copy mp3 URL and text when clicking the span
                pronSpan.addEventListener('click', (e) => {
                    e.stopPropagation();
                    let pronText = pronSpan.textContent.trim();
                    const mp3Url = audioLink.getAttribute('data-src-mp3');
                    if (mp3Url) {
                        // click the play button of mp3
                        audioLink.click();
                    }
                    // Check for punctuation spans and include them if present
                    const punctuationSpans = element.querySelectorAll('span.punctuation');
                    if (punctuationSpans.length === 2) {
                        pronText = `${punctuationSpans[0].textContent.trim()}${pronText}${punctuationSpans[1].textContent.trim()}`;
                    }

                    navigator.clipboard.writeText(`${pronText}`).then(() => {
                        showNotification(`${pronText}'s copied to clipboard`);
                    }).catch(err => {
                        log(LOG_LEVELS.ERROR, 'Failed to copy pronunciation', err);
                        showNotification(`Failed to copy ${pronText}'s pronunciation`);
                    });
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
        log(LOG_LEVELS.DEBUG, 'Checking for spans that need line breaks');

        const divs = document.querySelectorAll('div[dir="ltr"]');
        divs.forEach(div => {
            const spans = div.querySelectorAll(':scope > span');
            if (spans.length >= 2) {
                const firstSpan = spans[0];
                // Check if there's already a <br> after the first span
                const nextElement = firstSpan.nextSibling;
                if (nextElement?.nodeName !== 'BR') {
                    log(LOG_LEVELS.DEBUG, 'Adding line break after first span');
                    const br = document.createElement('br');
                    firstSpan.after(br);
                }
            }
        });
    }

    // Add observer to handle dynamic content
    const contentObserver = new MutationObserver((mutations) => {
        addLineBreakAfterFirstSpan();
    });

    contentObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Initial check for existing content
    addLineBreakAfterFirstSpan();
})();
