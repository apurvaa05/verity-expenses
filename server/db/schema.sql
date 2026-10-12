
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

model User {
  id                Int       @id @default(autoincrement())
  name              String    @db.VarChar(100)
  email             String    @unique @db.VarChar(150)
  passwordHash      String    @map("password_hash") @db.Text
  role              String    @db.VarChar(20)
  employeeCode      String?   @map("employee_code") @db.VarChar(30)
  department        String?   @db.VarChar(100)
  signaturePath     String?   @map("signature_path") @db.Text
  createdAt         DateTime  @default(now()) @map("created_at") @db.DateTime(3)

  employeeVouchers  Voucher[] @relation("EmployeeVouchers")
  directedVouchers  Voucher[] @relation("DirectorVouchers")
  historyEntries    VoucherHistory[] @relation("HistoryActor")

  @@map("users")
}

model Voucher {
  id                    Int       @id @default(autoincrement())
  voucherNumber         String    @unique @map("voucher_number") @db.VarChar(30)
  userId                Int       @map("user_id")
  voucherDate           DateTime  @default(now()) @map("voucher_date") @db.Date
  expenseDate           DateTime  @map("expense_date") @db.Date
  department            String    @db.VarChar(100)
  title                 String    @db.VarChar(200)
  category              String    @default("Other") @db.VarChar(50)
  description           String?   @db.Text
  amount                Decimal   @db.Decimal(12, 2)
  status                String    @default("Draft") @db.VarChar(20)
  employeeSignaturePath String?   @map("employee_signature_path") @db.Text
  directorId            Int?      @map("director_id")
  directorSignaturePath String?   @map("director_signature_path") @db.Text
  approvalDate          DateTime? @map("approval_date") @db.DateTime(3)
  rejectionReason       String?   @map("rejection_reason") @db.Text
  submittedAt           DateTime? @map("submitted_at") @db.DateTime(3)
  createdAt             DateTime  @default(now()) @map("created_at") @db.DateTime(3)
  updatedAt             DateTime  @default(now()) @updatedAt @map("updated_at") @db.DateTime(3)

  employee              User      @relation("EmployeeVouchers", fields: [userId], references: [id])
  director              User?     @relation("DirectorVouchers", fields: [directorId], references: [id])
  history               VoucherHistory[]

  @@index([userId], map: "idx_vouchers_user")
  @@index([status], map: "idx_vouchers_status")
  @@index([expenseDate], map: "idx_vouchers_expense_date")
  @@map("vouchers")
}

model VoucherHistory {
  id         Int       @id @default(autoincrement())
  voucherId  Int       @map("voucher_id")
  fromStatus String?   @map("from_status") @db.VarChar(20)
  toStatus   String    @map("to_status") @db.VarChar(20)
  actorId    Int?      @map("actor_id")
  note       String?   @db.Text
  createdAt  DateTime  @default(now()) @map("created_at") @db.DateTime(3)

  voucher    Voucher   @relation(fields: [voucherId], references: [id], onDelete: Cascade)
  actor      User?     @relation("HistoryActor", fields: [actorId], references: [id])

  @@index([voucherId], map: "idx_history_voucher")
  @@map("voucher_history")
}
