<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useDockerStore } from '@/stores/docker';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { DockerContainer, CreateContainerParams } from '@/types/docker';

const router = useRouter();
const dockerStore = useDockerStore();

// 创建容器相关
const createDialogVisible = ref(false);
const createLoading = ref(false);
const containerForm = ref<CreateContainerParams>({
  name: '',
  Image: '',
  HostConfig: {
    PortBindings: {},
    Binds: [],
    RestartPolicy: {
      Name: 'no'
    }
  },
  ExposedPorts: {},
  Env: []
});

// 端口映射
const portMappings = ref([{ container: '', host: '' }]);
// 卷映射
const volumeMappings = ref([{ container: '', host: '' }]);
// 环境变量
const envVars = ref([{ key: '', value: '' }]);

// 计算属性：获取容器列表
const containers = computed(() => dockerStore.containers);
const loading = computed(() => dockerStore.loading.containers);

// 初始化时加载容器列表
onMounted(async () => {
  await fetchContainers();
});

// 获取容器列表
const fetchContainers = async () => {
  try {
    await dockerStore.fetchContainers();
  } catch (error) {
    ElMessage.error('获取容器列表失败');
  }
};

// 查看容器详情
const viewContainerDetail = (container: DockerContainer) => {
  router.push(`/docker/container/${container.Id}`);
};

// 启动容器
const startContainer = async (container: DockerContainer) => {
  try {
    await dockerStore.startContainer(container.Id);
    ElMessage.success('容器启动成功');
  } catch (error) {
    ElMessage.error('启动容器失败');
  }
};

// 停止容器
const stopContainer = async (container: DockerContainer) => {
  try {
    await ElMessageBox.confirm(
      `确定要停止容器 ${container.Names[0].substring(1)} 吗？`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    await dockerStore.stopContainer(container.Id);
    ElMessage.success('容器停止成功');
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('停止容器失败');
    }
  }
};

// 重启容器
const restartContainer = async (container: DockerContainer) => {
  try {
    await dockerStore.restartContainer(container.Id);
    ElMessage.success('容器重启成功');
  } catch (error) {
    ElMessage.error('重启容器失败');
  }
};

// 删除容器
const deleteContainer = async (container: DockerContainer) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除容器 ${container.Names[0].substring(1)} 吗？`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    await dockerStore.deleteContainer(container.Id);
    ElMessage.success('容器删除成功');
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除容器失败');
    }
  }
};

// 打开创建容器对话框
const openCreateDialog = () => {
  resetContainerForm();
  createDialogVisible.value = true;
};

// 重置容器表单
const resetContainerForm = () => {
  containerForm.value = {
    name: '',
    Image: '',
    HostConfig: {
      PortBindings: {},
      Binds: [],
      RestartPolicy: {
        Name: 'no'
      }
    },
    ExposedPorts: {},
    Env: []
  };
  portMappings.value = [{ container: '', host: '' }];
  volumeMappings.value = [{ container: '', host: '' }];
  envVars.value = [{ key: '', value: '' }];
};

// 添加端口映射
const addPortMapping = () => {
  portMappings.value.push({ container: '', host: '' });
};

// 删除端口映射
const removePortMapping = (index: number) => {
  portMappings.value.splice(index, 1);
};

// 添加卷映射
const addVolumeMapping = () => {
  volumeMappings.value.push({ container: '', host: '' });
};

// 删除卷映射
const removeVolumeMapping = (index: number) => {
  volumeMappings.value.splice(index, 1);
};

// 添加环境变量
const addEnvVar = () => {
  envVars.value.push({ key: '', value: '' });
};

// 删除环境变量
const removeEnvVar = (index: number) => {
  envVars.value.splice(index, 1);
};

// 创建并启动容器
const createContainer = async () => {
  if (!containerForm.value.Image) {
    ElMessage.warning('请输入镜像名称');
    return;
  }

  // 处理端口映射
  const portBindings: Record<string, Array<{ HostPort: string }>> = {};
  const exposedPorts: Record<string, {}> = {};

  portMappings.value.forEach(mapping => {
    if (mapping.container && mapping.host) {
      const containerPort = `${mapping.container}/tcp`;
      portBindings[containerPort] = [{ HostPort: mapping.host }];
      exposedPorts[containerPort] = {};
    }
  });

  // 处理卷映射
  const binds: string[] = [];

  volumeMappings.value.forEach(mapping => {
    if (mapping.container && mapping.host) {
      binds.push(`${mapping.host}:${mapping.container}`);
    }
  });

  // 处理环境变量
  const env: string[] = [];

  envVars.value.forEach(envVar => {
    if (envVar.key && envVar.value) {
      env.push(`${envVar.key}=${envVar.value}`);
    }
  });

  // 更新容器配置
  containerForm.value.HostConfig!.PortBindings = portBindings;
  containerForm.value.HostConfig!.Binds = binds;
  containerForm.value.ExposedPorts = exposedPorts;
  containerForm.value.Env = env;

  createLoading.value = true;
  try {
    await dockerStore.createAndStartContainer(containerForm.value);
    ElMessage.success('容器创建并启动成功');
    createDialogVisible.value = false;
  } catch (error) {
    ElMessage.error('创建容器失败');
  } finally {
    createLoading.value = false;
  }
};

// 格式化容器状态
const formatContainerState = (state: string) => {
  switch (state.toLowerCase()) {
    case 'running':
      return '运行中';
    case 'exited':
      return '已停止';
    case 'created':
      return '已创建';
    case 'paused':
      return '已暂停';
    default:
      return state;
  }
};

// 获取容器名称（去掉前缀斜杠）
const getContainerName = (container: DockerContainer) => {
  if (container.Names && container.Names.length > 0) {
    return container.Names[0].substring(1);
  }
  return container.Id.substring(0, 12);
};

// 格式化时间戳
const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString();
};
</script>

<template>
  <div class="docker-containers">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <h2>容器管理</h2>
          <div class="header-actions">
            <el-button type="primary" @click="openCreateDialog">创建容器</el-button>
            <el-button @click="fetchContainers">刷新</el-button>
          </div>
        </div>
      </template>

      <!-- 容器列表 -->
      <el-table :data="containers" style="width: 100%" v-loading="loading">
        <el-table-column label="容器ID" width="120">
          <template #default="{ row }">
            <el-tooltip :content="row.Id" placement="top">
              <span>{{ row.Id.substring(0, 12) }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="名称" min-width="150">
          <template #default="{ row }">
            <span>{{ getContainerName(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="镜像" min-width="200" prop="Image"></el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.State === 'running' ? 'success' : 'danger'">
              {{ formatContainerState(row.State) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">
            <span>{{ formatTimestamp(row.Created) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280">
          <template #default="{ row }">
            <div class="action-buttons">
              <el-button v-if="row.State !== 'running'" type="success" size="small"
                @click="startContainer(row)">启动</el-button>
              <el-button v-if="row.State === 'running'" type="warning" size="small"
                @click="stopContainer(row)">停止</el-button>
              <el-button v-if="row.State === 'running'" type="primary" size="small"
                @click="restartContainer(row)">重启</el-button>
              <el-button type="info" size="small" @click="viewContainerDetail(row)">详情</el-button>
              <el-button type="danger" size="small" @click="deleteContainer(row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 创建容器对话框 -->
    <el-dialog v-model="createDialogVisible" title="创建容器" width="60%">
      <el-form :model="containerForm" label-width="120px">
        <el-form-item label="容器名称">
          <el-input v-model="containerForm.name" placeholder="可选，不填则自动生成"></el-input>
        </el-form-item>
        <el-form-item label="镜像名称" required>
          <el-input v-model="containerForm.Image" placeholder="例如: nginx:latest"></el-input>
        </el-form-item>

        <el-divider>端口映射</el-divider>
        <div v-for="(mapping, index) in portMappings" :key="'port-' + index" class="mapping-row">
          <el-form-item :label="index === 0 ? '容器端口' : ''" label-width="120px">
            <el-input v-model="mapping.container" placeholder="容器端口"></el-input>
          </el-form-item>
          <el-form-item :label="index === 0 ? '主机端口' : ''" label-width="120px">
            <el-input v-model="mapping.host" placeholder="主机端口"></el-input>
          </el-form-item>
          <el-button type="danger" icon="Delete" circle @click="removePortMapping(index)"
            v-if="portMappings.length > 1"></el-button>
          <el-button type="primary" icon="Plus" circle @click="addPortMapping"
            v-if="index === portMappings.length - 1"></el-button>
        </div>

        <el-divider>卷映射</el-divider>
        <div v-for="(mapping, index) in volumeMappings" :key="'volume-' + index" class="mapping-row">
          <el-form-item :label="index === 0 ? '容器路径' : ''" label-width="120px">
            <el-input v-model="mapping.container" placeholder="容器路径"></el-input>
          </el-form-item>
          <el-form-item :label="index === 0 ? '主机路径' : ''" label-width="120px">
            <el-input v-model="mapping.host" placeholder="主机路径"></el-input>
          </el-form-item>
          <el-button type="danger" icon="Delete" circle @click="removeVolumeMapping(index)"
            v-if="volumeMappings.length > 1"></el-button>
          <el-button type="primary" icon="Plus" circle @click="addVolumeMapping"
            v-if="index === volumeMappings.length - 1"></el-button>
        </div>

        <el-divider>环境变量</el-divider>
        <div v-for="(env, index) in envVars" :key="'env-' + index" class="mapping-row">
          <el-form-item :label="index === 0 ? '变量名' : ''" label-width="120px">
            <el-input v-model="env.key" placeholder="变量名"></el-input>
          </el-form-item>
          <el-form-item :label="index === 0 ? '变量值' : ''" label-width="120px">
            <el-input v-model="env.value" placeholder="变量值"></el-input>
          </el-form-item>
          <el-button type="danger" icon="Delete" circle @click="removeEnvVar(index)"
            v-if="envVars.length > 1"></el-button>
          <el-button type="primary" icon="Plus" circle @click="addEnvVar"
            v-if="index === envVars.length - 1"></el-button>
        </div>

        <el-form-item label="重启策略">
          <el-select v-model="containerForm.HostConfig!.RestartPolicy!.Name">
            <el-option label="不自动重启" value="no"></el-option>
            <el-option label="失败时重启" value="on-failure"></el-option>
            <el-option label="除非手动停止，否则一直重启" value="always"></el-option>
            <el-option label="除非手动停止或Docker重启，否则一直重启" value="unless-stopped"></el-option>
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="createDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="createContainer" :loading="createLoading">创建并启动</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.docker-containers {
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

.action-buttons {
  display: flex;
  gap: 5px;
}

.mapping-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 10px;
}

.mapping-row .el-form-item {
  margin-bottom: 0;
  margin-right: 10px;
  flex: 1;
}
</style>
