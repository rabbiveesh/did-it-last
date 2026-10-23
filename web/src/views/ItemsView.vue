<script setup lang="ts">
import { onMounted } from 'vue'

import { useItemsStore } from '@/stores/items'
import { lastedLabel } from '@/lifespan'

const items = useItemsStore()
onMounted(items.refreshToday)
</script>

<template>
  <v-btn block color="primary" prepend-icon="mdi-plus" to="/items/new" class="mb-4">
    Add something you bought
  </v-btn>

  <v-card v-if="items.rows.length === 0" variant="tonal" class="pa-6 text-center">
    Nothing here yet. Add the things you want to keep an eye on.
  </v-card>

  <v-list v-else lines="two" bg-color="transparent" aria-label="Your items">
    <v-list-item
      v-for="row in items.rows"
      :key="row.item.id"
      :to="`/items/${row.item.id}`"
      :title="row.item.name"
      :subtitle="`Bought ${row.item.boughtOn}`"
    >
      <template #append>
        <v-chip :color="row.stillGoing ? 'primary' : undefined" variant="tonal">
          {{ lastedLabel(row) }}
        </v-chip>
      </template>
    </v-list-item>
  </v-list>
</template>
