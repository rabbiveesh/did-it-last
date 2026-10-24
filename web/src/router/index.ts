import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'items', component: () => import('@/views/ItemsView.vue') },
  { path: '/items/new', name: 'new-item', component: () => import('@/views/ItemView.vue') },
  {
    path: '/items/:id',
    name: 'item',
    component: () => import('@/views/ItemView.vue'),
    props: true,
  },
]

// Hash history: GitHub Pages has no server-side rewrites for deep links.
const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
