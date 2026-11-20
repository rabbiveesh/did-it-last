<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { isFirebaseConfigured } from '@/firebase'
import { useAccountStore } from '@/stores/account'
import { useItemsStore } from '@/stores/items'
import AccountMenu from '@/components/AccountMenu.vue'
import SignIn from '@/components/SignIn.vue'

const account = useAccountStore()
const items = useItemsStore()
const route = useRoute()
const icon = `${import.meta.env.BASE_URL}favicon.svg`
const configured = isFirebaseConfigured()
onMounted(() => configured && account.follow())
</script>

<template>
  <v-app>
    <v-app-bar color="primary" density="comfortable">
      <template #prepend>
        <v-btn v-if="route.path !== '/'" icon="mdi-arrow-left" aria-label="All items" to="/" />
        <img v-else :src="icon" alt="" width="32" height="32" class="ml-3" />
      </template>
      <v-app-bar-title>Did It Last</v-app-bar-title>
      <template v-if="account.account" #append>
        <AccountMenu :account="account.account" />
      </template>
    </v-app-bar>

    <v-main>
      <v-alert
        v-if="!configured"
        type="info"
        class="ma-4"
        text="The cloud project isn't set up yet, so there's nowhere to keep your list."
      />
      <div v-else-if="!account.known" class="d-flex justify-center pa-8">
        <v-progress-circular indeterminate />
      </div>
      <SignIn v-else-if="!account.account" />
      <v-alert v-else-if="items.loadError" type="error" class="ma-4" :text="items.loadError" />
      <v-container v-else-if="items.loaded" class="pa-3" style="max-width: 600px">
        <v-alert
          v-if="items.saveError"
          type="error"
          variant="tonal"
          class="mb-4"
          :text="`Your last change wasn't saved: ${items.saveError}`"
        />
        <router-view />
      </v-container>
      <div v-else class="d-flex justify-center pa-8"><v-progress-circular indeterminate /></div>
    </v-main>
  </v-app>
</template>
