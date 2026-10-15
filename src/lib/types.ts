export type Role = "MEMBER" | "ADMIN";
export type SlotKind = "LAB" | "PROJECT";

export type Me = { id: string; name: string; role: Role };
export type UserOption = { id: string; name: string };
export type ProjectOption = { id: string; name: string; color: string; memberIds: string[] };
export type LabConfig = {
  capacity: number;
  openMinute: number;
  closeMinute: number;
  openDays: number[];
  slotMinutes: number;
};

type Ref = { id: string; name: string };

export type CalendarItem = {
  id: string;
  userId: string;
  start: string;
  end: string;
  kind: SlotKind;
  projectId: string | null;
  notes: string | null;
  user: Ref;
  project: (Ref & { color: string }) | null;
};

export type AssignmentItem = CalendarItem & { source: "MANUAL" | "RECOMMENDED" };
