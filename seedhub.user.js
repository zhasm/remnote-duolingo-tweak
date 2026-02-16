// ==UserScript==
// @name         Access Pan Link
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Get the panLink variable from the site's script
// @match       https://www.seedhub.cc/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Wait for the panLink to be defined
    const checkPanLink = setInterval(() => {
        if (typeof panLink !== 'undefined') {
            clearInterval(checkPanLink); // Stop checking once we have the variable
            appendAnchorTag(panLink);
        }
    }, 100); // Check every 100 ms

    const appendAnchorTag = (link) => {
        const tipElement = document.querySelector('p.tqm1-tip');
        if (tipElement) {
            const anchor = document.createElement('a');
            anchor.href = link;
            anchor.target = '_blank';
            anchor.textContent = 'Click here'; // Link text
            tipElement.appendChild(anchor);
        }
    };
})();
