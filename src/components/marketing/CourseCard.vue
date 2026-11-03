<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  discountPct,
  durationLabel,
  examLabel,
  hasDiscount,
  money,
  sellingPrice,
} from '../../utils/courseDisplay'

const props = defineProps({
  course: { type: Object, required: true },
  currency: { type: String, default: 'BDT' },
})

const { t } = useI18n()

const exam = computed(() => examLabel(props.course, t))
const duration = computed(() => durationLabel(props.course, t))
const off = computed(() => discountPct(props.course))
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
      <span class="m-course__badge">
        <span class="m-course__badge-dot" aria-hidden="true" />
        {{ exam }}
      </span>
    </div>
    <div class="m-course__body">
      <h3>{{ course.title }}</h3>
      <div class="m-course__meta">
        <div class="m-course__meta-main">
          <v-icon size="18" icon="mdi-school" />
          <span>{{ course.category?.name || t('courses') }}</span>
        </div>
        <div class="m-course__meta-side">
          <div v-if="duration" class="m-course__meta-row">
            <v-icon size="16" icon="mdi-clock-outline" />
            <span>{{ duration }}</span>
          </div>
          <div class="m-course__meta-row">
            <v-icon size="16" icon="mdi-book-open-page-variant" />
            <span>{{ exam }}</span>
          </div>
        </div>
      </div>
      <div class="m-course__price-row">
        <div class="m-course__prices">
          <strong>{{ money(sellingPrice(course), currency) }}</strong>
          <s v-if="hasDiscount(course)">{{ money(course.price, currency) }}</s>
        </div>
        <span v-if="off" class="m-course__off">{{ off }}% {{ t('landingOff') }}</span>
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
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid #e8edf3;
  background: #fff;
  text-decoration: none;
  color: inherit;
  box-shadow: 0 8px 24px rgba(11, 27, 52, 0.05);
  transition: transform 180ms ease, box-shadow 180ms ease;
  font-family: 'Plus Jakarta Sans', 'Source Sans 3', 'Nirmala UI', sans-serif;
}

.m-course:hover {
  transform: translateY(-4px);
  box-shadow: 0 18px 40px rgba(11, 27, 52, 0.1);
}

.m-course__media {
  position: relative;
  aspect-ratio: 16 / 10;
  background:
    linear-gradient(145deg, #0b3d36 0%, #145c4f 45%, #0a2a3a 100%) center / cover no-repeat;
  display: grid;
  place-items: center;
}

.m-course__media-title {
  max-width: 84%;
  text-align: center;
  color: #fff;
  font-size: clamp(1.05rem, 2.2vw, 1.35rem);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1.2;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
}

.m-course__badge {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.32rem 0.65rem;
  border-radius: 999px;
  background: #fff;
  color: #1f2a37;
  font-size: 0.72rem;
  font-weight: 700;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.12);
}

.m-course__badge-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: #f5c518;
}

.m-course__body {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1rem 1rem 1.05rem;
  flex: 1;
}

.m-course h3 {
  margin: 0;
  min-height: 2.6em;
  font-size: 1.12rem;
  line-height: 1.3;
  font-weight: 800;
  color: #0b1b34;
  letter-spacing: -0.02em;
}

.m-course__meta {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.8rem 0.9rem;
  border-radius: 0.75rem;
  background: #f3f5f8;
  color: #667085;
  font-size: 0.86rem;
  font-weight: 600;
}

.m-course__meta-main,
.m-course__meta-row {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.m-course__meta-side {
  display: grid;
  gap: 0.35rem;
}

.m-course__price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: auto;
}

.m-course__prices {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
}

.m-course__prices strong {
  font-size: 1.15rem;
  font-weight: 800;
  color: #0b1b34;
}

.m-course__prices s {
  color: #98a2b3;
  font-size: 0.92rem;
}

.m-course__off {
  display: inline-flex;
  align-items: center;
  padding: 0.38rem 0.7rem 0.38rem 0.95rem;
  background: #f5c518;
  color: #1a1400;
  font-size: 0.78rem;
  font-weight: 800;
  clip-path: polygon(12px 0%, 100% 0%, 100% 100%, 12px 100%, 12px 75%, 0 50%, 12px 25%);
}

.m-course__cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  min-height: 2.85rem;
  border-radius: 0.55rem;
  background: #0b1b34;
  color: #fff;
  font-weight: 800;
  font-size: 0.84rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
</style>
