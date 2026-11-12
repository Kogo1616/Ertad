import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: React on :5173, API calls proxied to ASP.NET Core on :5080 (same origin → cookies just work).
// Build: output goes into the API's wwwroot so one process serves everything.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The project lives in a OneDrive folder, where native file-change events are sometimes missed;
    // polling makes hot reload reliable there.
    watch: { usePolling: true, interval: 300 },
    proxy: {
      '/api': 'http://localhost:5080',
      '/uploads': 'http://localhost:5080',
    },
  },
  build: {
    outDir: '../backend/Ertad.Api/wwwroot',
    emptyOutDir: false, // keep wwwroot/uploads
  },
})
