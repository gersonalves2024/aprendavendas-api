-- AlterTable
ALTER TABLE "PaymentLink" ADD COLUMN     "transactionId" INTEGER;

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "paymentType" TEXT NOT NULL,
    "installments" INTEGER NOT NULL DEFAULT 1,
    "paymentStatus" TEXT NOT NULL DEFAULT 'Pendente',
    "paymentDate" TIMESTAMP(3),
    "paymentForecastDate" TIMESTAMP(3),
    "createdById" INTEGER NOT NULL,
    "couponId" INTEGER,
    "discountAmount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionCourse" (
    "id" SERIAL NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "courseId" INTEGER NOT NULL,
    "courseModalityId" INTEGER NOT NULL,

    CONSTRAINT "TransactionCourse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransactionCourse_transactionId_courseId_courseModalityId_key" ON "TransactionCourse"("transactionId", "courseId", "courseModalityId");

-- AddForeignKey
ALTER TABLE "PaymentLink" ADD CONSTRAINT "PaymentLink_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionCourse" ADD CONSTRAINT "TransactionCourse_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionCourse" ADD CONSTRAINT "TransactionCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionCourse" ADD CONSTRAINT "TransactionCourse_courseModalityId_fkey" FOREIGN KEY ("courseModalityId") REFERENCES "CourseModality"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
