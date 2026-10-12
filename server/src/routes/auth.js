
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { upload, withCleanup } = require('../middleware/upload');
const { HttpError, asyncH } = require('../middleware/errors');

const router = express.Router();

const toUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  employeeCode: user.employeeCode,
  department: user.department,
  signatureUrl: user.signaturePath,
});

router.post('/login', asyncH(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    throw new HttpError(400, 'Email and password are required');
  }

  const user = await db.user.findUnique({
    where: { email },
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new HttpError(401, 'Invalid email or password');
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  res.json({ token, user: toUser(user) });
}));

router.get('/me', authenticate, asyncH(async (req, res) => {
  const user = await db.user.findUnique({
    where: { id: req.user.id },
  });

  if (!user) {
    throw new HttpError(401, 'User no longer exists');
  }

  res.json(toUser(user));
}));

router.post(
  '/signature',
  authenticate,
  upload.single('signature'),
  withCleanup(async (req, res) => {
    if (!req.file) {
      throw new HttpError(400, 'Signature image is required');
    }

    const user = await db.user.update({
      where: { id: req.user.id },
      data: { signaturePath: `/uploads/${req.file.filename}` },
    });

    res.json(toUser(user));
  })
);

module.exports = router;
