<script setup lang="ts">
import { ref, reactive, onMounted, computed, nextTick, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useDockerStore } from '@/stores/docker';
import dockerfileService, {
  DockerfileTemplate,
  DockerfileHistory,
  BuildArg,
  BuildStatus
} from '@/services/dockerfile';
import MonacoEditor from '@/components/MonacoEditor.vue';

// 状态
const dockerStore = useDockerStore();
const monacoEditorRef = ref<InstanceType<typeof MonacoEditor> | null>(null);
const logsScrollbar = ref<any>(null);
const currentDockerfile = ref('');
const currentTemplateName = ref('');
const currentTemplateDescription = ref('');
const imageTag = ref('');
const buildArgs = ref<BuildArg[]>([{ name: '', value: '' }]);
const templates = ref<DockerfileTemplate[]>([]);
const history = ref<DockerfileHistory[]>([]);
const showTemplateDialog = ref(false);
const showHistoryDialog = ref(false);
const showBuildDialog = ref(false);
const buildLoading = ref(false);
const currentBuildId = ref<string | null>(null);
const editorReady = ref(false);

// 构建状态
const buildStatus = reactive<BuildStatus>({
  logs: [],
  completed: false
});

// 计算属性
const canSaveTemplate = computed(() => {
  return currentTemplateName.value.trim() !== '' &&
    currentDockerfile.value.trim() !== '';
});

const canBuild = computed(() => {
  return currentDockerfile.value.trim() !== '' &&
    imageTag.value.trim() !== '';
});

// 初始化
onMounted(() => {
  // 加载模板和历史记录
  loadTemplates();
  loadHistory();
});

// 处理编辑器就绪事件
const handleEditorReady = () => {
  editorReady.value = true;
};

// 加载模板
const loadTemplates = () => {
  templates.value = dockerfileService.getTemplates();
};

// 加载历史记录
const loadHistory = () => {
  history.value = dockerfileService.getHistory();
};

// 保存模板
const saveTemplate = () => {
  if (!canSaveTemplate.value) {
    ElMessage.warning('请输入模板名称和Dockerfile内容');
    return;
  }

  const templateId = 'template_' + Date.now();
  const template: DockerfileTemplate = {
    id: templateId,
    name: currentTemplateName.value,
    description: currentTemplateDescription.value,
    content: currentDockerfile.value,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  dockerfileService.saveTemplate(template);
  loadTemplates();

  ElMessage.success('模板保存成功');
  showTemplateDialog.value = false;
};

// 加载模板
const loadTemplate = (template: DockerfileTemplate) => {
  currentDockerfile.value = template.content;
  showTemplateDialog.value = false;
};

// 删除模板
const deleteTemplate = async (template: DockerfileTemplate) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除模板 "${template.name}" 吗？`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    dockerfileService.deleteTemplate(template.id);
    loadTemplates();
    ElMessage.success('模板删除成功');
  } catch (error) {
    // 用户取消操作
  }
};

// 加载历史记录
const loadHistoryItem = (historyItem: DockerfileHistory) => {
  currentDockerfile.value = historyItem.content;
  showHistoryDialog.value = false;
};

// 删除历史记录
const deleteHistoryItem = async (historyItem: DockerfileHistory) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除历史记录 "${historyItem.name}" 吗？`,
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    dockerfileService.deleteHistory(historyItem.id);
    loadHistory();
    ElMessage.success('历史记录删除成功');
  } catch (error) {
    // 用户取消操作
  }
};

// 清空历史记录
const clearHistory = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清空所有历史记录吗？',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    dockerfileService.clearHistory();
    loadHistory();
    ElMessage.success('历史记录已清空');
  } catch (error) {
    // 用户取消操作
  }
};

// 添加构建参数
const addBuildArg = () => {
  buildArgs.value.push({ name: '', value: '' });
};

// 删除构建参数
const removeBuildArg = (index: number) => {
  buildArgs.value.splice(index, 1);
};

// 构建镜像
const buildImage = async () => {
  if (!canBuild.value) {
    ElMessage.warning('请输入镜像标签和Dockerfile内容');
    return;
  }

  // 过滤掉空的构建参数
  const filteredBuildArgs = buildArgs.value.filter(arg => arg.name.trim() !== '' && arg.value.trim() !== '');

  buildLoading.value = true;
  buildStatus.logs = [];
  buildStatus.error = undefined;
  buildStatus.completed = false;

  try {
    // 显示构建对话框
    showBuildDialog.value = true;

    // 检查Dockerfile内容是否有效
    if (!currentDockerfile.value.includes('FROM')) {
      buildStatus.error = 'Dockerfile必须包含FROM指令';
      buildStatus.completed = true;
      buildStatus.logs.push('错误: Dockerfile必须包含FROM指令');
      ElMessage.error('Dockerfile必须包含FROM指令');
      return;
    }

    // 开始构建
    currentBuildId.value = await dockerfileService.buildImage(
      {
        dockerfile: currentDockerfile.value,
        tag: imageTag.value,
        buildArgs: filteredBuildArgs,
        noCache: false,
        pull: true
      },
      {
        onProgress: (status) => {
          // 更新构建状态
          buildStatus.logs = status.logs;
          buildStatus.error = status.error;
          buildStatus.completed = status.completed;
        },
        onComplete: () => {
          // 构建完成后刷新镜像列表
          dockerStore.fetchImages();
          ElMessage.success(`成功构建镜像: ${imageTag.value}`);
        },
        onError: (error) => {
          console.error('构建镜像出错:', error);

          // 提取更有用的错误信息
          let errorMessage = error.message || '未知错误';

          // 处理常见的Docker错误
          if (errorMessage.includes('unexpected EOF')) {
            errorMessage = 'Docker API连接中断。请检查：\n1. Docker Desktop是否正在运行\n2. Docker API是否已启用（端口2375）\n3. 网络连接是否稳定';
          } else if (errorMessage.includes('no such file or directory')) {
            errorMessage = '构建上下文中找不到指定的文件或目录';
          } else if (errorMessage.includes('permission denied')) {
            errorMessage = 'Docker daemon权限不足，无法执行操作';
          } else if (errorMessage.includes('connection refused')) {
            errorMessage = '无法连接到Docker daemon，请确保Docker服务正在运行';
          } else if (errorMessage.includes('ECONNREFUSED')) {
            errorMessage = 'Docker daemon连接被拒绝。请确保Docker Desktop正在运行，并且Docker API在端口2375上可用';
          }

          ElMessage.error(`构建镜像失败: ${errorMessage}`);
        }
      }
    );
  } catch (error: any) {
    console.error('启动构建过程失败:', error);

    // 提取更有用的错误信息
    let errorMessage = error.message || '未知错误';

    // 处理常见的错误
    if (errorMessage.includes('unexpected EOF')) {
      errorMessage = 'Docker API连接中断。请检查：\n1. Docker Desktop是否正在运行\n2. Docker API是否已启用（端口2375）\n3. 网络连接是否稳定';
    } else if (errorMessage.includes('500')) {
      errorMessage = 'Docker服务器内部错误，可能是Docker daemon配置问题或权限不足';
    } else if (errorMessage.includes('404')) {
      errorMessage = 'Docker API端点不存在，请检查Docker API配置';
    } else if (errorMessage.includes('connection')) {
      errorMessage = '无法连接到Docker daemon，请确保Docker服务正在运行';
    } else if (errorMessage.includes('ECONNREFUSED')) {
      errorMessage = 'Docker daemon连接被拒绝。请确保Docker Desktop正在运行，并且Docker API在端口2375上可用';
    }

    // 更新构建状态
    buildStatus.error = errorMessage;
    buildStatus.completed = true;
    buildStatus.logs.push(`错误: ${errorMessage}`);

    ElMessage.error(`启动构建过程失败: ${errorMessage}`);
  } finally {
    buildLoading.value = false;
  }
};

// 取消构建
const cancelBuild = () => {
  if (currentBuildId.value) {
    try {
      dockerfileService.cancelBuild(currentBuildId.value);
      ElMessage.info('已取消构建镜像操作');
      currentBuildId.value = null;
    } catch (error) {
      console.error('取消构建镜像失败:', error);
    }
  }
};

// 格式化时间戳
const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString();
};

// 获取编辑器实例
const getEditorInstance = () => {
  return monacoEditorRef.value?.getEditor() || null;
};

// 清空构建日志
const clearLogs = () => {
  buildStatus.logs = [];
};

// 自动滚动到日志底部
const scrollToBottom = () => {
  if (logsScrollbar.value) {
    nextTick(() => {
      const scrollbarEl = logsScrollbar.value;
      if (scrollbarEl && scrollbarEl.setScrollTop) {
        scrollbarEl.setScrollTop(scrollbarEl.wrapRef.scrollHeight);
      }
    });
  }
};

// 监听构建状态变化，自动滚动
watch(() => buildStatus.logs.length, () => {
  scrollToBottom();
}, { flush: 'post' });

// 获取日志行类名
const getLogLineClass = (log: string) => {
  if (log.includes('🔨')) return 'log-line-🔨';
  if (log.includes('✅')) return 'log-line-✅';
  if (log.includes('⬇️')) return 'log-line-⬇️';
  if (log.includes('📦')) return 'log-line-📦';
  if (log.includes('❌')) return 'log-line-❌';
  if (log.includes('⚠️')) return 'log-line-⚠️';
  if (log.includes('ℹ️')) return 'log-line-ℹ️';
  if (log.includes('♻️')) return 'log-line-♻️';
  if (log.includes('🏷️')) return 'log-line-🏷️';
  if (log.includes('⚙️')) return 'log-line-⚙️';
  if (log.includes('🗑️')) return 'log-line-🗑️';
  if (log.includes('🆔')) return 'log-line-🆔';
  if (log.includes('➡️')) return 'log-line-➡️';
  if (log.includes('🔍')) return 'log-line-🔍';
  if (log.includes('🎯')) return 'log-line-🎯';
  return 'log-line';
};
</script>

<template>
  <div class="dockerfile-manager">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <h2>Dockerfile管理</h2>
          <div class="header-actions">
            <el-button-group>
              <el-button type="primary" @click="showTemplateDialog = true">模板</el-button>
              <el-button type="info" @click="showHistoryDialog = true">历史</el-button>
              <el-button type="success" @click="buildImage" :loading="buildLoading">构建镜像</el-button>
            </el-button-group>
          </div>
        </div>
      </template>

      <!-- Dockerfile编辑器 -->
      <MonacoEditor ref="monacoEditorRef" v-model="currentDockerfile" language="dockerfile" theme="customTheme"
        height="500px" :options="{
          minimap: { enabled: true },
          lineNumbers: 'on',
          renderLineHighlight: 'all',
          wordWrap: 'on'
        }" @ready="handleEditorReady" />

      <!-- 构建配置 -->
      <div class="build-config">
        <el-form :inline="true">
          <el-form-item label="镜像标签">
            <el-input v-model="imageTag" placeholder="例如: myapp:latest"></el-input>
          </el-form-item>

          <el-form-item>
            <el-popover placement="bottom" :width="400" trigger="click">
              <template #reference>
                <el-button>构建参数</el-button>
              </template>
              <div class="build-args">
                <h4>构建参数 (ARG)</h4>
                <div v-for="(arg, index) in buildArgs" :key="index" class="build-arg-item">
                  <el-input v-model="arg.name" placeholder="参数名" class="arg-name"></el-input>
                  <el-input v-model="arg.value" placeholder="参数值" class="arg-value"></el-input>
                  <el-button type="danger" circle @click="removeBuildArg(index)" :disabled="buildArgs.length === 1">
                    <el-icon>
                      <Delete />
                    </el-icon>
                  </el-button>
                </div>
                <el-button type="primary" @click="addBuildArg">添加参数</el-button>
              </div>
            </el-popover>
          </el-form-item>
        </el-form>
      </div>
    </el-card>

    <!-- 模板对话框 -->
    <el-dialog v-model="showTemplateDialog" title="Dockerfile模板" width="60%">
      <el-tabs type="border-card">
        <el-tab-pane label="保存模板">
          <el-form>
            <el-form-item label="模板名称" required>
              <el-input v-model="currentTemplateName" placeholder="输入模板名称"></el-input>
            </el-form-item>
            <el-form-item label="模板描述">
              <el-input v-model="currentTemplateDescription" placeholder="输入模板描述" type="textarea" :rows="2"></el-input>
            </el-form-item>
          </el-form>
          <div class="dialog-footer">
            <el-button @click="showTemplateDialog = false">取消</el-button>
            <el-button type="primary" @click="saveTemplate" :disabled="!canSaveTemplate">保存</el-button>
          </div>
        </el-tab-pane>

        <el-tab-pane label="加载模板">
          <el-table :data="templates" style="width: 100%">
            <el-table-column label="名称" prop="name"></el-table-column>
            <el-table-column label="描述" prop="description"></el-table-column>
            <el-table-column label="更新时间" width="180">
              <template #default="{ row }">
                {{ formatTimestamp(row.updatedAt) }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="loadTemplate(row)">加载</el-button>
                <el-button type="danger" size="small" @click="deleteTemplate(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <!-- 历史记录对话框 -->
    <el-dialog v-model="showHistoryDialog" title="Dockerfile历史记录" width="60%">
      <div class="history-header">
        <h3>历史记录</h3>
        <el-button type="danger" @click="clearHistory" :disabled="history.length === 0">清空历史</el-button>
      </div>

      <el-table :data="history" style="width: 100%">
        <el-table-column label="名称" prop="name"></el-table-column>
        <el-table-column label="时间" width="180">
          <template #default="{ row }">
            {{ formatTimestamp(row.timestamp) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="loadHistoryItem(row)">加载</el-button>
            <el-button type="danger" size="small" @click="deleteHistoryItem(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <!-- 构建进度对话框 -->
    <el-dialog v-model="showBuildDialog" title="构建镜像进度" width="80%" :close-on-click-modal="false"
      :close-on-press-escape="false" :show-close="buildStatus.completed || !!buildStatus.error">
      <div class="build-progress">
        <!-- 进度指示器 -->
        <div v-if="!buildStatus.completed && !buildStatus.error" class="progress-indicator">
          <el-progress :percentage="50" :indeterminate="true" :duration="3" status="success">
            <template #default="{ percentage }">
              <span class="percentage-value">构建中...</span>
            </template>
          </el-progress>
        </div>

        <!-- 成功指示器 -->
        <div v-if="buildStatus.completed && !buildStatus.error" class="success-indicator">
          <el-alert title="✅ 镜像构建成功！" type="success" :closable="false" show-icon></el-alert>
        </div>

        <!-- 错误信息 -->
        <div v-if="buildStatus.error" class="error-message">
          <el-alert :title="buildStatus.error" type="error" :closable="false" show-icon></el-alert>
        </div>

        <!-- 构建日志 -->
        <div class="build-logs">
          <div class="logs-header">
            <h4>构建日志</h4>
            <el-button size="small" @click="clearLogs" :disabled="buildStatus.logs.length === 0">清空日志</el-button>
          </div>
          <el-scrollbar ref="logsScrollbar" height="400px" class="logs-scrollbar">
            <div class="logs-content">
              <div v-for="(log, index) in buildStatus.logs" :key="index" :class="['log-line', getLogLineClass(log)]">
                {{ log }}
              </div>
              <div v-if="buildStatus.logs.length === 0" class="no-logs">
                等待构建日志...
              </div>
            </div>
          </el-scrollbar>
        </div>
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button type="danger" @click="cancelBuild" :disabled="buildStatus.completed">取消构建</el-button>
          <el-button @click="showBuildDialog = false"
            :disabled="!buildStatus.completed && !buildStatus.error">关闭</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.dockerfile-manager {
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

/* 编辑器样式由MonacoEditor组件提供 */

.build-config {
  margin-top: 20px;
}

.build-args {
  padding: 10px;
}

.build-arg-item {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
  gap: 10px;
}

.arg-name {
  width: 150px;
}

.arg-value {
  flex: 1;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.build-progress {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.progress-indicator {
  margin-bottom: 10px;
}

.success-indicator {
  margin-bottom: 10px;
}

.error-message {
  margin-bottom: 10px;
}

.build-logs {
  background-color: #1e1e1e;
  border-radius: 4px;
  padding: 10px;
}

.logs-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.logs-scrollbar {
  height: 400px;
}

.logs-content {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #d4d4d4;
  white-space: pre-wrap;
  margin: 0;
  padding: 10px;
}

.log-line {
  margin-bottom: 2px;
  padding: 2px 0;
  word-break: break-all;
}

/* 不同类型日志的颜色 */
.log-line-🔨 {
  color: #4fc3f7;
  font-weight: bold;
}

.log-line-✅ {
  color: #81c784;
}

.log-line-⬇️ {
  color: #ffb74d;
}

.log-line-📦 {
  color: #ba68c8;
}

.log-line-❌ {
  color: #e57373;
  font-weight: bold;
}

.log-line-⚠️ {
  color: #ffb74d;
}

.log-line-ℹ️ {
  color: #64b5f6;
}

.log-line-♻️ {
  color: #a5d6a7;
}

.log-line-🏷️ {
  color: #ba68c8;
}

.log-line-⚙️ {
  color: #ffb74d;
}

.log-line-🗑️ {
  color: #e57373;
}

.log-line-🆔 {
  color: #64b5f6;
}

.log-line-➡️ {
  color: #a5d6a7;
}

.log-line-🔍 {
  color: #ffb74d;
}

.log-line-🎯 {
  color: #81c784;
}

.no-logs {
  text-align: center;
  color: #606060;
  font-style: italic;
  padding: 20px;
}

.dialog-footer {
  margin-top: 20px;
  text-align: right;
}
</style>
