<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'
import { useAuthStore } from '../../stores/auth'

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()

const test = ref(null)
const loading = ref(true)
const message = ref('')
const busy = ref(false)
const selectedSectionId = ref(null)
const selectedGroupId = ref(null)
const groupType = ref('multiple_choice')
const optionForm = ref({ label: '', content: '' })
const questionForm = ref({ prompt: '', marks: 1, correct_option_id: null, accepted_answers: '' })
const audioFile = ref(null)
const audioObjectUrl = ref('')
const sectionTitleDraft = ref('')
const uploadingAudio = ref(false)
const uploadProgress = ref(0)

const groupTypes = computed(() => [
  { title: t('questionTypes.multiple_choice'), value: 'multiple_choice' },
  { title: t('questionTypes.true_false_not_given'), value: 'true_false_not_given' },
  { title: t('questionTypes.yes_no_not_given'), value: 'yes_no_not_given' },
  { title: t('questionTypes.matching_headings'), value: 'matching_headings' },
  { title: t('questionTypes.matching_information'), value: 'matching_information' },
  { title: t('questionTypes.sentence_completion'), value: 'sentence_completion' },
  { title: t('questionTypes.summary_completion'), value: 'summary_completion' },
])

const selectedSection = computed(() =>
  test.value?.sections?.find((section) => section.id === selectedSectionId.value) || null,
)
const selectedGroup = computed(() =>
  selectedSection.value?.groups?.find((group) => group.id === selectedGroupId.value) || null,
)
const usesOptions = computed(() =>
  ['multiple_choice', 'true_false_not_given', 'yes_no_not_given', 'matching_headings', 'matching_information']
    .includes(selectedGroup.value?.type),
)
const usesAcceptedAnswers = computed(() =>
  ['sentence_completion', 'summary_completion'].includes(selectedGroup.value?.type),
)
const optionItems = computed(() =>
  (selectedGroup.value?.options || []).map((option) => ({
    title: `${option.label ? `${option.label}. ` : ''}${option.content}`,
    value: option.id,
  })),
)

const audioReadyCount = computed(() =>
  (test.value?.sections || []).filter((section) => section.audio).length,
)

const heroLead = computed(() => {
  if (!test.value) return t('listeningBuilderLead')
  const exam = test.value.exam_type === 'general' ? t('general') : t('academic')
  const minutes = Math.round(Number(test.value.duration_seconds || 0) / 60)
  return `${exam} · ${t('minutesCount', { count: minutes })} · ${t('audioReadyCount', { ready: audioReadyCount.value, total: test.value.sections?.length || 0 })}`
})

function sectionQuestionCount(section) {
  return (section?.groups || []).reduce((sum, group) => sum + (group.questions?.length || 0), 0)
}

function selectSection(section) {
  selectedSectionId.value = section.id
}

function selectGroup(group) {
  selectedGroupId.value = group.id
}

onMounted(load)
onBeforeUnmount(revokeAudio)
watch(() => route.params.id, load)
watch(selectedSectionId, () => {
  selectedGroupId.value = selectedSection.value?.groups?.[0]?.id || null
  sectionTitleDraft.value = selectedSection.value?.title || ''
  loadAudioPreview()
})

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get(`/admin/listening-tests/${route.params.id}`, { skipErrorToast: true })
    applyTree(data.data)
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function applyTree(data) {
  test.value = data
  if (!selectedSectionId.value && data.sections?.length) {
    selectedSectionId.value = data.sections[0].id
  }
  if (selectedSectionId.value && !data.sections.find((s) => s.id === selectedSectionId.value)) {
    selectedSectionId.value = data.sections[0]?.id || null
  }
  sectionTitleDraft.value = selectedSection.value?.title || ''
  if (selectedGroupId.value && !selectedSection.value?.groups?.find((g) => g.id === selectedGroupId.value)) {
    selectedGroupId.value = selectedSection.value?.groups?.[0]?.id || null
  }
  loadAudioPreview()
}

function revokeAudio() {
  if (audioObjectUrl.value) {
    URL.revokeObjectURL(audioObjectUrl.value)
    audioObjectUrl.value = ''
  }
}

async function loadAudioPreview() {
  revokeAudio()
  if (!selectedSection.value?.audio?.url) return
  try {
    const response = await fetch(selectedSection.value.audio.url, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (!response.ok) return
    const blob = await response.blob()
    audioObjectUrl.value = URL.createObjectURL(blob)
  } catch {
    // Preview is optional.
  }
}

async function run(action) {
  busy.value = true
  message.value = ''
  try {
    const data = await action()
    applyTree(data)
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    busy.value = false
  }
}

async function saveSectionTitle() {
  if (!selectedSection.value || !sectionTitleDraft.value.trim()) return
  await run(async () => {
    const { data } = await http.put(
      `/admin/listening-tests/${route.params.id}/sections/${selectedSection.value.id}`,
      { title: sectionTitleDraft.value.trim() },
      { skipErrorToast: true },
    )
    return data.data
  })
}

async function uploadAudio() {
  if (!selectedSection.value || !audioFile.value || uploadingAudio.value) return
  const body = new FormData()
  body.append('audio', audioFile.value)
  uploadingAudio.value = true
  uploadProgress.value = 0
  message.value = ''
  busy.value = true
  try {
    const { data } = await http.post(
      `/admin/listening-tests/${route.params.id}/sections/${selectedSection.value.id}/audio`,
      body,
      {
        skipErrorToast: true,
        skipLoading: true,
        onUploadProgress: (event) => {
          const total = Number(event.total) || 0
          if (total > 0) {
            uploadProgress.value = Math.min(100, Math.round((event.loaded / total) * 100))
            return
          }
          // Some browsers omit total for FormData — show indeterminate-ish ramp.
          uploadProgress.value = Math.min(95, uploadProgress.value + 5)
        },
      },
    )
    uploadProgress.value = 100
    audioFile.value = null
    applyTree(data.data)
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    busy.value = false
    uploadingAudio.value = false
  }
}

async function removeAudio() {
  if (!selectedSection.value) return
  await run(async () => {
    const { data } = await http.delete(
      `/admin/listening-tests/${route.params.id}/sections/${selectedSection.value.id}/audio`,
      { skipErrorToast: true },
    )
    return data.data
  })
}

async function addGroup() {
  if (!selectedSection.value) return
  await run(async () => {
    const { data } = await http.post(
      `/admin/listening-tests/${route.params.id}/sections/${selectedSection.value.id}/groups`,
      { type: groupType.value },
      { skipErrorToast: true },
    )
    const groups = data.data.sections.find((s) => s.id === selectedSection.value.id)?.groups || []
    selectedGroupId.value = groups.at(-1)?.id || selectedGroupId.value
    return data.data
  })
}

async function removeGroup(group) {
  await run(async () => {
    const { data } = await http.delete(
      `/admin/listening-tests/${route.params.id}/sections/${selectedSection.value.id}/groups/${group.id}`,
      { skipErrorToast: true },
    )
    return data.data
  })
}

async function addOption() {
  if (!selectedGroup.value || !optionForm.value.content.trim()) return
  await run(async () => {
    const { data } = await http.post(
      `/admin/listening-tests/${route.params.id}/sections/${selectedSection.value.id}/groups/${selectedGroup.value.id}/options`,
      { label: optionForm.value.label || null, content: optionForm.value.content },
      { skipErrorToast: true },
    )
    optionForm.value = { label: '', content: '' }
    return data.data
  })
}

async function removeOption(option) {
  await run(async () => {
    const { data } = await http.delete(
      `/admin/listening-tests/${route.params.id}/sections/${selectedSection.value.id}/groups/${selectedGroup.value.id}/options/${option.id}`,
      { skipErrorToast: true },
    )
    return data.data
  })
}

async function addQuestion() {
  if (!selectedGroup.value || !questionForm.value.prompt.trim()) return
  const payload = {
    prompt: questionForm.value.prompt,
    marks: Number(questionForm.value.marks) || 1,
  }
  if (usesOptions.value) payload.correct_option_id = questionForm.value.correct_option_id
  if (usesAcceptedAnswers.value) {
    payload.accepted_answers = questionForm.value.accepted_answers
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }
  await run(async () => {
    const { data } = await http.post(
      `/admin/listening-tests/${route.params.id}/sections/${selectedSection.value.id}/groups/${selectedGroup.value.id}/questions`,
      payload,
      { skipErrorToast: true },
    )
    questionForm.value = { prompt: '', marks: 1, correct_option_id: null, accepted_answers: '' }
    return data.data
  })
}

async function removeQuestion(question) {
  await run(async () => {
    const { data } = await http.delete(
      `/admin/listening-tests/${route.params.id}/sections/${selectedSection.value.id}/groups/${selectedGroup.value.id}/questions/${question.id}`,
      { skipErrorToast: true },
    )
    return data.data
  })
}

async function togglePublished(value) {
  await run(async () => {
    const { data } = await http.put(
      `/admin/listening-tests/${route.params.id}/publication`,
      { is_published: value },
      { skipErrorToast: true },
    )
    return data.data
  })
}

function onFile(event) {
  const files = event?.target?.files
  audioFile.value = files?.[0] || null
  uploadProgress.value = 0
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero
      :title="test?.title || t('manageListeningTests')"
      :lead="heroLead"
    >
      <template #actions>
        <RouterLink
          :to="{ name: 'admin-listening-tests' }"
          class="admin-ui__btn admin-ui__btn--ghost admin-ui__btn--block admin-ui__btn--block-sm"
        >
          <v-icon size="18">mdi-arrow-left</v-icon>
          {{ t('backToListeningTests') }}
        </RouterLink>
        <template v-if="test">
          <RouterLink
            :to="{ name: 'admin-listening-test-edit', params: { id: test.id } }"
            class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm"
          >
            <v-icon size="18">mdi-pencil</v-icon>
            {{ t('edit') }}
          </RouterLink>
          <label class="admin-ui__switch" style="color: #fff">
            <input
              type="checkbox"
              :checked="test.is_published"
              :disabled="busy"
              @change="togglePublished($event.target.checked)"
            >
            {{ t('published') }}
          </label>
        </template>
      </template>
    </AdminPageHero>

    <div v-if="loading" class="admin-ui__panel admin-ui__loading">
      <v-progress-circular indeterminate color="#0f5c66" size="36" />
    </div>
    <v-alert v-else-if="message && !test" type="error" variant="tonal">{{ message }}</v-alert>

    <template v-else-if="test">
      <v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>

      <div class="listening-builder">
        <section class="admin-ui__panel listening-builder__sidebar">
          <div class="admin-ui__panel-head">
            <h2>{{ t('sections') }}</h2>
            <p class="listening-builder__sidebar-meta">
              {{ t('audioReadyCount', { ready: audioReadyCount, total: test.sections?.length || 0 }) }}
              · {{ test.is_published ? t('published') : t('unpublished') }}
            </p>
          </div>

          <div class="listening-builder__nav">
            <button
              v-for="(section, index) in test.sections"
              :key="section.id"
              type="button"
              class="listening-builder__nav-item"
              :class="{
                'is-active': section.id === selectedSectionId,
                'has-audio': !!section.audio,
              }"
              @click="selectSection(section)"
            >
              <span class="listening-builder__nav-index">{{ index + 1 }}</span>
              <span class="listening-builder__nav-copy">
                <span class="listening-builder__nav-title">{{ section.title }}</span>
                <span class="listening-builder__nav-meta">
                  {{ section.audio ? t('audioReady') : t('noAudioYet') }}
                  · {{ section.groups?.length || 0 }} {{ t('groupsShort') }}
                  · {{ sectionQuestionCount(section) }} {{ t('questionsShort') }}
                </span>
              </span>
              <span
                class="listening-builder__dot"
                :class="section.audio ? 'is-ready' : 'is-missing'"
                :title="section.audio ? t('audioReady') : t('noAudioYet')"
                aria-hidden="true"
              />
            </button>
          </div>
        </section>

        <div class="listening-builder__main">
          <v-alert v-if="!selectedSection" type="info" variant="tonal">{{ t('selectSectionFirst') }}</v-alert>

          <template v-else>
            <section class="admin-ui__panel listening-builder__workspace-head">
              <div>
                <p class="listening-builder__eyebrow">{{ t('editingSection') }}</p>
                <h2>{{ selectedSection.title }}</h2>
                <p>
                  {{ selectedSection.audio ? t('audioReady') : t('uploadAudioHint') }}
                  · {{ selectedSection.groups?.length || 0 }} {{ t('groupsShort') }}
                  · {{ t('questionsCount', { count: sectionQuestionCount(selectedSection) }) }}
                </p>
              </div>
            </section>

            <section class="admin-ui__panel">
              <div class="admin-ui__panel-head">
                <h2>{{ t('sectionAudio') }}</h2>
              </div>

              <div class="listening-builder__title-row">
                <label class="admin-ui__field listening-builder__grow">
                  <span>{{ t('sectionTitle') }}</span>
                  <input v-model="sectionTitleDraft" type="text">
                </label>
                <button
                  type="button"
                  class="admin-ui__btn admin-ui__btn--solid"
                  :disabled="busy"
                  @click="saveSectionTitle"
                >
                  {{ t('save') }}
                </button>
              </div>

              <div
                class="listening-builder__audio-card"
                :class="{ 'has-audio': !!selectedSection.audio }"
              >
                <div class="listening-builder__audio-head">
                  <div>
                    <p class="listening-builder__audio-kicker">{{ t('sectionAudio') }}</p>
                    <strong v-if="selectedSection.audio">{{ selectedSection.audio.original_name }}</strong>
                    <strong v-else>{{ t('noAudioYet') }}</strong>
                  </div>
                  <button
                    v-if="selectedSection.audio"
                    type="button"
                    class="admin-ui__btn admin-ui__btn--danger"
                    :disabled="busy || uploadingAudio"
                    @click="removeAudio"
                  >
                    {{ t('removeAudio') }}
                  </button>
                </div>

                <audio
                  v-if="audioObjectUrl"
                  :src="audioObjectUrl"
                  controls
                  class="listening-builder__player"
                />

                <label class="admin-ui__field">
                  <span>{{ t('uploadSectionAudio') }}</span>
                  <input
                    type="file"
                    accept="audio/*"
                    :disabled="uploadingAudio"
                    @change="onFile"
                  >
                </label>

                <div v-if="uploadingAudio" class="listening-builder__upload-progress" aria-live="polite">
                  <div class="listening-builder__upload-meta">
                    <span>{{ t('uploadingAudio') }}</span>
                    <strong>{{ uploadProgress }}%</strong>
                  </div>
                  <v-progress-linear
                    :model-value="uploadProgress"
                    color="#0f5c66"
                    height="10"
                    rounded
                  />
                </div>

                <button
                  type="button"
                  class="admin-ui__btn admin-ui__btn--primary"
                  :disabled="!audioFile || uploadingAudio"
                  @click="uploadAudio"
                >
                  <v-icon size="18">mdi-upload</v-icon>
                  {{ uploadingAudio ? `${t('uploadingAudio')} ${uploadProgress}%` : t('saveAudio') }}
                </button>
              </div>
            </section>

            <section class="admin-ui__panel">
              <div class="admin-ui__panel-head">
                <h2>{{ t('questionGroups') }}</h2>
              </div>

              <div v-if="selectedSection.groups?.length" class="listening-builder__chips">
                <button
                  v-for="group in selectedSection.groups"
                  :key="group.id"
                  type="button"
                  class="listening-builder__chip"
                  :class="{ 'is-active': group.id === selectedGroupId }"
                  @click="selectGroup(group)"
                >
                  {{ t(`questionTypes.${group.type}`) }}
                  <em>{{ group.questions?.length || 0 }}</em>
                </button>
              </div>
              <p v-else class="listening-builder__empty">{{ t('noQuestionGroupsYet') }}</p>

              <div class="listening-builder__group-form">
                <label class="admin-ui__field listening-builder__grow">
                  <span>{{ t('questionType') }}</span>
                  <select v-model="groupType">
                    <option v-for="item in groupTypes" :key="item.value" :value="item.value">
                      {{ item.title }}
                    </option>
                  </select>
                </label>
                <button
                  type="button"
                  class="admin-ui__btn admin-ui__btn--solid"
                  :disabled="busy"
                  @click="addGroup"
                >
                  {{ t('addGroup') }}
                </button>
              </div>

              <button
                v-if="selectedGroup"
                type="button"
                class="admin-ui__btn admin-ui__btn--danger"
                :disabled="busy"
                @click="removeGroup(selectedGroup)"
              >
                {{ t('deleteGroup') }}
              </button>
            </section>

            <template v-if="selectedGroup">
              <section v-if="usesOptions" class="admin-ui__panel">
                <div class="admin-ui__panel-head">
                  <h2>{{ t('options') }}</h2>
                </div>
                <div class="admin-ui__list">
                  <div
                    v-for="option in selectedGroup.options"
                    :key="option.id"
                    class="admin-ui__row"
                  >
                    <div class="admin-ui__row-main">
                      <h3 class="admin-ui__row-title">
                        {{ option.label ? `${option.label}. ` : '' }}{{ option.content }}
                      </h3>
                    </div>
                    <button
                      type="button"
                      class="admin-ui__btn admin-ui__btn--danger"
                      :disabled="busy"
                      @click="removeOption(option)"
                    >
                      {{ t('delete') }}
                    </button>
                  </div>
                </div>
                <div class="listening-builder__option-form">
                  <label class="admin-ui__field">
                    <span>{{ t('optionLabel') }}</span>
                    <input v-model="optionForm.label" type="text">
                  </label>
                  <label class="admin-ui__field listening-builder__grow">
                    <span>{{ t('optionContent') }}</span>
                    <input v-model="optionForm.content" type="text">
                  </label>
                  <button
                    type="button"
                    class="admin-ui__btn admin-ui__btn--solid"
                    :disabled="busy"
                    @click="addOption"
                  >
                    {{ t('add') }}
                  </button>
                </div>
              </section>

              <section class="admin-ui__panel">
                <div class="admin-ui__panel-head">
                  <h2>{{ t('questions') }}</h2>
                </div>

                <div
                  v-for="question in selectedGroup.questions"
                  :key="question.id"
                  class="listening-builder__item"
                >
                  <div class="listening-builder__item-head">
                    <div>
                      <strong>{{ question.position }}. {{ question.prompt }}</strong>
                      <p class="admin-ui__row-meta">
                        {{ t('marks') }}: {{ question.marks }}
                        <span v-if="question.correct_option_id">
                          · {{ t('correctOption') }} #{{ question.correct_option_id }}
                        </span>
                        <span v-if="question.accepted_answers?.length">
                          · {{ question.accepted_answers.map((a) => a.answer_text).join(' / ') }}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      class="admin-ui__btn admin-ui__btn--danger"
                      :disabled="busy"
                      @click="removeQuestion(question)"
                    >
                      {{ t('delete') }}
                    </button>
                  </div>
                </div>

                <div class="listening-builder__add">
                  <label class="admin-ui__field">
                    <span>{{ t('questionPrompt') }}</span>
                    <textarea v-model="questionForm.prompt" rows="2" />
                  </label>
                  <label class="admin-ui__field">
                    <span>{{ t('marks') }}</span>
                    <input v-model.number="questionForm.marks" type="number" min="0.25" step="0.25">
                  </label>
                  <label v-if="usesOptions" class="admin-ui__field">
                    <span>{{ t('correctOption') }}</span>
                    <select v-model="questionForm.correct_option_id">
                      <option :value="null">—</option>
                      <option
                        v-for="item in optionItems"
                        :key="item.value"
                        :value="item.value"
                      >
                        {{ item.title }}
                      </option>
                    </select>
                  </label>
                  <label v-if="usesAcceptedAnswers" class="admin-ui__field">
                    <span>{{ t('acceptedAnswers') }}</span>
                    <textarea
                      v-model="questionForm.accepted_answers"
                      rows="3"
                      :placeholder="t('acceptedAnswersHint')"
                    />
                  </label>
                  <button
                    type="button"
                    class="admin-ui__btn admin-ui__btn--solid"
                    :disabled="busy"
                    @click="addQuestion"
                  >
                    {{ t('addQuestion') }}
                  </button>
                </div>
              </section>
            </template>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.listening-builder {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.9rem;
  align-items: start;
}

.listening-builder__sidebar,
.listening-builder__main {
  min-width: 0;
  display: grid;
  gap: 0.85rem;
  align-content: start;
}

.listening-builder__sidebar-meta {
  margin: 0.25rem 0 0;
  color: var(--admin-muted);
  font-size: 0.78rem;
  font-weight: 600;
}

.listening-builder__nav {
  display: grid;
  gap: 0.5rem;
}

.listening-builder__nav-item {
  display: grid;
  grid-template-columns: 2.15rem minmax(0, 1fr) 0.7rem;
  gap: 0.7rem;
  align-items: center;
  width: 100%;
  min-height: 3.4rem;
  padding: 0.65rem 0.7rem;
  border: 1px solid var(--admin-line);
  border-radius: 0.75rem;
  background: #fff;
  color: inherit;
  text-align: left;
  font: inherit;
  cursor: pointer;
  transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
}

.listening-builder__nav-item:hover {
  border-color: rgba(15, 92, 102, 0.35);
  background: var(--admin-paper);
}

.listening-builder__nav-item.is-active {
  border-color: var(--admin-teal);
  background: rgba(15, 92, 102, 0.06);
  box-shadow: 0 0 0 3px rgba(15, 92, 102, 0.08);
}

.listening-builder__nav-index {
  display: grid;
  place-items: center;
  width: 2.15rem;
  height: 2.15rem;
  border-radius: 0.6rem;
  background: var(--admin-teal-soft);
  color: var(--admin-teal);
  font-size: 0.92rem;
  font-weight: 800;
}

.listening-builder__nav-item.is-active .listening-builder__nav-index,
.listening-builder__nav-item.has-audio .listening-builder__nav-index {
  background: var(--admin-teal);
  color: #fff;
}

.listening-builder__nav-copy {
  min-width: 0;
  display: grid;
  gap: 0.15rem;
}

.listening-builder__nav-title {
  display: block;
  overflow: hidden;
  color: var(--admin-ink);
  font-size: 0.95rem;
  font-weight: 780;
  letter-spacing: -0.01em;
  line-height: 1.25;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.listening-builder__nav-meta {
  display: block;
  overflow: hidden;
  color: var(--admin-muted);
  font-size: 0.78rem;
  line-height: 1.35;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.listening-builder__dot {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 999px;
  justify-self: end;
}

.listening-builder__dot.is-ready {
  background: #19a463;
}

.listening-builder__dot.is-missing {
  background: #e2a336;
}

.listening-builder__workspace-head {
  padding: 0.95rem 1rem;
  background:
    radial-gradient(circle at 100% 0%, rgba(229, 76, 16, 0.12), transparent 40%),
    linear-gradient(135deg, #f7fbfb, #eef6f7);
}

.listening-builder__workspace-head h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.listening-builder__workspace-head p {
  margin: 0.3rem 0 0;
  color: var(--admin-muted);
  font-size: 0.84rem;
}

.listening-builder__eyebrow {
  margin: 0 0 0.2rem !important;
  color: var(--admin-teal) !important;
  font-size: 0.72rem !important;
  font-weight: 800 !important;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.listening-builder__title-row,
.listening-builder__group-form,
.listening-builder__option-form {
  display: grid;
  gap: 0.65rem;
  margin-bottom: 0.85rem;
}

.listening-builder__grow {
  min-width: 0;
}

.listening-builder__audio-card {
  display: grid;
  gap: 0.8rem;
  padding: 0.95rem;
  border-radius: 0.9rem;
  border: 1px dashed rgba(15, 92, 102, 0.28);
  background: linear-gradient(180deg, rgba(231, 244, 245, 0.7), #fff);
}

.listening-builder__audio-card.has-audio {
  border-style: solid;
  border-color: rgba(15, 92, 102, 0.18);
}

.listening-builder__audio-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  justify-content: space-between;
  align-items: flex-start;
}

.listening-builder__audio-kicker {
  margin: 0 0 0.2rem;
  color: var(--admin-muted);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.listening-builder__player {
  width: 100%;
  max-width: 100%;
}

.listening-builder__upload-progress {
  display: grid;
  gap: 0.4rem;
}

.listening-builder__upload-meta {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
  color: var(--admin-muted);
  font-size: 0.84rem;
}

.listening-builder__upload-meta strong {
  color: var(--admin-teal);
  font-variant-numeric: tabular-nums;
}

.listening-builder__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 0.85rem;
}

.listening-builder__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.35rem;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--admin-line);
  border-radius: 999px;
  background: #fff;
  color: var(--admin-ink);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
}

.listening-builder__chip em {
  font-style: normal;
  min-width: 1.25rem;
  padding: 0.05rem 0.35rem;
  border-radius: 999px;
  background: var(--admin-paper);
  color: var(--admin-teal);
  font-size: 0.72rem;
  text-align: center;
}

.listening-builder__chip.is-active {
  border-color: transparent;
  background: var(--admin-teal);
  color: #fff;
}

.listening-builder__chip.is-active em {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.listening-builder__empty {
  margin: 0 0 0.85rem;
  color: var(--admin-muted);
  font-size: 0.86rem;
}

.listening-builder__item {
  padding: 0.75rem;
  border-radius: 0.75rem;
  background: var(--admin-paper);
  margin-bottom: 0.55rem;
}

.listening-builder__item-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  justify-content: space-between;
  align-items: flex-start;
}

.listening-builder__item-head strong {
  display: block;
  margin-bottom: 0.2rem;
  line-height: 1.35;
}

.listening-builder__add {
  display: grid;
  gap: 0.65rem;
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--admin-line);
}

@media (min-width: 720px) {
  .listening-builder__title-row,
  .listening-builder__group-form {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
  }

  .listening-builder__option-form {
    grid-template-columns: 5.5rem minmax(0, 1fr) auto;
    align-items: end;
  }
}

@media (min-width: 960px) {
  .listening-builder {
    grid-template-columns: minmax(16rem, 22rem) minmax(0, 1fr);
  }

  .listening-builder__sidebar {
    position: sticky;
    top: 1rem;
  }
}

@media (max-width: 719px) {
  .listening-builder__nav-item,
  .admin-ui__btn {
    min-height: 44px;
  }
}
</style>
