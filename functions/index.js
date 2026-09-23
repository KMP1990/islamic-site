/* ============================================
   Cloud Functions — إرسال FCM
   ============================================ */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

/**
 * عندما يُنشأ مستند في pushQueue → أرسل FCM
 */
exports.sendPushOnQueue = onDocumentCreated('pushQueue/{notificationId}', async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log('No data associated with the event');
    return;
  }

  const data = snapshot.data();
  const { toUid, title, body, type, chatId, link, fromName } = data;

  if (!toUid) {
    console.log('No toUid');
    return;
  }

  try {
    // احصل على FCM Token من fcmTokens
    const tokenDoc = await db.collection('fcmTokens').doc(toUid).get();

    if (!tokenDoc.exists) {
      console.log(`No FCM token for user ${toUid}`);
      await snapshot.ref.update({ sent: false, error: 'no-token' });
      return;
    }

    const tokenData = tokenDoc.data();
    const fcmToken = tokenData.token;

    if (!fcmToken) {
      console.log(`Empty FCM token for ${toUid}`);
      await snapshot.ref.update({ sent: false, error: 'empty-token' });
      return;
    }

    // رسالة FCM
    const message = {
      token: fcmToken,
      data: {
        title: title || 'إشعار جديد',
        body: body || '',
        type: type || 'general',
        chatId: chatId || '',
        link: link || '/dashboard.html',
        fromName: fromName || ''
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          title: title || 'إشعار جديد',
          body: body || '',
          icon: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="20" fill="%230d3b2e"/%3E%3Ctext x="50" y="68" font-size="60" text-anchor="middle" fill="%23d4af37" font-family="serif"%3E﷽%3C/text%3E%3C/svg%3E',
          badge: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect width="100" height="100" rx="20" fill="%230d3b2e"/%3E%3Ctext x="50" y="68" font-size="60" text-anchor="middle" fill="%23d4af37" font-family="serif"%3E﷽%3C/text%3E%3C/svg%3E'
        },
        fcmOptions: {
          link: link || '/dashboard.html'
        }
      }
    };

    const response = await messaging.send(message);
    console.log('✅ FCM sent:', response);

    await snapshot.ref.update({
      sent: true,
      sentAt: new Date().toISOString(),
      fcmResponse: response
    });
  } catch (err) {
    console.error('❌ FCM send failed:', err);
    await snapshot.ref.update({
      sent: false,
      error: err.message
    });
  }
});