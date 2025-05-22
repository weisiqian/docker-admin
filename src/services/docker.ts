import axios from 'axios'
import type { DockerImage, DockerContainer, CreateContainerParams } from '@/types/docker'
import configService from './config'

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

  // 拉取镜像
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
