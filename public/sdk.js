/**
 * AIMEE SDK v2.0
 * Встраиваемая AI-инфраструктура для fashion-брендов
 * cdn.getaimee.ru/sdk.js
 * Zero dependencies · < 50KB · Async
 */
(function (window, document) {
  'use strict';

  // ─── Config ────────────────────────────────────────────────────────────────
  const API_BASE = 'https://seller.getaimee.ru';
  const SDK_VERSION = '2.0.0';

  // ─── Bootstrap ─────────────────────────────────────────────────────────────
  const scriptEl = document.currentScript ||
    document.querySelector('script[data-brand]');

  if (!scriptEl) return;

  const BRAND_ID = scriptEl.getAttribute('data-brand');
  const COLOR    = scriptEl.getAttribute('data-color') || '#0FBCCE';
  const LOCALE   = scriptEl.getAttribute('data-locale') || 'ru';

  if (!BRAND_ID) {
    console.warn('[AIMEE SDK] data-brand attribute is required');
    return;
  }

  // ─── State ─────────────────────────────────────────────────────────────────
  let config = null;
  let sessionId = null;
  let initialized = false;

  // ─── Utils ─────────────────────────────────────────────────────────────────
  function uid() {
    return 'aimee_' + Math.random().toString(36).slice(2, 10);
  }

  function getSessionId() {
    if (sessionId) return sessionId;
    try {
      sessionId = sessionStorage.getItem('aimee_sid');
      if (!sessionId) {
        sessionId = uid();
        sessionStorage.setItem('aimee_sid', sessionId);
      }
    } catch (e) {
      sessionId = uid();
    }
    return sessionId;
  }

  function css(el, styles) {
    Object.assign(el.style, styles);
  }

  function injectGlobalStyles() {
    if (document.getElementById('aimee-styles')) return;
    const style = document.createElement('style');
    style.id = 'aimee-styles';
    style.textContent = `
      .aimee-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        transition: opacity 0.15s, transform 0.1s;
        white-space: nowrap;
      }
      .aimee-btn:hover { opacity: 0.88; transform: translateY(-1px); }
      .aimee-btn:active { transform: translateY(0); }
      .aimee-btn-tryon {
        background: var(--aimee-color, #0FBCCE);
        color: #fff;
      }
      .aimee-fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: var(--aimee-color, #0FBCCE);
        color: #fff;
        border: none;
        cursor: pointer;
        font-size: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 16px rgba(0,0,0,0.18);
        z-index: 9999;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .aimee-fab:hover {
        transform: scale(1.08);
        box-shadow: 0 6px 24px rgba(0,0,0,0.22);
      }
      .aimee-panel {
        position: fixed;
        bottom: 90px;
        right: 24px;
        width: 320px;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 8px 40px rgba(0,0,0,0.18);
        z-index: 9998;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        overflow: hidden;
        transform: scale(0.9) translateY(10px);
        opacity: 0;
        transition: transform 0.2s, opacity 0.2s;
        pointer-events: none;
      }
      .aimee-panel.aimee-panel-open {
        transform: scale(1) translateY(0);
        opacity: 1;
        pointer-events: all;
      }
      .aimee-panel-header {
        padding: 16px 18px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #F3F4F6;
      }
      .aimee-panel-close {
        background: none;
        border: none;
        cursor: pointer;
        font-size: 18px;
        color: #9CA3AF;
        line-height: 1;
        padding: 0;
      }
      .aimee-panel-body { padding: 18px; }
      .aimee-chat-messages {
        max-height: 240px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 12px;
      }
      .aimee-msg {
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 13px;
        line-height: 1.5;
        max-width: 90%;
      }
      .aimee-msg-ai {
        background: #F3F4F6;
        color: #111827;
        align-self: flex-start;
        border-bottom-left-radius: 3px;
      }
      .aimee-msg-user {
        background: var(--aimee-color, #0FBCCE);
        color: #fff;
        align-self: flex-end;
        border-bottom-right-radius: 3px;
      }
      .aimee-typing {
        display: flex;
        gap: 4px;
        align-items: center;
        padding: 10px 14px;
        background: #F3F4F6;
        border-radius: 10px;
        align-self: flex-start;
        width: fit-content;
      }
      .aimee-typing span {
        width: 6px; height: 6px;
        background: #9CA3AF;
        border-radius: 50%;
        animation: aimee-bounce 1.2s infinite;
      }
      .aimee-typing span:nth-child(2) { animation-delay: 0.2s; }
      .aimee-typing span:nth-child(3) { animation-delay: 0.4s; }
      @keyframes aimee-bounce {
        0%,60%,100% { transform: translateY(0); }
        30% { transform: translateY(-6px); }
      }
      .aimee-input-row {
        display: flex;
        gap: 8px;
      }
      .aimee-input {
        flex: 1;
        padding: 9px 12px;
        border: 1px solid #E5E7EB;
        border-radius: 8px;
        font-size: 13px;
        outline: none;
        font-family: inherit;
      }
      .aimee-input:focus { border-color: var(--aimee-color, #0FBCCE); }
      .aimee-send {
        padding: 9px 14px;
        background: var(--aimee-color, #0FBCCE);
        color: #fff;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
      }
      .aimee-tryon-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.6);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: aimee-fade-in 0.2s;
      }
      .aimee-tryon-modal {
        background: #fff;
        border-radius: 20px;
        width: 480px;
        max-width: 95vw;
        max-height: 90vh;
        overflow-y: auto;
        padding: 28px;
        position: relative;
      }
      .aimee-tryon-close {
        position: absolute;
        top: 16px; right: 16px;
        background: #F3F4F6;
        border: none;
        border-radius: 50%;
        width: 32px; height: 32px;
        cursor: pointer;
        font-size: 16px;
        display: flex; align-items: center; justify-content: center;
      }
      @keyframes aimee-fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    // CSS variable for brand color
    document.documentElement.style.setProperty('--aimee-color', COLOR);
  }

  // ─── API ───────────────────────────────────────────────────────────────────
  async function fetchConfig() {
    try {
      const res = await fetch(`${API_BASE}/api/sdk/config/${BRAND_ID}`, {
        headers: { 'x-aimee-version': SDK_VERSION },
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function sendEvent(type, data = {}) {
    try {
      await fetch(`${API_BASE}/api/sdk/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brand_id: BRAND_ID,
          session_id: getSessionId(),
          type,
          url: window.location.href,
          ts: Date.now(),
          ...data,
        }),
        keepalive: true,
      });
    } catch (e) {
      // silent — tracking must never break the page
    }

    // Яндекс.Метрика
    if (config?.integrations?.metrika && window.ym) {
      try {
        window.ym(config.integrations.metrika, 'reachGoal', 'aimee_' + type, data);
      } catch (e) {}
    }
  }

  // ─── Product Detector ──────────────────────────────────────────────────────
  function detectProductCards() {
    const selectors = config?.selectors || {};
    const cardSel   = selectors.productCard  || '[data-aimee-product], .product-card, .product-item, .catalog-item';
    const imageSel  = selectors.productImage || 'img';
    const priceSel  = selectors.productPrice || '.price, [class*="price"]';

    return Array.from(document.querySelectorAll(cardSel)).map(card => ({
      el: card,
      image: card.querySelector(imageSel)?.src || null,
      price: card.querySelector(priceSel)?.textContent?.trim() || null,
      name:  card.querySelector('h1,h2,h3,h4,[class*="title"],[class*="name"]')?.textContent?.trim() || null,
      url:   card.querySelector('a')?.href || window.location.href,
    }));
  }

  // ─── Try-On Button ─────────────────────────────────────────────────────────
  function injectTryOnButtons(cards) {
    if (!config?.features?.tryon) return;

    cards.forEach(({ el, image, name, price }) => {
      if (el.querySelector('.aimee-btn-tryon')) return; // already injected

      const btn = document.createElement('button');
      btn.className = 'aimee-btn aimee-btn-tryon';
      btn.innerHTML = '✨ Примерить';
      btn.setAttribute('data-aimee-tryon', '1');

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        sendEvent('tryon_click', { product_name: name, product_image: image });
        openTryOnModal({ image, name, price });
      });

      // Insert after the image or at the end of card
      const img = el.querySelector('img');
      if (img && img.parentNode) {
        img.parentNode.insertBefore(btn, img.nextSibling);
      } else {
        el.appendChild(btn);
      }
    });
  }

  function openTryOnModal({ image, name, price }) {
    // Remove existing
    document.querySelector('.aimee-tryon-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'aimee-tryon-overlay';
    overlay.innerHTML = `
      <div class="aimee-tryon-modal">
        <button class="aimee-tryon-close">✕</button>
        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:28px;margin-bottom:8px">✨</div>
          <h3 style="font-size:18px;font-weight:700;color:#111827;margin:0 0 4px">Виртуальная примерка</h3>
          <p style="font-size:13px;color:#6B7280;margin:0">AI подберёт размер и покажет посадку</p>
        </div>
        ${image ? `<img src="${image}" alt="${name || ''}" style="width:100%;border-radius:12px;margin-bottom:16px;object-fit:cover;max-height:240px">` : ''}
        ${name ? `<p style="font-size:15px;font-weight:700;color:#111827;margin:0 0 4px">${name}</p>` : ''}
        ${price ? `<p style="font-size:14px;color:#6B7280;margin:0 0 20px">${price}</p>` : ''}
        <div style="background:#F8F9FA;border-radius:12px;padding:16px;margin-bottom:16px">
          <p style="font-size:13px;font-weight:600;color:#111827;margin:0 0 12px">Ваши параметры</p>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            ${[['Рост (см)', 'height', '170'],['Размер RU', 'size', '44'],['Обхват груди', 'chest', '90'],['Обхват талии', 'waist', '74']].map(([label, key, ph]) => `
              <div>
                <label style="font-size:11px;color:#6B7280;display:block;margin-bottom:4px">${label}</label>
                <input data-param="${key}" placeholder="${ph}" style="width:100%;padding:8px 10px;border:1px solid #E5E7EB;border-radius:8px;font-size:13px;box-sizing:border-box">
              </div>
            `).join('')}
          </div>
        </div>
        <button class="aimee-btn" id="aimee-tryon-submit" style="width:100%;justify-content:center;padding:12px;background:var(--aimee-color,#0FBCCE);color:#fff;font-size:14px">
          ✨ Подобрать размер
        </button>
        <div id="aimee-tryon-result" style="display:none;margin-top:16px;padding:14px;background:#f0fdf4;border-radius:10px;border:1px solid #bbf7d0"></div>
        <p style="font-size:11px;color:#9CA3AF;text-align:center;margin:12px 0 0">Powered by AIMEE AI · ${BRAND_ID}</p>
      </div>
    `;

    overlay.querySelector('.aimee-tryon-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelector('#aimee-tryon-submit').addEventListener('click', async () => {
      const params = {};
      overlay.querySelectorAll('[data-param]').forEach(input => {
        params[input.dataset.param] = input.value;
      });

      const btn = overlay.querySelector('#aimee-tryon-submit');
      btn.textContent = 'Анализируем...';
      btn.disabled = true;

      sendEvent('tryon_submit', { product_name: name, params });

      // Call AI stylist
      try {
        const res = await fetch(`${API_BASE}/api/sdk/tryon`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brand_id: BRAND_ID, product: { name, image, price }, params }),
        });
        const data = await res.json();
        const result = overlay.querySelector('#aimee-tryon-result');
        result.style.display = 'block';
        result.innerHTML = `<p style="font-size:13px;font-weight:700;color:#16A34A;margin:0 0 6px">✓ ${data.recommendation || 'Рекомендуемый размер: M'}</p>
          <p style="font-size:12px;color:#374151;margin:0">${data.comment || 'Хорошая посадка по вашим параметрам.'}</p>`;
      } catch (e) {
        const result = overlay.querySelector('#aimee-tryon-result');
        result.style.display = 'block';
        result.style.background = '#fef2f2';
        result.style.borderColor = '#fecaca';
        result.innerHTML = '<p style="font-size:13px;color:#EF4444;margin:0">Попробуйте позже</p>';
      }

      btn.textContent = '✨ Подобрать размер';
      btn.disabled = false;
    });

    document.body.appendChild(overlay);
  }

  // ─── AI Stylist FAB ────────────────────────────────────────────────────────
  function injectStylistFAB() {
    if (!config?.features?.stylist) return;
    if (document.getElementById('aimee-fab')) return;

    const fab = document.createElement('button');
    fab.id = 'aimee-fab';
    fab.className = 'aimee-fab';
    fab.innerHTML = '✦';
    fab.title = 'AI-стилист AIMEE';

    const panel = document.createElement('div');
    panel.id = 'aimee-panel';
    panel.className = 'aimee-panel';
    panel.innerHTML = `
      <div class="aimee-panel-header">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:28px;height:28px;border-radius:8px;background:var(--aimee-color,#0FBCCE);display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;font-weight:800">A</div>
          <div>
            <p style="font-size:13px;font-weight:700;color:#111827;margin:0">AI-стилист</p>
            <p style="font-size:11px;color:#16A34A;margin:0">● Онлайн</p>
          </div>
        </div>
        <button class="aimee-panel-close">✕</button>
      </div>
      <div class="aimee-panel-body">
        <div class="aimee-chat-messages" id="aimee-messages">
          <div class="aimee-msg aimee-msg-ai">Привет! Я AI-стилист. Помогу подобрать размер, стиль или составить образ. Спрашивайте 👗</div>
        </div>
        <div class="aimee-input-row">
          <input class="aimee-input" id="aimee-input" placeholder="Задайте вопрос..." />
          <button class="aimee-send" id="aimee-send">→</button>
        </div>
      </div>
    `;

    let panelOpen = false;

    fab.addEventListener('click', () => {
      panelOpen = !panelOpen;
      panel.classList.toggle('aimee-panel-open', panelOpen);
      fab.innerHTML = panelOpen ? '✕' : '✦';
      if (panelOpen) {
        sendEvent('stylist_open');
        document.getElementById('aimee-input')?.focus();
      }
    });

    panel.querySelector('.aimee-panel-close').addEventListener('click', () => {
      panelOpen = false;
      panel.classList.remove('aimee-panel-open');
      fab.innerHTML = '✦';
    });

    async function sendMessage() {
      const input = document.getElementById('aimee-input');
      const msg = input?.value?.trim();
      if (!msg) return;

      const messages = document.getElementById('aimee-messages');

      // User bubble
      const userBubble = document.createElement('div');
      userBubble.className = 'aimee-msg aimee-msg-user';
      userBubble.textContent = msg;
      messages.appendChild(userBubble);
      input.value = '';
      messages.scrollTop = messages.scrollHeight;

      // Typing indicator
      const typing = document.createElement('div');
      typing.className = 'aimee-typing';
      typing.innerHTML = '<span></span><span></span><span></span>';
      messages.appendChild(typing);
      messages.scrollTop = messages.scrollHeight;

      sendEvent('stylist_message', { message: msg });

      try {
        const res = await fetch(`${API_BASE}/api/sdk/stylist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brand_id: BRAND_ID, message: msg, session_id: getSessionId() }),
        });
        const data = await res.json();
        typing.remove();

        const aiBubble = document.createElement('div');
        aiBubble.className = 'aimee-msg aimee-msg-ai';
        aiBubble.textContent = data.reply || 'Хороший вопрос! Уточните детали.';
        messages.appendChild(aiBubble);
      } catch (e) {
        typing.remove();
        const errBubble = document.createElement('div');
        errBubble.className = 'aimee-msg aimee-msg-ai';
        errBubble.textContent = 'Временная ошибка. Попробуйте снова.';
        messages.appendChild(errBubble);
      }

      messages.scrollTop = messages.scrollHeight;
    }

    document.addEventListener('click', (e) => {
      if (panelOpen && !panel.contains(e.target) && e.target !== fab) {
        panelOpen = false;
        panel.classList.remove('aimee-panel-open');
        fab.innerHTML = '✦';
      }
    });

    panel.querySelector('#aimee-send').addEventListener('click', sendMessage);
    panel.querySelector('#aimee-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    document.body.appendChild(fab);
    document.body.appendChild(panel);
  }

  // ─── Cart & Purchase Tracking ──────────────────────────────────────────────
  function setupEventTracking() {
    if (!config?.features?.analytics) return;

    // Add to cart — intercept button clicks
    const addToCartSel = config?.selectors?.addToCartBtn || '.add-to-cart, [class*="add-to-cart"], [data-action="add-to-cart"]';

    document.addEventListener('click', (e) => {
      const btn = e.target.closest(addToCartSel);
      if (btn) {
        const card = btn.closest(config?.selectors?.productCard || '.product-card, .product-item');
        const name = card?.querySelector('h1,h2,h3,h4,[class*="title"]')?.textContent?.trim();
        const price = card?.querySelector('[class*="price"]')?.textContent?.trim();
        sendEvent('add_to_cart', { product_name: name, price });
      }
    }, true);

    // Page view
    sendEvent('view', { page: document.title });

    // Track purchase page
    if (window.location.pathname.includes('thank') ||
        window.location.pathname.includes('success') ||
        window.location.pathname.includes('order')) {
      sendEvent('purchase');
    }
  }

  // ─── Domain Whitelist Check ────────────────────────────────────────────────
  function isDomainAllowed() {
    if (!config?.allowed_domains || config.allowed_domains.length === 0) return true;
    const host = window.location.hostname;
    return config.allowed_domains.some(d => host === d || host.endsWith('.' + d));
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    if (initialized) return;
    initialized = true;

    config = await fetchConfig();

    // Use defaults if no config (still inject SDK)
    if (!config) {
      config = {
        features: { tryon: true, stylist: true, analytics: true },
        selectors: {},
        integrations: {},
        allowed_domains: [],
      };
    }

    // Domain whitelist
    if (!isDomainAllowed()) {
      console.warn('[AIMEE SDK] Domain not whitelisted:', window.location.hostname);
      return;
    }

    injectGlobalStyles();
    setupEventTracking();

    // Detect product cards and inject Try-On buttons
    const cards = detectProductCards();
    if (cards.length > 0) {
      injectTryOnButtons(cards);
    }

    // AI Stylist floating button
    injectStylistFAB();

    // Re-scan on DOM mutations (SPA support)
    const observer = new MutationObserver(() => {
      const newCards = detectProductCards();
      if (newCards.length > 0) injectTryOnButtons(newCards);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    console.log(`[AIMEE SDK] v${SDK_VERSION} initialized · brand: ${BRAND_ID} · ${cards.length} products detected`);
  }

  // ─── Entry point ───────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window, document);
