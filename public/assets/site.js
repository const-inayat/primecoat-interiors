(function () {
  'use strict';
  var PC = window.PC || {};

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ---- social links come from config.js ----
  $$('[data-social]').forEach(function (a) {
    var u = PC[a.getAttribute('data-social')];
    if (u) a.href = u;
  });
  $$('[data-wa]').forEach(function (a) {
    a.href = 'https://wa.me/' + (PC.whatsapp || '918800961972') + '?text=' +
      encodeURIComponent('Hello PrimeCoat Interiors, I need a painting quote.');
  });

  // ---- nav ----
  var nav = $('#nav');
  if (nav) {
    var onScroll = function () { nav.classList.toggle('solid', window.scrollY > 30 || nav.hasAttribute('data-solid')); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    var burger = $('#burger'), menu = $('#menu');
    if (burger && menu) {
      burger.addEventListener('click', function () {
        var open = menu.classList.toggle('open');
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      $$('a', menu).forEach(function (a) {
        a.addEventListener('click', function () { menu.classList.remove('open'); burger.setAttribute('aria-expanded', 'false'); });
      });
    }
  }

  // ---- scroll reveal ----
  var revealEls = $$('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12 });
    revealEls.forEach(function (n) { io.observe(n); });
  } else {
    revealEls.forEach(function (n) { n.classList.add('in'); });
  }

  // ---- room colour visualiser ----
  var wall = $('#roomWall'), chips = $('#chips');
  if (wall && chips) {
    var shades = [['Sage Mist', '#a9bfa8'], ['Clay Rose', '#d9a79a'], ['Sky Wash', '#a9cbe0'], ['Sun Yellow', '#f2c94c'],
                  ['Deep Teal', '#1f5f6b'], ['Warm Grey', '#b9b5ae'], ['Soft Lilac', '#c5b6dd'], ['Midnight', '#26384a']];
    var nameEl = $('#roomName');
    shades.forEach(function (s, i) {
      var b = el('button', 'chip');
      b.type = 'button';
      b.style.background = s[1];
      b.setAttribute('aria-label', s[0]);
      b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
      b.addEventListener('click', function () {
        wall.style.fill = s[1];
        nameEl.textContent = s[0];
        $$('.chip', chips).forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
        b.setAttribute('aria-pressed', 'true');
      });
      chips.appendChild(b);
    });
  }

  // ---- quote form -> WhatsApp ----
  var qf = $('#quoteForm');
  if (qf) {
    qf.addEventListener('submit', function (e) {
      e.preventDefault();
      var d = new FormData(qf);
      var msg = 'Hello PrimeCoat Interiors, I am ' + d.get('name') + ' from ' + d.get('area') +
        '. I need a quote for: ' + d.get('work') + '.' + (d.get('details') ? ' Details: ' + d.get('details') : '');
      window.open('https://wa.me/' + (PC.whatsapp || '918800961972') + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
    });
  }

  // ---- gallery ----
  var SAMPLES = [
    ['Panel wall and ceiling finish', 'Interior Painting', 'work1'],
    ['Textured and coloured feature walls', 'Texture & Decorative', 'work2'],
    ['Decorative statue finish', 'Murals & Wall Art', 'work3'],
    ['Clean white interior', 'Interior Painting', 'work4'],
    ['Kids’ room mural', 'Murals & Wall Art', 'work5'],
    ['Metallic copper finish', 'Metallic & Special Finish', 'work6']
  ].map(function (s, i) {
    return { id: 'sample' + i, title: s[0], category: s[1], sample: true,
             items: [{ type: 'static', src: '/assets/samples/' + s[2] + '.jpg' }] };
  });

  function thumbOf(it) {
    if (it.type === 'static') return it.src;
    if (it.type === 'image') return '/media/t-' + it.id;
    if (it.type === 'video') return it.thumb ? '/media/t-' + it.id : '';
    if (it.type === 'youtube') return 'https://i.ytimg.com/vi/' + it.vid + '/hqdefault.jpg';
    return '';
  }
  function cover(p) {
    for (var i = 0; i < p.items.length; i++) { if (thumbOf(p.items[i])) return p.items[i]; }
    return p.items[0];
  }
  function fmtDate(s) {
    if (!s) return '';
    var d = new Date(s);
    return isNaN(d) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  var lb = $('#lb');
  function openPost(p) {
    if (!lb || !lb.showModal) return;
    var body = $('.lbbody', lb);
    body.innerHTML = '';
    p.items.forEach(function (it) {
      var n;
      if (it.type === 'video') {
        n = el('video'); n.controls = true; n.playsInline = true; n.preload = 'metadata';
        n.src = '/media/' + it.id;
        if (it.thumb) n.poster = '/media/t-' + it.id;
      } else if (it.type === 'youtube') {
        n = el('iframe'); n.src = 'https://www.youtube-nocookie.com/embed/' + it.vid;
        n.title = p.title; n.loading = 'lazy'; n.allowFullscreen = true;
        n.setAttribute('allow', 'encrypted-media; picture-in-picture');
        n.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      } else {
        n = el('img'); n.alt = p.title;
        n.src = it.type === 'static' ? it.src : '/media/' + it.id;
      }
      body.appendChild(n);
    });
    var meta = [p.category, p.location, fmtDate(p.createdAt)].filter(Boolean).join(' · ');
    $('.lbtitle', lb).textContent = p.title;
    $('.lbmeta', lb).textContent = meta;
    $('.lbdesc', lb).textContent = p.description || '';
    lb.showModal();
  }
  if (lb) {
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
    lb.addEventListener('close', function () { $('.lbbody', lb).innerHTML = ''; });
    $('.lbclose', lb).addEventListener('click', function () { lb.close(); });
  }

  function tile(p) {
    var b = el('button', 'tile');
    b.type = 'button';
    b.setAttribute('aria-label', 'Open ' + p.title);
    var c = cover(p), src = c ? thumbOf(c) : '';
    if (src) {
      var img = el('img'); img.src = src; img.alt = ''; img.loading = 'lazy'; img.decoding = 'async';
      b.appendChild(img);
    } else {
      b.appendChild(el('div', 'ph', 'Video'));
    }
    var badge = '';
    if (c && (c.type === 'video' || c.type === 'youtube')) badge = '▶ Video';
    else if (p.items.length > 1) badge = '+' + (p.items.length - 1);
    if (badge) b.appendChild(el('span', 'badge', badge));
    var cap = el('div', 'cap');
    cap.appendChild(el('small', '', p.category));
    cap.appendChild(el('strong', '', p.title));
    b.appendChild(cap);
    b.addEventListener('click', function () { openPost(p); });
    return b;
  }

  function fetchPosts(params) {
    var q = Object.keys(params).filter(function (k) { return params[k] !== '' && params[k] != null; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
    return fetch('/api/posts?' + q, { headers: { Accept: 'application/json' } }).then(function (r) {
      if (!r.ok) throw new Error('bad');
      return r.json();
    });
  }

  var g = $('#gallery');
  if (g) {
    var mode = g.getAttribute('data-mode');          // "home" or "work"
    var size = mode === 'home' ? 6 : 12;
    var state = { category: '', page: 0 };
    var filters = $('#filters'), moreBtn = $('#more'), status = $('#gstatus');

    var renderFilters = function (cats) {
      if (!filters) return;
      filters.innerHTML = '';
      var mk = function (label, val) {
        var b = el('button', state.category === val ? 'on' : '', label);
        b.type = 'button';
        b.addEventListener('click', function () { state.category = val; state.page = 0; load(true); });
        filters.appendChild(b);
      };
      mk('Latest', '');
      cats.forEach(function (c) { mk(c, c); });
    };

    var showSamples = function () {
      g.innerHTML = '';
      SAMPLES.slice(0, size).forEach(function (p) { g.appendChild(tile(p)); });
      if (filters) filters.innerHTML = '';
      if (moreBtn) moreBtn.hidden = true;
      status.textContent = '';
    };

    var load = function (reset) {
      status.textContent = 'Loading…';
      fetchPosts({ category: state.category, page: state.page, size: size }).then(function (res) {
        status.textContent = '';
        if (reset) g.innerHTML = '';
        if (!res.posts.length && !state.category && state.page === 0) { showSamples(); return; }
        res.posts.forEach(function (p) { g.appendChild(tile(p)); });
        if (!res.posts.length && reset) status.textContent = 'Nothing posted in this category yet.';
        if (mode === 'work') renderFilters(res.categories || []);
        if (moreBtn) moreBtn.hidden = (state.page + 1) * size >= res.total;
      }).catch(function () { if (reset) showSamples(); else status.textContent = 'Could not load more.'; });
    };

    if (moreBtn) moreBtn.addEventListener('click', function () { state.page += 1; load(false); });
    load(true);
  }
})();
