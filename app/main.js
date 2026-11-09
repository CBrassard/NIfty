/*
 * main.js - NIfty home screen.
 *
 * Remote controls (works with the basic Samsung Smart/Solar remote):
 *   Arrows   move focus
 *   OK       open the app (or, in Arrange mode, open the app's options)
 *   Back     close a menu / cancel a move / leave Arrange mode
 *
 * Written in ES5 for older Tizen browsers.
 */
(function (global, doc) {
    'use strict';

    var D = global.NiftyDevice;
    var COLS = 6;

    var els = {
        backdrop: doc.getElementById('backdrop'),
        time: doc.getElementById('time'),
        date: doc.getElementById('date'),
        greeting: doc.getElementById('greeting'),
        grid: doc.getElementById('grid'),
        empty: doc.getElementById('empty'),
        mode: doc.getElementById('mode'),
        edit: doc.getElementById('edit'),
        hint: doc.getElementById('hint'),
        menu: doc.getElementById('menu'),
        menuTitle: doc.getElementById('menu-title'),
        menuItems: doc.getElementById('menu-items')
    };

    // Persisted: user's app order and hidden apps.
    var prefs = D.load() || { order: [], hidden: {}, seeded: false };
    if (!prefs.order) { prefs.order = []; }
    if (!prefs.hidden) { prefs.hidden = {}; }

    // Runtime state.
    var apps = [];          // all installed apps, in the user's order
    var arranging = false;  // Arrange mode on/off
    var moving = null;      // app id being moved, or null
    var zone = 'grid';      // 'grid' | 'edit' | 'menu'
    var focusIndex = 0;     // focus inside the grid
    var menu = null;        // { items: [{label, run}], index }

    /* ---------- apps ---------- */

    function visibleApps() {
        if (arranging) { return apps; }
        var out = [];
        for (var i = 0; i < apps.length; i++) {
            if (!prefs.hidden[apps[i].id]) { out.push(apps[i]); }
        }
        return out;
    }

    function seedHidden(list) {
        if (prefs.seeded) { return; }
        for (var i = 0; i < list.length; i++) {
            var name = list[i].name.toLowerCase();
            for (var j = 0; j < D.DEFAULT_HIDDEN.length; j++) {
                if (name.indexOf(D.DEFAULT_HIDDEN[j]) !== -1) {
                    prefs.hidden[list[i].id] = true;
                }
            }
        }
        prefs.seeded = true;
    }

    function applyOrder(list) {
        var byId = {};
        var i;
        for (i = 0; i < list.length; i++) { byId[list[i].id] = list[i]; }

        var ordered = [];
        var seen = {};
        for (i = 0; i < prefs.order.length; i++) {
            var id = prefs.order[i];
            if (byId[id] && !seen[id]) { ordered.push(byId[id]); seen[id] = true; }
        }
        // New apps go to the end, alphabetically.
        var rest = [];
        for (i = 0; i < list.length; i++) {
            if (!seen[list[i].id]) { rest.push(list[i]); }
        }
        rest.sort(function (a, b) { return a.name.localeCompare(b.name); });
        return ordered.concat(rest);
    }

    function persist() {
        prefs.order = [];
        for (var i = 0; i < apps.length; i++) { prefs.order.push(apps[i].id); }
        D.save(prefs);
    }

    function refreshApps() {
        D.getApps(function (list) {
            seedHidden(list);
            var focusedId = currentApp() ? currentApp().id : null;
            apps = applyOrder(list);
            persist();
            render();
            if (focusedId) { focusApp(focusedId); }
        });
    }

    /* ---------- rendering ---------- */

    function initials(name) {
        var parts = name.replace(/[^A-Za-z0-9+ ]/g, ' ').split(/\s+/);
        var s = '';
        for (var i = 0; i < parts.length && s.length < 2; i++) {
            if (parts[i]) { s += parts[i].charAt(0).toUpperCase(); }
        }
        return s || '?';
    }

    function tile(app, index) {
        var el = doc.createElement('div');
        el.className = 'tile';
        el.setAttribute('role', 'listitem');
        el.setAttribute('data-index', String(index));
        if (prefs.hidden[app.id]) { el.className += ' is-hidden'; }
        if (moving === app.id) { el.className += ' is-moving'; }

        var art = doc.createElement('div');
        art.className = 'art';
        var letter = doc.createElement('span');
        letter.className = 'letter';
        letter.textContent = initials(app.name);
        art.appendChild(letter);
        if (app.color) { art.style.backgroundColor = app.color; }

        if (app.icon) {
            var img = doc.createElement('img');
            img.alt = '';
            img.onload = function () { art.className += ' has-icon'; };
            img.onerror = function () { if (img.parentNode) { img.parentNode.removeChild(img); } };
            img.src = app.icon;
            art.appendChild(img);
        }

        var name = doc.createElement('div');
        name.className = 'name';
        name.textContent = app.name;

        el.appendChild(art);
        el.appendChild(name);

        if (prefs.hidden[app.id]) {
            var badge = doc.createElement('div');
            badge.className = 'badge';
            badge.textContent = 'Hidden';
            el.appendChild(badge);
        }

        el.onclick = function () {
            zone = 'grid';
            focusIndex = index;
            activate();
        };
        return el;
    }

    function render() {
        var list = visibleApps();
        els.grid.innerHTML = '';
        for (var i = 0; i < list.length; i++) { els.grid.appendChild(tile(list[i], i)); }
        els.empty.hidden = list.length > 0;

        if (focusIndex >= list.length) { focusIndex = Math.max(0, list.length - 1); }

        doc.body.className = arranging ? 'arranging' : '';
        els.edit.textContent = arranging ? 'Done' : 'Arrange';
        els.mode.textContent = arranging ? 'Arrange mode' : '';
        if (moving) {
            els.hint.textContent = 'Use the arrows to move it, then press OK to drop it here.';
        } else if (arranging) {
            els.hint.textContent = 'Press OK on an app to move, hide or show it. Back finishes.';
        } else {
            els.hint.textContent = 'Choose an app with the arrow keys and press OK.';
        }
        paintFocus();
    }

    function paintFocus() {
        var tiles = els.grid.children;
        for (var i = 0; i < tiles.length; i++) {
            var on = zone !== 'edit' && i === focusIndex;
            tiles[i].className = tiles[i].className.replace(/\s?is-focused/g, '') + (on ? ' is-focused' : '');
            if (on && tiles[i].scrollIntoView) {
                tiles[i].scrollIntoView({ block: 'nearest' });
            }
        }
        els.edit.className = 'pill' + (zone === 'edit' ? ' is-focused' : '');
    }

    /* ---------- menu ---------- */

    function openMenu(title, items) {
        menu = { items: items, index: 0, back: zone };
        zone = 'menu';
        els.menuTitle.textContent = title;
        els.menuItems.innerHTML = '';
        for (var i = 0; i < items.length; i++) {
            var b = doc.createElement('button');
            b.className = 'menu-item';
            b.textContent = items[i].label;
            b.onclick = (function (n) { return function () { menu.index = n; runMenu(); }; }(i));
            els.menuItems.appendChild(b);
        }
        els.menu.hidden = false;
        paintMenu();
    }

    function closeMenu() {
        if (!menu) { return; }
        zone = menu.back;
        menu = null;
        els.menu.hidden = true;
        paintFocus();
    }

    function paintMenu() {
        var b = els.menuItems.children;
        for (var i = 0; i < b.length; i++) {
            b[i].className = 'menu-item' + (i === menu.index ? ' is-focused' : '');
        }
    }

    function runMenu() {
        var item = menu.items[menu.index];
        closeMenu();
        item.run();
    }

    /* ---------- actions ---------- */

    function currentApp() {
        return visibleApps()[focusIndex] || null;
    }

    function focusApp(id) {
        var list = visibleApps();
        for (var i = 0; i < list.length; i++) {
            if (list[i].id === id) { focusIndex = i; break; }
        }
        paintFocus();
    }

    function toggleArrange() {
        arranging = !arranging;
        moving = null;
        var app = currentApp();
        render();
        if (app) { focusApp(app.id); }
    }

    function activate() {
        if (zone === 'edit') { toggleArrange(); return; }

        var app = currentApp();
        if (!app) { return; }

        if (moving) {
            moving = null;
            persist();
            render();
            return;
        }

        if (!arranging) {
            D.launch(app.id, function (msg) {
                els.hint.textContent = 'Could not open ' + app.name + ': ' + msg;
            });
            return;
        }

        var hidden = !!prefs.hidden[app.id];
        openMenu(app.name, [
            { label: 'Move', run: function () { moving = app.id; render(); } },
            { label: hidden ? 'Show on home' : 'Hide from home', run: function () {
                if (hidden) { delete prefs.hidden[app.id]; } else { prefs.hidden[app.id] = true; }
                persist();
                render();
            } },
            { label: 'Cancel', run: function () {} }
        ]);
    }

    function moveBy(delta) {
        var to = focusIndex + delta;
        if (to < 0 || to >= apps.length) { return; }
        var item = apps.splice(focusIndex, 1)[0];
        apps.splice(to, 0, item);
        focusIndex = to;
        render();
    }

    function back() {
        if (zone === 'menu') { closeMenu(); return; }
        if (moving) { moving = null; persist(); render(); return; }
        if (arranging) { toggleArrange(); zone = 'grid'; paintFocus(); return; }
        // On the home screen itself Back does nothing: there is nowhere to go.
    }

    function navigate(dx, dy) {
        if (zone === 'menu') {
            var n = menu.items.length;
            menu.index = (menu.index + dy + n) % n;
            paintMenu();
            return;
        }

        var count = visibleApps().length;

        if (moving) {
            moveBy(dx + dy * COLS);
            return;
        }

        if (zone === 'edit') {
            if (dy < 0 && count) { zone = 'grid'; paintFocus(); }
            return;
        }

        var next = focusIndex + dx + dy * COLS;
        if (dy > 0 && next >= count) {
            // Below the last row: the Arrange button.
            var lastRowStart = Math.floor((count - 1) / COLS) * COLS;
            if (focusIndex >= lastRowStart) { zone = 'edit'; paintFocus(); return; }
            next = count - 1;
        }
        if (dx !== 0 && Math.floor(next / COLS) !== Math.floor(focusIndex / COLS)) { return; }
        if (next < 0 || next >= count) { return; }
        focusIndex = next;
        paintFocus();
    }

    function onKey(e) {
        var K = D.KEYS;
        switch (e.keyCode) {
        case K.LEFT: navigate(-1, 0); break;
        case K.RIGHT: navigate(1, 0); break;
        case K.UP: navigate(0, -1); break;
        case K.DOWN: navigate(0, 1); break;
        case K.ENTER:
            if (zone === 'menu') { runMenu(); } else { activate(); }
            break;
        case K.BACK:
        case K.ESCAPE:
        case K.BACKSPACE:
            back();
            break;
        default:
            return;
        }
        e.preventDefault();
    }

    /* ---------- clock and backdrop ---------- */

    var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
        'August', 'September', 'October', 'November', 'December'];

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function tick() {
        var now = new Date();
        var h = now.getHours();
        var h12 = h % 12 || 12;
        els.time.textContent = h12 + ':' + pad(now.getMinutes());
        els.date.textContent = DAYS[now.getDay()] + ', ' + MONTHS[now.getMonth()] + ' ' + now.getDate();

        var part = h < 5 ? 'night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
        els.greeting.textContent = part === 'night' ? 'Good night' : 'Good ' + part;
        // One calm backdrop all day (the time-of-day skies were too bright).
        els.backdrop.className = 'backdrop sky-evening';
    }

    /* ---------- start ---------- */

    els.edit.onclick = function () { zone = 'edit'; activate(); };
    doc.addEventListener('keydown', onKey);
    doc.addEventListener('visibilitychange', function () {
        // Pick up apps installed or removed while NIfty was in the background.
        if (!doc.hidden) { refreshApps(); tick(); }
    });

    tick();
    setInterval(tick, 10000);
    refreshApps();

    // Exposed for the browser smoke test only.
    global.NiftyHome = {
        state: function () {
            return { zone: zone, focusIndex: focusIndex, arranging: arranging, moving: moving,
                visible: visibleApps().map(function (a) { return a.name; }), prefs: prefs };
        }
    };
}(window, document));
