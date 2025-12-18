// ==UserScript==
// @name         WNE Auto English
// @namespace    http://tampermonkey.net/
// @version      1.0.0.4.20251215-0838
// @description  Auto-switch to English on WNE website
// @author       Zhang

// @match        https://elearning.wne.uw.edu.pl/*
// @match        https://login.uw.edu.pl/*
// @match        https://mojekonto.uw.edu.pl/*
// @match        https://usosweb.uw.edu.pl/*
// @match        https://usosweb.wne.uw.edu.pl/*

// @icon         https://www.google.com/s2/favicons?sz=64&domain=edu.pl
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    /**
     * Simulate mouse activity to keep login session alive
     */
    function simulateMouseActivity() {
        // Generate random coordinates within the viewport
        const x = Math.random() * window.innerWidth;
        const y = Math.random() * window.innerHeight;

        // Create a mousemove event
        const mouseMoveEvent = new MouseEvent('mousemove', {
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
        });

        // Dispatch the mousemove event
        document.dispatchEvent(mouseMoveEvent);

        // Create a click event
        const clickEvent = new MouseEvent('click', {
            clientX: x,
            clientY: y,
            bubbles: true,
            cancelable: true,
        });

        // Dispatch the click event at the generated coordinates
        document.dispatchEvent(clickEvent);

        console.log('[WNE Auto English] Simulated mouse activity at (' + Math.round(x) + ', ' + Math.round(y) + ')');
    }

    // Keep login alive by simulating activity every Minutes_Alive minutes
    const Minutes_Alive = 5;
    const activityInterval = Minutes_Alive * 60 * 1000; // 10 minutes
    setInterval(simulateMouseActivity, activityInterval);
    console.log('[WNE Auto English] Session keeper started - will simulate activity every ' + Minutes_Alive + ' minutes');
    const langAttr = document.documentElement.getAttribute('lang');
    console.log('[WNE Auto English] Current language:', langAttr);

    // If already in English, do nothing
    if (langAttr === 'en') {
        console.log('[WNE Auto English] Already in English, no action needed');
        return;
    }

    // Get current URL
    const url = new URL(window.location.href);

    // Check if lang=en is already in the URL
    if (url.searchParams.get('lang') === 'en') {
        console.log('[WNE Auto English] lang=en already in URL, page might be loading...');
        return;
    }

    // Add lang=en parameter
    url.searchParams.set('lang', 'en');
    const newUrl = url.toString();

    console.log('[WNE Auto English] Switching to English:', newUrl);

    // Navigate to the new URL
    window.location.href = newUrl;
})();
