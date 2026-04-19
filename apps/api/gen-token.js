const crypto = require('crypto')

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

const userId = process.argv[2]
const email = process.argv[3]
const secret = process.argv[4]

if (!userId || !email || !secret) {
  console.error('Usage: node gen-token.js <userId> <email> <jwtSecret>')
  process.exit(1)
}

const now = Math.floor(Date.now() / 1000)
const header = {
  alg: 'HS256',
  typ: 'JWT'
}

const payload = {
  sub: userId,
  email,
  iat: now,
  exp: now + 7 * 24 * 60 * 60
}

const encodedHeader = base64url(JSON.stringify(header))
const encodedPayload = base64url(JSON.stringify(payload))
const data = `${encodedHeader}.${encodedPayload}`

const signature = crypto
  .createHmac('sha256', secret)
  .update(data)
  .digest('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')

console.log(`${data}.${signature}`)
