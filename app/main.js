/*
 * main.js - NIfty home screen: a wallpaper, a clock and a dock of your apps.
 *
 * Remote controls (works with the basic Samsung Smart/Solar remote):
 *   Left/Right  move along the dock
 *   Up          to the "All apps" / "Edit dock" buttons
 *   OK          open the app (in Edit mode: options for that app)
 *   Back        close a menu / cancel a move / leave Edit mode / close All apps
 *
 * Written in ES5 for older Tizen browsers.
 */
(function (global, doc) {
    'use strict';

    var D = global.NiftyDevice;
    var COLS = 6;           // columns in the All apps grid
    var ADD_ID = '__add__'; // the "+ Add apps" item shown on the dock while editing

    var els = {
        time: doc.getElementById('time'),
        hint: doc.getElementById('hint'),
        dock: doc.getElementById('dock'),
        btnAll: doc.getElementById('btn-all'),
        btnEdit: doc.getElementById('btn-edit'),
        btnEditLabel: doc.getElementById('btn-edit-label'),
        drawer: doc.getElementById('drawer'),
        drawerHint: doc.getElementById('drawer-hint'),
        grid: doc.getElementById('grid'),
        empty: doc.getElementById('empty'),
        menu: doc.getElementById('menu'),
        menuTitle: doc.getElementById('menu-title'),
        menuItems: doc.getElementById('menu-items')
    };
    var buttons = [els.btnAll, els.btnEdit];

    // Persisted: the dock (app ids in order) and apps hidden from All apps.
    var prefs = D.load() || {};
    if (!prefs.dock) { prefs.dock = []; }
    if (!prefs.hidden) { prefs.hidden = {}; }

    // Runtime state.
    var apps = [];          // every app, alphabetical
    var byId = {};
    var editing = false;    // Edit dock mode
    var moving = null;      // dock app id being moved
    var zone = 'dock';      // 'dock' | 'top' | 'drawer' | 'menu'
    var dockIndex = 0;
    var topIndex = 0;
    var gridIndex = 0;
    var menu = null;        // { items, index, back }

    /* ---------- data ---------- */

    function persist() { D.save(prefs); }

    function seed(list) {
        var i, j;
        if (!prefs.hiddenSeeded) {
            for (i = 0; i < list.length; i++) {
                var name = list[i].name.toLowerCase();
                for (j = 0; j < D.DEFAULT_HIDDEN.length; j++) {
                    if (name.indexOf(D.DEFAULT_HIDDEN[j]) !== -1) { prefs.hidden[list[i].id] = true; }
                }
            }
            prefs.hiddenSeeded = true;
        }
        if (!prefs.dockSeeded && list.length > 1) {
            for (i = 0; i < D.DEFAULT_DOCK.length; i++) {
                var want = D.DEFAULT_DOCK[i];
                var hit = null;
                for (j = 0; j < list.length && !hit; j++) {
                    if (list[j].name.toLowerCase() === want) { hit = list[j]; }
                }
                for (j = 0; j < list.length && !hit; j++) {
                    if (list[j].name.toLowerCase().indexOf(want) === 0) { hit = list[j]; }
                }
                if (hit && prefs.dock.indexOf(hit.id) === -1) { prefs.dock.push(hit.id); }
            }
            prefs.dockSeeded = true;
        }
    }

    function dockApps() {
        var out = [];
        for (var i = 0; i < prefs.dock.length; i++) {
            if (byId[prefs.dock[i]]) { out.push(byId[prefs.dock[i]]); }
        }
        if (editing) { out.push({ id: ADD_ID, name: 'Add apps', kind: 'add' }); }
        return out;
    }

    function drawerApps() {
        if (editing) { return apps; }
        var out = [];
        for (var i = 0; i < apps.length; i++) {
            if (!prefs.hidden[apps[i].id]) { out.push(apps[i]); }
        }
        return out;
    }

    function onDock(id) { return prefs.dock.indexOf(id) !== -1; }

    function refreshApps() {
        D.getApps(function (list) {
            seed(list);
            list.sort(function (a, b) { return a.name.localeCompare(b.name); });
            apps = list;
            byId = {};
            for (var i = 0; i < list.length; i++) { byId[list[i].id] = list[i]; }
            persist();
            render();
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

    // Icon: a white service mark from icons/, else the app's own icon,
    // else its initials.
    function iconEl(app) {
        var box = doc.createElement('div');
        box.className = 'icon';
        if (app.kind === 'add') { app = { name: app.name, mark: 'icons/add.svg' }; }
        if (app.mark) {
            box.className += ' icon-mark';
            var m = doc.createElement('img');
            m.alt = '';
            m.src = app.mark;
            box.appendChild(m);
            return box;
        }
        var letter = doc.createElement('span');
        letter.className = 'letter';
        letter.textContent = initials(app.name);
        box.appendChild(letter);
        if (app.icon) {
            var img = doc.createElement('img');
            img.alt = '';
            img.onload = function () { box.className += ' has-img'; };
            img.onerror = function () { if (img.parentNode) { img.parentNode.removeChild(img); } };
            img.src = app.icon;
            box.appendChild(img);
        }
        return box;
    }

    function item(app, cls) {
        var el = doc.createElement('div');
        el.className = cls;
        el.setAttribute('role', 'listitem');
        el.appendChild(iconEl(app));
        var label = doc.createElement('div');
        label.className = 'label';
        label.textContent = app.name;
        el.appendChild(label);
        return el;
    }

    function renderDock() {
        var list = dockApps();
        els.dock.innerHTML = '';
        for (var i = 0; i < list.length; i++) {
            var el = item(list[i], 'dock-item');
            if (moving === list[i].id) { el.className += ' is-moving'; }
            el.onclick = (function (n) { return function () { zone = 'dock'; dockIndex = n; activate(); }; }(i));
            els.dock.appendChild(el);
        }
        if (!list.length) {
            var none = doc.createElement('div');
            none.className = 'dock-empty';
            none.textContent = 'Your dock is empty. Go up to All apps to add some.';
            els.dock.appendChild(none);
        }
        if (dockIndex >= list.length) { dockIndex = Math.max(0, list.length - 1); }
    }

    function renderDrawer() {
        var list = drawerApps();
        els.grid.innerHTML = '';
        for (var i = 0; i < list.length; i++) {
            var el = item(list[i], 'grid-item');
            if (editing && prefs.hidden[list[i].id]) { el.className += ' is-hidden'; }
            if (onDock(list[i].id)) {
                var b = doc.createElement('div');
                b.className = 'badge';
                b.textContent = 'On dock';
                el.appendChild(b);
            }
            el.onclick = (function (n) { return function () { zone = 'drawer'; gridIndex = n; activate(); }; }(i));
            els.grid.appendChild(el);
        }
        els.empty.hidden = list.length > 0;
        if (gridIndex >= list.length) { gridIndex = Math.max(0, list.length - 1); }
        els.drawerHint.textContent = editing
            ? 'Press OK on an app to add it to the dock, remove it, or hide it here.'
            : 'Press OK to open. Back closes.';
    }

    function render() {
        renderDock();
        if (!els.drawer.hidden) { renderDrawer(); }
        doc.body.className = editing ? 'editing' : '';
        els.btnEditLabel.textContent = editing ? 'Done' : 'Edit dock';
        if (moving) {
            setHint('Left/Right to move it. OK to drop it here.');
        } else if (editing) {
            setHint('Press OK on a dock app to move or remove it. Back when you\'re done.');
        } else {
            setHint('');
        }
        paintFocus();
    }

    function setHint(text) { els.hint.textContent = text; els.hint.className = 'hint' + (text ? ' is-on' : ''); }

    function mark(nodes, index, on) {
        for (var i = 0; i < nodes.length; i++) {
            var f = on && i === index;
            nodes[i].className = nodes[i].className.replace(/\s?is-focused/g, '') + (f ? ' is-focused' : '');
            if (f && nodes[i].scrollIntoView) { nodes[i].scrollIntoView({ block: 'nearest', inline: 'nearest' }); }
        }
    }

    function paintFocus() {
        mark(els.dock.children, dockIndex, zone === 'dock');
        mark(buttons, topIndex, zone === 'top');
        mark(els.grid.children, gridIndex, zone === 'drawer');
    }

    /* ---------- drawer (All apps) ---------- */

    function openDrawer() {
        els.drawer.hidden = false;
        zone = 'drawer';
        gridIndex = 0;
        renderDrawer();
        paintFocus();
    }

    function closeDrawer() {
        els.drawer.hidden = true;
        zone = 'dock';
        render();
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
        var it = menu.items[menu.index];
        closeMenu();
        it.run();
    }

    /* ---------- actions ---------- */

    function launch(app) {
        D.launch(app.id, function (msg) {
            setHint('Could not open ' + app.name + ': ' + msg);
        });
    }

    function toggleEdit() {
        editing = !editing;
        moving = null;
        render();
    }

    function addToDock(id) { if (!onDock(id)) { prefs.dock.push(id); persist(); } }
    function removeFromDock(id) {
        var i = prefs.dock.indexOf(id);
        if (i !== -1) { prefs.dock.splice(i, 1); persist(); }
    }

    function activate() {
        if (zone === 'top') {
            if (topIndex === 0) { openDrawer(); } else { toggleEdit(); }
            return;
        }

        if (zone === 'drawer') {
            var g = drawerApps()[gridIndex];
            if (!g) { return; }
            if (!editing) { launch(g); return; }
            var docked = onDock(g.id);
            var hidden = !!prefs.hidden[g.id];
            openMenu(g.name, [
                { label: docked ? 'Remove from dock' : 'Add to dock', run: function () {
                    if (docked) { removeFromDock(g.id); } else { addToDock(g.id); }
                    render();
                } },
                { label: hidden ? 'Show in All apps' : 'Hide from All apps', run: function () {
                    if (hidden) { delete prefs.hidden[g.id]; } else { prefs.hidden[g.id] = true; }
                    persist();
                    render();
                } },
                { label: 'Cancel', run: function () {} }
            ]);
            return;
        }

        // Dock.
        var app = dockApps()[dockIndex];
        if (!app) { return; }
        if (app.kind === 'add') { openDrawer(); return; }
        if (moving) { moving = null; persist(); render(); return; }
        if (!editing) { launch(app); return; }
        openMenu(app.name, [
            { label: 'Move', run: function () { moving = app.id; render(); } },
            { label: 'Remove from dock', run: function () { removeFromDock(app.id); render(); } },
            { label: 'Cancel', run: function () {} }
        ]);
    }

    function moveBy(delta) {
        var from = prefs.dock.indexOf(moving);
        var to = from + delta;
        if (from === -1 || to < 0 || to >= prefs.dock.length) { return; }
        prefs.dock.splice(from, 1);
        prefs.dock.splice(to, 0, moving);
        dockIndex = to;
        render();
    }

    function back() {
        if (zone === 'menu') { closeMenu(); return; }
        if (moving) { moving = null; persist(); render(); return; }
        if (!els.drawer.hidden) { closeDrawer(); return; }
        if (editing) { toggleEdit(); zone = 'dock'; paintFocus(); return; }
        if (zone === 'top') { zone = 'dock'; paintFocus(); }
        // On the home screen itself Back does nothing: there is nowhere to go.
    }

    function navigate(dx, dy) {
        if (zone === 'menu') {
            var n = menu.items.length;
            menu.index = (menu.index + dy + n) % n;
            paintMenu();
            return;
        }

        if (zone === 'drawer') {
            var count = drawerApps().length;
            var next = gridIndex + dx + dy * COLS;
            if (dx !== 0 && Math.floor(next / COLS) !== Math.floor(gridIndex / COLS)) { return; }
            if (next < 0 || next >= count) { return; }
            gridIndex = next;
            paintFocus();
            return;
        }

        if (moving) { if (dx) { moveBy(dx); } return; }

        if (zone === 'top') {
            if (dy > 0) { zone = 'dock'; paintFocus(); return; }
            if (dx) { topIndex = Math.max(0, Math.min(buttons.length - 1, topIndex + dx)); paintFocus(); }
            return;
        }

        // Dock.
        if (dy < 0) { zone = 'top'; paintFocus(); return; }
        var len = dockApps().length;
        if (dx && dockIndex + dx >= 0 && dockIndex + dx < len) {
            dockIndex += dx;
            paintFocus();
        }
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

    /* ---------- wallpaper ---------- */

    // Photos from .local/wallpapers/ take turns: a new one every
    // WALL_HOURS hours (by the clock, so it's the same photo whether NIfty
    // was just opened or has been on screen all along).
    var WALL_HOURS = 6;
    var walls = global.NIFTY_WALLPAPERS || [];
    var wallIndex = -1;
    var wallEl = doc.getElementById('wallpaper');

    function updateWallpaper() {
        if (!walls.length) { return; }
        var slot = Math.floor(Date.now() / (WALL_HOURS * 3600 * 1000));
        var i = slot % walls.length;
        if (i === wallIndex) { return; }
        wallIndex = i;
        var img = new global.Image();
        img.onload = function () { wallEl.style.backgroundImage = 'url("' + walls[i] + '")'; };
        img.src = walls[i];
    }

    /* ---------- clock ---------- */

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function tick() {
        var now = new Date();
        els.time.textContent = (now.getHours() % 12 || 12) + ':' + pad(now.getMinutes());
        updateWallpaper();
    }

    /* ---------- start ---------- */

    els.btnAll.onclick = function () { zone = 'top'; topIndex = 0; activate(); };
    els.btnEdit.onclick = function () { zone = 'top'; topIndex = 1; activate(); };
    doc.addEventListener('keydown', onKey);
    doc.addEventListener('visibilitychange', function () {
        // Pick up apps installed or removed while NIfty was in the background.
        if (!doc.hidden) { refreshApps(); updateWallpaper(); }
    });

    updateWallpaper();
    tick();
    setInterval(tick, 10000);
    refreshApps();

    // Exposed for tests and debugging.
    global.NiftyHome = {
        state: function () {
            return { zone: zone, editing: editing, moving: moving, dock: prefs.dock.slice(),
                dockIndex: dockIndex, gridIndex: gridIndex, drawerOpen: !els.drawer.hidden };
        }
    };
}(window, document));
