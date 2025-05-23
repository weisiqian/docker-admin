import axios from 'axios'
import type { CancelTokenSource } from 'axios'
import type { DockerImage, DockerContainer, CreateContainerParams } from '@/types/docker'
import configService from './config'

// 定义镜像拉取进度事件类型
export interface PullProgress {
  id?: string // 层ID
  status: string // 状态信息
  progress?: string // 进度信息
  progressDetail?: {
    current?: number // 当前已下载字节数
    total?: number // 总字节数
  }
  error?: string // 错误信息
}

// 定义镜像拉取状态类型
export interface PullStatus {
  layers: Record<string, PullProgress> // 各层的进度
  overall: {
    percent: number // 总体百分比
    downloaded: number // 已下载字节数
    total: number // 总字节数
    speed: number // 下载速度 (bytes/s)
  }
  error?: string // 错误信息
  completed: boolean // 是否完成
}

// 定义拉取选项
export interface PullOptions {
  onProgress?: (status: PullStatus) => void // 进度回调
  onComplete?: () => void // 完成回调
  onError?: (error: any) => void // 错误回调
}

// Docker服务类
class DockerService {
  // 镜像相关API

  // 获取所有镜像
  async getImages(): Promise<DockerImage[]> {
    try {
      const response = await axios.get(`${configService.apiUrl}/images/json`)
      return response.data
    } catch (error) {
      console.error('获取镜像列表失败:', error)
      throw error
    }
  }

  // 搜索远程镜像
  async searchImages(term: string): Promise<any[]> {
    try {
      const response = await axios.get(`${configService.apiUrl}/images/search`, {
        params: { term },
      })
      return response.data
    } catch (error) {
      console.error('搜索镜像失败:', error)
      throw error
    }
  }

  // 当前活跃的拉取操作
  private _activePullRequests: Map<
    string,
    {
      cancelToken: CancelTokenSource
      status: PullStatus
    }
  > = new Map()

  // 拉取镜像（基本方法，不带进度监控）
  async pullImage(imageName: string): Promise<void> {
    try {
      // Docker API拉取镜像需要特殊处理，因为它是一个流式响应
      const response = await axios.post(`${configService.apiUrl}/images/create`, null, {
        params: {
          fromImage: imageName,
        },
        headers: {
          'Content-Type': 'application/json',
        },
      })
      return response.data
    } catch (error) {
      console.error('拉取镜像失败:', error)
      throw error
    }
  }

  // 拉取镜像（带进度监控和取消功能）
  async pullImageWithProgress(imageName: string, options?: PullOptions): Promise<string> {
    // 创建取消令牌
    const cancelToken = axios.CancelToken.source()

    // 初始化拉取状态
    const status: PullStatus = {
      layers: {},
      overall: {
        percent: 0,
        downloaded: 0,
        total: 0,
        speed: 0,
      },
      completed: false,
    }

    // 记录开始时间，用于计算速度
    const startTime = Date.now()
    let lastUpdate = startTime
    let lastDownloaded = 0

    // 将此请求添加到活跃请求列表
    const requestId = `${imageName}_${Date.now()}`
    this._activePullRequests.set(requestId, { cancelToken, status })

    try {
      // 使用流式处理方式拉取镜像
      const response = await fetch(
        `${configService.apiUrl}/images/create?fromImage=${encodeURIComponent(imageName)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      // 获取响应流的reader
      const reader = response.body.getReader()
      let receivedText = ''

      // 读取流数据
      while (true) {
        // 检查是否已取消
        if (this._activePullRequests.get(requestId)?.cancelToken !== cancelToken) {
          reader.cancel()
          throw new Error('拉取操作已取消')
        }

        const { done, value } = await reader.read()

        if (done) {
          break
        }

        // 将Uint8Array转换为字符串
        const chunk = new TextDecoder().decode(value)
        receivedText += chunk

        // 处理接收到的数据块
        // Docker API返回的是多个JSON对象，每个对象一行
        const lines = receivedText.split('\n')

        // 处理完整的行，保留最后一个可能不完整的行
        receivedText = lines.pop() || ''

        for (const line of lines) {
          if (line.trim()) {
            try {
              const event = JSON.parse(line)
              this._updatePullProgress(event, status, startTime, lastUpdate, lastDownloaded)

              // 更新时间和下载量，用于计算速度
              const now = Date.now()
              if (now - lastUpdate > 1000) {
                // 每秒更新一次速度
                const elapsed = (now - lastUpdate) / 1000 // 秒
                const downloaded = status.overall.downloaded
                status.overall.speed = Math.round((downloaded - lastDownloaded) / elapsed)

                lastUpdate = now
                lastDownloaded = downloaded
              }

              // 调用进度回调
              if (options?.onProgress) {
                options.onProgress({ ...status })
              }
            } catch (e) {
              console.warn('解析Docker拉取进度信息失败:', e, line)
            }
          }
        }
      }

      // 处理最后可能剩余的数据
      if (receivedText.trim()) {
        try {
          const event = JSON.parse(receivedText)
          this._updatePullProgress(event, status, startTime, lastUpdate, lastDownloaded)

          if (options?.onProgress) {
            options.onProgress({ ...status })
          }
        } catch (e) {
          console.warn('解析最后的Docker拉取进度信息失败:', e)
        }
      }

      // 标记为完成
      status.completed = true
      if (options?.onProgress) {
        options.onProgress({ ...status })
      }

      // 调用完成回调
      if (options?.onComplete) {
        options.onComplete()
      }

      // 从活跃请求列表中移除
      this._activePullRequests.delete(requestId)

      return requestId
    } catch (error: any) {
      // 处理错误
      if (axios.isCancel(error)) {
        console.log('镜像拉取已取消:', imageName)
        status.error = '拉取操作已取消'
      } else {
        console.error('拉取镜像失败:', error)
        status.error = error.message || '拉取镜像失败'
      }

      status.completed = true

      // 调用进度回调（报告错误）
      if (options?.onProgress) {
        options.onProgress({ ...status })
      }

      // 调用错误回调
      if (options?.onError) {
        options.onError(error)
      }

      // 从活跃请求列表中移除
      this._activePullRequests.delete(requestId)

      throw error
    }
  }

  // 取消镜像拉取
  cancelPullImage(requestId: string): boolean {
    const request = this._activePullRequests.get(requestId)
    if (request) {
      request.cancelToken.cancel('用户取消了操作')
      this._activePullRequests.delete(requestId)
      return true
    }
    return false
  }

  // 更新拉取进度
  private _updatePullProgress(
    event: PullProgress,
    status: PullStatus,
    startTime: number,
    // 这两个参数在方法内部没有使用，但在调用时会传入
    // 它们用于在调用方更新速度计算
    _lastUpdate: number,
    _lastDownloaded: number,
  ): void {
    // 如果有错误，记录错误
    if (event.error) {
      status.error = event.error
      return
    }

    // 如果有层ID，更新该层的进度
    if (event.id) {
      // 更新或创建层信息
      status.layers[event.id] = {
        ...status.layers[event.id],
        ...event,
      }
    }

    // 计算总体进度
    let totalBytes = 0
    let downloadedBytes = 0
    let layerCount = 0
    let completedLayers = 0

    for (const layerId in status.layers) {
      const layer = status.layers[layerId]
      layerCount++

      // 如果层有详细进度信息
      if (layer.progressDetail) {
        if (layer.progressDetail.total) {
          totalBytes += layer.progressDetail.total
        }

        if (layer.progressDetail.current) {
          downloadedBytes += layer.progressDetail.current
        }
      }

      // 检查层是否完成
      if (
        layer.status === 'Download complete' ||
        layer.status === 'Pull complete' ||
        layer.status === 'Already exists'
      ) {
        completedLayers++
      }
    }

    // 更新总体进度
    status.overall.total = totalBytes
    status.overall.downloaded = downloadedBytes

    // 计算百分比
    if (totalBytes > 0) {
      status.overall.percent = Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
    } else if (layerCount > 0) {
      // 如果没有字节信息，使用完成的层数计算百分比
      status.overall.percent = Math.min(100, Math.round((completedLayers / layerCount) * 100))
    }

    // 计算下载速度
    const elapsed = (Date.now() - startTime) / 1000 // 秒
    if (elapsed > 0) {
      status.overall.speed = Math.round(downloadedBytes / elapsed)
    }
  }

  // 删除镜像
  async deleteImage(imageId: string, force = false): Promise<any> {
    try {
      const response = await axios.delete(`${configService.apiUrl}/images/${imageId}`, {
        params: { force },
      })
      return response.data
    } catch (error) {
      console.error('删除镜像失败:', error)
      throw error
    }
  }

  // 容器相关API

  // 获取所有容器
  async getContainers(all = true): Promise<DockerContainer[]> {
    try {
      const response = await axios.get(`${configService.apiUrl}/containers/json`, {
        params: { all },
      })
      return response.data
    } catch (error) {
      console.error('获取容器列表失败:', error)
      throw error
    }
  }

  // 获取容器详情
  async getContainerInfo(containerId: string): Promise<any> {
    try {
      const response = await axios.get(`${configService.apiUrl}/containers/${containerId}/json`)
      return response.data
    } catch (error) {
      console.error('获取容器详情失败:', error)
      throw error
    }
  }

  // 创建容器
  async createContainer(params: CreateContainerParams): Promise<any> {
    try {
      const { name, ...config } = params
      const queryParams = name ? { name } : {}

      const response = await axios.post(`${configService.apiUrl}/containers/create`, config, {
        params: queryParams,
      })
      return response.data
    } catch (error) {
      console.error('创建容器失败:', error)
      throw error
    }
  }

  // 启动容器
  async startContainer(containerId: string): Promise<void> {
    try {
      await axios.post(`${configService.apiUrl}/containers/${containerId}/start`)
    } catch (error) {
      console.error('启动容器失败:', error)
      throw error
    }
  }

  // 停止容器
  async stopContainer(containerId: string): Promise<void> {
    try {
      await axios.post(`${configService.apiUrl}/containers/${containerId}/stop`)
    } catch (error) {
      console.error('停止容器失败:', error)
      throw error
    }
  }

  // 重启容器
  async restartContainer(containerId: string): Promise<void> {
    try {
      await axios.post(`${configService.apiUrl}/containers/${containerId}/restart`)
    } catch (error) {
      console.error('重启容器失败:', error)
      throw error
    }
  }

  // 删除容器
  async deleteContainer(containerId: string, force = false): Promise<void> {
    try {
      await axios.delete(`${configService.apiUrl}/containers/${containerId}`, {
        params: { force },
      })
    } catch (error) {
      console.error('删除容器失败:', error)
      throw error
    }
  }

  // 获取容器日志
  async getContainerLogs(containerId: string, tail = 100): Promise<string> {
    try {
      const response = await axios.get(`${configService.apiUrl}/containers/${containerId}/logs`, {
        params: {
          stdout: true,
          stderr: true,
          tail: tail.toString(),
        },
        responseType: 'text',
      })
      return response.data
    } catch (error) {
      console.error('获取容器日志失败:', error)
      throw error
    }
  }

  // 测试Docker API连接
  async testConnection(): Promise<boolean> {
    try {
      await axios.get(`${configService.apiUrl}/version`)
      configService.setConnectionStatus('connected')
      return true
    } catch (error) {
      console.error('Docker API连接测试失败:', error)
      configService.setConnectionStatus('disconnected')
      return false
    }
  }
}

export default new DockerService()
