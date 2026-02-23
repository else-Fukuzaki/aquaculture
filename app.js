// データストレージ
let dataStore = {
    water: [],
    environment: [],
    biology: [],
    operation: [],
    economy: []
};

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
        { name: 'diseaseCount', label: '疾病発生数', type: 'number', step: '1' }
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

// ローカルストレージからデータを読み込み
function loadData() {
    const saved = localStorage.getItem('aquacultureData');
    if (saved) {
        dataStore = JSON.parse(saved);
    } else {
        // サンプルデータを生成
        generateSampleData();
    }
    renderAllData();
}

// データを保存
function saveData() {
    localStorage.setItem('aquacultureData', JSON.stringify(dataStore));
}

// サンプルデータ生成
function generateSampleData() {
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        
        dataStore.water.push({
            id: Date.now() + Math.random(),
            timestamp: date.toISOString(),
            temperature: 18 + Math.random() * 4,
            salinity: 3.2 + Math.random() * 0.3,
            oxygen: 6 + Math.random() * 2,
            ph: 7.5 + Math.random() * 0.5,
            turbidity: 2 + Math.random() * 3,
            ammonia: 0.1 + Math.random() * 0.2
        });

        dataStore.environment.push({
            id: Date.now() + Math.random(),
            timestamp: date.toISOString(),
            airTemp: 20 + Math.random() * 5,
            humidity: 60 + Math.random() * 20,
            windSpeed: 2 + Math.random() * 5,
            sunlight: 5 + Math.random() * 5,
            rainfall: Math.random() * 10,
            waveHeight: 0.5 + Math.random() * 1
        });

        dataStore.biology.push({
            id: Date.now() + Math.random(),
            timestamp: date.toISOString(),
            count: 10000 - Math.floor(Math.random() * 100),
            avgWeight: 50 + i * 2 + Math.random() * 10,
            feedAmount: 80 + Math.random() * 20,
            survivalRate: 95 + Math.random() * 4,
            mortality: Math.floor(Math.random() * 10),
            diseaseCount: Math.floor(Math.random() * 3)
        });

        dataStore.operation.push({
            id: Date.now() + Math.random(),
            timestamp: date.toISOString(),
            feedTimes: 3,
            feedAmount: 80 + Math.random() * 20,
            workHours: 6 + Math.random() * 3,
            workers: 3 + Math.floor(Math.random() * 2),
            medicineUsed: ['なし', 'なし', '抗生物質'][Math.floor(Math.random() * 3)],
            harvestAmount: Math.random() > 0.8 ? 100 + Math.random() * 50 : 0
        });

        dataStore.economy.push({
            id: Date.now() + Math.random(),
            timestamp: date.toISOString(),
            feedCost: 30000 + Math.random() * 10000,
            utilityCost: 10000 + Math.random() * 5000,
            laborCost: 50000 + Math.random() * 10000,
            medicineCost: Math.random() * 5000,
            maintenanceCost: 5000 + Math.random() * 5000,
            revenue: Math.random() > 0.8 ? 200000 + Math.random() * 100000 : 0
        });
    }
    saveData();
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

// テーブルをレンダリング
function renderTable(category) {
    const tbody = document.getElementById(`${category}-table-body`);
    const data = dataStore[category];
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px;">データがありません</td></tr>';
        return;
    }

    tbody.innerHTML = data.slice().reverse().map(item => {
        const date = new Date(item.timestamp);
        const dateStr = `${date.getMonth()+1}/${date.getDate()} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
        
        let cells = `<td>${dateStr}</td>`;
        const fields = dataFields[category].slice(0, 4);
        fields.forEach(field => {
            const value = item[field.name];
            cells += `<td>${value !== undefined && value !== null ? value : '-'}</td>`;
        });
        
        return `
            <tr>
                ${cells}
                <td>
                    <button class="btn btn-warning btn-small" onclick="editData('${category}', '${item.id}')">編集</button>
                    <button class="btn btn-danger btn-small" onclick="deleteData('${category}', '${item.id}')">削除</button>
                </td>
            </tr>
        `;
    }).join('');
}

// チャートをレンダリング
function renderChart(category) {
    const canvas = document.getElementById(`${category}Chart`);
    const data = dataStore[category];
    
    if (data.length === 0) return;

    // 既存のチャートを破棄
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
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    grid: { display: false }
                }
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

    const fields = dataFields[category].slice(0, 4);
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
            <div class="stat-label">${stat.label}</div>
            <div class="stat-value">${stat.value}</div>
            <div class="stat-label">平均: ${stat.avg}</div>
        </div>
    `).join('');
}

// データ追加モーダルを表示
function showAddModal(category) {
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

// データを追加
function addData(category) {
    const newData = {
        id: Date.now() + Math.random(),
        timestamp: document.getElementById('add-timestamp').value
    };

    dataFields[category].forEach(field => {
        const input = document.getElementById(`add-${field.name}`);
        newData[field.name] = field.type === 'number' ? parseFloat(input.value) : input.value;
    });

    dataStore[category].push(newData);
    saveData();
    renderTable(category);
    renderChart(category);
    renderStats(category);
    closeModal();
    
    showAlert('success', 'データを追加しました');
}

// 編集モーダルを表示
function editData(category, id) {
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

// データを更新
function updateData(category, id) {
    const index = dataStore[category].findIndex(d => d.id == id);
    if (index === -1) return;

    dataStore[category][index].timestamp = document.getElementById('edit-timestamp').value;
    
    dataFields[category].forEach(field => {
        const input = document.getElementById(`edit-${field.name}`);
        dataStore[category][index][field.name] = field.type === 'number' ? parseFloat(input.value) : input.value;
    });

    saveData();
    renderTable(category);
    renderChart(category);
    renderStats(category);
    closeEditModal();
    
    showAlert('success', 'データを更新しました');
}

// データを削除
function deleteData(category, id) {
    if (!confirm('このデータを削除してもよろしいですか?')) return;

    dataStore[category] = dataStore[category].filter(d => d.id != id);
    saveData();
    renderTable(category);
    renderChart(category);
    renderStats(category);
    
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

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
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

// モーダルの外側クリックで閉じる
document.getElementById('addModal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
});

document.getElementById('editModal').addEventListener('click', function(e) {
    if (e.target === this) closeEditModal();
});

// 初期化
loadData();
