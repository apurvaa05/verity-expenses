
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient();

async function migrate() {
  try {
    await db.$connect();
    await db.$executeRawUnsafe('SELECT 1');
    console.log('MySQL connection successful.');
    console.log('Database connection is ready.');
  } finally {
    await db.$disconnect();
  }
}

migrate().catch((error) => {
  console.error('Database connection failed:', error.message);
  process.exitCode = 1;
});
