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

    // CSS styles to be injected

    const MY_CSS = `
        .info-text {
            display: none; /* Hide the additional text by default */
            color: gray; /* Optional: Change the color of the additional text */
        }

        .info-icon {
            cursor: pointer; /* Change cursor to pointer on hover */
            color: blue; /* Optional: Change the color of the icon */
            margin-left: 3px;
            user-select: none;
        }

        .info-processed {
            /* Mark processed elements to avoid reprocessing */
        }
    `;

    if (typeof GM_addStyle !== 'undefined') {
        GM_addStyle(MY_CSS);
    } else {
        // Create a <style> element and append it to the document head
        const style = document.createElement('style');
        style.textContent = MY_CSS;
        document.head.appendChild(style);
    }

    function toggleInfo(event) {
        event.stopPropagation(); // Prevent event bubbling
        event.preventDefault(); // Prevent default behavior

        const icon = event.target;

        if (icon.originalSpansData) {
            if (icon.isExpanded) {
                // Collapse: Hide the detailed content, show only the icon
                icon.originalSpansData.forEach((spanData, index) => {
                    if (index === 0) {
                        // First span: restore text before parenthesis + keep icon
                        const openSpanText = spanData.span.textContent || '';
                        const textBeforeParen = openSpanText.substring(0, openSpanText.indexOf('('));
                        spanData.span.innerHTML = textBeforeParen;
                        spanData.span.appendChild(icon); // Keep the icon
                    } else {
                        // Hide other spans
                        spanData.span.style.display = 'none';
                    }
                });
                icon.isExpanded = false;
            } else {
                // Expand: Show the full content with parentheses
                icon.originalSpansData.forEach((spanData, index) => {
                    spanData.span.innerHTML = spanData.originalHTML;
                    spanData.span.style.display = spanData.originalDisplay;
                });
                icon.isExpanded = true;
            }
        } else {
            // Fallback for simple case
            const infoText = event.target.nextElementSibling;
            if (infoText && infoText.classList.contains('info-text')) {
                if (infoText.style.display === 'none' || !infoText.style.display) {
                    infoText.style.display = 'inline'; // Show the text
                } else {
                    infoText.style.display = 'none'; // Hide the text
                }
            }
        }
    }

    function addInfoIcons() {
        // Find all RichTextViewer containers that haven't been processed
        const containers = document.querySelectorAll('.RichTextViewer:not(.info-container-processed)');
        console.debug('[RemNote Script] addInfoIcons called, containers found:', containers.length);

        containers.forEach(container => {
            // Mark container as processed
            container.classList.add('info-container-processed');

            // Get all linear-editor-item spans within this container
            const spans = Array.from(container.querySelectorAll('span.linear-editor-item'));
            console.debug('[RemNote Script] container spans count:', spans.length, 'container:', container);
            if (spans.length === 0) return;

            // Find parentheses by looking at the actual spans and their content
            let openParenIndex = -1;
            let closeParenIndex = -1;

            // Look for opening parenthesis
            for (let i = 0; i < spans.length; i++) {
                const span = spans[i];
                const textContent = span.textContent || '';

                // Check if this span contains an opening parenthesis
                if (textContent.includes('(')) {
                    openParenIndex = i;
                    break;
                }
            }

            // If we found an opening parenthesis, look for the closing one
            if (openParenIndex !== -1) {
                for (let i = openParenIndex; i < spans.length; i++) {
                    const span = spans[i];
                    const textContent = span.textContent || '';

                    // Check if this span contains a closing parenthesis
                    if (textContent.includes(')')) {
                        closeParenIndex = i;
                        break;
                    }
                }
            }

            // If we found both parentheses, process them
            if (openParenIndex !== -1 && closeParenIndex !== -1 && closeParenIndex > openParenIndex) {
                const openParenSpan = spans[openParenIndex];
                const closeParenSpan = spans[closeParenIndex];

                // Get all spans between and including the parentheses
                const spansBetween = spans.slice(openParenIndex, closeParenIndex + 1);

                // Extract content for tooltip (text only, no HTML)
                let contentText = '';
                for (let i = openParenIndex; i <= closeParenIndex; i++) {
                    const spanText = spans[i].textContent || '';
                    contentText += spanText;
                }

                // Remove the parentheses from the content text for tooltip
                contentText = contentText.replace(/^\(/, '').replace(/\)$/, '').trim();

                // Create the info icon
                const infoIcon = document.createElement('span');
                infoIcon.className = 'info-icon';
                infoIcon.innerHTML = 'ℹ️';
                infoIcon.title = contentText ? `Click to toggle: ${contentText}` : 'Click to toggle content';
                infoIcon.onclick = toggleInfo;

                // Store original spans data for toggling
                const originalSpansData = [];
                spansBetween.forEach(span => {
                    originalSpansData.push({
                        span: span,
                        originalHTML: span.innerHTML,
                        originalDisplay: span.style.display || ''
                    });
                });

                // Clear the opening parenthesis span and add the icon
                const openSpanText = openParenSpan.textContent || '';
                const textBeforeParen = openSpanText.substring(0, openSpanText.indexOf('('));

                openParenSpan.innerHTML = textBeforeParen;
                openParenSpan.appendChild(infoIcon);

                // Hide all spans that contain parentheses content
                spansBetween.forEach((span, index) => {
                    if (index === 0) {
                        // For the first span, we already handled it above
                        return;
                    }
                    span.style.display = 'none';
                    span.classList.add('parentheses-content-hidden');
                });

                // Store data for toggle function
                infoIcon.originalSpansData = originalSpansData;
                infoIcon.isExpanded = false;
            }
        });
    }

    const targetSelector = '.RichTextViewer'; // Changed to target the container
    let isProcessing = false; // Prevent concurrent processing

    // Debounce function to prevent excessive calls
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Debounced version of addInfoIcons
    const debouncedAddInfoIcons = debounce(() => {
        if (!isProcessing) {
            isProcessing = true;
            try {
                addInfoIcons(); // No longer needs selector parameter
            } catch (error) {
                console.error('[RemNote Script] Error processing elements:', error);
            } finally {
                isProcessing = false;
            }
        }
    }, 500); // Wait 500ms after last change

    // Monitor for dynamic changes with more specific configuration
    const observer = new MutationObserver((mutations) => {
        let shouldProcess = false;

        mutations.forEach(mutation => {
            // Only process if nodes were added and they might contain our target elements
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (let node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the added node or its children match our selector
                        if (node.matches && node.matches(targetSelector)) {
                            shouldProcess = true;
                            break;
                        } else if (node.querySelector && node.querySelector(targetSelector)) {
                            shouldProcess = true;
                            break;
                        }
                    }
                }
            }
        });

        if (shouldProcess) {
            debouncedAddInfoIcons();
        }
    });

    // Start observing with more specific options to reduce overhead
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false, // Don't observe attribute changes
        characterData: false // Don't observe text changes
    });

    // Wait for page to load before initial processing
    function initialize() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => {
                    console.log("[RemNote Script] Initial processing");
                    addInfoIcons(); // No longer needs selector parameter
                }, 2000); // Increased delay for RemNote to fully load
            });
        } else {
            setTimeout(() => {
                console.log("[RemNote Script] Initial processing");
                addInfoIcons(); // No longer needs selector parameter
            }, 2000);
        }
    }

    initialize();

    // Hotkey: Ctrl/Cmd + I -> click last .info-icon
    // Keep handler small, testable and removable on unload
    function _isEditableElement(el) {
        if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
        const tag = el.tagName;
        if (!tag) return false;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
        if (el.isContentEditable) return true;
        return false;
    }

    function _clickLastInfoIcon() {
        const icons = document.querySelectorAll('.info-icon');
        if (!icons || icons.length === 0) return false;
        const last = icons[icons.length - 1];
        last.click();
        return true;
    }

    function _onHotkey(e) {
        // Only respond to Ctrl/Cmd+I (case-insensitive)
        if (!(e.ctrlKey || e.metaKey)) return;
        if (!e.key || e.key.toLowerCase() !== 'i') return;
        // Ignore when typing in inputs or contenteditable areas
        if (_isEditableElement(e.target)) return;
        e.preventDefault();
        try {
            const clicked = _clickLastInfoIcon();
            if (clicked) console.log('[RemNote Script] Ctrl/Cmd+I — clicked last .info-icon');
            else console.log('[RemNote Script] Ctrl/Cmd+I — no .info-icon found');
        } catch (err) {
            console.warn('[RemNote Script] Ctrl/Cmd+I click failed', err);
        }
    }

    document.addEventListener('keydown', _onHotkey, false);

    // Add cleanup when page unloads
    window.addEventListener('beforeunload', () => {
        if (observer) {
            observer.disconnect();
        }
        // remove hotkey listener
        document.removeEventListener('keydown', _onHotkey, false);
    });
})();
