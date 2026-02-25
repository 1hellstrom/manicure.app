export type SlotStatus = 'free' | 'booked' | 'mine';

export interface Slot {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: SlotStatus;
  masterName: string;
  clientName?: string;
}

