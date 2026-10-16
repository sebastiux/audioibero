export type Role = "MEMBER" | "ADMIN";
export type SlotKind = "LAB" | "PROJECT" | "ASYNC";

export type Me = { id: string; name: string; role: Role };
export type UserOption = { id: string; name: string };
export type ProjectOption = { id: string; name: string; color: string; memberIds: string[] };
export type LabConfig = {
  openMinute: number;
  closeMinute: number;
  openDays: number[];
  slotMinutes: number;
};

export type BookingItem = {
  id: string;
  start: string;
  end: string;
  kind: SlotKind;
  projectId: string | null;
  notes: string | null;
  source: "MANUAL" | "RECOMMENDED";
  createdById: string;
  project: { id: string; name: string; color: string } | null;
  participants: { userId: string; user: { id: string; name: string } }[];
};

export type MissionOccurrenceItem = {
  missionId: string;
  title: string;
  start: string;
  end: string;
  projectId: string | null;
  projectName: string | null;
  projectColor: string | null;
};

export type MissionItem = {
  id: string;
  projectId: string | null;
  title: string;
  description: string | null;
  type: "REMINDER" | "RECURRING";
  pinned: boolean;
  active: boolean;
  dueDate: string | null;
  emailedAt?: string | null;
  weekdays: number[];
  startMinute: number | null;
  endMinute: number | null;
  startsOn: string | null;
  endsOn: string | null;
  kind: SlotKind;
};
