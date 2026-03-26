-- AlterTable
ALTER TABLE "pools" ADD COLUMN     "questions_since_merge" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_question_merge_at" TIMESTAMP(3);
