// ==UserScript==
// @name         Polish Dictionary Lookup [e-polish]
// @namespace    http://tampermonkey.net/
// @version      2.002-20261106-0927
// @description  Looks up the word from ?q= and opens the grammar tab
// @author       Me
// @match        https://e-polish.eu/en/polish-dictionary/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=e-polish.eu
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  var SEARCH_INPUT = 'form.epolish-dictionary.epolish-dictionary-search input[name="search"]';
  var GRAMMAR_TAB = 'div.epolish-dictionary-results li[data-name="grammar"]';
  var MAX_ATTEMPTS = 50;
  var RESULT_ATTEMPTS = 80;
  var RETRY_MS = 100;

  function readQueryWord() {
    var word = new URLSearchParams(window.location.search).get('q');
    if (!word) {
      return '';
    }
    return word.trim();
  }

  function lookupWord(word) {
    var attempts = 0;

    function tryOnce() {
      var input;
      var event;
      var handled;

      attempts += 1;
      input = document.querySelector(SEARCH_INPUT);
      if (!input || !input.form) {
        if (attempts < MAX_ATTEMPTS) {
          setTimeout(tryOnce, RETRY_MS);
          return;
        }
        console.warn('[APH-MK] dictionary search input not found');
        return;
      }

      input.value = word;
      event = new Event('submit', { bubbles: true, cancelable: true });
      handled = !input.form.dispatchEvent(event);
      if (handled) {
        console.log('[APH-MK] looked up:', word);
        activateGrammarTab();
        return;
      }

      if (attempts < MAX_ATTEMPTS) {
        setTimeout(tryOnce, RETRY_MS);
        return;
      }
      console.warn('[APH-MK] dictionary form did not handle the search');
    }

    tryOnce();
  }

  function activateGrammarTab() {
    var attempts = 0;

    function tryOnce() {
      var tab;

      attempts += 1;
      tab = document.querySelector(GRAMMAR_TAB);
      if (!tab) {
        if (attempts < RESULT_ATTEMPTS) {
          setTimeout(tryOnce, RETRY_MS);
          return;
        }
        console.warn('[APH-MK] grammar tab not found');
        return;
      }

      if (!tab.classList.contains('active')) {
        tab.click();
      }
      if (tab.classList.contains('active')) {
        console.log('[APH-MK] grammar tab activated');
        return;
      }

      if (attempts < RESULT_ATTEMPTS) {
        setTimeout(tryOnce, RETRY_MS);
        return;
      }
      console.warn('[APH-MK] grammar tab did not activate');
    }

    tryOnce();
  }

  var word = readQueryWord();
  if (!word) {
    return;
  }
  lookupWord(word);
})();
