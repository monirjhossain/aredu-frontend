import { createRouter, createWebHistory } from 'vue-router'
import { i18n } from '../plugins/i18n'
import { useAuthStore } from '../stores/auth'
import AppLayout from '../layouts/AppLayout.vue'
import HomePage from '../pages/HomePage.vue'
import NotFoundPage from '../pages/NotFoundPage.vue'
import LoginPage from '../pages/auth/LoginPage.vue'
import RegisterPage from '../pages/auth/RegisterPage.vue'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage.vue'
import ResetPasswordPage from '../pages/auth/ResetPasswordPage.vue'
import AccountPage from '../pages/auth/AccountPage.vue'
import UsersPage from '../pages/admin/UsersPage.vue'
import AccountsPage from '../pages/admin/AccountsPage.vue'
import StudentsPage from '../pages/admin/StudentsPage.vue'
import StudentDetailPage from '../pages/admin/StudentDetailPage.vue'
import RolesPage from '../pages/admin/RolesPage.vue'
import DashboardPage from '../pages/admin/DashboardPage.vue'
import ReportsPage from '../pages/admin/ReportsPage.vue'
import SettingsPage from '../pages/admin/SettingsPage.vue'
import CategoriesPage from '../pages/admin/CategoriesPage.vue'
import CoursesPage from '../pages/admin/CoursesPage.vue'
import CourseFormPage from '../pages/admin/CourseFormPage.vue'
import CourseContentPage from '../pages/admin/CourseContentPage.vue'
import CourseCatalogPage from '../pages/courses/CourseCatalogPage.vue'
import CourseDetailPage from '../pages/courses/CourseDetailPage.vue'
import LessonPlayerPage from '../pages/courses/LessonPlayerPage.vue'
import OrdersPage from '../pages/orders/OrdersPage.vue'
import OrderDetailPage from '../pages/orders/OrderDetailPage.vue'
import MyCoursesPage from '../pages/learning/MyCoursesPage.vue'
import LearningCoursePage from '../pages/learning/LearningCoursePage.vue'
import StudentDashboardPage from '../pages/learning/StudentDashboardPage.vue'
import NotificationsPage from '../pages/NotificationsPage.vue'
import PaymentsPage from '../pages/admin/PaymentsPage.vue'
import AdminOrdersPage from '../pages/admin/OrdersPage.vue'
import FinancePage from '../pages/admin/FinancePage.vue'
import ReadingTestsPage from '../pages/admin/ReadingTestsPage.vue'
import ReadingTestFormPage from '../pages/admin/ReadingTestFormPage.vue'
import ReadingTestBuilderPage from '../pages/admin/ReadingTestBuilderPage.vue'
import ListeningTestsPage from '../pages/admin/ListeningTestsPage.vue'
import ListeningTestFormPage from '../pages/admin/ListeningTestFormPage.vue'
import ListeningTestBuilderPage from '../pages/admin/ListeningTestBuilderPage.vue'
import BandConversionsPage from '../pages/admin/BandConversionsPage.vue'
import StudentReadingTestsPage from '../pages/reading/ReadingTestsPage.vue'
import ReadingTestIntroPage from '../pages/reading/ReadingTestIntroPage.vue'
import ReadingAttemptPage from '../pages/reading/ReadingAttemptPage.vue'
import ReadingResultsPage from '../pages/reading/ReadingResultsPage.vue'
import StudentListeningTestsPage from '../pages/listening/ListeningTestsPage.vue'
import ListeningTestIntroPage from '../pages/listening/ListeningTestIntroPage.vue'
import ListeningAttemptPage from '../pages/listening/ListeningAttemptPage.vue'
import ListeningResultsPage from '../pages/listening/ListeningResultsPage.vue'
import WritingTasksPage from '../pages/admin/WritingTasksPage.vue'
import WritingTaskFormPage from '../pages/admin/WritingTaskFormPage.vue'
import StudentWritingTasksPage from '../pages/writing/WritingTasksPage.vue'
import WritingEditorPage from '../pages/writing/WritingEditorPage.vue'
import WritingSubmissionsPage from '../pages/writing/WritingSubmissionsPage.vue'
import TeacherWritingQueuePage from '../pages/teacher/WritingQueuePage.vue'
import TeacherWritingEvaluatePage from '../pages/teacher/WritingEvaluatePage.vue'
import SpeakingTasksPage from '../pages/admin/SpeakingTasksPage.vue'
import SpeakingTaskFormPage from '../pages/admin/SpeakingTaskFormPage.vue'
import StudentSpeakingTasksPage from '../pages/speaking/SpeakingTasksPage.vue'
import SpeakingTaskDetailPage from '../pages/speaking/SpeakingTaskDetailPage.vue'
import SpeakingRecordingsPage from '../pages/speaking/SpeakingRecordingsPage.vue'
import TeacherSpeakingQueuePage from '../pages/teacher/SpeakingQueuePage.vue'
import TeacherSpeakingEvaluatePage from '../pages/teacher/SpeakingEvaluatePage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: AppLayout,
      children: [
        { path: '', name: 'home', component: HomePage, meta: { titleKey: 'home', fullBleed: true } },
        { path: 'courses', name: 'courses', component: CourseCatalogPage, meta: { titleKey: 'courses', fullBleed: true } },
        { path: 'courses/:slug', name: 'course-detail', component: CourseDetailPage, meta: { titleKey: 'courseDetails', fullBleed: true } },
        {
          path: 'courses/:slug/lessons/:lessonId',
          name: 'lesson-player',
          component: LessonPlayerPage,
          meta: { requiresAuth: true, titleKey: 'watchLesson' },
        },
        { path: 'login', name: 'login', component: LoginPage, meta: { guestOnly: true, titleKey: 'login', fullBleed: true } },
        { path: 'register', name: 'register', component: RegisterPage, meta: { guestOnly: true, titleKey: 'register', fullBleed: true } },
        {
          path: 'forgot-password',
          name: 'forgot-password',
          component: ForgotPasswordPage,
          meta: { guestOnly: true, titleKey: 'forgotPassword', fullBleed: true },
        },
        {
          path: 'reset-password',
          name: 'reset-password',
          component: ResetPasswordPage,
          meta: { titleKey: 'resetPassword', fullBleed: true },
        },
        { path: 'account', name: 'account', component: AccountPage, meta: { requiresAuth: true, titleKey: 'account' } },
        { path: 'orders', name: 'orders', component: OrdersPage, meta: { requiresAuth: true, titleKey: 'myOrders' } },
        { path: 'orders/:id', name: 'order-detail', component: OrderDetailPage, meta: { requiresAuth: true, titleKey: 'orderDetails' } },
        { path: 'dashboard', name: 'student-dashboard', component: StudentDashboardPage, meta: { requiresAuth: true, studentOnly: true, titleKey: 'studentDashboard' } },
        { path: 'notifications', name: 'notifications', component: NotificationsPage, meta: { requiresAuth: true, titleKey: 'notifications' } },
        { path: 'my-courses', name: 'my-courses', component: MyCoursesPage, meta: { requiresAuth: true, titleKey: 'myCourses' } },
        {
          path: 'learning/:slug',
          name: 'learning-course',
          component: LearningCoursePage,
          meta: { requiresAuth: true, titleKey: 'courseAccess' },
        },
        { path: 'admin', name: 'admin-dashboard', component: DashboardPage, meta: { requiresAuth: true, permission: 'reports.view', titleKey: 'adminDashboard' } },
        { path: 'admin/reports', name: 'admin-reports', component: ReportsPage, meta: { requiresAuth: true, anyPermission: ['reports.view', 'progress.view_assigned'], titleKey: 'reports' } },
        { path: 'admin/settings', name: 'admin-settings', component: SettingsPage, meta: { requiresAuth: true, permission: 'settings.manage', titleKey: 'settings' } },
        { path: 'admin/orders', name: 'admin-orders', component: AdminOrdersPage, meta: { requiresAuth: true, permission: 'payments.manage', titleKey: 'manageOrders' } },
        { path: 'admin/finance', name: 'admin-finance', component: FinancePage, meta: { requiresAuth: true, permission: 'payments.manage', titleKey: 'manageFinance' } },
        { path: 'admin/payments', name: 'admin-payments', component: PaymentsPage, meta: { requiresAuth: true, permission: 'payments.manage', titleKey: 'managePayments' } },
        { path: 'admin/categories', name: 'admin-categories', component: CategoriesPage, meta: { requiresAuth: true, permission: 'categories.manage', titleKey: 'categories' } },
        { path: 'admin/courses', name: 'admin-courses', component: CoursesPage, meta: { requiresAuth: true, permission: 'courses.manage', titleKey: 'courses' } },
        { path: 'admin/courses/new', name: 'admin-course-create', component: CourseFormPage, meta: { requiresAuth: true, permission: 'courses.manage', titleKey: 'newCourse' } },
        { path: 'admin/courses/:id/content', name: 'admin-course-content', component: CourseContentPage, meta: { requiresAuth: true, anyPermission: ['lessons.manage', 'lessons.manage_assigned', 'courses.manage'], titleKey: 'courseContent' } },
        { path: 'admin/courses/:id', name: 'admin-course-edit', component: CourseFormPage, meta: { requiresAuth: true, permission: 'courses.manage', titleKey: 'editCourse' } },
        { path: 'admin/users', name: 'admin-users', component: UsersPage, meta: { requiresAuth: true, permission: 'users.manage', titleKey: 'users' } },
        { path: 'admin/accounts', name: 'admin-accounts', component: AccountsPage, meta: { requiresAuth: true, permission: 'users.manage', titleKey: 'manageAccounts' } },
        { path: 'admin/students', name: 'admin-students', component: StudentsPage, meta: { requiresAuth: true, permission: 'users.manage', titleKey: 'manageStudents' } },
        { path: 'admin/students/:id', name: 'admin-student-detail', component: StudentDetailPage, meta: { requiresAuth: true, permission: 'users.manage', titleKey: 'studentDetails' } },
        { path: 'admin/roles', name: 'admin-roles', component: RolesPage, meta: { requiresAuth: true, permission: 'roles.manage', titleKey: 'rolesPermissions' } },
        { path: 'admin/reading-tests', name: 'admin-reading-tests', component: ReadingTestsPage, meta: { requiresAuth: true, permission: 'mock_tests.manage', titleKey: 'manageReadingTests' } },
        { path: 'admin/reading-tests/new', name: 'admin-reading-test-create', component: ReadingTestFormPage, meta: { requiresAuth: true, permission: 'mock_tests.manage', titleKey: 'newReadingTest' } },
        { path: 'admin/reading-tests/:id/edit', name: 'admin-reading-test-edit', component: ReadingTestFormPage, meta: { requiresAuth: true, permission: 'mock_tests.manage', titleKey: 'editReadingTest' } },
        { path: 'admin/reading-tests/:id/builder', name: 'admin-reading-test-builder', component: ReadingTestBuilderPage, meta: { requiresAuth: true, permission: 'mock_tests.manage', titleKey: 'buildReadingTest' } },
        { path: 'admin/listening-tests', name: 'admin-listening-tests', component: ListeningTestsPage, meta: { requiresAuth: true, permission: 'mock_tests.manage', titleKey: 'manageListeningTests' } },
        { path: 'admin/listening-tests/new', name: 'admin-listening-test-create', component: ListeningTestFormPage, meta: { requiresAuth: true, permission: 'mock_tests.manage', titleKey: 'newListeningTest' } },
        { path: 'admin/listening-tests/:id/edit', name: 'admin-listening-test-edit', component: ListeningTestFormPage, meta: { requiresAuth: true, permission: 'mock_tests.manage', titleKey: 'editListeningTest' } },
        { path: 'admin/listening-tests/:id/builder', name: 'admin-listening-test-builder', component: ListeningTestBuilderPage, meta: { requiresAuth: true, permission: 'mock_tests.manage', titleKey: 'buildListeningTest' } },
        { path: 'admin/band-conversions', name: 'admin-band-conversions', component: BandConversionsPage, meta: { requiresAuth: true, permission: 'mock_tests.manage', titleKey: 'bandConversions' } },
        { path: 'admin/writing-tasks', name: 'admin-writing-tasks', component: WritingTasksPage, meta: { requiresAuth: true, permission: 'writing.manage', titleKey: 'manageWritingTasks' } },
        { path: 'admin/writing-tasks/new', name: 'admin-writing-task-create', component: WritingTaskFormPage, meta: { requiresAuth: true, permission: 'writing.manage', titleKey: 'newWritingTask' } },
        { path: 'admin/writing-tasks/:id', name: 'admin-writing-task-edit', component: WritingTaskFormPage, meta: { requiresAuth: true, permission: 'writing.manage', titleKey: 'editWritingTask' } },
        { path: 'admin/speaking-tasks', name: 'admin-speaking-tasks', component: SpeakingTasksPage, meta: { requiresAuth: true, permission: 'speaking.manage', titleKey: 'manageSpeakingTasks' } },
        { path: 'admin/speaking-tasks/new', name: 'admin-speaking-task-create', component: SpeakingTaskFormPage, meta: { requiresAuth: true, permission: 'speaking.manage', titleKey: 'newSpeakingTask' } },
        { path: 'admin/speaking-tasks/:id', name: 'admin-speaking-task-edit', component: SpeakingTaskFormPage, meta: { requiresAuth: true, permission: 'speaking.manage', titleKey: 'editSpeakingTask' } },

        { path: 'reading-tests', name: 'reading-tests', component: StudentReadingTestsPage, meta: { requiresAuth: true, titleKey: 'readingTests' } },
        { path: 'reading-tests/:slug', name: 'reading-test-intro', component: ReadingTestIntroPage, meta: { requiresAuth: true, titleKey: 'readingTests' } },
        { path: 'reading-attempts/:attemptId', name: 'reading-attempt', component: ReadingAttemptPage, meta: { requiresAuth: true, titleKey: 'readingAttempt' } },
        { path: 'reading-results', name: 'reading-results', component: ReadingResultsPage, meta: { requiresAuth: true, titleKey: 'readingResults' } },
        { path: 'listening-tests', name: 'listening-tests', component: StudentListeningTestsPage, meta: { requiresAuth: true, titleKey: 'listeningTests' } },
        { path: 'listening-tests/:slug', name: 'listening-test-intro', component: ListeningTestIntroPage, meta: { requiresAuth: true, titleKey: 'listeningTests' } },
        { path: 'listening-attempts/:attemptId', name: 'listening-attempt', component: ListeningAttemptPage, meta: { requiresAuth: true, titleKey: 'listeningAttempt' } },
        { path: 'listening-results', name: 'listening-results', component: ListeningResultsPage, meta: { requiresAuth: true, titleKey: 'listeningResults' } },
        { path: 'writing-tasks', name: 'writing-tasks', component: StudentWritingTasksPage, meta: { requiresAuth: true, titleKey: 'writingTasks' } },
        { path: 'writing-tasks/:id', name: 'writing-editor', component: WritingEditorPage, meta: { requiresAuth: true, titleKey: 'writingAttempt' } },
        { path: 'writing-submissions', name: 'writing-submissions', component: WritingSubmissionsPage, meta: { requiresAuth: true, titleKey: 'myWritingSubmissions' } },
        { path: 'teacher/writing', name: 'teacher-writing-queue', component: TeacherWritingQueuePage, meta: { requiresAuth: true, permission: 'writing.evaluate', titleKey: 'teacherWritingQueue' } },
        { path: 'teacher/writing/:id', name: 'teacher-writing-evaluate', component: TeacherWritingEvaluatePage, meta: { requiresAuth: true, permission: 'writing.evaluate', titleKey: 'evaluateWriting' } },
        { path: 'speaking-tasks', name: 'speaking-tasks', component: StudentSpeakingTasksPage, meta: { requiresAuth: true, titleKey: 'speakingTasks' } },
        { path: 'speaking-tasks/:id', name: 'speaking-task-detail', component: SpeakingTaskDetailPage, meta: { requiresAuth: true, titleKey: 'speakingTasks' } },
        { path: 'speaking-recordings', name: 'speaking-recordings', component: SpeakingRecordingsPage, meta: { requiresAuth: true, titleKey: 'mySpeakingRecordings' } },
        { path: 'teacher/speaking', name: 'teacher-speaking-queue', component: TeacherSpeakingQueuePage, meta: { requiresAuth: true, permission: 'speaking.evaluate', titleKey: 'teacherSpeakingQueue' } },
        { path: 'teacher/speaking/:id', name: 'teacher-speaking-evaluate', component: TeacherSpeakingEvaluatePage, meta: { requiresAuth: true, permission: 'speaking.evaluate', titleKey: 'evaluateSpeaking' } },

        { path: ':pathMatch(.*)*', name: 'not-found', component: NotFoundPage, meta: { titleKey: 'notFoundTitle' } },
      ],
    },
  ],
})

router.beforeEach((to) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return auth.postLoginRoute()
  }

  if (to.meta.studentOnly && auth.isAuthenticated && auth.isStaff) {
    return auth.postLoginRoute()
  }

  if (to.meta.permission && auth.isAuthenticated && !auth.hasPermission(to.meta.permission)) {
    return auth.postLoginRoute()
  }

  if (Array.isArray(to.meta.anyPermission) && auth.isAuthenticated) {
    const allowed = to.meta.anyPermission.some((slug) => auth.hasPermission(slug))
    if (!allowed) {
      return { name: 'home' }
    }
  }
})

router.afterEach((to) => {
  const page = to.meta.titleKey ? i18n.global.t(to.meta.titleKey) : 'AR Education IELTS'
  document.title = `${page} · AR Education`
})

export default router
