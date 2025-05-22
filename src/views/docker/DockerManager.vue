<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { Picture, Box, Setting } from '@element-plus/icons-vue';

const router = useRouter();
const route = useRoute();

// 导航菜单
const activeMenu = ref('');

// 监听路由变化，更新当前激活的菜单
onMounted(() => {
  const path = route.path;
  if (path.includes('/images')) {
    activeMenu.value = 'images';
  } else if (path.includes('/containers')) {
    activeMenu.value = 'containers';
  } else if (path.includes('/config')) {
    activeMenu.value = 'config';
  }
});

// 处理菜单点击事件
const handleMenuSelect = (key: string) => {
  if (key === 'images') {
    router.push('/docker/images');
  } else if (key === 'containers') {
    router.push('/docker/containers');
  } else if (key === 'config') {
    router.push('/docker/config');
  }
};
</script>

<template>
  <div class="docker-manager">
    <el-container>
      <el-header class="header">
        <h1>Docker 管理系统</h1>
      </el-header>

      <el-container>
        <el-aside width="200px" class="sidebar">
          <el-menu :default-active="activeMenu" class="el-menu-vertical" @select="handleMenuSelect" router>
            <el-menu-item index="images">
              <el-icon>
                <Picture />
              </el-icon>
              <span>镜像管理</span>
            </el-menu-item>
            <el-menu-item index="containers">
              <el-icon>
                <Box />
              </el-icon>
              <span>容器管理</span>
            </el-menu-item>
            <el-divider />
            <el-menu-item index="config">
              <el-icon>
                <Setting />
              </el-icon>
              <span>连接配置</span>
            </el-menu-item>
          </el-menu>
        </el-aside>

        <el-main class="main-content">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<style scoped>
.docker-manager {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background-color: #409EFF;
  color: white;
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.sidebar {
  background-color: #f5f7fa;
  border-right: 1px solid #e6e6e6;
}

.main-content {
  padding: 20px;
  background-color: #f5f7fa;
}

.el-menu-vertical {
  border-right: none;
}
</style>
