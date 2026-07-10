import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { exec } from 'child_process'

const dbFilePath = path.resolve(__dirname, 'skh_database.json')

let gitSyncTimeout: any = null;
const triggerGitSync = () => {
  if (gitSyncTimeout) {
    clearTimeout(gitSyncTimeout);
  }
  // Debounce for 8 seconds to batch rapid saves
  gitSyncTimeout = setTimeout(() => {
    console.log('[Git Sync] Changes detected in database. Syncing to GitHub...');
    exec('git add skh_database.json && git commit -m "Auto-sync database update" && git push origin main && git push origin main:master', (err) => {
      if (err) {
        console.error('[Git Sync] Failed to sync database with GitHub:', err.message);
        return;
      }
      console.log('[Git Sync] Database successfully synced with GitHub! Vercel rebuild triggered.');
    });
  }, 8000);
};

// A custom Vite plugin to serve a simple central JSON database API
const localDbSyncPlugin = () => ({
  name: 'local-db-sync-api',
  configureServer(server: any) {
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url === '/api/db' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Access-Control-Allow-Origin', '*')
        if (fs.existsSync(dbFilePath)) {
          const data = fs.readFileSync(dbFilePath, 'utf-8')
          res.end(data)
        } else {
          res.end(JSON.stringify({}))
        }
      } else if (req.url === '/api/db' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: any) => {
          body += chunk
        })
        req.on('end', () => {
          try {
            fs.writeFileSync(dbFilePath, body, 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.end(JSON.stringify({ success: true }))
            
            // Trigger Git Auto-Sync
            triggerGitSync();
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Failed to write database file' }))
          }
        })
      } else {
        next()
      }
    })
  }
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localDbSyncPlugin()],
  base: './',
  server: {
    host: '0.0.0.0',
    allowedHosts: ['skh-billing.loca.lt', 'localtunnel.me', 'localhost'],
  },
})
