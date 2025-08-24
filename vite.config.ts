import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory
  const env = loadEnv(mode, process.cwd(), '');
  
  // Extract n8n base URL from the monthly statement webhook URL
  const n8nMonthlyUrl = env.VITE_N8N_QBO_API_MNTHLY_STMT || '';
  const n8nBaseUrl = n8nMonthlyUrl.split('/webhook')[0] || 'https://n8n-1-102-1-c1zi.onrender.com';

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    server: {
      port: 3000,
      proxy: {
        // Proxy n8n webhook requests to avoid CORS
        '/proxy/n8n': {
          target: n8nBaseUrl,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/proxy\/n8n/, '/webhook'),
        },
      },
    },
  };
});
