-- AlterTable
ALTER TABLE "pools" ADD COLUMN     "ai_degraded_mode" VARCHAR(30),
ADD COLUMN     "ai_degraded_since" TIMESTAMP(3),
ADD COLUMN     "ai_status" VARCHAR(20) NOT NULL DEFAULT 'healthy';
