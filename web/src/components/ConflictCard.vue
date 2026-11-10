<script setup lang="ts">
import { computed } from 'vue'

import type { Conflict, ItemOp } from '@/core'
import { editLabel, fieldLabel } from '@/conflicts'

const props = defineProps<{ conflict: Conflict }>()
const emit = defineEmits<{ choose: [op: ItemOp] }>()

// A field conflict's options are all `set` edits of the same field.
const options = computed(() =>
  props.conflict.kind === 'field'
    ? props.conflict.options.flatMap((c) => (c.edit.op === 'set' ? [c.edit.value] : []))
    : [],
)
</script>

<template>
  <v-card v-if="conflict.kind === 'field'" variant="tonal" color="warning" class="mb-4 pa-4">
    <p class="mb-3">
      <strong>{{ fieldLabel[options[0]!.field] }}</strong> was changed on two devices. Which one is
      right?
    </p>
    <v-btn
      v-for="edit in options"
      :key="editLabel(edit)"
      block
      variant="outlined"
      class="mb-2"
      @click="emit('choose', { op: 'set', value: edit })"
    >
      {{ editLabel(edit) }}
    </v-btn>
  </v-card>
  <v-card v-else variant="tonal" color="warning" class="mb-4 pa-4">
    <p class="mb-3">This was deleted on one device while it was being changed on another.</p>
    <v-btn
      block
      variant="outlined"
      class="mb-2"
      @click="emit('choose', { op: 'deleted', value: false })"
    >
      Keep it
    </v-btn>
    <v-btn block variant="outlined" @click="emit('choose', { op: 'deleted', value: true })">
      Delete it
    </v-btn>
  </v-card>
</template>
