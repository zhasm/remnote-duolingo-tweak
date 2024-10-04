// ==UserScript==
// @name         Audio Control Highlighter and Replay
// @namespace    http://tampermonkey.net/
// @version      1.010
// @description  Highlights the first audio control, adds a customizable hotkey to replay
// @author       You
// @match        https://www.remnote.com/*
// @match        https://d1-tutorial.rex-zhasm6886.workers.dev/*
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
            padding-top: 4px !important;
            padding-bottom: 4px !important;
            padding-left: 0px !important;
            padding-right: 0px !important;
            background-color: #f0f8ff !important;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1) !important;
            transition: all 0.3s ease !important;
            width: 300px !important;
            display: block !important;
        }
        .AudioVideoNode audio:hover {
            box-shadow: 0 4px 8px rgba(0,0,0,0.15) !important;
        }
    `);

    function highlightAudioControl(audioElement) {
        console.log('[APH-MK][highlightAudioControl:54] Attempting to highlight audio control');
        if (audioElement) {
            // Styles are now applied via CSS, no need for inline styles
            console.log('[APH-MK][highlightAudioControl:57] Audio control found and highlighted');
            return audioElement;
        }
        console.log('[APH-MK][highlightAudioControl:60] No audio control found');
        return null;
    }

    function replayAudio(audioElement) {
        console.log('[APH-MK][replayAudio:55] Attempting to replay audio');
        if (audioElement) {
            console.log('[APH-MK][replayAudio:57] Audio element details:', {
                src: audioElement.src,
                paused: audioElement.paused,
                currentTime: audioElement.currentTime,
                duration: audioElement.duration
            });
            audioElement.currentTime = 0;
            const playPromise = audioElement.play();
            if (playPromise !== undefined) {
                playPromise.then(_ => {
                    console.log('[APH-MK][replayAudio:67] Audio playback started successfully');
                }).catch(error => {
                    console.log('[APH-MK][replayAudio:69] Audio playback failed:', error);
                });
            }
        } else {
            console.log('[APH-MK][replayAudio:73] No audio element to replay');
        }
    }

    function handleHotkey(event) {
        const audioElement = document.querySelector('audio');
        console.log('[APH-MK][handleHotkey:78] Key pressed:', event.key, 'KeyCode:', event.keyCode, 'Which:', event.which, 'Code:', event.code, 'Audio element:', audioElement ? 'Captured' : 'Not found');

        if (event.ctrlKey === hotkey.ctrlKey &&
            event.altKey === hotkey.altKey &&
            event.metaKey === hotkey.metaKey &&
            event.shiftKey === hotkey.shiftKey &&
            event.key.toLowerCase() === hotkey.key.toLowerCase()) {
            console.log('[APH-MK][handleHotkey:86] Hotkey detected');
            event.preventDefault();
            if (audioElement) {
                console.log('[APH-MK][handleHotkey:89] Audio control information:', {
                    outerHTML: audioElement.outerHTML,
                    src: audioElement.src,
                    currentTime: audioElement.currentTime,
                    duration: audioElement.duration,
                    paused: audioElement.paused,
                    volume: audioElement.volume,
                    muted: audioElement.muted
                });
                replayAudio(audioElement);
            } else {
                console.log('[APH-MK][handleHotkey:100] No audio element found');
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

    console.log('[APH-MK][anonymous:121] Script setup complete');
})();