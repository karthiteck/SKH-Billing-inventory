import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const dbFilePath = path.resolve(__dirname, 'skh_database.json')

// A custom Vite plugin to serve a simple local central JSON database API
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
