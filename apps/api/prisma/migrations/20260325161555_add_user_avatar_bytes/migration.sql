-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_data" BYTEA,
ADD COLUMN     "avatar_mime" TEXT,
ADD COLUMN     "avatar_updated_at" TIMESTAMP(3);
