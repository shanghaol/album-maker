<template>
  <div class="register-stage" :class="layoutMode">
    <!-- ========== 左侧视频面板 ========== -->
    <section ref="photoRef" class="register-photo">
      <video
        ref="videoTallRef"
        class="photo-video photo-video--tall"
        autoplay muted loop playsinline preload="auto"
        :src="VIDEO_URL"
      />
      <video
        ref="videoWideRef"
        class="photo-video photo-video--wide"
        aria-hidden="true"
        autoplay muted loop playsinline preload="auto"
        :src="VIDEO_URL"
      />
      <div class="photo-scrim" />
      <div class="photo-fade" />
      <div ref="heroRef" class="photo-hero">
        <div class="hero-badge">
          <svg class="hero-badge-icon" viewBox="0 0 582 557" fill="none">
            <path d="M449.0 0.0 435.0 0.0 415.0 10.0 200.0 249.0 187.0 276.0 189.0 299.0 212.0 326.0 232.0 332.0 289.0 334.0 289.0 516.0 301.0 543.0 324.0 556.0 346.0 556.0 374.0 536.0 573.0 311.0 582.0 288.0 579.0 264.0 559.0 240.0 539.0 233.0 478.0 230.0 478.0 32.0 470.0 13.0ZM442.0 38.0 446.0 250.0 466.0 267.0 540.0 270.0 547.0 285.0 341.0 520.0 332.0 522.0 324.0 514.0 321.0 314.0 307.0 300.0 295.0 297.0 233.0 297.0 224.0 291.0 221.0 282.0ZM1.0 67.0 4.0 81.0 17.0 90.0 216.0 90.0 223.0 87.0 232.0 74.0 228.0 57.0 215.0 49.0 18.0 49.0 5.0 57.0ZM0.0 285.0 4.0 300.0 17.0 308.0 105.0 308.0 118.0 299.0 121.0 291.0 119.0 278.0 111.0 270.0 103.0 267.0 17.0 267.0 4.0 275.0ZM1.0 495.0 4.0 511.0 10.0 517.0 23.0 520.0 179.0 520.0 191.0 516.0 200.0 500.0 196.0 488.0 182.0 479.0 18.0 479.0 9.0 483.0Z" fill="white" fill-rule="evenodd"/>
          </svg>
          <span class="hero-badge-text">相册制作平台</span>
        </div>
        <div class="hero-headlines">
          <span ref="hl1Ref" class="hero-hl" id="reg-hl1">开启你的</span>
          <span ref="hl2Ref" class="hero-hl" id="reg-hl2">创作之旅</span>
        </div>
      </div>
    </section>

    <!-- ========== 右侧注册卡片 ========== -->
    <section ref="paneRef" class="register-pane">
      <div ref="cardRef" class="register-card" :class="{ 'card-shake': shakeAnim }">
        <div ref="cardInRef" class="register-card-inner">
          <h1 ref="h1Ref" class="card-h1">创建账号</h1>
          <p ref="subRef" class="card-sub">
            <b>注册</b>开始制作您的专属相册
          </p>

          <div ref="phoneFieldRef" class="card-field" id="reg-field-phone">
            <input
              v-model="form.phone"
              type="text"
              inputmode="numeric"
              autocomplete="tel"
              aria-label="手机号"
              placeholder="请输入手机号"
              class="card-input"
            />
          </div>

          <div ref="nickFieldRef" class="card-field" id="reg-field-nick">
            <input
              v-model="form.nickname"
              type="text"
              autocomplete="name"
              aria-label="昵称"
              placeholder="昵称（选填）"
              class="card-input"
            />
          </div>

          <div ref="pwFieldRef" class="card-field card-field--pw" id="reg-field-pw">
            <input
              ref="pwInputRef"
              v-model="form.password"
              type="password"
              autocomplete="new-password"
              aria-label="密码"
              placeholder="请设置密码（8位以上，含字母和数字）"
              class="card-input"
            />
          </div>

          <div v-if="form.password" class="pw-strength" ref="strengthRef">
            <div class="pw-strength-bar">
              <div
                class="pw-strength-fill"
                :class="strengthColorClass"
                :style="{ width: strengthPercent + '%' }"
              />
            </div>
            <span class="pw-strength-label" :class="strengthTextColorClass">{{ strengthLabel }}</span>
          </div>

          <button
            ref="regBtnRef"
            class="card-btn"
            :disabled="loading"
            @click="handleRegister"
          >
            <span>{{ loading ? '注册中...' : '注册' }}</span>
            <svg class="card-btn-arrow" viewBox="0 0 22 22">
              <path d="M3 11h15.4M11 3.3l7.7 7.7-7.7 7.7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>

          <div ref="dividerRef" class="card-divider">
            <i /><b>或</b><i />
          </div>

          <p ref="bottomRef" class="card-bottom">
            已有账号？
            <router-link to="/login">立即登录</router-link>
          </p>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { register } from '@/api/auth'
import { ElMessage } from 'element-plus'
import { useAuthLayout } from '@/composables/useAuthLayout'

const router = useRouter()

const VIDEO_URL = '/videos/bg.mp4'

const loading = ref(false)
const shakeAnim = ref(false)

const form = reactive({ phone: '', password: '', nickname: '' })

const pwInputRef = ref(null)
const photoRef = ref(null)
const paneRef = ref(null)
const cardRef = ref(null)
const cardInRef = ref(null)
const heroRef = ref(null)
const hl1Ref = ref(null)
const hl2Ref = ref(null)
const h1Ref = ref(null)
const subRef = ref(null)
const phoneFieldRef = ref(null)
const nickFieldRef = ref(null)
const pwFieldRef = ref(null)
const strengthRef = ref(null)
const regBtnRef = ref(null)
const dividerRef = ref(null)
const bottomRef = ref(null)

const strengthLevel = computed(() => {
  const pwd = form.password
  if (!pwd || pwd.length < 8) return 0
  let score = 0
  if (pwd.length >= 10) score++
  if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[^a-zA-Z0-9]/.test(pwd)) score++
  return Math.min(score, 3)
})

const strengthPercent = computed(() => (strengthLevel.value / 3) * 100)

const strengthColorClass = computed(() => {
  if (strengthLevel.value <= 1) return 'fill-red'
  if (strengthLevel.value === 2) return 'fill-amber'
  return 'fill-emerald'
})

const strengthTextColorClass = computed(() => {
  if (strengthLevel.value <= 1) return 'text-red'
  if (strengthLevel.value === 2) return 'text-amber'
  return 'text-emerald'
})

const strengthLabel = computed(() => {
  if (strengthLevel.value <= 1) return '弱'
  if (strengthLevel.value === 2) return '中'
  return '强'
})

function triggerShake() {
  shakeAnim.value = true
  setTimeout(() => { shakeAnim.value = false }, 600)
}

async function handleRegister() {
  if (!form.phone || !form.password) {
    ElMessage.warning('请填写手机号和密码')
    return
  }
  if (!/^1[3-9]\d{9}$/.test(form.phone)) {
    ElMessage.warning('手机号格式不正确')
    return
  }
  // 与后端 RegisterRequest 校验规则保持一致：8-64位且必须同时包含字母和数字
  if (form.password.length < 8 || !/^(?=.*[a-zA-Z])(?=.*\d).{8,}$/.test(form.password)) {
    ElMessage.warning('密码至少8位，且必须包含字母和数字')
    return
  }
  loading.value = true
  try {
    await register({
      phone: form.phone,
      password: form.password,
      nickname: form.nickname || undefined
    })
    // 注册成功后跳转登录页并预填手机号（注册接口返回的 token 不落地）
    ElMessage.success('注册成功，请登录')
    router.push({ path: '/login', query: form.phone ? { phone: form.phone } : {} })
  } catch (e) {
    triggerShake()
  } finally {
    loading.value = false
  }
}

// ==================== 响应式布局引擎（共享实现见 useAuthLayout.js） ====================
const TP = {
  pad: 0.1076, h1Top: 0.08656, h1Fs: 0.06839,
  subTop: 0.17368, subFs: 0.0309,
  emTop: 0.25435, emH: 0.10257, emR: 0.0202,
  nickTop: 0.320, nickH: 0.10257,
  pwTop: 0.410, pwH: 0.10839,
  btnTop: 0.555, btnH: 0.10981, btnFs: 0.0275,
  divTop: 0.710, orFs: 0.02245,
  btTop: 0.89668, btFs: 0.02876,
  badgeH: 0.0742, heroFs: 0.1058, heroLh: 1.1246,
  heroBot: 0.06493, heroGap: -0.30423, heroSide: 0.0525
}

const { layoutMode } = useAuthLayout({
  refs: { photo: photoRef, pane: paneRef, card: cardRef, cardIn: cardInRef, hero: heroRef, hl1: hl1Ref, hl2: hl2Ref },
  tp: TP,
  buildTabportElements: (S, cardW, pad) => [
    { ref: h1Ref, top: S * TP.h1Top, left: pad, fontSize: S * TP.h1Fs },
    { ref: subRef, top: S * TP.subTop, left: pad, fontSize: S * TP.subFs },
    { ref: phoneFieldRef, top: S * TP.emTop, left: pad, width: cardW - pad * 2, height: S * TP.emH, radius: S * TP.emR },
    { ref: nickFieldRef, top: S * TP.nickTop, left: pad, width: cardW - pad * 2, height: S * TP.nickH, radius: S * TP.emR },
    { ref: pwFieldRef, top: S * TP.pwTop, left: pad, width: cardW - pad * 2, height: S * TP.pwH, radius: S * TP.emR },
    { ref: regBtnRef, top: S * TP.btnTop, left: pad, width: cardW - pad * 2, height: S * TP.btnH, fontSize: S * TP.btnFs },
    { ref: dividerRef, top: S * TP.divTop, left: pad, width: cardW - pad * 2 },
    { ref: bottomRef, top: S * TP.btTop, left: pad, width: cardW - pad * 2, fontSize: S * TP.btFs },
    { ref: strengthRef, top: S * 0.51, left: pad, width: cardW - pad * 2 },
  ],
  buildEntranceTargets: (compact, ease, softEase) => [
    { el: cardRef, delay: 40, dur: 820, easing: ease, from: compact ? { opacity: 0, transform: 'translateY(14px)' } : { opacity: 0, transform: 'translateY(12px) scale(.988)' } },
    { el: () => photoRef.value?.querySelector('.hero-badge'), delay: 120, dur: 480, easing: softEase, from: { opacity: 0, transform: 'translateY(8px)' } },
    { el: hl1Ref, delay: 240, dur: 760, easing: ease, from: { opacity: 0, transform: `translateY(${compact ? 12 : 16}px)`, clipPath: 'inset(100% 0 0 0)' }, toExtra: { clipPath: 'inset(0 0 0 0)' } },
    { el: hl2Ref, delay: 330, dur: 760, easing: ease, from: { opacity: 0, transform: `translateY(${compact ? 12 : 16}px)`, clipPath: 'inset(100% 0 0 0)' }, toExtra: { clipPath: 'inset(0 0 0 0)' } },
    { el: h1Ref, delay: 470, dur: 620, easing: ease, from: { opacity: 0, transform: 'translateY(10px)' } },
    { el: subRef, delay: 570, dur: 560, easing: ease, from: { opacity: 0, transform: 'translateY(10px)' } },
    { el: phoneFieldRef, delay: 720, dur: 520, easing: softEase, from: { opacity: 0, transform: 'translateY(8px)' } },
    { el: nickFieldRef, delay: 760, dur: 520, easing: softEase, from: { opacity: 0, transform: 'translateY(8px)' } },
    { el: pwFieldRef, delay: 800, dur: 520, easing: softEase, from: { opacity: 0, transform: 'translateY(8px)' } },
    { el: regBtnRef, delay: 930, dur: 560, easing: ease, from: { opacity: 0, transform: 'translateY(8px)' } },
    { el: dividerRef, delay: 1060, dur: 440, easing: softEase, from: { opacity: 0, transform: 'translateY(6px)' } },
    { el: bottomRef, delay: 1150, dur: 540, easing: ease, from: { opacity: 0, transform: 'translateY(8px)' } },
  ],
})

</script>

<style scoped>
/* ==================== 容器 ==================== */
.register-stage {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #fefefe;
}

/* ==================== 左侧视频面板 ==================== */
.register-photo {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: 57.1038%;
  overflow: hidden;
}

.photo-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  -webkit-user-drag: none;
}

.photo-video--tall {
  object-position: 100% 50%;
}

.photo-video--wide {
  display: none;
  object-position: 50% 50%;
}

.photo-scrim {
  display: none;
}

.photo-fade {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 200px;
  background: linear-gradient(to right, transparent, rgba(254,254,254,0.65), #fefefe);
  pointer-events: none;
  z-index: 2;
}

.photo-hero {
  position: absolute;
  left: 0;
  top: 0;
  width: 836px;
  height: 949px;
  transform-origin: left top;
  pointer-events: none;
}

.photo-hero > * {
  pointer-events: auto;
}

.hero-badge {
  position: absolute;
  left: 34px;
  top: 38px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 37px;
  padding: 0 16px 0 19px;
  border-radius: 999px;
  background: #2f2a27b0;
  backdrop-filter: blur(7px) saturate(120%);
  -webkit-backdrop-filter: blur(7px) saturate(120%);
  box-shadow: 0 1px 2px rgba(0,0,0,.18), 0 6px 18px rgba(0,0,0,.14);
  white-space: nowrap;
}

.hero-badge-icon {
  width: 17px;
  height: 16.27px;
  flex-shrink: 0;
  position: relative;
  top: -1px;
}

.hero-badge-text {
  font-size: 13.6px;
  font-weight: 400;
  letter-spacing: -0.163px;
  color: #fff;
  font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif;
}

.hero-headlines {
  position: absolute;
  left: 0;
  right: 0;
}

.hero-hl {
  position: absolute;
  left: 50px;
  font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif;
  font-weight: 600;
  line-height: 1;
  color: #15191fd0;
  white-space: nowrap;
}

#reg-hl1 {
  top: 120px;
  font-size: 80px;
  letter-spacing: 0px;
}

#reg-hl2 {
  top: 220px;
  font-size: 80px;
  letter-spacing: 0px;
  left: 50px;
}

/* ==================== 右侧面板 ==================== */
.register-pane {
  position: absolute;
  left: 57.1038%;
  right: 0;
  top: 0;
  bottom: 0;
}

.register-card {
  position: absolute;
  left: 1px;
  top: 14px;
  width: 613px;
  height: 922px;
  border-radius: 26px;
  overflow: hidden;
  background: rgba(254, 254, 254, 0.90);
  backdrop-filter: blur(28px) saturate(160%);
  -webkit-backdrop-filter: blur(28px) saturate(160%);
  border: 1px solid rgba(0, 0, 0, 0.036);
  box-shadow: 1px 10px 14px rgba(10, 14, 20, 0.14), 0 1px 3px rgba(10, 14, 20, 0.05);
}

.register-card-inner {
  position: relative;
  width: 613px;
  height: 922px;
  transform-origin: left top;
}

/* ==================== 卡片内容 ==================== */
.card-h1 {
  position: absolute;
  left: 62px;
  top: 65px;
  font-size: 42.55px;
  font-weight: 600;
  letter-spacing: -2.553px;
  color: #2c3343;
  font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif;
}

.card-sub {
  position: absolute;
  left: 62px;
  top: 128px;
  font-size: 20.41px;
  font-weight: 400;
  letter-spacing: -0.245px;
  color: #797979;
}

.card-sub b {
  font-weight: 700;
}

.card-field {
  position: absolute;
  left: 62px;
  width: 489px;
  display: flex;
  align-items: center;
  border-radius: 12px;
  background: #fafafa;
  border: 1.5px solid #acacae;
}

#reg-field-phone {
  top: 190px;
  height: 55px;
}

#reg-field-nick {
  top: 258px;
  height: 55px;
}

#reg-field-pw {
  top: 326px;
  height: 55px;
}

.card-input {
  width: 100%;
  height: 100%;
  padding: 0 19px;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15.68px;
  font-weight: 400;
  letter-spacing: -0.188px;
  color: #000;
  font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif;
}

.card-input::placeholder {
  color: #606060;
}

.card-input:focus {
  outline: none;
}

/* ==================== 密码强度 ==================== */
.pw-strength {
  position: absolute;
  left: 62px;
  top: 388px;
  width: 489px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pw-strength-bar {
  flex: 1;
  height: 3px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 999px;
  overflow: hidden;
}

.pw-strength-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}

.pw-strength-fill.fill-red { background: #ef4444; }
.pw-strength-fill.fill-amber { background: #f59e0b; }
.pw-strength-fill.fill-emerald { background: #10b981; }

.pw-strength-label {
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.pw-strength-label.text-red { color: #ef4444; }
.pw-strength-label.text-amber { color: #f59e0b; }
.pw-strength-label.text-emerald { color: #10b981; }

/* ==================== 注册按钮 ==================== */
.card-btn {
  position: absolute;
  left: 62px;
  top: 420px;
  width: 489px;
  height: 65.5px;
  border-radius: 999px;
  background: linear-gradient(180deg, #283139 0%, #293340 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding-right: 4px;
  border: none;
  cursor: pointer;
  font-size: 16.38px;
  font-weight: 400;
  letter-spacing: 0.2px;
  font-family: 'Inter', 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif;
  box-shadow: 0 8px 20px rgba(18, 26, 34, 0.16), 0 2px 5px rgba(18, 26, 34, 0.10);
  transition: transform 0.18s cubic-bezier(0.2, 0.7, 0.3, 1), box-shadow 0.18s ease, filter 0.18s ease;
}

.card-btn:hover:not(:disabled) {
  filter: brightness(1.12);
}

.card-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.card-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.card-btn-arrow {
  width: 13.2px;
  height: 13.2px;
  flex-shrink: 0;
}

/* ==================== 分割线 ==================== */
.card-divider {
  position: absolute;
  left: 63px;
  top: 520px;
  width: 487px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-divider i {
  height: 1.5px;
  background: #b1b1b2;
  flex: 0 0 205px;
}

.card-divider b {
  flex: 1 1 auto;
  text-align: center;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: #5a5a5b;
}

/* ==================== 底部文字 ==================== */
.card-bottom {
  position: absolute;
  left: 62px;
  width: 489px;
  top: 611px;
  text-align: center;
  font-size: 16.37px;
  font-weight: 400;
  letter-spacing: -0.196px;
  color: #0a0a0a;
}

.card-bottom a {
  color: #000;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-thickness: 2px;
}

/* ==================== 抖动动画 ==================== */
.card-shake {
  animation: card-shake 0.5s ease;
}

@keyframes card-shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
  20%, 40%, 60%, 80% { transform: translateX(6px); }
}

/* ==================== 平板竖屏 ==================== */
.tabport .photo-video--tall { display: none; }
.tabport .photo-video--wide { display: block; }
.tabport .register-card { position: absolute; }
.tabport .register-card-inner { position: absolute; }

.tabport .photo-fade {
  right: auto;
  top: auto;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 160px;
  background: linear-gradient(to bottom, transparent, rgba(254,254,254,0.65), #fefefe);
}

/* ==================== 手机端 ==================== */
@media (max-width: 699px) {
  .register-stage {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 100svh;
    height: auto;
    overflow-y: auto;
    background: #fff;
  }

  .register-photo {
    position: relative;
    width: 100%;
    height: clamp(280px, 46svh, 380px);
    flex-shrink: 0;
  }

  .photo-video--tall { display: none; }
  .photo-video--wide {
    display: block;
    object-position: 64% 48%;
    transform: scale(1.015);
  }

  .photo-scrim {
    display: block;
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(7,10,13,.02) 18%, rgba(7,10,13,.12) 48%, rgba(7,10,13,.78) 100%);
    pointer-events: none;
  }

  .photo-hero {
    position: absolute;
    left: 28px;
    right: 20px;
    top: 18px;
    width: auto;
    height: auto;
    transform: none !important;
  }

  .hero-badge {
    position: static;
    height: 31px;
    padding: 0 12px;
    background: rgba(24, 27, 30, 0.50);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
    transform: none !important;
  }

  .hero-badge-text { font-size: 11px; }
  .hero-badge-icon { width: 14px; height: 13.4px; }

  .hero-headlines {
    position: static;
    margin-top: 6px;
  }

  .hero-hl {
    position: static;
    display: block;
    color: #ffffffd0;
    font-size: clamp(40px, 8.8vw, 50px) !important;
    letter-spacing: 0ch !important;
    line-height: 1.1 !important;
    text-shadow: 0 2px 18px rgba(0, 0, 0, 0.77);
    white-space: normal;
  }

  .register-pane {
    position: relative;
    left: 0;
    right: 0;
    top: 0;
    bottom: auto;
  }

  .register-card {
    position: relative;
    left: 0;
    top: -28px;
    width: 100%;
    height: auto;
    min-height: calc(100svh - clamp(244px, 34svh, 304px) + 28px);
    border-radius: 28px 28px 0 0;
    background: #fff;
    border: 0;
    box-shadow: 0 -10px 28px rgba(20, 28, 36, 0.10);
  }

  .register-card-inner {
    position: relative;
    width: 100%;
    height: auto;
    max-width: 500px;
    margin: 0 auto;
    padding: 36px clamp(24px, 7vw, 38px) max(30px, env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    justify-content: center;
    transform: none !important;
  }

  .card-h1, .card-sub, .card-field, .card-btn, .card-divider, .card-bottom, .pw-strength {
    position: static;
    width: 100%;
    left: auto;
    top: auto;
  }

  .card-h1 {
    font-size: clamp(31px, 8.8vw, 38px);
    letter-spacing: -0.025em;
    margin-bottom: 8px;
  }

  .card-sub { font-size: 15px; margin-bottom: 28px; }
  .card-field { height: 56px; margin-bottom: 12px; }
  .pw-strength { margin-bottom: 6px; }
  .card-input { font-size: 16px; }
  .card-btn { height: 58px; margin: 8px 0 20px; font-size: 16px; }
  .card-divider { margin-bottom: 20px; justify-content: center; }
  .card-bottom { font-size: 14px; margin-top: 4px; }

  .photo-fade {
    right: auto;
    top: auto;
    left: 0;
    bottom: 0;
    width: 100%;
    height: 160px;
    background: linear-gradient(to bottom, transparent, rgba(254,254,254,0.65), #fefefe);
  }
}

@media (max-width: 370px) {
  .register-photo { height: 280px; }
  .hero-hl { font-size: 30px !important; }
}

@media (max-height: 520px) and (orientation: landscape) {
  .register-photo { height: 240px; }
  .register-card-inner { justify-content: flex-start; }
}
</style>

<style>
/* ==================== 全局：入场动画初始状态（非 scoped，因为 .entry-pending 在 <html> 上） ==================== */
.entry-pending .register-card {
  opacity: 0;
  transform: translateY(12px) scale(0.988);
  will-change: transform, opacity;
}

.entry-pending .hero-badge {
  opacity: 0;
  transform: translateY(8px);
  will-change: transform, opacity;
}

.entry-pending .hero-hl {
  opacity: 0;
  transform: translateY(16px);
  clip-path: inset(100% 0 0 0);
  will-change: transform, opacity, clip-path;
}

.entry-pending .card-h1,
.entry-pending .card-sub,
.entry-pending .pw-strength {
  opacity: 0;
  transform: translateY(10px);
  will-change: transform, opacity;
}

.entry-pending .card-field,
.entry-pending .card-btn,
.entry-pending .card-divider,
.entry-pending .card-bottom {
  opacity: 0;
  transform: translateY(8px);
  will-change: transform, opacity;
}

@media (max-width: 699px) {
  .entry-pending .register-card {
    transform: translateY(14px);
  }

  .entry-pending .hero-hl {
    transform: translateY(12px);
  }
}

:focus-visible {
  outline: 2px solid #2b6cb0;
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  .entry-pending .register-card,
  .entry-pending .hero-badge,
  .entry-pending .hero-hl,
  .entry-pending .card-h1,
  .entry-pending .card-sub,
  .entry-pending .pw-strength,
  .entry-pending .card-field,
  .entry-pending .card-btn,
  .entry-pending .card-divider,
  .entry-pending .card-bottom {
    opacity: 1 !important;
    transform: none !important;
    clip-path: none !important;
    will-change: auto !important;
  }
  .card-btn {
    transition: none !important;
  }
  .card-shake {
    animation: none !important;
  }
}
</style>