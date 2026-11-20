<script setup lang="ts">
import { ref } from 'vue'

import { signInWithGoogle } from '@/account'

const error = ref<string | null>(null)

async function signIn() {
  error.value = null
  try {
    await signInWithGoogle()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
</script>

<template>
  <v-container class="pa-6 text-center" style="max-width: 480px">
    <p class="text-h6 mb-6">Sign in to keep your list safe and see it on any device.</p>
    <v-btn block color="primary" prepend-icon="mdi-google" @click="signIn">
      Sign in with Google
    </v-btn>
    <v-alert v-if="error" type="error" variant="tonal" class="mt-4" :text="error" />
  </v-container>
</template>
