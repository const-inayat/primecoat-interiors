(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var HDR = { 'X-Requested-With': 'primecoat' };
  var allCats = [];
  var page = 0;
  var editing = null;

  function api(path, opt) {
    opt = opt || {};
    opt.credentials = 'same-origin';
    opt.headers = Object.assign({}, HDR, opt.headers || {});
    return fetch(path, opt);
  }
  async function errText(r) {
    try { var j = await r.json(); return j.error || ('Error ' + r.status); } catch (e) { return 'Error ' + r.status; }
  }
  function show(id, on) { $(id).hidden = !on; }
  function note(id, text) { var n = $(id); n.textContent = text || ''; n.hidden = !text; }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  // ---------- login ----------
  function showApp(on) {
    show('app', on); show('topbtns', on); show('loginBox', !on);
    if (on) loadList(true);
  }
  api('/api/me').then(function (r) { showApp(r.ok); }).catch(function () { showApp(false); });

  $('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    note('loginErr', '');
    var r = await api('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('pw').value }) });
    if (r.ok) { $('pw').value = ''; showApp(true); } else { note('loginErr', await errText(r)); }
  });
  $('logout').addEventListener('click', async function () {
    await api('/api/logout', { method: 'POST' });
    showApp(false);
  });

  // ---------- image helpers ----------
  async function toJpeg(file, max, quality) {
    var bmp = await createImageBitmap(file);
    var scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    var w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    return new Promise(function (res, rej) {
      c.toBlob(function (b) { b ? res(b) : rej(new Error('Could not process the photo')); }, 'image/jpeg', quality);
    });
  }

  function videoPoster(file) {
    return new Promise(function (resolve) {
      var v = document.createElement('video');
      v.muted = true; v.playsInline = true; v.preload = 'metadata';
      var url = URL.createObjectURL(file);
      var done = false;
      function finish(b) { if (done) return; done = true; URL.revokeObjectURL(url); resolve(b); }
      v.addEventListener('loadeddata', function () {
        try { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); } catch (e) { finish(null); }
      });
      v.addEventListener('seeked', function () {
        try {
          var s = Math.min(1, 560 / Math.max(v.videoWidth, v.videoHeight));
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(v.videoWidth * s)); c.height = Math.max(1, Math.round(v.videoHeight * s));
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          c.toBlob(finish, 'image/jpeg', 0.72);
        } catch (e) { finish(null); }
      });
      v.addEventListener('error', function () { finish(null); });
      setTimeout(function () { finish(null); }, 8000);
      v.src = url;
    });
  }

  async function put(id, kind, body) {
    var r = await api('/api/upload/' + id + '?t=' + kind, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: body });
    if (!r.ok) throw new Error(await errText(r));
  }

  // ---------- publish ----------
  $('postForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var btn = $('publishBtn'), log = $('log');
    note('postErr', ''); note('postOk', '');
    log.innerHTML = '';
    btn.disabled = true;
    function say(t) { log.appendChild(el('li', '', t)); }
    try {
      var files = Array.prototype.slice.call($('files').files);
      var items = [];
      for (var i = 0; i < files.length; i++) {
        var f = files[i], id = crypto.randomUUID();
        if (/^image\//.test(f.type)) {
          say('Photo ' + (i + 1) + ' of ' + files.length + ': preparing and uploading…');
          var full, th;
          try { full = await toJpeg(f, 1600, 0.82); th = await toJpeg(f, 560, 0.72); }
          catch (err) { throw new Error('"' + f.name + '" could not be read. Please use a JPG or PNG photo.'); }
          await put(id, 'full', full);
          await put(id, 'thumb', th);
          items.push({ type: 'image', id: id });
        } else if (/^video\//.test(f.type)) {
          if (f.size > 25 * 1024 * 1024) throw new Error('"' + f.name + '" is larger than 25 MB. Upload it to YouTube and paste the link instead.');
          say('Video ' + (i + 1) + ' of ' + files.length + ': uploading…');
          var poster = await videoPoster(f);
          await put(id, 'video', f);
          if (poster) await put(id, 'thumb', poster);
          items.push({ type: 'video', id: id, thumb: !!poster });
        } else {
          throw new Error('"' + f.name + '" is not a photo or video.');
        }
      }
      $('youtube').value.split(/\s+/).filter(Boolean).forEach(function (u) { items.push({ type: 'youtube', url: u }); });
      if (!items.length) throw new Error('Choose at least one photo or video, or paste a YouTube link.');

      say('Publishing…');
      var r = await api('/api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: $('title').value, category: $('category').value, location: $('location').value, description: $('description').value, items: items })
      });
      if (!r.ok) throw new Error(await errText(r));
      note('postOk', 'Published. It will show on the website within about a minute.');
      $('postForm').reset();
      log.innerHTML = '';
      loadList(true);
    } catch (err) {
      note('postErr', err.message || 'Something went wrong. Please try again.');
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- list / edit / delete ----------
  function fillCats(sel, current) {
    sel.innerHTML = '';
    var list = allCats.slice();
    if (current && list.indexOf(current) < 0) list.push(current);
    list.forEach(function (c) { var o = el('option', '', c); o.value = c; sel.appendChild(o); });
    if (current) sel.value = current;
  }
  function thumbSrc(p) {
    for (var i = 0; i < p.items.length; i++) {
      var it = p.items[i];
      if (it.type === 'image' || (it.type === 'video' && it.thumb)) return '/media/t-' + it.id;
      if (it.type === 'youtube') return 'https://i.ytimg.com/vi/' + it.vid + '/hqdefault.jpg';
    }
    return '';
  }

  async function loadList(reset) {
    if (reset) { page = 0; $('plist').innerHTML = ''; }
    $('listStatus').textContent = 'Loading…';
    var r = await api('/api/posts?fresh=1&size=12&page=' + page);
    if (!r.ok) { $('listStatus').textContent = 'Could not load posts.'; return; }
    var d = await r.json();
    allCats = d.allCategories || [];
    if (!$('category').options.length) fillCats($('category'));
    $('listStatus').textContent = d.total ? '' : 'No posts yet. Your first post will appear here.';
    d.posts.forEach(function (p) {
      var li = el('li');
      var src = thumbSrc(p);
      var img = el('img'); if (src) img.src = src; img.alt = '';
      li.appendChild(img);
      var meta = el('div', 'meta');
      meta.appendChild(el('strong', '', p.title));
      var date = p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      meta.appendChild(el('small', '', [p.category, date, p.items.length + (p.items.length === 1 ? ' file' : ' files')].join(' · ')));
      li.appendChild(meta);
      var btns = el('div', 'btns');
      var eb = el('button', 'btn small', 'Edit'); eb.type = 'button';
      eb.addEventListener('click', function () { openEdit(p); });
      var db = el('button', 'btn small danger', 'Delete'); db.type = 'button';
      db.addEventListener('click', async function () {
        if (!window.confirm('Delete "' + p.title + '" and its photos and videos?')) return;
        var r2 = await api('/api/posts/' + p.id, { method: 'DELETE' });
        if (r2.ok) loadList(true); else window.alert(await errText(r2));
      });
      btns.appendChild(eb); btns.appendChild(db);
      li.appendChild(btns);
      $('plist').appendChild(li);
    });
    $('moreAdm').hidden = (page + 1) * d.size >= d.total;
  }
  $('moreAdm').addEventListener('click', function () { page += 1; loadList(false); });

  function openEdit(p) {
    editing = p;
    $('eTitle').value = p.title; $('eLocation').value = p.location || ''; $('eDescription').value = p.description || '';
    fillCats($('eCategory'), p.category);
    note('eErr', '');
    $('editDlg').showModal();
  }
  $('eCancel').addEventListener('click', function () { $('editDlg').close(); });
  $('editForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var r = await api('/api/posts/' + editing.id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: $('eTitle').value, category: $('eCategory').value, location: $('eLocation').value, description: $('eDescription').value })
    });
    if (r.ok) { $('editDlg').close(); loadList(true); } else { note('eErr', await errText(r)); }
  });

  // ---------- backup and restore ----------
  var crcTable = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = crcTable[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  // A small zip writer (files are stored, not compressed) so the backup opens in any zip program.
  function ZipBuilder() { this.parts = []; this.central = []; this.offset = 0; this.count = 0; }
  ZipBuilder.prototype.add = async function (name, blob) {
    var buf = new Uint8Array(await blob.arrayBuffer());
    var crc = crc32(buf), size = buf.length, nameBytes = new TextEncoder().encode(name);
    var d = new Date();
    var time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    var date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    var h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, time, true); h.setUint16(12, date, true); h.setUint32(14, crc, true);
    h.setUint32(18, size, true); h.setUint32(22, size, true); h.setUint16(26, nameBytes.length, true); h.setUint16(28, 0, true);
    this.parts.push(h.buffer, nameBytes, blob);
    this.central.push({ nameBytes: nameBytes, crc: crc, size: size, time: time, date: date, offset: this.offset });
    this.offset += 30 + nameBytes.length + size;
    this.count++;
  };
  ZipBuilder.prototype.finish = function () {
    var start = this.offset, total = 0;
    this.central.forEach(function (e) {
      var c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, e.time, true); c.setUint16(14, e.date, true); c.setUint32(16, e.crc, true);
      c.setUint32(20, e.size, true); c.setUint32(24, e.size, true); c.setUint16(28, e.nameBytes.length, true); c.setUint32(42, e.offset, true);
      this.parts.push(c.buffer, e.nameBytes);
      total += 46 + e.nameBytes.length;
    }, this);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, this.count, true); end.setUint16(10, this.count, true);
    end.setUint32(12, total, true); end.setUint32(16, start, true);
    this.parts.push(end.buffer);
    return new Blob(this.parts, { type: 'application/zip' });
  };

  async function readZip(file) {
    var tailLen = Math.min(file.size, 70000);
    var tail = new DataView(await file.slice(file.size - tailLen).arrayBuffer());
    var eocd = -1;
    for (var i = tailLen - 22; i >= 0; i--) { if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
    if (eocd < 0) throw new Error('This is not a backup file made by this page.');
    var count = tail.getUint16(eocd + 10, true), cdSize = tail.getUint32(eocd + 12, true), cdOff = tail.getUint32(eocd + 16, true);
    var cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
    var entries = {}, p = 0;
    for (var n = 0; n < count; n++) {
      if (cd.getUint32(p, true) !== 0x02014b50) throw new Error('The backup file is damaged.');
      var method = cd.getUint16(p + 10, true), size = cd.getUint32(p + 24, true);
      var nameLen = cd.getUint16(p + 28, true), extraLen = cd.getUint16(p + 30, true), commentLen = cd.getUint16(p + 32, true);
      var off = cd.getUint32(p + 42, true);
      var name = new TextDecoder().decode(new Uint8Array(cd.buffer, p + 46, nameLen));
      if (method !== 0) throw new Error('This backup was not made by this page.');
      entries[name] = { size: size, offset: off };
      p += 46 + nameLen + extraLen + commentLen;
    }
    return {
      entries: entries,
      read: async function (name) {
        var e = entries[name];
        var lh = new DataView(await file.slice(e.offset, e.offset + 30).arrayBuffer());
        var start = e.offset + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
        return file.slice(start, start + e.size);
      }
    };
  }

  function bkSay(t) { var log = $('bkLog'); log.innerHTML = ''; log.appendChild(el('li', '', t)); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  async function makeBackup() {
    note('bkErr', ''); note('bkOk', '');
    var btn = $('backupBtn');
    btn.disabled = true;
    try {
      bkSay('Reading your posts...');
      var posts = [], page = 0, total = 1;
      while (posts.length < total) {
        var r = await api('/api/posts?fresh=1&size=48&page=' + page);
        if (!r.ok) throw new Error(await errText(r));
        var d = await r.json();
        total = d.total; posts = posts.concat(d.posts); page++;
        if (!d.posts.length) break;
      }
      var zip = new ZipBuilder(), files = 0, want = 0, done = 0;
      posts.forEach(function (p) { p.items.forEach(function (it) { if (it.type === 'image' || it.type === 'video') want++; }); });
      for (var pi = 0; pi < posts.length; pi++) {
        var items = posts[pi].items;
        for (var ii = 0; ii < items.length; ii++) {
          var it = items[ii];
          if (it.type !== 'image' && it.type !== 'video') continue;
          done++;
          bkSay('Saving file ' + done + ' of ' + want + '...');
          var res = await fetch('/media/' + it.id, { credentials: 'same-origin', cache: 'no-store' });
          if (!res.ok) continue;   // file already missing: the post is still saved
          var blob = await res.blob();
          var ext = it.type === 'image' ? 'jpg' : ((res.headers.get('Content-Type') || '').indexOf('webm') >= 0 ? 'webm' : 'mp4');
          await zip.add('media/' + it.id + '.' + ext, blob);
          files++;
          if (it.thumb) {
            var tr = await fetch('/media/t-' + it.id, { credentials: 'same-origin', cache: 'no-store' });
            if (tr.ok) await zip.add('thumbs/' + it.id + '.jpg', await tr.blob());
          }
        }
      }
      await zip.add('posts.json', new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), posts: posts }, null, 1)], { type: 'application/json' }));
      var out = zip.finish();
      var a = document.createElement('a');
      a.href = URL.createObjectURL(out);
      a.download = 'primecoat-website-backup-' + new Date().toISOString().slice(0, 10) + '.zip';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 60000);
      $('bkLog').innerHTML = '';
      note('bkOk', 'Backup saved: ' + plural(posts.length, 'post', 'posts') + ' and ' + plural(files, 'file', 'files') + '. Keep the downloaded file somewhere safe.');
    } catch (err) {
      $('bkLog').innerHTML = '';
      note('bkErr', err.message || 'The backup did not work. Please try again.');
    } finally {
      btn.disabled = false;
    }
  }
  $('backupBtn').addEventListener('click', makeBackup);

  $('restoreFile').addEventListener('change', async function () {
    var file = this.files[0];
    this.value = '';
    if (!file) return;
    note('bkErr', ''); note('bkOk', '');
    try {
      bkSay('Reading the backup file...');
      var zip = await readZip(file);
      if (!zip.entries['posts.json']) throw new Error('This is not a website backup (posts.json is missing).');
      var data = JSON.parse(await (await zip.read('posts.json')).text());
      if (!data || data.version !== 1 || !Array.isArray(data.posts)) throw new Error('This backup file is not in a format this page understands.');
      var byId = {};
      Object.keys(zip.entries).forEach(function (name) {
        var m = /^(media|thumbs)\/([a-f0-9-]{36})\.(jpg|mp4|webm)$/.exec(name);
        if (m) { byId[m[2]] = byId[m[2]] || {}; byId[m[2]][m[1]] = name; }
      });
      var jobs = [];
      data.posts.forEach(function (p) {
        (p.items || []).forEach(function (it) {
          if ((it.type === 'image' || it.type === 'video') && byId[it.id]) jobs.push({ it: it, files: byId[it.id] });
        });
      });
      var uploaded = 0;
      for (var n = 0; n < jobs.length; n++) {
        var job = jobs[n];
        bkSay('Checking file ' + (n + 1) + ' of ' + jobs.length + '...');
        var head = await fetch('/media/' + job.it.id, { method: 'HEAD', cache: 'no-store' });
        if (!head.ok && job.files.media) {
          bkSay('Uploading file ' + (n + 1) + ' of ' + jobs.length + '...');
          await put(job.it.id, job.it.type === 'image' ? 'full' : 'video', await zip.read(job.files.media));
          uploaded++;
        }
        if (job.files.thumbs) {
          var th = await fetch('/media/t-' + job.it.id, { method: 'HEAD', cache: 'no-store' });
          if (!th.ok) await put(job.it.id, 'thumb', await zip.read(job.files.thumbs));
        }
      }
      bkSay('Restoring posts...');
      var r = await api('/api/posts/restore', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ posts: data.posts }) });
      if (!r.ok) throw new Error(await errText(r));
      var res = await r.json();
      $('bkLog').innerHTML = '';
      note('bkOk', 'Restore finished: ' + plural(res.added, 'post', 'posts') + ' added, ' + res.alreadyThere + ' already there, ' + plural(uploaded, 'file', 'files') + ' uploaded.');
      loadList(true);
    } catch (err) {
      $('bkLog').innerHTML = '';
      note('bkErr', err.message || 'The restore did not work. Please try again.');
    }
  });
})();
