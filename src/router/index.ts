import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/docker',
    },
    {
      path: '/home',
      name: 'Home',
      component: () => import('@/views/Home.vue'),
    },
    {
      path: '/docker',
      name: 'Docker',
      component: () => import('@/views/docker/DockerManager.vue'),
      children: [
        {
          path: '',
          name: 'DockerDefault',
          redirect: '/docker/images',
        },
        {
          path: 'images',
          name: 'DockerImages',
          component: () => import('@/views/docker/DockerImages.vue'),
        },
        {
          path: 'containers',
          name: 'DockerContainers',
          component: () => import('@/views/docker/DockerContainers.vue'),
        },
        {
          path: 'container/:id',
          name: 'ContainerDetail',
          component: () => import('@/views/docker/ContainerDetail.vue'),
          props: true,
        },
        {
          path: 'config',
          name: 'DockerConfig',
          component: () => import('@/views/docker/DockerConfig.vue'),
        },
      ],
    },
  ],
})

export default router
