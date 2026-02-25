import React, { useEffect, useState } from 'react';
import type { Slot } from './types';

type Tab = 'booking' | 'profile';

declare global {
  interface Window {
    Telegram?: any;
  }
}

const API_BASE = '/api';
const USE_API = import.meta.env.DEV;

const App: React.FC = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('booking');
  const [selectedDate, setSelectedDate] = useState<string>(today());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [myBookings, setMyBookings] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingLoading, setBookingLoading] = useState<string | null>(null);

  useEffect(() => {
    // Логи для проверки наличия Telegram WebApp окружения
    // Эти console.log помогут увидеть, что именно приходит с Telegram на проде
    // eslint-disable-next-line no-console
    console.log('window.Telegram:', window.Telegram);
    // eslint-disable-next-line no-console
    console.log('window.Telegram?.WebApp:', window.Telegram?.WebApp);

    const tg = window.Telegram?.WebApp;
    if (tg) {
      try {
        tg.ready();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Telegram WebApp.ready error', e);
      }

      // eslint-disable-next-line no-console
      console.log('tg.initDataUnsafe:', tg?.initDataUnsafe);

      const id = tg?.initDataUnsafe?.user?.id;
      if (id) {
        setUserId(String(id));
      } else {
        // eslint-disable-next-line no-console
        console.warn('Telegram user id not found in initDataUnsafe.user.id');
      }

      try {
        tg.expand();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Telegram WebApp.expand error', e);
      }
    } else {
      // eslint-disable-next-line no-console
      console.warn('Telegram WebApp is not available on window');
    }
  }, []);

  useEffect(() => {
    loadSlots(selectedDate);
  }, [selectedDate, userId]);

  async function loadSlots(date: string) {
    setLoadingSlots(true);

    // В production не ходим на API, а всегда используем локальные слоты
    if (!USE_API) {
      const fallback = generateLocalSlots(date);
      setSlots(fallback);
      setLoadingSlots(false);
      return;
    }

    try {
      const params = new URLSearchParams({ date });
      if (userId) params.append('userId', userId);
      const res = await fetch(`${API_BASE}/slots?${params.toString()}`);
      if (!res.ok) throw new Error('Bad status');
      const data: Slot[] = await res.json();
      setSlots(data);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to load slots from API', e);
    } finally {
      setLoadingSlots(false);
    }
  }

  async function loadMyBookings() {
    if (!userId) return;

    // В production не трогаем API, профиль заполняется только локально
    if (!USE_API) return;

    try {
      const res = await fetch(`${API_BASE}/me/bookings?userId=${userId}`);
      if (!res.ok) throw new Error('Bad status');
      const data: Slot[] = await res.json();
      setMyBookings(data);
    } catch {
      // если сервер недоступен — просто не трогаем локальные записи
    }
  }

  async function handleBook(slotId: string) {
    if (!userId) {
      // eslint-disable-next-line no-console
      console.error('Cannot book slot: Telegram userId is missing');
      return;
    }
    setBookingLoading(slotId);

    // В production бронирование только локально, без API
    if (!USE_API) {
      setSlots((prev) =>
        prev.map((s) =>
          s.id === slotId ? { ...s, status: 'mine', clientName: userId } : s,
        ),
      );
      setMyBookings((prev) => {
        const existing = prev.find((b) => b.id === slotId);
        if (existing) return prev;
        const slot = slots.find((s) => s.id === slotId);
        if (!slot) return prev;
        return [...prev, { ...slot, status: 'mine', clientName: userId }];
      });
      setBookingLoading(null);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/slots/${slotId}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Слот уже занят или произошла ошибка.');
        return;
      }

      await Promise.all([loadSlots(selectedDate), loadMyBookings()]);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Failed to book slot via API', e);
    } finally {
      setBookingLoading(null);
    }
  }

  useEffect(() => {
    if (activeTab === 'profile' && userId) {
      void loadMyBookings();
    }
  }, [activeTab, userId]);

  const days = getUpcomingDays(getDaysUntilMarch20());

  return (
    <div className="app">
      <header className="app-header">
        <h1>Запись к мастеру</h1>
        <p className="app-subtitle">Выберите удобный день и время</p>
      </header>

      <nav className="tabs">
        <button
          className={activeTab === 'booking' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('booking')}
        >
          Записаться
        </button>
        <button
          className={activeTab === 'profile' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('profile')}
        >
          Мои записи
        </button>
      </nav>

      <main className="app-content">
        {activeTab === 'booking' && (
          <>
            <div className="day-selector">
              {days.map((d) => (
                <button
                  key={d.value}
                  className={
                    d.value === selectedDate ? 'day-btn selected' : 'day-btn'
                  }
                  onClick={() => setSelectedDate(d.value)}
                >
                  <span className="day-weekday">{d.weekday}</span>
                  <span className="day-date">{d.label}</span>
                </button>
              ))}
            </div>

            {loadingSlots ? (
              <div className="state-text">Загружаем слоты...</div>
            ) : slots.length === 0 ? (
              <div className="state-text">Нет слотов на этот день</div>
            ) : (
              <div className="slots-grid">
                {slots.map((slot) => (
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    onBook={handleBook}
                    loading={bookingLoading === slot.id}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'profile' && <ProfileView myBookings={myBookings} />}
      </main>
    </div>
  );
};

interface SlotCardProps {
  slot: Slot;
  onBook: (id: string) => void;
  loading: boolean;
}

const SlotCard: React.FC<SlotCardProps> = ({ slot, onBook, loading }) => {
  const isFree = slot.status === 'free';
  const isMine = slot.status === 'mine';

  let label = slot.time;
  let className = 'slot-card';

  if (isFree) {
    className += ' free';
  } else if (isMine) {
    className += ' mine';
    label += ' (моя запись)';
  } else {
    className += ' booked';
    label += ' (занят)';
  }

  return (
    <button
      className={className}
      disabled={!isFree || loading}
      onClick={() => onBook(slot.id)}
    >
      <span className="slot-time">{label}</span>
      {isFree && !loading && <span className="slot-cta">Записаться</span>}
      {loading && <span className="slot-cta">Бронируем...</span>}
    </button>
  );
};

interface ProfileViewProps {
  myBookings: Slot[];
}

const ProfileView: React.FC<ProfileViewProps> = ({ myBookings }) => {
  if (myBookings.length === 0) {
    return <div className="state-text">У вас пока нет записей</div>;
  }

  return (
    <div className="profile-list">
      {myBookings.map((b) => (
        <div key={b.id} className="profile-card">
          <div className="profile-line">
            <span>Дата и время</span>
            <strong>
              {formatDate(b.date)}, {b.time}
            </strong>
          </div>
          <div className="profile-line">
            <span>Мастер</span>
            <strong>{b.masterName}</strong>
          </div>
        </div>
      ))}
    </div>
  );
};

function today(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function generateLocalSlots(date: string): Slot[] {
  const times = ['10:00', '12:00', '14:00', '16:00', '18:00'];
  const master = 'Марина';
  return times.map((time) => ({
    id: `${date}-${time}`,
    date,
    time,
    status: 'free',
    masterName: master,
  }));
}

function getUpcomingDays(count: number) {
  const days = [];
  const formatter = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  });
  const weekdayFormatter = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
  });

  for (let i = 0; i < count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      value: d.toISOString().slice(0, 10),
      label: formatter.format(d),
      weekday: weekdayFormatter.format(d).replace('.', ''),
    });
  }
  return days;
}

function getDaysUntilMarch20(): number {
  const todayDate = new Date();
  const year = todayDate.getFullYear();
  const target = new Date(year, 2, 20); // 20 марта
  if (todayDate > target) {
    return 1;
  }
  const diffMs = target.getTime() - todayDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
  });
}

export default App;

