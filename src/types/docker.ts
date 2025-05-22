// 定义Docker镜像类型
export interface DockerImage {
  Id: string;
  RepoTags: string[];
  Created: number;
  Size: number;
  VirtualSize: number;
  SharedSize: number;
  Labels: Record<string, string>;
  Containers: number;
}

// 定义Docker容器类型
export interface DockerContainer {
  Id: string;
  Names: string[];
  Image: string;
  ImageID: string;
  Command: string;
  Created: number;
  State: string;
  Status: string;
  Ports: Array<{
    IP?: string;
    PrivatePort: number;
    PublicPort?: number;
    Type: string;
  }>;
  Labels: Record<string, string>;
  SizeRw?: number;
  SizeRootFs?: number;
  HostConfig: {
    NetworkMode: string;
  };
  NetworkSettings: {
    Networks: Record<string, {
      IPAddress: string;
      Gateway: string;
      MacAddress: string;
    }>;
  };
  Mounts: Array<{
    Type: string;
    Source: string;
    Destination: string;
    Mode: string;
    RW: boolean;
    Propagation: string;
  }>;
}

// 定义创建容器的参数
export interface CreateContainerParams {
  name?: string;
  Image: string;
  Cmd?: string[];
  ExposedPorts?: Record<string, {}>;
  HostConfig?: {
    PortBindings?: Record<string, Array<{ HostPort: string }>>;
    Binds?: string[];
    RestartPolicy?: {
      Name: string;
      MaximumRetryCount?: number;
    };
  };
  Env?: string[];
  Labels?: Record<string, string>;
}
