import { getAuth } from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, getDocs, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { COLLECTIONS } from './testMode';

export interface PushSendResult {
  totalDevices: number;
  successCount: number;
  failedCount: number;
  deliveryErrors: { message: string; count: number }[];
}

export async function sendPushNotificationToAll(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<PushSendResult> {
  if (!body?.trim()) throw new Error('Notification message cannot be empty.');

  const snap = await getDocs(collection(db, COLLECTIONS.pushTokens));
  const tokenDocs = snap.docs
    .map(d => ({ id: d.id, token: d.data().token, model: d.data().model ?? 'unknown' }))
    .filter(d => d.token && typeof d.token === 'string' && d.token.startsWith('ExponentPushToken'));

  if (tokenDocs.length === 0) {
    throw new Error('No registered devices found.');
  }

  const BATCH = 100;
  const allTickets: { id: string; token: string; model: string; ticketId?: string; error?: string }[] = [];

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
        allTickets.push({ id: d.id, token: d.token, model: d.model, ticketId: ticket.id });
      } else {
        allTickets.push({ id: d.id, token: d.token, model: d.model, error: ticket?.message ?? 'unknown error' });
      }
    });
  }

  const successTickets = allTickets.filter(t => t.ticketId);
  const failedTickets = allTickets.filter(t => t.error);

  const logRef = await addDoc(collection(db, COLLECTIONS.notificationLogs), {
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

  // A ticket only means Expo *accepted* the message for relay — it does not
  // mean FCM/APNs actually delivered it. Real delivery failures (expired/
  // misconfigured push credentials, uninstalled apps, etc.) only surface on
  // the receipt, which Expo needs a few seconds to populate after relaying.
  const deliveryErrors = await checkReceiptsAndPrune(successTickets, logRef.id);

  return {
    totalDevices: tokenDocs.length,
    successCount: successTickets.length - deliveryErrors.reduce((n, e) => n + e.count, 0),
    failedCount: failedTickets.length + deliveryErrors.reduce((n, e) => n + e.count, 0),
    deliveryErrors,
  };
}

async function checkReceiptsAndPrune(
  successTickets: { id: string; token: string; model: string; ticketId?: string }[],
  logId: string
): Promise<{ message: string; count: number }[]> {
  if (successTickets.length === 0) return [];

  await new Promise(r => setTimeout(r, 8000));

  const RECEIPT_BATCH = 300;
  const receiptErrors: { id: string; token: string; model: string; message: string; code?: string }[] = [];

  for (let i = 0; i < successTickets.length; i += RECEIPT_BATCH) {
    const batch = successTickets.slice(i, i + RECEIPT_BATCH);
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify({ ids: batch.map(t => t.ticketId) }),
      });
      const result = await res.json();
      const receipts = result?.data ?? {};

      for (const t of batch) {
        const receipt = t.ticketId ? receipts[t.ticketId] : null;
        if (receipt?.status === 'error') {
          receiptErrors.push({
            id: t.id,
            token: t.token,
            model: t.model,
            message: receipt?.message ?? 'unknown delivery error',
            code: receipt?.details?.error,
          });
        }
      }
    } catch {
      // Receipts unavailable (offline, Expo outage) — leave tickets as the
      // best information we have rather than failing the whole send.
    }
  }

  const staleTokenIds = receiptErrors.filter(e => e.code === 'DeviceNotRegistered').map(e => e.id);
  await Promise.all(
    staleTokenIds.map(id => deleteDoc(doc(db, COLLECTIONS.pushTokens, id)).catch(() => {}))
  );

  if (receiptErrors.length > 0) {
    await updateDoc(doc(db, COLLECTIONS.notificationLogs, logId), {
      deliveryErrorCount: receiptErrors.length,
      deliveryErrors: receiptErrors.map(e => ({ token: e.token.slice(-10), model: e.model, message: e.message, code: e.code ?? null })),
      staleTokensRemoved: staleTokenIds.length,
    }).catch(() => {});
  }

  const grouped = new Map<string, number>();
  for (const e of receiptErrors) {
    const key = e.code ? `${e.code}: ${e.message}` : e.message;
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }
  return Array.from(grouped.entries()).map(([message, count]) => ({ message, count }));
}
