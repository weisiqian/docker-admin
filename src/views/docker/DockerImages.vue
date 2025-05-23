<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue';
import { useDockerStore } from '@/stores/docker';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { DockerImage } from '@/types/docker';
import dockerService, { PullStatus } from '@/services/docker';

const dockerStore = useDockerStore();
const searchTerm = ref('');
const searchLoading = ref(false);
const pullImageName = ref('');
const pullDialogVisible = ref(false);
const pullLoading = ref(false);
const pullProgressDialogVisible = ref(false);
const currentPullRequestId = ref<string | null>(null);

// 拉取进度状态
const pullStatus = reactive<PullStatus>({
  layers: {},
  overall: {
    percent: 0,
    downloaded: 0,
    total: 0,
    speed: 0
  },
  completed: false
});

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
    // 关闭输入对话框，显示进度对话框
    pullDialogVisible.value = false;
    pullProgressDialogVisible.value = true;

    // 重置进度状态
    Object.assign(pullStatus, {
      layers: {},
      overall: {
        percent: 0,
        downloaded: 0,
        total: 0,
        speed: 0
      },
      completed: false,
      error: undefined
    });

    // 开始拉取镜像，带进度监控
    currentPullRequestId.value = await dockerService.pullImageWithProgress(
      pullImageName.value,
      {
        onProgress: (status) => {
          // 更新进度状态
          Object.assign(pullStatus, status);
        },
        onComplete: () => {
          // 拉取完成后刷新镜像列表
          fetchImages();
          ElMessage.success(`成功拉取镜像: ${pullImageName.value}`);

          // 2秒后自动关闭进度对话框
          setTimeout(() => {
            if (pullStatus.completed && !pullStatus.error) {
              pullProgressDialogVisible.value = false;
            }
          }, 2000);
        },
        onError: (error) => {
          console.error('拉取镜像出错:', error);
          ElMessage.error(`拉取镜像失败: ${error.message || '未知错误'}`);
        }
      }
    );
  } catch (error: any) {
    // 这里处理初始化拉取过程中的错误
    console.error('启动拉取过程失败:', error);
    ElMessage.error(`启动拉取过程失败: ${error.message || '未知错误'}`);
    pullProgressDialogVisible.value = false;
  } finally {
    pullLoading.value = false;
    pullImageName.value = '';
  }
};

// 取消拉取镜像
const cancelPullImage = () => {
  if (currentPullRequestId.value) {
    try {
      dockerService.cancelPullImage(currentPullRequestId.value);
      ElMessage.info('已取消拉取镜像操作');
      currentPullRequestId.value = null;
    } catch (error) {
      console.error('取消拉取镜像失败:', error);
    }
  }
  pullProgressDialogVisible.value = false;
};

// 格式化下载速度
const formatSpeed = (bytesPerSecond: number) => {
  if (bytesPerSecond < 1024) {
    return `${bytesPerSecond} B/s`;
  } else if (bytesPerSecond < 1024 * 1024) {
    return `${(bytesPerSecond / 1024).toFixed(2)} KB/s`;
  } else if (bytesPerSecond < 1024 * 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
  } else {
    return `${(bytesPerSecond / (1024 * 1024 * 1024)).toFixed(2)} GB/s`;
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

    <!-- 拉取进度对话框 -->
    <el-dialog v-model="pullProgressDialogVisible" title="拉取镜像进度" width="60%" :close-on-click-modal="false"
      :close-on-press-escape="false" :show-close="pullStatus.completed || !!pullStatus.error">
      <div class="pull-progress">
        <!-- 总体进度 -->
        <div class="overall-progress">
          <h3>总体进度</h3>
          <el-progress :percentage="pullStatus.overall.percent"
            :status="pullStatus.error ? 'exception' : (pullStatus.completed ? 'success' : '')"></el-progress>

          <div class="progress-details">
            <div class="detail-item">
              <span class="label">已下载:</span>
              <span class="value">{{ formatSize(pullStatus.overall.downloaded) }}</span>
            </div>
            <div class="detail-item">
              <span class="label">总大小:</span>
              <span class="value">{{ formatSize(pullStatus.overall.total) }}</span>
            </div>
            <div class="detail-item">
              <span class="label">下载速度:</span>
              <span class="value">{{ formatSpeed(pullStatus.overall.speed) }}</span>
            </div>
          </div>
        </div>

        <!-- 错误信息 -->
        <div v-if="pullStatus.error" class="error-message">
          <el-alert :title="pullStatus.error" type="error" :closable="false" show-icon></el-alert>
        </div>

        <!-- 层进度 -->
        <div class="layers-progress">
          <h3>层进度详情</h3>
          <el-table :data="Object.entries(pullStatus.layers).map(([id, layer]) => ({ id, ...layer }))"
            style="width: 100%">
            <el-table-column label="层ID" prop="id" width="280"></el-table-column>
            <el-table-column label="状态" prop="status" width="150"></el-table-column>
            <el-table-column label="进度" min-width="200">
              <template #default="{ row }">
                <div v-if="row.progressDetail && row.progressDetail.total">
                  <el-progress
                    :percentage="Math.min(100, Math.round((row.progressDetail.current / row.progressDetail.total) * 100))"
                    :status="row.status === 'Download complete' || row.status === 'Pull complete' ? 'success' : ''"></el-progress>
                  <div class="layer-progress-detail">
                    {{ formatSize(row.progressDetail.current || 0) }} / {{ formatSize(row.progressDetail.total || 0) }}
                  </div>
                </div>
                <div v-else>
                  <span>{{ row.progress || row.status }}</span>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button type="danger" @click="cancelPullImage" :disabled="pullStatus.completed">取消拉取</el-button>
          <el-button @click="pullProgressDialogVisible = false"
            :disabled="!pullStatus.completed && !pullStatus.error">关闭</el-button>
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

/* 拉取进度样式 */
.pull-progress {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.overall-progress {
  margin-bottom: 10px;
}

.progress-details {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  flex-wrap: wrap;
}

.detail-item {
  display: flex;
  gap: 5px;
  margin-right: 20px;
}

.label {
  font-weight: bold;
  color: #606266;
}

.error-message {
  margin: 10px 0;
}

.layers-progress {
  margin-top: 10px;
}

.layer-progress-detail {
  font-size: 12px;
  color: #909399;
  margin-top: 5px;
  text-align: right;
}
</style>
