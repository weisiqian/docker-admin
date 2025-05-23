<template>
  <!-- 编辑器外层容器，支持动态设置高度 -->
  <div class="editor-wrapper" :style="{ height: height || '100%' }">
    <!-- 占位符：内容为空时显示，点击后聚焦编辑器 -->
    <div v-if="placeholder && isEmpty" class="placeholder" @click="focusEditor">
      {{ placeholder }}
    </div>
    <!-- 真正的 Monaco Editor 容器 -->
    <div ref="editorContainer" class="editor-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, computed, nextTick } from 'vue';
import type { PropType } from 'vue';
import * as monaco from 'monaco-editor';
import { configureMonaco } from '@/utils/monaco-config';

// 右键菜单项接口
interface ContextMenuItem {
  id: string;
  label: string;
  keybinding?: number[];
  icon?: string;
  condition?: () => boolean;
}

// 定义组件名称为 MonacoEditor，可在模板中使用 <monaco-editor>
defineOptions({ name: 'MonacoEditor' });

// 使用 runtime props，以支持默认值
const props = defineProps({
  modelValue: { type: String, required: true },            // 文档内容绑定
  language: {                                             // 编辑器语言
    type: String,
    default: 'plaintext',
  },
  theme: {                                                // 编辑器主题
    type: String as PropType<'vs' | 'vs-dark' | 'hc-black' | 'customTheme'>,
    default: 'vs-dark',
  },
  readOnly: { type: Boolean, default: false },            // 是否只读
  placeholder: { type: String, default: '' },             // 占位符文本
  height: { type: String, default: '' },                  // 编辑器高度，例如 '300px'
  options: { type: Object as PropType<monaco.editor.IStandaloneEditorConstructionOptions>, default: () => ({}) },
  // 右键菜单项
  contextMenuItems: {
    type: Array as PropType<ContextMenuItem[]>,
    default: () => []
  },
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'contextMenuAction', id: string): void;
  (e: 'ready'): void;
}>();

// 暴露方法给父组件
defineExpose({
  formatContent,
  focus: focusEditor,
  getEditor: () => editor
});

// 编辑器容器及实例引用
const editorContainer = ref<HTMLElement | null>(null);
let editor: monaco.editor.IStandaloneCodeEditor | null = null;
let preventTrigger = false; // 避免内容更新循环触发

// 计算内容是否为空
const isEmpty = computed(() => !props.modelValue || props.modelValue.length === 0);

// 初始化编辑器并监听内容变化
onMounted(() => {
  // 确保Monaco编辑器已配置（如果尚未配置）
  if (!window.monacoConfigured) {
    configureMonaco();
    window.monacoConfigured = true;
  }

  // 确保容器已经渲染并有正确的尺寸
  nextTick(() => {
    try {
      if (editorContainer.value) {
        // 创建编辑器实例，使用更安全的默认选项
        const defaultOptions = {
          value: props.modelValue,
          language: props.language,
          theme: props.theme,
          readOnly: props.readOnly,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          minimap: { enabled: true },
          tabSize: 2,
          insertSpaces: true,
          detectIndentation: false,
          wordWrap: 'on' as 'on'
        };

        // 合并用户提供的选项
        const editorOptions = { ...defaultOptions, ...props.options };

        // 创建编辑器实例
        editor = monaco.editor.create(editorContainer.value, editorOptions);

        // 监听内容变化
        if (editor) {
          editor.onDidChangeModelContent(() => {
            if (preventTrigger) return;
            const value = editor?.getValue() || '';
            emit('update:modelValue', value);
          });

          // 强制编辑器重新布局
          editor.layout();

          // 注册右键菜单
          registerContextMenu();

          // 添加窗口大小变化监听，确保编辑器正确调整大小
          const handleResize = () => {
            if (editor) {
              editor.layout();
            }
          };

          window.addEventListener('resize', handleResize);

          // 存储事件处理函数引用，以便在组件卸载时移除
          (window as any).handleEditorResize = handleResize;
          
          // 通知父组件编辑器已准备就绪
          emit('ready');
        }
      }
    } catch (error) {
      console.error('Monaco editor initialization error:', error);
    }
  });
});

// 外部内容变化时同步到编辑器
watch(
  () => props.modelValue,
  (newVal) => {
    if (!editor) return;
    const current = editor.getValue();
    if (newVal !== current) {
      preventTrigger = true;
      editor.setValue(newVal);
      preventTrigger = false;
    }
  }
);

// 语言和主题变化处理
watch(() => props.language, (newLang) => {
  if (editor) monaco.editor.setModelLanguage(editor.getModel()!, newLang);
});
watch(() => props.theme, (newTheme) => {
  if (editor) monaco.editor.setTheme(newTheme);
});

// 点击占位符时聚焦编辑器
function focusEditor() {
  editor?.focus();
}

// 格式化编辑器内容
function formatContent() {
  if (!editor) return false;

  try {
    // 尝试使用Monaco Editor内置的格式化功能
    const formatAction = editor.getAction('editor.action.formatDocument');
    if (formatAction) {
      formatAction.run();
      return true;
    }
    return false;
  } catch (error) {
    console.error('格式化内容失败:', error);
    return false;
  }
}

// 注册右键菜单
function registerContextMenu() {
  if (!editor || !props.contextMenuItems.length) return;

  // 为每个菜单项注册一个编辑器操作
  props.contextMenuItems.forEach(item => {
    editor?.addAction({
      id: item.id,
      label: item.label,
      keybindings: item.keybinding,
      contextMenuGroupId: 'custom', // 将所有自定义菜单项放在同一组
      run: () => {
        emit('contextMenuAction', item.id);
      }
    });
  });
}

// 卸载前销毁编辑器实例和清理事件监听器
onBeforeUnmount(() => {
  // 移除窗口大小变化监听器
  if ((window as any).handleEditorResize) {
    window.removeEventListener('resize', (window as any).handleEditorResize);
    delete (window as any).handleEditorResize;
  }

  // 销毁编辑器实例
  if (editor) {
    try {
      editor.dispose();
    } catch (error) {
      console.error('Error disposing Monaco editor:', error);
    }
    editor = null;
  }
});
</script>

<style scoped>
.editor-wrapper {
  position: relative;
  width: 100%;
  min-width: 300px;
  display: block;
  box-sizing: border-box;
}

.editor-container {
  width: 100%;
  height: 100%;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  box-sizing: border-box;
}

.placeholder {
  position: absolute;
  top: 8px;
  left: 12px;
  color: #888;
  cursor: text;
  user-select: none;
}
</style>
