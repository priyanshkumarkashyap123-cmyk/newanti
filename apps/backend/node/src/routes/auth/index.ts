import { Router } from 'express';
import loginRouter from './login.js';
import signupRouter from './signup.js';
import refreshRouter from './refresh.js';
import profileRouter from './profile.js';
import passwordRouter from './password.js';
import verifyRouter from './verify.js';
import deleteRouter from './deleteAccount.js';

const router: Router = Router();

router.use('/signin', loginRouter);
router.use('/signup', signupRouter);
router.use('/refresh', refreshRouter);
router.use('/profile', profileRouter);
router.use('/password', passwordRouter);
router.use('/verify-email', verifyRouter);
router.use('/delete-account', deleteRouter);

export default router;