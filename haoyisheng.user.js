// ==UserScript==
// @name         Haoyisheng CME auto resume replaybtn
// @namespace    haoyisheng
// @version      1.7
// @description  Every 5s: resume if paused and under 100%; at 100% play the next playlist item after .active.
// @author       rex
// @match        *://www.cmechina.net/*
// @match        *://cmechina.net/*
// @match        *://*.cmechina.net/*
// @match        *://www.haoyisheng.com/*
// @match        *://*.haoyisheng.com/*
// @match        *://p.bokecc.com/*
// @match        *://*.bokecc.com/*
// @include      *cmechina.net*
// @include      *haoyisheng.com*
// @include      *bokecc.com*
// @grant        unsafeWindow
// @run-at       document-idle
// @all-frames   true
// ==/UserScript==

(function () {
    'use strict';

    var DEBUG = false;
    var CHECK_MS = 5000;
    var CLICK_COOLDOWN_MS = 4000;
    var NEXT_COOLDOWN_MS = 15000;
    var COMPLETE_PCT = 99.5;
    var LOG_PREFIX = '[cme-auto-resume]';
    var pageWindow = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;

    function log() {
        if (!DEBUG) {
            return;
        }
        var args = [LOG_PREFIX];
        var i;
        for (i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }
        try {
            console.log.apply(console, args);
        } catch (err) {}
    }

    function unwrap(obj) {
        if (!obj) {
            return obj;
        }
        try {
            if (obj.wrappedJSObject) {
                return obj.wrappedJSObject;
            }
        } catch (err) {}
        return obj;
    }

    function docHref(doc) {
        try {
            return doc.location && doc.location.href ? doc.location.href : '';
        } catch (err) {
            return '(no href)';
        }
    }

    function collectDocs(doc, out) {
        if (!doc) {
            return;
        }
        doc = unwrap(doc);
        var n;
        for (n = 0; n < out.length; n++) {
            if (out[n] === doc) {
                return;
            }
        }
        out.push(doc);
        walkFrameTags(doc, 'iframe', out);
        walkFrameTags(doc, 'frame', out);
    }

    function walkFrameTags(doc, tagName, out) {
        var nodes;
        try {
            nodes = doc.getElementsByTagName(tagName);
        } catch (err) {
            log('walkFrameTags getElementsByTagName failed', tagName, err);
            return;
        }
        var i;
        for (i = 0; i < nodes.length; i++) {
            var frameEl = unwrap(nodes[i]);
            var src = '';
            try {
                src = frameEl.src || '';
            } catch (errSrc) {}
            var childDoc = null;
            try {
                childDoc = frameEl.contentDocument;
            } catch (err1) {
                childDoc = null;
            }
            if (!childDoc) {
                try {
                    var cw = frameEl.contentWindow;
                    if (cw) {
                        childDoc = cw.document;
                    }
                } catch (err2) {
                    childDoc = null;
                }
            }
            if (childDoc) {
                collectDocs(childDoc, out);
            } else {
                log('iframe not readable', src || tagName);
            }
        }
    }

    function styleInfo(el) {
        if (!el) {
            return 'null';
        }
        var inlineDisplay = el.style ? el.style.display : '';
        var csDisplay = '';
        var csVis = '';
        var csOp = '';
        try {
            var cs = el.ownerDocument.defaultView.getComputedStyle(el, null);
            if (cs) {
                csDisplay = cs.display;
                csVis = cs.visibility;
                csOp = cs.opacity;
            }
        } catch (err) {
            csDisplay = '(getComputedStyle failed)';
        }
        return 'inlineDisplay=' + inlineDisplay + ' computedDisplay=' + csDisplay + ' vis=' + csVis + ' opacity=' + csOp + ' id=' + (el.id || '') + ' class=' + (el.className || '');
    }

    function isShown(el) {
        if (!el) {
            return false;
        }
        if (el.style && el.style.display === 'none') {
            return false;
        }
        if (el.style && el.style.visibility === 'hidden') {
            return false;
        }
        var cs = null;
        try {
            cs = el.ownerDocument.defaultView.getComputedStyle(el, null);
        } catch (err) {
            cs = null;
        }
        if (cs) {
            if (cs.display === 'none' || cs.visibility === 'hidden') {
                return false;
            }
        }
        return true;
    }

    function isShownInTree(el) {
        var cur = el;
        var hops = 0;
        while (cur && hops < 20) {
            if (!isShown(cur)) {
                return false;
            }
            cur = cur.parentElement;
            hops += 1;
        }
        return true;
    }

    function overlayShown(doc, id, className) {
        if (id) {
            var byId = null;
            try {
                byId = doc.getElementById(id);
            } catch (err) {
                byId = null;
            }
            if (byId && isShown(byId)) {
                return byId;
            }
        }
        if (!className) {
            return null;
        }
        var nodes;
        try {
            nodes = doc.getElementsByClassName(className);
        } catch (err2) {
            return null;
        }
        var i;
        for (i = 0; i < nodes.length; i++) {
            if (isShown(nodes[i])) {
                return nodes[i];
            }
        }
        return null;
    }

    function blockingOverlayName(doc) {
        if (!doc) {
            return '';
        }
        if (overlayShown(doc, 'theme_popover_mask', '')) {
            return 'theme_popover_mask';
        }
        if (overlayShown(doc, '', 't_box')) {
            return 't_box';
        }
        return '';
    }

    function pushUnique(arr, el) {
        var i;
        for (i = 0; i < arr.length; i++) {
            if (arr[i] === el) {
                return;
            }
        }
        arr.push(el);
    }

    function collectReplayBtnsFromRoot(root, out) {
        if (!root) {
            return;
        }
        try {
            if (root.getElementById) {
                var byId = root.getElementById('replaybtn');
                if (byId) {
                    pushUnique(out, byId);
                }
            }
        } catch (err) {}
        var nodes = null;
        try {
            nodes = root.getElementsByTagName('*');
        } catch (err2) {
            nodes = null;
        }
        if (!nodes && root.querySelectorAll) {
            try {
                nodes = root.querySelectorAll('*');
            } catch (err3) {
                nodes = null;
            }
        }
        if (!nodes) {
            return;
        }
        var i;
        for (i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (n.id === 'replaybtn') {
                pushUnique(out, n);
            }
            if (n.className && String(n.className).indexOf('ccH5PlayBtn') >= 0 && String(n.className).indexOf('ccH5PlayBtn2') < 0) {
                pushUnique(out, n);
            }
            if (n.shadowRoot) {
                collectReplayBtnsFromRoot(n.shadowRoot, out);
            }
        }
    }

    function findReplayBtns(doc) {
        var out = [];
        collectReplayBtnsFromRoot(doc, out);
        return out;
    }

    function findByIdDeep(root, id) {
        if (!root) {
            return null;
        }
        try {
            if (root.getElementById) {
                var byId = root.getElementById(id);
                if (byId) {
                    return byId;
                }
            }
        } catch (err) {}
        var nodes = null;
        try {
            nodes = root.getElementsByTagName('*');
        } catch (err2) {
            nodes = null;
        }
        if (!nodes) {
            return null;
        }
        var i;
        for (i = 0; i < nodes.length; i++) {
            var n = nodes[i];
            if (n.id === id) {
                return n;
            }
            if (n.shadowRoot) {
                var nested = findByIdDeep(n.shadowRoot, id);
                if (nested) {
                    return nested;
                }
            }
        }
        return null;
    }

    function jumpContinueTarget(el) {
        if (!el) {
            return null;
        }
        var bolds = el.getElementsByTagName('b');
        if (bolds && bolds.length) {
            return bolds[0];
        }
        return el;
    }

    function findJumpContinue(doc) {
        var jump = findByIdDeep(doc, 'ccH5jumpInto');
        if (!jump) {
            return null;
        }
        var box = findByIdDeep(doc, 'ccH5historyTimeBox');
        if (box && !isShownInTree(box)) {
            log('ccH5jumpInto present but history box hidden', styleInfo(box));
            return null;
        }
        if (!isShownInTree(jump)) {
            log('ccH5jumpInto present but hidden', styleInfo(jump));
            return null;
        }
        return jumpContinueTarget(jump);
    }

    function elText(el) {
        var t = '';
        try {
            t = el.textContent || el.innerText || '';
        } catch (err) {}
        return String(t).replace(/^\s+|\s+$/g, '');
    }

    function findQiandaoLink(doc) {
        var warps;
        try {
            warps = doc.getElementsByClassName('xywarp');
        } catch (err) {
            return null;
        }
        var i;
        for (i = 0; i < warps.length; i++) {
            var warp = warps[i];
            if (String(warp.className).indexOf('xywarp2') >= 0) {
                continue;
            }
            if (!isShownInTree(warp)) {
                continue;
            }
            log('found xywarp sign-in dialog', styleInfo(warp));
            var links = warp.getElementsByTagName('a');
            var j;
            for (j = 0; j < links.length; j++) {
                var a = links[j];
                var oc = a.getAttribute('onclick') || '';
                var txt = elText(a);
                if (oc.indexOf('readComplete') >= 0 || txt.indexOf('签到') >= 0) {
                    return a;
                }
            }
        }
        return null;
    }

    function playerState(doc) {
        var videos = [];
        try {
            videos = doc.getElementsByTagName('video');
        } catch (err) {
            videos = [];
        }
        var i;
        var playing = false;
        var stopped = false;
        var endedCount = 0;
        var details = [];
        for (i = 0; i < videos.length; i++) {
            var v = videos[i];
            details.push('paused=' + v.paused + ' ended=' + v.ended + ' t=' + v.currentTime);
            if (!v.paused && !v.ended) {
                playing = true;
            }
            if (v.paused && !v.ended) {
                stopped = true;
            }
            if (v.ended) {
                endedCount += 1;
            }
        }
        return {
            hasVideo: videos.length > 0,
            playing: playing,
            stopped: stopped,
            allEnded: videos.length > 0 && endedCount === videos.length,
            details: details.join('; ')
        };
    }

    function parseClock(text) {
        var s = String(text || '').replace(/^\s+|\s+$/g, '');
        if (!s) {
            return NaN;
        }
        var parts = s.split(':');
        if (parts.length < 2) {
            var n = parseFloat(s);
            return isFinite(n) ? n : NaN;
        }
        var sec = 0;
        var i;
        for (i = 0; i < parts.length; i++) {
            var p = parseFloat(parts[i]);
            if (!isFinite(p)) {
                return NaN;
            }
            sec = sec * 60 + p;
        }
        return sec;
    }

    function firstClassText(doc, className) {
        var nodes;
        try {
            nodes = doc.getElementsByClassName(className);
        } catch (err) {
            return '';
        }
        if (!nodes || !nodes.length) {
            return '';
        }
        return elText(nodes[0]);
    }

    function numOrNaN(v) {
        var n = parseFloat(v);
        return isFinite(n) ? n : NaN;
    }

    function readProgress(doc) {
        var cur = NaN;
        var tot = NaN;
        var videos = [];
        try {
            videos = doc.getElementsByTagName('video');
        } catch (err) {
            videos = [];
        }
        var i;
        for (i = 0; i < videos.length; i++) {
            var v = videos[i];
            var vt = numOrNaN(v.currentTime);
            var vd = numOrNaN(v.duration);
            if (isFinite(vt)) {
                cur = vt;
            }
            if (isFinite(vd) && vd > 0) {
                tot = vd;
            }
        }
        try {
            var win = unwrap(doc.defaultView) || pageWindow;
            var p = win && win.cc_js_Player;
            if (p) {
                if (typeof p.getPosition === 'function') {
                    var pos = numOrNaN(p.getPosition());
                    if (isFinite(pos)) {
                        cur = pos;
                    }
                }
                if (typeof p.getDuration === 'function') {
                    var dur = numOrNaN(p.getDuration());
                    if (isFinite(dur) && dur > 0) {
                        tot = dur;
                    }
                }
            }
        } catch (err2) {}
        if (!isFinite(cur)) {
            cur = parseClock(firstClassText(doc, 'ccH5TimeCurrent'));
        }
        if (!isFinite(tot) || tot <= 0) {
            tot = parseClock(firstClassText(doc, 'ccH5TimeTotal'));
        }
        var pct = NaN;
        if (isFinite(cur) && isFinite(tot) && tot > 0) {
            pct = cur / tot * 100;
            if (pct < 0) {
                pct = 0;
            }
            if (pct > 100) {
                pct = 100;
            }
        }
        return { cur: cur, tot: tot, pct: pct };
    }

    function logProgress(doc) {
        var info = readProgress(doc);
        if (!isFinite(info.pct)) {
            if (isFinite(info.cur)) {
                console.log(LOG_PREFIX, 'progress unknown% current=' + info.cur + 's');
            }
            return;
        }
        var pctText = (Math.round(info.pct * 10) / 10) + '%';
        console.log(
            LOG_PREFIX,
            '✅✅✅ progress ' + pctText,
            Math.round(info.cur) + 's / ' + Math.round(info.tot) + 's'
        );
    }

    function recentlyClicked(el) {
        var mark = el.getAttribute('data-gm-resume-at');
        if (!mark) {
            return false;
        }
        var then = parseInt(mark, 10);
        if (!then) {
            return false;
        }
        return (Date.now() - then) < CLICK_COOLDOWN_MS;
    }

    function tryPlayerApiPlay(win) {
        try {
            var w = unwrap(win) || pageWindow;
            var p = w.cc_js_Player;
            if (p && typeof p.play === 'function') {
                p.play();
                log('called cc_js_Player.play()');
                return true;
            }
        } catch (err) {
            log('cc_js_Player.play failed', err);
        }
        return false;
    }

    function tryReadComplete(win) {
        try {
            var w = unwrap(win) || pageWindow;
            if (typeof w.readComplete === 'function') {
                w.readComplete();
                log('called readComplete()');
                return true;
            }
        } catch (err) {
            log('readComplete() failed', err);
        }
        return false;
    }

    function clickQiandao(el) {
        if (recentlyClicked(el)) {
            log('skip 签到 click, cooldown', styleInfo(el));
            return;
        }
        el.setAttribute('data-gm-resume-at', String(Date.now()));
        log('clicking 签到', styleInfo(el));
        var win = pageWindow;
        try {
            win = el.ownerDocument.defaultView || pageWindow;
        } catch (err) {}
        if (!tryReadComplete(win)) {
            try {
                el.click();
            } catch (err2) {
                log('签到 el.click() failed', err2);
            }
        }
    }

    function clickResume(el, alsoPlay) {
        if (recentlyClicked(el)) {
            log('skip click, cooldown', styleInfo(el));
            return;
        }
        el.setAttribute('data-gm-resume-at', String(Date.now()));
        log('clicking', styleInfo(el));
        try {
            el.click();
        } catch (err) {
            log('el.click() failed', err);
        }
        if (alsoPlay) {
            try {
                var win = el.ownerDocument.defaultView;
                tryPlayerApiPlay(win);
            } catch (err2) {
                tryPlayerApiPlay(pageWindow);
            }
        }
    }

    function ensureProgressBarCss(doc) {
        if (!doc) {
            return;
        }
        try {
            if (doc.getElementById('gm-cme-always-progress')) {
                return;
            }
        } catch (err) {
            return;
        }
        var style = doc.createElement('style');
        style.id = 'gm-cme-always-progress';
        style.type = 'text/css';
        style.appendChild(doc.createTextNode(
            '.ccH5playerBox section,.ccH5playerBox section.ccH5FadeOut{' +
                'opacity:1 !important;visibility:visible !important;' +
            '}' +
            '.ccH5ProgressBar{opacity:1 !important;visibility:visible !important;display:block !important;}'
        ));
        var head = doc.getElementsByTagName('head')[0] || doc.documentElement;
        if (head) {
            head.appendChild(style);
            log('injected always-show css for .ccH5ProgressBar');
        }
    }

    function replaceClass(el, fromName, toName) {
        var cls = ' ' + String(el.className || '') + ' ';
        if (cls.indexOf(' ' + fromName + ' ') < 0) {
            return;
        }
        el.className = cls.replace(' ' + fromName + ' ', ' ' + toName + ' ').replace(/^\s+|\s+$/g, '');
    }

    function forceElShown(el) {
        if (!el || !el.style) {
            return;
        }
        if (el.style.display === 'none') {
            el.style.display = 'block';
        }
        el.style.opacity = '1';
        el.style.visibility = 'visible';
        replaceClass(el, 'ccH5FadeOut', 'ccH5FadeIn');
    }

    function forceShowProgressBar(doc) {
        if (!doc) {
            return;
        }
        ensureProgressBarCss(doc);
        var bars;
        try {
            bars = doc.getElementsByClassName('ccH5ProgressBar');
        } catch (err) {
            return;
        }
        var i;
        for (i = 0; i < bars.length; i++) {
            var bar = bars[i];
            forceElShown(bar);
            var parent = bar.parentElement;
            var hops = 0;
            while (parent && hops < 8) {
                forceElShown(parent);
                if (parent.className && String(parent.className).indexOf('ccH5playerBox') >= 0) {
                    break;
                }
                parent = parent.parentElement;
                hops += 1;
            }
        }
    }

    function hasClass(el, name) {
        if (!el) {
            return false;
        }
        var cls = ' ' + String(el.className || '') + ' ';
        return cls.indexOf(' ' + name + ' ') >= 0;
    }

    function isComplete(progress, state) {
        if (state && state.allEnded) {
            return true;
        }
        if (progress && isFinite(progress.pct) && progress.pct >= COMPLETE_PCT) {
            return true;
        }
        return false;
    }

    function findActiveNextLink(doc) {
        if (!doc) {
            return null;
        }
        var list = null;
        try {
            list = doc.getElementById('s_r_ml');
        } catch (err) {
            list = null;
        }
        if (!list) {
            var lists;
            try {
                lists = doc.getElementsByClassName('s_r_ml');
            } catch (err2) {
                lists = null;
            }
            if (lists && lists.length) {
                list = lists[0];
            }
        }
        if (!list) {
            return null;
        }
        var items = list.getElementsByTagName('li');
        var i;
        var activeIndex = -1;
        for (i = 0; i < items.length; i++) {
            if (hasClass(items[i], 'active')) {
                activeIndex = i;
                break;
            }
        }
        if (activeIndex < 0) {
            log('playlist has no .active item');
            return null;
        }
        if (activeIndex >= items.length - 1) {
            log('playlist active is last item, no next');
            return null;
        }
        var nextLi = items[activeIndex + 1];
        var links = nextLi.getElementsByTagName('a');
        if (!links || !links.length) {
            return null;
        }
        return links[0];
    }

    function findActiveNextLinkInDocs(docs) {
        var d;
        for (d = 0; d < docs.length; d++) {
            var link = findActiveNextLink(docs[d]);
            if (link) {
                return link;
            }
        }
        try {
            if (window.top && window.top.document) {
                return findActiveNextLink(window.top.document);
            }
        } catch (err) {}
        return null;
    }

    function clickNextLesson(el) {
        if (!el) {
            return;
        }
        var mark = el.getAttribute('data-gm-next-at');
        if (mark) {
            var then = parseInt(mark, 10);
            if (then && (Date.now() - then) < NEXT_COOLDOWN_MS) {
                log('skip next lesson, cooldown');
                return;
            }
        }
        el.setAttribute('data-gm-next-at', String(Date.now()));
        console.log(LOG_PREFIX, 'progress 100%, playing next', elText(el));
        try {
            el.click();
        } catch (err) {
            log('next lesson click failed', err);
        }
    }

    function pickResumeTarget(jumpBtn, shownBtn) {
        if (jumpBtn) {
            return { el: jumpBtn, alsoPlay: false };
        }
        if (shownBtn) {
            return { el: shownBtn, alsoPlay: true };
        }
        return null;
    }

    function checkOnce() {
        var docs = [];
        collectDocs(document, docs);
        log(
            'tick href=' + location.href +
            ' isTop=' + (window === window.top) +
            ' docs=' + docs.length
        );

        var progress = null;
        var state = null;
        var shownBtn = null;
        var jumpBtn = null;
        var qiandao = null;
        var blocked = false;
        var d;
        for (d = 0; d < docs.length; d++) {
            var doc = docs[d];
            forceShowProgressBar(doc);
            logProgress(doc);
            var p = readProgress(doc);
            if (p && isFinite(p.pct)) {
                progress = p;
            }
            var st = playerState(doc);
            if (st && st.hasVideo) {
                state = st;
            }
            var qd = findQiandaoLink(doc);
            if (qd) {
                qiandao = qd;
            }
            if (blockingOverlayName(doc)) {
                blocked = true;
            }
            var jb = findJumpContinue(doc);
            if (jb) {
                jumpBtn = jb;
            }
            var btns = findReplayBtns(doc);
            var b;
            for (b = 0; b < btns.length; b++) {
                if (isShown(btns[b])) {
                    shownBtn = btns[b];
                }
            }
        }

        if (qiandao) {
            clickQiandao(qiandao);
            return;
        }
        if (blocked) {
            log('skip, quiz overlay');
            return;
        }

        var paused = false;
        if (state && (state.stopped || state.allEnded)) {
            paused = true;
        }
        if (shownBtn || jumpBtn) {
            paused = true;
        }

        if (!paused) {
            return;
        }

        if (isComplete(progress, state)) {
            var nextLink = findActiveNextLinkInDocs(docs);
            if (nextLink) {
                clickNextLesson(nextLink);
            } else {
                console.log(LOG_PREFIX, 'progress 100%, no next lesson in #s_r_ml');
            }
            return;
        }

        var resume = pickResumeTarget(jumpBtn, shownBtn);
        if (resume) {
            log('paused under 100%, resume');
            clickResume(resume.el, resume.alsoPlay);
            return;
        }
        if (state && state.stopped) {
            log('paused under 100%, no overlay button, calling play()');
            tryPlayerApiPlay(pageWindow);
        }
    }

    log('script start href=' + location.href + ' isTop=' + (window === window.top));
    checkOnce();
    setInterval(checkOnce, CHECK_MS);
})();
