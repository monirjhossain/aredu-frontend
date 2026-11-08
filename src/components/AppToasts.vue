<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '../stores/ui'

const { t } = useI18n()
const ui = useUiStore()

const timers = new Map()

const toneMap = computed(() => ({
  success: {
    icon: 'mdi-check-circle',
    label: t('toastSuccess'),
  },
  error: {
    icon: 'mdi-alert-circle',
    label: t('toastError'),
  },
  info: {
    icon: 'mdi-information',
    label: t('toastInfo'),
  },
  warning: {
    icon: 'mdi-alert',
    label: t('toastWarning'),
  },
}))

function clearTimer(id) {
  const timer = timers.get(id)
  if (timer) {
    window.clearTimeout(timer)
    timers.delete(id)
  }
}

function scheduleDismiss(toast) {
  clearTimer(toast.id)
  const timeout = Number(toast.timeout)
  if (!Number.isFinite(timeout) || timeout <= 0) return
  timers.set(
    toast.id,
    window.setTimeout(() => {
      timers.delete(toast.id)
      ui.removeToast(toast.id)
    }, timeout),
  )
}

function dismiss(id) {
  clearTimer(id)
  ui.removeToast(id)
}

watch(
  () => ui.toasts.map((toast) => toast.id).join(','),
  () => {
    const alive = new Set(ui.toasts.map((toast) => toast.id))
    for (const id of timers.keys()) {
      if (!alive.has(id)) clearTimer(id)
    }
    for (const toast of ui.toasts) {
      if (!timers.has(toast.id)) scheduleDismiss(toast)
    }
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  for (const id of [...timers.keys()]) clearTimer(id)
})
</script>

<template>
  <div class="app-toasts" aria-live="polite" aria-relevant="additions">
    <TransitionGroup name="app-toast" tag="div" class="app-toasts__stack">
      <article
        v-for="toast in ui.toasts"
        :key="toast.id"
        class="app-toast"
        :class="`app-toast--${toast.type || 'info'}`"
        role="status"
      >
        <div class="app-toast__shine" aria-hidden="true" />
        <div class="app-toast__icon" aria-hidden="true">
          <v-icon size="20">{{ toneMap[toast.type]?.icon || toneMap.info.icon }}</v-icon>
        </div>
        <div class="app-toast__body">
          <strong>{{ toneMap[toast.type]?.label || toneMap.info.label }}</strong>
          <p>{{ toast.message }}</p>
        </div>
        <button
          type="button"
          class="app-toast__close"
          :aria-label="t('close')"
          @click="dismiss(toast.id)"
        >
          <v-icon size="16">mdi-close</v-icon>
        </button>
        <span
          class="app-toast__timer"
          :style="{ animationDuration: `${Math.max(0, Number(toast.timeout) || 4000)}ms` }"
          aria-hidden="true"
        />
      </article>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.app-toasts {
  position: fixed;
  top: max(0.85rem, env(safe-area-inset-top));
  right: max(0.85rem, env(safe-area-inset-right));
  left: max(0.85rem, env(safe-area-inset-left));
  z-index: 4000;
  pointer-events: none;
  display: flex;
  justify-content: flex-end;
}

.app-toasts__stack {
  display: grid;
  gap: 0.7rem;
  width: min(100%, 24rem);
  pointer-events: none;
}

.app-toast {
  --toast-from: #16a34a;
  --toast-to: #15803d;
  --toast-glow: rgba(22, 163, 74, 0.35);

  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.7rem;
  align-items: start;
  padding: 0.9rem 0.9rem 1rem;
  border-radius: 1rem;
  background: linear-gradient(135deg, var(--toast-from), var(--toast-to));
  color: #fff;
  box-shadow:
    0 16px 36px var(--toast-glow),
    0 1px 0 rgba(255, 255, 255, 0.22) inset;
  pointer-events: auto;
}

.app-toast--success {
  --toast-from: #22c55e;
  --toast-to: #16a34a;
  --toast-glow: rgba(22, 163, 74, 0.38);
}

.app-toast--error {
  --toast-from: #ef4444;
  --toast-to: #dc2626;
  --toast-glow: rgba(220, 38, 38, 0.38);
}

.app-toast--warning {
  --toast-from: #f59e0b;
  --toast-to: #d97706;
  --toast-glow: rgba(217, 119, 6, 0.35);
}

.app-toast--info {
  --toast-from: #14919b;
  --toast-to: #0f5c66;
  --toast-glow: rgba(15, 92, 102, 0.35);
}

.app-toast__shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    115deg,
    transparent 0%,
    rgba(255, 255, 255, 0.18) 32%,
    transparent 55%
  );
  transform: translateX(-120%);
  animation: toast-shine 900ms ease 120ms both;
  pointer-events: none;
}

.app-toast__icon {
  width: 2.15rem;
  height: 2.15rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.12);
  animation: toast-pop 480ms cubic-bezier(0.22, 1, 0.36, 1);
}

.app-toast__body {
  min-width: 0;
  padding-top: 0.05rem;
}

.app-toast__body strong {
  display: block;
  margin: 0 0 0.18rem;
  font-size: 0.76rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.88);
}

.app-toast__body p {
  margin: 0;
  color: #fff;
  font-size: 0.94rem;
  font-weight: 700;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.app-toast__close {
  width: 1.9rem;
  height: 1.9rem;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.app-toast__close:hover {
  background: rgba(255, 255, 255, 0.24);
}

.app-toast__timer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 0.2rem;
  transform-origin: left center;
  background: rgba(255, 255, 255, 0.85);
  animation-name: toast-timer;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}

.app-toast-enter-active {
  transition:
    opacity 280ms ease,
    transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
}

.app-toast-leave-active {
  transition:
    opacity 240ms ease,
    transform 280ms ease;
}

.app-toast-enter-from {
  opacity: 0;
  transform: translate3d(1.4rem, -0.8rem, 0) scale(0.9);
}

.app-toast-leave-to {
  opacity: 0;
  transform: translate3d(0.9rem, -0.4rem, 0) scale(0.96);
}

.app-toast-move {
  transition: transform 280ms ease;
}

@keyframes toast-pop {
  0% {
    transform: scale(0.55);
    opacity: 0.35;
  }
  65% {
    transform: scale(1.12);
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes toast-shine {
  to {
    transform: translateX(130%);
  }
}

@keyframes toast-timer {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}

@media (max-width: 600px) {
  .app-toasts {
    top: max(0.7rem, env(safe-area-inset-top));
    justify-content: stretch;
  }

  .app-toasts__stack {
    width: 100%;
  }
}
</style>
