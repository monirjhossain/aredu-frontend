<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { http } from '../../services/http'
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

const currency = 'BDT'
const isEmpty = computed(() => cart.count === 0)
const subtotalLabel = computed(() => money(cart.estimatedSubtotal, currency))

function formatMoney(amount) {
  return money(amount, currency)
}

function removeItem(id) {
  cart.remove(id)
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

    if (order.status === 'paid' || Number(order.total) <= 0.009) {
      ui.success(t('freeOrderActivated'))
      router.push({ name: 'my-courses' })
      return
    }

    ui.success(t('orderCreatedPayFromOrders', {
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
</script>

<template>
  <div class="cart-page">
    <header class="cart-page__hero">
      <div>
        <p class="cart-page__eyebrow">{{ t('myOrders') }}</p>
        <h1>{{ t('shoppingCart') }}</h1>
        <p>{{ t('shoppingCartLead') }}</p>
      </div>
      <router-link class="cart-page__browse" :to="{ name: 'courses' }">
        {{ t('browseCourses') }}
        <span aria-hidden="true">→</span>
      </router-link>
    </header>

    <v-alert v-if="message" type="error" variant="tonal" class="cart-page__alert">{{ message }}</v-alert>

    <div v-if="isEmpty" class="cart-page__empty">
      <v-icon icon="mdi-cart-outline" size="36" />
      <p>{{ t('cartEmpty') }}</p>
      <router-link class="cart-page__cta" :to="{ name: 'courses' }">
        {{ t('browseCourses') }}
      </router-link>
    </div>

    <div v-else class="cart-page__grid">
      <section class="cart-page__list" aria-label="Cart items">
        <article
          v-for="item in cart.items"
          :key="item.id"
          class="cart-page__row"
        >
          <router-link
            class="cart-page__thumb"
            :to="{ name: 'course-detail', params: { slug: item.slug } }"
            :style="item.thumbnail_url ? { backgroundImage: `url(${item.thumbnail_url})` } : undefined"
          >
            <span v-if="!item.thumbnail_url">{{ item.title?.charAt(0) || '?' }}</span>
          </router-link>

          <div class="cart-page__meta">
            <router-link :to="{ name: 'course-detail', params: { slug: item.slug } }">
              {{ item.title }}
            </router-link>
            <p>{{ examLabel(item, t) }}</p>
            <div class="cart-page__price">
              <strong>{{ formatMoney(sellingPrice(item)) }}</strong>
              <s v-if="hasDiscount(item)">{{ formatMoney(item.price) }}</s>
            </div>
          </div>

          <button
            type="button"
            class="cart-page__remove"
            :aria-label="t('removeFromCart')"
            @click="removeItem(item.id)"
          >
            <v-icon icon="mdi-delete-outline" size="20" />
          </button>
        </article>
      </section>

      <aside class="cart-page__summary">
        <h2>{{ t('orderSummary') }}</h2>
        <div class="cart-page__summary-row">
          <span>{{ t('coursesCount', { count: cart.count }) }}</span>
          <strong>{{ subtotalLabel }}</strong>
        </div>
        <p class="cart-page__hint">{{ t('cartPriceHint') }}</p>

        <label class="cart-page__coupon">
          <span>{{ t('couponCode') }}</span>
          <input
            v-model="couponCode"
            type="text"
            maxlength="50"
            :placeholder="t('couponCodePlaceholder')"
            autocomplete="off"
          >
        </label>

        <button
          type="button"
          class="cart-page__checkout"
          :disabled="checkingOut"
          @click="checkout"
        >
          {{ checkingOut ? t('loading') : (auth.isAuthenticated ? t('checkoutCart') : t('loginToCheckout')) }}
        </button>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.cart-page {
  display: grid;
  gap: 1.25rem;
  padding: 1rem 1rem 2rem;
  max-width: 1100px;
  margin: 0 auto;
}

.cart-page__hero {
  display: flex;
  flex-wrap: wrap;
  gap: 0.85rem 1.25rem;
  justify-content: space-between;
  align-items: flex-end;
}

.cart-page__eyebrow {
  margin: 0 0 0.25rem;
  color: #0f5c66;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.cart-page__hero h1 {
  margin: 0;
  font-size: clamp(1.55rem, 4vw, 2rem);
  line-height: 1.15;
  color: #102a43;
}

.cart-page__hero p {
  margin: 0.35rem 0 0;
  color: #627d98;
  max-width: 36rem;
}

.cart-page__browse,
.cart-page__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0.55rem 0.9rem;
  border-radius: 0.75rem;
  background: #e6f4f5;
  color: #0f5c66;
  font-weight: 700;
  text-decoration: none;
}

.cart-page__alert {
  margin: 0;
}

.cart-page__empty {
  display: grid;
  justify-items: center;
  gap: 0.75rem;
  padding: 2.5rem 1rem;
  border: 1px dashed #cbd5e1;
  border-radius: 1rem;
  background: #fff;
  color: #627d98;
  text-align: center;
}

.cart-page__grid {
  display: grid;
  gap: 1rem;
}

@media (min-width: 900px) {
  .cart-page__grid {
    grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
    align-items: start;
  }
}

.cart-page__list,
.cart-page__summary {
  border: 1px solid #e2e8f0;
  border-radius: 1rem;
  background: #fff;
}

.cart-page__row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.85rem;
  border-bottom: 1px solid #eef2f6;
}

.cart-page__row:last-child {
  border-bottom: 0;
}

.cart-page__thumb {
  width: 72px;
  height: 54px;
  border-radius: 0.65rem;
  background: #0f5c66 center / cover no-repeat;
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 800;
  text-decoration: none;
}

.cart-page__meta {
  min-width: 0;
}

.cart-page__meta a {
  color: #102a43;
  font-weight: 700;
  text-decoration: none;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cart-page__meta p {
  margin: 0.2rem 0 0;
  color: #829ab1;
  font-size: 0.85rem;
}

.cart-page__price {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: baseline;
  margin-top: 0.35rem;
}

.cart-page__price strong {
  color: #0f5c66;
}

.cart-page__price s {
  color: #9fb3c8;
  font-size: 0.9rem;
}

.cart-page__remove {
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 0.7rem;
  background: #f8fafc;
  color: #9b1c1c;
  cursor: pointer;
}

.cart-page__summary {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
}

.cart-page__summary h2 {
  margin: 0;
  font-size: 1.05rem;
  color: #102a43;
}

.cart-page__summary-row {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  color: #486581;
}

.cart-page__hint {
  margin: 0;
  color: #829ab1;
  font-size: 0.85rem;
}

.cart-page__coupon {
  display: grid;
  gap: 0.35rem;
  color: #486581;
  font-size: 0.9rem;
  font-weight: 600;
}

.cart-page__coupon input {
  min-height: 44px;
  border: 1px solid #cbd5e1;
  border-radius: 0.7rem;
  padding: 0.55rem 0.75rem;
  font: inherit;
}

.cart-page__checkout {
  min-height: 48px;
  border: 0;
  border-radius: 0.8rem;
  background: linear-gradient(135deg, #0f5c66, #147d89);
  color: #fff;
  font-weight: 800;
  cursor: pointer;
}

.cart-page__checkout:disabled {
  opacity: 0.7;
  cursor: wait;
}

@media (max-width: 600px) {
  .cart-page {
    padding: 0.85rem 0.75rem 1.75rem;
  }

  .cart-page__row {
    grid-template-columns: 64px minmax(0, 1fr);
  }

  .cart-page__remove {
    grid-column: 1 / -1;
    width: 100%;
  }
}
</style>
