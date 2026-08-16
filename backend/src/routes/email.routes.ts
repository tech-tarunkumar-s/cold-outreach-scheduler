import { Router } from 'express';
import { emailController } from '../controllers/email.controller';

const router = Router();

router.post('/schedule', (req, res) => emailController.scheduleEmails(req, res));
router.get('/scheduled', (req, res) => emailController.getScheduledEmails(req, res));
router.get('/sent', (req, res) => emailController.getSentEmails(req, res));
router.get('/stats', (req, res) => emailController.getDashboardStats(req, res));
router.delete('/:id', (req, res) => emailController.cancelEmail(req, res));

export default router;
