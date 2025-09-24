// ==UserScript==
// @name         click infor [remnote]
// @namespace    http://tampermonkey.net/
// @version      1.002-20250922
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
        const style = document.createElement('style');
        style.textContent = MY_CSS;
        document.head.appendChild(style);
    }

    function toggleInfo(event) {
        event.stopPropagation(); // Prevent event bubbling
        event.preventDefault(); // Prevent default behavior

        const icon = event.target;

        if (icon.toggleSpans && icon.originalSpans) {
            // Toggle visibility of hidden spans vs original spans
            const isVisible = icon.toggleSpans[0].style.display !== 'none';

            if (isVisible) {
                // Hide the detailed content, show the icon only
                icon.toggleSpans.forEach(span => {
                    span.style.display = 'none';
                });
                icon.originalSpans.forEach(span => {
                    span.style.display = 'none';
                });
            } else {
                // Show the detailed content, hide the icon
                icon.toggleSpans.forEach(span => {
                    span.style.display = 'inline';
                });
                icon.originalSpans.forEach(span => {
                    span.style.display = 'inline';
                });
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

        containers.forEach(container => {
            // Mark container as processed
            container.classList.add('info-container-processed');

            // Get all linear-editor-item spans within this container
            const spans = container.querySelectorAll('span.linear-editor-item');
            if (spans.length === 0) return;

            // Extract text content from all spans to find parentheses
            let fullText = '';
            let spanMap = []; // Map characters to their corresponding spans

            spans.forEach(span => {
                const textContent = span.textContent || '';
                const startIndex = fullText.length;
                fullText += textContent;

                // Map each character to its span
                for (let i = 0; i < textContent.length; i++) {
                    spanMap.push({
                        span: span,
                        localIndex: i,
                        globalIndex: startIndex + i
                    });
                }
            });

            // Find parentheses content in the full text
            const regex = /\(([^)]+)\)/g;
            let match;
            const parenthesesRanges = [];

            while ((match = regex.exec(fullText)) !== null) {
                const startIndex = match.index; // Start of '('
                const endIndex = match.index + match[0].length - 1; // End of ')'
                const content = match[1]; // Content between parentheses

                parenthesesRanges.push({
                    start: startIndex,
                    end: endIndex,
                    content: content,
                    fullMatch: match[0]
                });
            }

            // Process each parentheses range
            parenthesesRanges.reverse().forEach(range => {
                // Find the spans that contain the opening and closing parentheses
                const openParenSpan = spanMap[range.start]?.span;
                const closeParenSpan = spanMap[range.end]?.span;

                if (!openParenSpan || !closeParenSpan) return;

                // Find all spans between and including the parentheses
                const spansBetween = [];
                let foundStart = false;

                spans.forEach(span => {
                    if (span === openParenSpan) {
                        foundStart = true;
                    }
                    if (foundStart) {
                        spansBetween.push(span);
                    }
                    if (span === closeParenSpan) {
                        foundStart = false;
                    }
                });

                if (spansBetween.length === 0) return;

                // Create the info icon and hidden text
                const infoIcon = document.createElement('span');
                infoIcon.className = 'info-icon';
                infoIcon.innerHTML = 'ℹ️';
                infoIcon.title = `Click to toggle: ${range.content}`;
                infoIcon.onclick = toggleInfo;

                const hiddenSpans = [];

                // Hide all spans that contain parentheses content and store them
                spansBetween.forEach((span, index) => {
                    const spanClone = span.cloneNode(true);
                    spanClone.classList.add('info-text');
                    spanClone.style.display = 'none';
                    hiddenSpans.push(spanClone);

                    // For the first span (contains opening parenthesis), replace with icon
                    if (index === 0 && span === openParenSpan) {
                        // Clear the span content and add the icon
                        span.innerHTML = '';
                        span.appendChild(infoIcon);

                        // Add all hidden spans after the icon
                        hiddenSpans.forEach(hiddenSpan => {
                            span.appendChild(hiddenSpan);
                        });
                    } else if (span !== openParenSpan) {
                        // Hide other spans in the range
                        span.style.display = 'none';
                        span.classList.add('parentheses-content-hidden');
                    }
                });

                // Update the toggle function to handle multiple spans
                infoIcon.toggleSpans = hiddenSpans;
                infoIcon.originalSpans = spansBetween.filter(s => s !== openParenSpan);
            });
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
    }, 300); // Wait 500ms after last change

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

    // Add cleanup when page unloads
    window.addEventListener('beforeunload', () => {
        if (observer) {
            observer.disconnect();
        }
    });
})();