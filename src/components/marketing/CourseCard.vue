<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useLocaleStore } from '../../stores/locale'
import {
  discountPct,
  hasDiscount,
  money,
  sellingPrice,
} from '../../utils/courseDisplay'

const props = defineProps({
  course: { type: Object, required: true },
  currency: { type: String, default: 'BDT' },
})

const { t } = useI18n()
const localeStore = useLocaleStore()

const off = computed(() => discountPct(props.course))

const learnersLabel = computed(() => {
  const count = props.course?.learners_count
  if (count == null || count === '') return ''
  return t('learnersCount', { count: formatInt(count) })
})

const classStartLabel = computed(() => {
  const date = props.course?.class_starts_on
  if (!date) return ''
  return t('classStartsOn', { date: formatShortDate(date) })
})

const batchLabel = computed(() => {
  const batch = props.course?.batch_number
  if (batch == null || batch === '') return ''
  return t('batchNumber', { number: formatInt(batch) })
})

const seatsLabel = computed(() => {
  const seats = props.course?.seats_left
  if (seats == null || seats === '') return ''
  return t('seatsLeft', { count: formatInt(seats) })
})

const offerLabel = computed(() => {
  const days = props.course?.offer_days_left
  if (days == null) return ''
  if (Number(days) <= 0) return t('offerEndsToday')
  return t('offerDaysLeft', { count: formatInt(days) })
})

function formatInt(value) {
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Intl.NumberFormat(locale).format(Number(value || 0))
}

function formatShortDate(value) {
  const locale = localeStore.locale === 'bn' ? 'bn-BD' : 'en-GB'
  return new Date(`${value}T00:00:00`).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  })
}
</script>

<template>
  <router-link
    class="m-course"
    :to="{ name: 'course-detail', params: { slug: course.slug } }"
  >
    <div
      class="m-course__media"
      :style="course.thumbnail_url ? { backgroundImage: `url(${course.thumbnail_url})` } : undefined"
    >
      <span v-if="!course.thumbnail_url" class="m-course__media-title">{{ course.title }}</span>
    </div>

    <div class="m-course__body">
      <div v-if="learnersLabel || classStartLabel" class="m-course__topmeta">
        <div v-if="learnersLabel" class="m-course__learners">
          <span class="m-course__avatars" aria-hidden="true">
            <span /><span /><span />
          </span>
          <span>{{ learnersLabel }}</span>
        </div>
        <span v-if="classStartLabel" class="m-course__start">
          <span class="m-course__start-dot" aria-hidden="true" />
          {{ classStartLabel }}
        </span>
      </div>

      <h3>{{ course.title }}</h3>

      <div v-if="batchLabel || seatsLabel" class="m-course__chips">
        <span v-if="batchLabel" class="m-course__chip">
          <v-icon size="14" icon="mdi-file-document-outline" />
          {{ batchLabel }}
        </span>
        <span v-if="seatsLabel" class="m-course__chip">
          <v-icon size="14" icon="mdi-seat" />
          {{ seatsLabel }}
        </span>
      </div>

      <div class="m-course__price-row">
        <div class="m-course__prices">
          <strong>{{ money(sellingPrice(course), currency) }}</strong>
          <s v-if="hasDiscount(course)">{{ money(course.price, currency) }}</s>
        </div>
        <span v-if="off" class="m-course__off">{{ off }}% {{ t('landingOff') }}</span>
      </div>

      <div v-if="offerLabel" class="m-course__offer">
        <v-icon size="15" icon="mdi-timer-sand" />
        <span>{{ offerLabel }}</span>
      </div>

      <span class="m-course__cta">
        {{ t('seeDetails') }}
        <span aria-hidden="true">→</span>
      </span>
    </div>
  </router-link>
</template>

<style scoped>
.m-course {
  display: flex;
  flex-direction: column;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  overflow: hidden;
  border-radius: 0.9rem;
  border: 1px solid #e8edf3;
  background: #fff;
  text-decoration: none;
  color: inherit;
  box-shadow: 0 6px 18px rgba(11, 27, 52, 0.05);
  transition: transform 180ms ease, box-shadow 180ms ease;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
}

@media (hover: hover) {
  .m-course:hover {
    transform: translateY(-3px);
    box-shadow: 0 14px 28px rgba(11, 27, 52, 0.1);
  }
}

.m-course__media {
  position: relative;
  aspect-ratio: 16 / 9;
  background:
    linear-gradient(145deg, #0b3d36 0%, #145c4f 45%, #0a2a3a 100%) center / cover no-repeat;
  background-size: cover;
  background-position: center;
  display: grid;
  place-items: center;
}

.m-course__media-title {
  max-width: 86%;
  text-align: center;
  color: #fff;
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.25;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}

.m-course__body {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.75rem 0.85rem 0.85rem;
  flex: 1;
}

.m-course__topmeta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  min-width: 0;
}

.m-course__learners {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  max-width: 100%;
  color: #475467;
  font-size: 0.74rem;
  font-weight: 700;
}

.m-course__learners > span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.m-course__avatars {
  display: inline-flex;
  align-items: center;
}

.m-course__avatars span {
  width: 0.95rem;
  height: 0.95rem;
  border-radius: 50%;
  border: 1.5px solid #fff;
  background: linear-gradient(135deg, #7dd3c7, #14919b);
}

.m-course__avatars span + span {
  margin-left: -0.28rem;
}

.m-course__avatars span:nth-child(2) {
  background: linear-gradient(135deg, #e54c10, #e8a317);
}

.m-course__avatars span:nth-child(3) {
  background: linear-gradient(135deg, #94a3b8, #64748b);
}

.m-course__start {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  max-width: 100%;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  background: #fff8e1;
  color: #1f2a37;
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
}

.m-course__start-dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: #e54c10;
  flex: 0 0 auto;
}

.m-course h3 {
  margin: 0;
  font-size: 1rem;
  line-height: 1.3;
  font-weight: 800;
  color: #0b1b34;
  letter-spacing: -0.02em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 0;
}

.m-course__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.m-course__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 1.65rem;
  padding: 0.12rem 0.45rem;
  border-radius: 0.4rem;
  background: #f3f5f8;
  color: #475467;
  font-size: 0.72rem;
  font-weight: 700;
}

.m-course__price-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.45rem 0.55rem;
  margin-top: 0.1rem;
  min-width: 0;
}

.m-course__prices {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.m-course__prices strong {
  font-size: 1.05rem;
  font-weight: 800;
  color: #0b1b34;
}

.m-course__prices s {
  color: #98a2b3;
  font-size: 0.82rem;
}

.m-course__off {
  display: inline-flex;
  align-items: center;
  padding: 0.28rem 0.55rem 0.28rem 0.75rem;
  background: #e54c10;
  color: #fff;
  font-size: 0.7rem;
  font-weight: 800;
  clip-path: polygon(10px 0%, 100% 0%, 100% 100%, 10px 100%, 10px 75%, 0 50%, 10px 25%);
  white-space: nowrap;
}

.m-course__offer {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  padding: 0.4rem 0.55rem;
  border-radius: 0.45rem;
  background: #fff8e1;
  color: #8a6a00;
  font-size: 0.72rem;
  font-weight: 700;
  line-height: 1.35;
}

.m-course__offer span {
  min-width: 0;
}

.m-course__cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 2.75rem;
  margin-top: auto;
  border-radius: 0.5rem;
  background: #0b1b34;
  color: #fff;
  font-weight: 800;
  font-size: 0.78rem;
  letter-spacing: 0.02em;
}

@media (max-width: 420px) {
  .m-course__body {
    padding: 0.7rem 0.75rem 0.8rem;
    gap: 0.48rem;
  }

  .m-course h3 {
    font-size: 0.95rem;
  }

  .m-course__prices strong {
    font-size: 1rem;
  }

  .m-course__start {
    white-space: normal;
  }
}
</style>
