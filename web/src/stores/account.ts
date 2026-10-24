import { defineStore } from 'pinia'
import { ref } from 'vue'

import { watchAccount, type Account } from '@/account'
import { useAccountStorage } from '@/storage'
import { useItemsStore } from './items'

export const useAccountStore = defineStore('account', () => {
  const account = ref<Account | null>(null)
  /** False until Firebase has said whether someone is signed in. */
  const known = ref(false)
  const items = useItemsStore()

  /** Follows sign-in and sign-out, loading the signed-in user's own list. */
  function follow() {
    watchAccount(async (signedIn) => {
      account.value = signedIn
      known.value = true
      if (signedIn) {
        useAccountStorage(signedIn.uid)
        await items.load()
      } else {
        items.clear()
      }
    })
  }

  return { account, known, follow }
})
