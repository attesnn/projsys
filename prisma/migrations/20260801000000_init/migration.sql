-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceSkill" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "ResourceSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "start" TEXT NOT NULL,
    "end" TEXT NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeLogEntry" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT NOT NULL,
    "newValue" TEXT NOT NULL,
    "at" TEXT NOT NULL,

    CONSTRAINT "ChangeLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UiState" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "filterProjectId" TEXT NOT NULL DEFAULT '',
    "filterResourceId" TEXT NOT NULL DEFAULT '',
    "filterResourceType" TEXT NOT NULL DEFAULT '',
    "sortKey" TEXT NOT NULL DEFAULT 'projectName',
    "sortDir" TEXT NOT NULL DEFAULT 'asc',
    "ganttScale" TEXT NOT NULL DEFAULT 'month',
    "stakeholderRole" TEXT NOT NULL DEFAULT 'manager',
    "actingAsResourceId" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "UiState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResourceSkill_resourceId_idx" ON "ResourceSkill"("resourceId");

-- CreateIndex
CREATE INDEX "ResourceSkill_skillId_idx" ON "ResourceSkill"("skillId");

-- CreateIndex
CREATE INDEX "Assignment_projectId_idx" ON "Assignment"("projectId");

-- CreateIndex
CREATE INDEX "Assignment_resourceId_idx" ON "Assignment"("resourceId");

-- CreateIndex
CREATE INDEX "Task_assignmentId_idx" ON "Task"("assignmentId");

-- CreateIndex
CREATE INDEX "ChangeLogEntry_entityType_entityId_idx" ON "ChangeLogEntry"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "ResourceSkill" ADD CONSTRAINT "ResourceSkill_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceSkill" ADD CONSTRAINT "ResourceSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

