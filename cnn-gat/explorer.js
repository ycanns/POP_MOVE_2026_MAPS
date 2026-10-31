(() => {
  'use strict';
  const root = 'explore-assets/', labels = {total:'전체',young:'20~39세',senior:'65세 이상',age20:'20대',age30:'30대'}, measures = {inflow:'유입',outflow:'유출',netflow:'순이동'};
  const $ = id => document.getElementById(id), select = (id, entries, value) => { const el=$(id); el.replaceChildren(...entries.map(([v,t])=>{const o=document.createElement('option');o.value=v;o.textContent=t;return o})); el.value=value; };
  const years=Array.from({length:28},(_,i)=>[String(2025+i),(2025+i)+'년']), groups=Object.entries(labels), metrics=Object.entries(measures);
  const uri=(g,y,m)=>root+'maps/'+g+'/'+y+'_'+m+'.png';
  const fmt=n=>Number(n).toLocaleString('ko-KR',{maximumFractionDigits:1});
  let catalog,boundaries;
  const svgNS='http://www.w3.org/2000/svg';
  function drawSido(data){
    for(const id of ['large-net-map','a-map','b-map']){
      const svg=$(id+'-sido'), lines=document.createElementNS(svgNS,'g'), names=document.createElementNS(svgNS,'g');
      lines.setAttribute('class','sido-lines'); names.setAttribute('class','sido-names');
      for(const f of data.features){
        const path=document.createElementNS(svgNS,'path');
        path.setAttribute('d',f.paths.map(r=>r.map((p,i)=>(i?'L':'M')+p[0]+' '+p[1]).join('')+'Z').join(''));lines.appendChild(path);
        const name=document.createElementNS(svgNS,'text');name.setAttribute('x',f.label[0]);name.setAttribute('y',f.label[1]);name.textContent=f.name;names.appendChild(name);
      }
      svg.replaceChildren(lines,names);
    }
    updateSidoLayers();
  }
  function updateSidoLayers(){for(const id of ['large-net-map','a-map','b-map']){const svg=$(id+'-sido'), prefix=id==='large-net-map'?'net':'compare';for(const layer of ['lines','names']){const g=svg.querySelector('.sido-'+layer);if(g)g.style.display=$(prefix+'-sido-'+(layer==='lines'?'boundary':'names')).checked?'':'none'}}}
  for(const id of ['net-sido-names','compare-sido-names','net-sido-boundary','compare-sido-boundary'])$(id).addEventListener('change',updateSidoLayers);
  fetch(root+'sido-boundaries.json?v=sido-20261029').then(r=>{if(!r.ok)throw Error('sido');return r.json()}).then(drawSido).catch(()=>{for(const id of ['net-sido-error','compare-sido-error'])$(id).textContent='시도 경계를 불러오지 못했습니다. 연결을 확인하고 새로고침해 주세요.'});

  const legend=(m)=>m==='netflow' ? `순이동 · 슬롯 사건 수 · 대칭로그 (±${fmt(catalog.net_max)}, 선형 구간 ±1)` : `유입·유출 · 슬롯 사건 수 · 로그 (0.01 ~ ${fmt(catalog.flow_max)}, 0은 흰색)`;
  function setLegend(container,m){container.textContent=legend(m);container.className='legend '+(m==='netflow'?'net':'flow')}
  function showTab(id){document.querySelectorAll('[data-view]').forEach(b=>{const active=b.dataset.view===id;b.setAttribute('aria-selected',String(active));document.getElementById('view-'+b.dataset.view).hidden=!active});if(id==='region')renderRegion()}
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.view)));
  function renderOverview(){const y=$('year').value,g=$('group').value;for(const m of Object.keys(measures)){const el=$('overview-'+m);el.src=uri(g,y,m);el.alt=`${y}년 ${labels[g]} ${measures[m]} 격자 배분 지도`}let large=$('large-net-map');large.src=uri(g,y,'netflow');large.alt=`${y}년 ${labels[g]} 순이동 격자 배분 지도`}
  $('year').addEventListener('change',renderOverview);$('group').addEventListener('change',renderOverview);$('back').addEventListener('click',renderOverview);$('next').addEventListener('click',renderOverview);$('play').addEventListener('click',()=>{if(window.exploreTimer)clearInterval(window.exploreTimer);if($('play').textContent==='일시 정지')window.exploreTimer=setInterval(renderOverview,1500)});renderOverview();
  for(const side of ['a','b']){
   select(side+'-year',years,side==='a'?'2025':'2052');select(side+'-group',groups,'total');select(side+'-metric',metrics,'netflow');
   function render(){const y=$(side+'-year').value,g=$(side+'-group').value,m=$(side+'-metric').value,img=$(side+'-map');img.src=uri(g,y,m);img.alt=`${y}년 ${labels[g]} ${measures[m]} 격자 배분 지도`;$(side+'-title').textContent=`${y}년 · ${labels[g]} · ${measures[m]}`;if(catalog)setLegend($(side+'-legend'),m)}
   for(const n of ['year','group','metric'])$(side+'-'+n).addEventListener('change',render);render();
  }
  select('region-year',years,'2025');select('region-group',groups,'total');select('region-metric',metrics,'netflow');
  function updateMunicipal(){let province=$('region-province').value;const cities=catalog.items.filter(x=>x.kind==='municipal'&&x.province===province).sort((a,b)=>a.name.localeCompare(b.name,'ko')||a.code.localeCompare(b.code));select('region-city',[['','시도 전체'],...cities.map(x=>[x.code,x.name+' · '+x.code])],'');renderRegion()}
  let request=0;
  function loadImage(src){return new Promise((resolve,reject)=>{let img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src})}
  async function renderRegion(){
    if(!catalog||!boundaries)return;
    const g=$('region-group').value,y=$('region-year').value,m=$('region-metric').value,p=$('region-province').value,c=$('region-city').value;
    const item=catalog.items.find(x=>x.kind===(c?'municipal':'province')&&x.code===(c||p));if(!item)return;
    const selected=boundaries.features.filter(f=>c?f.code===c:f.province===p);let id=++request;
    $('region-title').textContent=`${item.name} · ${y}년 · ${labels[g]} · ${measures[m]}`;setLegend($('region-legend'),m);
    $('region-note').textContent=`선택한 ${item.name}에 겹치는 ${fmt(item.grids)}개 격자를 확대합니다. 경계에 걸친 격자는 다른 지역에 배분된 부분을 포함한 격자 전체값으로 표시하므로, 시군구별 배분 합계와 일치하지 않을 수 있습니다.`;
    try{
      const [img,mask]=await Promise.all([loadImage(uri(g,y,m)),loadImage(root+'masks/'+item.kind+'_'+item.code+'.png?v=boundaries-20261029')]);if(id!==request)return;
      let buffer=document.createElement('canvas');buffer.width=catalog.width;buffer.height=catalog.height;let ctx=buffer.getContext('2d');ctx.drawImage(img,0,0);ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0);
      let [x0,y0,x1,y1]=item.bbox;for(const f of selected){x0=Math.min(x0,f.bbox[0]);y0=Math.min(y0,f.bbox[1]);x1=Math.max(x1,f.bbox[2]);y1=Math.max(y1,f.bbox[3])}
      let pad=Math.max(4,Math.ceil(Math.max(x1-x0,y1-y0)*.06));x0-=pad;y0-=pad;x1+=pad;y1+=pad;
      let scale=Math.min(800/(x1-x0),800/(y1-y0)),cv=$('region-map');cv.width=Math.max(1,Math.round((x1-x0)*scale));cv.height=Math.max(1,Math.round((y1-y0)*scale));let target=cv.getContext('2d');target.imageSmoothingEnabled=false;
      target.drawImage(buffer,-x0*scale,-y0*scale,catalog.width*scale,catalog.height*scale);
      if($('region-boundary').checked){target.strokeStyle='rgba(28,37,47,.85)';target.lineWidth=1.3;target.lineJoin='round';for(const f of boundaries.features){if(f.bbox[2]<x0||f.bbox[0]>x1||f.bbox[3]<y0||f.bbox[1]>y1)continue;target.beginPath();for(const ring of f.paths){ring.forEach((pt,j)=>{let px=(pt[0]-x0)*scale,py=(pt[1]-y0)*scale;j?target.lineTo(px,py):target.moveTo(px,py)});target.closePath()}target.lineWidth=c===f.code?2:1.1;target.stroke()}}
      if($('region-labels').checked){target.font='bold 18px Malgun Gothic, sans-serif';target.textAlign='center';target.textBaseline='middle';target.lineWidth=4;target.strokeStyle='white';target.fillStyle='#142636';for(const f of selected){const px=(f.label[0]-x0)*scale,py=(f.label[1]-y0)*scale;target.strokeText(f.name,px,py);target.fillText(f.name,px,py)}}
      cv.setAttribute('aria-label',`${item.name} ${y}년 ${labels[g]} ${measures[m]} 격자 배분 지도, 시군구 경계 참고 표시`);$('region-error').textContent='';
    }catch(e){if(id===request)$('region-error').textContent='지도 파일을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 선택해 주세요.'}
  }
  $('region-province').addEventListener('change',updateMunicipal);for(const n of ['city','year','group','metric','boundary','labels'])$('region-'+n).addEventListener('change',renderRegion);
  Promise.all(['catalog.json','boundaries.json'].map(path=>fetch(root+path+'?v=boundaries-20261029').then(r=>{if(!r.ok)throw Error(path);return r.json()}))).then(([data,shapes])=>{catalog=data;boundaries=shapes;select('region-province',catalog.items.filter(x=>x.kind==='province').map(x=>[x.code,x.name]),'11');updateMunicipal();setLegend($('overview-flow-legend'),'inflow');setLegend($('overview-net-legend'),'netflow');setLegend($('large-net-legend'),'netflow');for(const side of ['a','b'])setLegend($(side+'-legend'),$(side+'-metric').value)}).catch(()=>{$('region-error').textContent='지역 지도 목록을 불러오지 못했습니다. 이 화면은 HTTP 또는 GitHub Pages에서 열어 주세요.'});
})();
