import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 登录/注册页共享的响应式布局引擎（源自 v1.3.0 像素级标定设计，参考帧 1464×949）。
 *
 * 三种布局模式：
 *   land    — 桌面横屏：左侧视频面板 + 右侧卡片（按卡片比例整体缩放）
 *   tabport — 平板竖屏：上半视频带 + 下半卡片（内部元素按 TP 常量表绝对定位）
 *   phone   — 手机端：文档流自然堆叠（由页面 CSS 媒体查询接管，JS 不干预）
 *
 * 页面差异全部通过参数注入，本文件不含页面专属常量：
 *   refs                  — 模板 ref 集合 { photo, pane, card, cardIn, hero, hl1, hl2 }
 *   tp                    — 页面标定常量表（两页字段布局不同，见各自页面）
 *   buildTabportElements  — (S, cardW, pad) => 元素定位描述数组（top/left/width 等为像素值）
 *   buildEntranceTargets  — (compact, ease, softEase) => 入场动画目标数组
 */

// ==== 两页共享的标定常量 ====
const REF_W = 1464
const PANE_W = 628
const CARD_W = 613
const CARD_H = 922
const CONTENT_H = 697
const IMG_W = 1177
const IMG_H = 1336
const IMG_REF_SCALE = 836 / 1177
const PANE_RATIO = PANE_W / REF_W
const HERO_W = 681
const HERO_HEIGHT = 949
const REF_CARD_ASPECT = 692 / 855

const EASE = 'cubic-bezier(.16,1,.3,1)'
const SOFT_EASE = 'cubic-bezier(.22,1,.36,1)'

export function useAuthLayout({ refs, tp, buildTabportElements, buildEntranceTargets }) {
  const layoutMode = ref('land')

  let mqLandscape = null
  let mqPortrait = null
  let animations = []
  let entryRan = false
  // 竖屏模式设置过内联样式的元素清单，切换布局时逐一清除残留
  let tabportInlineEls = []

  function photoRatio(vw) {
    if (vw >= 1280) return 1 - PANE_RATIO
    if (vw >= 1000) {
      const t = (1280 - vw) / 280
      return (1 - PANE_RATIO) + t * (0.42 - (1 - PANE_RATIO))
    }
    if (vw >= 820) {
      const t = (1000 - vw) / 180
      return 0.42 + t * (0.36 - 0.42)
    }
    return 0.36
  }

  function clearInline() {
    ;[refs.photo.value, refs.pane.value, refs.card.value, refs.cardIn.value, refs.hero.value, refs.hl1.value, refs.hl2.value].forEach(el => {
      if (el) el.style.cssText = ''
    })
    // hero 内部的 badge/headlines 与竖屏定位过的表单元素也可能带有内联样式；
    // 不清除的话内联样式优先级高于横屏/手机端的 CSS 规则，切换断点后布局错乱
    refs.hero.value?.querySelectorAll('.hero-badge, .hero-headlines').forEach(el => {
      el.style.cssText = ''
    })
    tabportInlineEls.forEach(el => { el.style.cssText = '' })
    tabportInlineEls = []
  }

  function placeCard(paneW, vh) {
    const cs = Math.min(paneW / PANE_W, vh / CONTENT_H)
    const gapL = 1 * cs
    const mT = 14 * cs
    const mB = 13 * cs
    const mR = 14 * cs
    const cw = Math.max(CARD_W * cs, paneW - gapL - mR)
    const ch = vh - mT - mB
    const radius = 26 * cs
    const border = Math.max(1, cs)

    if (refs.card.value) {
      refs.card.value.style.left = gapL + 'px'
      refs.card.value.style.top = mT + 'px'
      refs.card.value.style.width = cw + 'px'
      refs.card.value.style.height = ch + 'px'
      refs.card.value.style.borderRadius = radius + 'px'
      refs.card.value.style.borderWidth = border + 'px'
    }
    if (refs.cardIn.value) {
      refs.cardIn.value.style.transform = `translate(${(cw - CARD_W * cs) / 2}px,0) scale(${cs})`
    }
  }

  function seatHero(photoW, bandH) {
    if (!refs.hero.value) return
    const imgScale = Math.max(photoW / IMG_W, bandH / IMG_H)
    const s = Math.min(imgScale / IMG_REF_SCALE, photoW * 0.92 / HERO_W)
    refs.hero.value.style.transform = `scale(${s})`
  }

  function layoutLand() {
    layoutMode.value = 'land'
    clearInline()
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    const pr = photoRatio(vw)
    const photoW = Math.round(vw * pr)

    if (refs.photo.value) {
      refs.photo.value.style.width = photoW + 'px'
    }
    if (refs.pane.value) {
      refs.pane.value.style.left = photoW + 'px'
      refs.pane.value.style.width = (vw - photoW) + 'px'
    }

    placeCard(vw - photoW, vh)
    seatHero(photoW, vh)

    if (refs.hero.value) {
      refs.hero.value.style.top = '0px'
      refs.hero.value.style.width = HERO_W + 'px'
      refs.hero.value.style.height = HERO_HEIGHT + 'px'
    }
  }

  function layoutTabport() {
    layoutMode.value = 'tabport'
    clearInline()
    const vw = document.documentElement.clientWidth
    const vh = document.documentElement.clientHeight
    const bandH = Math.round(vh * 0.50)

    if (refs.photo.value) {
      refs.photo.value.style.width = '100%'
      refs.photo.value.style.height = bandH + 'px'
    }

    const side = Math.round(vw * tp.heroSide)
    const cardW = vw - side * 2

    if (refs.hero.value) {
      // 显式宽度 + align-items:flex-start：hero 为绝对定位收缩适配容器，
      // 若无在流子元素会坍缩为 0 宽导致标题逐字换行
      refs.hero.value.style.cssText = `
        position:absolute; left:${side}px; top:0;
        width:${cardW}px; height:auto; transform:none;
        display:flex; flex-direction:column; align-items:flex-start;
      `
    }

    // badge/headlines 一并转入文档流（与手机端媒体查询的结构一致），
    // headlines 原为 position:absolute，不处理会让 hero 收缩宽度为 0
    const badgeK = bandH * tp.badgeH / 37
    const badgeEl = refs.hero.value?.querySelector('.hero-badge')
    if (badgeEl) {
      badgeEl.style.position = 'static'
      badgeEl.style.transform = `scale(${badgeK})`
      badgeEl.style.transformOrigin = 'left center'
      tabportInlineEls.push(badgeEl)
    }
    const headlinesEl = refs.hero.value?.querySelector('.hero-headlines')
    if (headlinesEl) {
      headlinesEl.style.cssText = 'position:static; width:100%; margin-top:6px;'
      tabportInlineEls.push(headlinesEl)
    }

    const hlSize = Math.round(bandH * tp.heroFs)
    ;[refs.hl1, refs.hl2].forEach(ref => {
      if (ref.value) {
        // display:block 使两行标题各自成行（手机端媒体查询同款规则）
        ref.value.style.cssText = `position:static;display:block;font-size:${hlSize}px;line-height:${tp.heroLh};white-space:normal;`
      }
    })
    if (refs.hl1.value) {
      refs.hl1.value.style.maxWidth = Math.round(vw * 0.61) + 'px'
    }

    if (refs.pane.value) {
      refs.pane.value.style.cssText = `position:absolute;left:0;right:0;top:${bandH}px;bottom:0;`
    }

    const cardH = vh - bandH
    const S = Math.min(cardH, cardW * REF_CARD_ASPECT)

    if (refs.card.value) {
      refs.card.value.style.cssText = `
        position:absolute; left:${side}px; top:0;
        width:${cardW}px; height:${cardH}px;
        border-radius:26px; border-width:1px;
      `
    }
    if (refs.cardIn.value) {
      refs.cardIn.value.style.cssText = 'position:absolute;inset:0;transform:none;'
    }

    const pad = Math.round(cardW * tp.pad)
    const elements = buildTabportElements(S, cardW, pad)
    elements.forEach(({ ref, top, left, width, height, fontSize, radius }) => {
      const el = ref?.value || ref
      if (!el) return
      let css = `position:absolute;top:${Math.round(top)}px;`
      if (left !== undefined) css += `left:${Math.round(left)}px;`
      if (width !== undefined) css += `width:${Math.round(width)}px;`
      if (height !== undefined) css += `height:${Math.round(height)}px;`
      if (fontSize !== undefined) css += `font-size:${Math.round(fontSize)}px;`
      if (radius !== undefined) css += `border-radius:${Math.round(radius)}px;`
      el.style.cssText = css
      tabportInlineEls.push(el)
    })
  }

  function layoutPhone() {
    layoutMode.value = 'phone'
    clearInline()
  }

  function layout() {
    const vw = document.documentElement.clientWidth
    if (vw < 700) {
      layoutPhone()
    } else if (mqPortrait?.matches) {
      layoutTabport()
    } else {
      layoutLand()
    }
  }

  // ==================== 入场动画 ====================
  function releaseEntrance() {
    entryRan = true
    document.documentElement.classList.remove('entry-pending')
  }

  function runEntrance() {
    if (entryRan) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion:reduce)').matches
    if (prefersReduced || !Element.prototype.animate) {
      releaseEntrance()
      return
    }

    const compact = window.matchMedia('(max-width:699px)').matches

    const targets = buildEntranceTargets(compact, EASE, SOFT_EASE)

    animations = targets.map(t => {
      const el = typeof t.el === 'function' ? t.el() : t.el?.value
      if (!el) return null
      const to = { opacity: 1, transform: 'none', ...(t.toExtra || {}) }
      const a = el.animate([t.from, to], { delay: t.delay, duration: t.dur, easing: t.easing, fill: 'both' })
      return a
    }).filter(Boolean)

    releaseEntrance()

    Promise.allSettled(animations.map(a => a.finished)).then(() => {
      animations.forEach(a => a.cancel())
      animations = []
    })
  }

  onMounted(() => {
    document.documentElement.classList.add('entry-pending')

    mqLandscape = window.matchMedia('(min-width:700px) and (min-aspect-ratio:51/50)')
    mqPortrait = window.matchMedia('(min-width:700px) and (max-aspect-ratio:51/50)')

    layout()
    window.addEventListener('resize', layout, { passive: true })
    window.addEventListener('orientationchange', layout)
    mqLandscape.addEventListener('change', layout)
    mqPortrait.addEventListener('change', layout)

    Promise.race([
      document.fonts.ready,
      new Promise(r => setTimeout(r, 650))
    ]).then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => runEntrance())
      })
    })
  })

  onUnmounted(() => {
    document.documentElement.classList.remove('entry-pending')
    window.removeEventListener('resize', layout)
    window.removeEventListener('orientationchange', layout)
    mqLandscape?.removeEventListener('change', layout)
    mqPortrait?.removeEventListener('change', layout)
    animations.forEach(a => a.cancel())
    animations = []
  })

  return { layoutMode }
}
