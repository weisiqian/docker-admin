import axios from 'axios'
import type { CancelTokenSource } from 'axios'
import configService from './config'

// 本地存储键名
const DOCKERFILE_TEMPLATES_KEY = 'dockerfile_templates'
const DOCKERFILE_HISTORY_KEY = 'dockerfile_history'

// Dockerfile模板类型
export interface DockerfileTemplate {
  id: string
  name: string
  description: string
  content: string
  createdAt: number
  updatedAt: number
}

// Dockerfile历史记录类型
export interface DockerfileHistory {
  id: string
  name: string
  content: string
  timestamp: number
}

// 构建参数类型
export interface BuildArg {
  name: string
  value: string
}

// 构建选项类型
export interface BuildOptions {
  dockerfile: string
  tag: string
  buildArgs?: BuildArg[]
  noCache?: boolean
  pull?: boolean
}

// 构建进度事件类型
export interface BuildProgress {
  stream?: string
  status?: string
  id?: string
  progress?: string
  error?: string
  errorDetail?: {
    message: string
    code?: number
  }
}

// 构建状态类型
export interface BuildStatus {
  logs: string[]
  error?: string
  completed: boolean
}

// 构建回调选项
export interface BuildCallbacks {
  onProgress?: (status: BuildStatus) => void
  onComplete?: () => void
  onError?: (error: any) => void
}

/**
 * Dockerfile服务类
 * 管理Dockerfile模板和构建镜像
 */
class DockerfileService {
  // 当前活跃的构建请求
  private _activeBuildRequests: Map<
    string,
    {
      cancelToken: CancelTokenSource
      status: BuildStatus
    }
  > = new Map()

  /**
   * 获取所有Dockerfile模板
   */
  getTemplates(): DockerfileTemplate[] {
    const templatesJson = localStorage.getItem(DOCKERFILE_TEMPLATES_KEY)
    if (!templatesJson) {
      return this.getDefaultTemplates()
    }

    try {
      return JSON.parse(templatesJson)
    } catch (error) {
      console.error('解析Dockerfile模板失败:', error)
      return this.getDefaultTemplates()
    }
  }

  /**
   * 获取默认的Dockerfile模板
   */
  private getDefaultTemplates(): DockerfileTemplate[] {
    const now = Date.now()
    const templates: DockerfileTemplate[] = [
      {
        id: 'node',
        name: 'Node.js应用',
        description: '用于构建Node.js应用的Dockerfile',
        content: `FROM node:14-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "start"]`,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'python',
        name: 'Python应用',
        description: '用于构建Python应用的Dockerfile',
        content: `FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["python", "app.py"]`,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'nginx',
        name: 'Nginx静态网站',
        description: '用于部署静态网站的Nginx Dockerfile',
        content: `FROM nginx:alpine

# 创建一个简单的HTML文件用于测试
RUN echo '<html><body><h1>Hello from Docker!</h1><p>这是一个测试页面</p></body></html>' > /usr/share/nginx/html/index.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]`,
        createdAt: now,
        updatedAt: now,
      },
    ]

    // 保存默认模板
    this.saveTemplates(templates)

    return templates
  }

  /**
   * 保存Dockerfile模板
   */
  saveTemplates(templates: DockerfileTemplate[]): void {
    localStorage.setItem(DOCKERFILE_TEMPLATES_KEY, JSON.stringify(templates))
  }

  /**
   * 保存单个Dockerfile模板
   */
  saveTemplate(template: DockerfileTemplate): DockerfileTemplate {
    const templates = this.getTemplates()
    const now = Date.now()

    // 检查是否已存在相同ID的模板
    const existingIndex = templates.findIndex((t) => t.id === template.id)

    if (existingIndex >= 0) {
      // 更新现有模板
      templates[existingIndex] = {
        ...template,
        updatedAt: now,
      }
    } else {
      // 添加新模板
      templates.push({
        ...template,
        createdAt: now,
        updatedAt: now,
      })
    }

    this.saveTemplates(templates)
    return template
  }

  /**
   * 删除Dockerfile模板
   */
  deleteTemplate(id: string): boolean {
    const templates = this.getTemplates()
    const initialLength = templates.length

    const filteredTemplates = templates.filter((t) => t.id !== id)

    if (filteredTemplates.length !== initialLength) {
      this.saveTemplates(filteredTemplates)
      return true
    }

    return false
  }

  /**
   * 获取Dockerfile历史记录
   */
  getHistory(): DockerfileHistory[] {
    const historyJson = localStorage.getItem(DOCKERFILE_HISTORY_KEY)
    if (!historyJson) {
      return []
    }

    try {
      return JSON.parse(historyJson)
    } catch (error) {
      console.error('解析Dockerfile历史记录失败:', error)
      return []
    }
  }

  /**
   * 保存Dockerfile历史记录
   */
  saveHistory(history: DockerfileHistory[]): void {
    // 只保留最近的20条记录
    const limitedHistory = history.slice(0, 20)
    localStorage.setItem(DOCKERFILE_HISTORY_KEY, JSON.stringify(limitedHistory))
  }

  /**
   * 添加Dockerfile历史记录
   */
  addHistory(name: string, content: string): DockerfileHistory {
    const history = this.getHistory()
    const now = Date.now()

    const newEntry: DockerfileHistory = {
      id: `history_${now}`,
      name,
      content,
      timestamp: now,
    }

    // 添加到历史记录开头
    history.unshift(newEntry)

    this.saveHistory(history)
    return newEntry
  }

  /**
   * 删除Dockerfile历史记录
   */
  deleteHistory(id: string): boolean {
    const history = this.getHistory()
    const initialLength = history.length

    const filteredHistory = history.filter((h) => h.id !== id)

    if (filteredHistory.length !== initialLength) {
      this.saveHistory(filteredHistory)
      return true
    }

    return false
  }

  /**
   * 清空所有Dockerfile历史记录
   */
  clearHistory(): void {
    localStorage.removeItem(DOCKERFILE_HISTORY_KEY)
  }

  /**
   * 构建镜像
   */
  async buildImage(options: BuildOptions, callbacks?: BuildCallbacks): Promise<string> {
    // 创建取消令牌
    const cancelToken = axios.CancelToken.source()

    // 初始化构建状态
    const status: BuildStatus = {
      logs: [],
      completed: false,
    }

    try {
      // 将此请求添加到活跃请求列表
      const buildId = `build_${Date.now()}`
      this._activeBuildRequests.set(buildId, { cancelToken, status })

      // 构建查询参数
      const queryParams = new URLSearchParams()
      queryParams.append('t', options.tag)

      if (options.noCache) {
        queryParams.append('nocache', 'true')
      }

      if (options.pull) {
        queryParams.append('pull', 'true')
      }

      // 添加构建参数
      if (options.buildArgs && options.buildArgs.length > 0) {
        const buildArgsObj: Record<string, string> = {}
        options.buildArgs.forEach((arg) => {
          if (arg.name && arg.value) {
            buildArgsObj[arg.name] = arg.value
          }
        })

        if (Object.keys(buildArgsObj).length > 0) {
          queryParams.append('buildargs', JSON.stringify(buildArgsObj))
        }
      }

      // 使用更简单的方法：直接发送Dockerfile内容
      // 创建一个简单的tar文件包含Dockerfile
      const tarContent = this.createMinimalTar(options.dockerfile)

      // 发送请求到Docker API
      const response = await fetch(`${configService.apiUrl}/build?${queryParams.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-tar',
        },
        body: tarContent,
      })

      if (!response.ok) {
        // 尝试获取更详细的错误信息
        try {
          const errorText = await response.text()
          console.error('Docker API错误响应:', errorText)

          // 尝试解析JSON错误
          try {
            const errorJson = JSON.parse(errorText)
            if (errorJson.message) {
              throw new Error(`Docker API错误: ${errorJson.message}`)
            }
          } catch (jsonError) {
            // 如果不是JSON，直接使用文本
            if (errorText && errorText.length > 0) {
              throw new Error(
                `Docker API错误: ${errorText.substring(0, 200)}${errorText.length > 200 ? '...' : ''}`,
              )
            }
          }
        } catch (textError) {
          console.error('无法读取错误响应:', textError)
        }

        // 如果无法获取详细错误，使用状态码
        throw new Error(`HTTP错误! 状态码: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('响应体为空')
      }

      // 获取响应流的reader
      const reader = response.body.getReader()
      let receivedText = ''

      // 读取流数据
      while (true) {
        // 检查是否已取消
        if (this._activeBuildRequests.get(buildId)?.cancelToken !== cancelToken) {
          reader.cancel()
          throw new Error('构建操作已取消')
        }

        const { done, value } = await reader.read()

        if (done) {
          break
        }

        // 将Uint8Array转换为字符串
        const chunk = new TextDecoder().decode(value)
        receivedText += chunk

        // 处理接收到的数据块
        // Docker API返回的是NDJSON格式，可能包含多个JSON对象
        // 有些对象可能在同一行，用}{ 分隔

        // 首先按换行符分割
        let lines = receivedText.split('\n')

        // 保留最后一个可能不完整的行
        receivedText = lines.pop() || ''

        // 处理每一行，可能包含多个JSON对象
        for (const line of lines) {
          if (line.trim()) {
            this.processDockerApiLine(line.trim(), status, callbacks)
          }
        }
      }

      // 处理最后可能剩余的数据
      if (receivedText.trim()) {
        this.processDockerApiLine(receivedText.trim(), status, callbacks)
      }

      // 标记为完成
      status.completed = true
      if (callbacks?.onProgress) {
        callbacks.onProgress({ ...status })
      }

      // 调用完成回调
      if (callbacks?.onComplete) {
        callbacks.onComplete()
      }

      // 从活跃请求列表中移除
      this._activeBuildRequests.delete(buildId)

      // 添加到历史记录
      this.addHistory(options.tag, options.dockerfile)

      return buildId
    } catch (error: any) {
      // 处理错误
      if (axios.isCancel(error)) {
        console.log('镜像构建已取消')
        status.error = '构建操作已取消'
      } else {
        console.error('构建镜像失败:', error)
        status.error = error.message || '构建镜像失败'
      }

      status.completed = true

      // 调用进度回调（报告错误）
      if (callbacks?.onProgress) {
        callbacks.onProgress({ ...status })
      }

      // 调用错误回调
      if (callbacks?.onError) {
        callbacks.onError(error)
      }

      throw error
    }
  }

  /**
   * 创建最小化的tar文件包含Dockerfile和必要的文件
   */
  private createMinimalTar(dockerfileContent: string): Uint8Array {
    // 分析Dockerfile内容，检测需要的文件
    const files = this.analyzeDockerfileFiles(dockerfileContent)

    // 计算所有文件的总大小
    let totalContentSize = 0
    files.forEach((file) => {
      totalContentSize += file.content.length
    })

    // 计算tar文件大小：每个文件的头部(512) + 内容(向上取整到512的倍数) + 结束标记(1024)
    let totalSize = 1024 // 结束标记
    files.forEach((file) => {
      const contentPadded = Math.ceil(file.content.length / 512) * 512
      totalSize += 512 + contentPadded // 头部 + 内容
    })

    const tarBuffer = new Uint8Array(totalSize)
    let offset = 0

    // 为每个文件创建tar条目
    files.forEach((file) => {
      offset = this.addTarEntry(tarBuffer, offset, file.name, file.content)
    })

    // 其余部分已经是零（结束标记）

    return tarBuffer
  }

  /**
   * 分析Dockerfile内容，确定需要包含的文件
   */
  private analyzeDockerfileFiles(
    dockerfileContent: string,
  ): Array<{ name: string; content: Uint8Array }> {
    const files: Array<{ name: string; content: Uint8Array }> = []

    // 始终包含Dockerfile
    files.push({
      name: 'Dockerfile',
      content: new TextEncoder().encode(dockerfileContent),
    })

    // 检查是否有COPY指令引用本地文件
    const copyMatches = dockerfileContent.match(/COPY\s+([^\s]+)\s+/g)
    if (copyMatches) {
      copyMatches.forEach((match) => {
        const parts = match.trim().split(/\s+/)
        if (parts.length >= 3) {
          const sourcePath = parts[1]

          // 如果引用了本地文件/目录，创建示例文件
          if (sourcePath.startsWith('./') || !sourcePath.includes('/')) {
            const fileName = sourcePath.replace('./', '')

            if (fileName === 'dist' || fileName.includes('dist')) {
              // 创建一个示例的index.html文件
              files.push({
                name: 'dist/index.html',
                content: new TextEncoder().encode(`<!DOCTYPE html>
<html>
<head>
    <title>Docker构建测试</title>
    <meta charset="utf-8">
</head>
<body>
    <h1>Hello from Docker!</h1>
    <p>这是一个由Docker Admin构建的测试页面</p>
    <p>构建时间: ${new Date().toLocaleString()}</p>
</body>
</html>`),
              })
            } else if (fileName.includes('.html') || fileName.includes('.htm')) {
              // 创建HTML文件
              files.push({
                name: fileName,
                content: new TextEncoder().encode(`<!DOCTYPE html>
<html>
<head>
    <title>测试页面</title>
    <meta charset="utf-8">
</head>
<body>
    <h1>测试页面</h1>
    <p>这是一个自动生成的测试文件</p>
</body>
</html>`),
              })
            } else if (fileName.includes('.txt')) {
              // 创建文本文件
              files.push({
                name: fileName,
                content: new TextEncoder().encode(
                  '这是一个自动生成的测试文件\n由Docker Admin创建\n',
                ),
              })
            } else if (fileName === 'package.json') {
              // 创建示例package.json
              files.push({
                name: 'package.json',
                content: new TextEncoder().encode(`{
  "name": "docker-test-app",
  "version": "1.0.0",
  "description": "Docker构建测试应用",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  }
}`),
              })
            } else if (fileName === 'requirements.txt') {
              // 创建示例requirements.txt
              files.push({
                name: 'requirements.txt',
                content: new TextEncoder().encode('# Python依赖文件\n# 这是一个示例文件\n'),
              })
            }
          }
        }
      })
    }

    return files
  }

  /**
   * 向tar缓冲区添加一个文件条目
   */
  private addTarEntry(
    tarBuffer: Uint8Array,
    offset: number,
    filename: string,
    content: Uint8Array,
  ): number {
    const contentSize = content.length

    // 创建tar头部
    const header = new Uint8Array(512)

    // 文件名 (0-99)
    const nameBytes = new TextEncoder().encode(filename)
    header.set(nameBytes.slice(0, 100), 0)

    // 文件模式 (100-107) - "0000644 "
    header.set(new TextEncoder().encode('0000644'), 100)
    header[107] = 32 // 空格

    // 用户ID (108-115) - "0000000 "
    header.set(new TextEncoder().encode('0000000'), 108)
    header[115] = 32 // 空格

    // 组ID (116-123) - "0000000 "
    header.set(new TextEncoder().encode('0000000'), 116)
    header[123] = 32 // 空格

    // 文件大小 (124-135) - 八进制，11位数字 + 空格
    const sizeOctal = contentSize.toString(8).padStart(11, '0')
    header.set(new TextEncoder().encode(sizeOctal), 124)
    header[135] = 32 // 空格

    // 修改时间 (136-147) - 八进制时间戳，11位数字 + 空格
    const mtime = Math.floor(Date.now() / 1000)
      .toString(8)
      .padStart(11, '0')
    header.set(new TextEncoder().encode(mtime), 136)
    header[147] = 32 // 空格

    // 校验和占位符 (148-155) - 8个空格
    for (let i = 148; i < 156; i++) {
      header[i] = 32
    }

    // 文件类型 (156) - '0' 表示普通文件
    header[156] = 48

    // 计算校验和
    let checksum = 0
    for (let i = 0; i < 512; i++) {
      checksum += header[i]
    }

    // 设置校验和 (148-154) - 6位八进制数字 + null + 空格
    const checksumOctal = checksum.toString(8).padStart(6, '0')
    header.set(new TextEncoder().encode(checksumOctal), 148)
    header[154] = 0 // null
    header[155] = 32 // 空格

    // 将头部复制到tar缓冲区
    tarBuffer.set(header, offset)
    offset += 512

    // 复制文件内容
    tarBuffer.set(content, offset)
    offset += content.length

    // 填充到512字节边界
    const padding = (512 - (content.length % 512)) % 512
    offset += padding

    return offset
  }

  /**
   * 取消构建镜像
   */
  cancelBuild(buildId: string): boolean {
    const request = this._activeBuildRequests.get(buildId)
    if (request) {
      request.cancelToken.cancel('用户取消了操作')
      this._activeBuildRequests.delete(buildId)
      return true
    }
    return false
  }

  /**
   * 处理Docker API的NDJSON行
   */
  private processDockerApiLine(
    line: string,
    status: BuildStatus,
    callbacks?: BuildCallbacks,
  ): void {
    // Docker API有时会在同一行返回多个JSON对象，用}{分隔
    // 例如: {"stream":"Step 1/4 : FROM nginx:alpine"}{"stream":"\n"}

    // 分割可能连接的JSON对象
    const jsonObjects = this.splitJsonObjects(line)

    for (const jsonStr of jsonObjects) {
      if (jsonStr.trim()) {
        try {
          const event: BuildProgress = JSON.parse(jsonStr)

          // 处理构建进度
          this._updateBuildProgress(event, status)

          // 调用进度回调
          if (callbacks?.onProgress) {
            callbacks.onProgress({ ...status })
          }
        } catch (e) {
          console.warn('解析Docker构建进度信息失败:', e, jsonStr)
          // 即使解析失败，也将原始内容添加到日志中
          if (jsonStr.trim().length > 0) {
            // 尝试解码Unicode转义字符
            const decodedStr = this.decodeUnicodeEscapes(jsonStr)
            status.logs.push(`⚠️ 原始数据: ${decodedStr}`)

            if (callbacks?.onProgress) {
              callbacks.onProgress({ ...status })
            }
          }
        }
      }
    }
  }

  /**
   * 分割可能连接的JSON对象
   */
  private splitJsonObjects(line: string): string[] {
    const objects: string[] = []
    let current = ''
    let braceCount = 0
    let inString = false
    let escapeNext = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      current += char

      if (escapeNext) {
        escapeNext = false
        continue
      }

      if (char === '\\') {
        escapeNext = true
        continue
      }

      if (char === '"') {
        inString = !inString
        continue
      }

      if (!inString) {
        if (char === '{') {
          braceCount++
        } else if (char === '}') {
          braceCount--

          // 如果大括号平衡，说明一个JSON对象结束
          if (braceCount === 0) {
            objects.push(current.trim())
            current = ''
          }
        }
      }
    }

    // 如果还有剩余内容，也添加进去
    if (current.trim()) {
      objects.push(current.trim())
    }

    return objects
  }

  /**
   * 解码Unicode转义字符
   */
  private decodeUnicodeEscapes(str: string): string {
    try {
      // 替换Unicode转义字符
      return str.replace(/\\u([0-9a-fA-F]{4})/g, (match, code) => {
        return String.fromCharCode(parseInt(code, 16))
      })
    } catch (e) {
      return str
    }
  }

  /**
   * 更新构建进度
   */
  private _updateBuildProgress(event: BuildProgress, status: BuildStatus): void {
    // 如果有错误，记录错误
    if (event.error || event.errorDetail) {
      status.error = event.error || event.errorDetail?.message || '构建过程中出现错误'
      status.logs.push(`❌ 错误: ${status.error}`)
      return
    }

    // 处理流输出（构建步骤）
    if (event.stream) {
      let streamContent = event.stream.trim()

      // 解码Unicode转义字符
      streamContent = this.decodeUnicodeEscapes(streamContent)

      if (streamContent) {
        // 检查是否是构建步骤
        if (streamContent.startsWith('Step ')) {
          status.logs.push(`🔨 ${streamContent}`)
        } else if (streamContent.includes('Successfully built')) {
          status.logs.push(`✅ ${streamContent}`)
        } else if (streamContent.includes('Successfully tagged')) {
          status.logs.push(`🏷️ ${streamContent}`)
        } else if (streamContent.includes('Running in')) {
          status.logs.push(`⚙️ ${streamContent}`)
        } else if (streamContent.includes('Removed intermediate container')) {
          status.logs.push(`🗑️ ${streamContent}`)
        } else if (streamContent.match(/^[a-f0-9]{12}$/)) {
          // 容器ID或镜像ID
          status.logs.push(`🆔 ${streamContent}`)
        } else if (streamContent.includes('---')) {
          // Docker构建的箭头指示符
          status.logs.push(`➡️ ${streamContent}`)
        } else if (streamContent === '\n' || streamContent === '') {
          // 跳过空行
          return
        } else {
          // 其他流输出
          status.logs.push(streamContent)
        }
      }
    }

    // 处理状态信息（拉取进度）
    if (event.status) {
      let statusLine = event.status

      // 添加镜像ID前缀
      if (event.id) {
        statusLine = `${event.id}: ${statusLine}`
      }

      // 添加进度信息
      if (event.progress) {
        statusLine = `${statusLine} ${event.progress}`
      }

      // 根据状态类型添加图标
      if (event.status.includes('Pulling')) {
        statusLine = `⬇️ ${statusLine}`
      } else if (event.status.includes('Downloaded')) {
        statusLine = `✅ ${statusLine}`
      } else if (event.status.includes('Extracting')) {
        statusLine = `📦 ${statusLine}`
      } else if (event.status.includes('Pull complete')) {
        statusLine = `✅ ${statusLine}`
      } else if (event.status.includes('Already exists')) {
        statusLine = `♻️ ${statusLine}`
      } else if (event.status.includes('Image is up to date')) {
        statusLine = `✅ ${statusLine}`
      } else if (event.status.includes('Digest:')) {
        statusLine = `🔍 ${statusLine}`
      } else if (event.status.includes('Status:')) {
        statusLine = `ℹ️ ${statusLine}`
      }

      status.logs.push(statusLine)
    }

    // 处理aux字段（辅助信息，如最终镜像ID）
    if ((event as any).aux && (event as any).aux.ID) {
      const imageId = (event as any).aux.ID
      status.logs.push(`🎯 构建完成，镜像ID: ${imageId}`)
    }

    // 处理其他可能的字段
    if (!event.stream && !event.status && !event.error && !(event as any).aux) {
      // 如果有其他未处理的字段，记录原始JSON
      const otherFields = Object.keys(event).filter(
        (key) =>
          !['stream', 'status', 'id', 'progress', 'error', 'errorDetail', 'aux'].includes(key),
      )

      if (otherFields.length > 0) {
        const otherData = otherFields.map((key) => `${key}: ${(event as any)[key]}`).join(', ')
        status.logs.push(`ℹ️ ${otherData}`)
      }
    }
  }
}

export default new DockerfileService()
