import { ref, watch } from 'vue';

// 本地存储键名
const DOCKER_API_URL_KEY = 'docker_api_url';

// 从环境变量获取默认URL，如果未定义则使用默认值
const DEFAULT_DOCKER_API_URL = import.meta.env.VITE_DOCKER_API_URL || '/docker-api';

/**
 * Docker配置服务
 * 管理Docker API URL的获取和存储
 */
class ConfigService {
  // 使用ref使其具有响应性，便于在组件中使用
  private _apiUrl = ref<string>('');
  private _connectionStatus = ref<'connected' | 'disconnected' | 'testing' | 'unknown'>('unknown');

  constructor() {
    this.loadApiUrl();
  }

  /**
   * 加载API URL
   * 优先级：本地存储 > 环境变量 > 默认值
   */
  private loadApiUrl(): void {
    // 从本地存储获取
    const savedUrl = localStorage.getItem(DOCKER_API_URL_KEY);
    
    if (savedUrl) {
      this._apiUrl.value = savedUrl;
    } else {
      this._apiUrl.value = DEFAULT_DOCKER_API_URL;
    }
  }

  /**
   * 保存API URL到本地存储
   * @param url Docker API URL
   */
  public saveApiUrl(url: string): void {
    if (!url) {
      throw new Error('Docker API URL不能为空');
    }
    
    localStorage.setItem(DOCKER_API_URL_KEY, url);
    this._apiUrl.value = url;
  }

  /**
   * 重置API URL为默认值
   */
  public resetApiUrl(): void {
    localStorage.removeItem(DOCKER_API_URL_KEY);
    this._apiUrl.value = DEFAULT_DOCKER_API_URL;
  }

  /**
   * 获取当前API URL
   */
  public get apiUrl(): string {
    return this._apiUrl.value;
  }

  /**
   * 获取API URL的响应式引用
   */
  public get apiUrlRef() {
    return this._apiUrl;
  }

  /**
   * 获取连接状态
   */
  public get connectionStatus() {
    return this._connectionStatus;
  }

  /**
   * 设置连接状态
   */
  public setConnectionStatus(status: 'connected' | 'disconnected' | 'testing' | 'unknown') {
    this._connectionStatus.value = status;
  }
}

// 导出单例实例
export default new ConfigService();
