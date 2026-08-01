-- AlterTable
ALTER TABLE "Resource" ADD COLUMN "team" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "UiState" ADD COLUMN "filterResourceTeam" TEXT NOT NULL DEFAULT '';
