
const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { asyncH } = require('../middleware/errors');

const router = express.Router();
router.use(authenticate);

router.get('/', asyncH(async (req, res) => {
  const { id, role } = req.user;

  if (role === 'EMPLOYEE') {
    const [total, drafts, pending, approved, rejected, claimed, recent] =
      await Promise.all([
        db.voucher.count({ where: { userId: id } }),
        db.voucher.count({ where: { userId: id, status: 'Draft' } }),
        db.voucher.count({ where: { userId: id, status: 'Pending Approval' } }),
        db.voucher.count({ where: { userId: id, status: 'Approved' } }),
        db.voucher.count({ where: { userId: id, status: 'Rejected' } }),
        db.voucher.aggregate({
          where: { userId: id, status: { not: 'Draft' } },
          _sum: { amount: true },
        }),
        db.voucher.findMany({
          where: { userId: id },
          orderBy: { updatedAt: 'desc' },
          take: 5,
          select: {
            id: true,
            voucherNumber: true,
            title: true,
            amount: true,
            status: true,
            updatedAt: true,
          },
        }),
      ]);

    return res.json({
      role,
      stats: {
        total,
        drafts,
        pending,
        approved,
        rejected,
        total_claimed: Number(claimed._sum.amount || 0),
      },
      recent: recent.map((v) => ({
        voucherId: v.id,
        voucherNumber: v.voucherNumber,
        title: v.title,
        amount: Number(v.amount),
        label: v.status,
        at: v.updatedAt,
      })),
    });
  }

  if (role === 'DIRECTOR') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [pendingCount, pendingAmount, approvedToday, rejectedToday, recent] =
      await Promise.all([
        db.voucher.count({ where: { status: 'Pending Approval' } }),
        db.voucher.aggregate({
          where: { status: 'Pending Approval' },
          _sum: { amount: true },
        }),
        db.voucherHistory.count({
          where: {
            toStatus: 'Approved',
            createdAt: { gte: today, lt: tomorrow },
          },
        }),
        db.voucherHistory.count({
          where: {
            toStatus: 'Rejected',
            createdAt: { gte: today, lt: tomorrow },
          },
        }),
        db.voucherHistory.findMany({
          where: {
            toStatus: { in: ['Pending Approval', 'Approved', 'Rejected'] },
          },
          orderBy: { id: 'desc' },
          take: 8,
          include: {
            voucher: {
              select: {
                id: true,
                voucherNumber: true,
                title: true,
                amount: true,
              },
            },
            actor: { select: { name: true } },
          },
        }),
      ]);

    return res.json({
      role,
      stats: {
        pending_count: pendingCount,
        pending_amount: Number(pendingAmount._sum.amount || 0),
        approved_today: approvedToday,
        rejected_today: rejectedToday,
      },
      recent: recent.map((h) => ({
        voucherId: h.voucher.id,
        voucherNumber: h.voucher.voucherNumber,
        title: h.voucher.title,
        amount: Number(h.voucher.amount),
        label: h.toStatus === 'Pending Approval'
          ? 'Submitted for approval'
          : h.toStatus,
        by: h.actor?.name || null,
        at: h.createdAt,
      })),
    });
  }

  const [total, pending, approved, rejected, approvedAmount, recent] =
    await Promise.all([
      db.voucher.count({ where: { status: { not: 'Draft' } } }),
      db.voucher.count({ where: { status: 'Pending Approval' } }),
      db.voucher.count({ where: { status: 'Approved' } }),
      db.voucher.count({ where: { status: 'Rejected' } }),
      db.voucher.aggregate({
        where: { status: 'Approved' },
        _sum: { amount: true },
      }),
      db.voucher.findMany({
        where: { status: 'Approved' },
        orderBy: { approvalDate: 'desc' },
        take: 8,
        include: { employee: { select: { name: true } } },
      }),
    ]);

  res.json({
    role,
    stats: {
      total,
      pending,
      approved,
      rejected,
      approved_amount: Number(approvedAmount._sum.amount || 0),
    },
    recent: recent.map((v) => ({
      voucherId: v.id,
      voucherNumber: v.voucherNumber,
      title: v.title,
      amount: Number(v.amount),
      label: 'Approved',
      by: v.employee.name,
      at: v.approvalDate,
    })),
  });
}));

module.exports = router;
