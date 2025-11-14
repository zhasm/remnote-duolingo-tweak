// ==UserScript==
// @name         Novel Paing
// @namespace    http://tampermonkey.net/
// @version      1.002-20251114-1457
// @description  Highlights audio controls and buttons, adds customizable
// @author       Me
// @match        https://m.shuhaige.net/*
// @match        https://www.69shuba.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// ==/UserScript==
// 1.002-20251114-1457:
// +fn: RemoveKeywordsInElements

(function () {
    'use strict';

    const DEFAULT_KEYWORDS = ['shuhaige.net', '请点击下一页'];
    const DEFAULT_KEYWORD_CONTAINER = 'p';
    const DEFAULT_ELEMENTS_TODELETE = [
        'div.tui',
        'div.foot',
        'div#tuijian',
        'div.bottom-ad2',
        'div#baocuo',
        'div.yuedutuijian',
    ];

    const PAGING_ELEMENTS = ['div.pager a', 'div.page1 a'];
    const PAGING_TXT_PREV = ['上一页', '上一章'];
    const PAGING_TXT_NEXT = ['下一页', '下一章'];

    //function RemoveKeywordsInElements(
    const CERTAIN_KEYWORDS_TO_DELETE = [/[（(]?(本章完|求月票)[)）]?/];
    const CERTAIN_ELEMENTS_TO_SCAN = ['div.txtnav']; // CSS selectors, e.g. ['p','.content']

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

    let loadingOverlay = null;

    function prepareLoadingIndicator() {
        loadingOverlay = document.createElement('div');
        loadingOverlay.style.position = 'fixed';
        loadingOverlay.style.top = '0';
        loadingOverlay.style.left = '0';
        loadingOverlay.style.width = '100%';
        loadingOverlay.style.height = '100%';
        loadingOverlay.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        loadingOverlay.style.zIndex = '10000';
        loadingOverlay.style.display = 'flex';
        loadingOverlay.style.justifyContent = 'center';
        loadingOverlay.style.alignItems = 'center';

        const loadingGif = document.createElement('img');
        loadingGif.src =
            'https://s3-img.meituan.net/v1/mss_3d027b52ec5a4d589e68050845611e68/ff/n0/0p/6s/ms_242013.gif';
        loadingGif.style.maxWidth = '100px';
        loadingGif.style.maxHeight = '100px';

        loadingOverlay.appendChild(loadingGif);
    }

    function showLoadingIndicator() {
        if (loadingOverlay) {
            document.body.appendChild(loadingOverlay);
        }
    }

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
                        showLoadingIndicator();
                        // Click after a short delay to allow the indicator to appear
                        setTimeout(() => el.click(), 50);

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
                let textNodeToHighlight = null;
                let bestDistance = Infinity;

                const allTextNodes = [];
                const walk = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );
                let node;
                while ((node = walk.nextNode())) {
                    if (node.textContent.trim().length > 0) {
                        allTextNodes.push(node);
                    }
                }

                const viewportTop = window.scrollY;
                const viewportBottom = window.scrollY + window.innerHeight;

                for (const textNode of allTextNodes) {
                    const range = document.createRange();
                    range.selectNodeContents(textNode);
                    const rects = range.getClientRects();

                    for (const rect of rects) {
                        // Check if the rect is within the viewport
                        const isVisible =
                            rect.bottom > 0 &&
                            rect.top < window.innerHeight &&
                            rect.width > 0 &&
                            rect.height > 0;

                        if (isVisible) {
                            if (isScrollingDown) {
                                // Find the lowest visible line
                                const distance = viewportBottom - rect.bottom;
                                if (distance >= 0 && distance < bestDistance) {
                                    bestDistance = distance;
                                    textNodeToHighlight = textNode;
                                }
                            } else {
                                // isScrollingUp: Find the highest visible line
                                const distance = rect.top - viewportTop;
                                if (distance >= 0 && distance < bestDistance) {
                                    bestDistance = distance;
                                    textNodeToHighlight = textNode;
                                }
                            }
                        }
                    }
                }

                if (textNodeToHighlight) {
                    const range = document.createRange();
                    range.selectNodeContents(textNodeToHighlight);
                    const rects = range.getClientRects();

                    if (rects.length > 0) {
                        const rect = rects[0];
                        const highlightMarker = document.createElement('div');
                        highlightMarker.style.position = 'absolute';
                        highlightMarker.style.left = `${
                            rect.left + window.scrollX
                        }px`;
                        highlightMarker.style.top = `${
                            rect.top + window.scrollY
                        }px`;
                        highlightMarker.style.width = `${rect.width}px`;
                        highlightMarker.style.height = `${rect.height}px`;
                        highlightMarker.style.backgroundColor =
                            'rgba(255, 255, 0, 0.4)';
                        highlightMarker.style.zIndex = '9999';
                        highlightMarker.style.pointerEvents = 'none';
                        highlightMarker.style.transition =
                            'opacity 2s ease-out 0.5s';

                        document.body.appendChild(highlightMarker);

                        // Trigger fade-out
                        setTimeout(() => {
                            highlightMarker.style.opacity = '0';
                        }, 500);

                        // Remove from DOM after transition
                        setTimeout(() => {
                            highlightMarker.remove();
                        }, 2500);
                    }
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

    // Add near top with other defaults
    // const CERTAIN_KEYWORDS_TO_DELETE = ['（求月票）'];
    // const CERTAIN_ELEMENTS_TO_SCAN = ['div.txtnav']; // CSS selectors, e.g. ['p','.content']

    function RemoveKeywordsInElements(
        selectors = CERTAIN_ELEMENTS_TO_SCAN,
        keywords = CERTAIN_KEYWORDS_TO_DELETE
    ) {
        if (!selectors?.length || !keywords?.length) {
            console.log('RemoveKeywordsInElements: nothing to do.');
            return;
        }

        // Build combined regex parts and decide flags:
        const parts = [];
        let globalFlags = 'g';
        let caseInsensitive = false;
        for (const k of keywords) {
            if (k instanceof RegExp) {
                parts.push(k.source);
                if (k.flags.includes('i')) caseInsensitive = true;
            } else {
                parts.push(String(k).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
            }
        }
        if (caseInsensitive) globalFlags += 'i';
        const combinedRe = new RegExp(parts.join('|'), globalFlags);

        const stats = {
            scannedElements: 0,
            changedTextNodes: 0,
            removedParents: 0,
            keywordCounts: keywords.map(k => ({ key: k, count: 0 })),
        };

        const incCountForMatch = matched => {
            // find which keyword/regex matched and increment corresponding counter
            for (let i = 0; i < keywords.length; i++) {
                const k = keywords[i];
                if (k instanceof RegExp) {
                    // test with full-match of the matched substring against that regex
                    if (
                        new RegExp(
                            `^(?:${k.source})$`,
                            k.flags.replace('g', '')
                        )
                    ) {
                        try {
                            if (k.test(matched)) {
                                stats.keywordCounts[i].count++;
                                return;
                            }
                        } finally {
                            // reset lastIndex for safety if regex is global
                            if (k.global) k.lastIndex = 0;
                        }
                    }
                } else {
                    if (String(k).toLowerCase() === matched.toLowerCase()) {
                        stats.keywordCounts[i].count++;
                        return;
                    }
                }
            }
            // fallback: increment first (shouldn't normally happen)
            stats.keywordCounts[0].count++;
        };

        selectors.forEach(sel => {
            const roots = Array.from(document.querySelectorAll(sel));
            stats.scannedElements += roots.length;

            roots.forEach(root => {
                const walker = document.createTreeWalker(
                    root,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );
                const parentsToRemove = new Set();
                let node;
                while ((node = walker.nextNode())) {
                    const original = node.nodeValue;
                    if (!original || !original.trim()) continue;

                    // Count matches
                    const rx = new RegExp(combinedRe.source, combinedRe.flags);
                    let match;
                    let found = false;
                    while ((match = rx.exec(original)) !== null) {
                        found = true;
                        const matchedText = match[0];
                        incCountForMatch(matchedText);
                        // avoid infinite loop with zero-length matches
                        if (match[0].length === 0) rx.lastIndex++;
                    }

                    if (!found) {
                        // check exact-trim full-node equality for string keywords
                        const trimmed = original.trim();
                        const exactIndex = keywords.findIndex(
                            k => !(k instanceof RegExp) && String(k) === trimmed
                        );
                        if (exactIndex !== -1) {
                            const parent = node.parentElement;
                            if (
                                parent &&
                                parent.textContent.trim() === trimmed
                            ) {
                                parentsToRemove.add(parent);
                                stats.keywordCounts[exactIndex].count++;
                                continue;
                            }
                            // else fall through to replace below
                        } else {
                            continue;
                        }
                    }

                    // Remove matches from text node
                    const modified = original.replace(combinedRe, '');
                    if (modified !== original) {
                        node.nodeValue = modified;
                        stats.changedTextNodes += 1;
                    }
                }

                parentsToRemove.forEach(el => {
                    el.remove();
                    stats.removedParents += 1;
                });
            });
        });

        // Format keywordCounts for logging
        const counts = {};
        stats.keywordCounts.forEach(k => {
            counts[String(k.key)] = k.count;
        });

        console.log('RemoveKeywordsInElements: results:', {
            scannedElements: stats.scannedElements,
            changedTextNodes: stats.changedTextNodes,
            removedParents: stats.removedParents,
            keywordCounts: counts,
        });
    }

    function initialize() {
        // Inject styles first
        // Delete specified elements
        deleteElements();
        monitorDynamicElements();
        deleteParagraphsContainingKeywords();
        RemoveKeywordsInElements();
        scanPage();
        enableMouseSelection();
        prepareLoadingIndicator();
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
