/* ابن فرناس — ديمو أغا للمأكولات الشامية (بدون باك إند) */
(() => {
  'use strict';

  // ---------- Data (from Agha's printed menu) ----------
  const BRANCHES = [
    { id: 'army',   name: 'دسوق – شارع الجيش',     near: 'بجوار مستشفى النيل' },
    { id: 'cinema', name: 'دسوق – شارع السينما',   near: 'بجوار صيدلية الشعب' },
    { id: 'itay',   name: 'إيتاي البارود – رمسيس', near: 'بجوار المدرسة المشتركة' }
  ];

  const CATS = [
    { id: 'grill',  name: 'المشويات', note: 'يقدم مع جميع الوجبات: خبز + تومية + بطاطس + مخلل', img: 'assets/chicken.jpg' },
    { id: 'crepe',  name: 'الكريبات', note: '', img: 'assets/crepe.jpg' },
    { id: 'extras', name: 'الإضافات', note: '', img: '' }
  ];

  const MENU = [
    { id: 'g1', cat: 'grill', name: 'فرخة كاملة شواية', price: 350 },
    { id: 'g2', cat: 'grill', name: 'نص فرخة شواية', price: 190 },
    { id: 'g3', cat: 'grill', name: 'ربع صدر شواية', price: 120 },
    { id: 'g4', cat: 'grill', name: 'ربع ورك شواية', price: 105 },
    { id: 'c1', cat: 'crepe', name: 'كريب شاورما', price: 110 },
    { id: 'c2', cat: 'crepe', name: 'كريب كرسبي', price: 110 },
    { id: 'c3', cat: 'crepe', name: 'كريب زنجر', price: 110 },
    { id: 'c4', cat: 'crepe', name: 'كريب بانيه', price: 110 },
    { id: 'c5', cat: 'crepe', name: 'كريب فاهيتا', price: 100 },
    { id: 'c6', cat: 'crepe', name: 'كريب برجر فراخ', price: 85 },
    { id: 'c7', cat: 'crepe', name: 'كريب برجر لحمة', price: 85 },
    { id: 'c8', cat: 'crepe', name: 'كريب سجق', price: 85 },
    { id: 'c9', cat: 'crepe', name: 'كريب ميكس لحوم', price: 120 },
    { id: 'c10', cat: 'crepe', name: 'كريب ميكس فراخ', price: 120 },
    { id: 'c11', cat: 'crepe', name: 'كريب سوسيس', price: 70 },
    { id: 'c12', cat: 'crepe', name: 'كريب بطاطس موتزاريلا', price: 70 },
    { id: 'c13', cat: 'crepe', name: 'كريب شيكولاتة', price: 60 },
    { id: 'e1', cat: 'extras', name: 'طبق أرز', price: 30 },
    { id: 'e2', cat: 'extras', name: 'تومية', price: 20 },
    { id: 'e3', cat: 'extras', name: 'عيش', price: 3.5 },
    { id: 'e4', cat: 'extras', name: 'مخلل', price: 5 },
    { id: 'e5', cat: 'extras', name: 'باكيت بطاطس', price: 25 }
  ];
  const UPSELL = ['e2', 'e5', 'e1'];
  const PREP_DELAY_MS = 2000;

  // ---------- State ----------
  const state = {
    branch: 'army',
    cat: 'all',
    cart: {},              // itemId -> qty
    upsellShown: false,
    orders: [],
    nextNo: 101,
    trackingId: null,
    dashBranch: 'all',
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
  const newCode = () => String(Math.floor(1000 + Math.random() * 9000));
  const toLatinDigits = s => String(s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/\D/g, '');
  const isMobile = () => window.matchMedia('(max-width: 980px)').matches;
  const item = id => MENU.find(m => m.id === id);
  const branch = id => BRANCHES.find(b => b.id === id);
  const catOf = id => CATS.find(c => c.id === id);

  const STATUS = {
    new:        { label: 'طلب جديد',     step: 0 },
    preparing:  { label: 'جاري التحضير', step: 1 },
    delivering: { label: 'مع الطيار',    step: 2 },
    delivered:  { label: 'تم التسليم',   step: 3 }
  };
  const BELL_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z M10 20a2 2 0 0 0 4 0" fill="none" stroke="#241E3F" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const PLUS_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>';
  const DISH_SVG = '<svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M3 13h18a9 8 0 0 1-18 0z M12 5v3 M8 20h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ---------- Sound ----------
  let audioCtx = null;
  function beep(times = 2) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < times; i++) {
        const t = audioCtx.currentTime + i * 0.28;
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.setValueAtTime(i % 2 ? 1046 : 880, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 0.25);
      }
    } catch (_) { /* optional */ }
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  }

  function toast(title, sub = '') {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<div class="toast-icon">${BELL_SVG}</div><div><b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>`;
    $('#toasts').prepend(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 3200);
  }

  // ---------- Customer: branches + categories ----------
  function renderBranches() {
    $('#branchChips').innerHTML = BRANCHES.map(b =>
      `<button type="button" class="branch${b.id === state.branch ? ' active' : ''}" data-branch="${b.id}">${esc(b.name)}<small>${esc(b.near)}</small></button>`).join('');
  }
  function renderCats() {
    const all = [{ id: 'all', name: 'الكل' }, ...CATS];
    $('#catChips').innerHTML = all.map(c => `<button type="button" class="cat${c.id === state.cat ? ' active' : ''}" data-cat="${c.id}">${esc(c.name)}</button>`).join('');
  }

  function renderMenu() {
    const cats = CATS.filter(c => state.cat === 'all' || c.id === state.cat);
    $('#menuList').innerHTML = cats.map(c => `
      <section class="menu-sec">
        <h3>${esc(c.name)}</h3>
        ${c.note ? `<p class="sec-note">${esc(c.note)}</p>` : ''}
        <ul class="menu">
          ${MENU.filter(m => m.cat === c.id).map(m => {
            const q = state.cart[m.id] || 0;
            return `<li class="item">
              <div class="item-img">${c.img ? `<img src="${c.img}" alt="" loading="lazy">` : DISH_SVG}</div>
              <div class="item-body"><div class="item-name">${esc(m.name)}</div><div class="item-price">${money(m.price)}</div></div>
              <button class="add-btn${q ? ' has' : ''}" type="button" data-add="${m.id}" aria-label="أضف ${esc(m.name)}">${q ? num(q) : PLUS_SVG}</button>
            </li>`;
          }).join('')}
        </ul>
      </section>`).join('');
  }

  // ---------- Cart ----------
  const cartIds = () => Object.keys(state.cart);
  const cartCount = () => cartIds().reduce((s, id) => s + state.cart[id], 0);
  const cartTotal = () => cartIds().reduce((s, id) => s + state.cart[id] * item(id).price, 0);

  function addToCart(id, delta = 1, fromUpsell = false) {
    const q = (state.cart[id] || 0) + delta;
    if (q <= 0) delete state.cart[id]; else state.cart[id] = q;
    updateCartUI();
    if (delta > 0 && !fromUpsell && !state.upsellShown && item(id).cat !== 'extras') {
      state.upsellShown = true;
      setTimeout(openUpsell, 250);
    }
  }

  function updateCartUI() {
    const c = cartCount();
    $('#cartCount').textContent = num(c);
    $('#cartBarTotal').textContent = money(cartTotal());
    $('#cartBar').hidden = c === 0 || !$('#viewMenu').classList.contains('active');
    renderMenu();
    if ($('#viewCheckout').classList.contains('active')) renderCart();
    if (!$('#upsell').hidden) renderUpsell();
  }

  function openUpsell() { renderUpsell(); $('#upsell').hidden = false; }
  function closeUpsell() { $('#upsell').hidden = true; }
  function renderUpsell() {
    $('#upsellList').innerHTML = UPSELL.map(id => {
      const m = item(id), q = state.cart[id] || 0;
      return `<div class="upsell-item"><span>${esc(m.name)}<small>${money(m.price)}</small></span>
        <button type="button" class="${q ? 'added' : ''}" data-upsell="${id}">${q ? 'اتضاف ✓' : 'ضيف'}</button></div>`;
    }).join('');
  }

  function renderCart() {
    if (!cartIds().length) { go('menu'); return; }
    $('#checkoutBranch').textContent = `التحضير والتوصيل من فرع ${branch(state.branch).name}`;
    $('#cartList').innerHTML = cartIds().map(id => `
      <li class="cart-row">
        <span class="name">${esc(item(id).name)}</span>
        <div class="stepper">
          <button type="button" data-inc="${id}" aria-label="زيادة">+</button>
          <span>${num(state.cart[id])}</span>
          <button type="button" data-dec="${id}" aria-label="تقليل">−</button>
        </div>
        <span class="price">${money(state.cart[id] * item(id).price)}</span>
      </li>`).join('');
    $('#cartTotal').textContent = money(cartTotal());
  }

  function go(view) {
    const map = { menu: '#viewMenu', checkout: '#viewCheckout', track: '#viewTrack' };
    $$('.app .view').forEach(v => v.classList.remove('active'));
    $(map[view]).classList.add('active');
    $(map[view]).scrollTop = 0;
    $('#cartBar').hidden = view !== 'menu' || cartCount() === 0;
    if (view === 'checkout') renderCart();
    if (isMobile()) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ---------- Place order ----------
  function placeOrder(form) {
    const data = Object.fromEntries(new FormData(form));
    if (!data.name.trim() || !data.phone.trim() || !data.address.trim()) { $('#formError').hidden = false; return; }
    $('#formError').hidden = true;

    const order = {
      id: Date.now(),
      no: state.nextNo++,
      code: newCode(),
      branch: state.branch,
      time: timeNow(),
      items: cartIds().map(id => ({ name: item(id).name, qty: state.cart[id], price: item(id).price, extra: item(id).cat === 'extras' })),
      total: cartTotal(),
      customer: { name: data.name.trim(), phone: data.phone.trim(), address: data.address.trim(), notes: (data.notes || '').trim() },
      status: 'new'
    };
    state.orders.unshift(order);
    state.cart = {};
    state.upsellShown = false;
    state.trackingId = order.id;
    form.reset();
    updateCartUI();
    go('track');

    beep(3);
    toast(`طلب جديد #${num(order.no)} لفرع ${branch(order.branch).name}`, `${order.customer.name} · ${money(order.total)}`);
    bumpUnseen('restaurant');
    renderAll();

    setTimeout(() => { if (order.status === 'new') setStatus(order.id, 'preparing'); }, PREP_DELAY_MS);
  }

  function setStatus(id, status) {
    const o = state.orders.find(x => x.id === id);
    if (!o) return;
    o.status = status;
    if (status === 'delivering') bumpUnseen('driver');
    renderAll();
    const msg = {
      preparing:  ['طلبك جاري التحضير', 'الفرع قبل طلبك وبدأ يجهّزه'],
      delivering: ['طلبك خرج للتوصيل', 'جهّز كود التسليم علشان تقوله للطيار'],
      delivered:  ['تم تسليم الطلب بالكود', 'بالهنا والشفا']
    }[status];
    if (msg) { toast(`${msg[0]} #${num(o.no)}`, msg[1]); beep(1); }
  }

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
    $('#trackBranch').textContent = 'فرع ' + branch(o.branch).name;
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
    $('#codeHint').textContent = delivered ? 'الطيار أكّد التسليم بالكود بتاعك. بالهنا والشفا!' : 'قول الكود ده للطيار لما يوصلك، علشان يأكد إن الطلب اتسلّم ليك.';
    $('#trackSummary').innerHTML = o.items.map(i => `${num(i.qty)} × ${esc(i.name)}`).join('<br>') +
      `<br><b style="color:#1F1F1F">الإجمالي: ${money(o.total)}</b> · كاش عند الاستلام`;
  }

  // ---------- Branch dashboard ----------
  function renderBranchFilter() {
    const count = id => state.orders.filter(o => o.branch === id && o.status !== 'delivered').length;
    const all = [{ id: 'all', name: 'كل الفروع' }, ...BRANCHES];
    $('#branchFilter').innerHTML = all.map(b => {
      const n = b.id === 'all' ? state.orders.filter(o => o.status !== 'delivered').length : count(b.id);
      return `<button type="button" class="bf${b.id === state.dashBranch ? ' active' : ''}" data-dash="${b.id}">${esc(b.name)}${n ? `<span class="n">${num(n)}</span>` : ''}</button>`;
    }).join('');
  }

  function renderOrders() {
    renderBranchFilter();
    const list = $('#ordersList');
    const shown = state.orders.filter(o => state.dashBranch === 'all' || o.branch === state.dashBranch);
    $('#ordersEmpty').hidden = shown.length > 0;
    $$('.order', list).forEach(el => el.remove());
    list.insertAdjacentHTML('beforeend', shown.map(o => {
      const footer = {
        new:        `<div class="order-actions"><button type="button" data-status="preparing" data-id="${o.id}">قبول الطلب</button></div>`,
        preparing:  `<div class="order-actions"><button type="button" class="secondary" data-status="delivering" data-id="${o.id}">خرج للتوصيل</button></div>`,
        delivering: `<div class="waiting-code">الطلب مع الطيار · التسليم بيتأكد بكود الزبون</div>`,
        delivered:  `<div class="delivered-note">اتسلّم للزبون واتأكد بالكود</div>`
      }[o.status];
      const enter = o.shownR ? '' : ' enter'; o.shownR = true;
      return `<article class="order is-${o.status}${enter}">
        <div class="order-top">
          <div>
            <div class="order-no">طلب #${num(o.no)}</div>
            <div class="order-time">${esc(o.time)}</div>
            <span class="order-branch">فرع ${esc(branch(o.branch).name)}</span>
          </div>
          <span class="status ${o.status}">${STATUS[o.status].label}</span>
        </div>
        <ul class="order-items">
          ${o.items.map(i => `<li><span>${esc(i.name)} <span class="q">× ${num(i.qty)}</span>${i.extra ? '<span class="extra">إضافة</span>' : ''}</span><span>${money(i.qty * i.price)}</span></li>`).join('')}
        </ul>
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
    }).join(''));

    $('#statCount').textContent = num(shown.length);
    $('#statTotal').textContent = money(shown.reduce((s, o) => s + o.total, 0));
    $('#statExtras').textContent = num(shown.reduce((s, o) => s + o.items.filter(i => i.extra).reduce((a, i) => a + i.qty, 0), 0));
  }

  // ---------- Driver ----------
  function renderDriver() {
    const list = $('#driverList');
    const typed = {};
    $$('.code-form', list).forEach(f => { typed[f.dataset.id] = f.code.value; });
    const mine = state.orders.filter(o => o.status === 'delivering');
    $('#driverEmpty').hidden = mine.length > 0;
    $$('.order', list).forEach(el => el.remove());
    list.insertAdjacentHTML('beforeend', mine.map(o => {
      const enter = o.shownD ? '' : ' enter'; o.shownD = true;
      return `<article class="order is-delivering${enter}">
        <div class="order-top">
          <div><div class="order-no">طلب #${num(o.no)}</div><span class="order-branch">من فرع ${esc(branch(o.branch).name)}</span></div>
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

  function renderAll() { renderOrders(); renderDriver(); renderTracking(); }

  // ---------- Mobile switch ----------
  const PANES = { customer: '#paneCustomer', restaurant: '#paneRestaurant', driver: '#paneDriver' };
  function switchView(view) {
    state.mobileView = view;
    $$('.switch-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    Object.entries(PANES).forEach(([k, sel]) => $(sel).classList.toggle('active', k === view));
    if (state.unseen[view] !== undefined) { state.unseen[view] = 0; updateBadges(); }
    window.scrollTo({ top: 0 });
  }
  function bumpUnseen(view) { if (isMobile() && state.mobileView !== view) { state.unseen[view]++; updateBadges(); } }
  function updateBadges() {
    [['restaurant', '#badgeRestaurant'], ['driver', '#badgeDriver']].forEach(([k, sel]) => {
      const b = $(sel); b.hidden = state.unseen[k] === 0; b.textContent = num(state.unseen[k]);
    });
  }

  // ---------- Events ----------
  document.addEventListener('click', e => {
    if (e.target.id === 'upsell') { closeUpsell(); return; }
    const t = e.target.closest('button');
    if (!t) return;
    const d = t.dataset;
    if (d.add) { addToCart(d.add, 1); return; }
    if (d.upsell) { if (!state.cart[d.upsell]) addToCart(d.upsell, 1, true); return; }
    if (d.inc) { addToCart(d.inc, 1, true); return; }
    if (d.dec) { addToCart(d.dec, -1, true); return; }
    if (d.go) { go(d.go); return; }
    if (d.view) { switchView(d.view); return; }
    if (d.status) { setStatus(Number(d.id), d.status); return; }
    if (d.branch) { state.branch = d.branch; renderBranches(); if ($('#viewCheckout').classList.contains('active')) renderCart(); return; }
    if (d.dash) { state.dashBranch = d.dash; renderOrders(); return; }
    if (d.cat) { state.cat = d.cat; renderCats(); renderMenu(); return; }
    if (t.id === 'upsellSkip') { closeUpsell(); return; }
    if (t.id === 'cartBar') { go('checkout'); return; }
    if (t.id === 'fillDemo') {
      const f = $('#orderForm');
      f.name.value = 'أحمد محمود';
      f.phone.value = '01012345678';
      f.address.value = 'دسوق، شارع الجيش، عمارة ٥، الدور التالت';
      f.notes.value = 'تومية زيادة';
    }
  });

  document.addEventListener('submit', e => {
    e.preventDefault();
    if (e.target.id === 'orderForm') placeOrder(e.target);
    else if (e.target.matches('.code-form')) confirmDelivery(e.target);
  });

  // ---------- Init ----------
  renderBranches();
  renderCats();
  renderMenu();
  renderOrders();
  renderDriver();
})();
