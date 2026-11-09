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
        'user guide',
        'promotion',
        'bixby',
        'securitycenter',
        'security center',
        'glance',
        'gamebreaks',
        'weekend games'
    ];

    /*
     * Which apps count as "real" apps. getAppsInfo() also returns hundreds of
     * internal components (widgets, popups, background services) that newer
     * firmware marks as visible. Tested against a 2026 TV: these rules keep
     * exactly the apps in Samsung's own Apps list.
     */
    // Built-in (com./org.) apps that Samsung shows in its Apps list. Every
    // other built-in ID is an internal component.
    var BUILTIN_APPS = {
        'org.tizen.netflix-app': true,
        'org.tizen.primevideo': true,
        'org.tizen.browser': true,
        'com.samsung.tv.aria-video': true,        // Apple TV
        'com.samsung.tv.SmartThingsApp': true,
        'com.samsung.tv.google-photos-ui': true,
        'com.samsung.tv.samsung-health': true,
        'com.samsung.tv.bixby-promotion': true,
        'com.samsung.tv.SecurityCenter': true,
        'com.samsung.tv.store': true
    };
    // Store apps have a 10-character package ID, e.g. 9Ur5IzDKqV.TizenYouTube.
    var STORE_ID = /^[A-Za-z0-9]{10}\.[A-Za-z0-9_-]+$/;
    // Helper parts that store apps ship alongside the real app.
    var HELPER = /service|preview|extension|cmswebapp|ad ?player|settings|privacy/i;

    function isRealApp(id, name) {
        if (BUILTIN_APPS[id]) { return true; }
        if (!STORE_ID.test(id)) { return false; }
        if (HELPER.test(id) || HELPER.test(name)) { return false; }
        // Names like "2026.SmartTV.Kant" are internal IDs, not app names.
        if (name.indexOf('.') !== -1 && name.indexOf(' ') === -1) { return false; }
        return true;
    }

    // Tile colours: brand colours for well-known apps, otherwise a colour
    // picked from PALETTE by the app's name so it stays the same every time.
    var BRAND_COLORS = [
        ['netflix', '#b20710'], ['youtube tv', '#cc0000'], ['youtube', '#cc0000'],
        ['prime video', '#1a98ff'], ['disney', '#0b3d91'], ['hulu', '#1ce783'],
        ['max', '#2b2bd9'], ['plex', '#e5a00d'], ['spotify', '#1db954'],
        ['apple tv', '#333333'], ['jellyfin', '#7b4ddb'], ['peacock', '#222222'],
        ['sling', '#1e88e5'], ['tubi', '#7408ff'], ['smartthings', '#15bfff'],
        ['browser', '#3a7bd5'], ['internet', '#3a7bd5'], ['instagram', '#c13584'],
        ['xbox', '#107c10'], ['luna', '#5a2ee0'], ['google photos', '#4285f4'],
        ['stremio', '#5a3fc0'], ['paramount', '#0064ff'], ['pluto', '#1d1d1d']
    ];
    var PALETTE = ['#c0392b', '#d35400', '#e5a00d', '#27ae60', '#16a085',
        '#2980b9', '#3a7bd5', '#5b4bd6', '#8e44ad', '#c2185b'];

    function colorFor(name) {
        var n = name.toLowerCase();
        for (var i = 0; i < BRAND_COLORS.length; i++) {
            if (n.indexOf(BRAND_COLORS[i][0]) !== -1) { return BRAND_COLORS[i][1]; }
        }
        var h = 0;
        for (var j = 0; j < n.length; j++) { h = (h * 31 + n.charCodeAt(j)) % 100000; }
        return PALETTE[h % PALETTE.length];
    }

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
                    if (!isRealApp(a.id, a.name)) { continue; }
                    list.push({ id: a.id, name: a.name, icon: a.iconPath || '', color: colorFor(a.name) });
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
    // v2: the app filter changed, so re-run the first-start hidden list.
    var STORE_KEY = 'nifty.home.v2';

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
