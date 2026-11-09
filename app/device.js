/*
 * device.js - the only file that talks to the TV.
 *
 * On a Samsung TV it uses the Tizen Web API (window.tizen). In a desktop
 * browser it falls back to a fake app list so the UI can be previewed and
 * tested without a TV. Written in ES5 so it runs on older Tizen browsers.
 */
(function (global) {
    'use strict';

    var hasTizen = typeof global.tizen !== 'undefined' && !!global.tizen.application;

    // Apps hidden the first time NIfty starts. Matched against the app name,
    // case-insensitive. Hidden apps can be shown again from Arrange mode.
    var DEFAULT_HIDDEN = [
        'samsung tv plus',
        'gaming hub',
        'samsung health',
        'samsung daily',
        'art store',
        'e-manual',
        'promotion'
    ];

    var KEYS = {
        LEFT: 37,
        UP: 38,
        RIGHT: 39,
        DOWN: 40,
        ENTER: 13,
        BACK: 10009,       // Tizen remote "Back"
        ESCAPE: 27,        // desktop preview
        BACKSPACE: 8       // desktop preview
    };

    function ownAppId() {
        if (!hasTizen) { return 'preview.NIfty'; }
        try {
            return global.tizen.application.getCurrentApplication().appInfo.id;
        } catch (e) {
            return '';
        }
    }

    var PREVIEW_APPS = [
        ['Netflix', '#b20710'], ['YouTube', '#cc0000'], ['Prime Video', '#1a98ff'],
        ['Disney+', '#0b3d91'], ['Max', '#2b2bd9'], ['Plex', '#e5a00d'],
        ['Spotify', '#1db954'], ['Apple TV', '#333333'], ['Hulu', '#1ce783'],
        ['Jellyfin', '#7b4ddb'], ['Internet', '#3a7bd5'], ['Samsung TV Plus', '#4a4a7a'],
        ['Gaming Hub', '#6b2fa0'], ['SmartThings', '#15bfff']
    ];

    function previewApps() {
        var list = [];
        for (var i = 0; i < PREVIEW_APPS.length; i++) {
            list.push({
                id: 'preview.' + PREVIEW_APPS[i][0].toLowerCase().replace(/[^a-z0-9]/g, ''),
                name: PREVIEW_APPS[i][0],
                icon: '',
                color: PREVIEW_APPS[i][1]
            });
        }
        return list;
    }

    /** Calls done(list) with [{id, name, icon}] for every user-visible app. */
    function getApps(done) {
        if (!hasTizen) {
            setTimeout(function () { done(previewApps()); }, 0);
            return;
        }
        var self = ownAppId();
        try {
            global.tizen.application.getAppsInfo(function (infos) {
                var list = [];
                for (var i = 0; i < infos.length; i++) {
                    var a = infos[i];
                    if (!a.show || a.id === self || !a.name) { continue; }
                    list.push({ id: a.id, name: a.name, icon: a.iconPath || '' });
                }
                done(list);
            }, function (err) {
                global.console.error('getAppsInfo failed', err && err.message);
                done([]);
            });
        } catch (e) {
            global.console.error('getAppsInfo threw', e && e.message);
            done([]);
        }
    }

    /** Launches an app by its application ID. */
    function launch(appId, onError) {
        if (!hasTizen) {
            global.console.log('[preview] launch ' + appId);
            return;
        }
        try {
            global.tizen.application.launch(appId, null, function (err) {
                if (onError) { onError(err && err.message ? err.message : String(err)); }
            });
        } catch (e) {
            if (onError) { onError(e && e.message ? e.message : String(e)); }
        }
    }

    /** Simple persistent storage (localStorage works inside Tizen web apps). */
    var STORE_KEY = 'nifty.home.v1';

    function load() {
        try {
            var raw = global.localStorage.getItem(STORE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function save(state) {
        try {
            global.localStorage.setItem(STORE_KEY, JSON.stringify(state));
        } catch (e) { /* storage full or unavailable: keep running */ }
    }

    global.NiftyDevice = {
        isTV: hasTizen,
        KEYS: KEYS,
        DEFAULT_HIDDEN: DEFAULT_HIDDEN,
        getApps: getApps,
        launch: launch,
        load: load,
        save: save
    };
}(window));
