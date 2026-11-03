<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const route = useRoute()

const test = ref(null)
const loading = ref(true)
const message = ref('')
const busy = ref(false)

const sectionTitle = ref('')
const passageForm = ref({ title: '', body: '' })
const groupType = ref('multiple_choice')
const groupPassageId = ref(null)
const optionForm = ref({ label: '', content: '' })
const questionForm = ref({ prompt: '', marks: 1, correct_option_id: null, accepted_answers: '' })
const selectedSectionId = ref(null)
const selectedGroupId = ref(null)

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

const passageItems = computed(() =>
  (selectedSection.value?.passages || []).map((passage) => ({
    title: passage.title || `${t('passage')} #${passage.position}`,
    value: passage.id,
  })),
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
watch(() => route.params.id, load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const { data } = await http.get(`/admin/reading-tests/${route.params.id}`, { skipErrorToast: true })
    test.value = data.data
    if (!selectedSectionId.value && test.value.sections?.length) {
      selectedSectionId.value = test.value.sections[0].id
    }
    if (selectedSection.value?.groups?.length && !selectedGroupId.value) {
      selectedGroupId.value = selectedSection.value.groups[0].id
    }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function applyTree(data) {
  test.value = data
  if (selectedSectionId.value && !test.value.sections.find((s) => s.id === selectedSectionId.value)) {
    selectedSectionId.value = test.value.sections[0]?.id || null
  }
  if (selectedGroupId.value && !selectedSection.value?.groups.find((g) => g.id === selectedGroupId.value)) {
    selectedGroupId.value = selectedSection.value?.groups[0]?.id || null
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

async function addSection() {
  if (!sectionTitle.value.trim()) return
  await run(async () => {
    const { data } = await http.post(`/admin/reading-tests/${route.params.id}/sections`, {
      title: sectionTitle.value.trim(),
    }, { skipErrorToast: true })
    sectionTitle.value = ''
    selectedSectionId.value = data.data.sections.at(-1)?.id || selectedSectionId.value
    return data.data
  })
}

async function removeSection(section) {
  await run(async () => {
    const { data } = await http.delete(
      `/admin/reading-tests/${route.params.id}/sections/${section.id}`,
      { skipErrorToast: true },
    )
    return data.data
  })
}

async function addPassage() {
  if (!selectedSection.value || !passageForm.value.body.trim()) return
  await run(async () => {
    const { data } = await http.post(
      `/admin/reading-tests/${route.params.id}/sections/${selectedSection.value.id}/passages`,
      {
        title: passageForm.value.title || null,
        body: passageForm.value.body,
      },
      { skipErrorToast: true },
    )
    passageForm.value = { title: '', body: '' }
    return data.data
  })
}

async function removePassage(passage) {
  await run(async () => {
    const { data } = await http.delete(
      `/admin/reading-tests/${route.params.id}/sections/${selectedSection.value.id}/passages/${passage.id}`,
      { skipErrorToast: true },
    )
    return data.data
  })
}

async function addGroup() {
  if (!selectedSection.value) return
  await run(async () => {
    const { data } = await http.post(
      `/admin/reading-tests/${route.params.id}/sections/${selectedSection.value.id}/groups`,
      {
        type: groupType.value,
        question_passage_id: groupPassageId.value,
      },
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
      `/admin/reading-tests/${route.params.id}/sections/${selectedSection.value.id}/groups/${group.id}`,
      { skipErrorToast: true },
    )
    return data.data
  })
}

async function addOption() {
  if (!selectedGroup.value || !optionForm.value.content.trim()) return
  await run(async () => {
    const { data } = await http.post(
      `/admin/reading-tests/${route.params.id}/sections/${selectedSection.value.id}/groups/${selectedGroup.value.id}/options`,
      {
        label: optionForm.value.label || null,
        content: optionForm.value.content,
      },
      { skipErrorToast: true },
    )
    optionForm.value = { label: '', content: '' }
    return data.data
  })
}

async function removeOption(option) {
  await run(async () => {
    const { data } = await http.delete(
      `/admin/reading-tests/${route.params.id}/sections/${selectedSection.value.id}/groups/${selectedGroup.value.id}/options/${option.id}`,
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
  if (usesOptions.value) {
    payload.correct_option_id = questionForm.value.correct_option_id
  }
  if (usesAcceptedAnswers.value) {
    payload.accepted_answers = questionForm.value.accepted_answers
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }
  await run(async () => {
    const { data } = await http.post(
      `/admin/reading-tests/${route.params.id}/sections/${selectedSection.value.id}/groups/${selectedGroup.value.id}/questions`,
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
      `/admin/reading-tests/${route.params.id}/sections/${selectedSection.value.id}/groups/${selectedGroup.value.id}/questions/${question.id}`,
      { skipErrorToast: true },
    )
    return data.data
  })
}

async function togglePublished(value) {
  await run(async () => {
    const { data } = await http.put(
      `/admin/reading-tests/${route.params.id}/publication`,
      { is_published: value },
      { skipErrorToast: true },
    )
    return data.data
  })
}

function selectSection(section) {
  selectedSectionId.value = section.id
  selectedGroupId.value = section.groups[0]?.id || null
}

function selectGroup(group) {
  selectedGroupId.value = group.id
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero
      :title="test?.title || t('manageReadingTests')"
      :lead="test ? `${test.exam_type === 'general' ? t('general') : t('academic')} · ${t('minutesCount', { count: Math.round(test.duration_seconds / 60) })}` : ''"
    >
      <template #actions>
        <RouterLink :to="{ name: 'admin-reading-tests' }" class="admin-ui__btn admin-ui__btn--ghost">
          <v-icon size="18">mdi-arrow-left</v-icon>
          {{ t('backToReadingTests') }}
        </RouterLink>
        <template v-if="test">
          <RouterLink :to="{ name: 'admin-reading-test-edit', params: { id: test.id } }" class="admin-ui__btn admin-ui__btn--primary">
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
                <v-list-item v-for="section in test.sections" :key="section.id" :active="section.id === selectedSectionId" :title="section.title" @click="selectSection(section)">
                  <template #append>
                    <v-btn icon="mdi-delete" size="x-small" variant="text" :disabled="busy" @click.stop="removeSection(section)" />
                  </template>
                </v-list-item>
              </v-list>
              <v-text-field v-model="sectionTitle" :label="t('sectionTitle')" density="comfortable" hide-details class="mt-2" />
              <v-btn class="mt-2" color="primary" variant="tonal" :loading="busy" @click="addSection">{{ t('addSection') }}</v-btn>
            </section>
        </v-col>

        <v-col cols="12" md="8">
          <v-alert v-if="!selectedSection" type="info" variant="tonal">{{ t('selectSectionFirst') }}</v-alert>
          <template v-else>
            <section class="admin-ui__panel"><div class="admin-ui__panel-head"><h2>{{ t('passages') }}</h2></div>
                <div v-for="passage in selectedSection.passages" :key="passage.id" class="mb-3">
                  <div class="d-flex align-center">
                    <strong>{{ passage.title || `${t('passage')} #${passage.position}` }}</strong>
                    <v-spacer />
                    <v-btn size="x-small" variant="text" color="error" :disabled="busy" @click="removePassage(passage)">{{ t('delete') }}</v-btn>
                  </div>
                  <div class="text-body-2 text-medium-emphasis passage-preview">{{ passage.body }}</div>
                </div>
                <v-text-field v-model="passageForm.title" :label="t('passageTitle')" density="comfortable" class="mb-2" />
                <v-textarea v-model="passageForm.body" :label="t('passageBody')" rows="4" class="mb-2" />
                <v-btn color="primary" variant="tonal" :loading="busy" @click="addPassage">{{ t('addPassage') }}</v-btn>
              </section>

            <section class="admin-ui__panel"><div class="admin-ui__panel-head"><h2>{{ t('questionGroups') }}</h2></div>
                <v-chip-group v-model="selectedGroupId" column>
                  <v-chip v-for="group in selectedSection.groups" :key="group.id" :value="group.id" filter @click="selectGroup(group)">
                    {{ t(`questionTypes.${group.type}`) }}
                  </v-chip>
                </v-chip-group>
                <v-row dense class="mt-2">
                  <v-col cols="12" md="5">
                    <v-select v-model="groupType" :items="groupTypes" :label="t('questionType')" density="comfortable" />
                  </v-col>
                  <v-col cols="12" md="5">
                    <v-select v-model="groupPassageId" :items="passageItems" :label="t('linkedPassage')" clearable density="comfortable" />
                  </v-col>
                  <v-col cols="12" md="2" class="d-flex align-center">
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

<style scoped>
.passage-preview {
  white-space: pre-wrap;
  max-height: 120px;
  overflow: auto;
}
</style>
