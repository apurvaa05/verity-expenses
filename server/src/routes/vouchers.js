
const express = require('express');
const db = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { upload, withCleanup } = require('../middleware/upload');
const { HttpError, asyncH } = require('../middleware/errors');
const { CATEGORIES, DEPARTMENTS } = require('../constants');

const router = express.Router();
router.use(authenticate);

router.param('id', (req, res, next, value) =>
  /^\d+$/.test(value)
    ? next()
    : next(new HttpError(400, 'Invalid voucher id'))
);

const includeVoucher = {
  employee: {
    select: {
      name: true,
      employeeCode: true,
    },
  },
  director: {
    select: {
      name: true,
    },
  },
};

function toDto(v) {
  return {
    id: v.id,
    voucherNumber: v.voucherNumber,
    voucherDate: v.voucherDate,
    expenseDate: v.expenseDate,
    department: v.department,
    title: v.title,
    category: v.category,
    description: v.description,
    amount: Number(v.amount),
    status: v.status,
    employeeId: v.userId,
    employeeName: v.employee?.name,
    employeeCode: v.employee?.employeeCode,
    employeeSignature: v.employeeSignaturePath,
    directorName: v.director?.name || null,
    directorSignature: v.directorSignaturePath,
    approvalDate: v.approvalDate,
    rejectionReason: v.rejectionReason,
    submittedAt: v.submittedAt,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

async function loadVoucher(user, id) {
  const voucher = await db.voucher.findUnique({
    where: { id: Number(id) },
    include: includeVoucher,
  });

  const hidden =
    !voucher ||
    (user.role === 'EMPLOYEE' && voucher.userId !== user.id) ||
    (user.role !== 'EMPLOYEE' && voucher.status === 'Draft');

  if (hidden) {
    throw new HttpError(404, 'Voucher not found');
  }

  return voucher;
}

async function logHistory(voucherId, fromStatus, toStatus, actorId, note = null) {
  return db.voucherHistory.create({
    data: {
      voucherId,
      fromStatus,
      toStatus,
      actorId,
      note,
    },
  });
}

async function savedSignature(userId) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { signaturePath: true },
  });

  return user?.signaturePath || null;
}

function readFields(body) {
  const value = (input) =>
    input === undefined || input === null ? '' : String(input).trim();

  return {
    department: value(body.department),
    title: value(body.title),
    category: value(body.category) || 'Other',
    description: value(body.description) || null,
    expenseDate: value(body.expenseDate),
    amount: value(body.amount),
  };
}

function validateFields(fields) {
  const errors = {};

  if (!fields.department || !DEPARTMENTS.includes(fields.department)) {
    errors.department = 'Select a valid department';
  }

  if (!fields.title) {
    errors.title = 'Expense title is required';
  } else if (fields.title.length > 200) {
    errors.title = 'Expense title must be 200 characters or fewer';
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(fields.expenseDate) ||
    Number.isNaN(Date.parse(`${fields.expenseDate}T00:00:00Z`))
  ) {
    errors.expenseDate = 'A valid expense date is required';
  }

  if (!fields.amount) {
    errors.amount = 'Amount is required';
  } else if (
    !Number.isFinite(Number(fields.amount)) ||
    Number(fields.amount) <= 0
  ) {
    errors.amount = 'Amount must be greater than zero';
  } else if (Number(fields.amount) >= 1e10) {
    errors.amount = 'Amount is too large';
  }

  if (!CATEGORIES.includes(fields.category)) {
    errors.category = 'Invalid expense category';
  }

  if (Object.keys(errors).length) {
    throw new HttpError(400, 'Validation failed', errors);
  }
}

const isDate = (value) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

const SORTS = {
  voucherNumber: 'voucherNumber',
  employeeName: 'employee',
  expenseDate: 'expenseDate',
  amount: 'amount',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

router.get('/', asyncH(async (req, res) => {
  const q = req.query;
  const where = {};

  if (req.user.role === 'EMPLOYEE') {
    where.userId = req.user.id;
  } else {
    where.status = { not: 'Draft' };
  }

  const search = String(q.search || '').trim();

  if (search) {
    where.AND = [
      {
        OR: [
          { voucherNumber: { contains: search } },
          { title: { contains: search } },
          { employee: { name: { contains: search } } },
        ],
      },
    ];
  }

  if (q.department) where.department = String(q.department);
  if (q.category) where.category = String(q.category);
  if (q.status) where.status = String(q.status);

  if (q.dateFrom || q.dateTo) {
    where.expenseDate = {};

    if (q.dateFrom) {
      if (!isDate(q.dateFrom)) {
        throw new HttpError(400, 'Invalid dateFrom');
      }

      where.expenseDate.gte = new Date(`${q.dateFrom}T00:00:00.000Z`);
    }

    if (q.dateTo) {
      if (!isDate(q.dateTo)) {
        throw new HttpError(400, 'Invalid dateTo');
      }

      where.expenseDate.lte = new Date(`${q.dateTo}T00:00:00.000Z`);
    }
  }

  if (q.minAmount !== undefined && q.minAmount !== '') {
    if (!Number.isFinite(Number(q.minAmount))) {
      throw new HttpError(400, 'Invalid minAmount');
    }

    where.amount = { ...where.amount, gte: Number(q.minAmount) };
  }

  if (q.maxAmount !== undefined && q.maxAmount !== '') {
    if (!Number.isFinite(Number(q.maxAmount))) {
      throw new HttpError(400, 'Invalid maxAmount');
    }

    where.amount = { ...where.amount, lte: Number(q.maxAmount) };
  }

  const sortBy = SORTS[q.sortBy] || 'createdAt';
  const order = String(q.order).toLowerCase() === 'asc' ? 'asc' : 'desc';
  const limit = Math.min(Math.max(parseInt(q.limit, 10) || 10, 1), 50);
  const page = Math.max(parseInt(q.page, 10) || 1, 1);

  const orderBy = sortBy === 'employee'
    ? { employee: { name: order } }
    : { [sortBy]: order };

  const [total, vouchers] = await Promise.all([
    db.voucher.count({ where }),
    db.voucher.findMany({
      where,
      include: includeVoucher,
      orderBy: [orderBy, { id: 'desc' }],
      take: limit,
      skip: (page - 1) * limit,
    }),
  ]);

  res.json({
    data: vouchers.map(toDto),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  });
}));

router.get('/:id', asyncH(async (req, res) => {
  const voucher = await loadVoucher(req.user, req.params.id);

  const history = await db.voucherHistory.findMany({
    where: { voucherId: voucher.id },
    include: {
      actor: { select: { name: true } },
    },
    orderBy: { id: 'asc' },
  });

  res.json({
    ...toDto(voucher),
    history: history.map((entry) => ({
      id: entry.id,
      from: entry.fromStatus,
      to: entry.toStatus,
      note: entry.note,
      actor: entry.actor?.name || null,
      at: entry.createdAt,
    })),
  });
}));

router.post(
  '/',
  authorize('EMPLOYEE'),
  upload.single('employeeSignature'),
  withCleanup(async (req, res) => {
    const fields = readFields(req.body);
    validateFields(fields);

    const signature = req.file
      ? `/uploads/${req.file.filename}`
      : await savedSignature(req.user.id);

    const voucher = await db.$transaction(async (tx) => {
      const last = await tx.voucher.findFirst({
        where: {
          voucherNumber: {
            startsWith: `EV-${new Date().getFullYear()}-`,
          },
        },
        orderBy: { id: 'desc' },
        select: { voucherNumber: true },
      });

      const lastNumber = last
        ? Number(last.voucherNumber.split('-').pop()) || 0
        : 0;

      const voucherNumber =
        `EV-${new Date().getFullYear()}-${String(lastNumber + 1).padStart(5, '0')}`;

      const created = await tx.voucher.create({
        data: {
          voucherNumber,
          userId: req.user.id,
          expenseDate: new Date(`${fields.expenseDate}T00:00:00.000Z`),
          department: fields.department,
          title: fields.title,
          category: fields.category,
          description: fields.description,
          amount: fields.amount,
          employeeSignaturePath: signature,
        },
      });

      await tx.voucherHistory.create({
        data: {
          voucherId: created.id,
          fromStatus: null,
          toStatus: 'Draft',
          actorId: req.user.id,
          note: 'Voucher created',
        },
      });

      return created;
    });

    res.status(201).json(await loadVoucher(req.user, voucher.id));
  })
);

router.put(
  '/:id',
  authorize('EMPLOYEE'),
  upload.single('employeeSignature'),
  withCleanup(async (req, res) => {
    const voucher = await loadVoucher(req.user, req.params.id);

    if (voucher.status !== 'Draft') {
      throw new HttpError(409, 'Only Draft vouchers can be edited');
    }

    const fields = readFields(req.body);
    validateFields(fields);

    const signature = req.file
      ? `/uploads/${req.file.filename}`
      : voucher.employeeSignaturePath || await savedSignature(req.user.id);

    const result = await db.voucher.updateMany({
      where: { id: voucher.id, status: 'Draft' },
      data: {
        expenseDate: new Date(`${fields.expenseDate}T00:00:00.000Z`),
        department: fields.department,
        title: fields.title,
        category: fields.category,
        description: fields.description,
        amount: fields.amount,
        employeeSignaturePath: signature,
      },
    });

    if (!result.count) {
      throw new HttpError(409, 'Only Draft vouchers can be edited');
    }

    res.json(await loadVoucher(req.user, voucher.id));
  })
);

router.delete('/:id', authorize('EMPLOYEE'), asyncH(async (req, res) => {
  const voucher = await loadVoucher(req.user, req.params.id);

  if (voucher.status !== 'Draft') {
    throw new HttpError(409, 'Only Draft vouchers can be deleted');
  }

  await db.voucher.deleteMany({
    where: { id: voucher.id, status: 'Draft' },
  });

  res.status(204).end();
}));

router.post('/:id/submit', authorize('EMPLOYEE'), asyncH(async (req, res) => {
  const voucher = await loadVoucher(req.user, req.params.id);

  if (voucher.status !== 'Draft') {
    throw new HttpError(409, 'Only Draft vouchers can be submitted');
  }

  if (!voucher.employeeSignaturePath) {
    throw new HttpError(400, 'Employee signature is required before submission', {
      employeeSignature: 'Employee signature is required before submission',
    });
  }

  await db.$transaction(async (tx) => {
    const result = await tx.voucher.updateMany({
      where: { id: voucher.id, status: 'Draft' },
      data: {
        status: 'Pending Approval',
        submittedAt: new Date(),
      },
    });

    if (!result.count) {
      throw new HttpError(409, 'Voucher was already submitted');
    }

    await tx.voucherHistory.createMany({
      data: [
        {
          voucherId: voucher.id,
          fromStatus: 'Draft',
          toStatus: 'Submitted',
          actorId: req.user.id,
          note: 'Submitted by employee',
        },
        {
          voucherId: voucher.id,
          fromStatus: 'Submitted',
          toStatus: 'Pending Approval',
          actorId: req.user.id,
          note: 'Awaiting Director approval',
        },
      ],
    });
  });

  res.json(await loadVoucher(req.user, voucher.id));
}));

router.post(
  '/:id/approve',
  authorize('DIRECTOR'),
  upload.single('signature'),
  withCleanup(async (req, res) => {
    const voucher = await loadVoucher(req.user, req.params.id);

    if (voucher.status !== 'Pending Approval') {
      throw new HttpError(409, 'Only vouchers pending approval can be approved');
    }

    const signature = req.file
      ? `/uploads/${req.file.filename}`
      : await savedSignature(req.user.id);

    if (!signature) {
      throw new HttpError(400, 'Director signature is required before approval', {
        signature: 'Director signature is required before approval',
      });
    }

    await db.$transaction(async (tx) => {
      const result = await tx.voucher.updateMany({
        where: { id: voucher.id, status: 'Pending Approval' },
        data: {
          status: 'Approved',
          directorId: req.user.id,
          directorSignaturePath: signature,
          approvalDate: new Date(),
        },
      });

      if (!result.count) {
        throw new HttpError(409, 'Voucher was already processed');
      }

      await tx.voucherHistory.create({
        data: {
          voucherId: voucher.id,
          fromStatus: 'Pending Approval',
          toStatus: 'Approved',
          actorId: req.user.id,
          note: 'Approved by Director',
        },
      });
    });

    res.json(await loadVoucher(req.user, voucher.id));
  })
);

router.post('/:id/reject', authorize('DIRECTOR'), asyncH(async (req, res) => {
  const reason = String(req.body.reason || '').trim();

  if (!reason) {
    throw new HttpError(400, 'Rejection reason is required', {
      reason: 'Rejection reason is required',
    });
  }

  const voucher = await loadVoucher(req.user, req.params.id);

  if (voucher.status !== 'Pending Approval') {
    throw new HttpError(409, 'Only vouchers pending approval can be rejected');
  }

  await db.$transaction(async (tx) => {
    const result = await tx.voucher.updateMany({
      where: { id: voucher.id, status: 'Pending Approval' },
      data: {
        status: 'Rejected',
        directorId: req.user.id,
        rejectionReason: reason,
      },
    });

    if (!result.count) {
      throw new HttpError(409, 'Voucher was already processed');
    }

    await tx.voucherHistory.create({
      data: {
        voucherId: voucher.id,
        fromStatus: 'Pending Approval',
        toStatus: 'Rejected',
        actorId: req.user.id,
        note: reason,
      },
    });
  });

  res.json(await loadVoucher(req.user, voucher.id));
}));

module.exports = router;
