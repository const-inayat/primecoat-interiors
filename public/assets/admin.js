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
})();
