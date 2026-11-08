<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import MarketingFooter from '../../components/marketing/MarketingFooter.vue'
import { http } from '../../services/http'
import { cacheGet } from '../../services/publicCache'
import { useAuthStore } from '../../stores/auth'
import { useCartStore } from '../../stores/cart'
import { useUiStore } from '../../stores/ui'
import { apiError } from '../../utils/apiError'
import {
  examLabel,
  hasDiscount,
  money,
  sellingPrice,
} from '../../utils/courseDisplay'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const cart = useCartStore()
const ui = useUiStore()

const couponCode = ref('')
const checkingOut = ref(false)
const message = ref('')
const branding = ref({
  platform_name: 'AR Education',
  logo_url: null,
  contact_information: '',
  support_email: '',
  currency: 'BDT',
})

const currency = computed(() => branding.value.currency || 'BDT')
const brandName = computed(() => branding.value.platform_name || t('appName'))
const isEmpty = computed(() => cart.count === 0)
const subtotalLabel = computed(() => money(cart.estimatedSubtotal, currency.value))

function formatMoney(amount) {
  return money(amount, currency.value)
}

function removeItem(id) {
  cart.remove(id)
}

async function loadBranding() {
  const cachedLanding = cacheGet('landing')
  if (cachedLanding?.branding) {
    branding.value = { ...branding.value, ...cachedLanding.branding }
    return
  }
  try {
    const { data } = await http.get('/settings/public', { skipErrorToast: true, skipLoading: true })
    branding.value = { ...branding.value, ...(data.data || {}) }
  } catch {
    // Footer still renders with defaults.
  }
}

async function checkout() {
  message.value = ''
  if (isEmpty.value) return

  if (!auth.isAuthenticated) {
    router.push({ name: 'login', query: { redirect: route.fullPath } })
    return
  }

  checkingOut.value = true
  try {
    const payload = {
      course_ids: cart.courseIds,
    }
    const code = couponCode.value.trim()
    if (code) payload.coupon_code = code

    const { data } = await http.post('/orders', payload, { skipErrorToast: true })
    const order = data.data
    const orderedIds = (order.items || []).map((item) => item.course_id).filter(Boolean)
    cart.removeMany(orderedIds.length ? orderedIds : cart.courseIds)

    if (order.status === 'paid') {
      ui.success(t('freeOrderActivated'))
      router.push({ name: 'my-courses' })
      return
    }

    ui.success(Number(order.total) <= 0.009
      ? t('orderCreatedAwaitAdmin', { number: order.order_number })
      : t('orderCreatedPayFromOrders', {
        number: order.order_number,
        total: order.total,
      }))
    router.push({ name: 'order-detail', params: { id: order.id } })
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    checkingOut.value = false
  }
}

onMounted(loadBranding)
</script>

<template>
  <div class="cart-site">
    <section class="cart-site__hero">
      <div class="cart-site__wrap cart-site__hero-inner">
        <div>
          <p class="cart-site__eyebrow">{{ t('courses') }}</p>
          <h1>{{ t('shoppingCart') }}</h1>
          <p class="cart-site__lead">{{ t('shoppingCartLead') }}</p>
        </div>
        <router-link
          v-if="!isEmpty"
          class="cart-site__browse"
          :to="{ name: 'courses' }"
        >
          {{ t('browseCourses') }}
          <span aria-hidden="true">→</span>
        </router-link>
      </div>
    </section>

    <section class="cart-site__body">
      <div class="cart-site__wrap">
        <v-alert v-if="message" type="error" variant="tonal" class="cart-site__alert">{{ message }}</v-alert>

        <div v-if="isEmpty" class="cart-site__empty">
          <v-icon icon="mdi-cart-outline" size="40" />
          <h2>{{ t('cartEmptyTitle') }}</h2>
          <p>{{ t('cartEmpty') }}</p>
          <router-link class="cart-site__cta" :to="{ name: 'courses' }">
            {{ t('browseCourses') }}
          </router-link>
        </div>

        <div v-else class="cart-site__grid">
          <section class="cart-site__list" :aria-label="t('shoppingCart')">
            <article
              v-for="item in cart.items"
              :key="item.id"
              class="cart-site__row"
            >
              <router-link
                class="cart-site__thumb"
                :to="{ name: 'course-detail', params: { slug: item.slug } }"
                :style="item.thumbnail_url ? { backgroundImage: `url(${item.thumbnail_url})` } : undefined"
              >
                <span v-if="!item.thumbnail_url">{{ item.title?.charAt(0) || '?' }}</span>
              </router-link>

              <div class="cart-site__meta">
                <router-link :to="{ name: 'course-detail', params: { slug: item.slug } }">
                  {{ item.title }}
                </router-link>
                <p>{{ examLabel(item, t) }}</p>
                <div class="cart-site__price">
                  <strong>{{ formatMoney(sellingPrice(item)) }}</strong>
                  <s v-if="hasDiscount(item)">{{ formatMoney(item.price) }}</s>
                </div>
              </div>

              <button
                type="button"
                class="cart-site__remove"
                :aria-label="t('removeFromCart')"
                @click="removeItem(item.id)"
              >
                <v-icon icon="mdi-delete-outline" size="20" />
                <span class="cart-site__remove-label">{{ t('removeFromCart') }}</span>
              </button>
            </article>
          </section>

          <aside class="cart-site__summary">
            <h2>{{ t('orderSummary') }}</h2>
            <div class="cart-site__summary-row">
              <span>{{ t('coursesCount', { count: cart.count }) }}</span>
              <strong>{{ subtotalLabel }}</strong>
            </div>
            <p class="cart-site__hint">{{ t('cartPriceHint') }}</p>

            <label class="cart-site__coupon">
              <span>{{ t('couponCode') }}</span>
              <input
                v-model="couponCode"
                type="text"
                maxlength="50"
                :placeholder="t('couponCodePlaceholder')"
                autocomplete="off"
                :disabled="checkingOut"
              >
            </label>

            <button
              type="button"
              class="cart-site__checkout"
              :disabled="checkingOut"
              @click="checkout"
            >
              {{ checkingOut ? t('loading') : (auth.isAuthenticated ? t('checkoutCart') : t('loginToCheckout')) }}
            </button>
          </aside>
        </div>
      </div>
    </section>

    <MarketingFooter
      :brand-name="brandName"
      :logo-url="branding.logo_url"
      :contact-information="branding.contact_information"
      :support-email="branding.support_email"
    />
  </div>
</template>

<style scoped>
.cart-site {
  --ink: #0b1b34;
  --muted: #5b6b7c;
  --line: #e6ebf2;
  --teal: #0f5c66;
  color: var(--ink);
  background: #fff;
  min-height: 100%;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
}

.cart-site__wrap {
  width: min(960px, calc(100% - 1.5rem));
  margin: 0 auto;
}

@media (min-width: 480px) {
  .cart-site__wrap {
    width: min(960px, calc(100% - 2rem));
  }
}

.cart-site__hero {
  padding: 1.25rem 0 1.5rem;
  background: linear-gradient(180deg, #eaf2ff 0%, #ffffff 78%);
}

@media (min-width: 768px) {
  .cart-site__hero {
    padding: 1.6rem 0 2rem;
  }
}

.cart-site__hero-inner {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem 1.25rem;
  justify-content: space-between;
  align-items: flex-end;
}

.cart-site__eyebrow {
  margin: 0 0 0.3rem;
  color: var(--teal);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.cart-site__hero h1 {
  margin: 0;
  font-size: clamp(1.45rem, 5vw, 2rem);
  line-height: 1.15;
  letter-spacing: -0.03em;
  font-weight: 800;
}

.cart-site__lead {
  margin: 0.4rem 0 0;
  color: var(--muted);
  max-width: 36rem;
  line-height: 1.5;
  font-size: 0.95rem;
}

.cart-site__browse,
.cart-site__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0.55rem 0.95rem;
  border-radius: 0.7rem;
  background: #e6f4f5;
  color: var(--teal);
  font-weight: 700;
  text-decoration: none;
}

.cart-site__body {
  padding: 0 0 2.5rem;
  background: #f7f9fc;
}

.cart-site__alert {
  margin: 0 0 1rem;
}

.cart-site__empty {
  display: grid;
  justify-items: center;
  gap: 0.65rem;
  padding: 2rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: 1rem;
  background: #fff;
  color: var(--muted);
  text-align: center;
  box-shadow: 0 10px 28px rgba(11, 27, 52, 0.05);
}

.cart-site__empty h2 {
  margin: 0;
  color: var(--ink);
  font-size: 1.15rem;
}

.cart-site__empty p {
  margin: 0;
  max-width: 28rem;
  line-height: 1.5;
}

.cart-site__cta {
  margin-top: 0.35rem;
  background: #e54c10;
  color: #fff;
  font-weight: 800;
}

.cart-site__grid {
  display: grid;
  gap: 1rem;
}

@media (min-width: 900px) {
  .cart-site__grid {
    grid-template-columns: minmax(0, 1fr) minmax(250px, 300px);
    align-items: start;
  }
}

.cart-site__list,
.cart-site__summary {
  border: 1px solid var(--line);
  border-radius: 1rem;
  background: #fff;
  box-shadow: 0 10px 28px rgba(11, 27, 52, 0.05);
}

.cart-site__row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 0.75rem 0.85rem;
  align-items: start;
  padding: 0.9rem;
  border-bottom: 1px solid #eef2f6;
}

.cart-site__row:last-child {
  border-bottom: 0;
}

@media (min-width: 640px) {
  .cart-site__row {
    grid-template-columns: 88px minmax(0, 1fr) auto;
    align-items: center;
  }
}

.cart-site__thumb {
  width: 72px;
  height: 54px;
  border-radius: 0.65rem;
  background: var(--teal) center / cover no-repeat;
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 800;
  text-decoration: none;
}

@media (min-width: 640px) {
  .cart-site__thumb {
    width: 88px;
    height: 66px;
  }
}

.cart-site__meta {
  min-width: 0;
}

.cart-site__meta a {
  color: var(--ink);
  font-weight: 700;
  text-decoration: none;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.cart-site__meta p {
  margin: 0.2rem 0 0;
  color: #829ab1;
  font-size: 0.85rem;
}

.cart-site__price {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: baseline;
  margin-top: 0.35rem;
}

.cart-site__price strong {
  color: var(--teal);
}

.cart-site__price s {
  color: #9fb3c8;
  font-size: 0.9rem;
}

.cart-site__remove {
  grid-column: 1 / -1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 44px;
  width: 100%;
  border: 0;
  border-radius: 0.7rem;
  background: #f8fafc;
  color: #9b1c1c;
  font: inherit;
  font-size: 0.86rem;
  font-weight: 700;
  cursor: pointer;
}

@media (min-width: 640px) {
  .cart-site__remove {
    grid-column: auto;
    width: 44px;
    padding: 0;
  }

  .cart-site__remove-label {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
}

.cart-site__summary {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
}

@media (min-width: 900px) {
  .cart-site__summary {
    position: sticky;
    top: 5rem;
  }
}

.cart-site__summary h2 {
  margin: 0;
  font-size: 1.05rem;
}

.cart-site__summary-row {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  color: #486581;
}

.cart-site__hint {
  margin: 0;
  color: #829ab1;
  font-size: 0.85rem;
  line-height: 1.45;
}

.cart-site__coupon {
  display: grid;
  gap: 0.35rem;
  color: #486581;
  font-size: 0.9rem;
  font-weight: 600;
}

.cart-site__coupon input {
  min-height: 44px;
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 0.7rem;
  padding: 0.55rem 0.75rem;
  font: inherit;
  box-sizing: border-box;
}

.cart-site__checkout {
  min-height: 48px;
  border: 0;
  border-radius: 0.75rem;
  background: #e54c10;
  color: #fff;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(229, 76, 16, 0.28);
}

.cart-site__checkout:disabled {
  opacity: 0.7;
  cursor: wait;
}
</style>
