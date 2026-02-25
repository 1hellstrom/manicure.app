import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

interface Slot {
  id: string;
  date: string;
  time: string;
  masterName: string;
  userId?: string;
}

let slots: Slot[] = generateSlotsForNextDays(7);

app.get('/api/slots', (req, res) => {
  const date = String(req.query.date || '');
  const userId = req.query.userId ? String(req.query.userId) : '';

  if (!date) {
    return res.status(400).json({ error: 'date is required' });
  }

  const daySlots = slots
    .filter((s) => s.date === date)
    .map((s) => ({
      ...s,
      status: !s.userId ? 'free' : s.userId === userId ? 'mine' : 'booked',
    }));

  res.json(daySlots);
});

app.post('/api/slots/:id/book', (req, res) => {
  const { id } = req.params;
  const { userId } = req.body as { userId?: string };

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const slot = slots.find((s) => s.id === id);
  if (!slot) {
    return res.status(404).json({ error: 'Slot not found' });
  }

  if (slot.userId && slot.userId !== userId) {
    return res.status(409).json({ error: 'Slot already booked' });
  }

  slot.userId = userId;
  res.json({ ok: true });
});

app.get('/api/me/bookings', (req, res) => {
  const userId = req.query.userId ? String(req.query.userId) : '';

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const my = slots.filter((s) => s.userId === userId);

  res.json(
    my.map((s) => ({
      ...s,
      status: 'mine',
    })),
  );
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

function generateSlotsForNextDays(days: number): Slot[] {
  const result: Slot[] = [];
  const times = ['10:00', '12:00', '14:00', '16:00', '18:00'];
  const master = 'Марина';

  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const date = d.toISOString().slice(0, 10);
    for (const t of times) {
      const id = `${date}-${t}`;
      result.push({ id, date, time: t, masterName: master });
    }
  }
  return result;
}

