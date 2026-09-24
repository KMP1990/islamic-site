/* ============================================
   نظام الأصدقاء والمحادثات — v4.0.0
   ============================================
   - إشعارات موحّدة عبر NotificationManager
   - إزالة الإشعارات عند فتح المحادثة
   - مزامنة lastSeenMessages مع Firestore
   - Presence System للاتصال
   - Push عبر ntfy.sh
   ============================================ */

const FRIENDS_COLLECTION = 'friendships';
const CHATS_COLLECTION = 'chats';
const MESSAGES_COLLECTION = 'chatMessages';
const USER_STATUS_COLLECTION = 'userStatus';
const NOTIFICATIONS_COLLECTION = 'notifications';
const TYPING_COLLECTION = 'typing';
const READ_NOTIFS_KEY = 'tariq_read_notifs_v2';

let friendsState = {
  currentUser: null,
  friends: [],
  friendRequests: [],
  sentRequests: [],
  chats: [],
  activeChat: null,
  messages: [],
  groupedMessages: [],
  searchResults: [],
  activeTab: 'chats',
  unsubscribeChats: null,
  unsubscribeMessages: null,
  unsubscribeNotifications: null,
  unsubscribeFriendships: null,
  unsubscribeTyping: null,
  presenceInterval: null,
  initialized: false,
  unreadCounts: {},
  lastSeenMessages: {},
  readNotifs: new Set(),
  peerTyping: false
};

/* ============================================
   دوال مساعدة
   ============================================ */
function isFirebaseReady() {
  return !!(window.firebaseHelpers && window.firebaseHelpers.fbGetCollection);
}

function toTimestamp(value) {
  if (!value) return 0;

  if (typeof value === 'object') {
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.seconds === 'number') return value.seconds * 1000;
    if (value._seconds !== undefined) return value._seconds * 1000;
    if (typeof value.toDate === 'function') return value.toDate().getTime();
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) return 0;
  return date.getTime();
}

async function waitForFirebase(timeout = 10000) {
  if (isFirebaseReady() && window.firebaseHelpers.isReady) return true;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (isFirebaseReady() && window.firebaseHelpers.isReady) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

async function waitForUser(maxRetries = 15) {
  for (let i = 0; i < maxRetries; i++) {
    const user = getCurrentFriendsUser();
    if (user) return user;
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
}

function getCurrentFriendsUser() {
  return window.authApi?.getCurrentUser?.() || null;
}

function requireFriendsLogin() {
  const user = getCurrentFriendsUser();
  if (!user) {
    if (typeof showToast === 'function') showToast('سجّل دخولك أولاً');
    if (typeof openAuthModal === 'function') openAuthModal('login');
    return false;
  }
  return true;
}

/* ============================================
   إدارة الإشعارات المقروءة
   ============================================ */
function loadReadNotifs() {
  try {
    const stored = JSON.parse(localStorage.getItem(READ_NOTIFS_KEY) || '[]');
    friendsState.readNotifs = new Set(stored);
  } catch {
    friendsState.readNotifs = new Set();
  }
}

function markNotifAsRead(notifId) {
  friendsState.readNotifs.add(notifId);
  try {
    localStorage.setItem(READ_NOTIFS_KEY, JSON.stringify([...friendsState.readNotifs].slice(-500)));
  } catch {}
}

/* ============================================
   ✅ lastSeenMessages — مزامنة مع Firestore
   ============================================ */
async function loadLastSeenMessages() {
  try {
    const user = window.authApi?.getCurrentUser?.();
    if (user && window.firebaseHelpers) {
      try {
        const prefs = await window.firebaseHelpers.fbGetDoc('userPrefs', user.uid);
        if (prefs && prefs.lastSeenMessages) {
          friendsState.lastSeenMessages = prefs.lastSeenMessages;
          localStorage.setItem('tariq_last_read', JSON.stringify(prefs.lastSeenMessages));
          return;
        }
      } catch (e) {}
    }
    friendsState.lastSeenMessages = JSON.parse(localStorage.getItem('tariq_last_read') || '{}');
  } catch {
    friendsState.lastSeenMessages = {};
  }
}

async function saveLastSeenMessages() {
  try {
    localStorage.setItem('tariq_last_read', JSON.stringify(friendsState.lastSeenMessages));

    const user = window.authApi?.getCurrentUser?.();
    if (user && window.firebaseHelpers) {
      await window.firebaseHelpers.fbSetDoc('userPrefs', user.uid, {
        lastSeenMessages: friendsState.lastSeenMessages,
        updatedAt: new Date().toISOString()
      }).catch(() => {});
    }
  } catch (e) {}
}

/* ============================================
   عرض الصفحة
   ============================================ */
async function showFriends() {
  if (!requireFriendsLogin()) return;

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('friendsView')?.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.textContent.includes('الأصدقاء')) item.classList.add('active');
  });

  if (typeof closeSidebarIfOpen === 'function') closeSidebarIfOpen();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  const ready = await waitForFirebase();
  if (!ready) {
    if (typeof showToast === 'function') showToast('Firebase لم يُحمّل');
    return;
  }

  const user = await waitForUser();
  if (!user) return;

  friendsState.currentUser = user;
  await loadLastSeenMessages();
  await initFriendsSystem();

  if (typeof trackEvent === 'function') trackEvent('friends_opened');
}

/* ============================================
   التهيئة
   ============================================ */
async function initFriendsSystem() {
  if (!isFirebaseReady()) return;
  if (!friendsState.currentUser) {
    friendsState.currentUser = getCurrentFriendsUser();
  }
  if (!friendsState.currentUser) return;

  await Promise.allSettled([
    loadFriends(),
    loadFriendRequests(),
    loadChats(),
    loadUnreadCounts()
  ]);

  // ✅ Presence System يتولى الحالة — لا حاجة لـ updateUserStatus هنا
  if (window.PresenceSystem) {
    window.PresenceSystem.start().catch(() => {});
  }

  try {
    listenToChats();
    listenToFriendships();
    listenToNotifications();
  } catch (e) {
    console.warn('[Friends] Listen setup failed:', e);
  }

  renderChats();
  renderFriends();
  renderFriendRequests();

  friendsState.initialized = true;
}

/* ============================================
   التبويبات
   ============================================ */
function switchFriendsTab(tab) {
  friendsState.activeTab = tab;
  document.querySelectorAll('.friends-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.friendsTab === tab);
  });
  document.querySelectorAll('.friends-panel').forEach(p => {
    p.classList.toggle('active', p.dataset.friendsPanel === tab);
  });

  if (tab === 'chats') renderChats();
  else if (tab === 'friends') renderFriends();
  else if (tab === 'requests') renderFriendRequests();
  else if (tab === 'search') setTimeout(() => document.getElementById('friendsSearchInput')?.focus(), 200);
  else if (tab === 'groups') renderGroupCreator();
}

/* ============================================
   البحث
   ============================================ */
let searchTimeout = null;

function searchUsers(query) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(async () => {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) {
      friendsState.searchResults = [];
      renderSearchResults();
      return;
    }

    if (!isFirebaseReady()) return;

    try {
      const allUsers = await window.firebaseHelpers.fbGetCollection('users');
      const myUid = friendsState.currentUser?.uid;
      if (!myUid) return;

      friendsState.searchResults = allUsers.filter(u => {
        if (u.uid === myUid) return false;
        if (u.banned || u.disabled) return false;
        const name = (u.fullName || '').toLowerCase();
        const username = (u.username || '').toLowerCase();
        return name.includes(q) || username.includes(q);
      }).slice(0, 20);

      renderSearchResults();
    } catch (err) {
      friendsState.searchResults = [];
      renderSearchResults();
    }
  }, 400);
}

function renderSearchResults() {
  const list = document.getElementById('friendsSearchResults');
  if (!list) return;

  if (!friendsState.searchResults.length) {
    list.innerHTML = `
      <div class="friends-empty">
        <span class="friends-empty-icon">🔍</span>
        ابحث عن صديق بالاسم أو اسم المستخدم
      </div>
    `;
    return;
  }

  list.innerHTML = friendsState.searchResults.map(user => {
    const initial = (user.fullName || user.username || 'م').charAt(0).toUpperCase();
    const avatar = user.avatar
      ? `<img src="${escapeHtml(user.avatar)}" alt="">`
      : escapeHtml(initial);

    const isFriend = friendsState.friends.some(f => f.uid === user.uid);
    const hasSentRequest = friendsState.sentRequests.some(r => r.toUid === user.uid);
    const hasReceivedRequest = friendsState.friendRequests.some(r => r.fromUid === user.uid);

    let actionBtn = '';
    if (isFriend) {
      actionBtn = `<button class="friend-btn primary" onclick="openChatWith('${user.uid}')" title="محادثة">💬</button>`;
    } else if (hasSentRequest) {
      actionBtn = `<button class="friend-btn" disabled title="تم الإرسال">⏳</button>`;
    } else if (hasReceivedRequest) {
      actionBtn = `<button class="friend-btn primary" onclick="switchFriendsTab('requests')" title="اقبل الطلب">📬</button>`;
    } else {
      actionBtn = `<button class="friend-btn primary" onclick="sendFriendRequest('${user.uid}')" title="إضافة">➕</button>`;
    }

    return `
      <div class="friend-card">
        <div class="friend-avatar">${avatar}</div>
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(user.fullName || user.username || 'مستخدم')}</div>
          <div class="friend-username">@${escapeHtml(user.username || '')}</div>
        </div>
        <div class="friend-actions">${actionBtn}</div>
      </div>
    `;
  }).join('');
}

/* ============================================
   طلبات الصداقة
   ============================================ */
async function sendFriendRequest(toUid) {
  if (!requireFriendsLogin()) return;
  if (!isFirebaseReady()) return;

  const fromUid = friendsState.currentUser.uid;
  if (fromUid === toUid) return;

  try {
    const requestId = `req_${fromUid}_${toUid}`;

    await window.firebaseHelpers.fbSetDoc(FRIENDS_COLLECTION, requestId, {
      fromUid,
      toUid,
      status: 'pending',
      createdAt: new Date().toISOString(),
      fromData: {
        fullName: friendsState.currentUser.fullName || '',
        username: friendsState.currentUser.username || '',
        avatar: friendsState.currentUser.avatar || ''
      }
    });

    await sendNotification(toUid, {
      type: 'friend_request',
      title: '👋 طلب صداقة جديد',
      body: `${friendsState.currentUser.fullName || friendsState.currentUser.username} أرسل لك طلب صداقة`,
      fromUid,
      fromName: friendsState.currentUser.fullName || friendsState.currentUser.username,
      link: 'friends_requests'
    });

    friendsState.sentRequests.push({ toUid, requestId });
    renderSearchResults();

    if (typeof showToast === 'function') showToast('✅ تم إرسال الطلب');
    if (typeof trackEvent === 'function') trackEvent('friend_request_sent');
  } catch (err) {
    if (typeof showToast === 'function') showToast('تعذر إرسال الطلب');
  }
}

async function loadFriendRequests() {
  if (!friendsState.currentUser) return;
  if (!isFirebaseReady()) return;

  try {
    const all = await window.firebaseHelpers.fbGetCollection(FRIENDS_COLLECTION);
    const myUid = friendsState.currentUser.uid;

    const pending = all.filter(r => r.toUid === myUid && r.status === 'pending');
    const sent = all.filter(r => r.fromUid === myUid && r.status === 'pending');

    const users = await window.firebaseHelpers.fbGetCollection('users');

    friendsState.friendRequests = pending.map(req => {
      const fromUser = users.find(u => u.uid === req.fromUid);
      return { ...req, user: fromUser || req.fromData };
    });

    friendsState.sentRequests = sent.map(r => ({
      toUid: r.toUid,
      requestId: r.id
    }));

    updateRequestsBadge();
  } catch (err) {
    friendsState.friendRequests = [];
    friendsState.sentRequests = [];
  }
}

function renderFriendRequests() {
  const list = document.getElementById('friendsRequestsList');
  if (!list) return;

  if (!friendsState.friendRequests.length) {
    list.innerHTML = `
      <div class="friends-empty">
        <span class="friends-empty-icon">📭</span>
        لا توجد طلبات جديدة
      </div>
    `;
    return;
  }

  list.innerHTML = friendsState.friendRequests.map(req => {
    const user = req.user || {};
    const initial = (user.fullName || user.username || 'م').charAt(0).toUpperCase();
    const avatar = user.avatar
      ? `<img src="${escapeHtml(user.avatar)}" alt="">`
      : escapeHtml(initial);

    return `
      <div class="friend-card">
        <div class="friend-avatar">${avatar}</div>
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(user.fullName || user.username || 'مستخدم')}</div>
          <div class="friend-username">@${escapeHtml(user.username || '')}</div>
        </div>
        <div class="friend-actions">
          <button class="friend-btn primary" onclick="acceptFriendRequest('${req.id}')" title="قبول">✓</button>
          <button class="friend-btn danger" onclick="rejectFriendRequest('${req.id}')" title="رفض">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

async function acceptFriendRequest(requestId) {
  if (!requireFriendsLogin()) return;
  if (!isFirebaseReady()) return;

  try {
    const req = friendsState.friendRequests.find(r => r.id === requestId);
    if (!req) return;

    await window.firebaseHelpers.fbSetDoc(FRIENDS_COLLECTION, requestId, {
      status: 'accepted',
      acceptedAt: new Date().toISOString()
    });

    await createOrGetChat(req.fromUid, req.toUid);

    await sendNotification(req.fromUid, {
      type: 'friend_accepted',
      title: '✅ تم قبول طلب الصداقة',
      body: `${friendsState.currentUser.fullName || friendsState.currentUser.username} قبل طلبك`,
      fromUid: friendsState.currentUser.uid,
      fromName: friendsState.currentUser.fullName,
      link: 'friends'
    });

    await loadFriends();
    await loadFriendRequests();
    await loadChats();

    renderFriendRequests();
    renderFriends();
    renderChats();

    if (typeof showToast === 'function') showToast('✅ تم قبول الصداقة');
    if (typeof trackEvent === 'function') trackEvent('friend_request_accepted');
  } catch (err) {
    if (typeof showToast === 'function') showToast('تعذر القبول');
  }
}

async function rejectFriendRequest(requestId) {
  if (!requireFriendsLogin()) return;
  if (!isFirebaseReady()) return;
  if (!confirm('رفض الطلب؟')) return;

  try {
    await window.firebaseHelpers.fbDeleteDoc(FRIENDS_COLLECTION, requestId);
    await loadFriendRequests();
    renderFriendRequests();
    if (typeof showToast === 'function') showToast('تم الرفض');
  } catch (err) {}
}

function updateRequestsBadge() {
  const badge = document.getElementById('requestsBadge');
  if (!badge) return;
  const count = friendsState.friendRequests.length;
  badge.textContent = count > 99 ? '99+' : count;
  badge.classList.toggle('show', count > 0);
}

/* ============================================
   قائمة الأصدقاء
   ============================================ */
async function loadFriends() {
  if (!friendsState.currentUser) return;
  if (!isFirebaseReady()) return;

  try {
    const all = await window.firebaseHelpers.fbGetCollection(FRIENDS_COLLECTION);
    const myUid = friendsState.currentUser.uid;

    const accepted = all.filter(r =>
      r.status === 'accepted' &&
      (r.fromUid === myUid || r.toUid === myUid)
    );

    const friendUids = accepted.map(r => r.fromUid === myUid ? r.toUid : r.fromUid);
    const users = await window.firebaseHelpers.fbGetCollection('users');
    friendsState.friends = users.filter(u => friendUids.includes(u.uid));
  } catch (err) {
    friendsState.friends = [];
  }
}

function renderFriends() {
  const list = document.getElementById('friendsList');
  if (!list) return;

  if (!friendsState.friends.length) {
    list.innerHTML = `
      <div class="friends-empty">
        <span class="friends-empty-icon">👥</span>
        لا يوجد أصدقاء بعد — ابحث عن مستخدمين
      </div>
    `;
    return;
  }

  list.innerHTML = friendsState.friends.map(user => {
    const initial = (user.fullName || user.username || 'م').charAt(0).toUpperCase();
    const avatar = user.avatar
      ? `<img src="${escapeHtml(user.avatar)}" alt="">`
      : escapeHtml(initial);

    const status = getCachedUserStatus(user.uid);

    return `
      <div class="friend-card">
        <div class="friend-avatar">
          ${avatar}
          <span class="friend-status-dot ${status}"></span>
        </div>
        <div class="friend-info">
          <div class="friend-name">${escapeHtml(user.fullName || user.username || 'مستخدم')}</div>
          <div class="friend-username">@${escapeHtml(user.username || '')}</div>
        </div>
        <div class="friend-actions">
          <button class="friend-btn primary" onclick="openChatWith('${user.uid}')" title="محادثة">💬</button>
          <button class="friend-btn danger" onclick="removeFriend('${user.uid}')" title="حذف">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

async function removeFriend(friendUid) {
  if (!requireFriendsLogin()) return;
  if (!isFirebaseReady()) return;
  if (!confirm('حذف هذا الصديق؟')) return;

  try {
    const all = await window.firebaseHelpers.fbGetCollection(FRIENDS_COLLECTION);
    const myUid = friendsState.currentUser.uid;

    const friendship = all.find(r =>
      r.status === 'accepted' &&
      ((r.fromUid === myUid && r.toUid === friendUid) ||
       (r.fromUid === friendUid && r.toUid === myUid))
    );

    if (friendship) {
      await window.firebaseHelpers.fbDeleteDoc(FRIENDS_COLLECTION, friendship.id);
    }

    await loadFriends();
    renderFriends();
    if (typeof showToast === 'function') showToast('تم الحذف');
  } catch (err) {}
}

/* ============================================
   حالة الاتصال — عبر PresenceSystem
   ============================================ */
function getCachedUserStatus(uid) {
  // ✅ استخدام PresenceSystem إذا متاح
  if (window.PresenceSystem) {
    return window.PresenceSystem.getStatus(uid).status;
  }

  try {
    const cached = JSON.parse(localStorage.getItem('tariq_user_status') || '{}');
    return cached[uid]?.status || 'offline';
  } catch {
    return 'offline';
  }
}

async function updateUserStatus(status = 'online') {
  if (!friendsState.currentUser) return;
  if (!isFirebaseReady()) return;

  // ✅ PresenceSystem يتولى هذا تلقائياً
  if (window.PresenceSystem) {
    return window.PresenceSystem.updateStatus(status);
  }

  try {
    await window.firebaseHelpers.fbSetDoc(USER_STATUS_COLLECTION, friendsState.currentUser.uid, {
      uid: friendsState.currentUser.uid,
      status,
      lastSeen: new Date().toISOString()
    });
  } catch (err) {}
}

/* ============================================
   المحادثات
   ============================================ */
async function createOrGetChat(uid1, uid2) {
  if (!isFirebaseReady()) return null;

  const chatId = [uid1, uid2].sort().join('_');

  try {
    const existing = await window.firebaseHelpers.fbGetDoc(CHATS_COLLECTION, chatId);
    if (existing) return existing;
  } catch (e) {}

  try {
    const chat = {
      id: chatId,
      type: 'private',
      members: [uid1, uid2],
      createdAt: new Date().toISOString(),
      lastMessage: null,
      lastMessageAt: new Date().toISOString()
    };

    await window.firebaseHelpers.fbSetDoc(CHATS_COLLECTION, chatId, chat);
    return chat;
  } catch (err) {
    try {
      await loadChats();
      return friendsState.chats.find(c => c.id === chatId) || null;
    } catch (e) {
      return null;
    }
  }
}

async function loadChats() {
  if (!friendsState.currentUser) return;
  if (!isFirebaseReady()) return;

  try {
    const all = await window.firebaseHelpers.fbGetCollection(CHATS_COLLECTION);
    const myUid = friendsState.currentUser.uid;

    const myChats = all.filter(c => c.members && c.members.includes(myUid));
    const users = await window.firebaseHelpers.fbGetCollection('users');

    await loadUnreadCounts();

    friendsState.chats = myChats.map(chat => {
      const otherUid = chat.members.find(m => m !== myUid);
      const otherUser = users.find(u => u.uid === otherUid) || { fullName: 'مستخدم' };
      const unread = friendsState.unreadCounts[chat.id] || 0;

      return {
        ...chat,
        otherUser,
        displayName: chat.type === 'group' ? chat.name : otherUser.fullName,
        displayAvatar: chat.type === 'group' ? null : otherUser.avatar,
        unreadCount: unread
      };
    }).sort((a, b) => {
      const aTime = toTimestamp(a.lastMessageAt || a.createdAt);
      const bTime = toTimestamp(b.lastMessageAt || b.createdAt);
      return bTime - aTime;
    });
  } catch (err) {
    friendsState.chats = [];
  }
}

async function loadUnreadCounts() {
  if (!friendsState.currentUser) return;
  if (!isFirebaseReady()) return;

  try {
    const messages = await window.firebaseHelpers.fbGetCollection(MESSAGES_COLLECTION);
    const myUid = friendsState.currentUser.uid;
    const myChatIds = friendsState.chats.map(c => c.id);

    const counts = {};
    messages.forEach(msg => {
      if (msg.fromUid === myUid) return;
      if (!myChatIds.includes(msg.chatId) && friendsState.chats.length > 0) return;

      const lastRead = friendsState.lastSeenMessages[msg.chatId] || 0;
      const msgTime = toTimestamp(msg.createdAt);
      if (msgTime > lastRead) {
        counts[msg.chatId] = (counts[msg.chatId] || 0) + 1;
      }
    });

    friendsState.unreadCounts = counts;
    updateTotalUnreadBadge();
  } catch (err) {}
}

function updateTotalUnreadBadge() {
  const total = Object.values(friendsState.unreadCounts).reduce((a, b) => a + b, 0);
  const navBadge = document.querySelector('.nav-item[onclick*="showFriends"] .nav-badge');
  if (navBadge) {
    navBadge.textContent = total > 99 ? '99+' : total;
    navBadge.classList.toggle('show', total > 0);
  }
}

function renderChats() {
  const list = document.getElementById('chatsList');
  if (!list) return;

  if (!friendsState.chats.length) {
    list.innerHTML = `
      <div class="friends-empty">
        <span class="friends-empty-icon">💬</span>
        لا توجد محادثات — ابدأ بالتواصل مع أصدقائك
      </div>
    `;
    return;
  }

  list.innerHTML = friendsState.chats.map(chat => {
    const displayName = chat.displayName || 'محادثة';
    const initial = displayName.charAt(0).toUpperCase();
    const avatar = chat.displayAvatar
      ? `<img src="${escapeHtml(chat.displayAvatar)}" alt="">`
      : escapeHtml(initial);

    const preview = chat.lastMessage?.text || 'لا توجد رسائل بعد';
    const time = chat.lastMessageAt ? formatRelativeTime(chat.lastMessageAt) : '';
    const unread = chat.unreadCount || 0;

    // ✅ Presence: نقطة الحالة
    const status = chat.type === 'private' ? getCachedUserStatus(chat.otherUser?.uid) : '';

    return `
      <div class="chat-item ${unread > 0 ? 'unread' : ''}" onclick="openChat('${chat.id}')">
        <div class="friend-avatar">
          ${avatar}
          ${status ? `<span class="friend-status-dot ${status}"></span>` : ''}
        </div>
        <div class="chat-info">
          <div class="chat-header">
            <div class="chat-name">${escapeHtml(displayName)}</div>
            <div class="chat-time">${time}</div>
          </div>
          <div class="chat-preview">${escapeHtml(preview.slice(0, 50))}</div>
        </div>
        ${unread > 0 ? `<div class="chat-unread-badge">${unread > 99 ? '99+' : unread}</div>` : ''}
      </div>
    `;
  }).join('');
}

function listenToChats() {
  if (friendsState.unsubscribeChats) {
    try { friendsState.unsubscribeChats(); } catch (e) {}
    friendsState.unsubscribeChats = null;
  }

  if (!isFirebaseReady()) return;
  if (!friendsState.currentUser) return;

  try {
    friendsState.unsubscribeChats = window.firebaseHelpers.fbListenCollection(
      CHATS_COLLECTION,
      async () => {
        await loadChats();
        if (friendsState.activeTab === 'chats') renderChats();
      }
    );
  } catch (e) {}
}

function listenToFriendships() {
  if (friendsState.unsubscribeFriendships) {
    try { friendsState.unsubscribeFriendships(); } catch (e) {}
  }

  if (!isFirebaseReady()) return;

  try {
    friendsState.unsubscribeFriendships = window.firebaseHelpers.fbListenCollection(
      FRIENDS_COLLECTION,
      async (all) => {
        if (!friendsState.currentUser) return;
        const myUid = friendsState.currentUser.uid;
        const pending = all.filter(r => r.toUid === myUid && r.status === 'pending');

        if (pending.length > friendsState.friendRequests.length) {
          const newReqs = pending.filter(p => !friendsState.friendRequests.some(fr => fr.id === p.id));
          newReqs.forEach(req => {
            showInAppNotification({
              title: '👋 طلب صداقة جديد',
              body: `${req.fromData?.fullName || 'مستخدم'} أرسل لك طلب صداقة`,
              icon: '👥',
              color: 'gold',
              link: 'friends_requests',
              type: 'friend_request'
            });
          });
        }

        await loadFriendRequests();
        await loadFriends();
        renderFriendRequests();
        renderFriends();
      }
    );
  } catch (e) {}
}

/* ============================================
   ✅ نافذة الدردشة — عبر ChatFloatWindow
   ============================================ */
async function openChatWith(uid) {
  if (!requireFriendsLogin()) return;
  if (!isFirebaseReady()) {
    if (typeof showToast === 'function') showToast('تعذر الاتصال');
    return;
  }

  const myUid = friendsState.currentUser.uid;
  if (typeof showToast === 'function') showToast('جارٍ فتح المحادثة...');

  const chat = await createOrGetChat(myUid, uid);

  if (!chat) {
    if (typeof showToast === 'function') showToast('تعذر إنشاء المحادثة');
    return;
  }

  await loadChats();
  renderChats();
  await openChat(chat.id);
}

async function openChat(chatId) {
  // ✅ إزالة إشعارات هذه المحادثة فوراً
  if (window.NotificationManager) {
    window.NotificationManager.clearByChat(chatId);
  }

  if (!requireFriendsLogin()) return;

  let chat = friendsState.chats.find(c => c.id === chatId);

  if (!chat) {
    await loadChats();
    chat = friendsState.chats.find(c => c.id === chatId);
  }

  if (!chat) {
    if (typeof showToast === 'function') showToast('المحادثة غير موجودة');
    return;
  }

  friendsState.activeChat = chat;

  // ✅ استخدام ChatFloatWindow الجديد
  if (window.ChatFloatWindow) {
    window.ChatFloatWindow.open(chat);
    markChatAsRead(chatId);

    if (typeof trackEvent === 'function') {
      trackEvent('chat_opened');
    }
    return;
  }

  // Fallback: النافذة القديمة (إن وُجدت)
  const chatWindow = document.getElementById('chatWindow');
  if (!chatWindow) return;

  const nameEl = document.getElementById('chatWindowName');
  const statusEl = document.getElementById('chatWindowStatus');
  const avatarEl = document.getElementById('chatWindowAvatar');

  const displayName = chat.displayName || 'محادثة';
  const initial = displayName.charAt(0).toUpperCase();

  if (nameEl) nameEl.textContent = displayName;
  if (avatarEl) {
    avatarEl.innerHTML = chat.displayAvatar
      ? `<img src="${escapeHtml(chat.displayAvatar)}" alt="">`
      : escapeHtml(initial);
  }
  if (statusEl && chat.type === 'private') {
    const status = getCachedUserStatus(chat.otherUser?.uid);
    statusEl.className = `chat-window-status ${status}`;
    statusEl.textContent = status === 'online' ? 'متصل الآن' : 'غير متصل';
  }

  chatWindow.classList.add('open');
  chatWindow.classList.remove('minimized');

  markChatAsRead(chatId);

  await loadChatMessages(chatId);
  listenToMessages(chatId);
  listenToTyping(chatId);

  setTimeout(() => document.getElementById('chatInput')?.focus(), 300);
}

async function closeChat() {
  // ✅ إغلاق النافذة العائمة
  if (window.ChatFloatWindow) {
    window.ChatFloatWindow.close();
    return;
  }

  const chatWindow = document.getElementById('chatWindow');
  if (chatWindow) chatWindow.classList.remove('open');

  if (friendsState.unsubscribeMessages) {
    try { friendsState.unsubscribeMessages(); } catch (e) {}
    friendsState.unsubscribeMessages = null;
  }

  if (friendsState.unsubscribeTyping) {
    try { friendsState.unsubscribeTyping(); } catch (e) {}
    friendsState.unsubscribeTyping = null;
  }

  friendsState.activeChat = null;
  friendsState.messages = [];
  friendsState.groupedMessages = [];
}

function minimizeChat() {
  if (window.ChatFloatWindow) {
    window.ChatFloatWindow.toggleMinimize();
    return;
  }

  const chatWindow = document.getElementById('chatWindow');
  if (chatWindow) chatWindow.classList.toggle('minimized');
}

/* ============================================
   تحميل الرسائل (لـ Fallback)
   ============================================ */
async function loadChatMessages(chatId) {
  if (!isFirebaseReady()) return;

  try {
    const all = await window.firebaseHelpers.fbGetCollection(MESSAGES_COLLECTION);

    friendsState.messages = all
      .filter(m => m.chatId === chatId)
      .map(m => ({ ...m, _ts: toTimestamp(m.createdAt) }))
      .sort((a, b) => a._ts - b._ts);

    friendsState.groupedMessages = groupMessagesByDay(friendsState.messages);
    renderChatMessages();
  } catch (err) {
    console.warn('[Friends] Load messages error:', err.message);
  }
}

function groupMessagesByDay(messages) {
  const groups = [];
  let currentDay = null;
  let currentGroup = null;

  messages.forEach(msg => {
    const ts = msg._ts || toTimestamp(msg.createdAt);
    if (!ts) return;

    const date = new Date(ts);
    const dayKey = date.toDateString();

    if (dayKey !== currentDay) {
      currentDay = dayKey;
      currentGroup = {
        dayLabel: formatDayLabel(date),
        messages: []
      };
      groups.push(currentGroup);
    }

    currentGroup.messages.push({ ...msg, _dateObj: date });
  });

  return groups;
}

function formatDayLabel(date) {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today) return 'اليوم';
  if (date.toDateString() === yesterday.toDateString()) return 'أمس';

  const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  return `${days[date.getDay()]}، ${date.getDate()} ${months[date.getMonth()]}`;
}

/* ============================================
   عرض الرسائل (Fallback)
   ============================================ */
function renderChatMessages() {
  const body = document.getElementById('chatWindowBody');
  if (!body) return;

  const myUid = friendsState.currentUser?.uid;

  if (!friendsState.groupedMessages.length) {
    body.innerHTML = `
      <div class="friends-empty" style="border: none; background: transparent;">
        <span class="friends-empty-icon">👋</span>
        ابدأ المحادثة الآن
      </div>
    `;
    return;
  }

  const html = friendsState.groupedMessages.map(group => {
    const messagesHtml = group.messages.map((msg, index) => {
      const isSent = msg.fromUid === myUid;
      const prevMsg = group.messages[index - 1];
      const nextMsg = group.messages[index + 1];

      const isSameAsPrev = prevMsg && prevMsg.fromUid === msg.fromUid;
      const isSameAsNext = nextMsg && nextMsg.fromUid === msg.fromUid;

      const classes = [
        'chat-message',
        isSent ? 'sent' : 'received',
        isSameAsPrev ? 'grouped-with-prev' : 'first-in-group',
        isSameAsNext ? 'grouped-with-next' : 'last-in-group'
      ].filter(Boolean).join(' ');

      const time = formatMessageTime(msg._dateObj);

      return `
        <div class="${classes}" data-message-id="${msg.id}">
          <div class="chat-message-bubble">
            <div class="chat-message-text">${escapeHtml(msg.text || '')}</div>
            <div class="chat-message-meta">
              <span class="chat-message-time">${time}</span>
              ${isSent ? '<span class="chat-message-status">✓✓</span>' : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="chat-day-group">
        <div class="chat-day-divider"><span>${group.dayLabel}</span></div>
        ${messagesHtml}
      </div>
    `;
  }).join('');

  body.innerHTML = html;
  scrollToBottom(body, false);
}

function formatMessageTime(dateObj) {
  if (!dateObj || !(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }

  try {
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  } catch {
    return '';
  }
}

function scrollToBottom(container, smooth = true) {
  if (!container) return;

  const isNearBottom =
    container.scrollHeight - container.scrollTop - container.clientHeight < 100;

  setTimeout(() => {
    if (smooth && isNearBottom) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    } else {
      container.scrollTop = container.scrollHeight;
    }
  }, 50);
}

/* ============================================
   الاستماع للرسائل (Fallback)
   ============================================ */
function listenToMessages(chatId) {
  if (friendsState.unsubscribeMessages) {
    try { friendsState.unsubscribeMessages(); } catch (e) {}
    friendsState.unsubscribeMessages = null;
  }

  if (!isFirebaseReady()) return;

  try {
    friendsState.unsubscribeMessages = window.firebaseHelpers.fbListenCollection(
      MESSAGES_COLLECTION,
      (all) => {
        const newMessages = all
          .filter(m => m.chatId === chatId)
          .map(m => ({ ...m, _ts: toTimestamp(m.createdAt) }))
          .sort((a, b) => a._ts - b._ts);

        friendsState.messages = newMessages;
        friendsState.groupedMessages = groupMessagesByDay(newMessages);
        renderChatMessages();
        markChatAsRead(chatId);
      }
    );
  } catch (e) {}
}

/* ============================================
   مؤشر الكتابة
   ============================================ */
let typingTimeout = null;

async function updateTypingStatus() {
  if (!friendsState.activeChat) return;
  if (!isFirebaseReady()) return;

  const chatId = friendsState.activeChat.id;
  const myUid = friendsState.currentUser?.uid;
  if (!myUid) return;

  const typingDocId = `${chatId}_${myUid}`;

  try {
    await window.firebaseHelpers.fbSetDoc(TYPING_COLLECTION, typingDocId, {
      chatId,
      uid: myUid,
      name: friendsState.currentUser.fullName || 'مستخدم',
      typing: true,
      updatedAt: new Date().toISOString()
    });
  } catch (e) {}

  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(async () => {
    try {
      await window.firebaseHelpers.fbSetDoc(TYPING_COLLECTION, typingDocId, {
        typing: false,
        updatedAt: new Date().toISOString()
      });
    } catch (e) {}
  }, 3000);
}

function listenToTyping(chatId) {
  if (friendsState.unsubscribeTyping) {
    try { friendsState.unsubscribeTyping(); } catch (e) {}
    friendsState.unsubscribeTyping = null;
  }

  if (!isFirebaseReady()) return;

  try {
    friendsState.unsubscribeTyping = window.firebaseHelpers.fbListenCollection(
      TYPING_COLLECTION,
      (all) => {
        const myUid = friendsState.currentUser?.uid;
        const peerTyping = all.find(t =>
          t.chatId === chatId &&
          t.uid !== myUid &&
          t.typing === true &&
          Date.now() - toTimestamp(t.updatedAt) < 5000
        );

        friendsState.peerTyping = !!peerTyping;
        updateTypingIndicator(peerTyping);
      }
    );
  } catch (e) {}
}

function updateTypingIndicator(peer) {
  // ✅ ChatFloatWindow يتولى العرض
  if (window.ChatFloatWindow?.isOpen?.()) return;

  const statusEl = document.getElementById('chatWindowStatus');
  if (!statusEl) return;

  if (peer) {
    statusEl.textContent = 'يكتب الآن...';
    statusEl.classList.add('typing');
  } else {
    const chat = friendsState.activeChat;
    if (chat?.type === 'private') {
      const status = getCachedUserStatus(chat.otherUser?.uid);
      statusEl.textContent = status === 'online' ? 'متصل الآن' : 'غير متصل';
      statusEl.classList.remove('typing');
    }
  }
}

/* ============================================
   إرسال رسالة
   ============================================ */
async function sendChatMessage() {
  if (!requireFriendsLogin()) return;
  if (!isFirebaseReady()) return;

  const input = document.getElementById('chatInput');
  const text = input?.value.trim();
  if (!text) return;

  const chat = friendsState.activeChat;
  if (!chat) return;

  const sendBtn = document.getElementById('chatSendBtn');
  if (sendBtn) sendBtn.disabled = true;

  try {
    const messageData = {
      chatId: chat.id,
      fromUid: friendsState.currentUser.uid,
      fromName: friendsState.currentUser.fullName || friendsState.currentUser.username || 'مستخدم',
      text,
      createdAt: new Date().toISOString()
    };

    await window.firebaseHelpers.fbAddDoc(MESSAGES_COLLECTION, messageData);

    await window.firebaseHelpers.fbSetDoc(CHATS_COLLECTION, chat.id, {
      lastMessage: {
        text,
        fromUid: friendsState.currentUser.uid,
        at: new Date().toISOString()
      },
      lastMessageAt: new Date().toISOString()
    });

    const typingDocId = `${chat.id}_${friendsState.currentUser.uid}`;
    try {
      await window.firebaseHelpers.fbSetDoc(TYPING_COLLECTION, typingDocId, {
        typing: false
      });
    } catch (e) {}

    if (chat.type === 'private' && chat.otherUser?.uid) {
      await sendNotification(chat.otherUser.uid, {
        type: 'chat_message',
        title: `💬 رسالة من ${friendsState.currentUser.fullName || 'مستخدم'}`,
        body: text.slice(0, 100),
        fromUid: friendsState.currentUser.uid,
        fromName: friendsState.currentUser.fullName,
        chatId: chat.id,
        link: 'chat'
      });
    }

    if (input) {
      input.value = '';
      input.style.height = 'auto';
    }
    input?.focus();

    if (typeof trackEvent === 'function') trackEvent('chat_message_sent');
  } catch (err) {
    if (typeof showToast === 'function') showToast('تعذر إرسال الرسالة');
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

function handleChatInputKeydown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendChatMessage();
  }
}

function autoResizeChatInput() {
  const input = document.getElementById('chatInput');
  if (!input) return;
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';
}

function markChatAsRead(chatId) {
  friendsState.lastSeenMessages[chatId] = Date.now();
  friendsState.unreadCounts[chatId] = 0;
  saveLastSeenMessages();
  updateTotalUnreadBadge();
  renderChats();

  // ✅ إزالة إشعارات هذه المحادثة
  if (window.NotificationManager) {
    window.NotificationManager.clearByChat(chatId);
  }
}

/* ============================================
   ✅ إشعارات — عبر NotificationManager
   ============================================ */
async function sendNotification(toUid, data) {
  if (!isFirebaseReady()) return;

  const myUid = friendsState.currentUser?.uid;

  if (toUid === myUid) {
    console.log('[Friends] Skip notification to self');
    return;
  }

  try {
    const notificationId = 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    await window.firebaseHelpers.fbSetDoc(NOTIFICATIONS_COLLECTION, notificationId, {
      id: notificationId,
      toUid,
      fromUid: data.fromUid || null,
      fromName: data.fromName || null,
      type: data.type || 'general',
      title: data.title || '',
      body: data.body || '',
      link: data.link || '',
      chatId: data.chatId || null,
      read: false,
      createdAt: new Date().toISOString()
    });

    if (window.notificationSystem && window.notificationSystem.sendPush) {
      const result = await window.notificationSystem.sendPush(toUid, data);

      if (result.ok) {
        console.log('✅ Push sent to:', toUid);
      } else if (result.error !== 'duplicate') {
        console.warn('[Friends] Push failed:', result.error);
      }
    }
  } catch (err) {
    console.warn('[Friends] Send notification error:', err.message);
  }
}

/* ============================================
   الاستماع للإشعارات الجديدة
   ============================================ */
function listenToNotifications() {
  if (friendsState.unsubscribeNotifications) {
    try { friendsState.unsubscribeNotifications(); } catch (e) {}
  }

  if (!isFirebaseReady()) return;
  if (!friendsState.currentUser) return;

  try {
    friendsState.unsubscribeNotifications = window.firebaseHelpers.fbListenCollection(
      NOTIFICATIONS_COLLECTION,
      (all) => {
        const myUid = friendsState.currentUser?.uid;
        if (!myUid) return;

        const myUnread = all.filter(n =>
          n.toUid === myUid &&
          !n.read &&
          !friendsState.readNotifs.has(n.id)
        );

        const pageOpenTime = Number(sessionStorage.getItem('tariq_page_open') || 0);

        const newNotifs = myUnread.filter(n => {
          const createdTs = toTimestamp(n.createdAt);
          return createdTs > pageOpenTime;
        });

        newNotifs.slice(0, 3).forEach(n => {
          showInAppNotification({
            title: n.title,
            body: n.body,
            icon: n.type === 'friend_request' ? '👥' :
                  n.type === 'friend_accepted' ? '✅' :
                  n.type === 'chat_message' ? '💬' : '🔔',
            color: n.type === 'friend_request' ? 'gold' :
                   n.type === 'friend_accepted' ? 'green' : 'blue',
            link: n.link,
            chatId: n.chatId,
            notifId: n.id,
            type: n.type
          });
        });

        updateNotificationsBadge(myUnread.length);
      }
    );
  } catch (e) {}
}

function updateNotificationsBadge(count) {
  const navItem = document.querySelector('.nav-item[onclick*="showFriends"]');
  if (!navItem) return;

  let badge = navItem.querySelector('.nav-badge');
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'nav-badge';
    navItem.appendChild(badge);
  }

  badge.textContent = count > 99 ? '99+' : count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

/* ============================================
   ✅ showInAppNotification — عبر NotificationManager
   ============================================ */
function showInAppNotification({ title, body, icon = '🔔', color = 'gold', link, chatId, notifId, type }) {
  // ✅ استخدام NotificationManager الجديد
  if (window.NotificationManager) {
    window.NotificationManager.show({
      title,
      body,
      icon,
      color,
      link,
      chatId,
      notifId,
      type: type || (link === 'chat' ? 'chat_message' :
                     link === 'friends_requests' ? 'friend_request' : 'general')
    });
    return;
  }

  // Fallback: الكود القديم (إن لم يُحمّل Manager)
  console.warn('NotificationManager not loaded — using fallback');

  let container = document.getElementById('inAppNotifications');
  if (!container) {
    container = document.createElement('div');
    container.id = 'inAppNotifications';
    container.className = 'in-app-notifications';
    document.body.appendChild(container);
  }

  const notif = document.createElement('div');
  notif.className = `in-app-notif ${color}`;
  notif.innerHTML = `
    <button class="in-app-notif-close" onclick="this.parentElement.remove()">✕</button>
    <div class="in-app-notif-icon">${icon}</div>
    <div class="in-app-notif-content">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
    </div>
  `;

  notif.onclick = (e) => {
    if (e.target.classList.contains('in-app-notif-close')) return;

    if (notifId) {
      markNotifAsRead(notifId);
      markNotificationRead(notifId).catch(() => {});
    }

    if (link === 'friends_requests') {
      showFriends();
      setTimeout(() => switchFriendsTab('requests'), 500);
    } else if (link === 'friends') {
      showFriends();
      setTimeout(() => switchFriendsTab('friends'), 500);
    } else if (link === 'chat' && chatId) {
      showFriends();
      setTimeout(() => openChat(chatId), 500);
    }

    notif.remove();
  };

  container.appendChild(notif);

  setTimeout(() => {
    notif.classList.add('fade-out');
    setTimeout(() => notif.remove(), 400);
  }, 8000);
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);

    setTimeout(() => ctx.close(), 500);
  } catch (e) {}
}

async function markNotificationRead(notifId) {
  if (!isFirebaseReady()) return;
  try {
    await window.firebaseHelpers.fbSetDoc(NOTIFICATIONS_COLLECTION, notifId, { read: true });
  } catch (e) {}
}

/* ============================================
   إنشاء قروب
   ============================================ */
function renderGroupCreator() {
  const list = document.getElementById('groupMembersList');
  if (!list) return;

  if (!friendsState.friends.length) {
    list.innerHTML = `
      <div class="friends-empty">
        <span class="friends-empty-icon">👥</span>
        أضف أصدقاء أولاً لإنشاء قروب
      </div>
    `;
    return;
  }

  list.innerHTML = friendsState.friends.map(user => {
    const initial = (user.fullName || user.username || 'م').charAt(0).toUpperCase();
    const avatar = user.avatar
      ? `<img src="${escapeHtml(user.avatar)}" alt="">`
      : escapeHtml(initial);

    return `
      <div class="group-member-row" data-uid="${user.uid}" onclick="toggleGroupMember('${user.uid}', this)">
        <div class="friend-avatar" style="width: 36px; height: 36px; font-size: 0.9rem;">${avatar}</div>
        <div class="friend-info">
          <div class="friend-name" style="font-size: 0.88rem;">${escapeHtml(user.fullName || user.username)}</div>
          <div class="friend-username">@${escapeHtml(user.username || '')}</div>
        </div>
        <div class="group-member-check">✓</div>
      </div>
    `;
  }).join('');
}

function toggleGroupMember(uid, element) {
  element.classList.toggle('selected');
}

async function createGroup() {
  if (!requireFriendsLogin()) return;
  if (!isFirebaseReady()) return;

  const nameInput = document.getElementById('groupNameInput');
  const name = nameInput?.value.trim();

  if (!name) {
    if (typeof showToast === 'function') showToast('اكتب اسم القروب');
    return;
  }

  const selected = [...document.querySelectorAll('.group-member-row.selected')].map(el => el.dataset.uid);
  if (selected.length < 2) {
    if (typeof showToast === 'function') showToast('اختر صديقين على الأقل');
    return;
  }

  const myUid = friendsState.currentUser.uid;
  const members = [myUid, ...selected];
  const chatId = 'group_' + Date.now();

  try {
    await window.firebaseHelpers.fbSetDoc(CHATS_COLLECTION, chatId, {
      id: chatId,
      type: 'group',
      name,
      members,
      createdBy: myUid,
      createdAt: new Date().toISOString(),
      lastMessageAt: new Date().toISOString()
    });

    for (const uid of selected) {
      await sendNotification(uid, {
        type: 'group_invite',
        title: '👨‍👩‍👦 قروب جديد',
        body: `${friendsState.currentUser.fullName} أضافك لقروب "${name}"`,
        fromUid: myUid,
        fromName: friendsState.currentUser.fullName,
        chatId,
        link: 'chat'
      });
    }

    if (nameInput) nameInput.value = '';
    document.querySelectorAll('.group-member-row.selected').forEach(el => el.classList.remove('selected'));

    await loadChats();
    renderChats();
    switchFriendsTab('chats');

    if (typeof showToast === 'function') showToast('✅ تم إنشاء القروب');
    if (typeof trackEvent === 'function') trackEvent('group_created');
  } catch (err) {
    if (typeof showToast === 'function') showToast('تعذر إنشاء القروب');
  }
}

/* ============================================
   أدوات مساعدة
   ============================================ */
function escapeHtml(text) {
  return String(text || '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function formatRelativeTime(iso) {
  if (!iso) return '';

  const ts = toTimestamp(iso);
  if (!ts) return '';

  const date = new Date(ts);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diff = (now - date) / 1000;

  if (diff < 60) return 'الآن';
  if (diff < 3600) return `${Math.floor(diff / 60)} د`;
  if (diff < 86400) {
    return date.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 172800) return 'أمس';
  if (diff < 604800) return `${Math.floor(diff / 86400)} أيام`;

  return date.toLocaleDateString('ar-IQ', { day: '2-digit', month: '2-digit' });
}

/* ============================================
   التصدير
   ============================================ */
window.showFriends = showFriends;
window.switchFriendsTab = switchFriendsTab;
window.searchUsers = searchUsers;
window.sendFriendRequest = sendFriendRequest;
window.acceptFriendRequest = acceptFriendRequest;
window.rejectFriendRequest = rejectFriendRequest;
window.removeFriend = removeFriend;
window.openChat = openChat;
window.openChatWith = openChatWith;
window.closeChat = closeChat;
window.minimizeChat = minimizeChat;
window.sendChatMessage = sendChatMessage;
window.handleChatInputKeydown = handleChatInputKeydown;
window.autoResizeChatInput = autoResizeChatInput;
window.toggleGroupMember = toggleGroupMember;
window.createGroup = createGroup;
window.markNotificationRead = markNotificationRead;
window.showInAppNotification = showInAppNotification;

/* ============================================
   بدء تلقائي
   ============================================ */
document.addEventListener('DOMContentLoaded', async () => {
  loadReadNotifs();
  await loadLastSeenMessages();

  sessionStorage.setItem('tariq_page_open', Date.now().toString());

  const ready = await waitForFirebase(15000);
  if (!ready) return;

  try {
    window.firebaseHelpers.fbOnAuthStateChanged(async (user) => {
      if (user) {
        await waitForUser();
        friendsState.currentUser = getCurrentFriendsUser();

        if (friendsState.currentUser) {
          try {
            await loadLastSeenMessages();
            await loadFriends();
            await loadFriendRequests();
            await loadChats();

            // ✅ PresenceSystem يتولى الحالة
            if (window.PresenceSystem) {
              window.PresenceSystem.start().catch(() => {});
            }

            listenToNotifications();

            renderChats();
            renderFriends();
            renderFriendRequests();
          } catch (e) {}
        }
      } else {
        friendsState.currentUser = null;
        if (window.PresenceSystem) {
          window.PresenceSystem.stop().catch(() => {});
        }
      }
    });
  } catch (e) {}
});

window.addEventListener('beforeunload', () => {
  // ✅ PresenceSystem يتولى الإيقاف
  if (window.PresenceSystem) {
    window.PresenceSystem.stop().catch(() => {});
  }
});