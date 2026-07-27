// =============================================
// 認証（ローカル・メール＋パスワード）
// =============================================

const AUTH_USERS_KEY = 'aquacultureUsers';
const AUTH_SESSION_KEY = 'aquacultureSession';

// SHA-256ハッシュ（Web Crypto API）
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ユーザー一覧取得
function getUsers() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_USERS_KEY) || '[]');
    } catch {
        return [];
    }
}

// 現在のセッション取得
function getSession() {
    try {
        return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY) || 'null');
    } catch {
        return null;
    }
}

// 新規登録
async function registerUser(email, password) {
    const users = getUsers();
    if (users.find(u => u.email === email)) {
        throw new Error('このメールアドレスはすでに登録されています');
    }
    const passwordHash = await hashPassword(password);
    users.push({ email, passwordHash });
    localStorage.setItem(AUTH_USERS_KEY, JSON.stringify(users));
}

// ログイン
async function loginUser(email, password) {
    const users = getUsers();
    const user = users.find(u => u.email === email);
    if (!user) throw new Error('メールアドレスまたはパスワードが正しくありません');
    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) throw new Error('メールアドレスまたはパスワードが正しくありません');
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ email, loginTime: Date.now() }));
}

// ログアウト
function logout() {
    localStorage.removeItem(AUTH_SESSION_KEY);
    location.reload();
}

// ログイン後にメインアプリを表示
function showMainApp(email) {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    document.getElementById('headerUserEmail').textContent = email;
    initDB();
}

// 認証画面の表示制御
let authMode = 'login'; // 'login' | 'register'

function setupAuthUI() {
    const session = getSession();
    if (session) {
        showMainApp(session.email);
        return;
    }

    document.getElementById('authScreen').style.display = 'flex';

    const form = document.getElementById('authForm');
    const toggleBtn = document.getElementById('authToggleBtn');

    toggleBtn.addEventListener('click', () => {
        authMode = authMode === 'login' ? 'register' : 'login';
        const isRegister = authMode === 'register';
        document.getElementById('authSubtitle').textContent = isRegister ? '新規登録' : 'ログイン';
        document.getElementById('authSubmitBtn').textContent = isRegister ? '登録する' : 'ログイン';
        document.getElementById('authToggleText').textContent = isRegister ? 'すでにアカウントをお持ちの方は' : 'アカウントをお持ちでない方は';
        toggleBtn.textContent = isRegister ? 'ログイン' : '新規登録';
        document.getElementById('authPasswordConfirmField').style.display = isRegister ? 'block' : 'none';
        document.getElementById('authPasswordConfirm').required = isRegister;
        document.getElementById('authError').style.display = 'none';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        const errorEl = document.getElementById('authError');
        errorEl.style.display = 'none';

        if (password.length < 8) {
            errorEl.textContent = 'パスワードは8文字以上で入力してください';
            errorEl.style.display = 'block';
            return;
        }

        try {
            if (authMode === 'register') {
                const confirm = document.getElementById('authPasswordConfirm').value;
                if (password !== confirm) {
                    errorEl.textContent = 'パスワードが一致しません';
                    errorEl.style.display = 'block';
                    return;
                }
                await registerUser(email, password);
                await loginUser(email, password);
            } else {
                await loginUser(email, password);
            }
            showMainApp(email);
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.style.display = 'block';
        }
    });
}

// =============================================
// データストレージ（SQLiteのキャッシュ）
let dataStore = {
    water: [],
    environment: [],
    biology: [],
    operation: [],
    economy: [],
    redtide: []
};

// SQLiteデータベースインスタンス
let db = null;

// データフィールド定義
const dataFields = {
    water: [
        { name: 'temperature', label: '水温(℃)', type: 'number', step: '0.1' },
        { name: 'salinity', label: '塩分濃度(%)', type: 'number', step: '0.1' },
        { name: 'oxygen', label: '溶存酸素(mg/L)', type: 'number', step: '0.1' },
        { name: 'ph', label: 'pH値', type: 'number', step: '0.1' },
        { name: 'turbidity', label: '濁度(NTU)', type: 'number', step: '0.1' },
        { name: 'ammonia', label: 'アンモニア(mg/L)', type: 'number', step: '0.01' }
    ],
    environment: [
        { name: 'airTemp', label: '気温(℃)', type: 'number', step: '0.1' },
        { name: 'humidity', label: '湿度(%)', type: 'number', step: '1' },
        { name: 'windSpeed', label: '風速(m/s)', type: 'number', step: '0.1' },
        { name: 'sunlight', label: '日照時間(h)', type: 'number', step: '0.1' },
        { name: 'rainfall', label: '降水量(mm)', type: 'number', step: '0.1' },
        { name: 'waveHeight', label: '波高(m)', type: 'number', step: '0.1' }
    ],
    biology: [
        { name: 'count', label: '個体数', type: 'number', step: '1' },
        { name: 'avgWeight', label: '平均体重(g)', type: 'number', step: '0.1' },
        { name: 'feedAmount', label: '摂餌量(kg)', type: 'number', step: '0.1' },
        { name: 'survivalRate', label: '生存率(%)', type: 'number', step: '0.1' },
        { name: 'mortality', label: '死亡数', type: 'number', step: '1' },
        { name: 'diseaseCount', label: '疾病発生数', type: 'number', step: '1' },
        { name: 'photo', label: '個体写真', type: 'image' }
    ],
    operation: [
        { name: 'feedTimes', label: '給餌回数', type: 'number', step: '1' },
        { name: 'feedAmount', label: '給餌量(kg)', type: 'number', step: '0.1' },
        { name: 'workHours', label: '作業時間(h)', type: 'number', step: '0.5' },
        { name: 'workers', label: '人員数', type: 'number', step: '1' },
        { name: 'medicineUsed', label: '薬剤使用(有無)', type: 'select', options: ['なし', '抗生物質', 'ワクチン', 'その他'] },
        { name: 'harvestAmount', label: '収穫量(kg)', type: 'number', step: '0.1' }
    ],
    economy: [
        { name: 'feedCost', label: '餌代(円)', type: 'number', step: '1' },
        { name: 'utilityCost', label: '光熱費(円)', type: 'number', step: '1' },
        { name: 'laborCost', label: '人件費(円)', type: 'number', step: '1' },
        { name: 'medicineCost', label: '薬剤費(円)', type: 'number', step: '1' },
        { name: 'maintenanceCost', label: '設備維持費(円)', type: 'number', step: '1' },
        { name: 'revenue', label: '売上(円)', type: 'number', step: '1' }
    ],
    // 赤潮データ（独立ビュー）。latitude/longitude/radiusKm はモーダルの地図ピッカー＋
    // スライダーで入力する（REDTIDE_PICKER_FIELDS で汎用フォームから除外）。
    redtide: [
        { name: 'species', label: 'プランクトン種類', type: 'select', options: ['シャットネラ', 'カレニア', '夜光虫', 'ヘテロカプサ', 'その他'] },
        { name: 'cellDensity', label: '細胞密度(cells/mL)', type: 'number', step: '1' },
        { name: 'oxygen', label: '溶存酸素(mg/L)', type: 'number', step: '0.1' },
        { name: 'waterTemp', label: '水温(℃)', type: 'number', step: '0.1' },
        { name: 'seaColor', label: '海水の色', type: 'select', options: ['正常', '褐色', '赤褐色', '緑褐色'] },
        { name: 'deadCount', label: '斃死数(尾)', type: 'number', step: '1' },
        { name: 'response', label: '対応措置', type: 'select', options: ['なし', '給餌停止', '生簀移動', '曝気', 'その他'] },
        { name: 'latitude', label: '緯度', type: 'number', step: '0.000001' },
        { name: 'longitude', label: '経度', type: 'number', step: '0.000001' },
        { name: 'radiusKm', label: '広がり半径(km)', type: 'number', step: '0.1' }
    ]
};

// チャートインスタンス
let charts = {};

// 赤潮の地図インスタンス（一覧地図＋位置ピッカー）。
// CLAUDE.md のグローバル制限の例外として設計仕様書 §6 で承認済み。
const redtideMaps = { list: null, listLayers: null, picker: null, pickerMarker: null, pickerCircle: null };

// 海水の色 → 円/マーカーの色（赤潮＝赤系）
const REDTIDE_COLORS = {
    '正常': '#2f8f6f',
    '褐色': '#b5742a',
    '赤褐色': '#c0392b',
    '緑褐色': '#6f8f2a',
    default: '#c0392b'
};

// 赤潮グラフの系列色。色覚多様性・コントラストの検証済み（dataviz の6チェック全PASS）
const REDTIDE_CHART_COLORS = {
    cellDensity: '#c0392b',
    oxygen: '#0097a7',
    waterTemp: '#b5742a'
};

// 一覧地図・ピッカーの初期表示（九州西岸〜瀬戸内が収まる位置）
const REDTIDE_DEFAULT_CENTER = [33.0, 131.5];
const REDTIDE_DEFAULT_ZOOM = 6;

// 赤潮の年月日フィルタ状態（YYYY-MM-DD の文字列、空なら無制限）
const redtideFilter = { start: '', end: '' };

// 現在選択中の写真データ (base64)
let currentPhotoData = { add: null, edit: null };

// ページネーション状態
const currentPage = { water: 1, environment: 1, biology: 1, operation: 1, economy: 1, redtide: 1 };
const PAGE_SIZE = 20;

// HTMLエスケープ
function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// CSVセルエスケープ（RFC 4180）
function escapeCSVCell(value) {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// Uint8Array → Base64
function uint8ArrayToBase64(arr) {
    let binary = '';
    for (let i = 0; i < arr.length; i++) {
        binary += String.fromCharCode(arr[i]);
    }
    return btoa(binary);
}

// テーブル作成（IF NOT EXISTS で冪等）
function createTables() {
    db.run(`CREATE TABLE IF NOT EXISTS water (
        id REAL PRIMARY KEY, timestamp TEXT,
        temperature REAL, salinity REAL, oxygen REAL, ph REAL, turbidity REAL, ammonia REAL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS environment (
        id REAL PRIMARY KEY, timestamp TEXT,
        airTemp REAL, humidity REAL, windSpeed REAL, sunlight REAL, rainfall REAL, waveHeight REAL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS biology (
        id REAL PRIMARY KEY, timestamp TEXT,
        count REAL, avgWeight REAL, feedAmount REAL, survivalRate REAL,
        mortality REAL, diseaseCount REAL, photo TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS operation (
        id REAL PRIMARY KEY, timestamp TEXT,
        feedTimes REAL, feedAmount REAL, workHours REAL, workers REAL,
        medicineUsed TEXT, harvestAmount REAL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS economy (
        id REAL PRIMARY KEY, timestamp TEXT,
        feedCost REAL, utilityCost REAL, laborCost REAL,
        medicineCost REAL, maintenanceCost REAL, revenue REAL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS redtide (
        id REAL PRIMARY KEY, timestamp TEXT,
        species TEXT, cellDensity REAL, oxygen REAL, waterTemp REAL,
        seaColor TEXT, deadCount REAL, response TEXT,
        latitude REAL, longitude REAL, radiusKm REAL
    )`);
}

// SQLiteからカテゴリデータを読み込んで配列で返す
function loadCategory(category) {
    const fields = ['id', 'timestamp', ...dataFields[category].map(f => f.name)];
    const result = db.exec(`SELECT ${fields.join(', ')} FROM ${category} ORDER BY timestamp ASC`);
    if (!result.length) return [];
    const cols = result[0].columns;
    return result[0].values.map(row => {
        const obj = {};
        cols.forEach((col, i) => { obj[col] = row[i]; });
        return obj;
    });
}

// すべてのカテゴリをdataStoreに再読み込み
function reloadAllCategories() {
    Object.keys(dataStore).forEach(cat => {
        dataStore[cat] = loadCategory(cat);
    });
}

// 1カテゴリをdataStoreに再読み込み
function reloadDataStoreCategory(category) {
    dataStore[category] = loadCategory(category);
}

// SQLiteをlocalStorageに保存
function saveDB() {
    const data = db.export();
    localStorage.setItem('aquacultureDB', uint8ArrayToBase64(data));
}

// データベースを初期化（非同期）
async function initDB() {
    const SQL = await initSqlJs({
        locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.10.2/dist/${file}`
    });

    const saved = localStorage.getItem('aquacultureDB');
    if (saved) {
        try {
            const binary = atob(saved);
            const buf = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
            db = new SQL.Database(buf);
            createTables(); // 新テーブルが増えた場合への対応
        } catch (e) {
            db = new SQL.Database();
            createTables();
            generateSampleData();
        }
    } else {
        db = new SQL.Database();
        createTables();
        generateSampleData();
    }

    seedRedtideSampleIfEmpty();
    reloadAllCategories();
    renderAllData();
}

// 赤潮テーブルが空のときだけサンプルを投入（実データ未入手のための開発用ダミー）。
// 実データ運用開始後は行を削除するか、この関数の呼び出しを外す。
function seedRedtideSampleIfEmpty() {
    const res = db.exec('SELECT COUNT(*) FROM redtide');
    const count = res.length ? res[0].values[0][0] : 0;
    if (count > 0) return;

    const now = new Date();
    let idBase = Date.now() + 500000;
    const speciesList = ['シャットネラ', 'カレニア', '夜光虫', 'ヘテロカプサ', 'その他'];
    const responseList = ['なし', '給餌停止', '生簀移動', '曝気', 'その他'];
    // 九州西岸〜瀬戸内を想定したダミー座標（褐色〜赤褐色の発生を模擬）
    const spots = [
        { lat: 32.75, lng: 129.87, color: '赤褐色' },
        { lat: 33.24, lng: 132.56, color: '褐色' },
        { lat: 31.58, lng: 131.41, color: '赤褐色' },
        { lat: 34.34, lng: 133.19, color: '緑褐色' },
        { lat: 32.05, lng: 130.02, color: '褐色' }
    ];

    for (let i = 0; i < spots.length; i++) {
        const date = new Date(now.getTime() - i * 3 * 24 * 60 * 60 * 1000);
        const spot = spots[i];
        db.run('INSERT INTO redtide VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            ++idBase, date.toISOString(),
            speciesList[i % speciesList.length],
            5000 + Math.floor(Math.random() * 20000),
            3 + Math.random() * 4,
            22 + Math.random() * 6,
            spot.color,
            Math.floor(Math.random() * 500),
            responseList[i % responseList.length],
            spot.lat, spot.lng,
            0.5 + Math.random() * 8
        ]);
    }
    saveDB();
}

// サンプルデータ生成
function generateSampleData() {
    const now = new Date();
    let idBase = Date.now();

    for (let i = 30; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const ts = date.toISOString();

        db.run('INSERT INTO water VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
            ++idBase, ts,
            18 + Math.random() * 4, 3.2 + Math.random() * 0.3,
            6 + Math.random() * 2, 7.5 + Math.random() * 0.5,
            2 + Math.random() * 3, 0.1 + Math.random() * 0.2
        ]);

        db.run('INSERT INTO environment VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
            ++idBase, ts,
            20 + Math.random() * 5, 60 + Math.random() * 20,
            2 + Math.random() * 5, 5 + Math.random() * 5,
            Math.random() * 10, 0.5 + Math.random() * 1
        ]);

        db.run('INSERT INTO biology VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [
            ++idBase, ts,
            10000 - Math.floor(Math.random() * 100), 50 + i * 2 + Math.random() * 10,
            80 + Math.random() * 20, 95 + Math.random() * 4,
            Math.floor(Math.random() * 10), Math.floor(Math.random() * 3), null
        ]);

        db.run('INSERT INTO operation VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
            ++idBase, ts,
            3, 80 + Math.random() * 20, 6 + Math.random() * 3,
            3 + Math.floor(Math.random() * 2),
            ['なし', 'なし', '抗生物質'][Math.floor(Math.random() * 3)],
            Math.random() > 0.8 ? 100 + Math.random() * 50 : 0
        ]);

        db.run('INSERT INTO economy VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
            ++idBase, ts,
            30000 + Math.random() * 10000, 10000 + Math.random() * 5000,
            50000 + Math.random() * 10000, Math.random() * 5000,
            5000 + Math.random() * 5000,
            Math.random() > 0.8 ? 200000 + Math.random() * 100000 : 0
        ]);
    }
    saveDB();
}

// タブ切り替え
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', function() {
        const category = this.dataset.category;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.category-section').forEach(s => s.classList.remove('active'));
        this.classList.add('active');
        document.getElementById(category).classList.add('active');
    });
});

// 赤潮ビューの表示切替（ヘッダーは共有し、タブ＋カテゴリ領域のみ入れ替える）
function showRedtideView() {
    document.querySelector('.tabs').style.display = 'none';
    document.querySelector('.content').style.display = 'none';
    document.getElementById('redtideView').style.display = 'block';
    renderRedtideView();
}

function hideRedtideView() {
    document.getElementById('redtideView').style.display = 'none';
    document.querySelector('.tabs').style.display = '';
    document.querySelector('.content').style.display = '';
}

// ===== 赤潮：地図・統計・グラフ・フィルタ =====

// 赤潮ビュー全体を（フィルタ後データで）描画
function renderRedtideView() {
    const data = getFilteredRedtide();
    renderTable('redtide', data);
    renderRedtideStats(data);
    renderRedtideChart(data);
    renderRedtideMap(data);
}

// 一覧地図：フィルタ後の各記録をマーカー＋範囲円で描画
function renderRedtideMap(data) {
    const mapEl = document.getElementById('redtideMap');
    if (!mapEl || typeof L === 'undefined') return;

    if (!redtideMaps.list) {
        redtideMaps.list = L.map('redtideMap').setView(REDTIDE_DEFAULT_CENTER, REDTIDE_DEFAULT_ZOOM);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 18,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(redtideMaps.list);
        redtideMaps.listLayers = L.layerGroup().addTo(redtideMaps.list);
    }
    redtideMaps.list.invalidateSize();
    redtideMaps.listLayers.clearLayers();

    const points = [];
    data.forEach(item => {
        const lat = Number(item.latitude), lng = Number(item.longitude);
        if (!isFinite(lat) || !isFinite(lng)) return;
        const color = REDTIDE_COLORS[item.seaColor] || REDTIDE_COLORS.default;
        const radiusM = Math.max(Number(item.radiusKm) || 0, 0.1) * 1000;

        L.circle([lat, lng], { radius: radiusM, color, fillColor: color, fillOpacity: 0.2, weight: 1 })
            .addTo(redtideMaps.listLayers);
        const marker = L.circleMarker([lat, lng], { radius: 6, color, fillColor: color, fillOpacity: 0.9, weight: 1 })
            .addTo(redtideMaps.listLayers);

        const d = new Date(item.timestamp);
        const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
        marker.bindPopup(
            `<strong>${escapeHtml(dateStr)}</strong><br>` +
            `種類: ${escapeHtml(String(item.species ?? '-'))}<br>` +
            `細胞密度: ${escapeHtml(String(item.cellDensity ?? '-'))} cells/mL<br>` +
            `斃死数: ${escapeHtml(String(item.deadCount ?? '-'))} 尾<br>` +
            `半径: ${escapeHtml(String(item.radiusKm ?? '-'))} km`
        );
        points.push([lat, lng]);
    });

    if (points.length) {
        redtideMaps.list.fitBounds(points, { padding: [30, 30], maxZoom: 10 });
    } else {
        redtideMaps.list.setView(REDTIDE_DEFAULT_CENTER, REDTIDE_DEFAULT_ZOOM);
    }
}

// 赤潮 専用統計（件数・最大細胞密度・平均溶存酸素・平均水温・合計斃死数）
function renderRedtideStats(data) {
    const el = document.getElementById('redtide-stats');
    if (!el) return;
    if (!data.length) { el.innerHTML = ''; return; }

    const nums = key => data.map(d => Number(d[key])).filter(v => isFinite(v));
    const sum = arr => arr.reduce((a, b) => a + b, 0);
    const cell = nums('cellDensity');
    const oxy = nums('oxygen');
    const temp = nums('waterTemp');
    const dead = nums('deadCount');

    const cards = [
        { label: '記録件数', value: `${data.length} 件` },
        { label: '最大細胞密度(cells/mL)', value: cell.length ? Math.max(...cell).toLocaleString() : '-' },
        { label: '平均溶存酸素(mg/L)', value: oxy.length ? (sum(oxy) / oxy.length).toFixed(1) : '-' },
        { label: '平均水温(℃)', value: temp.length ? (sum(temp) / temp.length).toFixed(1) : '-' },
        { label: '合計斃死数(尾)', value: dead.length ? sum(dead).toLocaleString() : '-' }
    ];

    el.innerHTML = cards.map(c => `
        <div class="stat-card">
            <div class="stat-label">${escapeHtml(c.label)}</div>
            <div class="stat-value">${escapeHtml(String(c.value))}</div>
        </div>
    `).join('');
}
// 赤潮 専用グラフ。細胞密度と溶存酸素/水温はスケールが2桁以上違うため、
// 2軸1枚ではなく x軸（日付）を共有する2枚の単軸グラフに分ける（誤読防止）。
function renderRedtideChart(data) {
    const cellCanvas = document.getElementById('redtideChart');
    const envCanvas = document.getElementById('redtideEnvChart');
    if (charts.redtide) { charts.redtide.destroy(); charts.redtide = null; }
    if (charts.redtideEnv) { charts.redtideEnv.destroy(); charts.redtideEnv = null; }
    if (!data.length) return;

    const sorted = data.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const labels = sorted.map(item => {
        const d = new Date(item.timestamp);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    const line = (label, key, color) => ({
        label,
        data: sorted.map(i => i[key]),
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        pointRadius: 4,
        tension: 0.3,
        fill: false
    });
    const baseOptions = (showLegend, yTitle) => ({
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 2,
        plugins: {
            legend: showLegend
                ? { position: 'bottom', labels: { padding: 15, font: { size: 11 } } }
                : { display: false },
            tooltip: { mode: 'index', intersect: false }
        },
        scales: {
            y: { beginAtZero: true, title: { display: true, text: yTitle }, grid: { color: 'rgba(0,0,0,0.05)' } },
            x: { grid: { display: false } }
        }
    });

    // 単系列なので凡例は出さない（タイトルが系列名を示す）
    if (cellCanvas) {
        charts.redtide = new Chart(cellCanvas, {
            type: 'line',
            data: { labels, datasets: [line('細胞密度(cells/mL)', 'cellDensity', REDTIDE_CHART_COLORS.cellDensity)] },
            options: baseOptions(false, 'cells/mL')
        });
    }

    if (envCanvas) {
        charts.redtideEnv = new Chart(envCanvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    line('溶存酸素(mg/L)', 'oxygen', REDTIDE_CHART_COLORS.oxygen),
                    line('水温(℃)', 'waterTemp', REDTIDE_CHART_COLORS.waterTemp)
                ]
            },
            options: baseOptions(true, 'mg/L ／ ℃')
        });
    }
}
// timestamp をローカル日付の YYYY-MM-DD にする。
// DB には ISO(UTC・シード) と datetime-local(ローカル・ユーザー入力) が混在するため、
// 文字列を切らずに Date を通してローカル日付へそろえる。
function toLocalDateStr(timestamp) {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '';
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// dataStore.redtide を年月日フィルタで絞り込む（JS側フィルタ・SQL再クエリはしない）
function getFilteredRedtide() {
    const { start, end } = redtideFilter;
    if (!start && !end) return dataStore.redtide;
    return dataStore.redtide.filter(item => {
        const t = toLocalDateStr(item.timestamp);
        if (!t) return false;
        if (start && t < start) return false;
        if (end && t > end) return false;
        return true;
    });
}

// ピッカー対象フィールド（汎用フォームループから除外し、地図ピッカーで入力）
const REDTIDE_PICKER_FIELDS = ['latitude', 'longitude', 'radiusKm'];

// モーダル内 位置ピッカーのHTML（prefix は 'add' / 'edit'）
function redtidePickerHtml(prefix, lat, lng, radius) {
    const latVal = isFinite(Number(lat)) && lat !== null ? Number(lat) : '';
    const lngVal = isFinite(Number(lng)) && lng !== null ? Number(lng) : '';
    const rad = isFinite(Number(radius)) && radius !== null ? Number(radius) : 1;
    return `
        <div class="form-group">
            <label>発生地点（地図をクリックして指定）</label>
            <div id="${prefix}-redtidePickerMap" class="redtide-picker-map"></div>
            <div class="redtide-latlng-row">
                <input type="number" id="${prefix}-latitude" step="0.000001" placeholder="緯度" value="${latVal}" readonly required>
                <input type="number" id="${prefix}-longitude" step="0.000001" placeholder="経度" value="${lngVal}" readonly required>
            </div>
        </div>
        <div class="form-group">
            <label>広がり半径(km): <span id="${prefix}-radius-display">${rad}</span></label>
            <input type="range" id="${prefix}-radiusKm" min="0.1" max="50" step="0.1" value="${rad}"
                oninput="onRedtideRadiusInput('${prefix}')">
        </div>
    `;
}

// ピッカー地図を（再）初期化
function initRedtidePicker(prefix, lat, lng, radius) {
    const el = document.getElementById(`${prefix}-redtidePickerMap`);
    if (!el || typeof L === 'undefined') return;

    if (redtideMaps.picker) { redtideMaps.picker.remove(); }
    redtideMaps.picker = null;
    redtideMaps.pickerMarker = null;
    redtideMaps.pickerCircle = null;

    const hasPoint = lat !== null && lng !== null && isFinite(Number(lat)) && isFinite(Number(lng));
    const center = hasPoint ? [Number(lat), Number(lng)] : REDTIDE_DEFAULT_CENTER;
    const map = L.map(el).setView(center, hasPoint ? 9 : REDTIDE_DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    redtideMaps.picker = map;

    if (hasPoint) setRedtidePickerPoint(prefix, Number(lat), Number(lng));
    map.on('click', (e) => setRedtidePickerPoint(prefix, e.latlng.lat, e.latlng.lng));
    setTimeout(() => map.invalidateSize(), 150);
}

// クリック地点をマーカー＋緯度経度入力へ反映
function setRedtidePickerPoint(prefix, lat, lng) {
    const map = redtideMaps.picker;
    if (!map) return;
    document.getElementById(`${prefix}-latitude`).value = lat.toFixed(6);
    document.getElementById(`${prefix}-longitude`).value = lng.toFixed(6);
    if (redtideMaps.pickerMarker) {
        redtideMaps.pickerMarker.setLatLng([lat, lng]);
    } else {
        redtideMaps.pickerMarker = L.circleMarker([lat, lng], {
            radius: 6, color: '#c0392b', fillColor: '#c0392b', fillOpacity: 0.9, weight: 1
        }).addTo(map);
    }
    updateRedtidePickerCircle(prefix);
}

// スライダー入力：半径表示とプレビュー円を更新
function onRedtideRadiusInput(prefix) {
    document.getElementById(`${prefix}-radius-display`).textContent =
        document.getElementById(`${prefix}-radiusKm`).value;
    updateRedtidePickerCircle(prefix);
}

// プレビュー円を更新（マーカー未設置なら何もしない）
function updateRedtidePickerCircle(prefix) {
    const map = redtideMaps.picker;
    if (!map || !redtideMaps.pickerMarker) return;
    const center = redtideMaps.pickerMarker.getLatLng();
    const km = parseFloat(document.getElementById(`${prefix}-radiusKm`).value) || 0.1;
    if (redtideMaps.pickerCircle) {
        redtideMaps.pickerCircle.setLatLng(center).setRadius(km * 1000);
    } else {
        redtideMaps.pickerCircle = L.circle(center, {
            radius: km * 1000, color: '#c0392b', fillColor: '#c0392b', fillOpacity: 0.2, weight: 1
        }).addTo(map);
    }
}

// 赤潮の緯度経度バリデーション（prefix は 'add' / 'edit'）
function validateRedtideInputs(prefix) {
    const lat = parseFloat(document.getElementById(`${prefix}-latitude`).value);
    const lng = parseFloat(document.getElementById(`${prefix}-longitude`).value);
    if (!isFinite(lat) || !isFinite(lng)) {
        showAlert('warning', '地図で発生地点を指定してください');
        return false;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        showAlert('warning', '緯度・経度の値が範囲外です');
        return false;
    }
    return true;
}

// フィルタUIの適用/解除
function applyRedtideFilter() {
    redtideFilter.start = document.getElementById('redtide-filter-start').value;
    redtideFilter.end = document.getElementById('redtide-filter-end').value;
    currentPage.redtide = 1;
    renderRedtideView();
}

function clearRedtideFilter() {
    redtideFilter.start = '';
    redtideFilter.end = '';
    document.getElementById('redtide-filter-start').value = '';
    document.getElementById('redtide-filter-end').value = '';
    currentPage.redtide = 1;
    renderRedtideView();
}

// 全データをレンダリング
function renderAllData() {
    Object.keys(dataStore).forEach(category => {
        renderTable(category);
        renderChart(category);
        renderStats(category);
    });
}

// カテゴリのテーブル・チャート・統計をまとめて再描画
function renderCategory(category) {
    if (category === 'redtide') { renderRedtideView(); return; }
    renderTable(category);
    renderChart(category);
    renderStats(category);
}

// テーブルをレンダリング（dataOverride 指定時はそれを使う＝赤潮のフィルタ後配列）
function renderTable(category, dataOverride) {
    const tbody = document.getElementById(`${category}-table-body`);
    const data = dataOverride !== undefined ? dataOverride : dataStore[category];
    const nonImageFields = dataFields[category].filter(f => f.type !== 'image');
    const imageFields = dataFields[category].filter(f => f.type === 'image');
    const totalCols = 1 + nonImageFields.length + imageFields.length + 1;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${totalCols}" style="text-align: center; padding: 40px;">データがありません</td></tr>`;
        renderPagination(category, 0);
        return;
    }

    const reversed = data.slice().reverse();
    const totalPages = Math.ceil(reversed.length / PAGE_SIZE);
    if (currentPage[category] > totalPages) currentPage[category] = totalPages;
    const start = (currentPage[category] - 1) * PAGE_SIZE;
    const pageData = reversed.slice(start, start + PAGE_SIZE);

    tbody.innerHTML = pageData.map(item => {
        const date = new Date(item.timestamp);
        const dateStr = `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;

        let cells = `<td>${escapeHtml(dateStr)}</td>`;
        nonImageFields.forEach(field => {
            const value = item[field.name];
            cells += `<td>${value !== undefined && value !== null ? escapeHtml(String(value)) : '-'}</td>`;
        });
        imageFields.forEach(field => {
            if (item[field.name]) {
                cells += `<td><img src="${item[field.name]}" class="photo-thumbnail" onclick="viewPhotoById('${item.id}', '${field.name}', '${category}')" alt="個体写真" /></td>`;
            } else {
                cells += `<td style="color:#ccc; text-align:center;">-</td>`;
            }
        });

        return `
            <tr>
                ${cells}
                <td>
                    <button class="btn btn-warning btn-small" onclick="editData('${escapeHtml(category)}', ${Number(item.id)})">編集</button>
                    <button class="btn btn-danger btn-small" onclick="deleteData('${escapeHtml(category)}', ${Number(item.id)})">削除</button>
                </td>
            </tr>
        `;
    }).join('');

    renderPagination(category, reversed.length);
}

// ページネーションUIをレンダリング
function renderPagination(category, totalItems) {
    const container = document.getElementById(`${category}-pagination`);
    if (!container) return;

    const totalPages = Math.ceil(totalItems / PAGE_SIZE);
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    const page = currentPage[category];
    container.innerHTML = `
        <button class="btn btn-small pagination-btn" onclick="changePage('${category}', ${page - 1})" ${page <= 1 ? 'disabled' : ''}>前へ</button>
        <span class="pagination-info">${page} / ${totalPages} ページ（全${totalItems}件）</span>
        <button class="btn btn-small pagination-btn" onclick="changePage('${category}', ${page + 1})" ${page >= totalPages ? 'disabled' : ''}>次へ</button>
    `;
}

// ページを変更
function changePage(category, page) {
    const source = category === 'redtide' ? getFilteredRedtide() : dataStore[category];
    const totalPages = Math.ceil(source.length / PAGE_SIZE);
    if (page < 1 || page > totalPages) return;
    currentPage[category] = page;
    if (category === 'redtide') {
        renderTable('redtide', source);
        return;
    }
    renderTable(category);
}

// チャートをレンダリング
function renderChart(category) {
    if (category === 'redtide') return; // 赤潮は専用の renderRedtideChart を使う
    const canvas = document.getElementById(`${category}Chart`);
    if (!canvas) return; // グラフ未設置のカテゴリ（例: 赤潮）はスキップ
    const data = dataStore[category];

    if (data.length === 0) return;

    if (charts[category]) {
        charts[category].destroy();
    }

    const sortedData = data.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    const labels = sortedData.map(item => {
        const date = new Date(item.timestamp);
        return `${date.getMonth()+1}/${date.getDate()}`;
    });

    const datasets = dataFields[category].slice(0, 3).map((field, index) => {
        const colors = [
            'rgba(13, 139, 147, 0.8)',   // tide
            'rgba(47, 208, 200, 0.8)',   // aqua
            'rgba(10, 70, 80, 0.8)',     // deep
            'rgba(244, 192, 91, 0.8)'    // sun
        ];
        return {
            label: field.label,
            data: sortedData.map(item => item[field.name]),
            borderColor: colors[index],
            backgroundColor: colors[index].replace('0.8', '0.2'),
            tension: 0.4,
            fill: true
        };
    });

    charts[category] = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 15, font: { size: 11 } }
                },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                y: { beginAtZero: false, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// 統計情報をレンダリング
function renderStats(category) {
    if (category === 'redtide') return; // 赤潮は専用の renderRedtideStats を使う
    const statsDiv = document.getElementById(`${category}-stats`);
    if (!statsDiv) return; // 統計カード未設置のカテゴリ（例: 赤潮）はスキップ
    const data = dataStore[category];

    if (data.length === 0) {
        statsDiv.innerHTML = '';
        return;
    }

    const fields = dataFields[category];
    const stats = fields.map(field => {
        const values = data.map(item => item[field.name]).filter(v => v !== undefined && v !== null && !isNaN(v));
        if (values.length === 0) return null;
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const latest = data[data.length - 1][field.name];
        return {
            label: field.label,
            value: typeof latest === 'number' ? latest.toFixed(1) : latest,
            avg: avg.toFixed(1)
        };
    }).filter(s => s !== null);

    statsDiv.innerHTML = stats.map(stat => `
        <div class="stat-card">
            <div class="stat-label">${escapeHtml(stat.label)}</div>
            <div class="stat-value">${escapeHtml(String(stat.value))}</div>
            <div class="stat-label">平均: ${escapeHtml(String(stat.avg))}</div>
        </div>
    `).join('');
}

// データ追加モーダルを表示
function showAddModal(category) {
    currentPhotoData.add = null;
    const modal = document.getElementById('addModal');
    const formFields = document.getElementById('formFields');

    formFields.innerHTML = `
        <div class="form-group">
            <label>日時</label>
            <input type="datetime-local" id="add-timestamp" required value="${new Date().toISOString().slice(0, 16)}">
        </div>
    ` + dataFields[category]
        .filter(field => !(category === 'redtide' && REDTIDE_PICKER_FIELDS.includes(field.name)))
        .map(field => {
        if (field.type === 'select') {
            return `
                <div class="form-group">
                    <label>${field.label}</label>
                    <select id="add-${field.name}" required>
                        ${field.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                    </select>
                </div>
            `;
        } else if (field.type === 'image') {
            return `
                <div class="form-group">
                    <label>${field.label}</label>
                    <div class="photo-capture-area">
                        <input type="file" id="add-${field.name}" accept="image/*" capture="environment"
                            class="photo-file-input" onchange="handlePhotoSelect(event, 'add')">
                        <label for="add-${field.name}" class="photo-capture-btn">
                            📷 写真を撮影 / ギャラリーから選択
                        </label>
                        <div id="add-photo-preview" class="photo-preview-area"></div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="form-group">
                    <label>${field.label}</label>
                    <input type="${field.type}" id="add-${field.name}" step="${field.step || '1'}" required>
                </div>
            `;
        }
    }).join('') + (category === 'redtide' ? redtidePickerHtml('add', null, null, 1) : '');

    modal.classList.add('active');
    if (category === 'redtide') initRedtidePicker('add', null, null, 1);

    const form = document.getElementById('addForm');
    form.onsubmit = (e) => {
        e.preventDefault();
        addData(category);
    };
}

// データを追加（SQLite INSERT）
function addData(category) {
    if (category === 'redtide' && !validateRedtideInputs('add')) return;
    const id = Date.now() + Math.random();
    const timestamp = document.getElementById('add-timestamp').value;
    const fields = ['id', 'timestamp', ...dataFields[category].map(f => f.name)];
    const values = [id, timestamp];

    dataFields[category].forEach(field => {
        if (field.type === 'image') {
            values.push(currentPhotoData.add || null);
        } else {
            const input = document.getElementById(`add-${field.name}`);
            values.push(field.type === 'number' ? parseFloat(input.value) : input.value);
        }
    });

    const placeholders = fields.map(() => '?').join(', ');
    db.run(`INSERT INTO ${category} (${fields.join(', ')}) VALUES (${placeholders})`, values);
    saveDB();

    reloadDataStoreCategory(category);
    renderCategory(category);
    closeModal();
    showAlert('success', 'データを追加しました');
}

// 編集モーダルを表示
function editData(category, id) {
    currentPhotoData.edit = null;
    const modal = document.getElementById('editModal');
    const item = dataStore[category].find(d => d.id == id);
    if (!item) return;

    const formFields = document.getElementById('editFormFields');
    const timestamp = new Date(item.timestamp).toISOString().slice(0, 16);

    formFields.innerHTML = `
        <div class="form-group">
            <label>日時</label>
            <input type="datetime-local" id="edit-timestamp" required value="${timestamp}">
        </div>
    ` + dataFields[category]
        .filter(field => !(category === 'redtide' && REDTIDE_PICKER_FIELDS.includes(field.name)))
        .map(field => {
        if (field.type === 'select') {
            return `
                <div class="form-group">
                    <label>${field.label}</label>
                    <select id="edit-${field.name}" required>
                        ${field.options.map(opt => `<option value="${opt}" ${item[field.name] === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                    </select>
                </div>
            `;
        } else if (field.type === 'image') {
            const existing = item[field.name];
            return `
                <div class="form-group">
                    <label>${field.label}</label>
                    <div class="photo-capture-area">
                        <input type="file" id="edit-${field.name}" accept="image/*" capture="environment"
                            class="photo-file-input" onchange="handlePhotoSelect(event, 'edit')">
                        <label for="edit-${field.name}" class="photo-capture-btn">
                            📷 写真を変更する
                        </label>
                        <div id="edit-photo-preview" class="photo-preview-area">
                            ${existing ? `<img src="${existing}" class="photo-preview-img" />` : ''}
                        </div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="form-group">
                    <label>${field.label}</label>
                    <input type="${field.type}" id="edit-${field.name}" step="${field.step || '1'}" value="${item[field.name] || ''}" required>
                </div>
            `;
        }
    }).join('') + (category === 'redtide'
        ? redtidePickerHtml('edit', item.latitude, item.longitude, item.radiusKm)
        : '');

    modal.classList.add('active');
    if (category === 'redtide') initRedtidePicker('edit', item.latitude, item.longitude, item.radiusKm);

    const form = document.getElementById('editForm');
    form.onsubmit = (e) => {
        e.preventDefault();
        updateData(category, id);
    };
}

// データを更新（SQLite UPDATE）
function updateData(category, id) {
    if (category === 'redtide' && !validateRedtideInputs('edit')) return;
    const timestamp = document.getElementById('edit-timestamp').value;
    const setClauses = ['timestamp = ?'];
    const values = [timestamp];

    dataFields[category].forEach(field => {
        if (field.type === 'image') {
            if (currentPhotoData.edit !== null) {
                setClauses.push(`${field.name} = ?`);
                values.push(currentPhotoData.edit);
            }
        } else {
            const input = document.getElementById(`edit-${field.name}`);
            setClauses.push(`${field.name} = ?`);
            values.push(field.type === 'number' ? parseFloat(input.value) : input.value);
        }
    });

    values.push(id);
    db.run(`UPDATE ${category} SET ${setClauses.join(', ')} WHERE id = ?`, values);
    saveDB();

    reloadDataStoreCategory(category);
    renderCategory(category);
    closeEditModal();
    showAlert('success', 'データを更新しました');
}

// データを削除（SQLite DELETE）
function deleteData(category, id) {
    if (!confirm('このデータを削除してもよろしいですか?')) return;

    db.run(`DELETE FROM ${category} WHERE id = ?`, [id]);
    saveDB();

    reloadDataStoreCategory(category);
    renderCategory(category);
    showAlert('success', 'データを削除しました');
}

// CSVエクスポート
function exportData(category) {
    const data = dataStore[category];
    if (data.length === 0) {
        showAlert('warning', 'エクスポートするデータがありません');
        return;
    }

    const headers = ['日時', ...dataFields[category].map(f => f.label)];
    const rows = data.map(item => {
        return [
            new Date(item.timestamp).toLocaleString('ja-JP'),
            ...dataFields[category].map(f => item[f.name] ?? '')
        ];
    });

    const csv = [headers, ...rows].map(row => row.map(escapeCSVCell).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${category}_data_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    showAlert('success', 'CSVファイルをエクスポートしました');
}

// モーダルを閉じる
function closeModal() {
    document.getElementById('addModal').classList.remove('active');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
}

// アラート表示
function showAlert(type, message) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.right = '20px';
    alertDiv.style.zIndex = '2000';
    alertDiv.style.minWidth = '250px';
    alertDiv.style.animation = 'slideInRight 0.3s';

    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.style.animation = 'slideOutRight 0.3s';
        setTimeout(() => alertDiv.remove(), 300);
    }, 3000);
}

// 写真を圧縮してbase64に変換
function compressImage(dataUrl, maxWidth = 800, quality = 0.8) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = dataUrl;
    });
}

// 写真選択ハンドラ
function handlePhotoSelect(event, target) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const compressed = await compressImage(e.target.result);
        currentPhotoData[target] = compressed;
        const preview = document.getElementById(`${target}-photo-preview`);
        if (preview) {
            preview.innerHTML = `<img src="${compressed}" class="photo-preview-img" />`;
        }
    };
    reader.readAsDataURL(file);
}

// 写真フルサイズ閲覧
function viewPhotoById(id, fieldName, category) {
    const item = dataStore[category].find(d => d.id == id);
    if (item && item[fieldName]) {
        document.getElementById('photoModalImage').src = item[fieldName];
        document.getElementById('photoModal').classList.add('active');
    }
}

function closePhotoModal() {
    document.getElementById('photoModal').classList.remove('active');
}

// モーダルの外側クリックで閉じる
document.getElementById('addModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

document.getElementById('editModal').addEventListener('click', function(e) {
    if (e.target === this) closeEditModal();
});

document.getElementById('photoModal').addEventListener('click', function(e) {
    if (e.target === this) closePhotoModal();
});

// 初期化（認証チェック → ログイン済みなら DB初期化）
setupAuthUI();
