<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { useItemsStore } from '@/stores/items'

const items = useItemsStore()
const route = useRoute()
const icon = `${import.meta.env.BASE_URL}favicon.svg`
onMounted(() => items.load())
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable">
      <template #prepend>
        <v-btn v-if="route.path !== '/'" icon="mdi-arrow-left" aria-label="All items" to="/" />
        <img v-else :src="icon" alt="" width="32" height="32" class="ml-3" />
      </template>
      <v-app-bar-title>Did It Last</v-app-bar-title>
    </v-app-bar>

    <v-main>
      <v-alert v-if="items.loadError" type="error" class="ma-4" :text="items.loadError" />
      <v-container v-else-if="items.loaded" class="pa-3" style="max-width: 600px">
        <router-view />
      </v-container>
      <div v-else class="d-flex justify-center pa-8"><v-progress-circular indeterminate /></div>
    </v-main>
  </v-app>
</template>
