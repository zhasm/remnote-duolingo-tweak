// ==UserScript==
// @name         click infor [remnote]
// @namespace    http://tampermonkey.net/
// @version      1.003-20250928-1050
// @description  Highlights audio controls and buttons, adds customizable
// @author       Me
// @match        https://www.remnote.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=remnote.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// ==/UserScript==

(function () {
    'use strict';

    const DEFAULT_KEYWORDS = ['shuhaige.net', '请点击下一页'];
    const DEFAULT_KEYWORD_CONTAINER = 'p';
    const DEFAULT_ELEMENTS_TODELETE = ['div.tui'];

    // ========================
    const CONFIG = {
        SCAN_INTERVAL: 2000,
        // 2 seconds for spam scan

        FOOTER_CLEAN_INTERVAL: 1800,
        // 1.8 seconds for footer cleanup

        MIN_Z_INDEX: 100,
        // Minimum z-index to consider element suspicious

        ALLOWED_SCRIPT_ORIGINS: ['/', window.location.origin],
    };

    function isSuspiciousOverlay(el) {
        const excludedTags = [
            'script',
            'style',
            'link',
            'meta',
            'title',
            'noscript',
        ];
        if (excludedTags.includes(el.tagName.toLowerCase())) return false;

        const style = window.getComputedStyle(el);
        return (
            style.position === 'fixed' &&
            parseInt(style.zIndex) >= CONFIG.MIN_Z_INDEX
        );
    }

    function scanPage() {
        // Process external scripts

        function __markAndComment(el) {
            if (el.hasAttribute('data-commented')) return;

            el.setAttribute('data-commented', 'true');
            const comment = document.createComment(el.outerHTML);
            el.parentNode?.replaceChild(comment, el);
        }

        document
            .querySelectorAll('script:not([data-commented])')
            .forEach(el => {
                const src = el.getAttribute('src');
                if (
                    src &&
                    !CONFIG.ALLOWED_SCRIPT_ORIGINS.some(origin =>
                        src.startsWith(origin)
                    )
                ) {
                    __markAndComment(el);
                }
            });

        // Process suspicious overlay elements

        document.querySelectorAll('*:not([data-commented])').forEach(el => {
            if (isSuspiciousOverlay(el)) __markAndComment(el);
        });
    }

    function deleteParagraphsContainingKeywords(
        container = DEFAULT_KEYWORD_CONTAINER,
        keywords = DEFAULT_KEYWORDS
    ) {
        const elements = document.querySelectorAll(container);

        elements.forEach(element => {
            // Use some() to stop at first match
            const shouldRemove = keywords.some(keyword =>
                element.textContent.includes(keyword)
            );

            if (shouldRemove) {
                element.remove();
            }
        });
    }

    // ========================
    // Function to delete specific elements
    // ========================
    function deleteElements(elementsToDelete = DEFAULT_ELEMENTS_TODELETE) {
        elementsToDelete.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => element.remove());
        });
    }

    // ========================
    // Monitor Dynamic Elements
    // ========================
    function monitorDynamicElements() {
        const observer = new MutationObserver(() => {
            deleteElements(); // Call deleteElements whenever there's a change
        });

        // Configure the observer to watch for child nodes being added or removed
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    function enableMouseSelection() {
        // Get the body element
        const body = document.body;

        // Enable user selection
        body.style.userSelect = 'text'; // For most browsers
        body.style.webkitUserSelect = 'text'; // For Safari
        body.style.mozUserSelect = 'text'; // For Firefox
        body.style.msUserSelect = 'text'; // For Internet Explorer

        // Optionally, reset CSS class that might disable selection
        body.classList.remove('no-selection'); // Remove any custom no-selection class if applied
    }

    const PAGING_ELEMENTS = ['div.pager a'];
    const PAGING_TXT_PREV = ['上一页', '上一章'];
    const PAGING_TXT_NEXT = ['下一页', '下一章'];

    function Paging() {
        document.addEventListener('keydown', function (event) {
            let targetText;
            if (event.key === 'ArrowLeft') {
                targetText = PAGING_TXT_PREV;
            } else if (event.key === 'ArrowRight') {
                targetText = PAGING_TXT_NEXT;
            } else {
                return;
            }

            for (const selector of PAGING_ELEMENTS) {
                const elements = document.querySelectorAll(selector);
                for (const el of elements) {
                    if (targetText.includes(el.textContent.trim())) {
                        el.click();
                        return; // Exit after finding and clicking the first match
                    }
                }
            }
        });
    }

    function highlightLastLineOnSpaceScroll() {
        document.addEventListener('keydown', event => {
            const isScrollingDown =
                (event.key === ' ' && !event.shiftKey) ||
                event.key === 'PageDown';
            const isScrollingUp =
                (event.key === ' ' && event.shiftKey) || event.key === 'PageUp';

            if (isScrollingDown || isScrollingUp) {
                let elementToHighlight = null;
                const x = window.innerWidth / 2;

                if (isScrollingDown) {
                    // Scan upwards from the bottom to find the last visible element
                    for (let y = window.innerHeight - 5; y > 0; y -= 15) {
                        const elements = document.elementsFromPoint(x, y);
                        const candidate = elements.find(
                            el =>
                                el.textContent.trim().length > 0 &&
                                el.clientHeight < window.innerHeight * 0.8 &&
                                el.tagName.toLowerCase() !== 'body' &&
                                el.tagName.toLowerCase() !== 'html'
                        );
                        if (candidate) {
                            elementToHighlight = candidate;
                            break;
                        }
                    }
                } else {
                    // isScrollingUp: Scan downwards from the top to find the first visible element
                    for (let y = 5; y < window.innerHeight; y += 15) {
                        const elements = document.elementsFromPoint(x, y);
                        const candidate = elements.find(
                            el =>
                                el.textContent.trim().length > 0 &&
                                el.clientHeight < window.innerHeight * 0.8 &&
                                el.tagName.toLowerCase() !== 'body' &&
                                el.tagName.toLowerCase() !== 'html'
                        );
                        if (candidate) {
                            elementToHighlight = candidate;
                            break;
                        }
                    }
                }

                if (elementToHighlight) {
                    const originalBg = elementToHighlight.style.backgroundColor;
                    const originalTransition =
                        elementToHighlight.style.transition;

                    // Apply highlight with a quick fade-in
                    elementToHighlight.style.transition =
                        'background-color 0.2s ease-in';
                    elementToHighlight.style.backgroundColor =
                        'rgba(255, 255, 0, 0.4)';

                    // Schedule fade-out
                    setTimeout(() => {
                        elementToHighlight.style.transition =
                            'background-color 2s ease-out';
                        elementToHighlight.style.backgroundColor = originalBg;

                        // Clean up transition style after fade-out
                        setTimeout(() => {
                            // Only reset transition if it hasn't been changed by something else
                            if (
                                elementToHighlight.style.transition.includes(
                                    '3s'
                                )
                            ) {
                                elementToHighlight.style.transition =
                                    originalTransition;
                            }
                        }, 3000);
                    }, 500); // Start fade-out after 500ms
                }

                // After the default scroll, adjust the view
                setTimeout(() => {
                    if (isScrollingDown) {
                        window.scrollBy(0, -40); // Scroll up
                    } else {
                        window.scrollBy(0, 40); // Scroll down
                    }
                }, 50);
            }
        });
    }

    function initialize() {
        // Inject styles first
        // Delete specified elements
        deleteElements();
        monitorDynamicElements();
        deleteParagraphsContainingKeywords();
        scanPage();
        enableMouseSelection();
        Paging();
        highlightLastLineOnSpaceScroll();
    }

    // ========================
    // Execution
    // ========================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
