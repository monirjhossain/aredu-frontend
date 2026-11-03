<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminDialog from '../../components/admin/AdminDialog.vue'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'
import { useUiStore } from '../../stores/ui'

const { t } = useI18n()
const ui = useUiStore()

const roles = ref([])
const modules = ref([])
const selectedRoleId = ref(null)
const selectedSlugs = ref([])
const loading = ref(true)
const saving = ref(false)
const message = ref('')
const formError = ref('')
const fieldErrors = ref({})

const roleDialog = ref(false)
const editingRole = ref(null)
const deleting = ref(false)
const deleteTarget = ref(null)
const roleForm = reactive({ name: '', slug: '' })

const selectedRole = computed(() => roles.value.find((role) => role.id === selectedRoleId.value) || null)
const isSystemRole = computed(() => !!selectedRole.value?.is_system)

const moduleLabels = {
  users: 'moduleUsers',
  roles: 'moduleRoles',
  teachers: 'moduleTeachers',
  categories: 'moduleCategories',
  courses: 'moduleCourses',
  lessons: 'moduleLessons',
  videos: 'moduleVideos',
  payments: 'modulePayments',
  enrollments: 'moduleEnrollments',
  mock_tests: 'moduleMockTests',
  writing: 'moduleWriting',
  speaking: 'moduleSpeaking',
  reports: 'moduleReports',
  settings: 'moduleSettings',
  progress: 'moduleProgress',
}

onMounted(loadAll)
watch(selectedRoleId, () => {
  selectedSlugs.value = [...(selectedRole.value?.permissions || [])]
  message.value = ''
})

async function loadAll() {
  loading.value = true
  message.value = ''
  try {
    const [rolesRes, permsRes] = await Promise.all([
      http.get('/admin/roles', { skipErrorToast: true }),
      http.get('/admin/permissions', { skipErrorToast: true }),
    ])
    roles.value = rolesRes.data.data || []
    modules.value = permsRes.data.meta?.modules || groupLocally(permsRes.data.data || [])
    if (!selectedRoleId.value && roles.value[0]) {
      selectedRoleId.value = roles.value[0].id
    } else if (selectedRoleId.value) {
      selectedSlugs.value = [...(selectedRole.value?.permissions || [])]
    }
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function groupLocally(list) {
  const map = {}
  list.forEach((item) => {
    const key = String(item.slug || '').split('.')[0] || 'other'
    if (!map[key]) map[key] = { key, permissions: [] }
    map[key].permissions.push(item)
  })
  return Object.values(map)
}

function moduleTitle(key) {
  return moduleLabels[key] ? t(moduleLabels[key]) : key
}

function openCreate() {
  editingRole.value = null
  roleForm.name = ''
  roleForm.slug = ''
  fieldErrors.value = {}
  formError.value = ''
  roleDialog.value = true
}

function openEdit(role) {
  editingRole.value = role
  roleForm.name = role.name
  roleForm.slug = role.slug
  fieldErrors.value = {}
  formError.value = ''
  roleDialog.value = true
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

watch(() => roleForm.name, (name) => {
  if (!editingRole.value) {
    roleForm.slug = slugify(name)
  }
})

async function saveRole() {
  saving.value = true
  formError.value = ''
  fieldErrors.value = {}
  try {
    if (editingRole.value) {
      const { data } = await http.put(`/admin/roles/${editingRole.value.id}`, {
        name: roleForm.name,
        slug: roleForm.slug,
      }, { skipErrorToast: true, skipSuccessToast: true })
      const updated = data.data
      roles.value = roles.value.map((role) => (role.id === updated.id ? updated : role))
      selectedRoleId.value = updated.id
    } else {
      const { data } = await http.post('/admin/roles', {
        name: roleForm.name,
        slug: roleForm.slug,
      }, { skipErrorToast: true, skipSuccessToast: true })
      roles.value = [...roles.value, data.data].sort((a, b) => a.name.localeCompare(b.name))
      selectedRoleId.value = data.data.id
    }
    roleDialog.value = false
    ui.success(t('roleSaved'))
  } catch (error) {
    const parsed = apiError(error)
    fieldErrors.value = parsed.errors
    formError.value = parsed.message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

async function savePermissions() {
  if (!selectedRole.value) return
  saving.value = true
  message.value = ''
  try {
    const { data } = await http.put(`/admin/roles/${selectedRole.value.id}/permissions`, {
      permissions: selectedSlugs.value,
    }, { skipErrorToast: true, skipSuccessToast: true })
    const updated = data.data
    roles.value = roles.value.map((role) => (role.id === updated.id ? updated : role))
    selectedSlugs.value = [...(updated.permissions || [])]
    ui.success(t('permissionsSaved'))
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

function toggleModule(module, enabled) {
  const slugs = module.permissions.map((item) => item.slug)
  if (enabled) {
    selectedSlugs.value = [...new Set([...selectedSlugs.value, ...slugs])]
  } else {
    selectedSlugs.value = selectedSlugs.value.filter((slug) => !slugs.includes(slug))
  }
}

function moduleChecked(module) {
  return module.permissions.every((item) => selectedSlugs.value.includes(item.slug))
}

function moduleIndeterminate(module) {
  const count = module.permissions.filter((item) => selectedSlugs.value.includes(item.slug)).length
  return count > 0 && count < module.permissions.length
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  formError.value = ''
  try {
    await http.delete(`/admin/roles/${deleteTarget.value.id}`, { skipErrorToast: true, skipSuccessToast: true })
    const removedId = deleteTarget.value.id
    roles.value = roles.value.filter((role) => role.id !== removedId)
    deleteTarget.value = null
    if (selectedRoleId.value === removedId) {
      selectedRoleId.value = roles.value[0]?.id || null
    }
    ui.success(t('roleDeleted'))
  } catch (error) {
    formError.value = apiError(error).message || t('requestFailed')
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('rolesPermissions')" :lead="t('rolesPermissionsHelp')">
      <template #actions>
        <button
          type="button"
          class="admin-ui__btn admin-ui__btn--primary admin-ui__btn--block admin-ui__btn--block-sm"
          @click="openCreate"
        >
          <v-icon size="18">mdi-plus</v-icon>
          {{ t('newRole') }}
        </button>
      </template>
    </AdminPageHero>

    <v-alert v-if="message" type="error" variant="tonal" class="mb-4">{{ message }}</v-alert>

    <div v-if="loading" class="admin-ui__panel admin-ui__loading">
      <v-progress-circular indeterminate color="#0f5c66" size="36" />
    </div>

    <v-row v-else>
      <v-col cols="12" md="4">
        <section class="admin-ui__panel">
          <div class="admin-ui__panel-head">
            <div>
              <h2>{{ t('rolesPermissions') }}</h2>
              <p>{{ t('reportTotal', { count: roles.length }) }}</p>
            </div>
          </div>
          <div class="admin-ui__list">
            <article
              v-for="role in roles"
              :key="role.id"
              class="admin-ui__row"
              :style="role.id === selectedRoleId ? 'border-color: #0f5c66; background: #e7f4f5; cursor: pointer' : 'cursor: pointer'"
              role="button"
              tabindex="0"
              @click="selectedRoleId = role.id"
              @keyup.enter="selectedRoleId = role.id"
            >
              <div class="admin-ui__row-main">
                <div>
                  <h3 class="admin-ui__row-title">{{ role.name }}</h3>
                  <p class="admin-ui__row-meta">{{ role.slug }}</p>
                  <div v-if="role.is_system" class="admin-ui__chips">
                    <span class="admin-ui__chip">{{ t('systemRole') }}</span>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </v-col>

      <v-col cols="12" md="8">
        <section v-if="selectedRole" class="admin-ui__panel">
          <div class="admin-ui__panel-head">
            <div>
              <h2>{{ selectedRole.name }}</h2>
              <p>{{ selectedRole.slug }}</p>
            </div>
            <div class="admin-ui__row-actions">
              <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="openEdit(selectedRole)">
                {{ t('edit') }}
              </button>
              <button
                v-if="!isSystemRole"
                type="button"
                class="admin-ui__btn admin-ui__btn--danger"
                @click="deleteTarget = selectedRole; formError = ''"
              >
                {{ t('delete') }}
              </button>
              <button
                type="button"
                class="admin-ui__btn admin-ui__btn--solid"
                :disabled="saving"
                @click="savePermissions"
              >
                {{ t('savePermissions') }}
              </button>
            </div>
          </div>

          <v-expansion-panels multiple variant="accordion">
            <v-expansion-panel v-for="module in modules" :key="module.key">
              <v-expansion-panel-title>
                <div class="d-flex align-center ga-3 w-100 pe-4" @click.stop>
                  <v-checkbox
                    :model-value="moduleChecked(module)"
                    :indeterminate="moduleIndeterminate(module)"
                    color="#0f5c66"
                    hide-details
                    density="compact"
                    @update:model-value="toggleModule(module, $event)"
                  />
                  <span>{{ moduleTitle(module.key) }}</span>
                  <v-spacer />
                  <span class="text-caption text-medium-emphasis">
                    {{ module.permissions.filter((p) => selectedSlugs.includes(p.slug)).length }}/{{ module.permissions.length }}
                  </span>
                </div>
              </v-expansion-panel-title>
              <v-expansion-panel-text>
                <v-checkbox
                  v-for="permission in module.permissions"
                  :key="permission.id"
                  v-model="selectedSlugs"
                  :label="`${permission.name} (${permission.slug})`"
                  :value="permission.slug"
                  color="#0f5c66"
                  hide-details
                  density="comfortable"
                  class="mb-1"
                />
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>
        </section>
        <div v-else class="admin-ui__panel">
          <div class="admin-ui__empty">
            <p>{{ t('selectRoleHint') }}</p>
          </div>
        </div>
      </v-col>
    </v-row>

    <AdminDialog
      v-model="roleDialog"
      :title="editingRole ? t('editRole') : t('newRole')"
      :max-width="480"
    >
      <v-alert v-if="formError" type="error" variant="tonal" class="mb-3">{{ formError }}</v-alert>
      <div class="admin-ui__form-grid">
        <label class="admin-ui__field">
          <span>{{ t('roleName') }}</span>
          <input v-model="roleForm.name" type="text">
          <small v-if="fieldErrors.name?.length" style="color:#e85d4c">{{ fieldErrors.name[0] }}</small>
        </label>
        <label class="admin-ui__field">
          <span>{{ t('roleSlug') }}</span>
          <input v-model="roleForm.slug" type="text" :readonly="!!editingRole?.is_system" placeholder="users_manager">
          <small v-if="fieldErrors.slug?.length" style="color:#e85d4c">{{ fieldErrors.slug[0] }}</small>
        </label>
      </div>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="roleDialog = false">{{ t('cancel') }}</button>
        <button type="button" class="admin-ui__btn admin-ui__btn--solid" :disabled="saving" @click="saveRole">{{ t('save') }}</button>
      </template>
    </AdminDialog>

    <AdminDialog
      :model-value="deleteTarget !== null"
      :title="t('deleteRole')"
      :max-width="420"
      danger
      @update:model-value="(open) => { if (!open) deleteTarget = null }"
    >
      <v-alert v-if="formError" type="error" variant="tonal" class="mb-3">{{ formError }}</v-alert>
      <p class="admin-dialog__text">{{ t('confirmDeleteRole', { name: deleteTarget?.name || '' }) }}</p>
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="deleteTarget = null">{{ t('cancel') }}</button>
        <button type="button" class="admin-ui__btn admin-ui__btn--danger" :disabled="deleting" @click="confirmDelete">{{ t('delete') }}</button>
      </template>
    </AdminDialog>
  </div>
</template>
