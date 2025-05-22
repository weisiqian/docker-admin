import { defineStore } from 'pinia'
import dockerService from '@/services/docker'
import type { DockerImage, DockerContainer, CreateContainerParams } from '@/types/docker'

interface DockerState {
  images: DockerImage[]
  containers: DockerContainer[]
  searchResults: any[]
  selectedContainer: any | null
  containerLogs: string
  loading: {
    images: boolean
    containers: boolean
    search: boolean
    containerInfo: boolean
    logs: boolean
    operation: boolean
  }
  error: string | null
}

export const useDockerStore = defineStore('docker', {
  state: (): DockerState => ({
    images: [],
    containers: [],
    searchResults: [],
    selectedContainer: null,
    containerLogs: '',
    loading: {
      images: false,
      containers: false,
      search: false,
      containerInfo: false,
      logs: false,
      operation: false,
    },
    error: null,
  }),

  actions: {
    // 重置错误
    resetError() {
      this.error = null
    },

    // 镜像相关操作
    async fetchImages() {
      this.loading.images = true
      this.error = null
      try {
        this.images = await dockerService.getImages()
      } catch (error: any) {
        this.error = `获取镜像失败: ${error.message}`
        console.error(error)
      } finally {
        this.loading.images = false
      }
    },

    async searchImages(term: string) {
      if (!term.trim()) {
        this.searchResults = []
        return
      }

      this.loading.search = true
      this.error = null
      try {
        this.searchResults = await dockerService.searchImages(term)
      } catch (error: any) {
        this.error = `搜索镜像失败: ${error.message}`
        console.error(error)
      } finally {
        this.loading.search = false
      }
    },

    async pullImage(imageName: string) {
      this.loading.operation = true
      this.error = null
      try {
        await dockerService.pullImage(imageName)
        // 拉取完成后刷新镜像列表
        await this.fetchImages()
      } catch (error: any) {
        this.error = `拉取镜像失败: ${error.message}`
        console.error(error)
      } finally {
        this.loading.operation = false
      }
    },

    async deleteImage(imageId: string, force = false) {
      this.loading.operation = true
      this.error = null
      try {
        await dockerService.deleteImage(imageId, force)
        // 删除完成后刷新镜像列表
        await this.fetchImages()
      } catch (error: any) {
        this.error = `删除镜像失败: ${error.message}`
        console.error(error)
      } finally {
        this.loading.operation = false
      }
    },

    // 容器相关操作
    async fetchContainers() {
      this.loading.containers = true
      this.error = null
      try {
        this.containers = await dockerService.getContainers(true)
      } catch (error: any) {
        this.error = `获取容器失败: ${error.message}`
        console.error(error)
      } finally {
        this.loading.containers = false
      }
    },

    async getContainerInfo(containerId: string) {
      this.loading.containerInfo = true
      this.error = null
      try {
        this.selectedContainer = await dockerService.getContainerInfo(containerId)
      } catch (error: any) {
        this.error = `获取容器详情失败: ${error.message}`
        console.error(error)
      } finally {
        this.loading.containerInfo = false
      }
    },

    async createAndStartContainer(params: CreateContainerParams) {
      this.loading.operation = true
      this.error = null
      try {
        const result = await dockerService.createContainer(params)
        await dockerService.startContainer(result.Id)
        // 创建完成后刷新容器列表
        await this.fetchContainers()
      } catch (error: any) {
        this.error = `创建并启动容器失败: ${error.message}`
        console.error(error)
      } finally {
        this.loading.operation = false
      }
    },

    async startContainer(containerId: string) {
      this.loading.operation = true
      this.error = null
      try {
        await dockerService.startContainer(containerId)
        // 操作完成后刷新容器列表
        await this.fetchContainers()
      } catch (error: any) {
        this.error = `启动容器失败: ${error.message}`
        console.error(error)
      } finally {
        this.loading.operation = false
      }
    },

    async stopContainer(containerId: string) {
      this.loading.operation = true
      this.error = null
      try {
        await dockerService.stopContainer(containerId)
        // 操作完成后刷新容器列表
        await this.fetchContainers()
      } catch (error: any) {
        this.error = `停止容器失败: ${error.message}`
        console.error(error)
      } finally {
        this.loading.operation = false
      }
    },

    async restartContainer(containerId: string) {
      this.loading.operation = true
      this.error = null
      try {
        await dockerService.restartContainer(containerId)
        // 操作完成后刷新容器列表
        await this.fetchContainers()
      } catch (error: any) {
        this.error = `重启容器失败: ${error.message}`
        console.error(error)
      } finally {
        this.loading.operation = false
      }
    },

    async deleteContainer(containerId: string, force = false) {
      this.loading.operation = true
      this.error = null
      try {
        await dockerService.deleteContainer(containerId, force)
        // 操作完成后刷新容器列表
        await this.fetchContainers()
      } catch (error: any) {
        this.error = `删除容器失败: ${error.message}`
        console.error(error)
      } finally {
        this.loading.operation = false
      }
    },

    async getContainerLogs(containerId: string, tail = 100) {
      this.loading.logs = true
      this.error = null
      try {
        this.containerLogs = await dockerService.getContainerLogs(containerId, tail)
      } catch (error: any) {
        this.error = `获取容器日志失败: ${error.message}`
        console.error(error)
      } finally {
        this.loading.logs = false
      }
    },
  },
})
