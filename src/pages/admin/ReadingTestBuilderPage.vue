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
      :lead="test
        ? `${test.exam_type === 'general' ? t('general') : t('academic')} · ${t('minutesCount', { count: Math.round(test.duration_seconds / 60) })}`
        : t('readingBuilderLead')"
    >
      <template #actions>
        <RouterLink
          :to="{ name: 'admin-reading-tests' }"
          class="admin-ui__btn admin-ui__btn--ghost admin-ui__btn--block admin-ui__btn--block-sm"
        >
          <v-icon size="18">mdi-arrow-left</v-icon>
          {{ t('backToReadingTests') }}
        </RouterLink>
        <template v-if="test">
          <RouterLink
            :to="{ name: 'admin-reading-test-edit', params: { id: test.id } }"
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

      <div class="reading-builder">
        <section class="admin-ui__panel reading-builder__sidebar">
          <div class="admin-ui__panel-head">
            <h2>{{ t('sections') }}</h2>
          </div>
          <div class="admin-ui__list">
            <div
              v-for="section in test.sections"
              :key="section.id"
              class="admin-ui__row reading-builder__section"
              :class="{ 'is-active': section.id === selectedSectionId }"
              role="button"
              tabindex="0"
              @click="selectSection(section)"
              @keydown.enter.prevent="selectSection(section)"
            >
              <div class="admin-ui__row-main">
                <h3 class="admin-ui__row-title">{{ section.title }}</h3>
                <p class="admin-ui__row-meta">
                  {{ t('passages') }} {{ section.passages?.length || 0 }}
                  · {{ t('questionGroups') }} {{ section.groups?.length || 0 }}
                </p>
              </div>
              <button
                type="button"
                class="admin-ui__btn admin-ui__btn--danger"
                :disabled="busy"
                @click.stop="removeSection(section)"
              >
                {{ t('delete') }}
              </button>
            </div>
          </div>
          <div class="reading-builder__add">
            <label class="admin-ui__field">
              <span>{{ t('sectionTitle') }}</span>
              <input v-model="sectionTitle" type="text">
            </label>
            <button
              type="button"
              class="admin-ui__btn admin-ui__btn--solid admin-ui__btn--block"
              :disabled="busy"
              @click="addSection"
            >
              {{ t('addSection') }}
            </button>
          </div>
        </section>

        <div class="reading-builder__main">
          <v-alert v-if="!selectedSection" type="info" variant="tonal">{{ t('selectSectionFirst') }}</v-alert>
          <template v-else>
            <section class="admin-ui__panel">
              <div class="admin-ui__panel-head"><h2>{{ t('passages') }}</h2></div>
              <div v-for="passage in selectedSection.passages" :key="passage.id" class="reading-builder__item">
                <div class="reading-builder__item-head">
                  <strong>{{ passage.title || `${t('passage')} #${passage.position}` }}</strong>
                  <button
                    type="button"
                    class="admin-ui__btn admin-ui__btn--danger"
                    :disabled="busy"
                    @click="removePassage(passage)"
                  >
                    {{ t('delete') }}
                  </button>
                </div>
                <div class="passage-preview">{{ passage.body }}</div>
              </div>
              <div class="reading-builder__add">
                <label class="admin-ui__field">
                  <span>{{ t('passageTitle') }}</span>
                  <input v-model="passageForm.title" type="text">
                </label>
                <label class="admin-ui__field">
                  <span>{{ t('passageBody') }}</span>
                  <textarea v-model="passageForm.body" rows="4" />
                </label>
                <button
                  type="button"
                  class="admin-ui__btn admin-ui__btn--solid"
                  :disabled="busy"
                  @click="addPassage"
                >
                  {{ t('addPassage') }}
                </button>
              </div>
            </section>

            <section class="admin-ui__panel">
              <div class="admin-ui__panel-head"><h2>{{ t('questionGroups') }}</h2></div>
              <div class="reading-builder__chips">
                <button
                  v-for="group in selectedSection.groups"
                  :key="group.id"
                  type="button"
                  class="reading-builder__chip"
                  :class="{ 'is-active': group.id === selectedGroupId }"
                  @click="selectGroup(group)"
                >
                  {{ t(`questionTypes.${group.type}`) }}
                </button>
              </div>
              <div class="reading-builder__group-form">
                <label class="admin-ui__field">
                  <span>{{ t('questionType') }}</span>
                  <select v-model="groupType">
                    <option v-for="item in groupTypes" :key="item.value" :value="item.value">{{ item.title }}</option>
                  </select>
                </label>
                <label class="admin-ui__field">
                  <span>{{ t('linkedPassage') }}</span>
                  <select v-model="groupPassageId">
                    <option :value="null">—</option>
                    <option v-for="item in passageItems" :key="item.value" :value="item.value">{{ item.title }}</option>
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
                class="admin-ui__btn admin-ui__btn--danger mt-2"
                :disabled="busy"
                @click="removeGroup(selectedGroup)"
              >
                {{ t('deleteGroup') }}
              </button>
            </section>

            <template v-if="selectedGroup">
              <section v-if="usesOptions" class="admin-ui__panel">
                <div class="admin-ui__panel-head"><h2>{{ t('options') }}</h2></div>
                <div class="admin-ui__list">
                  <div v-for="option in selectedGroup.options" :key="option.id" class="admin-ui__row">
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
                <div class="reading-builder__option-form">
                  <label class="admin-ui__field">
                    <span>{{ t('optionLabel') }}</span>
                    <input v-model="optionForm.label" type="text">
                  </label>
                  <label class="admin-ui__field reading-builder__grow">
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
                <div class="admin-ui__panel-head"><h2>{{ t('questions') }}</h2></div>
                <div v-for="question in selectedGroup.questions" :key="question.id" class="reading-builder__item">
                  <div class="reading-builder__item-head">
                    <div>
                      <strong>{{ question.position }}. {{ question.prompt }}</strong>
                      <p class="admin-ui__row-meta">
                        {{ t('marks') }}: {{ question.marks }}
                        <span v-if="question.correct_option_id"> · {{ t('correctOption') }} #{{ question.correct_option_id }}</span>
                        <span v-if="question.accepted_answers?.length"> · {{ question.accepted_answers.map((a) => a.answer_text).join(' / ') }}</span>
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
                <div class="reading-builder__add">
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
                      <option v-for="item in optionItems" :key="item.value" :value="item.value">{{ item.title }}</option>
                    </select>
                  </label>
                  <label v-if="usesAcceptedAnswers" class="admin-ui__field">
                    <span>{{ t('acceptedAnswers') }}</span>
                    <textarea v-model="questionForm.accepted_answers" rows="3" />
                    <small>{{ t('acceptedAnswersHint') }}</small>
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
.reading-builder {
  display: grid;
  gap: 1rem;
}

.reading-builder__main {
  display: grid;
  gap: 1rem;
  min-width: 0;
}

.reading-builder__section {
  text-align: left;
  cursor: pointer;
  border: 1px solid transparent;
}

.reading-builder__section.is-active {
  border-color: #0f5c66;
  background: rgba(15, 92, 102, 0.06);
}

.reading-builder__add,
.reading-builder__group-form,
.reading-builder__option-form {
  display: grid;
  gap: 0.75rem;
  margin-top: 0.85rem;
}

.reading-builder__item {
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--admin-line);
}

.reading-builder__item:last-of-type {
  border-bottom: 0;
}

.reading-builder__item-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.reading-builder__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.reading-builder__chip {
  min-height: 2.4rem;
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--admin-line);
  background: #fff;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 650;
  cursor: pointer;
}

.reading-builder__chip.is-active {
  border-color: #0f5c66;
  background: #0f5c66;
  color: #fff;
}

.passage-preview {
  white-space: pre-wrap;
  max-height: 120px;
  overflow: auto;
  font-size: 0.86rem;
  line-height: 1.45;
  color: #4a6064;
}

@media (min-width: 960px) {
  .reading-builder {
    grid-template-columns: minmax(15rem, 22rem) minmax(0, 1fr);
    align-items: start;
  }

  .reading-builder__group-form {
    grid-template-columns: 1fr 1fr auto;
    align-items: end;
  }

  .reading-builder__option-form {
    grid-template-columns: 6rem minmax(0, 1fr) auto;
    align-items: end;
  }

  .reading-builder__grow {
    min-width: 0;
  }
}
</style>
