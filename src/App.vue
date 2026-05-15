<script setup lang="ts">
import PrintDesigner from "./components/PrintDesigner.vue";
import PrintRenderer from "./components/print/PrintRenderer.vue";

const isPrintRenderer =
  new URLSearchParams(window.location.search).get("print") === "1";
</script>

<template>
  <PrintRenderer v-if="isPrintRenderer" />
  <div v-else class="h-screen w-screen overflow-hidden">
    <PrintDesigner />
  </div>
</template>
