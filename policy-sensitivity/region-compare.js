/* Two independently selectable regional views of the policy sensitivity maps.
   Regional masks include whole intersecting grid cells, not clipped values. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const el = (side, name) => $(`rc-${side}-${name}`);
  const sides = ['a', 'b'];
  const fmt = n => Number(n).toLocaleString('ko-KR', {maximumFractionDigits: 1});
  const modes = {
    birth_plus: '출산율 연 +1%',
    birth_minus: '출산율 연 -1%',
    birth_0p1_plus: '출산율 연 +0.1%',
    birth_0p1_minus: '출산율 연 -0.1%',
    birth_0p5_plus: '출산율 연 +0.5%',
    birth_0p5_minus: '출산율 연 -0.5%',
    sejong_historical: '세종 순이동 역배분',
    industry_jeonnam: '전남 데이터센터',
    industry_changwon: '창원 AI 제조',
    industry_gangwon: '강원 디지털헬스'
  };
  const metrics = {
    population: '인구 차이', netflow: '순이동 배분 차이',
    baseline_population: '기준 인구', scenario_population: '가정 인구',
    baseline_inflow: '기준 유입 배분', scenario_inflow: '가정 유입 배분',
    baseline_outflow: '기준 유출 배분', scenario_outflow: '가정 유출 배분',
    baseline_netflow: '기준 순이동 배분', scenario_netflow: '가정 순이동 배분'
  };
  const requests = {a: 0, b: 0};
  let catalog, boundaries, ready;
  const getJSON = path => fetch(path).then(response => {
    if (!response.ok) throw new Error(path);
    return response.json();
  });
  const loadImage = path => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(path));
    image.src = path;
  });
  function fillSelect(select, entries, chosen) {
    select.replaceChildren(...entries.map(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      return option;
    }));
    select.value = chosen;
  }
  function updateCities(side) {
    const province = el(side, 'province').value;
    const cities = catalog.items.filter(x => x.kind === 'municipal' && x.province === province)
      .sort((a, b) => a.name.localeCompare(b.name, 'ko') || a.code.localeCompare(b.code));
    fillSelect(el(side, 'city'), [['', '시도 전체'], ...cities.map(x => [x.code, `${x.name} · ${x.code}`])], '');
  }
  function initialize() {
    if (!ready) {
      ready = Promise.all([getJSON('geo/catalog.json'), getJSON('geo/boundaries.json')]).then(([c, b]) => {
        if (c.width !== 642 || c.height !== 604) throw new Error('지역 지도 격자 크기 불일치');
        catalog = c;
        boundaries = b;
        const provinces = c.items.filter(x => x.kind === 'province').map(x => [x.code, x.name]);
        for (const side of sides) {
          fillSelect(el(side, 'province'), provinces, '11');
          updateCities(side);
        }
      }).catch(error => { ready = undefined; throw error; });
    }
    return ready;
  }
  function setLegend(side, metric) {
    const legend = el(side, 'legend');
    legend.textContent = metric === 'population' ? '인구 차이 · 명 · 대칭로그 (±1,000, 선형 ±1)' :
      metric === 'netflow' ? '순이동 배분 차이 · 이동자 슬롯 사건 · 대칭로그 (±100, 선형 ±0.1)' :
      metric.endsWith('_population') ? '인구 · 명 · 로그 (0.01~100,000, 0은 흰색)' :
      metric.endsWith('_netflow') ? '순이동 배분 · 이동자 슬롯 사건 · 대칭로그 (±1,200, 선형 ±1)' :
      '유입·유출 배분 · 이동자 슬롯 사건 · 로그 (0.01~6,000, 0은 흰색)';
    legend.dataset.scale = metric === 'population' || metric === 'netflow' || metric.endsWith('_netflow') ? 'diverging' : 'sequential';
  }
  async function render(side) {
    const call = ++requests[side];
    const current = () => call === requests[side];
    try {
      await initialize();
      if (!current()) return;
      const mode = el(side, 'mode').value, year = el(side, 'year').value, metric = el(side, 'metric').value;
      const province = el(side, 'province').value, city = el(side, 'city').value;
      const kind = city ? 'municipal' : 'province', code = city || province;
      const item = catalog.items.find(x => x.kind === kind && x.code === code);
      if (!item || !modes[mode] || !metrics[metric]) throw new Error('선택 항목을 찾지 못했습니다');
      const selected = boundaries.features.filter(f => city ? f.code === city : f.province === province);
      const title = `${item.name} · ${year}년 · ${modes[mode]} · ${metrics[metric]}`;
      el(side, 'title').textContent = title;
      el(side, 'note').textContent = `${item.name}에 겹치는 ${fmt(item.grids)}개 격자를 확대합니다. 경계에 걸친 격자는 다른 지역 부분을 포함한 전체값이므로 지역별 합계와 다를 수 있습니다. 군위군은 대구에 표시되며 기준 시도 총량 정산은 경북 기준입니다.`;
      setLegend(side, metric);
      const pendingCanvas = el(side, 'map');
      pendingCanvas.getContext('2d').clearRect(0, 0, pendingCanvas.width, pendingCanvas.height);
      pendingCanvas.setAttribute('aria-label', `${title} 지도 불러오는 중`);
      el(side, 'error').textContent = '지도를 불러오는 중입니다.';
      const [image, mask] = await Promise.all([
        loadImage(`maps/${mode}/${year}_${metric}.png?v=20261103-regional-compare1`),
        loadImage(`geo/masks/${kind}_${code}.png`)
      ]);
      if (!current()) return;
      const buffer = document.createElement('canvas');
      buffer.width = catalog.width; buffer.height = catalog.height;
      const ctx = buffer.getContext('2d');
      ctx.drawImage(image, 0, 0);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(mask, 0, 0);
      let [x0, y0, x1, y1] = item.bbox;
      for (const f of selected) {
        x0 = Math.min(x0, f.bbox[0]); y0 = Math.min(y0, f.bbox[1]);
        x1 = Math.max(x1, f.bbox[2]); y1 = Math.max(y1, f.bbox[3]);
      }
      const pad = Math.max(4, Math.ceil(Math.max(x1 - x0, y1 - y0) * .06));
      x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
      const scale = Math.min(800 / (x1 - x0), 800 / (y1 - y0));
      const canvas = el(side, 'map');
      canvas.width = Math.max(1, Math.round((x1 - x0) * scale));
      canvas.height = Math.max(1, Math.round((y1 - y0) * scale));
      const target = canvas.getContext('2d');
      target.imageSmoothingEnabled = false;
      target.drawImage(buffer, -x0 * scale, -y0 * scale, catalog.width * scale, catalog.height * scale);
      if (el(side, 'boundary').checked) {
        target.strokeStyle = 'rgba(28,37,47,.85)'; target.lineJoin = 'round';
        for (const f of boundaries.features) {
          if (f.bbox[2] < x0 || f.bbox[0] > x1 || f.bbox[3] < y0 || f.bbox[1] > y1) continue;
          target.beginPath();
          for (const ring of f.paths) {
            ring.forEach((pt, j) => {
              const px = (pt[0] - x0) * scale, py = (pt[1] - y0) * scale;
              if (j) target.lineTo(px, py); else target.moveTo(px, py);
            });
            target.closePath();
          }
          target.lineWidth = city === f.code ? 2 : 1.1;
          target.stroke();
        }
      }
      if (el(side, 'labels').checked) {
        target.font = 'bold 18px Malgun Gothic, sans-serif'; target.textAlign = 'center';
        target.textBaseline = 'middle'; target.lineWidth = 4; target.strokeStyle = 'white'; target.fillStyle = '#142636';
        for (const f of selected) {
          const px = (f.label[0] - x0) * scale, py = (f.label[1] - y0) * scale;
          target.strokeText(f.name, px, py); target.fillText(f.name, px, py);
        }
      }
      canvas.setAttribute('aria-label', `${title} 지도`);
      el(side, 'error').textContent = '';
    } catch (error) {
      if (current()) {
        el(side, 'map').getContext('2d').clearRect(0, 0, el(side, 'map').width, el(side, 'map').height);
        el(side, 'error').textContent = '지역 지도 또는 경계 자료를 불러오지 못했습니다. 연결을 확인한 뒤 다시 선택해 주세요.';
      }
    }
  }
  const years = Array.from({length: 28}, (_, i) => [String(2025 + i), `${2025 + i}년`]);
  for (const side of sides) {
    fillSelect(el(side, 'mode'), Object.entries(modes), 'birth_plus');
    fillSelect(el(side, 'year'), years, '2025');
    fillSelect(el(side, 'metric'), Object.entries(metrics), side === 'a' ? 'baseline_population' : 'scenario_population');
    el(side, 'province').addEventListener('change', () => { if (catalog) { updateCities(side); render(side); } });
    for (const name of ['city', 'boundary', 'labels', 'mode', 'year', 'metric']) {
      el(side, name).addEventListener('change', () => { if (catalog) render(side); });
    }
  }
  window.policyRegionRender = () => Promise.all(sides.map(render));
})();
