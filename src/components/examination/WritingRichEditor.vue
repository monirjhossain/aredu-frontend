<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  readonly: {
    type: Boolean,
    default: false,
  },
  placeholder: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue'])
const editor = ref(null)
let syncing = false

onMounted(() => {
  applyHtml(props.modelValue)
})

watch(() => props.modelValue, (value) => {
  if (syncing) return
  if (!editor.value) return
  if (normalizeHtml(editor.value.innerHTML) === normalizeHtml(value || '')) return
  applyHtml(value)
})

watch(() => props.readonly, async (locked) => {
  await nextTick()
  if (editor.value) editor.value.contentEditable = locked ? 'false' : 'true'
})

function normalizeHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '<br>')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

function plainToHtml(text) {
  const value = String(text || '')
  if (!value) return ''
  if (/<[a-z][\s\S]*>/i.test(value)) return value
  return value
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function applyHtml(value) {
  if (!editor.value) return
  editor.value.innerHTML = plainToHtml(value)
}

function onInput() {
  if (!editor.value || props.readonly) return
  syncing = true
  emit('update:modelValue', editor.value.innerHTML)
  queueMicrotask(() => {
    syncing = false
  })
}

function command(name) {
  if (props.readonly || !editor.value) return
  editor.value.focus()
  document.execCommand(name, false)
  onInput()
}
</script>

<template>
  <div class="student-ui__editor">
    <div class="student-ui__editor-toolbar" role="toolbar">
      <button type="button" class="student-ui__editor-btn" :disabled="readonly" title="Bold" @click="command('bold')">
        <strong>B</strong>
      </button>
      <button type="button" class="student-ui__editor-btn" :disabled="readonly" title="Italic" @click="command('italic')">
        <em>I</em>
      </button>
      <button type="button" class="student-ui__editor-btn" :disabled="readonly" title="Underline" @click="command('underline')">
        <span style="text-decoration: underline">U</span>
      </button>
      <button type="button" class="student-ui__editor-btn" :disabled="readonly" title="Bullet list" @click="command('insertUnorderedList')">
        • List
      </button>
    </div>
    <div
      id="writing-body"
      ref="editor"
      class="student-ui__editor-surface"
      :contenteditable="readonly ? 'false' : 'true'"
      role="textbox"
      aria-multiline="true"
      :data-placeholder="placeholder"
      @input="onInput"
    />
  </div>
</template>
