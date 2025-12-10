import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isElectron = env.BUILD_TARGET === 'electron' || env.VITE_ELECTRON === 'true';
  return {
      base: isElectron ? './' : '/',
      server: {
        port: 3001,
        host: '0.0.0.0',
        hmr: {
          host: 'localhost',
          protocol: 'ws',
        },
        proxy: {
          '/proxy-whatai': {
            target: env.WHATAI_BASE_URL || 'https://api.whatai.cc',
            changeOrigin: true,
            secure: true,
            rewrite: (path) => path.replace(/^\/proxy-whatai/, ''),
            configure: (proxy) => {
              proxy.on('proxyReq', (proxyReq, req) => {
                const existingAuth = proxyReq.getHeader('Authorization') || req.headers['authorization'];
                if (!existingAuth) {
                  const key = env.WHATAI_API_KEY;
                  if (key) {
                    proxyReq.setHeader('Authorization', `Bearer ${key}`);
                  }
                }
                if (!proxyReq.getHeader('Accept')) {
                  proxyReq.setHeader('Accept', 'application/json');
                }
                // 不强制设置Content-Type，让客户端代码自己设置
              });
              proxy.on('proxyRes', (proxyRes) => {
                const location = proxyRes.headers['location'];
                if (typeof location === 'string' && location.startsWith('/')) {
                  proxyRes.headers['location'] = `/proxy-whatai${location}`;
                }
              });
            },
          }
          ,
          '/proxy-grsai': {
            target: env.GRSAI_BASE_URL || 'https://grsai.dakka.com.cn',
            changeOrigin: true,
            secure: true,
            rewrite: (path) => {
              const p = path.replace(/^\/proxy-grsai/, '')
              return p.replace(/^\/zh\//, '/').replace(/^\/zh/, '')
            },
            configure: (proxy) => {
              proxy.on('proxyReq', (proxyReq, req) => {
                const existingAuth = proxyReq.getHeader('Authorization') || req.headers['authorization'];
                if (!existingAuth) {
                  const key = env.GRSAI_API_KEY;
                  if (key) {
                    proxyReq.setHeader('Authorization', `Bearer ${key}`);
                  }
                }
                if (!proxyReq.getHeader('Accept')) {
                  proxyReq.setHeader('Accept', 'application/json');
                }
                if (!proxyReq.getHeader('Accept-Language')) {
                  proxyReq.setHeader('Accept-Language', 'en;q=0.8,zh;q=0.7');
                }
              });
              proxy.on('proxyRes', (proxyRes) => {
                const location = proxyRes.headers['location'];
                if (typeof location === 'string') {
                  let pathname = location
                  try {
                    if (/^https?:\/\//i.test(location)) {
                      const u = new URL(location)
                      pathname = `${u.pathname}${u.search || ''}`
                    }
                  } catch { /* ignore */ }
                  const normalized = pathname.replace(/^\/zh\//, '/').replace(/^\/zh/, '')
                  proxyRes.headers['location'] = `/proxy-grsai${normalized}`;
                }
              });
            },
          },
          '/zh/v1': {
            target: env.GRSAI_BASE_URL || 'https://grsai.dakka.com.cn',
            changeOrigin: true,
            secure: true,
            rewrite: (path) => path.replace(/^\/zh/, ''),
            configure: (proxy) => {
              proxy.on('proxyReq', (proxyReq, req) => {
                const existingAuth = proxyReq.getHeader('Authorization') || req.headers['authorization'];
                if (!existingAuth) {
                  const key = env.GRSAI_API_KEY;
                  if (key) {
                    proxyReq.setHeader('Authorization', `Bearer ${key}`);
                  }
                }
                if (!proxyReq.getHeader('Accept')) {
                  proxyReq.setHeader('Accept', 'application/json');
                }
                if (!proxyReq.getHeader('Accept-Language')) {
                  proxyReq.setHeader('Accept-Language', 'en;q=0.8,zh;q=0.7');
                }
              });
              proxy.on('proxyRes', (proxyRes) => {
                const location = proxyRes.headers['location'];
                if (typeof location === 'string') {
                  let pathname = location
                  try {
                    if (/^https?:\/\//i.test(location)) {
                      const u = new URL(location)
                      pathname = `${u.pathname}${u.search || ''}`
                    }
                  } catch { /* ignore */ }
                  const normalized = pathname.replace(/^\/zh\//, '/').replace(/^\/zh/, '')
                  proxyRes.headers['location'] = `/proxy-grsai${normalized}`;
                }
              });
            },
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.WHATAI_BASE_URL': JSON.stringify(env.WHATAI_BASE_URL || 'https://api.whatai.cc'),
        'process.env.WHATAI_API_KEY': JSON.stringify(env.WHATAI_API_KEY),
        'process.env.WHATAI_TEXT_MODEL': JSON.stringify(env.WHATAI_TEXT_MODEL || 'gemini-2.0-flash-exp'),
        'process.env.WHATAI_IMAGE_MODEL': JSON.stringify(env.WHATAI_IMAGE_MODEL || 'gemini-2.5-flash-image'),
        'process.env.WHATAI_IMAGE_GENERATION_MODEL': JSON.stringify(env.WHATAI_IMAGE_GENERATION_MODEL || env.WHATAI_IMAGE_MODEL || 'gemini-2.5-flash-image'),
        'process.env.WHATAI_IMAGE_EDIT_MODEL': JSON.stringify(env.WHATAI_IMAGE_EDIT_MODEL || env.WHATAI_IMAGE_MODEL || 'gemini-2.5-flash-image'),
        'process.env.WHATAI_VIDEO_MODEL': JSON.stringify(env.WHATAI_VIDEO_MODEL || 'vidu-1'),
        'process.env.PROXY_VIA_VITE': JSON.stringify(isElectron ? 'false' : (env.PROXY_VIA_VITE || 'true')),
        'process.env.GRSAI_BASE_URL': JSON.stringify(env.GRSAI_BASE_URL || 'https://grsai.dakka.com.cn'),
        'process.env.GRSAI_API_KEY': JSON.stringify(env.GRSAI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
        }
      }
    };
});
