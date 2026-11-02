/* 전국 및 두 지도 비교. 시나리오별 기준 모형을 명시한다. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const MODES = [
    ['birth_plus','출산율 +20%'],['birth_minus','출산율 -20%'],
    ['sejong_proxy','세종 10% 가상 재배치'],['industry','산업 거점 사업체·종사자 +10%']
  ];
  const METRICS = [
    ['population','인구 차이'], ['netflow','순이동 배분 차이'],
    ['baseline_population','기준 인구'], ['scenario_population','가정 인구'],
    ['baseline_inflow','기준 유입 배분'], ['scenario_inflow','가정 유입 배분'],
    ['baseline_outflow','기준 유출 배분'], ['scenario_outflow','가정 유출 배분'],
    ['baseline_netflow','기준 순이동 배분'], ['scenario_netflow','가정 순이동 배분']
  ];
  const modeNames=Object.fromEntries(MODES), metricNames=Object.fromEntries(METRICS);
  const baseText = mode => mode==='industry'
    ? '산업 시나리오는 사업체·종사자 입력을 사용하는 별도 XGBoost 기준선입니다. 각 경로의 시도 총량은 동일하게 정산됩니다.'
    : '인구이력 XGBoost 기준선입니다. 출산·세종 가정은 공식 시도 총량에서 벗어날 수 있습니다.';
  function options(id, pairs, value){ const el=$(id);el.replaceChildren(...pairs.map(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;return o}));el.value=value }
  const years=Array.from({length:28},(_,i)=>[String(2025+i),`${2025+i}년`]);
  const SVG='http://www.w3.org/2000/svg';
  function paintShapes(svg, shapes){
    const lines=document.createElementNS(SVG,'g'), labels=document.createElementNS(SVG,'g');
    lines.classList.add('sido-lines'); labels.classList.add('sido-names');
    for(const f of shapes.features){
      const path=document.createElementNS(SVG,'path');path.setAttribute('d',f.paths.map(r=>r.map((p,i)=>(i?'L':'M')+p[0]+' '+p[1]).join('')+'Z').join(''));lines.appendChild(path);
      const label=document.createElementNS(SVG,'text');label.setAttribute('x',f.label[0]);label.setAttribute('y',f.label[1]);label.textContent=f.name;labels.appendChild(label);
    }
    svg.replaceChildren(lines,labels);
  }
  function visibility(svgId,prefix){ const svg=$(svgId);for(const type of ['lines','names']){const g=svg.querySelector('.sido-'+type);if(g)g.style.display=$(prefix+(type==='lines'?'-boundary':'-names')).checked?'':'none'} }
  function legend(m){
    if(m==='population')return '인구 차이 · 명 · 대칭로그, 선형구간 ±1, 범위 ±1,000 (초과값 끝색)';
    if(m==='netflow')return '순이동 배분 차이 · 슬롯 사건 · 대칭로그, 선형구간 ±0.1, 범위 ±100 (초과값 끝색)';
    if(m.endsWith('_population'))return '격자 인구 · 명 · 로그 0.01~100,000, 0은 흰색, 초과값 끝색';
    if(m.endsWith('_inflow')||m.endsWith('_outflow'))return '격자 이동 배분 · 슬롯 사건 · 로그 0.01~6,000, 0은 흰색, 초과값 끝색';
    return '순이동 배분 · 슬롯 사건 · 대칭로그, 선형구간 ±1, 범위 ±1,200 (초과값 끝색)';
  }
  function initialize(prefix, year, mode, metric){
    options(prefix+'-year',years,String(year)); options(prefix+'-mode',MODES,mode); options(prefix+'-metric',METRICS,metric);
  }
  initialize('national',2025,'birth_plus','population');
  initialize('cmp-a',2025,'birth_plus','population'); initialize('cmp-b',2052,'birth_minus','population');
  function render(prefix){
    const mode=$(prefix+'-mode').value, y=$(prefix+'-year').value, metric=$(prefix+'-metric').value, img=$(prefix+'-image');
    img.src=`maps/${mode}/${y}_${metric}.png`;
    img.alt=`${y}년 ${modeNames[mode]} ${metricNames[metric]} 격자 지도`;
    $(prefix+'-title').textContent=`${y}년 · ${modeNames[mode]} · ${metricNames[metric]}`;
    $(prefix+'-legend').textContent=legend(metric);$(prefix+'-legend').dataset.scale=(metric==='population'||metric==='netflow'||metric.endsWith('_netflow'))?'diverging':'sequential';
    $(prefix+'-note').textContent=baseText(mode);
    img.onerror=()=>{$(prefix+'-error').textContent='지도 파일을 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.'};
    img.onload=()=>{$(prefix+'-error').textContent=''};
  }
  for(const p of ['national','cmp-a','cmp-b']){
    for(const key of ['mode','year','metric'])$(p+'-'+key).addEventListener('change',()=>render(p));
    render(p);
  }
  let timer=null;
  function moveYear(step){const el=$('national-year');el.value=String(Math.max(2025,Math.min(2052,Number(el.value)+step)));render('national')}
  $('national-prev').addEventListener('click',()=>moveYear(-1));$('national-next').addEventListener('click',()=>moveYear(1));
  $('national-play').addEventListener('click',()=>{if(timer){clearInterval(timer);timer=null;$('national-play').textContent='순차 재생'}else{$('national-play').textContent='일시 정지';timer=setInterval(()=>{if($('national-year').value==='2052')$('national-year').value='2025';else $('national-year').value=String(Number($('national-year').value)+1);render('national')},1500)}});
  for(const p of ['national','cmp'])for(const field of ['boundary','names'])$(p+'-'+field).addEventListener('change',()=>{
    for(const s of p==='national'?['national']:['cmp-a','cmp-b'])visibility(s+'-svg',p);
  });
  fetch('sido-boundaries.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(shapes=>{
    for(const p of ['national','cmp-a','cmp-b']){paintShapes($(p+'-svg'),shapes);visibility(p+'-svg',p==='national'?'national':'cmp')}
  }).catch(()=>{for(const p of ['national','cmp-a','cmp-b'])$(p+'-error').textContent='시도 경계 파일을 불러오지 못했습니다.'});
})();
