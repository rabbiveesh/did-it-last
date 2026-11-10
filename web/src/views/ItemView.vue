<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { itemProblem, type Item, type ItemOp, type ItemProblem } from '@/core'
import ConflictCard from '@/components/ConflictCard.vue'
import { useItemsStore } from '@/stores/items'
import { localDate } from '@/time'

const props = defineProps<{ id?: string }>()
const items = useItemsStore()
const router = useRouter()

const saved = computed(() => (props.id ? items.find(props.id) : undefined))
const itemId = props.id ?? crypto.randomUUID()
const name = ref('')
const boughtOn = ref('')
const ended = ref(false)
const endedOn = ref('')
const confirmDelete = ref(false)

/** Fills the form from the saved item, or with a new item's defaults. */
function startFromSaved() {
  name.value = saved.value?.name ?? ''
  boughtOn.value = saved.value?.boughtOn ?? localDate()
  ended.value = saved.value?.endedOn !== undefined
  endedOn.value = saved.value?.endedOn ?? localDate()
}
startFromSaved()

const item = computed<Item>(() => ({
  id: itemId,
  name: name.value.trim(),
  boughtOn: boughtOn.value,
  ...(ended.value ? { endedOn: endedOn.value } : {}),
}))

const problemText: Record<ItemProblem, string> = {
  noName: 'Give it a name',
  endedBeforeBought: "It can't be done before you bought it",
}
const problem = computed(() => itemProblem(item.value))

// Settling a conflict changes the saved item, so the form starts over from it.
async function choose(op: ItemOp) {
  items.choose(itemId, op)
  if (saved.value) startFromSaved()
  else await router.push('/')
}

async function save() {
  if (problem.value) return
  items.save(item.value)
  await router.push('/')
}

async function remove() {
  if (!saved.value) return
  items.remove(itemId)
  await router.push('/')
}
</script>

<template>
  <v-card v-if="id && !saved" class="pa-6 text-center">That item isn't here any more.</v-card>
  <v-form v-else @submit.prevent="save">
    <h1 class="text-h5 mb-4">{{ saved ? saved.name : 'Something new' }}</h1>
    <ConflictCard
      v-for="(conflict, n) in items.conflictsFor(itemId)"
      :key="n"
      :conflict="conflict"
      @choose="choose"
    />
    <v-text-field v-model="name" label="What is it?" autofocus />
    <v-text-field v-model="boughtOn" label="Bought on" type="date" />
    <v-switch v-model="ended" label="It's done (broke, wore out or ran out)" color="primary" />
    <v-text-field v-if="ended" v-model="endedOn" label="Done on" type="date" />
    <v-alert v-if="problem && name" type="warning" variant="tonal" class="mb-4">
      {{ problemText[problem] }}
    </v-alert>
    <v-btn type="submit" block color="primary" :disabled="!!problem">Save</v-btn>
    <v-btn
      v-if="saved"
      block
      variant="text"
      color="error"
      class="mt-2"
      @click="confirmDelete = true"
    >
      Delete
    </v-btn>
    <v-dialog v-model="confirmDelete" max-width="400">
      <v-card :title="`Delete ${saved?.name}?`" text="It will be gone from all your devices.">
        <v-card-actions>
          <v-btn @click="confirmDelete = false">Keep it</v-btn>
          <v-btn color="error" @click="remove">Delete</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-form>
</template>
