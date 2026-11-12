/* ابن فرناس — ديمو كشري التحرير ستار (بدون باك إند) */
(() => {
  'use strict';

  // ---------- Menu data ----------
  const MENU = [
    { id: 'koshari-super',  cat: 'koshari', name: 'كشري سوبر',  desc: 'الطبق الكبير بكل الإضافات', options: [{ key: 'one', label: '', price: 25 }] },
    { id: 'koshari-kamala', cat: 'koshari', name: 'كشري كمالة', desc: 'كمّل بيها وجبتك',          options: [{ key: 'one', label: '', price: 20 }] },
    { id: 'tagen-chicken',  cat: 'tagen',   name: 'طاجن فراخ',  desc: 'طاجن ساخن من الفرن',        options: [{ key: 's', label: 'صغير', price: 45 }, { key: 'l', label: 'كبير', price: 90 }] },
    { id: 'tagen-mozz',     cat: 'tagen',   name: 'طاجن فراخ موتزاريلا', desc: 'بطبقة جبنة موتزاريلا', options: [{ key: 's', label: 'صغير', price: 65 }, { key: 'l', label: 'كبير', price: 130 }] }
  ];

  const PREP_DELAY_MS = 2000; // order auto-moves to "preparing" after 2s

  // ---------- State ----------
  const state = {
    cart: {},          // lineKey -> { itemId, optKey, name, price, qty }
    orders: [],        // newest first
    nextNo: 101,
    cat: 'all',
    trackingId: null,
    unseen: { restaurant: 0, driver: 0 },
    mobileView: 'customer'
  };

  // ---------- Helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const num = n => Number(n).toLocaleString('ar-EG');
  const money = n => `${num(n)} جنيه`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const timeNow = () => new Date().toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' });
  const newCode = () => String(Math.floor(1000 + Math.random() * 9000));               // 4 digits
  const toLatinDigits = s => String(s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
  const isMobile = () => window.matchMedia('(max-width: 960px)').matches;

  const STATUS = {
    new:        { label: 'طلب جديد',     step: 0 },
    preparing:  { label: 'جاري التحضير', step: 1 },
    delivering: { label: 'مع الطيار',    step: 2 },
    delivered:  { label: 'تم التسليم',   step: 3 }
  };

  const BOWL_SVG = '<svg viewBox="0 0 24 24" width="38" height="38" aria-hidden="true"><path d="M3 11h18a9 9 0 0 1-18 0z M8 20h8 M9 8c0-1.5 1-2 1-3.5 M13 8c0-1.5 1-2 1-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const BELL_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z M10 20a2 2 0 0 0 4 0" fill="none" stroke="#1E2A5A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------- Sound (Web Audio, no files needed) ----------
  let audioCtx = null;
  function beep(times = 2) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < times; i++) {
        const t = audioCtx.currentTime + i * 0.28;
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(i % 2 ? 1046 : 880, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g).connect(audioCtx.destination);
        o.start(t); o.stop(t + 0.25);
      }
    } catch (_) { /* sound is optional */ }
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  }

  // ---------- Toasts ----------
  function toast(title, sub = '') {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div class="toast-icon">${BELL_SVG}</div><div><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
    box.prepend(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3200);
  }

  // ---------- Customer: views ----------
  function go(view) {
    const map = { menu: '#viewMenu', checkout: '#viewCheckout', track: '#viewTrack' };
    $$('.app .view').forEach(v => v.classList.remove('active'));
    $(map[view]).classList.add('active');
    $('#cartBar').hidden = view !== 'menu' || cartCount() === 0;
    if (view === 'checkout') renderCart();
    if (isMobile()) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Customer: menu ----------
  function renderMenu() {
    const list = MENU.filter(m => state.cat === 'all' || m.cat === state.cat);
    $('#menuList').innerHTML = list.map(item => `
      <li class="item">
        <div class="item-img">${BOWL_SVG}</div>
        <div class="item-body">
          <div class="item-name">${esc(item.name)}</div>
          <div class="item-desc">${esc(item.desc)}</div>
          <div class="item-actions">
            ${item.options.map(o => {
              const q = state.cart[`${item.id}:${o.key}`]?.qty || 0;
              return `<button class="add-btn" type="button" data-add="${item.id}" data-opt="${o.key}" aria-label="أضف ${esc(item.name)} ${esc(o.label)}">
                ${o.label ? esc(o.label) + ' · ' : ''}${money(o.price)}
                ${q ? `<span class="qty-pill">${num(q)}</span>` : '<span aria-hidden="true">+</span>'}
              </button>`;
            }).join('')}
          </div>
        </div>
      </li>`).join('');
  }

  // ---------- Cart ----------
  const cartLines = () => Object.values(state.cart);
  const cartCount = () => cartLines().reduce((s, l) => s + l.qty, 0);
  const cartTotal = () => cartLines().reduce((s, l) => s + l.qty * l.price, 0);

  function addToCart(itemId, optKey, delta = 1) {
    const item = MENU.find(m => m.id === itemId);
    const opt = item.options.find(o => o.key === optKey);
    const key = `${itemId}:${optKey}`;
    const line = state.cart[key] || { itemId, optKey, name: item.name + (opt.label ? ` (${opt.label})` : ''), price: opt.price, qty: 0 };
    line.qty += delta;
    if (line.qty <= 0) delete state.cart[key]; else state.cart[key] = line;
    updateCartUI();
  }

  function updateCartUI() {
    const c = cartCount();
    $('#cartCount').textContent = num(c);
    $('#cartBarTotal').textContent = money(cartTotal());
    $('#cartBar').hidden = c === 0 || !$('#viewMenu').classList.contains('active');
    renderMenu();
    if ($('#viewCheckout').classList.contains('active')) renderCart();
  }

  function renderCart() {
    if (!cartLines().length) { go('menu'); return; }
    $('#cartList').innerHTML = Object.entries(state.cart).map(([key, l]) => `
      <li class="cart-row">
        <span class="name">${esc(l.name)}</span>
        <div class="stepper">
          <button type="button" data-inc="${key}" aria-label="زيادة">+</button>
          <span>${num(l.qty)}</span>
          <button type="button" data-dec="${key}" aria-label="تقليل">−</button>
        </div>
        <span class="price">${money(l.qty * l.price)}</span>
      </li>`).join('');
    $('#cartTotal').textContent = money(cartTotal());
  }

  // ---------- Place order ----------
  function placeOrder(form) {
    const data = Object.fromEntries(new FormData(form));
    if (!data.name.trim() || !data.phone.trim() || !data.address.trim()) {
      $('#formError').hidden = false;
      return;
    }
    $('#formError').hidden = true;

    const order = {
      id: Date.now(),
      no: state.nextNo++,
      code: newCode(),
      time: timeNow(),
      items: cartLines().map(l => ({ name: l.name, qty: l.qty, price: l.price })),
      total: cartTotal(),
      customer: { name: data.name.trim(), phone: data.phone.trim(), address: data.address.trim(), notes: (data.notes || '').trim() },
      status: 'new'
    };
    state.orders.unshift(order);
    state.cart = {};
    state.trackingId = order.id;
    form.reset();
    updateCartUI();

    // Customer side
    renderTracking();
    go('track');

    // Restaurant side
    beep(3);
    toast(`وصل للمطعم طلب جديد #${num(order.no)}`, `${order.customer.name} · ${money(order.total)}`);
    bumpUnseen('restaurant');
    renderAll();

    // Auto "preparing" after 2 seconds
    setTimeout(() => {
      if (order.status === 'new') setStatus(order.id, 'preparing');
    }, PREP_DELAY_MS);
  }

  function setStatus(id, status) {
    const o = state.orders.find(x => x.id === id);
    if (!o) return;
    o.status = status;
    if (status === 'delivering') bumpUnseen('driver');
    renderAll();
    const msg = {
      preparing:  ['طلبك جاري التحضير', 'المطعم قبل طلبك وبدأ يجهّزه'],
      delivering: ['طلبك خرج للتوصيل', 'جهّز كود التسليم علشان تقوله للطيار'],
      delivered:  ['تم تسليم الطلب بالكود', 'بالهنا والشفا']
    }[status];
    if (msg) { toast(msg[0] + ` #${num(o.no)}`, msg[1]); beep(1); }
  }

  // ---------- Driver: confirm with code ----------
  function confirmDelivery(form) {
    const id = Number(form.dataset.id);
    const o = state.orders.find(x => x.id === id);
    if (!o) return;
    const entered = toLatinDigits(form.code.value);
    const err = $('.code-error', form);
    if (entered !== o.code) {
      err.hidden = false;
      err.textContent = entered.length < 4 ? 'اكتب الكود كامل (٤ أرقام).' : 'الكود غلط، اتأكد منه مع الزبون.';
      form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      form.code.select();
      return;
    }
    setStatus(id, 'delivered');
  }

  // ---------- Customer: tracking ----------
  function renderTracking() {
    const o = state.orders.find(x => x.id === state.trackingId);
    if (!o) return;
    $('#trackNo').textContent = '#' + num(o.no);
    const step = STATUS[o.status].step;
    $$('#trackSteps li').forEach((li, i) => {
      const done = i === 0 || i < step || o.status === 'delivered';
      li.classList.toggle('done', done);
      li.classList.toggle('current', !done && i === Math.max(step, 1));
    });

    const delivered = o.status === 'delivered';
    $('#deliveryCode').textContent = o.code;
    $('#codeBox').classList.toggle('used', delivered);
    $('#codeLabel').textContent = delivered ? 'تم التسليم بالكود' : 'كود التسليم';
    $('#codeHint').textContent = delivered
      ? 'الطيار أكّد التسليم بالكود بتاعك. بالهنا والشفا!'
      : 'قول الكود ده للطيار لما يوصلك، علشان يأكد إن الطلب اتسلّم ليك.';

    $('#trackSummary').innerHTML =
      o.items.map(i => `${num(i.qty)} × ${esc(i.name)}`).join('<br>') +
      `<br><b style="color:#1F1F1F">الإجمالي: ${money(o.total)}</b> · كاش عند الاستلام`;
  }

  // ---------- Restaurant: orders ----------
  function itemsHTML(o) {
    return `<ul class="order-items">
      ${o.items.map(i => `<li><span>${esc(i.name)} <span class="q">× ${num(i.qty)}</span></span><span>${money(i.qty * i.price)}</span></li>`).join('')}
    </ul>`;
  }

  function renderOrders() {
    const list = $('#ordersList');
    $('#ordersEmpty').hidden = state.orders.length > 0;
    $$('.order', list).forEach(el => el.remove());

    const html = state.orders.map(o => {
      const footer = {
        new:        `<div class="order-actions"><button type="button" data-status="preparing" data-id="${o.id}">قبول الطلب</button></div>`,
        preparing:  `<div class="order-actions"><button type="button" class="secondary" data-status="delivering" data-id="${o.id}">خرج للتوصيل</button></div>`,
        delivering: `<div class="waiting-code">الطلب مع الطيار · التسليم بيتأكد بكود الزبون</div>`,
        delivered:  `<div class="delivered-note">اتسلّم للزبون واتأكد بالكود</div>`
      }[o.status];
      const enter = o.shownInRestaurant ? '' : ' enter';
      o.shownInRestaurant = true;
      return `
      <article class="order is-${o.status}${enter}">
        <div class="order-top">
          <div>
            <div class="order-no">طلب #${num(o.no)}</div>
            <div class="order-time">${esc(o.time)}</div>
          </div>
          <span class="status ${o.status}">${STATUS[o.status].label}</span>
        </div>
        ${itemsHTML(o)}
        <div class="order-total"><span>الإجمالي</span><span>${money(o.total)}</span></div>
        <div class="order-cust">
          <div>الاسم: <b>${esc(o.customer.name)}</b></div>
          <div>الموبايل: <b dir="ltr">${esc(o.customer.phone)}</b></div>
          <div>العنوان: <b>${esc(o.customer.address)}</b></div>
          ${o.customer.notes ? `<div>ملاحظات: <b>${esc(o.customer.notes)}</b></div>` : ''}
          <div>الدفع: <b>كاش عند الاستلام</b></div>
        </div>
        ${footer}
      </article>`;
    }).join('');
    list.insertAdjacentHTML('beforeend', html);

    $('#statCount').textContent = num(state.orders.length);
    $('#statTotal').textContent = money(state.orders.reduce((s, o) => s + o.total, 0));
  }

  // ---------- Driver: deliveries ----------
  function renderDriver() {
    const list = $('#driverList');
    // keep whatever the driver already typed
    const typed = {};
    $$('.code-form', list).forEach(f => { typed[f.dataset.id] = f.code.value; });

    const mine = state.orders.filter(o => o.status === 'delivering');
    $('#driverEmpty').hidden = mine.length > 0;
    $$('.order', list).forEach(el => el.remove());

    list.insertAdjacentHTML('beforeend', mine.map(o => {
      const enter = o.shownToDriver ? '' : ' enter';
      o.shownToDriver = true;
      return `
      <article class="order is-delivering${enter}">
        <div class="order-top">
          <div class="order-no">طلب #${num(o.no)}</div>
          <span class="status delivering">في الطريق</span>
        </div>
        <div class="order-cust">
          <div>الزبون: <b>${esc(o.customer.name)}</b></div>
          <div>العنوان: <b>${esc(o.customer.address)}</b></div>
          <div>الموبايل: <a class="call-link" href="tel:${esc(o.customer.phone)}" dir="ltr">${esc(o.customer.phone)}</a></div>
        </div>
        <div class="collect"><span>حصّل من الزبون</span><span>${money(o.total)}</span></div>
        <form class="code-form" data-id="${o.id}" novalidate>
          <label for="code-${o.id}">اطلب كود التسليم من الزبون واكتبه هنا</label>
          <input class="code-input" id="code-${o.id}" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="4" dir="ltr" placeholder="----" value="${esc(typed[o.id] || '')}">
          <button type="submit">تأكيد التسليم</button>
          <p class="code-error" hidden></p>
        </form>
      </article>`;
    }).join(''));
  }

  function renderAll() {
    renderOrders();
    renderDriver();
    renderTracking();
  }

  // ---------- Mobile view switch ----------
  const PANES = { customer: '#paneCustomer', restaurant: '#paneRestaurant', driver: '#paneDriver' };
  function switchView(view) {
    state.mobileView = view;
    $$('.switch-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    Object.entries(PANES).forEach(([k, sel]) => $(sel).classList.toggle('active', k === view));
    if (state.unseen[view] !== undefined) { state.unseen[view] = 0; updateBadges(); }
    window.scrollTo({ top: 0 });
  }
  function bumpUnseen(view) {
    if (isMobile() && state.mobileView !== view) { state.unseen[view]++; updateBadges(); }
  }
  function updateBadges() {
    [['restaurant', '#badgeRestaurant'], ['driver', '#badgeDriver']].forEach(([k, sel]) => {
      const b = $(sel);
      b.hidden = state.unseen[k] === 0;
      b.textContent = num(state.unseen[k]);
    });
  }

  // ---------- Events ----------
  document.addEventListener('click', e => {
    const t = e.target.closest('button');
    if (!t) return;

    if (t.dataset.add) { addToCart(t.dataset.add, t.dataset.opt, 1); return; }
    if (t.dataset.inc) { const [i, o] = t.dataset.inc.split(':'); addToCart(i, o, 1); return; }
    if (t.dataset.dec) { const [i, o] = t.dataset.dec.split(':'); addToCart(i, o, -1); return; }
    if (t.dataset.go) { go(t.dataset.go); return; }
    if (t.dataset.view) { switchView(t.dataset.view); return; }
    if (t.dataset.status) { setStatus(Number(t.dataset.id), t.dataset.status); return; }
    if (t.dataset.cat) {
      state.cat = t.dataset.cat;
      $$('.cat').forEach(c => c.classList.toggle('active', c === t));
      renderMenu();
      return;
    }
    if (t.id === 'cartBar') { go('checkout'); return; }
    if (t.id === 'fillDemo') {
      const f = $('#orderForm');
      f.name.value = 'أحمد محمود';
      f.phone.value = '01012345678';
      f.address.value = 'شارع التحرير، عمارة ٥، الدور التالت';
      f.notes.value = 'شطة ودقة زيادة';
    }
  });

  document.addEventListener('submit', e => {
    e.preventDefault();
    if (e.target.id === 'orderForm') placeOrder(e.target);
    else if (e.target.matches('.code-form')) confirmDelivery(e.target);
  });

  // ---------- Init ----------
  renderMenu();
  renderOrders();
  renderDriver();
})();
