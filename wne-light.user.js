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

(function() {
    'use strict';

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
