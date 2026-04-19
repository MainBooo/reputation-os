const jwt = require('jsonwebtoken')

const token = jwt.sign(
  {
    sub: process.argv[2],
    email: process.argv[3]
  },
  process.env.JWT_SECRET || 'dev-secret',
  { expiresIn: '7d' }
)

console.log(token)
