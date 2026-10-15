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
