import { getAuth } from 'firebase/auth';
import { addDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { COLLECTIONS } from './testMode';

export interface PushSendResult {
  totalDevices: number;
  successCount: number;
  failedCount: number;
}

export async function sendPushNotificationToAll(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<PushSendResult> {
  if (!body?.trim()) throw new Error('Notification message cannot be empty.');

  const snap = await getDocs(collection(db, COLLECTIONS.pushTokens));
  const tokenDocs = snap.docs
    .map(d => ({ token: d.data().token, model: d.data().model ?? 'unknown' }))
    .filter(d => d.token && typeof d.token === 'string' && d.token.startsWith('ExponentPushToken'));

  if (tokenDocs.length === 0) {
    throw new Error('No registered devices found.');
  }

  const BATCH = 100;
  const allTickets: { token: string; model: string; ticketId?: string; error?: string }[] = [];

  for (let i = 0; i < tokenDocs.length; i += BATCH) {
    const batch = tokenDocs.slice(i, i + BATCH);
    const messages = batch.map(d => ({
      to: d.token,
      title,
      body: body.trim(),
      sound: 'default',
      channelId: 'tgh-default',
      priority: 'high',
      ...(data ? { data } : {}),
    }));

    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify(messages),
    });

    const result = await res.json();
    const tickets = Array.isArray(result.data) ? result.data : [result.data];

    tickets.forEach((ticket: any, idx: number) => {
      const d = batch[idx];
      if (ticket?.status === 'ok') {
        allTickets.push({ token: d.token, model: d.model, ticketId: ticket.id });
      } else {
        allTickets.push({ token: d.token, model: d.model, error: ticket?.message ?? 'unknown error' });
      }
    });
  }

  const successTickets = allTickets.filter(t => t.ticketId);
  const failedTickets = allTickets.filter(t => t.error);

  await addDoc(collection(db, COLLECTIONS.notificationLogs), {
    title,
    body: body.trim(),
    sentAt: serverTimestamp(),
    sentBy: getAuth().currentUser?.email ?? 'unknown',
    source: 'admin-broadcast',
    totalDevices: tokenDocs.length,
    successCount: successTickets.length,
    failedCount: failedTickets.length,
    ticketIds: successTickets.map(t => t.ticketId),
    failures: failedTickets.map(t => ({ token: t.token.slice(-10), model: t.model, error: t.error })),
  });

  return {
    totalDevices: tokenDocs.length,
    successCount: successTickets.length,
    failedCount: failedTickets.length,
  };
}
