// ==UserScript==
// @name         本地音频重定向 [remnote]
// @namespace    http://tampermonkey.net/
// @version      1.001-20250919-0753
// @description  Highlights audio controls and buttons, adds customizable
// @author       Me
// @match        https://www.remnote.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=remnote.com
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @connect      127.0.0.1
// ==/UserScript==
// 20250825-0902: add Ctrl+I to press ignore button

(function () {
    'use strict';
    //console.log('本地音频重定向 [remnote] loaded');
    const LOCAL_SERVER = "https://127.0.0.1:9999";
    const ENABLE_LOCAL = true; // 全局开关

    function checkLocalAudio(filename, callback) {
        if (!ENABLE_LOCAL) {
            console.log("[checkLocalAudio] 本地加载已禁用");
            callback(false);
            return;
        }

        const url = `${LOCAL_SERVER}/${filename}`;
        console.log(`[checkLocalAudio] 尝试HEAD请求本地音频: ${url}`);

        GM_xmlhttpRequest({
            method: "HEAD",
            url: url,
            timeout: 2000,
            onload: function (response) {
                console.log(`[checkLocalAudio] HEAD请求成功，状态码: ${response.status}，文件: ${filename}`);
                callback(response.status === 200);
            },
            onerror: function (err) {
                console.error(`[checkLocalAudio] 请求错误: ${err}, 文件: ${filename}`);
                callback(false);
            },
            ontimeout: function () {
                console.warn(`[checkLocalAudio] 请求超时，文件: ${filename}`);
                callback(false);
            }
        });
    }

    function replaceAudioSources() {
        const audioElements = document.querySelectorAll('audio[src]');
        // console.log(`[replaceAudioSources] 找到 ${audioElements.length} 个 audio 元素`);

        audioElements.forEach(audio => {
            // If already replaced by local, skip
            if (audio.dataset.localReplaced === 'true') {
                console.log('[replaceAudioSources] 已替换为本地，跳过:', audio.src);
                return;
            }

            const originalSrc = audio.dataset.originalSrc || audio.src;
            const filename = originalSrc.split('/').pop();

            console.log(`[replaceAudioSources] 检查音频文件: ${filename}`);

            checkLocalAudio(filename, function (localExists) {
                if (localExists) {
                    const localSrc = `${LOCAL_SERVER}/${filename}`;
                    console.log(`[replaceAudioSources] 使用本地音频: ${localSrc}`);

                    // 保存原始源以便回退
                    audio.dataset.originalSrc = originalSrc;

                    // 替换源
                    audio.src = localSrc;
                    audio.dataset.localReplaced = 'true';

                    // 已替换为本地资源（不自动播放）
                    // (Autoplay removed — keep dataset flag for replacement tracking)

                    // 添加错误处理，如果本地加载失败则回退
                    audio.addEventListener('error', function fallback() {
                        console.warn(`[replaceAudioSources] 本地音频加载失败，回退到远程: ${originalSrc}`);
                        // Log error event details and audio element state
                        console.warn('[replaceAudioSources] error event:', arguments[0]);
                        console.warn('[replaceAudioSources] audio element state:', {
                            src: audio.src,
                            networkState: audio.networkState,
                            readyState: audio.readyState,
                            error: audio.error
                        });
                        audio.src = originalSrc;
                        audio.dataset.localReplaced = '';
                        audio.removeEventListener('error', fallback);
                    }, { once: true });
                } else {
                    console.log(`[replaceAudioSources] 本地无此文件，使用远程音频: ${originalSrc}`);
                }
            });
        });
    }

    // 初始替换延迟1000ms，给页面一点加载时间
    setTimeout(() => {
        console.log("[init] 首次替换音频源");
        replaceAudioSources();
    }, 1000);

    // 监听动态添加音频元素，自动尝试替换
    // 简洁版：如果所有 mutation 都发生在 textarea 内，则忽略（typing 触发的噪声）
    const observer = new MutationObserver((mutationRecords) => {
        const allInTextarea = mutationRecords.every(record => {
            if (record.target && record.target.closest && record.target.closest('textarea')) return true;
            if (record.addedNodes && record.addedNodes.length) {
                for (const n of record.addedNodes) {
                    const el = n.nodeType === Node.TEXT_NODE ? n.parentElement : n;
                    if (el && el.closest && el.closest('textarea')) return true;
                }
            }
            return false;
        });

        if (allInTextarea) return;
        console.log("[observer] DOM发生变化，尝试替换音频源");
        replaceAudioSources();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    console.log('本地音频重定向 [remnote] ended');
})();