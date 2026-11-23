(function () {
  'use strict';
  var app = document.getElementById('app');
  var token = location.pathname.split('/').filter(Boolean).pop() || '';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  var inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function money(n) { return inr.format(Number(n || 0)); }
  function rupees(n) { return '\u20B9' + money(n); }
  function d(s) { var p = String(s || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; }
  function dt(s) {
    var x = new Date(s);
    return isNaN(x) ? '' : x.toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function q(n) { return String(Number(n)); }

  function fail(msg) {
    app.innerHTML = '<div class="card"><div class="bar"></div><div class="pad"><h2>This link cannot be used</h2><p class="msg">' + esc(msg) + '</p></div></div>';
  }

  function render(data) {
    var s = data.snapshot, b = s.business, doc = s.doc, c = s.customer, t = s.totals;
    if (/^#[0-9a-fA-F]{6}$/.test(b.accent || '')) document.documentElement.style.setProperty('--accent', b.accent);
    document.title = (doc.title || 'Document') + ' ' + doc.number + ' | ' + (b.name || '');
    var logo = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(b.logo || '') ? b.logo : '';
    var noun = doc.type === 'INVOICE' ? 'invoice' : 'quotation';

    var rows = s.items.map(function (i) {
      return '<tr><td data-l="No">' + i.no + '</td><td data-l="Description">' + esc(i.desc) + '</td><td data-l="Unit">' + esc(i.unit) +
        '</td><td class="num" data-l="Quantity">' + money(i.qty) + '</td><td class="num" data-l="Rate">' + money(i.rate) +
        '</td><td class="num" data-l="Amount">' + money(i.amount) + '</td></tr>';
    }).join('');

    var tot = '<div><span>Subtotal</span><span>' + money(t.subtotal) + '</span></div>';
    if (t.discount) tot += '<div><span>Discount (' + q(t.discountPercent) + '%)</span><span>-' + money(t.discount) + '</span></div>';
    if (t.gst) {
      if (t.gstSplit === false) tot += '<div><span>IGST (' + q(t.gstPercent) + '%)</span><span>' + money(t.gst) + '</span></div>';
      else {
        var half = Math.round(t.gst * 100 / 2) / 100;
        tot += '<div><span>CGST (' + q(t.gstPercent / 2) + '%)</span><span>' + money(half) + '</span></div>' +
               '<div><span>SGST (' + q(t.gstPercent / 2) + '%)</span><span>' + money(Math.round((t.gst - half) * 100) / 100) + '</span></div>';
      }
    }
    if (t.roundOff) tot += '<div><span>Round off</span><span>' + money(t.roundOff) + '</span></div>';
    tot += '<div class="grand"><span>Total</span><span>' + rupees(t.total) + '</span></div>';

    function box(title, text) { return text ? '<div class="box"><h4>' + esc(title) + '</h4><p>' + esc(text) + '</p></div>' : ''; }

    var contact = [b.address, [b.phone ? 'Phone ' + b.phone : '', b.email, b.website].filter(Boolean).join(' | '),
      [b.gstin ? 'GSTIN ' + b.gstin : '', b.pan ? 'PAN ' + b.pan : ''].filter(Boolean).join(' | ')].filter(Boolean)
      .map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('');

    var action;
    if (data.signed) {
      action = '<div class="signed"><b>Signed.</b> Thank you, ' + esc(data.signed.name) + '. This ' + noun + ' was signed on ' + esc(dt(data.signed.signedAt)) +
        '. You can print or save this page for your records.</div><p class="noprint"><button type="button" class="btn small" id="printBtn">Print or save as PDF</button></p>';
    } else {
      action = '<div class="card" id="signCard"><div class="bar"></div><div class="pad"><h2>Sign this ' + noun + '</h2>' +
        '<p class="msg lead">Please read the ' + noun + ' above. Then type your name, draw your signature and tick the box.</p>' +
        '<form id="signForm"><label>Your full name<input type="text" name="name" value="' + esc(c.name) + '" maxlength="100" required autocomplete="name"></label>' +
        '<div><div class="sigtitle">Draw your signature with your finger or mouse</div><canvas id="pad" width="560" height="200" aria-label="Signature box"></canvas>' +
        '<p class="clearp"><button type="button" class="btn small" id="clear">Clear</button></p></div>' +
        '<label class="check"><input type="checkbox" name="consent"><span>I have read this ' + noun + ' and I agree to it. I understand that my typed name, drawn signature, the time and my device\u2019s IP address are recorded as my electronic signature.</span></label>' +
        '<p class="error" id="err" hidden></p>' +
        '<button class="btn primary" id="submit" type="submit">Sign and submit</button></form></div></div>';
    }

    app.innerHTML =
      '<div class="card"><div class="bar"></div><div class="pad">' +
      '<div class="head"><div class="brand">' + (logo ? '<img src="' + logo + '" alt="">' : '') + '<div><h1>' + esc(b.name) + '</h1>' + (b.tagline ? '<p>' + esc(b.tagline) + '</p>' : '') + '</div></div>' +
      '<div class="title"><h2>' + esc(doc.title) + '</h2><p><b>' + esc(doc.number) + '</b></p><p>Date ' + esc(d(doc.issueDate)) + '</p>' +
      (doc.dueDate ? '<p>' + (doc.type === 'INVOICE' ? 'Due ' : 'Valid until ') + esc(d(doc.dueDate)) + '</p>' : '') + '</div></div>' +
      '<div class="contact">' + contact + '</div>' +
      '<div class="parties"><div class="party"><h4>' + (doc.type === 'INVOICE' ? 'Bill to' : 'Prepared for') + '</h4><b>' + esc(c.name) + '</b>' +
      (c.address ? '<p>' + esc(c.address) + '</p>' : '') + '</div>' +
      '<div class="party"><h4>Project site</h4><b>' + esc(doc.site || 'Not mentioned') + '</b>' + (doc.siteAddress ? '<p>' + esc(doc.siteAddress) + '</p>' : '') +
      (doc.duration ? '<p>Work duration: ' + esc(doc.duration) + '</p>' : '') + '</div></div>' +
      '<div class="scroll"><table><thead><tr><th>No</th><th>Description of work</th><th>Unit</th><th class="num">Qty</th><th class="num">Rate (\u20B9)</th><th class="num">Amount (\u20B9)</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="totals">' + tot + '</div><p class="words">' + esc(t.words) + '</p>' +
      box('Scope of work', s.scope) + box('Exclusions', s.exclusions) + box('Payment schedule', s.paymentSchedule) + box('Warranty', s.warranty) + box('Terms and conditions', s.terms) +
      '</div></div>' + action + '<p class="foot">Private link for ' + esc(c.name) + '. Please do not share it.</p>';

    var pb = document.getElementById('printBtn');
    if (pb) pb.onclick = function () { window.print(); };
    if (!data.signed) wireForm();
  }

  function wireForm() {
    var canvas = document.getElementById('pad'), ctx = canvas.getContext('2d');
    var drawing = false, drawn = false;
    function setup() { ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111'; }
    function pos(e) { var r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * canvas.width / r.width, (e.clientY - r.top) * canvas.height / r.height]; }
    canvas.addEventListener('pointerdown', function (e) {
      drawing = true; canvas.setPointerCapture(e.pointerId);
      var p = pos(e); ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(p[0] + 0.1, p[1] + 0.1); ctx.stroke(); drawn = true; e.preventDefault();
    });
    canvas.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var p = pos(e); ctx.lineTo(p[0], p[1]); ctx.stroke(); e.preventDefault();
    });
    function stop() { drawing = false; }
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    setup();
    document.getElementById('clear').onclick = function () { ctx.clearRect(0, 0, canvas.width, canvas.height); setup(); drawn = false; };

    var err = document.getElementById('err');
    function showErr(m) { err.textContent = m; err.hidden = false; err.scrollIntoView({ block: 'nearest' }); }

    document.getElementById('signForm').addEventListener('submit', function (e) {
      e.preventDefault();
      err.hidden = true;
      var form = e.target, name = form.elements.name.value.trim();
      if (name.length < 2) return showErr('Please type your full name.');
      if (!drawn) return showErr('Please draw your signature in the box.');
      if (!form.elements.consent.checked) return showErr('Please tick the box to agree.');
      var btn = document.getElementById('submit');
      btn.disabled = true; btn.textContent = 'Saving…';
      fetch('/api/esign/sign/' + encodeURIComponent(token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'primecoat' },
        body: JSON.stringify({ name: name, consent: true, signature: canvas.toDataURL('image/png') })
      }).then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, j: j }; });
      }).then(function (res) {
        if (res.ok) { load(true); window.scrollTo(0, 0); }
        else { showErr(res.j.error || 'Something went wrong. Please try again.'); btn.disabled = false; btn.textContent = 'Sign and submit'; }
      }).catch(function () {
        showErr('Could not reach the server. Check your internet connection and try again.');
        btn.disabled = false; btn.textContent = 'Sign and submit';
      });
    });
  }

  function load() {
    fetch('/api/esign/view/' + encodeURIComponent(token), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) { if (res.ok) render(res.j); else fail(res.j.error || 'This link is not valid.'); })
      .catch(function () { fail('Could not load the document. Check your internet connection and try again.'); });
  }
  load();
})();
