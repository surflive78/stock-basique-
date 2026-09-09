import { createServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import envoyerCommande from './api/envoyer-commande.js'

const distDir = fileURLToPath(new URL('./dist/', import.meta.url))
const port = Number(process.env.PORT || 10000)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

function securityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()')
  response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
}

function json(response, status, payload) {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(payload))
}

function responseAdapter(response) {
  return {
    setHeader(name, value) {
      response.setHeader(name, value)
      return this
    },
    status(statusCode) {
      response.statusCode = statusCode
      return this
    },
    json(payload) {
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.end(JSON.stringify(payload))
      return this
    },
  }
}

async function readBody(request) {
  return await new Promise((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > 1_000_000) {
        reject(new Error('Payload too large'))
        request.destroy()
      }
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

async function serveFile(response, filePath, headOnly = false) {
  try {
    const info = await stat(filePath)
    if (!info.isFile()) return false
    response.statusCode = 200
    response.setHeader('Content-Type', MIME[extname(filePath).toLowerCase()] || 'application/octet-stream')
    if (filePath.includes(`${join('dist', 'assets')}`)) {
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    } else {
      response.setHeader('Cache-Control', 'no-cache')
    }
    if (headOnly) {
      response.end()
    } else {
      createReadStream(filePath).pipe(response)
    }
    return true
  } catch {
    return false
  }
}

const server = createServer(async (request, response) => {
  securityHeaders(response)

  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  const pathname = decodeURIComponent(url.pathname)

  if (pathname === '/healthz') {
    return json(response, 200, { ok: true, platform: 'render' })
  }

  if (pathname === '/api/envoyer-commande') {
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST')
      return json(response, 405, { error: 'Méthode non autorisée.' })
    }
    try {
      request.body = await readBody(request)
      return await envoyerCommande(request, responseAdapter(response))
    } catch {
      return json(response, 400, { error: 'Contenu de la requête invalide.' })
    }
  }

  if (!['GET', 'HEAD'].includes(request.method || '')) {
    return json(response, 405, { error: 'Méthode non autorisée.' })
  }

  const relative = pathname === '/' ? 'index.html' : pathname.slice(1)
  const normalized = normalize(relative).replace(/^(\.\.(\/|\\|$))+/, '')
  const requestedFile = join(distDir, normalized)

  if (await serveFile(response, requestedFile, request.method === 'HEAD')) return

  // React/Vite SPA fallback. Les vraies ressources manquantes restent en 404.
  if (!extname(pathname)) {
    if (await serveFile(response, join(distDir, 'index.html'), request.method === 'HEAD')) return
  }

  return json(response, 404, { error: 'Ressource introuvable.' })
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Suivi de stock — Render server listening on port ${port}`)
})
