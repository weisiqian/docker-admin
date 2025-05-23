import * as monaco from 'monaco-editor';

// 为全局类型声明添加 monacoConfigured 属性
declare global {
  interface Window {
    monacoConfigured: boolean;
  }
}

/**
 * 配置 Monaco 编辑器
 * 注册语言、主题和其他全局设置
 */
export function configureMonaco() {
  // 如果已经配置过，则不再重复配置
  if (window.monacoConfigured) return;

  // 注册 Dockerfile 语法高亮
  registerDockerfileSyntax();

  // 注册自定义主题
  registerCustomThemes();

  // 标记为已配置
  window.monacoConfigured = true;
}

/**
 * 注册 Dockerfile 语法高亮
 */
function registerDockerfileSyntax() {
  // 注册 Dockerfile 语言
  monaco.languages.register({ id: 'dockerfile' });

  // 设置 Dockerfile 语法高亮规则
  monaco.languages.setMonarchTokensProvider('dockerfile', {
    defaultToken: '',
    tokenPostfix: '.dockerfile',

    // Dockerfile 关键字
    keywords: [
      'FROM', 'MAINTAINER', 'RUN', 'CMD', 'LABEL', 'EXPOSE',
      'ENV', 'ADD', 'COPY', 'ENTRYPOINT', 'VOLUME', 'USER',
      'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL', 'HEALTHCHECK', 'SHELL'
    ],

    // 语法规则
    tokenizer: {
      root: [
        [/^(FROM|MAINTAINER|RUN|CMD|LABEL|EXPOSE|ENV|ADD|COPY|ENTRYPOINT|VOLUME|USER|WORKDIR|ARG|ONBUILD|STOPSIGNAL|HEALTHCHECK|SHELL)(\s+)/, ['keyword', '']],
        [/#.*$/, 'comment'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/'([^'\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string_double'],
        [/'/, 'string', '@string_single'],
        [/[a-zA-Z_]\w*/, 'identifier'],
      ],

      string_double: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop']
      ],

      string_single: [
        [/[^\\']+/, 'string'],
        [/\\./, 'string.escape'],
        [/'/, 'string', '@pop']
      ]
    }
  });

  // 添加 Dockerfile 语言补全提供程序
  monaco.languages.registerCompletionItemProvider('dockerfile', {
    provideCompletionItems: (model, position) => {
      const suggestions = [
        {
          label: 'FROM',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'FROM ${1:image}:${2:tag}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '设置基础镜像'
        },
        {
          label: 'RUN',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'RUN ${1:command}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '执行命令'
        },
        {
          label: 'COPY',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'COPY ${1:source} ${2:destination}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '复制文件'
        },
        {
          label: 'ADD',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'ADD ${1:source} ${2:destination}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '添加文件，支持URL和解压缩'
        },
        {
          label: 'CMD',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'CMD ["${1:executable}", "${2:param1}", "${3:param2}"]',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '容器启动命令'
        },
        {
          label: 'ENTRYPOINT',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'ENTRYPOINT ["${1:executable}", "${2:param1}"]',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '容器入口点'
        },
        {
          label: 'WORKDIR',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'WORKDIR ${1:/path/to/workdir}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '设置工作目录'
        },
        {
          label: 'ENV',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'ENV ${1:key}=${2:value}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '设置环境变量'
        },
        {
          label: 'EXPOSE',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'EXPOSE ${1:port}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '暴露端口'
        },
        {
          label: 'VOLUME',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'VOLUME ["${1:/data}"]',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '创建挂载点'
        },
        {
          label: 'USER',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'USER ${1:username}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '设置用户'
        },
        {
          label: 'ARG',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'ARG ${1:name}=${2:defaultValue}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '定义构建参数'
        },
        {
          label: 'LABEL',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'LABEL ${1:key}="${2:value}"',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '添加元数据'
        },
        {
          label: 'HEALTHCHECK',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'HEALTHCHECK --interval=30s --timeout=30s --retries=3 CMD ${1:command}',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: '健康检查'
        }
      ];

      return { suggestions };
    }
  });
}

/**
 * 注册自定义主题
 */
function registerCustomThemes() {
  // 注册自定义深色主题
  monaco.editor.defineTheme('customTheme', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'keyword', foreground: '569cd6', fontStyle: 'bold' },
      { token: 'comment', foreground: '608b4e', fontStyle: 'italic' },
      { token: 'string', foreground: 'ce9178' },
      { token: 'number', foreground: 'b5cea8' },
      { token: 'identifier', foreground: '9cdcfe' }
    ],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#d4d4d4',
      'editorCursor.foreground': '#d4d4d4',
      'editor.lineHighlightBackground': '#2d2d2d',
      'editorLineNumber.foreground': '#858585',
      'editor.selectionBackground': '#264f78',
      'editor.inactiveSelectionBackground': '#3a3d41'
    }
  });
}
