import type {
  AppData,
  Assignment,
  Project,
  Resource,
  ResourceSkill,
  Skill,
  SkillLevel,
  Task,
  TaskStatus,
} from "./types";
import { TIME_OFF_PROJECT_ID } from "./types";
import { addDays, formatDate } from "./dates";

function daysFromToday(offset: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return formatDate(d);
}

function todayAtNoon(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

function daysBetweenLocal(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

const FIRST_NAMES = [
  "Ava", "Noah", "Mia", "Leo", "Elsa", "Oscar", "Iris", "Elias", "Sofia", "Oliver",
  "Emma", "Lucas", "Aino", "Väinö", "Helmi", "Eino", "Lilja", "Onni", "Venla", "Eemeli",
  "Aada", "Toivo", "Seela", "Viljo", "Pihla", "Joel", "Ellen", "Hugo", "Linnea", "Anton",
  "Saga", "Emil", "Alma", "Niko", "Viola", "Jasper", "Siiri", "Mikael", "Iida", "Samuel",
  "Hilla", "Daniel", "Lotta", "Rasmus", "Amanda", "Teemu", "Kerttu", "Matias", "Nella", "Aleksi",
];

const LAST_NAMES = [
  "Lind", "Berg", "Korhonen", "Saarinen", "Niemi", "Virtanen", "Mäkinen", "Hämäläinen",
  "Laine", "Heikkinen", "Koskinen", "Järvinen", "Lehtonen", "Rantanen", "Aalto", "Salminen",
  "Tuominen", "Nurmi", "Hiltunen", "Kallio", "Lahtinen", "Peltola", "Ojala", "Hakala",
  "Koivisto", "Mattila", "Savolainen", "Lehto", "Ahonen", "Rinne", "Karjalainen", "Nieminen",
  "Seppälä", "Väisänen", "Miettinen", "Laakso", "Heikkilä", "Kinnunen", "Salonen", "Turunen",
  "Leppänen", "Pitkänen", "Haapala", "Mustonen", "Jokinen", "Rautiainen", "Peltonen", "Immonen",
  "Hietala", "Vuorinen",
];

const TYPES = [
  "Engineer",
  "Technician",
  "Project Manager",
  "Analyst",
  "Designer",
  "Site Lead",
  "Coordinator",
  "Specialist",
];

const TASK_VERBS = [
  "Review",
  "Draft",
  "Survey",
  "Install",
  "Coordinate",
  "Analyze",
  "Inspect",
  "Update",
  "Validate",
  "Prepare",
  "Align",
  "Document",
];

const TASK_NOUNS = [
  "drawings",
  "load cases",
  "site notes",
  "cable trays",
  "stakeholder pack",
  "forecast",
  "pad survey",
  "alignment study",
  "safety checklist",
  "BOM",
  "schedule",
  "interfaces",
];

function hash(n: number): number {
  let x = (n * 2654435761) >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

function pick<T>(arr: T[], seed: number): T {
  return arr[hash(seed) % arr.length];
}

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function levelFromSeed(seed: number): SkillLevel {
  return String(1 + (hash(seed) % 5)) as SkillLevel;
}

function statusForRange(start: string, end: string, today: string): TaskStatus {
  if (end < today) return "Done";
  if (start <= today && end >= today) return "In progress";
  return "Todo";
}

type Stint = {
  projectId: string;
  start: Date;
  end: Date;
  leaveTitle?: string;
};

function clampDate(d: Date, lo: Date, hi: Date): Date {
  if (d < lo) return lo;
  if (d > hi) return hi;
  return d;
}

/** Build scattered, non-overlapping stints across [spanStart, spanEnd]. */
function buildYearStints(
  resourceIndex: number,
  workProjectIds: string[],
  spanStart: Date,
  spanEnd: Date,
  today: Date
): Stint[] {
  const leaves: Stint[] = [];
  const leaveCount = randInt(1, 3);
  for (let L = 0; L < leaveCount; L++) {
    const offset = randInt(-20, 300);
    const len = randInt(3, 14);
    const start = clampDate(addDays(today, offset), spanStart, spanEnd);
    const end = clampDate(addDays(start, len - 1), spanStart, spanEnd);
    if (start <= end) {
      leaves.push({
        projectId: TIME_OFF_PROJECT_ID,
        start,
        end,
        leaveTitle: L % 2 === 0 ? "Summer leave" : "Winter leave",
      });
    }
  }
  leaves.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Merge overlapping leaves
  const mergedLeaves: Stint[] = [];
  for (const leave of leaves) {
    const last = mergedLeaves[mergedLeaves.length - 1];
    if (last && leave.start <= addDays(last.end, 1)) {
      if (leave.end > last.end) last.end = leave.end;
    } else {
      mergedLeaves.push({ ...leave });
    }
  }

  const projects = shuffleInPlace([...workProjectIds]);
  const stints: Stint[] = [];
  let cursor = addDays(spanStart, randInt(0, 14));
  if (cursor > spanEnd) cursor = spanStart;
  let rot = resourceIndex % Math.max(1, projects.length);

  const leaveQueue = [...mergedLeaves];

  while (cursor <= spanEnd) {
    const nextLeave = leaveQueue.find((l) => l.end >= cursor);
    if (nextLeave && nextLeave.start <= cursor) {
      const leaveStart = cursor;
      const leaveEnd = nextLeave.end > spanEnd ? spanEnd : nextLeave.end;
      stints.push({
        projectId: TIME_OFF_PROJECT_ID,
        start: leaveStart,
        end: leaveEnd,
        leaveTitle: nextLeave.leaveTitle,
      });
      cursor = addDays(leaveEnd, 1 + randInt(0, 5));
      continue;
    }

    if (nextLeave && nextLeave.start > cursor) {
      const gapBeforeLeave = daysBetweenLocal(cursor, nextLeave.start);
      if (gapBeforeLeave <= 0) {
        cursor = nextLeave.start;
        continue;
      }
      const stintDays = Math.min(
        gapBeforeLeave,
        randInt(8, 32)
      );
      let end = addDays(cursor, stintDays - 1);
      if (end >= nextLeave.start) end = addDays(nextLeave.start, -1);
      if (end >= cursor) {
        stints.push({
          projectId: projects[rot % projects.length],
          start: cursor,
          end,
        });
        rot++;
      }
      // Idle gap before leave — often leave a real open slot
      cursor = addDays(end, 1 + (Math.random() < 0.75 ? randInt(5, 28) : randInt(0, 3)));
      continue;
    }

    // Prefer shorter stints so free gaps show up more often
    const stintDays = randInt(8, 35);
    let end = addDays(cursor, stintDays - 1);
    if (end > spanEnd) end = spanEnd;
    stints.push({
      projectId: projects[rot % projects.length],
      start: cursor,
      end,
    });
    rot++;
    // Most people get an empty stretch between bookings
    cursor = addDays(end, 1 + (Math.random() < 0.85 ? randInt(7, 35) : randInt(1, 5)));
  }

  return stints.filter((s) => s.start <= s.end);
}

export function createSeedData(): AppData {
  const today = todayAtNoon();
  const todayIso = formatDate(today);
  const yearStart = addDays(today, -randInt(20, 55));
  const yearEnd = addDays(today, randInt(280, 360));

  const projects: Project[] = [
    { id: "proj_alpha", name: "Harbor Bridge", number: "P-1042" },
    { id: "proj_beta", name: "North Wind Farm", number: "P-1108" },
    { id: "proj_gamma", name: "City Metro Line", number: "P-1201" },
    { id: "proj_delta", name: "Coastal Road Upgrade", number: "P-1305" },
    { id: "proj_epsilon", name: "Grid Substation B", number: "P-1412" },
    { id: "proj_zeta", name: "Port Crane Retrofit", number: "P-1520" },
    { id: "proj_eta", name: "District Heating Loop", number: "P-1603" },
    { id: "proj_theta", name: "Airport Apron Works", number: "P-1711" },
    { id: TIME_OFF_PROJECT_ID, name: "Time off", number: "P-OFF" },
  ];

  const workProjectIds = projects
    .filter((p) => p.id !== TIME_OFF_PROJECT_ID)
    .map((p) => p.id);

  const skills: Skill[] = [
    { id: "sk_civil", name: "Civil Design", category: "Engineering" },
    { id: "sk_elec", name: "Electrical", category: "Engineering" },
    { id: "sk_pm", name: "Project Planning", category: "Management" },
    { id: "sk_cad", name: "CAD", category: "Tools" },
    { id: "sk_safety", name: "Site Safety", category: "Operations" },
  ];

  const resources: Resource[] = [];
  const resourceSkills: ResourceSkill[] = [];
  let rsCounter = 1;

  for (let i = 0; i < 50; i++) {
    const id = i === 0 ? "res_ava" : `res_${String(i).padStart(2, "0")}`;
    resources.push({
      id,
      name: `${FIRST_NAMES[i]} ${LAST_NAMES[i]}`,
      type: pick(TYPES, i * 17 + 3),
      notes:
        i === 0
          ? "Lead civil contact for Harbor Bridge"
          : i === 2
            ? "Prefers morning standups"
            : "",
    });

    const skillCount = 1 + (hash(i * 31) % 3);
    const used = new Set<string>();
    for (let s = 0; s < skillCount; s++) {
      const skill = skills[hash(i * 97 + s * 13) % skills.length];
      if (used.has(skill.id)) continue;
      used.add(skill.id);
      resourceSkills.push({
        id: `rs_${rsCounter++}`,
        resourceId: id,
        skillId: skill.id,
        level: levelFromSeed(i * 11 + s * 7),
        notes: "",
      });
    }
  }

  const assignments: Assignment[] = [];
  const tasks: Task[] = [];
  let asgCounter = 1;
  let taskCounter = 1;

  function addAssignment(
    projectId: string,
    resourceId: string,
    start: Date,
    end: Date
  ): Assignment {
    const assignment: Assignment = {
      id: `asg_${asgCounter++}`,
      projectId,
      resourceId,
      start: formatDate(start),
      end: formatDate(end),
    };
    assignments.push(assignment);
    return assignment;
  }

  function addTasksForAssignment(
    assignment: Assignment,
    seedBase: number,
    fixedTitle?: string
  ) {
    let cursor = parseIso(assignment.start);
    const end = parseIso(assignment.end);
    let chunk = 0;
    while (cursor <= end && chunk < 40) {
      const len = randInt(4, 16);
      let taskEnd = addDays(cursor, len);
      if (taskEnd > end) taskEnd = end;
      const startIso = formatDate(cursor);
      const endIso = formatDate(taskEnd);
      const title = fixedTitle
        ? chunk === 0
          ? fixedTitle
          : `${fixedTitle} (${chunk + 1})`
        : `${pick(TASK_VERBS, seedBase + chunk)} ${pick(TASK_NOUNS, seedBase + chunk * 3)}`;
      tasks.push({
        id: `task_${taskCounter++}`,
        assignmentId: assignment.id,
        title,
        status: statusForRange(startIso, endIso, todayIso),
        start: startIso,
        end: endIso,
      });
      if (taskEnd.getTime() === cursor.getTime()) {
        cursor = addDays(cursor, 1);
      } else {
        cursor = addDays(taskEnd, 1 + (Math.random() < 0.25 ? randInt(1, 4) : 0));
      }
      chunk++;
    }
  }

  // --- Ava: deliberate Harbor + Metro overlap (documented conflict) ---
  {
    const harborStartOff = -randInt(3, 14);
    const harborEndOff = randInt(18, 40);
    const harbor = addAssignment(
      "proj_alpha",
      "res_ava",
      addDays(today, harborStartOff),
      addDays(today, harborEndOff)
    );
    const conflictStart = randInt(-2, 4);
    const conflictEnd = conflictStart + randInt(6, 12);
    tasks.push(
      {
        id: `task_${taskCounter++}`,
        assignmentId: harbor.id,
        title: "Foundation load review",
        status: "In progress",
        start: daysFromToday(conflictStart),
        end: daysFromToday(conflictStart + randInt(4, 8)),
      },
      {
        id: `task_${taskCounter++}`,
        assignmentId: harbor.id,
        title: "Deck span drawings",
        status: "Todo",
        start: daysFromToday(conflictEnd - randInt(2, 5)),
        end: daysFromToday(conflictEnd + randInt(2, 6)),
      }
    );
    let cursor = addDays(today, conflictEnd + randInt(1, 4));
    const harborEnd = addDays(today, harborEndOff);
    let n = 0;
    while (cursor <= harborEnd && n < 10) {
      const taskEnd = addDays(
        cursor,
        Math.max(0, Math.min(randInt(3, 8), daysBetweenLocal(cursor, harborEnd)))
      );
      tasks.push({
        id: `task_${taskCounter++}`,
        assignmentId: harbor.id,
        title: `Harbor follow-up (${n + 1})`,
        status: statusForRange(
          formatDate(cursor),
          formatDate(taskEnd),
          todayIso
        ),
        start: formatDate(cursor),
        end: formatDate(taskEnd),
      });
      cursor = addDays(taskEnd, 1);
      n++;
    }

    const metroStartOff = randInt(-2, 5);
    const metroEndOff = randInt(20, 38);
    const metro = addAssignment(
      "proj_gamma",
      "res_ava",
      addDays(today, metroStartOff),
      addDays(today, metroEndOff)
    );
    // Overlap with Harbor conflict window
    const metroTaskStart = conflictStart + randInt(1, 4);
    const metroTaskEnd = metroTaskStart + randInt(6, 12);
    tasks.push({
      id: `task_${taskCounter++}`,
      assignmentId: metro.id,
      title: "Metro alignment study",
      status: "In progress",
      start: daysFromToday(metroTaskStart),
      end: daysFromToday(metroTaskEnd),
    });
    cursor = addDays(today, metroTaskEnd + 1);
    const metroEnd = addDays(today, metroEndOff);
    n = 0;
    while (cursor <= metroEnd && n < 10) {
      const taskEnd = addDays(
        cursor,
        Math.max(0, Math.min(randInt(3, 7), daysBetweenLocal(cursor, metroEnd)))
      );
      tasks.push({
        id: `task_${taskCounter++}`,
        assignmentId: metro.id,
        title: `Metro coordination (${n + 1})`,
        status: statusForRange(
          formatDate(cursor),
          formatDate(taskEnd),
          todayIso
        ),
        start: formatDate(cursor),
        end: formatDate(taskEnd),
      });
      cursor = addDays(taskEnd, 1);
      n++;
    }

    // Ava remainder of year after the conflict window
    const restStart = addDays(today, Math.max(harborEndOff, metroEndOff) + 1);
    const avaRest = buildYearStints(
      0,
      workProjectIds,
      restStart,
      yearEnd,
      today
    );
    for (let s = 0; s < avaRest.length; s++) {
      const stint = avaRest[s];
      const asg = addAssignment(
        stint.projectId,
        "res_ava",
        stint.start,
        stint.end
      );
      addTasksForAssignment(asg, 1000 + s, stint.leaveTitle);
    }
  }

  // --- Other 49 resources ---
  for (let i = 1; i < resources.length; i++) {
    const resource = resources[i];
    const rotation = shuffleInPlace([...workProjectIds]).slice(
      0,
      randInt(3, workProjectIds.length)
    );
    const personStart = addDays(yearStart, randInt(0, 40));
    const personEnd = addDays(yearEnd, -randInt(0, 30));
    const stints = buildYearStints(
      i,
      rotation,
      personStart < personEnd ? personStart : yearStart,
      personEnd > personStart ? personEnd : yearEnd,
      today
    );
    for (let s = 0; s < stints.length; s++) {
      const stint = stints[s];
      const asg = addAssignment(
        stint.projectId,
        resource.id,
        stint.start,
        stint.end
      );
      addTasksForAssignment(asg, i * 1000 + s * 7, stint.leaveTitle);
    }

    // ~1 in 5 people get a deliberate double-booked stretch (heavy load demo)
    if (i % 5 === 0) {
      const overlapStart = addDays(today, randInt(-5, 20));
      const overlapEnd = addDays(overlapStart, randInt(8, 21));
      const projA = workProjectIds[i % workProjectIds.length];
      const projB = workProjectIds[(i + 3) % workProjectIds.length];
      if (projA !== projB) {
        const a = addAssignment(projA, resource.id, overlapStart, overlapEnd);
        const b = addAssignment(
          projB,
          resource.id,
          addDays(overlapStart, randInt(0, 4)),
          addDays(overlapEnd, -randInt(0, 3))
        );
        addTasksForAssignment(a, i * 9000 + 1);
        addTasksForAssignment(b, i * 9000 + 2);
      }
    }
  }

  return {
    version: 1,
    projects,
    resources,
    skills,
    resourceSkills,
    assignments,
    tasks,
    changeLog: [],
    ui: {
      filterProjectId: "",
      filterResourceId: "",
      filterResourceType: "",
      sortKey: "resourceName",
      sortDir: "asc",
      ganttScale: "month",
      stakeholderRole: "manager",
      actingAsResourceId: "",
    },
  };
}
