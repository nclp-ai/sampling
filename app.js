// app.js - 核心抽樣邏輯、統計計算與 UI 交互
const POPULATION_SIZE = 60;
const POP_MEAN = 15.0;
const POP_VAR = 104.08;

let populationDogs = [];
let currentSample = [];
let groupSamplingHistory = []; // 儲存該組 10 次抽樣的 x̄_i
let cltChart = null;

// 初始化狗場總體數據 (N=60, μ=15.0, σ²=104.08)
function initPopulation() {
  populationDogs = [];
  const baseWeights = [
    4.2, 4.8, 5.1, 5.5, 6.0, 6.4, 7.2, 7.8, 8.1, 8.5,
    9.0, 9.4, 10.1, 10.5, 11.2, 11.8, 12.0, 12.5, 13.1, 13.8,
    14.2, 14.5, 15.0, 15.2, 15.8, 16.1, 16.5, 17.0, 17.4, 18.0,
    18.5, 19.1, 19.8, 20.2, 20.8, 21.5, 22.0, 22.6, 23.1, 23.9,
    24.5, 25.1, 25.8, 26.2, 27.0, 27.5, 28.1, 28.9, 29.5, 30.1,
    30.8, 31.4, 32.0, 32.8, 33.5, 34.1, 34.8, 35.2, 36.0, 36.8
  ];
  
  populationDogs = baseWeights.map((w, index) => ({
    id: index + 1,
    weight: w
  }));
}

// 執行抽樣計畫
function runSamplingProcess() {
  const groupId = document.getElementById('select-group').value;
  const targetN = parseInt(document.getElementById('select-n').value);
  const sampleMethod = document.getElementById('select-method').value; // replacement / no_replacement

  if (!groupId) {
    alert("請先選擇組別！");
    return;
  }

  currentSample = [];
  if (sampleMethod === 'no_replacement' && targetN <= POPULATION_SIZE) {
    // 不放回抽樣
    let shuffled = [...populationDogs].sort(() => 0.5 - Math.random());
    currentSample = shuffled.slice(0, targetN);
  } else {
    // 放回抽樣 (或大樣本 n > N 模擬)
    for (let i = 0; i < targetN; i++) {
      let randomIndex = Math.floor(Math.random() * POPULATION_SIZE);
      currentSample.push(populationDogs[randomIndex]);
    }
  }

  // 計算本次樣本平均值 x̄
  const sum = currentSample.reduce((a, b) => a + b.weight, 0);
  const sampleMean = sum / targetN;

  // 記錄至歷史紀錄
  groupSamplingHistory.push(sampleMean);

  // 更新介面與顯示
  updateHistoryTable();
  updateGroupStatsUI(targetN, sampleMethod);

  // 同步至 Firebase 雲端資料庫
  syncDataToCloud(groupId, targetN, sampleMethod);
}

// 計算小組累積統計數據
function getGroupCumulativeStats() {
  const m = groupSamplingHistory.length;
  if (m === 0) return { meanOfMean: 0, expVar: 0, count: 0 };

  const meanOfMean = groupSamplingHistory.reduce((a, b) => a + b, 0) / m;
  const expVar = groupSamplingHistory.reduce((a, b) => a + Math.pow(b - meanOfMean, 2), 0) / m;

  return {
    meanOfMean: meanOfMean,
    expVar: expVar,
    count: m
  };
}

// 更新歷史表格 UI
function updateHistoryTable() {
  const tbody = document.getElementById('history-tbody');
  tbody.innerHTML = '';

  groupSamplingHistory.forEach((xBar, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>第 ${idx + 1} 次</td>
      <td class="fw-bold text-primary">${xBar.toFixed(2)} kg</td>
    `;
    tbody.appendChild(tr);
  });
}

// 更新小組累積統計 UI
function updateGroupStatsUI(targetN, sampleMethod) {
  const stats = getGroupCumulativeStats();
  document.getElementById('stat-runs-count').innerText = `${stats.count} 次`;
  document.getElementById('stat-mean-of-mean').innerText = `${stats.meanOfMean.toFixed(2)} kg`;
  document.getElementById('stat-exp-var').innerText = stats.expVar.toFixed(2);

  // 理論方差計算 (含 FPC 修正)
  let theoryVar = POP_VAR / targetN;
  if (sampleMethod === 'no_replacement' && targetN <= POPULATION_SIZE) {
    const fpc = (POPULATION_SIZE - targetN) / (POPULATION_SIZE - 1);
    theoryVar *= fpc;
  }
  document.getElementById('stat-theory-var').innerText = theoryVar.toFixed(2);
}

// 同步至 Firebase
function syncDataToCloud(groupId, targetN, sampleMethod) {
  const stats = getGroupCumulativeStats();
  const groupName = `第 ${groupId} 組`;

  database.ref('classroom_submissions/' + groupId).set({
    groupId: groupId,
    groupName: groupName,
    targetN: targetN,
    sampleMethod: sampleMethod,
    sampleMeanOfMean: stats.meanOfMean,
    sampleVar: stats.expVar,
    runsCount: stats.count,
    timestamp: Date.now()
  });
}

// 監聽 Firebase 全班排行榜
database.ref('classroom_submissions').on('value', (snapshot) => {
  const data = snapshot.val();
  const tbody = document.getElementById('leaderboard-tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (!data) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">目前尚無小組提交數據</td></tr>';
    return;
  }

  const groups = Object.values(data).sort((a, b) => a.groupId - b.groupId);
  groups.forEach(g => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${g.groupName}</strong></td>
      <td><span class="badge bg-info text-dark">n = ${g.targetN}</span></td>
      <td class="fw-bold text-primary">${(g.sampleMeanOfMean || 0).toFixed(2)} kg</td>
      <td class="fw-bold text-danger">${(g.sampleVar || 0).toFixed(2)}</td>
      <td><span class="badge bg-success">已完成 ${g.runsCount} 次</span></td>
    `;
    tbody.appendChild(tr);
  });
});

// 清空歷史紀錄
function resetLocalHistory() {
  groupSamplingHistory = [];
  updateHistoryTable();
  document.getElementById('stat-runs-count').innerText = '0 次';
  document.getElementById('stat-mean-of-mean').innerText = '0.00 kg';
  document.getElementById('stat-exp-var').innerText = '0.00';
}

// 生成 500 次模擬並繪製 CLT 直方圖
function generateCLTHistogram() {
  const targetN = parseInt(document.getElementById('select-n').value);
  const sampleMethod = document.getElementById('select-method').value;
  const showNormalCurve = document.getElementById('toggle-normal-curve').checked;

  let simulatedMeans = [];
  const SIMULATE_RUNS = 500;

  for (let r = 0; r < SIMULATE_RUNS; r++) {
    let sum = 0;
    if (sampleMethod === 'no_replacement' && targetN <= POPULATION_SIZE) {
      let shuffled = [...populationDogs].sort(() => 0.5 - Math.random());
      sum = shuffled.slice(0, targetN).reduce((a, b) => a + b.weight, 0);
    } else {
      for (let i = 0; i < targetN; i++) {
        let idx = Math.floor(Math.random() * POPULATION_SIZE);
        sum += populationDogs[idx].weight;
      }
    }
    simulatedMeans.push(sum / targetN);
  }

  // 理論方差
  let theoryVar = POP_VAR / targetN;
  if (sampleMethod === 'no_replacement' && targetN <= POPULATION_SIZE) {
    theoryVar *= (POPULATION_SIZE - targetN) / (POPULATION_SIZE - 1);
  }
  const theorySD = Math.sqrt(theoryVar);

  // 分組統計頻率 (15 個區間)
  const minVal = Math.max(0, POP_MEAN - 3.5 * theorySD);
  const maxVal = POP_MEAN + 3.5 * theorySD;
  const binsCount = 15;
  const binWidth = (maxVal - minVal) / binsCount;

  let labels = [];
  let frequencies = new Array(binsCount).fill(0);

  for (let i = 0; i < binsCount; i++) {
    let bMin = minVal + i * binWidth;
    let bMax = bMin + binWidth;
    labels.push(`${bMin.toFixed(1)}-${bMax.toFixed(1)}`);
  }

  simulatedMeans.forEach(val => {
    let binIdx = Math.floor((val - minVal) / binWidth);
    if (binIdx >= 0 && binIdx < binsCount) {
      frequencies[binIdx]++;
    }
  });

  // 計算正態分佈曲線點
  let normalPoints = [];
  for (let i = 0; i < binsCount; i++) {
    let x = minVal + (i + 0.5) * binWidth;
    let pdf = (1 / (theorySD * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - POP_MEAN) / theorySD, 2));
    let expectedFreq = pdf * binWidth * SIMULATE_RUNS;
    normalPoints.push(expectedFreq);
  }

  // 繪製 Chart.js
  const ctx = document.getElementById('cltChartCanvas').getContext('2d');
  if (cltChart) cltChart.destroy();

  cltChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: '500次抽樣平均值出現次數（頻率）',
          data: frequencies,
          backgroundColor: 'rgba(13, 110, 253, 0.65)',
          borderColor: '#0d6efd',
          borderWidth: 1,
          order: 2
        },
        {
          label: '理論正態分佈曲線 N(μ, Var(X̄))',
          data: normalPoints,
          type: 'line',
          borderColor: '#dc3545',
          borderWidth: 3,
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          hidden: !showNormalCurve,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: '樣本平均體重 x̄ 區間 (kg)' } },
        y: { title: { display: true, text: '出現次數 (頻率)' }, beginAtZero: true }
      }
    }
  });
}

// 頁面初始化
document.addEventListener('DOMContentLoaded', () => {
  initPopulation();

  document.getElementById('btn-run-sample').addEventListener('click', runSamplingProcess);
  document.getElementById('btn-reset-history').addEventListener('click', resetLocalHistory);
  document.getElementById('btn-show-clt').addEventListener('click', generateCLTHistogram);
  document.getElementById('toggle-normal-curve').addEventListener('change', generateCLTHistogram);
});
