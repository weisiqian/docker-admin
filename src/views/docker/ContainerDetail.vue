<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDockerStore } from '@/stores/docker';
import { ElMessage } from 'element-plus';

const route = useRoute();
const router = useRouter();
const dockerStore = useDockerStore();

const containerId = computed(() => route.params.id as string);
const activeTab = ref('info');
const logLines = ref(100);
const autoRefresh = ref(false);
const refreshInterval = ref<number | null>(null);

// 加载容器详情
const loadContainerInfo = async () => {
  try {
    await dockerStore.getContainerInfo(containerId.value);
  } catch (error) {
    ElMessage.error('获取容器详情失败');
  }
};

// 加载容器日志
const loadContainerLogs = async () => {
  try {
    await dockerStore.getContainerLogs(containerId.value, logLines.value);
  } catch (error) {
    ElMessage.error('获取容器日志失败');
  }
};

// 计算属性：获取容器详情和日志
const containerInfo = computed(() => dockerStore.selectedContainer);
const containerLogs = computed(() => dockerStore.containerLogs);
const loading = computed(() => ({
  info: dockerStore.loading.containerInfo,
  logs: dockerStore.loading.logs
}));

// 监听容器ID变化，加载容器详情
watch(containerId, async (newId) => {
  if (newId) {
    await loadContainerInfo();
  }
}, { immediate: true });

// 监听自动刷新设置
watch(autoRefresh, (newValue) => {
  if (newValue) {
    startAutoRefresh();
  } else {
    stopAutoRefresh();
  }
});

// 初始化时加载容器详情和日志
onMounted(async () => {
  if (containerId.value) {
    await loadContainerInfo();
    await loadContainerLogs();
  }
});

// 返回容器列表
const goBack = () => {
  router.push('/docker/containers');
};

// 启动自动刷新
const startAutoRefresh = () => {
  stopAutoRefresh(); // 先停止之前的定时器
  refreshInterval.value = window.setInterval(() => {
    if (activeTab.value === 'logs') {
      loadContainerLogs();
    } else {
      loadContainerInfo();
    }
  }, 5000); // 每5秒刷新一次
};

// 停止自动刷新
const stopAutoRefresh = () => {
  if (refreshInterval.value !== null) {
    clearInterval(refreshInterval.value);
    refreshInterval.value = null;
  }
};

// 格式化时间戳
const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

// 格式化端口映射
const formatPorts = (ports: any) => {
  if (!ports || (Array.isArray(ports) && ports.length === 0) || Object.keys(ports).length === 0) {
    return '无';
  }

  // 如果是数组格式
  if (Array.isArray(ports)) {
    return ports.map(port => {
      if (port.PublicPort) {
        return `${port.PublicPort}:${port.PrivatePort}/${port.Type}`;
      }
      return `${port.PrivatePort}/${port.Type}`;
    }).join(', ');
  }

  // 如果是对象格式 (Docker API返回的格式)
  // 例如: {"80/tcp": [{"HostIp": "0.0.0.0", "HostPort": "8080"}]}
  const portMappings = [];
  for (const containerPort in ports) {
    const hostPorts = ports[containerPort];
    if (hostPorts && Array.isArray(hostPorts) && hostPorts.length > 0) {
      hostPorts.forEach(hostPort => {
        portMappings.push(`${hostPort.HostPort}:${containerPort}`);
      });
    } else {
      portMappings.push(containerPort);
    }
  }

  return portMappings.length > 0 ? portMappings.join(', ') : '无';
};

// 格式化挂载点
const formatMounts = (mounts: any[] | null | undefined) => {
  if (!mounts || !Array.isArray(mounts) || mounts.length === 0) {
    return '无';
  }

  return mounts.map(mount => {
    if (mount && mount.Source && mount.Destination) {
      return `${mount.Source} -> ${mount.Destination}`;
    }
    return '';
  }).filter(Boolean).join('\n') || '无';
};

// 格式化环境变量
const formatEnv = (env: string[] | null | undefined) => {
  if (!env || !Array.isArray(env) || env.length === 0) {
    return '无';
  }

  return env.filter(Boolean).join('\n') || '无';
};

// 确保在组件卸载时清理定时器
onUnmounted(() => {
  stopAutoRefresh();
});
</script>

<template>
  <div class="container-detail">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <div class="title-section">
            <el-button icon="Back" @click="goBack">返回</el-button>
            <h2 v-if="containerInfo">容器详情: {{ containerInfo.Name.substring(1) }}</h2>
            <h2 v-else>容器详情</h2>
          </div>
          <div class="actions">
            <el-switch v-model="autoRefresh" active-text="自动刷新" inactive-text="手动刷新" />
            <el-button @click="loadContainerInfo" :loading="loading.info">刷新</el-button>
          </div>
        </div>
      </template>

      <div v-loading="loading.info">
        <el-tabs v-model="activeTab">
          <!-- 基本信息 -->
          <el-tab-pane label="基本信息" name="info">
            <div v-if="containerInfo" class="info-section">
              <el-descriptions title="容器信息" :column="2" border>
                <el-descriptions-item label="容器ID">{{ containerInfo.Id }}</el-descriptions-item>
                <el-descriptions-item label="名称">{{ containerInfo.Name.substring(1) }}</el-descriptions-item>
                <el-descriptions-item label="镜像">{{ containerInfo.Config.Image }}</el-descriptions-item>
                <el-descriptions-item label="状态">
                  <el-tag :type="containerInfo.State.Running ? 'success' : 'danger'">
                    {{ containerInfo.State.Status }}
                  </el-tag>
                </el-descriptions-item>
                <el-descriptions-item label="创建时间">{{ formatTimestamp(containerInfo.Created) }}</el-descriptions-item>
                <el-descriptions-item label="启动时间" v-if="containerInfo.State.StartedAt">
                  {{ formatTimestamp(containerInfo.State.StartedAt) }}
                </el-descriptions-item>
                <el-descriptions-item label="端口映射" :span="2">
                  {{ formatPorts(containerInfo.NetworkSettings.Ports) }}
                </el-descriptions-item>
                <el-descriptions-item label="重启策略">
                  {{ containerInfo.HostConfig.RestartPolicy.Name }}
                </el-descriptions-item>
                <el-descriptions-item label="网络模式">
                  {{ containerInfo.HostConfig.NetworkMode }}
                </el-descriptions-item>
              </el-descriptions>

              <el-divider />

              <el-descriptions title="挂载卷" :column="1" border>
                <el-descriptions-item label="挂载点">
                  <pre>{{ formatMounts(containerInfo.Mounts) }}</pre>
                </el-descriptions-item>
              </el-descriptions>

              <el-divider />

              <el-descriptions title="环境变量" :column="1" border>
                <el-descriptions-item label="环境变量">
                  <pre>{{ formatEnv(containerInfo.Config.Env) }}</pre>
                </el-descriptions-item>
              </el-descriptions>
            </div>
            <el-empty v-else description="无容器信息"></el-empty>
          </el-tab-pane>

          <!-- 容器日志 -->
          <el-tab-pane label="容器日志" name="logs">
            <div class="logs-header">
              <el-input-number v-model="logLines" :min="10" :max="1000" label="日志行数"></el-input-number>
              <el-button type="primary" @click="loadContainerLogs" :loading="loading.logs">获取日志</el-button>
            </div>
            <el-card class="logs-card" v-loading="loading.logs">
              <pre class="logs-content">{{ containerLogs }}</pre>
            </el-card>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.container-detail {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 15px;
}

.info-section {
  margin-top: 20px;
}

.logs-header {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
}

.logs-card {
  margin-top: 10px;
  max-height: 500px;
  overflow-y: auto;
}

.logs-content {
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.5;
}

pre {
  white-space: pre-wrap;
  margin: 0;
}
</style>
