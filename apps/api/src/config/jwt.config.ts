import { requireJwtSecret } from '../common/config/require-jwt-secret'

export default () => ({ secret: requireJwtSecret() })
