// ==UserScript==
// @name         Audio Control Highlighter and Replay
// @namespace    http://tampermonkey.net/
// @version      1.014
// @description  Highlights audio controls and buttons, adds customizable hotkeys for replay and button click
// @author       You
// @match        https://www.remnote.com/*
// @match        https://d1-tutorial.rex-zhasm6886.workers.dev/*
// @match        https://www.duolingo.com/lesson*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=workers.dev
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    console.log('[APH-MK][anonymous:18] Script loaded');

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
        .AudioVideoNode audio {
            border: 1px solid #ff003c !important;
            border-radius: 8px !important;
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
            border: 2px solid #4a90e2 !important;
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
        console.log('[APH-MK][highlightAudioControl:60] Attempting to highlight audio control');
        if (audioElement) {
            console.log('[APH-MK][highlightAudioControl:62] Audio control found and highlighted');
            return audioElement;
        }
        console.log('[APH-MK][highlightAudioControl:65] No audio control found');
        return null;
    }

    function replayAudio(audioElement) {
        console.log('[APH-MK][replayAudio:69] Attempting to replay audio');
        if (audioElement) {
            console.log('[APH-MK][replayAudio:71] Audio element details:', {
                src: audioElement.src,
                paused: audioElement.paused,
                currentTime: audioElement.currentTime,
                duration: audioElement.duration
            });
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise !== undefined) {
                playPromise.then(_ => {
                    console.log('[APH-MK][replayAudio:81] Audio playback started successfully');
                }).catch(error => {
                    console.log('[APH-MK][replayAudio:83] Audio playback failed:', error);
                });
            }
        } else {
            console.log('[APH-MK][replayAudio:87] No audio element to replay');
        }
    }

    function handleHotkey(event) {
        const audioElement = document.querySelector('audio');
        const button = document.querySelector('span[dir="ltr"] button');
        console.log('[APH-MK][handleHotkey:101] Key pressed:', event.key, 'Ctrl:', event.ctrlKey, 'Audio:', audioElement ? 'Found' : 'Not found', 'Button:', button ? 'Found' : 'Not found');

        if (event.ctrlKey){
            console.log('[APH-MK][handleHotkey:104] Ctrl key detected');
            event.preventDefault();
            if (audioElement) {
                console.log('[APH-MK][handleHotkey:107] Replaying audio');
                replayAudio(audioElement);
            } else if (button) {
                console.log('[APH-MK][handleHotkey:110] Clicking button');
                button.click();
            } else {
                console.log('[APH-MK][handleHotkey:113] No audio or button found');
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
        console.log('[APH-MK][anonymous:108] Audio element found');
        highlightAudioControl(audioElement);
    });

    // Add event listener for the hotkey
    document.addEventListener('keydown', handleHotkey);

    // Function to set a new hotkey
    function setNewHotkey(newHotkey) {
        hotkey = newHotkey;
        GM_setValue('audioReplayHotkey', newHotkey);
        console.log('[APH-MK][setNewHotkey:116] New hotkey set:', newHotkey);
    }

    // Set the initial hotkey
    setNewHotkey(defaultHotkey);

    console.log('[APH-MK][anonymous:131] Script setup complete');
})();