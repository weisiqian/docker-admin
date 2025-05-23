// 为Vue 3扩展声明defineOptions函数
declare function defineOptions(options: Record<string, any>): void;

// 为Window对象扩展monacoConfigured属性
interface Window {
  monacoConfigured?: boolean;
}
