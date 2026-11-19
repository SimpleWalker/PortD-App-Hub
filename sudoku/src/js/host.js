/* PortD App Hub: host.js, the small layer between an app and PortD.
   Inside PortD it uses the PortD API. Opened straight from disk in a browser, it falls back to the browser's own file
   picker, a download for saving, and localStorage for settings. Every app in the hub carries its own copy. */
(function () {
  'use strict';
  const P = typeof window.PortD === 'object' && window.PortD ? window.PortD : null;
  const Host = window.Host = { inPortD: !!P, app: P ? P.app : null };
  const LS = 'portd-hub:' + (P ? P.app.id : (document.documentElement.dataset.app || 'app')) + ':';

  /* text from what PortD.fs.read returns: files stored as binary arrive as data URLs */
  Host.decode = function (d) {
    if (typeof d !== 'string') return '';
    const m = /^data:([^,]*?)(;base64)?,/.exec(d);
    if (m && d.length < 1e9) {
      const body = d.slice(m[0].length);
      if (!m[2]) return decodeURIComponent(body);
      const bin = atob(body), bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder('utf-8').decode(bytes);
    }
    return d.replace(/^﻿/, '');
  };

  /* settings: settings.json in the data folder, or localStorage outside PortD */
  Host.loadSettings = async function (defaults) {
    let s = null;
    try { s = P ? JSON.parse(await P.fs.read('settings.json')) : JSON.parse(localStorage.getItem(LS + 'settings') || 'null'); } catch (e) { s = null; }
    return Object.assign({}, defaults, s && typeof s === 'object' ? s : {});
  };
  Host.saveSettings = async function (s) {
    try { if (P) await P.fs.write('settings.json', JSON.stringify(s, null, 1)); else localStorage.setItem(LS + 'settings', JSON.stringify(s)); return true; } catch (e) { return false; }
  };
  /* any other small piece of data the app keeps for itself */
  Host.loadData = async function (name) {
    try { return P ? (await P.fs.exists(name) ? Host.decode(await P.fs.read(name)) : null) : localStorage.getItem(LS + name); } catch (e) { return null; }
  };
  Host.saveData = async function (name, text) {
    try { if (P) await P.fs.write(name, text); else localStorage.setItem(LS + name, text); return true; } catch (e) { return false; }
  };
  Host.removeData = async function (name) {
    try { if (P) { if (await P.fs.exists(name)) await P.fs.remove(name); } else localStorage.removeItem(LS + name); } catch (e) {}
  };

  /* the names of the files in a folder of the app's own data (outside PortD: the localStorage keys under that name) */
  Host.listData = async function (dir) {
    try {
      if (P) return await P.fs.exists(dir) ? (await P.fs.list(dir)).filter(e => !e.dir).map(e => e.name) : [];
      const pre = LS + dir + '/', out = [];
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith(pre)) out.push(k.slice(pre.length)); }
      return out;
    } catch (e) { return []; }
  };

  /* a file to read: { name, path, text } or null. Outside PortD, path is null. */
  Host.readPath = async function (path, name) {
    const d = await P.fs.read(path);
    return { name: name || path.split('\\').pop(), path, text: Host.decode(d) };
  };
  Host.openFile = function (o) {
    o = o || {};
    if (P) return P.ui.openFile({ title: o.title, types: o.types }).then(f => f ? Host.readPath(f.path, f.name) : null);
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file'; if (o.types) input.accept = o.types.join(','); input.style.display = 'none';
      input.addEventListener('change', async () => { const f = input.files[0]; input.remove(); resolve(f ? { name: f.name, path: null, text: Host.decode(await f.text()) } : null); });
      input.addEventListener('cancel', () => { input.remove(); resolve(null); });
      document.body.append(input); input.click();
    });
  };
  Host.readDropped = async function (file) { return { name: file.name, path: null, text: Host.decode(await file.text()) }; };
  /* asks where to save, then writes. Resolves { name, path } or null when cancelled. Outside PortD it downloads. */
  Host.saveFile = async function (o) {
    if (P) {
      const f = await P.ui.saveFile({ title: o.title, name: o.name, types: o.types });
      if (!f) return null;
      await P.fs.write(f.path, o.text);
      return { name: f.name, path: f.path };
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([o.text], { type: o.mime || 'text/plain' }));
    a.download = o.name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return { name: o.name, path: null };
  };
  /* writes back to a file the app was given */
  Host.writePath = function (path, text) { return P.fs.write(path, text); };

  /* clipboard: PortD's frame is not given the clipboard permission (asking only logs a policy error), so inside PortD
     the older copy command is used; outside PortD the async API, then the copy command */
  Host.copy = async function (text) {
    try { if (!P && navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); Host.lastCopy = 'clipboard API'; return true; } } catch (e) { /* not allowed in a frame: fall through */ }
    const ta = document.createElement('textarea'), was = document.activeElement;
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.append(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove(); if (was && was.focus) was.focus({ preventScroll: true });
    Host.lastCopy = ok ? 'copy command' : 'nothing (blocked)';
    return ok;
  };

  Host.setTitle = function (t) { document.title = t; if (P) P.setTitle(t).catch(() => {}); };
  Host.notify = function (t) { if (P) P.notify(t).catch(() => {}); };
  Host.openUrl = function (u) { if (P) return P.openUrl(u); window.open(u, '_blank', 'noopener'); return Promise.resolve(); };
  Host.onOpenFile = function (cb) { if (P) P.onOpenFile(cb); };
  /* the file the app was started with, as { path, name, ext } (ext without the dot), or null */
  Host.startFile = function () { return P && P.app.args && P.app.args.open ? P.app.args.open : null; };

  /* theme: 'auto' follows the system, or 'light' / 'dark' */
  Host.applyTheme = function (t) {
    const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.themeChoice = t;
  };
  Host.watchTheme = function (get) { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => Host.applyTheme(get())); };
})();
