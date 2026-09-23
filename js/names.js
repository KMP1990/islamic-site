/* ===== أسماء الله الحسنى — v2 ===== */
const ALLAH_NAMES = [
  ['الرَّحْمَنُ', 'واسع الرحمة'], ['الرَّحِيمُ', 'دائم الرحمة'], ['الْمَلِكُ', 'مالك الملك'], ['الْقُدُّوسُ', 'المنزّه عن كل نقص'], ['السَّلَامُ', 'مصدر السلامة'], ['الْمُؤْمِنُ', 'واهب الأمان'], ['الْمُهَيْمِنُ', 'الرقيب الحافظ'], ['الْعَزِيزُ', 'الغالب الذي لا يُغلب'], ['الْجَبَّارُ', 'جابر القلوب'], ['الْمُتَكَبِّرُ', 'المتعالي عن صفات الخلق'], ['الْخَالِقُ', 'مبدع كل شيء'], ['الْبَارِئُ', 'المنشئ بلا مثال'], ['الْمُصَوِّرُ', 'معطي كل مخلوق صورته'], ['الْغَفَّارُ', 'كثير المغفرة'], ['الْقَهَّارُ', 'الغالب لكل شيء'], ['الْوَهَّابُ', 'كثير العطاء'], ['الرَّزَّاقُ', 'خالق الأرزاق وواهبها'], ['الْفَتَّاحُ', 'فاتح أبواب الخير'], ['الْعَلِيمُ', 'المحيط بكل علم'], ['الْقَابِضُ', 'يقبض بحكمته'], ['الْبَاسِطُ', 'يبسط فضله'], ['الْخَافِضُ', 'يخفض من يشاء بعدله'], ['الرَّافِعُ', 'يرفع من يشاء بفضله'], ['الْمُعِزُّ', 'مانح العزة'], ['المُذِلُّ', 'مانع العزة عمن يشاء'], ['السَّمِيعُ', 'الذي يسمع كل شيء'], ['الْبَصِيرُ', 'الذي يرى كل شيء'], ['الْحَكَمُ', 'الحاكم بالحق'], ['الْعَدْلُ', 'المنزّه عن الظلم'], ['اللَّطِيفُ', 'الرفيق بعباده'], ['الْخَبِيرُ', 'العالم بدقائق الأمور'], ['الْحَلِيمُ', 'لا يعجل بالعقوبة'], ['الْعَظِيمُ', 'ذو العظمة والكمال'], ['الْغَفُورُ', 'واسع المغفرة'], ['الشَّكُورُ', 'المثيب على القليل بالكثير'], ['الْعَلِيُّ', 'المتعالي عن كل نقص'], ['الْكَبِيرُ', 'العظيم الذي لا أعظم منه'], ['الْحَفِيظُ', 'الحافظ لكل شيء'], ['المُقِيتُ', 'موصل الأقوات'], ['الْحَسِيبُ', 'الكافي لعباده'], ['الْجَلِيلُ', 'عظيم الصفات'], ['الْكَرِيمُ', 'كثير الخير والعطاء'], ['الرَّقِيبُ', 'المطّلع على كل شيء'], ['الْمُجِيبُ', 'مجيب دعاء الداعين'], ['الْوَاسِعُ', 'واسع الفضل والرحمة'], ['الْحَكِيمُ', 'واضع الأشياء مواضعها'], ['الْوَدُودُ', 'المحب لعباده الصالحين'], ['الْمَجِيدُ', 'عظيم الشرف'], ['الْبَاعِثُ', 'باعث الخلق يوم القيامة'], ['الشَّهِيدُ', 'الحاضر الذي لا يغيب'], ['الْحَقُّ', 'الثابت الذي لا يتغير'], ['الْوَكِيلُ', 'الكفيل بأمور عباده'], ['الْقَوِيُّ', 'كامل القوة'], ['الْمَتِينُ', 'شديد القوة'], ['الْوَلِيُّ', 'ناصر عباده المؤمنين'], ['الْحَمِيدُ', 'المستحق للحمد'], ['الْمُحْصِي', 'المحيط بعدد الأشياء'], ['الْمُبْدِئُ', 'منشئ الخلق'], ['الْمُعِيدُ', 'يعيد الخلق بعد الموت'], ['الْمُحْيِي', 'واهب الحياة'], ['الْمُمِيتُ', 'مقدّر الموت'], ['الْحَيُّ', 'الكامل الحياة'], ['الْقَيُّومُ', 'القائم بنفسه المقيم لغيره'], ['الْوَاجِدُ', 'الذي لا يعوزه شيء'], ['الْمَاجِدُ', 'واسع الكرم'], ['الْوَاحِدُ', 'المتفرد في ذاته'], ['الأَحَدُ', 'الفرد الذي لا مثيل له'], ['الصَّمَدُ', 'المقصود في الحوائج'], ['الْقَادِرُ', 'المتمكن من كل شيء'], ['الْمُقْتَدِرُ', 'تام القدرة'], ['الْمُقَدِّمُ', 'يقدم من يشاء بحكمته'], ['الْمُؤَخِّرُ', 'يؤخر من يشاء بحكمته'], ['الأَوَّلُ', 'ليس قبله شيء'], ['الآخِرُ', 'ليس بعده شيء'], ['الظَّاهِرُ', 'فوق كل شيء'], ['الْبَاطِنُ', 'المحيط بكل شيء'], ['الْوَالِي', 'مالك التدبير'], ['الْمُتَعَالِي', 'المتعالي عن صفات الخلق'], ['الْبَرُّ', 'كثير الإحسان'], ['التَّوَّابُ', 'كثير قبول التوبة'], ['الْمُنْتَقِمُ', 'الآخذ بحق المظلوم'], ['العَفُوُّ', 'المتجاوز عن السيئات'], ['الرَّؤُوفُ', 'شديد الرحمة'], ['مَالِكُ الْمُلْكِ', 'المتصرف في الملك'], ['ذُو الْجَلَالِ وَالإِكْرَامِ', 'صاحب العظمة والكرم'], ['الْمُقْسِطُ', 'العادل في حكمه'], ['الْجَامِعُ', 'جامع الخلق ليوم الحساب'], ['الْغَنِيُّ', 'المستغني عن خلقه'], ['الْمُغْنِي', 'المغني لعباده'], ['الْمَانِعُ', 'مانع ما شاء بحكمته'], ['الضَّارُ', 'المقدّر للضر بحكمته'], ['النَّافِعُ', 'المقدّر للنفع'], ['النُّورُ', 'منوّر السماوات والأرض'], ['الْهَادِي', 'هادي الخلق إلى الحق'], ['الْبَدِيعُ', 'خالق بلا مثال'], ['الْبَاقِي', 'الدائم الذي لا يفنى'], ['الْوَارِثُ', 'الباقي بعد فناء الخلق'], ['الرَّشِيدُ', 'المرشد إلى الصواب'], ['الصَّبُورُ', 'لا يعجل بالعقوبة']
];

let namesFilter = 'all';
let namesQuery = '';
let favoriteNames = new Set(JSON.parse(localStorage.getItem('favoriteAllahNames') || '[]'));

/* ✅ دوال مساعدة محلية — مستقلة عن listen.js */
function setActiveFeatureView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');
}

function closeSidebarIfOpenLocal() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar && sidebar.classList.contains('open')) {
    sidebar.classList.remove('open');
    overlay?.classList.remove('show');
  }
}

function showNames() {
  setActiveFeatureView('namesView');

  // تحديث active في Sidebar
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  const items = document.querySelectorAll('.nav-item');
  if (items[5]) items[5].classList.add('active');

  closeSidebarIfOpenLocal();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  renderNames();
}

function renderNames() {
  const grid = document.getElementById('namesGrid');
  if (!grid) return;
  const visible = ALLAH_NAMES.map((name, index) => ({ name, index: index + 1 }))
    .filter(item => namesFilter !== 'favorites' || favoriteNames.has(item.index))
    .filter(item => !namesQuery || item.name[0].includes(namesQuery) || item.name[1].includes(namesQuery));

  grid.innerHTML = visible.length ? visible.map(item => `
    <article class="name-card ${favoriteNames.has(item.index) ? 'is-favorite' : ''}">
      <button class="name-favorite" onclick="toggleNameFavorite(${item.index})" aria-label="إضافة للمفضلة">${favoriteNames.has(item.index) ? '♥' : '♡'}</button>
      <span class="name-number">${String(item.index).padStart(2, '0')}</span>
      <h2>${item.name[0]}</h2>
      <p>${item.name[1]}</p>
    </article>`).join('') : '<div class="names-empty">لا توجد أسماء مطابقة لبحثك</div>';
  const count = document.getElementById('favoriteNamesCount');
  if (count) count.textContent = favoriteNames.size;
}

function filterNames(value) {
  namesQuery = value.trim();
  renderNames();
}

function setNamesFilter(filter) {
  namesFilter = filter;
  document.getElementById('allNamesBtn')?.classList.toggle('active', filter === 'all');
  document.getElementById('favoriteNamesBtn')?.classList.toggle('active', filter === 'favorites');
  renderNames();
}

function toggleNameFavorite(index) {
  favoriteNames.has(index) ? favoriteNames.delete(index) : favoriteNames.add(index);
  localStorage.setItem('favoriteAllahNames', JSON.stringify([...favoriteNames]));
  renderNames();
}

function showRandomName() {
  const item = ALLAH_NAMES[Math.floor(Math.random() * ALLAH_NAMES.length)];
  const query = document.getElementById('namesSearch');
  if (query) query.value = item[0];
  namesQuery = item[0];
  setNamesFilter('all');
  document.getElementById('namesGrid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

window.showNames = showNames;
window.filterNames = filterNames;
window.setNamesFilter = setNamesFilter;
window.toggleNameFavorite = toggleNameFavorite;
window.showRandomName = showRandomName;

window.addEventListener('DOMContentLoaded', renderNames);