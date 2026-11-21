(() => {
  'use strict';

  const FAV_STORAGE_KEY = 'nikke_matome_favorites_v1';
  const chars = typeof NIKKE_DATA !== 'undefined' ? NIKKE_DATA : [];

  let favorites = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(FAV_STORAGE_KEY) || '[]');
    if (Array.isArray(saved)) favorites = new Set(saved);
  } catch {
    favorites = new Set();
  }

  let onlyFav = false;
  let currentModalChar = null;
  let currentImgIndex = 0;
  const PAGE_SIZE = 120;
  let displayLimit = PAGE_SIZE;

  const els = {
    totalCountPill: document.getElementById('totalCountPill'),
    favCountPill: document.getElementById('favCountPill'),
    searchInput: document.getElementById('searchInput'),
    favFilterBtn: document.getElementById('favFilterBtn'),
    resetBtn: document.getElementById('resetBtn'),
    rarityFilter: document.getElementById('rarityFilter'),
    manufacturerFilter: document.getElementById('manufacturerFilter'),
    weaponFilter: document.getElementById('weaponFilter'),
    burstFilter: document.getElementById('burstFilter'),
    elementFilter: document.getElementById('elementFilter'),
    roleFilter: document.getElementById('roleFilter'),
    sortSelect: document.getElementById('sortSelect'),
    resultCountText: document.getElementById('resultCountText'),
    charGrid: document.getElementById('charGrid'),
    loadMoreWrap: document.getElementById('loadMoreWrap'),
    loadMoreBtn: document.getElementById('loadMoreBtn'),
    emptyState: document.getElementById('emptyState'),
    detailModal: document.getElementById('detailModal'),
    modalBackdrop: document.getElementById('modalBackdrop'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    modalBody: document.getElementById('modalBody'),
    lightbox: document.getElementById('lightbox'),
    lightboxStage: document.getElementById('lightboxStage'),
    lightboxCloseBtn: document.getElementById('lightboxCloseBtn'),
    lightboxPrevImgBtn: document.getElementById('lightboxPrevImgBtn'),
    lightboxNextImgBtn: document.getElementById('lightboxNextImgBtn'),
    lightboxPrevCharBtn: document.getElementById('lightboxPrevCharBtn'),
    lightboxNextCharBtn: document.getElementById('lightboxNextCharBtn'),
    lightboxImg: document.getElementById('lightboxImg'),
    lightboxCaption: document.getElementById('lightboxCaption'),
  };

  const lightboxState = {
    scale: 1,
    tx: 0,
    ty: 0,
    isPinching: false,
    isPanning: false,
    isMousePanning: false,
    swipeCancelled: false,
    movedDuringTouch: false,
    touchStartX: 0,
    touchStartY: 0,
    pinchStartDist: 0,
    pinchStartScale: 1,
    pinchStartTx: 0,
    pinchStartTy: 0,
    pinchStartMidX: 0,
    pinchStartMidY: 0,
    panStartTx: 0,
    panStartTy: 0,
    mouseStartX: 0,
    mouseStartY: 0,
    lastTapTime: 0,
    lastTapX: 0,
    lastTapY: 0,
  };

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function saveFavorites() {
    try {
      localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify([...favorites]));
    } catch {
      // ignore quota errors
    }
    updateHeaderStats();
  }

  function updateHeaderStats() {
    els.totalCountPill.textContent = `収録: ${chars.length} 体`;
    els.favCountPill.textContent = `お気に入り: ${favorites.size}`;
  }

  function getRarityRank(c) {
    const map = { SSR: 3, SR: 2, R: 1 };
    return map[c.rarity] ?? 0;
  }

  function getFilteredChars() {
    const q = els.searchInput.value.trim().toLowerCase();
    const rarity = els.rarityFilter.value;
    const manufacturer = els.manufacturerFilter.value;
    const weapon = els.weaponFilter.value;
    const burst = els.burstFilter.value;
    const element = els.elementFilter.value;
    const role = els.roleFilter.value;
    const sort = els.sortSelect.value;

    const list = chars.filter(c => {
      if (onlyFav && !favorites.has(c.id)) return false;
      if (rarity !== 'ALL' && c.rarity !== rarity) return false;
      if (manufacturer !== 'ALL' && c.manufacturer !== manufacturer) return false;
      if (weapon !== 'ALL' && c.weapon !== weapon) return false;
      if (burst !== 'ALL' && c.burst !== burst) return false;
      if (element !== 'ALL' && c.element !== element) return false;
      if (role !== 'ALL' && c.role !== role) return false;
      if (q) {
        const hay = `${c.name} ${c.nameEn || ''} ${c.squad || ''} ${c.id}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sort === 'rarity-desc') {
        const diff = getRarityRank(b) - getRarityRank(a);
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id);
      }
      if (sort === 'name-asc') {
        return a.name.localeCompare(b.name, 'ja');
      }
      return a.id.localeCompare(b.id);
    });

    return list;
  }

  function renderGrid(resetLimit = false) {
    if (resetLimit) displayLimit = PAGE_SIZE;
    const filtered = getFilteredChars();
    const shown = filtered.slice(0, displayLimit);

    els.resultCountText.textContent = `${filtered.length} 体を表示中（全 ${chars.length} 体）`;
    els.emptyState.classList.toggle('hidden', filtered.length > 0);
    els.loadMoreWrap.classList.toggle('hidden', filtered.length <= displayLimit);

    els.charGrid.innerHTML = shown.map(c => {
      const thumb = c.images && c.images[0] ? c.images[0].url : '';
      const isFav = favorites.has(c.id);
      const rarityCls = `rarity-${(c.rarity || 'r').toLowerCase()}`;
      const imgCount = c.images ? c.images.length : 0;

      return `
        <article class="char-card" data-id="${escapeHtml(c.id)}" tabindex="0" role="button" aria-label="${escapeHtml(c.name)}の詳細を見る">
          <div class="card-thumb-wrap">
            ${thumb
              ? `<img class="card-thumb" src="${escapeHtml(thumb)}" alt="${escapeHtml(c.name)}" loading="lazy" referrerpolicy="no-referrer">`
              : `<div class="card-thumb-fallback">No Image</div>`
            }
            <span class="rarity-badge ${rarityCls}">${escapeHtml(c.rarity)}</span>
            <button type="button" class="card-fav-btn ${isFav ? 'active' : ''}" data-fav-id="${escapeHtml(c.id)}" aria-label="お気に入り切替" aria-pressed="${isFav}">
              ${isFav ? '★' : '☆'}
            </button>
            ${imgCount > 1 ? `<span class="card-img-count">${imgCount}枚</span>` : ''}
          </div>
          <div class="card-body">
            <h3 class="card-name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</h3>
            <div class="card-meta-row">
              <span class="meta-tag meta-tag-burst">B-${escapeHtml(c.burst)}</span>
              <span class="meta-tag">${escapeHtml(c.weapon)}</span>
              <span class="meta-tag">${escapeHtml(c.manufacturer)}</span>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  function openModal(id, imgIdx = 0) {
    const c = chars.find(x => x.id === id);
    if (!c) return;
    currentModalChar = c;
    currentImgIndex = Math.max(0, Math.min(imgIdx, (c.images?.length || 1) - 1));
    renderModalBody();
    els.detailModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function renderModalBody() {
    const c = currentModalChar;
    if (!c) return;
    const imgs = c.images || [];
    const activeImg = imgs[currentImgIndex] || null;
    const isFav = favorites.has(c.id);

    els.modalBody.innerHTML = `
      <div class="modal-top">
        <div class="modal-main-img-wrap" id="modalImgTrigger" title="クリックで拡大表示">
          ${activeImg
            ? `<img class="modal-main-img" src="${escapeHtml(activeImg.url)}" alt="${escapeHtml(c.name)} (${escapeHtml(activeImg.label)})" referrerpolicy="no-referrer">`
            : `<div class="card-thumb-fallback">No Image</div>`
          }
          ${activeImg ? `<span class="modal-zoom-hint">クリックで拡大</span>` : ''}
        </div>
        <div class="modal-header-info">
          <h2 id="modalTitle">${escapeHtml(c.name)}</h2>
          ${c.nameEn ? `<p class="modal-name-en">${escapeHtml(c.nameEn)} / ${escapeHtml(c.id)}</p>` : `<p class="modal-name-en">${escapeHtml(c.id)}</p>`}
          <div class="modal-badges">
            <span class="meta-tag meta-tag-burst">${escapeHtml(c.rarity)}</span>
            <span class="meta-tag meta-tag-burst">バースト ${escapeHtml(c.burst)}</span>
            <span class="meta-tag">${escapeHtml(c.element)}</span>
            <span class="meta-tag">${escapeHtml(c.role)}</span>
          </div>
          <div class="info-grid">
            <div><span class="info-item-label">企業</span><span class="info-item-val">${escapeHtml(c.manufacturer)}</span></div>
            <div><span class="info-item-label">武器種</span><span class="info-item-val">${escapeHtml(c.weapon)}</span></div>
            <div><span class="info-item-label">部隊</span><span class="info-item-val">${escapeHtml(c.squad || '—')}</span></div>
            <div><span class="info-item-label">CV</span><span class="info-item-val">${escapeHtml(c.cv || '—')}</span></div>
          </div>
          <div class="modal-actions">
            <button type="button" id="modalFavBtn" class="btn-toggle ${isFav ? 'active' : ''}" aria-pressed="${isFav}">
              ${isFav ? '★ お気に入り登録済み' : '☆ お気に入りに追加'}
            </button>
            ${c.sourceInfo?.url ? `<a class="source-link" href="${escapeHtml(c.sourceInfo.url)}" target="_blank" rel="noopener noreferrer">出典ページを見る (${escapeHtml(c.sourceInfo.date)}) ↗</a>` : ''}
          </div>
        </div>
      </div>

      <div class="modal-section">
        <h3>スキル一覧</h3>
        ${c.skills && c.skills.length > 0
          ? `<div class="skills-list">
              ${c.skills.map(sk => `
                <div class="skill-card">
                  <div class="skill-head">
                    <span class="skill-name">${escapeHtml(sk.name)}</span>
                    <span class="skill-type">${escapeHtml(sk.type)}</span>
                  </div>
                  <p class="skill-desc">${escapeHtml(sk.desc)}</p>
                </div>
              `).join('')}
            </div>`
          : `<p class="skill-desc">スキル情報は出典ページで未記載です。</p>`
        }
      </div>

      ${imgs.length > 0 ? `
        <div class="modal-section">
          <h3>イラスト・コスチューム (${imgs.length})</h3>
          <div class="gallery-grid">
            ${imgs.map((im, idx) => `
              <button type="button" class="gallery-item ${idx === currentImgIndex ? 'active' : ''}" data-img-idx="${idx}">
                <img src="${escapeHtml(im.url)}" alt="${escapeHtml(im.label)}" loading="lazy" referrerpolicy="no-referrer">
                <div class="gallery-label" title="${escapeHtml(im.label)}">${escapeHtml(im.label)}</div>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;

    const imgTrigger = document.getElementById('modalImgTrigger');
    if (imgTrigger && activeImg) {
      imgTrigger.addEventListener('click', () => openLightbox());
    }

    const modalFavBtn = document.getElementById('modalFavBtn');
    if (modalFavBtn) {
      modalFavBtn.addEventListener('click', () => {
        if (favorites.has(c.id)) favorites.delete(c.id);
        else favorites.add(c.id);
        saveFavorites();
        renderModalBody();
        renderGrid();
      });
    }

    els.modalBody.querySelectorAll('[data-img-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        currentImgIndex = Number(btn.dataset.imgIdx) || 0;
        renderModalBody();
      });
    });
  }

  function closeModal() {
    els.detailModal.classList.add('hidden');
    if (els.lightbox.classList.contains('hidden')) {
      document.body.style.overflow = '';
    }
  }

  // Lightbox zoom & navigation
  function resetLightboxTransform(animate = false) {
    lightboxState.scale = 1;
    lightboxState.tx = 0;
    lightboxState.ty = 0;
    applyLightboxTransform(animate);
  }

  function clampLightboxZoom(scale, tx, ty) {
    const clampedScale = Math.max(1, Math.min(4, scale));
    if (clampedScale <= 1) {
      return { scale: 1, tx: 0, ty: 0 };
    }
    const rect = els.lightboxStage.getBoundingClientRect();
    const maxTx = ((clampedScale - 1) * rect.width) / 2 + 80;
    const maxTy = ((clampedScale - 1) * rect.height) / 2 + 80;
    return {
      scale: clampedScale,
      tx: Math.max(-maxTx, Math.min(maxTx, tx)),
      ty: Math.max(-maxTy, Math.min(maxTy, ty)),
    };
  }

  function applyLightboxTransform(animate = false) {
    els.lightboxImg.style.transition = animate ? 'transform 0.18s ease-out' : 'none';
    els.lightboxImg.style.transform = `translate3d(${lightboxState.tx}px, ${lightboxState.ty}px, 0) scale(${lightboxState.scale})`;
    els.lightboxImg.style.cursor = lightboxState.scale > 1 ? 'grab' : 'default';
  }

  function getTouchDistAndMid(t1, t2, rect) {
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY) || 1;
    const midX = (t1.clientX + t2.clientX) / 2 - cx;
    const midY = (t1.clientY + t2.clientY) / 2 - cy;
    return { dist, midX, midY };
  }

  function updateLightboxView() {
    if (!currentModalChar || !currentModalChar.images?.length) return;
    const imgs = currentModalChar.images;
    if (currentImgIndex < 0) currentImgIndex = imgs.length - 1;
    if (currentImgIndex >= imgs.length) currentImgIndex = 0;
    const img = imgs[currentImgIndex];
    els.lightboxImg.src = img.url;
    els.lightboxImg.alt = `${currentModalChar.name} - ${img.label}`;
    els.lightboxCaption.textContent = `${currentModalChar.name} — ${img.label} (${currentImgIndex + 1} / ${imgs.length})`;
    const multi = imgs.length > 1;
    els.lightboxPrevImgBtn.classList.toggle('hidden', !multi);
    els.lightboxNextImgBtn.classList.toggle('hidden', !multi);
    resetLightboxTransform(false);
  }

  function openLightbox() {
    if (!currentModalChar || !currentModalChar.images?.length) return;
    updateLightboxView();
    els.lightbox.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    els.lightbox.classList.add('hidden');
    if (els.detailModal.classList.contains('hidden')) {
      document.body.style.overflow = '';
    }
  }

  function stepLightboxImage(delta) {
    if (!currentModalChar || !currentModalChar.images?.length) return;
    currentImgIndex = (currentImgIndex + delta + currentModalChar.images.length) % currentModalChar.images.length;
    if (!els.lightbox.classList.contains('hidden')) {
      updateLightboxView();
    }
    if (!els.detailModal.classList.contains('hidden')) {
      renderModalBody();
    }
  }

  function navigateCharacter(delta) {
    if (!currentModalChar) return;
    const filtered = getFilteredChars();
    if (!filtered.length) return;
    const idx = filtered.findIndex(x => x.id === currentModalChar.id);
    const nextIdx = idx === -1 ? 0 : (idx + delta + filtered.length) % filtered.length;
    currentModalChar = filtered[nextIdx];
    currentImgIndex = 0;
    if (!els.detailModal.classList.contains('hidden')) {
      renderModalBody();
    }
    if (!els.lightbox.classList.contains('hidden')) {
      updateLightboxView();
    }
  }

  // Event listeners
  els.searchInput.addEventListener('input', () => renderGrid(true));
  [
    els.rarityFilter,
    els.manufacturerFilter,
    els.weaponFilter,
    els.burstFilter,
    els.elementFilter,
    els.roleFilter,
    els.sortSelect,
  ].forEach(sel => sel.addEventListener('change', () => renderGrid(true)));

  els.favFilterBtn.addEventListener('click', () => {
    onlyFav = !onlyFav;
    els.favFilterBtn.classList.toggle('active', onlyFav);
    els.favFilterBtn.setAttribute('aria-pressed', String(onlyFav));
    renderGrid(true);
  });

  els.resetBtn.addEventListener('click', () => {
    els.searchInput.value = '';
    els.rarityFilter.value = 'ALL';
    els.manufacturerFilter.value = 'ALL';
    els.weaponFilter.value = 'ALL';
    els.burstFilter.value = 'ALL';
    els.elementFilter.value = 'ALL';
    els.roleFilter.value = 'ALL';
    els.sortSelect.value = 'rarity-desc';
    onlyFav = false;
    els.favFilterBtn.classList.remove('active');
    els.favFilterBtn.setAttribute('aria-pressed', 'false');
    renderGrid(true);
  });

  els.loadMoreBtn.addEventListener('click', () => {
    displayLimit += PAGE_SIZE;
    renderGrid(false);
  });

  els.charGrid.addEventListener('click', e => {
    const favBtn = e.target.closest('[data-fav-id]');
    if (favBtn) {
      e.stopPropagation();
      const id = favBtn.dataset.favId;
      if (favorites.has(id)) favorites.delete(id);
      else favorites.add(id);
      saveFavorites();
      renderGrid();
      return;
    }
    const card = e.target.closest('.char-card');
    if (card) {
      openModal(card.dataset.id);
    }
  });

  els.charGrid.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.char-card');
      if (card && !e.target.closest('[data-fav-id]')) {
        e.preventDefault();
        openModal(card.dataset.id);
      }
    }
  });

  els.modalBackdrop.addEventListener('click', closeModal);
  els.modalCloseBtn.addEventListener('click', closeModal);
  els.lightboxCloseBtn.addEventListener('click', closeLightbox);
  els.lightboxPrevImgBtn.addEventListener('click', e => { e.stopPropagation(); stepLightboxImage(-1); });
  els.lightboxNextImgBtn.addEventListener('click', e => { e.stopPropagation(); stepLightboxImage(1); });
  els.lightboxPrevCharBtn.addEventListener('click', e => { e.stopPropagation(); navigateCharacter(-1); });
  els.lightboxNextCharBtn.addEventListener('click', e => { e.stopPropagation(); navigateCharacter(1); });

  els.lightboxStage.addEventListener('click', e => {
    if (e.target === els.lightboxStage) closeLightbox();
  });

  // Touch pinch zoom (1-4x), pan, double-tap (1x <-> 2.5x), horizontal swipe (1x)
  els.lightboxStage.addEventListener('touchstart', e => {
    if (!e.touches) return;
    if (e.touches.length === 2) {
      lightboxState.swipeCancelled = true;
      lightboxState.isPanning = false;
      lightboxState.isPinching = true;
      lightboxState.movedDuringTouch = true;
      const rect = els.lightboxStage.getBoundingClientRect();
      const { dist, midX, midY } = getTouchDistAndMid(e.touches[0], e.touches[1], rect);
      lightboxState.pinchStartDist = dist;
      lightboxState.pinchStartScale = lightboxState.scale;
      lightboxState.pinchStartTx = lightboxState.tx;
      lightboxState.pinchStartTy = lightboxState.ty;
      lightboxState.pinchStartMidX = midX;
      lightboxState.pinchStartMidY = midY;
    } else if (e.touches.length === 1) {
      lightboxState.touchStartX = e.touches[0].clientX;
      lightboxState.touchStartY = e.touches[0].clientY;
      lightboxState.movedDuringTouch = false;
      lightboxState.swipeCancelled = false;
      if (lightboxState.scale > 1) {
        lightboxState.isPanning = true;
        lightboxState.panStartTx = lightboxState.tx;
        lightboxState.panStartTy = lightboxState.ty;
      } else {
        lightboxState.isPanning = false;
      }
    }
  }, { passive: true });

  els.lightboxStage.addEventListener('touchmove', e => {
    if (!e.touches) return;
    if (lightboxState.isPinching && e.touches.length === 2) {
      e.preventDefault();
      const rect = els.lightboxStage.getBoundingClientRect();
      const { dist, midX, midY } = getTouchDistAndMid(e.touches[0], e.touches[1], rect);
      const s0 = lightboxState.pinchStartScale;
      const rawScale = s0 * (dist / lightboxState.pinchStartDist);
      const s1 = Math.max(1, Math.min(4, rawScale));
      const ratio = s1 / s0;
      const rawTx = midX - (lightboxState.pinchStartMidX - lightboxState.pinchStartTx) * ratio;
      const rawTy = midY - (lightboxState.pinchStartMidY - lightboxState.pinchStartTy) * ratio;
      const clamped = clampLightboxZoom(s1, rawTx, rawTy);
      lightboxState.scale = clamped.scale;
      lightboxState.tx = clamped.tx;
      lightboxState.ty = clamped.ty;
      applyLightboxTransform(false);
    } else if (lightboxState.isPanning && e.touches.length === 1 && lightboxState.scale > 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - lightboxState.touchStartX;
      const dy = e.touches[0].clientY - lightboxState.touchStartY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        lightboxState.movedDuringTouch = true;
      }
      const clamped = clampLightboxZoom(lightboxState.scale, lightboxState.panStartTx + dx, lightboxState.panStartTy + dy);
      lightboxState.tx = clamped.tx;
      lightboxState.ty = clamped.ty;
      applyLightboxTransform(false);
    } else if (e.touches.length === 1 && lightboxState.scale === 1) {
      const dx = e.touches[0].clientX - lightboxState.touchStartX;
      const dy = e.touches[0].clientY - lightboxState.touchStartY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        lightboxState.movedDuringTouch = true;
      }
    }
  }, { passive: false });

  els.lightboxStage.addEventListener('touchend', e => {
    if (lightboxState.isPinching) {
      if (!e.touches || e.touches.length === 0) {
        lightboxState.isPinching = false;
      } else if (e.touches.length === 1) {
        lightboxState.isPinching = false;
        lightboxState.swipeCancelled = true;
        if (lightboxState.scale > 1) {
          lightboxState.isPanning = true;
          lightboxState.touchStartX = e.touches[0].clientX;
          lightboxState.touchStartY = e.touches[0].clientY;
          lightboxState.panStartTx = lightboxState.tx;
          lightboxState.panStartTy = lightboxState.ty;
        }
      }
      return;
    }

    if (lightboxState.isPanning) {
      lightboxState.isPanning = false;
    }

    if (!e.touches || e.touches.length === 0) {
      const changed = e.changedTouches && e.changedTouches[0];
      if (!changed) return;

      if (!lightboxState.swipeCancelled && !lightboxState.movedDuringTouch) {
        const now = Date.now();
        const tapDist = Math.hypot(changed.clientX - lightboxState.lastTapX, changed.clientY - lightboxState.lastTapY);
        if (now - lightboxState.lastTapTime < 300 && tapDist < 35) {
          lightboxState.lastTapTime = 0;
          if (lightboxState.scale > 1) {
            resetLightboxTransform(true);
          } else {
            const rect = els.lightboxStage.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const tapX = changed.clientX - cx;
            const tapY = changed.clientY - cy;
            const targetScale = 2.5;
            const clamped = clampLightboxZoom(targetScale, -tapX * (targetScale - 1), -tapY * (targetScale - 1));
            lightboxState.scale = clamped.scale;
            lightboxState.tx = clamped.tx;
            lightboxState.ty = clamped.ty;
            applyLightboxTransform(true);
          }
          return;
        }
        lightboxState.lastTapTime = now;
        lightboxState.lastTapX = changed.clientX;
        lightboxState.lastTapY = changed.clientY;
      }

      if (!lightboxState.swipeCancelled && lightboxState.scale === 1 && lightboxState.touchStartX) {
        const dx = changed.clientX - lightboxState.touchStartX;
        lightboxState.touchStartX = 0;
        if (Math.abs(dx) > 45) {
          navigateCharacter(dx < 0 ? 1 : -1);
        }
      }
    }
  }, { passive: true });

  // PC mouse wheel zoom & drag pan
  els.lightboxStage.addEventListener('wheel', e => {
    if (els.lightbox.classList.contains('hidden')) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    const s0 = lightboxState.scale;
    const s1 = Math.max(1, Math.min(4, s0 * factor));
    const clamped = clampLightboxZoom(s1, lightboxState.tx * (s1 / s0), lightboxState.ty * (s1 / s0));
    lightboxState.scale = clamped.scale;
    lightboxState.tx = clamped.tx;
    lightboxState.ty = clamped.ty;
    applyLightboxTransform(false);
  }, { passive: false });

  els.lightboxImg.addEventListener('mousedown', e => {
    if (lightboxState.scale <= 1) return;
    e.preventDefault();
    lightboxState.isMousePanning = true;
    lightboxState.mouseStartX = e.clientX;
    lightboxState.mouseStartY = e.clientY;
    lightboxState.panStartTx = lightboxState.tx;
    lightboxState.panStartTy = lightboxState.ty;
    els.lightboxImg.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', e => {
    if (!lightboxState.isMousePanning) return;
    const dx = e.clientX - lightboxState.mouseStartX;
    const dy = e.clientY - lightboxState.mouseStartY;
    const clamped = clampLightboxZoom(lightboxState.scale, lightboxState.panStartTx + dx, lightboxState.panStartTy + dy);
    lightboxState.tx = clamped.tx;
    lightboxState.ty = clamped.ty;
    applyLightboxTransform(false);
  });

  window.addEventListener('mouseup', () => {
    if (lightboxState.isMousePanning) {
      lightboxState.isMousePanning = false;
      els.lightboxImg.style.cursor = lightboxState.scale > 1 ? 'grab' : 'default';
    }
  });

  // Keyboard navigation: Left/Right = prev/next character, Up/Down = prev/next image
  document.addEventListener('keydown', e => {
    const lbOpen = !els.lightbox.classList.contains('hidden');
    const modalOpen = !els.detailModal.classList.contains('hidden');
    if (e.key === 'Escape') {
      if (lbOpen) closeLightbox();
      else if (modalOpen) closeModal();
      return;
    }
    if (!lbOpen && !modalOpen) return;
    if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateCharacter(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateCharacter(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      stepLightboxImage(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      stepLightboxImage(1);
    }
  });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }

  updateHeaderStats();
  renderGrid();
})();
