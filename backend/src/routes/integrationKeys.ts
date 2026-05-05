import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { workspaceContextMiddleware } from '../middleware/workspaceContext';
import { authz } from '../middleware/authz';
import {
  getIntegrationKeyController,
  generateIntegrationKeyController,
  revokeIntegrationKeyController,
} from '../controllers/integrationKeyController';

const router = Router();

router.use(authMiddleware);
router.use(workspaceContextMiddleware);

// GET /api/integrations/keys — returns key metadata (never the plaintext)
router.get('/', authz('workspace:read'), getIntegrationKeyController);

// POST /api/integrations/keys/generate — creates or rotates key
router.post('/generate', authz('workspace:billing'), generateIntegrationKeyController);

// DELETE /api/integrations/keys — revokes current key
router.delete('/', authz('workspace:billing'), revokeIntegrationKeyController);

export default router;
