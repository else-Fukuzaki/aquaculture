// データストレージ（SQLiteのキャッシュ）
let dataStore = {
    water: [],
    environment: [],
    biology: [],
    operation: [],
    economy: []
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
    ]
};

// チャートインスタンス
let charts = {};

// 現在選択中の写真データ (base64)
let currentPhotoData = { add: null, edit: null };

// ページネーション状態
const currentPage = { water: 1, environment: 1, biology: 1, operation: 1, economy: 1 };
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

    reloadAllCategories();
    renderAllData();
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
    renderTable(category);
    renderChart(category);
    renderStats(category);
}

// テーブルをレンダリング
function renderTable(category) {
    const tbody = document.getElementById(`${category}-table-body`);
    const data = dataStore[category];
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
    const totalPages = Math.ceil(dataStore[category].length / PAGE_SIZE);
    if (page < 1 || page > totalPages) return;
    currentPage[category] = page;
    renderTable(category);
}

// チャートをレンダリング
function renderChart(category) {
    const canvas = document.getElementById(`${category}Chart`);
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
            'rgba(30, 60, 114, 0.8)',
            'rgba(102, 126, 234, 0.8)',
            'rgba(118, 75, 162, 0.8)',
            'rgba(40, 167, 69, 0.8)'
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
    const statsDiv = document.getElementById(`${category}-stats`);
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
    ` + dataFields[category].map(field => {
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
    }).join('');

    modal.classList.add('active');

    const form = document.getElementById('addForm');
    form.onsubmit = (e) => {
        e.preventDefault();
        addData(category);
    };
}

// データを追加（SQLite INSERT）
function addData(category) {
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
    ` + dataFields[category].map(field => {
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
    }).join('');

    modal.classList.add('active');

    const form = document.getElementById('editForm');
    form.onsubmit = (e) => {
        e.preventDefault();
        updateData(category, id);
    };
}

// データを更新（SQLite UPDATE）
function updateData(category, id) {
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
            ...dataFields[category].map(f => item[f.name] || '')
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

// 初期化（sql.js WASMロードのため非同期）
initDB();
