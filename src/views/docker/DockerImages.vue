<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useDockerStore } from '@/stores/docker';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { DockerImage } from '@/types/docker';

const dockerStore = useDockerStore();
const searchTerm = ref('');
const searchLoading = ref(false);
const pullImageName = ref('');
const pullDialogVisible = ref(false);
const pullLoading = ref(false);

// 计算属性：获取镜像列表
const images = computed(() => dockerStore.images);
const loading = computed(() => dockerStore.loading.images);
const searchResults = computed(() => dockerStore.searchResults);
const searchResultsLoading = computed(() => dockerStore.loading.search);

// 初始化时加载镜像列表
onMounted(async () => {
  await fetchImages();
});

// 获取镜像列表
const fetchImages = async () => {
  try {
    await dockerStore.fetchImages();
  } catch (error) {
    ElMessage.error('获取镜像列表失败');
  }
};

// 搜索镜像
const searchImages = async () => {
  if (!searchTerm.value.trim()) {
    ElMessage.warning('请输入搜索关键词');
    return;
  }

  searchLoading.value = true;
  try {
    await dockerStore.searchImages(searchTerm.value);
  } catch (error) {
    ElMessage.error('搜索镜像失败');
  } finally {
    searchLoading.value = false;
  }
};

// 打开拉取镜像对话框
const openPullDialog = (imageName: string | Event = '') => {
  pullImageName.value = typeof imageName === 'string' ? imageName : '';
  pullDialogVisible.value = true;
};

// 拉取镜像
const pullImage = async () => {
  if (!pullImageName.value.trim()) {
    ElMessage.warning('请输入镜像名称');
    return;
  }

  pullLoading.value = true;
  try {
    await dockerStore.pullImage(pullImageName.value);
    ElMessage.success(`成功拉取镜像: ${pullImageName.value}`);
    pullDialogVisible.value = false;
    pullImageName.value = '';
  } catch (error) {
    ElMessage.error('拉取镜像失败');
  } finally {
    pullLoading.value = false;
  }
};

// 删除镜像
const deleteImage = async (image: DockerImage) => {
  const imageId = image.Id;
  const imageName = image.RepoTags && image.RepoTags.length > 0 ? image.RepoTags[0] : imageId.substring(7, 19);

  try {
    await ElMessageBox.confirm(
      `确定要删除镜像 ${imageName} 吗？`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    await dockerStore.deleteImage(imageId);
    ElMessage.success('镜像删除成功');
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除镜像失败');
    }
  }
};

// 格式化镜像大小
const formatSize = (size: number) => {
  if (size < 1024) {
    return size + ' B';
  } else if (size < 1024 * 1024) {
    return (size / 1024).toFixed(2) + ' KB';
  } else if (size < 1024 * 1024 * 1024) {
    return (size / (1024 * 1024)).toFixed(2) + ' MB';
  } else {
    return (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  }
};

// 格式化时间戳
const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
};

// 获取镜像名称
const getImageName = (image: DockerImage) => {
  if (image.RepoTags && image.RepoTags.length > 0 && image.RepoTags[0] !== '<none>:<none>') {
    return image.RepoTags[0];
  }
  return image.Id.substring(7, 19);
};
</script>

<template>
  <div class="docker-images">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <h2>镜像管理</h2>
          <div class="header-actions">
            <el-button type="primary" @click="openPullDialog">拉取镜像</el-button>
            <el-button @click="fetchImages">刷新</el-button>
          </div>
        </div>
      </template>

      <!-- 镜像列表 -->
      <el-table :data="images" style="width: 100%" v-loading="loading">
        <el-table-column label="镜像ID" width="180">
          <template #default="{ row }">
            <el-tooltip :content="row.Id" placement="top">
              <span>{{ row.Id.substring(7, 19) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="镜像名称" min-width="200">
          <template #default="{ row }">
            <span>{{ getImageName(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="大小" width="120">
          <template #default="{ row }">
            <span>{{ formatSize(row.Size) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            <span>{{ formatTimestamp(row.Created) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button type="danger" size="small" @click="deleteImage(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 搜索镜像 -->
    <el-card class="box-card search-card">
      <template #header>
        <div class="card-header">
          <h2>搜索镜像</h2>
          <div class="search-box">
            <el-input v-model="searchTerm" placeholder="输入镜像名称搜索" @keyup.enter="searchImages">
              <template #append>
                <el-button @click="searchImages" :loading="searchLoading">搜索</el-button>
              </template>
            </el-input>
          </div>
        </div>
      </template>

      <el-table :data="searchResults" style="width: 100%" v-loading="searchResultsLoading">
        <el-table-column label="镜像名称" prop="name" min-width="200"></el-table-column>
        <el-table-column label="描述" prop="description" min-width="300"></el-table-column>
        <el-table-column label="星标数" prop="star_count" width="100"></el-table-column>
        <el-table-column label="官方" width="80">
          <template #default="{ row }">
            <el-tag v-if="row.is_official" type="success">官方</el-tag>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="openPullDialog(row.name)">拉取</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 拉取镜像对话框 -->
    <el-dialog v-model="pullDialogVisible" title="拉取镜像" width="30%">
      <el-form>
        <el-form-item label="镜像名称">
          <el-input v-model="pullImageName" placeholder="例如: nginx:latest"></el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="pullDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="pullImage" :loading="pullLoading">拉取</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.docker-images {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.search-box {
  width: 300px;
}

.search-card {
  margin-top: 20px;
}
</style>
