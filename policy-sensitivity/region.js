/* Regional detail for the policy sensitivity dashboard. The data and masks
   use the same display boundaries and 2025 grid coverage as grid-flow. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const fmt = n => Number(n).toLocaleString('ko-KR', {maximumFractionDigits: 1});
  const geo = 'geo/';
  const modeNames = {birth_plus:'출산율 +20%',birth_minus:'출산율 -20%',sejong_proxy:'세종 10% 가상 재배치',industry:'산업 거점 사업체·종사자 +10%'};
  const metricNames = {population:'인구 차이',netflow:'순이동 배분 차이',baseline_population:'기준 인구',scenario_population:'가정 인구',baseline_inflow:'기준 유입 배분',scenario_inflow:'가정 유입 배분',baseline_outflow:'기준 유출 배분',scenario_outflow:'가정 유출 배분',baseline_netflow:'기준 순이동 배분',scenario_netflow:'가정 순이동 배분'};
  let catalog, boundaries, ready, request = 0;
  const getJSON = path => fetch(path).then(r => { if (!r.ok) throw new Error(path); return r.json(); });
  const loadImage = path => new Promise((resolve, reject) => { const image = new Image(); image.onload=()=>resolve(image); image.onerror=()=>reject(new Error(path)); image.src=path; });
  function fillSelect(id, entries, chosen) {
    const element=$(id);
    element.replaceChildren(...entries.map(([value,label]) => {const option=document.createElement('option');option.value=value;option.textContent=label;return option;}));
    element.value=chosen;
  }
  function updateCities() {
    const province=$('region-province').value;
    const cities=catalog.items.filter(x=>x.kind==='municipal' && x.province===province)
      .sort((a,b)=>a.name.localeCompare(b.name,'ko')||a.code.localeCompare(b.code));
    fillSelect('region-city',[['','시도 전체'],...cities.map(x=>[x.code,`${x.name} · ${x.code}`])],'');
  }
  function initialize() {
    if (!ready) {
      ready=Promise.all([getJSON(geo+'catalog.json'),getJSON(geo+'boundaries.json')]).then(([c,b])=>{
        catalog=c;boundaries=b;
        if (catalog.width!==642||catalog.height!==604) throw new Error('지역 지도 격자 크기 불일치');
        const provinces=catalog.items.filter(x=>x.kind==='province').map(x=>[x.code,x.name]);
        fillSelect('region-province',provinces,'11');updateCities();
      });
    }
    return ready;
  }
  async function renderRegion() {
    const call=++request;
    try {
      await initialize(); if(call!==request)return;
      const mode=$('mode').value, year=$('year').value, metric=$('metric').value;
      const province=$('region-province').value, city=$('region-city').value;
      const kind=city?'municipal':'province', code=city||province;
      const item=catalog.items.find(x=>x.kind===kind&&x.code===code);
      if(!item)throw new Error('지역 목록에서 선택 항목을 찾지 못했습니다');
      const selected=boundaries.features.filter(f=>city?f.code===city:f.province===province);
      $('region-title').textContent=`${item.name} · ${year}년 · ${modeNames[mode]||mode} · ${metricNames[metric]||metric}`;
      $('region-note').textContent=`선택한 ${item.name}에 겹치는 ${fmt(item.grids)}개 격자를 확대합니다. 경계에 걸친 격자는 다른 지역의 부분을 포함한 격자 전체값이므로 표의 지역별 합계와 일치하지 않을 수 있습니다. 군위군은 대구에 표시되며 기준 시도 총량 정산은 경북 기준입니다.`;
      $('region-legend').textContent=metric==='population'?'인구 차이 · 명 · 대칭로그 (±1,000, 선형 ±1)':metric==='netflow'?'순이동 배분 차이 · 슬롯 사건 · 대칭로그 (±100, 선형 ±0.1)':metric.endsWith('_population')?'인구 · 명 · 로그 (0.01~100,000, 0은 흰색)':metric.endsWith('_netflow')?'순이동 배분 · 슬롯 사건 · 대칭로그 (±1,200, 선형 ±1)':'유입·유출 배분 · 슬롯 사건 · 로그 (0.01~6,000, 0은 흰색)';
      $('region-legend').dataset.scale=(metric==='population'||metric==='netflow'||metric.endsWith('_netflow'))?'diverging':'sequential';
      const [image,mask]=await Promise.all([loadImage(`maps/${mode}/${year}_${metric}.png`),loadImage(`${geo}masks/${kind}_${code}.png`)]); if(call!==request)return;
      const buffer=document.createElement('canvas');buffer.width=catalog.width;buffer.height=catalog.height;
      const ctx=buffer.getContext('2d');ctx.drawImage(image,0,0);ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);
      let [x0,y0,x1,y1]=item.bbox;
      for(const f of selected){x0=Math.min(x0,f.bbox[0]);y0=Math.min(y0,f.bbox[1]);x1=Math.max(x1,f.bbox[2]);y1=Math.max(y1,f.bbox[3]);}
      const pad=Math.max(4,Math.ceil(Math.max(x1-x0,y1-y0)*.06));x0-=pad;y0-=pad;x1+=pad;y1+=pad;
      const scale=Math.min(800/(x1-x0),800/(y1-y0)),cv=$('region-map');
      cv.width=Math.max(1,Math.round((x1-x0)*scale));cv.height=Math.max(1,Math.round((y1-y0)*scale));
      const target=cv.getContext('2d');target.imageSmoothingEnabled=false;target.drawImage(buffer,-x0*scale,-y0*scale,catalog.width*scale,catalog.height*scale);
      if($('region-boundary').checked){target.strokeStyle='rgba(28,37,47,.85)';target.lineJoin='round';for(const f of boundaries.features){if(f.bbox[2]<x0||f.bbox[0]>x1||f.bbox[3]<y0||f.bbox[1]>y1)continue;target.beginPath();for(const ring of f.paths){ring.forEach((pt,j)=>{const px=(pt[0]-x0)*scale,py=(pt[1]-y0)*scale;j?target.lineTo(px,py):target.moveTo(px,py);});target.closePath();}target.lineWidth=city===f.code?2:1.1;target.stroke();}}
      if($('region-labels').checked){target.font='bold 18px Malgun Gothic, sans-serif';target.textAlign='center';target.textBaseline='middle';target.lineWidth=4;target.strokeStyle='white';target.fillStyle='#142636';for(const f of selected){const px=(f.label[0]-x0)*scale,py=(f.label[1]-y0)*scale;target.strokeText(f.name,px,py);target.fillText(f.name,px,py);}}
      cv.setAttribute('aria-label',`${item.name} ${year}년 ${modeNames[mode]||mode} ${metricNames[metric]||metric} 지도`);$('region-error').textContent='';
    }catch(e){if(call===request)$('region-error').textContent='지역 지도 또는 경계 자료를 불러오지 못했습니다. 연결을 확인한 뒤 다시 선택해 주세요.';}
  }
  $('region-province').addEventListener('change',()=>{if(catalog){updateCities();renderRegion();}});
  for(const id of ['region-city','region-boundary','region-labels','mode','year','metric'])$(id).addEventListener('change',()=>{if(catalog)renderRegion();});
  window.policyRegionRender=renderRegion;
})();
