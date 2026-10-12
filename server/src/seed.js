
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

const USERS = [
  {
    name: 'Dinesh Rao',
    email: 'director@pspl.com',
    password: 'Director@4826',
    role: 'DIRECTOR',
    employeeCode: 'DIR001',
    department: 'Admin',
  },
  {
    name: 'Asha Menon',
    email: 'accounts@pspl.com',
    password: 'Accounts@5739',
    role: 'ACCOUNTS',
    employeeCode: 'ACC001',
    department: 'Finance',
  },
  {
    name: 'Rahul Verma',
    email: 'employee1@pspl.com',
    password: 'Employee@6842',
    role: 'EMPLOYEE',
    employeeCode: 'EMP001',
    department: 'Engineering',
  },
  {
    name: 'Priya Nair',
    email: 'employee2@pspl.com',
    password: 'Employee@7953',
    role: 'EMPLOYEE',
    employeeCode: 'EMP002',
    department: 'Marketing',
  },
];

async function seed() {
  await db.$connect();

  for (const user of USERS) {
    const passwordHash = await bcrypt.hash(user.password, 12);

    await db.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        passwordHash,
        role: user.role,
        employeeCode: user.employeeCode,
        department: user.department,
      },
      create: {
        name: user.name,
        email: user.email,
        passwordHash,
        role: user.role,
        employeeCode: user.employeeCode,
        department: user.department,
      },
    });
  }

  console.log('Demo users created or updated successfully.');
}

seed()
  .catch((error) => {
    console.error('Seeding failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
