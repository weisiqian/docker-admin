<script setup lang="ts">
import { onMounted } from 'vue';
import dockerService from '@/services/docker';

// 应用初始化时测试Docker连接
onMounted(async () => {
  try {
    await dockerService.testConnection();
  } catch (error) {
    console.error('初始Docker连接测试失败:', error);
  }
});
</script>

<template>
  <RouterView />
</template>

<style>
html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: Arial, sans-serif;
}

#app {
  height: 100vh;
}
</style>
