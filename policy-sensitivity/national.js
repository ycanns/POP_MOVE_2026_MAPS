/* 전국 및 두 지도 비교. 시나리오별 기준 모형을 명시한다. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const MODES = [
    ['birth_plus','출산율 연 +1%'],['birth_minus','출산율 연 -1%'],['birth_0p1_plus','출산율 연 +0.1%'],['birth_0p1_minus','출산율 연 -0.1%'],['birth_0p5_plus','출산율 연 +0.5%'],['birth_0p5_minus','출산율 연 -0.5%'],
    ['sejong_historical','세종 과거 순이동 역배분'],['industry_jeonnam','전남 데이터센터'],['industry_changwon','창원 AI 제조'],['industry_gangwon','강원 디지털헬스']
  ];
  const METRICS = [
    ['population','인구 차이'], ['netflow','순이동 배분 차이'],
    ['baseline_population','기준 인구'], ['scenario_population','가정 인구'],
    ['baseline_inflow','기준 유입 배분'], ['scenario_inflow','가정 유입 배분'],
    ['baseline_outflow','기준 유출 배분'], ['scenario_outflow','가정 유출 배분'],
    ['baseline_netflow','기준 순이동 배분'], ['scenario_netflow','가정 순이동 배분']
  ];
  const modeNames=Object.fromEntries(MODES), metricNames=Object.fromEntries(METRICS);
  const baseText = mode => mode.startsWith('industry_')
    ? '산업 시나리오: 2024년 대상 지역의 관련 업종 관측 종사자 수 1%를 매년 대상 지역 밖의 관측 종사자 분포에서 이전한다고 가정함. 업종별 결측이 많아 이전 규모는 불확실함. 사업체 XGBoost의 입력 변화 반응은 0이며 GAT 권역 이동 총량은 고정됨.'
    : '인구이력 XGBoost 기준선 사용. 출산·세종 가정은 공식 시도 총량에서 벗어날 수 있음.';
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
  function updateCompareColors(){
    const a=$('cmp-a-image'), b=$('cmp-b-image'), out=$('cmp-color-stats');
    if(a.dataset.failed==='true'||b.dataset.failed==='true'){out.textContent='지도 로딩 실패로 색상 비교 불가함.';return}
    if(!a.dataset.loaded || !b.dataset.loaded || a.dataset.loaded!==a.dataset.request || b.dataset.loaded!==b.dataset.request){
      out.textContent='좌우 격자 색상 비교 중임.'; return;
    }
    const expectedMode=$('cmp-b-mode').value, expectedYear=$('cmp-b-year').value;
    const expectedMetric=$('cmp-b-metric').value.replace('scenario_','');
    if(a.dataset.loaded!==`${expectedMode}/${expectedYear}/baseline_${expectedMetric}` || b.dataset.loaded!==`${expectedMode}/${expectedYear}/scenario_${expectedMetric}`){
      out.textContent='좌우 격자 색상 비교 중임.'; return;
    }
    try{
      const c=document.createElement('canvas');c.width=a.naturalWidth;c.height=a.naturalHeight;
      const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(a,0,0);const x=ctx.getImageData(0,0,c.width,c.height).data;
      ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(b,0,0);const y=ctx.getImageData(0,0,c.width,c.height).data;
      let total=0,different=0;
      for(let i=0;i<x.length;i+=4){if(x[i+3]||y[i+3]){total++;if(x[i]!==y[i]||x[i+1]!==y[i+1]||x[i+2]!==y[i+2]||x[i+3]!==y[i+3])different++}}
      out.textContent=`공통 척도에서 좌우 색상이 다른 격자 ${different.toLocaleString('ko-KR')}개 / ${total.toLocaleString('ko-KR')}개임. 같은 색상이어도 실제 값은 다를 수 있음.`;
    }catch(_){out.textContent='공통 색상 척도 사용. 같은 색상이어도 실제 값은 다를 수 있음.'}
  }
  initialize('national',2025,'birth_plus','population');
  initialize('cmp-a',2025,'birth_plus','baseline_population'); initialize('cmp-b',2025,'birth_plus','scenario_population'); options('cmp-b-metric',METRICS.filter(([v])=>v.startsWith('scenario_')),'scenario_population');
  function render(prefix){
    const mode=$(prefix+'-mode').value, y=$(prefix+'-year').value, metric=$(prefix+'-metric').value, img=$(prefix+'-image');
    const request=`${mode}/${y}/${metric}`;
    img.dataset.request=request;img.dataset.loaded='';img.dataset.failed='false';
    img.alt=`${y}년 ${modeNames[mode]} ${metricNames[metric]} 격자 지도`;
    $(prefix+'-title').textContent=prefix==='cmp-a'
      ? `${y}년 · 기준 · ${metricNames[metric]}`
      : `${y}년 · ${modeNames[mode]} · ${metricNames[metric]}`;
    $(prefix+'-legend').textContent=legend(metric);$(prefix+'-legend').dataset.scale=(metric==='population'||metric==='netflow'||metric.endsWith('_netflow'))?'diverging':'sequential';
    $(prefix+'-note').textContent=baseText(mode);
    img.onerror=()=>{$(prefix+'-error').textContent='지도 파일을 불러오지 못함. 인터넷 연결 확인 필요.';img.dataset.failed='true';if(prefix.startsWith('cmp-'))updateCompareColors()};
    img.onload=()=>{$(prefix+'-error').textContent='';img.dataset.loaded=request;if(prefix.startsWith('cmp-'))updateCompareColors()};
    img.src=`maps/${mode}/${y}_${metric}.png?v=20261103-sector1`;
    if(prefix.startsWith('cmp-'))updateCompareColors();
  }
  for(const p of ['national','cmp-a','cmp-b']){
    for(const key of ['mode','year','metric'])$(p+'-'+key).addEventListener('change',()=>render(p));
    render(p);
  }
  let timer=null;
  function moveYear(step){const el=$('national-year');el.value=String(Math.max(2025,Math.min(2052,Number(el.value)+step)));render('national')}
  $('national-prev').addEventListener('click',()=>moveYear(-1));$('national-next').addEventListener('click',()=>moveYear(1));
  $('national-play').addEventListener('click',()=>{if(timer){clearInterval(timer);timer=null;$('national-play').textContent='순차 재생'}else{$('national-play').textContent='일시 정지';timer=setInterval(()=>{if($('national-year').value==='2052')$('national-year').value='2025';else $('national-year').value=String(Number($('national-year').value)+1);render('national')},1500)}});
  function synchronizeComparison(){
    $('cmp-a-mode').value=$('cmp-b-mode').value;$('cmp-a-year').value=$('cmp-b-year').value;
    $('cmp-a-metric').value=$('cmp-b-metric').value.replace('scenario_','baseline_');render('cmp-a');
    const mode=$('cmp-b-mode').value, year=$('cmp-b-year').value;
    const metric=$('cmp-b-metric').value.replace('scenario_','');
    const files={population:'population',netflow:'netflow',inflow:'inflow_delta',outflow:'outflow_delta'};
    const labels={population:'인구',inflow:'유입 배분',outflow:'유출 배분',netflow:'순이동 배분'};
    const available=Object.hasOwn(files,metric);
    $('cmp-diff').hidden=!available;
    if(available){
      const img=$('cmp-diff-image');
      $('cmp-diff-title').textContent=`기준 대비 변화량 (가정 − 기준) · ${year}년 · ${modeNames[mode]} · ${labels[metric]}`;
      $('cmp-diff-legend').textContent=metric==='population'?legend('population'):'이동 배분 차이 · 슬롯 사건 · 대칭로그, 선형구간 ±0.1, 범위 ±100 (초과값 끝색)';
      $('cmp-diff-legend').dataset.scale='diverging';
      img.alt=$('cmp-diff-title').textContent+' 격자 지도';
      img.onerror=()=>{$('cmp-diff-error').textContent='차이 지도 파일을 불러오지 못함. 인터넷 연결 확인 필요.'};
      img.onload=()=>{$('cmp-diff-error').textContent=''};
      img.src=`maps/${mode}/${year}_${files[metric]}.png?v=20261103-flowdiff`;
    }
  }
  for(const field of ['mode','year','metric'])$('cmp-b-'+field).addEventListener('change',synchronizeComparison);
  synchronizeComparison();
  for(const p of ['national','cmp'])for(const field of ['boundary','names'])$(p+'-'+field).addEventListener('change',()=>{
    for(const s of p==='national'?['national']:['cmp-a','cmp-b','cmp-diff'])visibility(s+'-svg',p);
  });
  fetch('sido-boundaries.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(shapes=>{
    for(const p of ['national','cmp-a','cmp-b','cmp-diff']){paintShapes($(p+'-svg'),shapes);visibility(p+'-svg',p==='national'?'national':'cmp')}
  }).catch(()=>{for(const p of ['national','cmp-a','cmp-b','cmp-diff'])$(p+'-error').textContent='시도 경계 파일을 불러오지 못함.'});
})();
