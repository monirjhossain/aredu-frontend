<script setup>
import { useI18n } from 'vue-i18n'

defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, required: true },
  maxWidth: { type: [Number, String], default: 480 },
  danger: { type: Boolean, default: false },
  persistent: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    :max-width="maxWidth"
    :persistent="persistent"
    content-class="admin-dialog"
    scrim="rgba(16, 42, 46, 0.45)"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="admin-dialog__card" :class="{ 'admin-dialog__card--danger': danger }">
      <header class="admin-dialog__head">
        <div>
          <p v-if="danger" class="admin-dialog__eyebrow">{{ t('warning') }}</p>
          <h2>{{ title }}</h2>
        </div>
        <button type="button" class="admin-dialog__close" :aria-label="t('cancel')" @click="close">
          <v-icon size="18">mdi-close</v-icon>
        </button>
      </header>

      <div class="admin-dialog__body">
        <slot />
      </div>

      <footer v-if="$slots.actions" class="admin-dialog__actions">
        <slot name="actions" />
      </footer>
    </div>
  </v-dialog>
</template>
