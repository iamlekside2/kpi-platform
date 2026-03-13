-- CreateTable
CREATE TABLE "Appraisal" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewPeriodFrom" TIMESTAMP(3) NOT NULL,
    "reviewPeriodTo" TIMESTAMP(3) NOT NULL,
    "selfAssessment" JSONB NOT NULL DEFAULT '{}',
    "selfRatings" JSONB NOT NULL DEFAULT '{}',
    "technicalAnswers" JSONB NOT NULL DEFAULT '{}',
    "unitHeadScores" JSONB NOT NULL DEFAULT '{}',
    "unitHeadComment" TEXT NOT NULL DEFAULT '',
    "adminComment" TEXT NOT NULL DEFAULT '',
    "mdComment" TEXT NOT NULL DEFAULT '',
    "employeeId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "orgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appraisal_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Appraisal" ADD CONSTRAINT "Appraisal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appraisal" ADD CONSTRAINT "Appraisal_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appraisal" ADD CONSTRAINT "Appraisal_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
