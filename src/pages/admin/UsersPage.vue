<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AdminDialog from '../../components/admin/AdminDialog.vue'
import AdminPageHero from '../../components/admin/AdminPageHero.vue'
import { http } from '../../services/http'
import { apiError } from '../../utils/apiError'

const { t } = useI18n()
const users = ref([])
const roles = ref([])
const message = ref('')
const success = ref('')
const loading = ref(true)
const saving = ref(false)
const dialog = ref(false)
const editingUser = ref(null)
const selectedRoles = ref([])
const formError = ref('')

const roleItems = computed(() => roles.value.map((role) => ({
  title: `${role.name} (${role.slug})`,
  value: role.slug,
})))

onMounted(load)

async function load() {
  loading.value = true
  message.value = ''
  try {
    const [usersRes, rolesRes] = await Promise.all([
      http.get('/admin/users', { skipErrorToast: true }),
      http.get('/admin/roles', { skipErrorToast: true }).catch(() => ({ data: { data: [] } })),
    ])
    users.value = usersRes.data.data || []
    roles.value = rolesRes.data.data || []
  } catch (error) {
    message.value = apiError(error).message || t('requestFailed')
  } finally {
    loading.value = false
  }
}

function openRoles(user) {
  editingUser.value = user
  selectedRoles.value = [...(user.roles || [])]
  formError.value = ''
  dialog.value = true
}

async function saveUserRoles() {
  if (!editingUser.value) return
  saving.value = true
  formError.value = ''
  success.value = ''
  try {
    const { data } = await http.put(`/admin/users/${editingUser.value.id}/roles`, {
      roles: selectedRoles.value,
    }, { skipErrorToast: true })
    const updated = data.data
    users.value = users.value.map((user) => (user.id === updated.id ? updated : user))
    dialog.value = false
    success.value = t('userRolesSaved')
  } catch (error) {
    formError.value = apiError(error).message || t('requestFailed')
  } finally {
    saving.value = false
  }
}

function initial(name) {
  return (name || '?').charAt(0).toUpperCase()
}
</script>

<template>
  <div class="admin-ui">
    <AdminPageHero :title="t('users')" :lead="t('usersLead')" />

    <v-alert v-if="success" type="success" variant="tonal" class="mb-4">{{ success }}</v-alert>

    <section class="admin-ui__panel">
      <div class="admin-ui__panel-head">
        <div>
          <h2>{{ t('users') }}</h2>
          <p>{{ t('latestActivity') }}</p>
        </div>
      </div>

      <div v-if="loading" class="admin-ui__loading">
        <v-progress-circular indeterminate color="#0f5c66" size="36" />
      </div>
      <v-alert v-else-if="message" type="error" variant="tonal">{{ message }}</v-alert>
      <div v-else-if="users.length === 0" class="admin-ui__empty">
        <p>{{ t('noUsers') }}</p>
      </div>
      <div v-else class="admin-ui__list">
        <article v-for="user in users" :key="user.id" class="admin-ui__row">
          <div class="admin-ui__row-main">
            <div class="admin-ui__avatar" aria-hidden="true">{{ initial(user.name) }}</div>
            <div>
              <h3 class="admin-ui__row-title">{{ user.name }}</h3>
              <p class="admin-ui__row-meta">{{ user.email }}</p>
              <div class="admin-ui__chips">
                <span v-for="role in (user.roles || [])" :key="role" class="admin-ui__chip">{{ role }}</span>
              </div>
            </div>
          </div>
          <div class="admin-ui__row-actions">
            <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="openRoles(user)">
              {{ t('assignRoles') }}
            </button>
          </div>
        </article>
      </div>
    </section>

    <AdminDialog
      v-model="dialog"
      :title="`${t('assignRoles')} — ${editingUser?.name || ''}`"
      :max-width="480"
    >
      <v-alert v-if="formError" type="error" variant="tonal" class="mb-3">{{ formError }}</v-alert>
      <v-select
        v-model="selectedRoles"
        :items="roleItems"
        :label="t('roles')"
        multiple
        chips
        closable-chips
        hide-details="auto"
      />
      <template #actions>
        <button type="button" class="admin-ui__btn admin-ui__btn--soft" @click="dialog = false">{{ t('cancel') }}</button>
        <button type="button" class="admin-ui__btn admin-ui__btn--solid" :disabled="saving" @click="saveUserRoles">
          {{ t('save') }}
        </button>
      </template>
    </AdminDialog>
  </div>
</template>
