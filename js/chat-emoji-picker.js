/* ============================================
   Chat Emoji Picker — v1.0
   منتقي إيموجي كامل مع تصنيفات
   ============================================ */

const ChatEmojiPicker = (() => {
  'use strict';

  let isOpen = false;
  let currentCategory = 'smileys';
  let onEmojiSelect = null;

  /* ============================================
     مكتبة الإيموجي
     ============================================ */
  const EMOJI_LIBRARY = {
    smileys: {
      name: 'وجوه',
      icon: '😀',
      emojis: [
        '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰',
        '😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏',
        '😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠',
        '😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥',
        '😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐',
        '🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻',
        '💀','☠️','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾','🙈',
        '🙉','🙊','💋','💌','💘','💝','💖','💗','💓','💞','💕','💟','❣️','💔','❤️','🧡',
        '💛','💚','💙','💜','🤎','🖤','🤍','💯','💢','💥','💫','💦','💨','🕳️','💬','💭'
      ]
    },
    people: {
      name: 'أشخاص',
      icon: '👍',
      emojis: [
        '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆',
        '🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️',
        '💅','🤳','💪','🦾','🦵','🦿','🦶','👂','🦻','👃','🧠','🦷','🦴','👀','👁️','👅',
        '👄','💋','🩸','👶','🧒','👦','👧','🧑','👨','👩','🧓','👴','👵','🙍','🙎','🙅',
        '🙆','💁','🙋','🧏','🙇','🤦','🤷','👮','🕵️','💂','🥷','👷','🤴','👸','👳','👲',
        '🧕','🤵','👰','🤰','🤱','👼','🎅','🤶','🦸','🦹','🧙','🧚','🧛','🧜','🧝','🧞'
      ]
    },
    nature: {
      name: 'طبيعة',
      icon: '🌹',
      emojis: [
        '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐽','🐸','🐵',
        '🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺','🐗',
        '🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🕷️','🕸️','🦂','🐢','🐍','🦎',
        '🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅',
        '🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃','🐂','🐄','🐎','🐖',
        '🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐕‍🦺','🐈','🐈‍⬛','🪶','🐓','🦃','🦚','🦜',
        '🌸','💮','🏵️','🌹','🥀','🌺','🌻','🌼','🌷','🌱','🌲','🌳','🌴','🌵','🌾','🌿',
        '☘️','🍀','🍁','🍂','🍃','🍄','🌰','🌞','🌝','🌚','🌙','⭐','🌟','✨','⚡','🔥'
      ]
    },
    food: {
      name: 'طعام',
      icon: '🍕',
      emojis: [
        '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥',
        '🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠',
        '🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴',
        '🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝',
        '🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡',
        '🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜',
        '☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊'
      ]
    },
    symbols: {
      name: 'رموز',
      icon: '❤️',
      emojis: [
        '❤️','🧡','💛','💚','💙','💜','🤎','🖤','🤍','💔','❣️','💕','💞','💓','💗','💖',
        '💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈',
        '♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️',
        '📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹',
        '🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️',
        '🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️',
        '⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎','🌐','💠','Ⓜ️','🌀',
        '💤','🏧','🚾','♿','🅿️','🈳','🈂️','🛂','🛃','🛄','🛅','🚹','🚺','🚼','🚻','🚮'
      ]
    }
  };

  /* ============================================
     إنشاء لوحة الإيموجي
     ============================================ */
  function createPicker() {
    const picker = document.createElement('div');
    picker.className = 'chat-emoji-picker';
    picker.id = 'chatEmojiPicker';

    picker.innerHTML = `
      <div class="chat-emoji-header">
        <div class="chat-emoji-tabs" id="chatEmojiTabs">
          ${Object.entries(EMOJI_LIBRARY).map(([key, cat]) => `
            <button class="chat-emoji-tab ${key === 'smileys' ? 'active' : ''}"
                    data-category="${key}"
                    title="${cat.name}">
              ${cat.icon}
            </button>
          `).join('')}
        </div>
        <button class="chat-emoji-close" id="chatEmojiClose" title="إغلاق">✕</button>
      </div>
      <div class="chat-emoji-body" id="chatEmojiBody">
        <!-- الإيموجي هنا -->
      </div>
    `;

    return picker;
  }

  /* ============================================
     عرض الإيموجي لفئة معينة
     ============================================ */
  function renderEmojis(category) {
    const body = document.getElementById('chatEmojiBody');
    if (!body) return;

    const cat = EMOJI_LIBRARY[category];
    if (!cat) return;

    body.innerHTML = cat.emojis.map(emoji => `
      <button class="chat-emoji-item" data-emoji="${emoji}">${emoji}</button>
    `).join('');

    // ربط الأحداث
    body.querySelectorAll('.chat-emoji-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectEmoji(btn.dataset.emoji);
      });
    });
  }

  /* ============================================
     اختيار إيموجي
     ============================================ */
  function selectEmoji(emoji) {
    if (onEmojiSelect) {
      onEmojiSelect(emoji);
    }

    // اهتزاز خفيف (اختياري)
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }

  /* ============================================
     فتح / إغلاق
     ============================================ */
  function open(callback) {
    onEmojiSelect = callback;

    let picker = document.getElementById('chatEmojiPicker');

    if (!picker) {
      picker = createPicker();
      document.body.appendChild(picker);
      bindEvents();
    }

    renderEmojis(currentCategory);

    // إظهار
    requestAnimationFrame(() => {
      picker.classList.add('show');
      isOpen = true;
    });
  }

  function close() {
    const picker = document.getElementById('chatEmojiPicker');
    if (picker) {
      picker.classList.remove('show');
      isOpen = false;
    }
  }

  function toggle(callback) {
    if (isOpen) close();
    else open(callback);
  }

  /* ============================================
     ربط الأحداث
     ============================================ */
  function bindEvents() {
    // التصنيفات
    document.getElementById('chatEmojiTabs')?.addEventListener('click', (e) => {
      const tab = e.target.closest('.chat-emoji-tab');
      if (!tab) return;

      const category = tab.dataset.category;
      currentCategory = category;

      // تحديث الحالة
      document.querySelectorAll('.chat-emoji-tab').forEach(t => {
        t.classList.toggle('active', t === tab);
      });

      renderEmojis(category);
    });

    // زر الإغلاق
    document.getElementById('chatEmojiClose')?.addEventListener('click', close);

    // إغلاق عند النقر خارج المنتقي
    document.addEventListener('click', (e) => {
      if (!isOpen) return;
      const picker = document.getElementById('chatEmojiPicker');
      if (!picker) return;

      if (!picker.contains(e.target) &&
          !e.target.closest('[data-emoji-trigger]')) {
        close();
      }
    });
  }

  /* ============================================
     التصدير
     ============================================ */
  return {
    open,
    close,
    toggle,
    isOpen: () => isOpen
  };
})();

window.ChatEmojiPicker = ChatEmojiPicker;
console.log('✅ ChatEmojiPicker loaded');