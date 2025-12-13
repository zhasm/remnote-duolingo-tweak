// ==UserScript==
// @name         WNE English Version
// @namespace    http://tampermonkey.net/
// @version      1.000.1.20251213-0855
// @description  try to take over the world!
// @author       You
// @match        https://elearning.wne.uw.edu.pl/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=edu.pl
// @grant        none
// ==/UserScript==

(function () {
    'use strict';
    console.log('[Language Detector] Functions available via window.languageDetector');
    /**
     * Extract current language from the language dropdown
     * @returns {Object|null} Object with language name and code, or null if not found
     */
    function getCurrentLanguage() {
        // Find the language dropdown toggle element
        const dropdownToggle = document.querySelector('a.dropdown-toggle[aria-controls*="drop-down-menu"]');

        if (!dropdownToggle) {
            console.log('[Language Detector] Language dropdown not found');
            return null;
        }

        // Get the text content and parse it
        const text = dropdownToggle.textContent.trim();
        console.log('[Language Detector] Dropdown text:', text);

        // Parse format: "Language Name ‎(code)‎"
        const match = text.match(/^(.+?)\s+‎\(([a-z]{2})\)‎$/);

        if (!match) {
            console.log('[Language Detector] Could not parse language from text:', text);
            return null;
        }

        const languageName = match[1].trim();
        const languageCode = match[2];

        return {
            name: languageName,
            code: languageCode,
            rawText: text
        };
    }

    /**
     * Get all available languages from the dropdown menu
     * @returns {Array} Array of language objects
     */
    function getAvailableLanguages() {
        const dropdownMenu = document.querySelector('div.dropdown-menu[id*="drop-down-menu"]');

        if (!dropdownMenu) {
            console.log('[Language Detector] Language dropdown menu not found');
            return [];
        }

        const languages = [];
        const links = dropdownMenu.querySelectorAll('a.dropdown-item');

        links.forEach(link => {
            const text = link.textContent.trim();
            const href = link.getAttribute('href');
            const match = text.match(/^(.+?)\s+‎\(([a-z]{2})\)‎$/);

            if (match) {
                languages.push({
                    name: match[1].trim(),
                    code: match[2],
                    href: href,
                    rawText: text
                });
            }
        });

        return languages;
    }

    /**
     * Change language by language code
     * @param {string} code - Language code (e.g., 'en', 'pl')
     * @returns {boolean} True if successful, false otherwise
     */
    function changeLanguage(code) {
        const languages = getAvailableLanguages();
        const targetLanguage = languages.find(lang => lang.code === code);

        if (!targetLanguage) {
            console.log(`[Language Detector] Language code '${code}' not found`);
            return false;
        }

        if (targetLanguage.href) {
            console.log(`[Language Detector] Changing language to ${targetLanguage.name} (${code})`);
            window.location.href = targetLanguage.href;
            return true;
        }

        return false;
    }

    // Main execution
    console.log('=== Language Detector ===');

    const currentLanguage = getCurrentLanguage();
    if (currentLanguage) {
        console.log(`[Language Detector] Current language: ${currentLanguage.name} (${currentLanguage.code})`);
    }

    const availableLanguages = getAvailableLanguages();
    console.log('[Language Detector] Available languages:', availableLanguages);

    // Expose functions to window for manual control via console
    window.languageDetector = {
        getCurrentLanguage: getCurrentLanguage,
        getAvailableLanguages: getAvailableLanguages,
        changeLanguage: changeLanguage
    };

    /**
     * Ensure English version is active by checking periodically
     */
    function ensureEnglishVersion() {
        var current_lang = getCurrentLanguage();
        if (current_lang && current_lang.code != 'en') {
            console.log('[Language Detector] Switching to English version...');
            window.languageDetector.changeLanguage('en');
        }
    }

    const checkIntervalSecs = 5; // Check every 5 seconds
    // Run immediately
    ensureEnglishVersion();

    // Run periodically
    setInterval(ensureEnglishVersion, checkIntervalSecs * 1000);

    console.log('[Language Detector] Functions available via window.languageDetector');
    console.log('  - getCurrentLanguage()');
    console.log('  - getAvailableLanguages()');
    console.log('  - changeLanguage(code)');
    console.log(`[Language Detector] Checking English version every ${checkIntervalSecs} seconds`);
})();