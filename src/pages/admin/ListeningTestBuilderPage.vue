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
  if (!selectedSection.value || !audioFile.value) return
  const body = new FormData()
  body.append('audio', audioFile.value)
  await run(async () => {
    const { data } = await http.post(
      `/admin/listening-tests/${route.params.id}/sections/${selectedSection.value.id}/audio`,
      body,
      { skipErrorToast: true },
    )
    audioFile.value = null
    return data.data
  })
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

function onFile(files) {
  audioFile.value = files?.[0] || null
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="test?.title || t('manageListeningTests')" :lead="test ? t('listeningFourSectionsNote') : ''">
      <template #actions>
        <RouterLink :to="{ name: 'admin-listening-tests' }" class="admin-ui__btn admin-ui__btn--ghost">
          <v-icon size="18">mdi-arrow-left</v-icon>
          {{ t('backToListeningTests') }}
        </RouterLink>
        <template v-if="test">
          <RouterLink :to="{ name: 'admin-listening-test-edit', params: { id: test.id } }" class="admin-ui__btn admin-ui__btn--primary">
            <v-icon size="18">mdi-pencil</v-icon>
            {{ t('edit') }}
          </RouterLink>
          <label class="admin-ui__switch" style="color: #fff">
            <input type="checkbox" :checked="test.is_published" :disabled="busy" @change="togglePublished($event.target.checked)">
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

      <v-row>
        <v-col cols="12" md="4">
          <section class="admin-ui__panel"><div class="admin-ui__panel-head"><h2>{{ t('sections') }}</h2></div>
              <v-list density="compact" color="#0f5c66">
                <v-list-item
                  v-for="section in test.sections"
                  :key="section.id"
                  :active="section.id === selectedSectionId"
                  :title="section.title"
                  :subtitle="section.audio ? section.audio.original_name : t('noAudioYet')"
                  @click="selectedSectionId = section.id"
                />
              </v-list>
            </section>
        </v-col>

        <v-col cols="12" md="8">
          <template v-if="selectedSection">
            <section class="admin-ui__panel"><div class="admin-ui__panel-head"><h2>{{ t('sectionAudio') }}</h2></div>
                <v-text-field v-model="sectionTitleDraft" :label="t('sectionTitle')" class="mb-2" />
                <v-btn class="mb-4" variant="tonal" :loading="busy" @click="saveSectionTitle">{{ t('save') }}</v-btn>
                <div v-if="selectedSection.audio" class="mb-3">
                  <div class="text-body-2 mb-2">{{ selectedSection.audio.original_name }}</div>
                  <audio v-if="audioObjectUrl" :src="audioObjectUrl" controls class="w-100 mb-2" />
                  <v-btn size="small" color="error" variant="text" :disabled="busy" @click="removeAudio">{{ t('removeAudio') }}</v-btn>
                </div>
                <v-file-input
                  :model-value="audioFile ? [audioFile] : []"
                  :label="t('uploadSectionAudio')"
                  accept="audio/*"
                  prepend-icon="mdi-microphone"
                  show-size
                  @update:model-value="onFile"
                />
                <v-btn color="primary" variant="tonal" :loading="busy" :disabled="!audioFile" @click="uploadAudio">{{ t('saveAudio') }}</v-btn>
              </section>

            <section class="admin-ui__panel"><div class="admin-ui__panel-head"><h2>{{ t('questionGroups') }}</h2></div>
                <v-chip-group column>
                  <v-chip
                    v-for="group in selectedSection.groups"
                    :key="group.id"
                    :variant="group.id === selectedGroupId ? 'flat' : 'tonal'"
                    :color="group.id === selectedGroupId ? 'primary' : undefined"
                    @click="selectedGroupId = group.id"
                  >
                    {{ t(`questionTypes.${group.type}`) }}
                  </v-chip>
                </v-chip-group>
                <v-row dense class="mt-2">
                  <v-col cols="12" md="8"><v-select v-model="groupType" :items="groupTypes" :label="t('questionType')" /></v-col>
                  <v-col cols="12" md="4" class="d-flex align-center">
                    <v-btn color="primary" variant="tonal" block :loading="busy" @click="addGroup">{{ t('addGroup') }}</v-btn>
                  </v-col>
                </v-row>
                <v-btn v-if="selectedGroup" class="mt-2" size="small" color="error" variant="text" :disabled="busy" @click="removeGroup(selectedGroup)">
                  {{ t('deleteGroup') }}
                </v-btn>
              </section>

            <template v-if="selectedGroup">
              <section v-if="usesOptions" class="admin-ui__panel"><div class="admin-ui__panel-head"><h2>{{ t('options') }}</h2></div>
                  <v-list density="compact" color="#0f5c66">
                    <v-list-item v-for="option in selectedGroup.options" :key="option.id" :title="`${option.label ? `${option.label}. ` : ''}${option.content}`">
                      <template #append>
                        <v-btn icon="mdi-delete" size="x-small" variant="text" :disabled="busy" @click="removeOption(option)" />
                      </template>
                    </v-list-item>
                  </v-list>
                  <v-row dense>
                    <v-col cols="12" sm="3"><v-text-field v-model="optionForm.label" :label="t('optionLabel')" density="comfortable" /></v-col>
                    <v-col cols="12" sm="7"><v-text-field v-model="optionForm.content" :label="t('optionContent')" density="comfortable" /></v-col>
                    <v-col cols="12" sm="2" class="d-flex align-center">
                      <v-btn color="primary" variant="tonal" block :loading="busy" @click="addOption">{{ t('add') }}</v-btn>
                    </v-col>
                  </v-row>
                </section>

              <section class="admin-ui__panel"><div class="admin-ui__panel-head"><h2>{{ t('questions') }}</h2></div>
                  <div v-for="question in selectedGroup.questions" :key="question.id" class="mb-3">
                    <div class="d-flex align-center">
                      <div>
                        <strong>{{ question.position }}. {{ question.prompt }}</strong>
                        <div class="text-caption text-medium-emphasis">
                          {{ t('marks') }}: {{ question.marks }}
                          <span v-if="question.correct_option_id"> · {{ t('correctOption') }} #{{ question.correct_option_id }}</span>
                          <span v-if="question.accepted_answers?.length"> · {{ question.accepted_answers.map((a) => a.answer_text).join(' / ') }}</span>
                        </div>
                      </div>
                      <v-spacer />
                      <v-btn size="x-small" variant="text" color="error" :disabled="busy" @click="removeQuestion(question)">{{ t('delete') }}</v-btn>
                    </div>
                  </div>
                  <v-textarea v-model="questionForm.prompt" :label="t('questionPrompt')" rows="2" class="mb-2" />
                  <v-text-field v-model.number="questionForm.marks" type="number" min="0.25" step="0.25" :label="t('marks')" class="mb-2" />
                  <v-select v-if="usesOptions" v-model="questionForm.correct_option_id" :items="optionItems" :label="t('correctOption')" clearable class="mb-2" />
                  <v-textarea
                    v-if="usesAcceptedAnswers"
                    v-model="questionForm.accepted_answers"
                    :label="t('acceptedAnswers')"
                    :hint="t('acceptedAnswersHint')"
                    persistent-hint
                    rows="3"
                    class="mb-2"
                  />
                  <v-btn color="primary" :loading="busy" @click="addQuestion">{{ t('addQuestion') }}</v-btn>
                </section>
            </template>
          </template>
        </v-col>
      </v-row>
    </template>
  </div>
</template>
