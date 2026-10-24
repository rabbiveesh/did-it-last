<script setup lang="ts">
import { signOutOfAccount, type Account } from '@/account'

defineProps<{ account: Account }>()
</script>

<template>
  <v-menu>
    <template #activator="{ props: menu }">
      <v-btn icon="mdi-account-circle" aria-label="Account" v-bind="menu" />
    </template>
    <v-list>
      <v-list-item :title="account.name ?? 'Signed in'" :subtitle="account.email ?? undefined" />
      <v-list-item prepend-icon="mdi-logout" title="Sign out" @click="signOutOfAccount" />
    </v-list>
  </v-menu>
</template>
