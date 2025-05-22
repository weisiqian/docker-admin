<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import configService from '@/services/config';
import dockerService from '@/services/docker';

// 表单数据
const apiUrl = ref('');
const testingConnection = ref(false);
const defaultApiUrl = import.meta.env.VITE_DOCKER_API_URL || '/docker-api';

// 计算属性：连接状态
const connectionStatus = computed(() => configService.connectionStatus.value);
const connectionStatusText = computed(() => {
  switch (connectionStatus.value) {
    case 'connected':
      return '已连接';
    case 'disconnected':
      return '连接失败';
    case 'testing':
      return '测试中...';
    default:
      return '未知';
  }
});

const connectionStatusType = computed(() => {
  switch (connectionStatus.value) {
    case 'connected':
      return 'success';
    case 'disconnected':
      return 'danger';
    case 'testing':
      return 'warning';
    default:
      return 'info';
  }
});

// 初始化
onMounted(() => {
  // 加载当前API URL
  apiUrl.value = configService.apiUrl;
  
  // 测试连接
  testConnection();
});

// 保存配置
const saveConfig = async () => {
  if (!apiUrl.value) {
    ElMessage.warning('Docker API URL不能为空');
    return;
  }
  
  try {
    configService.saveApiUrl(apiUrl.value);
    ElMessage.success('配置已保存');
    await testConnection();
  } catch (error) {
    ElMessage.error(`保存配置失败: ${error}`);
  }
};

// 重置配置
const resetConfig = async () => {
  try {
    configService.resetApiUrl();
    apiUrl.value = configService.apiUrl;
    ElMessage.success('配置已重置为默认值');
    await testConnection();
  } catch (error) {
    ElMessage.error(`重置配置失败: ${error}`);
  }
};

// 测试连接
const testConnection = async () => {
  testingConnection.value = true;
  configService.setConnectionStatus('testing');
  
  try {
    const success = await dockerService.testConnection();
    if (success) {
      ElMessage.success('连接测试成功');
    } else {
      ElMessage.error('连接测试失败');
    }
  } catch (error) {
    ElMessage.error(`连接测试失败: ${error}`);
    configService.setConnectionStatus('disconnected');
  } finally {
    testingConnection.value = false;
  }
};
</script>

<template>
  <div class="docker-config">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <h2>Docker连接配置</h2>
          <div class="connection-status">
            <span>连接状态:</span>
            <el-tag :type="connectionStatusType" effect="dark">{{ connectionStatusText }}</el-tag>
          </div>
        </div>
      </template>
      
      <el-form label-width="180px">
        <el-form-item label="当前Docker API URL">
          <el-input v-model="apiUrl" placeholder="例如: http://127.0.0.1:2375 或 /docker-api">
            <template #append>
              <el-button @click="testConnection" :loading="testingConnection">测试连接</el-button>
            </template>
          </el-input>
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="saveConfig">保存配置</el-button>
          <el-button @click="resetConfig">重置为默认值</el-button>
        </el-form-item>
      </el-form>
      
      <el-divider />
      
      <div class="config-info">
        <h3>配置说明</h3>
        <p>Docker API URL的优先级顺序：</p>
        <ol>
          <li>用户配置（保存在浏览器本地存储中）</li>
          <li>环境变量 VITE_DOCKER_API_URL（当前值：{{ defaultApiUrl }}）</li>
          <li>默认值：/docker-api（通过Vite代理）</li>
        </ol>
        
        <h3>注意事项</h3>
        <ul>
          <li>如果使用直接URL（如http://127.0.0.1:2375），需要确保Docker API已启用CORS</li>
          <li>推荐使用代理URL（如/docker-api），避免跨域问题</li>
          <li>配置保存在浏览器本地存储中，清除浏览器数据会导致配置丢失</li>
        </ul>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.docker-config {
  max-width: 800px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 10px;
}

.config-info {
  margin-top: 20px;
}

.config-info h3 {
  margin-top: 15px;
  margin-bottom: 10px;
  font-size: 16px;
}

.config-info p, .config-info li {
  font-size: 14px;
  line-height: 1.5;
  color: #606266;
}

.config-info ul, .config-info ol {
  padding-left: 20px;
  margin-bottom: 15px;
}
</style>
