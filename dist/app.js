const $=s=>document.querySelector(s);
const el=(tag,attrs={},text='')=>{const n=document.createElement(tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));n.textContent=text;return n};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'?u.href:'#'}catch{return '#'}};
const storageKey='competition-radar-v1';
let state={saved:[],applications:{},imported:[],live:[],compare:[],lastFetch:null,lastFetchSources:[],lastSuccessfulFetch:null,lastRefresh:null,lastReview:null}, catalog=[], baseCatalog=[], checkedAt='', view='discover', selected=null, month=new Date(), toastTimer, fetching=false;
try{state={...state,...JSON.parse(localStorage.getItem(storageKey)||'{}')}}catch{}
const persist=()=>{try{localStorage.setItem(storageKey,JSON.stringify(state))}catch{notify('Unable to save to this browser.')}};
const dateKey=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Colombo',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
const today=()=>dateKey(new Date());
const dayKey=d=>!d?null:d.length===10?d:dateKey(new Date(d));
const days=o=>o.deadline?Math.round((Date.parse(dayKey(o.deadline))-Date.parse(today()))/86400000):Infinity;
const closed=o=>o.deadline&&(o.deadline.length===10?days(o)<0:new Date(o.deadline)<new Date());
const active=o=>o.deadline&&!closed(o)&&o.kind!=='Watchlist';
const due=o=>!o.deadline?'Not announced':new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Asia/Colombo'}).format(new Date(o.deadline.length===10?o.deadline+'T12:00:00+05:30':o.deadline));
const timeText=o=>o.deadline&&o.deadline.length>10?new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Colombo'}).format(new Date(o.deadline))+' SL time':'Time unverified';
const stages=['Not started','Researching','Building','Ready to submit','Submitted','Closed'];
const getApp=id=>Object.hasOwn(state.applications,id)?state.applications[id]:{status:'Not started',checks:[],notes:''};
const appStatus=o=>getApp(o.id).status;
const options=(values,selected='')=>values.map(v=>'<option value="'+escape(v)+'"'+(v===selected?' selected':'')+'>'+escape(v)+'</option>').join('');
const filters={query:'',eligibility:'',deadline:'',region:'',student:'',theme:'',prize:'',status:'',kind:'',sort:'fit'};
const notify=msg=>{const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3500)};
async function load(){
  const r=await fetch('opportunities.json',{cache:'no-store'});if(!r.ok)throw Error('Catalog unavailable');
  const data=await r.json();checkedAt=data.checkedAt;baseCatalog=data.opportunities.map(normalize);rebuildCatalog();state.lastRefresh=new Date().toISOString();persist();render();
}
function merge(base,extra){const m=new Map(base.map(o=>[o.id,o]));extra.forEach(o=>m.set(o.id,o));return [...m.values()]}
function sourceKey(o){try{const u=new URL(o.source);return u.hostname.toLowerCase()+u.pathname.replace(/\/$/,'')}catch{return o.id}}
function rebuildCatalog(){const known=new Set(baseCatalog.map(sourceKey));catalog=merge(merge(baseCatalog,state.live.filter(o=>!known.has(sourceKey(o)))),state.imported)}
async function fetchNow(){
 if(fetching)return;fetching=true;state.lastFetch=new Date().toISOString();state.lastFetchSources=[];renderFetchControls();if(view==='refresh')refresh();
 try{
  const response=await fetch('/api/fetch',{cache:'no-store',signal:AbortSignal.timeout(25000)});
  const data=await response.json();if(!Array.isArray(data.sources)||!Array.isArray(data.opportunities))throw Error('Live endpoint is unavailable');
  state.lastFetch=data.checkedAt||new Date().toISOString();state.lastFetchSources=data.sources;
  if(!response.ok||data.sources.every(s=>s.status==='error'))throw Error('Live sources unavailable');
  const valid=data.opportunities.map(normalize),known=new Set([...baseCatalog,...state.imported].map(sourceKey)),newRows=valid.filter(o=>!known.has(sourceKey(o))),prior=new Set(state.live.map(o=>o.id));
  state.live=merge(state.live,newRows);state.lastSuccessfulFetch=state.lastFetch;rebuildCatalog();persist();
  notify('Fetched '+valid.length+' listings · '+newRows.filter(o=>!prior.has(o.id)).length+' new opportunities');
 }catch(err){
  if(!state.lastFetch||!state.lastFetchSources.length||state.lastFetchSources.every(s=>s.status!=='error')){state.lastFetch=new Date().toISOString();state.lastFetchSources=[{name:'Live feed',status:'error',message:'Could not fetch live listings. Your existing catalog is unchanged.'}]}
  notify('Live fetch failed. Saved data and catalog retained.');
 }finally{fetching=false;persist();render()}
}
function renderFetchControls(){document.querySelectorAll('[data-fetch]').forEach(b=>{b.disabled=fetching;b.textContent=fetching?'Fetching…':'↻ Fetch now'});$('#fetch-label').textContent=fetching?'Checking live source':state.lastSuccessfulFetch?'Live listings fetched':'Source-backed tracker'}
function toggleCompare(id){if(state.compare.includes(id))state.compare=state.compare.filter(x=>x!==id);else if(state.compare.length<4)state.compare.push(id);else return notify('Compare up to four opportunities at a time');persist();render();if(selected)renderDetail()}
function toggleSave(id){const saved=state.saved.includes(id);state.saved=saved?state.saved.filter(x=>x!==id):[...state.saved,id];persist();render();if(selected)renderDetail();notify(saved?'Removed from saved opportunities':'Opportunity saved')}
function setView(v){if(!headings[v])v='discover';view=v;history.replaceState(null,'','#'+v);render();window.scrollTo({top:0,behavior:'smooth'})}
function stat(){
  $('#stat-active').textContent=catalog.filter(active).length;
  $('#stat-soon').textContent=catalog.filter(o=>active(o)&&days(o)<=7).length;
  $('#stat-saved').textContent=state.saved.filter(id=>catalog.some(o=>o.id===id)).length;
  $('#stat-progress').textContent=catalog.filter(o=>['Researching','Building','Ready to submit'].includes(appStatus(o))).length;
  $('#saved-count').textContent=$('#stat-saved').textContent;
}
const headings={discover:['Discover opportunities','Find a strong fit for your next build.'],saved:['Saved opportunities','Keep your highest-potential opportunities in one place.'],compare:['Compare opportunities','Decide where to invest your time.'],calendar:['Deadline calendar','All dated deadlines displayed in Sri Lanka time.'],pipeline:['Application pipeline','Track your progress from research to submission.'],refresh:['Daily refresh','Keep your catalog current using source-backed updates.']};
function render(){stat();document.querySelectorAll('.nav-btn').forEach(b=>{const on=b.dataset.view===view;b.classList.toggle('active',on);b.setAttribute('aria-current',on?'page':'false')});$('#breadcrumb').textContent=headings[view][0];document.body.dataset.view=view;$('.hero').hidden=view!=='discover';$('.stats').hidden=!['discover','saved'].includes(view);if(view==='calendar')calendar();else if(view==='pipeline')pipeline();else if(view==='refresh')refresh();else if(view==='compare')compareView();else listing();renderFetchControls();renderCompareTray()}
const empty=(title,desc)=>'<div class="empty"><h3>'+escape(title)+'</h3><p>'+escape(desc)+'</p></div>';
function field(name,label,vals){return '<div class="field"><label for="filter-'+name+'">'+label+'</label><select id="filter-'+name+'" data-filter="'+name+'"><option value="">All '+label.toLowerCase()+'</option>'+options(vals,filters[name])+'</select></div>'}
function listing(){
  const themes=[...new Set(catalog.flatMap(o=>o.themes))].sort(), regions=[...new Set(catalog.map(o=>o.region))].sort();
  $('#workspace').innerHTML='<div class="heading"><div><h2>'+headings[view][0]+'</h2><p>'+headings[view][1]+'</p></div><button data-reset>Reset filters</button></div><div class="filter-panel"><div class="filter-top"><input type="search" class="search" aria-label="Search opportunities" placeholder="Search by name, organizer, technology…" value="'+escape(filters.query)+'" id="search"><button data-view="refresh">Source updates ↗</button></div><div class="filters">'+field('eligibility','Eligibility',['Likely eligible','Unverified','Ineligible'])+field('deadline','Deadline',['Open / upcoming','Next 7 days','Next 30 days','Closed','Unannounced'])+field('region','Region',regions)+field('student','Student status',['Required','Not required','Student track available','Unverified'])+field('theme','Technical theme',themes)+field('prize','Prize / funding',['Cash prize','Funding / credits','Non-cash','Unverified'])+field('status','Application status',stages)+field('kind','Type',[...new Set(catalog.map(o=>o.kind))])+'</div></div><div class="result-bar"><span id="result-count"></span><label>Sort by <select data-filter="sort" aria-label="Sort opportunities"><option value="fit" '+(filters.sort==='fit'?'selected':'')+'>Best fit</option><option value="deadline" '+(filters.sort==='deadline'?'selected':'')+'>Deadline</option><option value="name" '+(filters.sort==='name'?'selected':'')+'>Name</option></select></label></div><div id="results"></div>';
  results();
}
function results(){
  let rows=catalog.filter(o=>view!=='saved'||state.saved.includes(o.id)).filter(o=>{
    const q=filters.query.toLowerCase().trim();
    if(q&&![o.name,o.organizer,o.description,...o.themes].join(' ').toLowerCase().includes(q))return false;
    if(filters.eligibility&&filters.eligibility!==o.eligibility)return false;
    if(filters.region&&filters.region!==o.region)return false;
    if(filters.student&&filters.student!==o.student)return false;
    if(filters.theme&&!o.themes.includes(filters.theme))return false;
    if(filters.prize&&filters.prize!==o.valueType)return false;
    if(filters.status&&filters.status!==appStatus(o))return false;
    if(filters.kind&&filters.kind!==o.kind)return false;
    if(filters.deadline==='Open / upcoming'&&!active(o))return false;
    if(filters.deadline==='Next 7 days'&&(!active(o)||days(o)>7))return false;
    if(filters.deadline==='Next 30 days'&&(!active(o)||days(o)>30))return false;
    if(filters.deadline==='Closed'&&!closed(o))return false;
    if(filters.deadline==='Unannounced'&&o.deadline)return false;
    return true;
  });
  rows.sort((a,b)=>filters.sort==='name'?a.name.localeCompare(b.name):filters.sort==='deadline'?(Number(!!active(b))-Number(!!active(a))||days(a)-days(b)):(Number(!!active(b))-Number(!!active(a))||((b.fit||0)-(a.fit||0))));
  $('#result-count').textContent=rows.length+' '+(rows.length===1?'opportunity':'opportunities')+' · source catalog '+(checkedAt||'unavailable');
  $('#results').innerHTML=rows.length?'<div class="cards">'+rows.map(card).join('')+'</div>':empty('No matching opportunities','Try changing the filters or save an opportunity from Discover.');
}
function deadlineBadge(o){if(!o.deadline)return '<span class="badge over">'+(o.kind==='Watchlist'?'Watchlist':'Deadline unverified')+'</span>';if(closed(o))return '<span class="badge over">Closed</span>';return '<span class="badge '+(days(o)<=7?'warn':'good')+'">'+(days(o)===0?'Due today':days(o)<=7?'Due in '+days(o)+' days':'Upcoming')+'</span>'}
function tags(o){return '<div class="tags">'+o.themes.map(v=>'<span class="tag">'+escape(v)+'</span>').join('')+'</div>'}
function card(o){const id=escape(o.id), saved=state.saved.includes(o.id), status=appStatus(o);return '<article class="opp"><div class="row"><div class="opp-id"><div class="monogram">'+escape(o.organizer.slice(0,2).toUpperCase())+'</div><div><small>'+escape(o.organizer)+' · '+escape(o.kind)+'</small><h3>'+escape(o.name)+'</h3></div></div><button class="icon-button '+(saved?'saved':'')+'" data-save="'+id+'" aria-label="'+(saved?'Remove saved opportunity':'Save opportunity')+'" aria-pressed="'+saved+'">'+(saved?'◆':'◇')+'</button></div><div class="badges">'+deadlineBadge(o)+'<span class="badge '+(o.eligibility==='Likely eligible'?'good':'warn')+'">'+escape(o.eligibility)+'</span>'+(status!=='Not started'?'<span class="badge">'+escape(status)+'</span>':'')+'</div><p>'+escape(o.description)+'</p>'+tags(o)+'<div class="meta"><div><small>'+escape(o.deadlineType)+'</small><strong>'+escape(due(o))+'</strong></div><div><small>Prize / benefits</small><strong>'+escape(o.prize)+'</strong></div><div><small>Region</small><strong>'+escape(o.region)+'</strong></div><div><small>Student status</small><strong>'+escape(o.student)+'</strong></div></div><div class="actions"><button data-detail="'+id+'">View & plan application</button><a href="'+escape(safeUrl(o.source))+'" target="_blank" rel="noopener noreferrer">Official source ↗</a></div></article>'}
function calendar(){
  const y=month.getFullYear(),m=month.getMonth(),first=new Date(y,m,1).getDay(),count=new Date(y,m+1,0).getDate(),label=month.toLocaleDateString('en-US',{month:'long',year:'numeric'});let html='';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d=>html+='<div class="weekday">'+d+'</div>');
  for(let i=0;i<Math.ceil((first+count)/7)*7;i++){const d=i-first+1,key=y+'-'+String(m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');html+='<div class="day '+(key===today()?'today':'')+'">'+(d<1||d>count?'':d+catalog.filter(o=>dayKey(o.deadline)===key).map(o=>'<button data-detail="'+escape(o.id)+'" title="'+escape(o.name)+'">'+escape(o.name)+'</button>').join(''))+'</div>'}
  const next=catalog.filter(active).sort((a,b)=>days(a)-days(b));
  $('#workspace').innerHTML='<div class="heading"><div><h2>Deadline calendar</h2><p>Deadlines in Asia/Colombo; date-only sources lack verified cutoff times.</p></div><button data-ics>Export .ics</button></div><div class="panel"><div class="calendar-title"><button data-month="-1" aria-label="Previous month">‹</button><strong>'+label+'</strong><button data-month="1" aria-label="Next month">›</button></div><div class="calendar-grid">'+html+'</div></div><div class="panel"><h3>Upcoming deadlines</h3><div class="agenda">'+(next.length?next.map(o=>'<button data-detail="'+escape(o.id)+'"><span>'+escape(o.name)+'<br><small class="muted">'+escape(o.deadlineType)+'</small></span><span>'+escape(due(o))+'</span></button>').join(''):empty('No upcoming deadlines','Refresh the catalog for new competitions.'))+'</div></div>';
}
function pipeline(){
  let tracked=catalog.filter(o=>state.saved.includes(o.id)||getApp(o.id).status!=='Not started');
  $('#workspace').innerHTML='<div class="heading"><div><h2>Application pipeline</h2><p>Open any card to change status, complete tasks and keep notes.</p></div><button data-view="discover">Discover more</button></div><div class="pipeline">'+stages.map(s=>{const items=tracked.filter(o=>appStatus(o)===s);return '<div class="column"><h3>'+escape(s)+' <span class="muted">· '+items.length+'</span></h3>'+(items.length?items.map(o=>'<button data-detail="'+escape(o.id)+'"><strong>'+escape(o.name)+'</strong><br><small class="muted">'+getApp(o.id).checks.length+'/'+o.checklist.length+' tasks · '+escape(due(o))+'</small></button>').join(''):'<small class="muted">No applications</small>')+'</div>'}).join('')+'</div>';
}
const sourceWatch=[['Devpost','https://devpost.com/hackathons?status=open'],['Microsoft Imagine Cup','https://imaginecup.microsoft.com/'],['CNCF events','https://www.cncf.io/events/'],['Kaggle competitions','https://www.kaggle.com/competitions'],['NASA Space Apps','https://www.spaceappschallenge.org/'],['Google Summer of Code','https://summerofcode.withgoogle.com/'],['MLH hackathons','https://mlh.io/seasons/'],['Hello Tomorrow','https://hello-tomorrow.org/']];
function refresh(){
  $('#workspace').innerHTML='<div class="heading"><div><h2>Daily refresh</h2><p>Review official sources and import verified changes. No background research runs inside this static site.</p></div></div><div class="refresh-grid"><div class="panel"><h3>Catalog health</h3><div class="badges"><span class="badge good">'+catalog.length+' tracked</span><span class="badge warn">'+catalog.filter(o=>o.eligibility==='Unverified').length+' eligibility checks needed</span></div><p>Source research date: <strong>'+escape(checkedAt||'Unknown')+'</strong></p><p>Last catalog load: '+escape(state.lastRefresh?new Date(state.lastRefresh).toLocaleString():'Never')+'</p><p>Last manual review: '+escape(state.lastReview||'Not recorded')+'</p><button class="primary" data-reload>Reload catalog ↻</button> <button data-reviewed>Mark reviewed today</button><p class="small-text">Reload fetches the published catalog, not live organizer pages. Mark reviewed only after checking the sources.</p></div><div class="panel"><h3>Import daily findings</h3><p>Paste a JSON catalog to merge new or updated records by ID. Saved items, notes and progress stay intact.</p><textarea id="import-data" aria-label="Paste opportunity catalog JSON" placeholder="Paste an opportunities JSON array or object"></textarea><div class="actions"><button data-import class="primary">Import findings</button><button data-export>Export catalog</button></div><p class="small-text">Download the current schema using Export catalog. Keep eligibility unverified unless supported by official rules.</p></div></div><div class="panel"><h3>Sources to review</h3><p class="muted">Check these daily for announcements, deadlines and rule changes.</p><div class="source-list">'+sourceWatch.map(([n,u])=>'<a href="'+u+'" target="_blank" rel="noopener noreferrer">'+n+' <span>↗</span></a>').join('')+'</div></div>';
}
function renderDetail(){const o=catalog.find(x=>x.id===selected);if(!o)return;const a=getApp(o.id),pct=Math.round(a.checks.filter(x=>o.checklist.includes(x)).length/o.checklist.length*100),saved=state.saved.includes(o.id);$('#details-content').innerHTML='<div class="detail"><div class="row"><div><small class="muted">'+escape(o.organizer)+' · '+escape(o.kind)+'</small><h2>'+escape(o.name)+'</h2></div><button data-close aria-label="Close details">×</button></div><div class="badges">'+deadlineBadge(o)+'<span class="badge '+(o.eligibility==='Likely eligible'?'good':'warn')+'">'+escape(o.eligibility)+'</span></div><p>'+escape(o.description)+'</p>'+tags(o)+'<div class="meta"><div><small>'+escape(o.deadlineType)+'</small><strong>'+escape(due(o))+'</strong><br><small>'+escape(timeText(o))+'</small></div><div><small>Prize / funding</small><strong>'+escape(o.prize)+'</strong></div><div><small>Region</small><strong>'+escape(o.region)+'</strong></div><div><small>Student status</small><strong>'+escape(o.student)+'</strong></div></div><h3>Eligibility review</h3><p>'+escape(o.eligibilityNote)+'</p><div class="links"><a href="'+escape(safeUrl(o.source))+'" target="_blank" rel="noopener noreferrer">Opportunity website ↗</a><a href="'+escape(safeUrl(o.rules))+'" target="_blank" rel="noopener noreferrer">Official rules ↗</a></div><h3>Application status</h3><select id="app-status" aria-label="Application status">'+options(stages,a.status)+'</select><h3>Guided checklist · '+pct+'%</h3><div class="progressbar"><i style="width:'+pct+'%"></i></div>'+o.checklist.map((c,i)=>'<label class="check"><input type="checkbox" data-check="'+i+'" '+(a.checks.includes(c)?'checked':'')+'><span>'+escape(c)+'</span></label>').join('')+'<h3>Personal notes</h3><textarea rows="3" id="app-notes" aria-label="Personal application notes" placeholder="Project idea, team, eligibility evidence…">'+escape(a.notes)+'</textarea><div class="actions" style="margin-top:14px"><button data-save="'+escape(o.id)+'" class="'+(saved?'':'primary')+'">'+(saved?'Remove from saved':'Save opportunity')+'</button><button data-close>Done</button></div></div>'}
function openDetail(id){selected=id;renderDetail();if(!$('#details').open)$('#details').showModal()}
function updateApp(change){state.applications[selected]={...getApp(selected),...change};persist();render()}
function download(name,content,type){const a=el('a',{href:URL.createObjectURL(new Blob([content],{type})),download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportIcs(){const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');const dt=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Competition Radar//EN'];catalog.filter(o=>o.deadline).forEach(o=>{const allDay=o.deadline.length===10;lines.push('BEGIN:VEVENT','UID:'+o.id+'@competition-radar','DTSTAMP:'+dt,allDay?'DTSTART;VALUE=DATE:'+o.deadline.replace(/-/g,''):'DTSTART:'+new Date(o.deadline).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),'SUMMARY:'+esc(o.name+' — '+o.deadlineType),'URL:'+safeUrl(o.source),'END:VEVENT')});lines.push('END:VCALENDAR');download('competition-deadlines.ics',lines.join('\r\n'),'text/calendar')}
function normalize(o){
 const fields=['id','name','organizer','kind','region','student','eligibility','eligibilityNote','deadlineType','prize','valueType','source','rules','description'];if(!o||fields.some(k=>typeof o[k]!=='string'||!o[k].trim())||!Array.isArray(o.themes)||!o.themes.every(x=>typeof x==='string')||!Array.isArray(o.checklist)||!o.checklist.length||!o.checklist.every(x=>typeof x==='string')||safeUrl(o.source)==='#'||safeUrl(o.rules)==='#'||!(o.deadline===null||typeof o.deadline==='string'&&!isNaN(Date.parse(o.deadline))))throw new Error('Invalid record: '+(o?.name||'unknown'));if(!['Likely eligible','Unverified','Ineligible'].includes(o.eligibility))throw Error('Invalid eligibility label');return {...o,fit:Math.min(100,Math.max(0,Number(o.fit)||0))};
}
const originalCard=card;
card=o=>{
 const compared=state.compare.includes(o.id),fresh=o.sourceType==='Live listing';
 const button='<button class="compare-toggle '+(compared?'chosen':'')+'" data-compare="'+escape(o.id)+'" aria-pressed="'+compared+'">'+(compared?'✓ Added to compare':'+ Compare')+'</button>';
 const stamp=fresh?'<span class="freshness">Listing checked '+escape(o.checkedAt&&!isNaN(Date.parse(o.checkedAt))?dateKey(new Date(o.checkedAt)):'date unverified')+' · eligibility unverified</span>':'<span class="freshness">Curated source · '+escape(checkedAt)+'</span>';
 return originalCard(o).replace('</article>','<div class="card-bottom">'+stamp+button+'</div></article>');
};
function renderCompareTray(){
 const rows=state.compare.map(id=>catalog.find(o=>o.id===id)).filter(Boolean);
 $('#compare-count').textContent=rows.length;
 const tray=$('#compare-tray');tray.hidden=!rows.length||view==='compare';
 tray.innerHTML='<div><strong>'+rows.length+' selected</strong><div class="muted tray-label">'+rows.map(o=>escape(o.name)).join(' · ')+'</div></div><button data-clear-compare>Clear</button><button class="primary" data-view="compare">Compare '+rows.length+' →</button>';
}
function compareView(){
 const rows=state.compare.map(id=>catalog.find(o=>o.id===id)).filter(Boolean);
 const available=catalog.filter(o=>!state.compare.includes(o.id)).sort((a,b)=>b.fit-a.fit);
 const picker='<div class="compare-picker"><select id="compare-add" aria-label="Add opportunity to compare"><option value="">Select another opportunity…</option>'+available.map(o=>'<option value="'+escape(o.id)+'">'+escape(o.name)+'</option>').join('')+'</select><button data-add-compare '+(rows.length>=4?'disabled':'')+'>Add to comparison</button><button data-clear-compare>Clear all</button></div>';
 const dataRows=[
  ['Relevance',o=>escape(o.fit)+'/100 <small class="muted">heuristic fit</small>'],
  ['Deadline',o=>escape(due(o))+'<br><small class="muted">'+escape(timeText(o))+'</small>'],
  ['Time remaining',o=>deadlineBadge(o)],
  ['Prize / funding',o=>escape(o.prize)],
  ['Eligibility',o=>'<span class="badge '+(o.eligibility==='Likely eligible'?'good':'warn')+'">'+escape(o.eligibility)+'</span><p>'+escape(o.eligibilityNote)+'</p>'],
  ['Student status',o=>escape(o.student)],
  ['Region',o=>escape(o.region)],
  ['Technical focus',o=>tags(o)],
  ['Application status',o=>escape(appStatus(o))],
  ['Checklist',o=>{const n=getApp(o.id).checks.filter(c=>o.checklist.includes(c)).length;return n+' / '+o.checklist.length+' completed<div class="progressbar"><i style="width:'+Math.round(n/o.checklist.length*100)+'%"></i></div>'}],
  ['Source',o=>'<a class="source-link" href="'+escape(safeUrl(o.source))+'" target="_blank" rel="noopener noreferrer">Official source ↗</a>'],
 ];
 const table=rows.length?'<div class="compare-scroll"><table class="compare-table"><thead><tr><th scope="col">Opportunity</th>'+rows.map(o=>'<th scope="col"><div class="compare-head"><small class="muted">'+escape(o.organizer)+'</small><strong>'+escape(o.name)+'</strong><button data-compare="'+escape(o.id)+'" aria-label="Remove '+escape(o.name)+' from comparison">Remove ×</button></div></th>').join('')+'</tr></thead><tbody>'+dataRows.map(([label,fn])=>'<tr><th scope="row">'+label+'</th>'+rows.map(o=>'<td>'+fn(o)+'</td>').join('')+'</tr>').join('')+'<tr><th scope="row">Next action</th>'+rows.map(o=>'<td><button class="primary" data-detail="'+escape(o.id)+'">Plan application</button></td>').join('')+'</tr></tbody></table></div>':empty('Choose opportunities to compare','Add up to four from the list above or use Compare on any opportunity card.');
 $('#workspace').innerHTML='<div class="heading"><div><span class="section-kicker">DECISION SUPPORT</span><h2>Compare opportunities</h2><p>Compare deadlines, prizes, fit, eligibility and application workload side by side.</p></div><button data-view="discover">Browse catalog →</button></div><div class="panel compare-panel">'+picker+'<div class="comparison-note">Fit scores reflect your selected technical interests, not winning probability. Always verify the eligibility notes.</div>'+table+'</div>';
}
const originalRefresh=refresh;
refresh=()=>{
 originalRefresh();
 const h=$('#workspace .heading p');h.textContent='Fetch public Devpost listings on demand, then verify individual rules before applying.';
 const p=$('#workspace .refresh-grid .panel');
 const last=state.lastFetch?new Date(state.lastFetch).toLocaleString('en-GB',{timeZone:'Asia/Colombo'}):'Not fetched yet';
 const statuses=state.lastFetchSources.map(s=>'<div class="feed-row"><span>'+escape(s.name)+'</span><span class="badge '+(s.status==='success'?'good':'warn')+'">'+escape(s.status)+'</span><small>'+escape(s.message)+'</small></div>').join('');
 p.innerHTML='<span class="section-kicker">LIVE DISCOVERY</span><h3>Fetch opportunities</h3><p>Discover new relevant open online Devpost listings. Existing curated details and application progress are preserved.</p><div class="feed-stat"><strong>'+state.live.length+'</strong><span>Live discoveries</span></div><div class="feed-status">'+(statuses||'<div class="feed-row">Ready to fetch from Devpost.</div>')+'</div><p class="small-text">Last attempt: '+escape(last)+' (Sri Lanka time)</p><button class="primary" data-fetch>↻ Fetch now</button> <button data-reload>Reload curated catalog</button><p class="small-text">New listings are unverified until official rules are reviewed. Other sources below are manual watchlists; no claimed background scan.</p><button data-reviewed>Mark reviewed today</button><p class="small-text">Last manual review: '+escape(state.lastReview||'Not recorded')+'</p>';
 renderFetchControls();
};
document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;const d=b.dataset;
 if('fetch'in d)fetchNow();
 if('explore'in d)$('#workspace').scrollIntoView({behavior:'smooth',block:'start'});
 if(d.compare)toggleCompare(d.compare);
 if('clearCompare'in d){state.compare=[];persist();render()}
 if('addCompare'in d){const id=$('#compare-add')?.value;if(id)toggleCompare(id)}
});
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;if(d.view)setView(d.view);if(d.save)toggleSave(d.save);if(d.detail)openDetail(d.detail);if('close'in d){$('#details').close();selected=null}if('reset'in d){Object.keys(filters).forEach(k=>filters[k]=k==='sort'?'fit':'');listing()}if(d.month){month=new Date(month.getFullYear(),month.getMonth()+Number(d.month),1);calendar()}if('ics'in d)exportIcs();if('reload'in d){try{await load();notify('Published catalog reloaded')}catch{notify('Catalog reload failed; your saved data was retained')}}if('reviewed'in d){state.lastReview=today();persist();refresh();notify('Manual review recorded')}if('export'in d)download('opportunities.json',JSON.stringify({checkedAt,opportunities:catalog},null,2),'application/json');if('import'in d){try{const data=JSON.parse($('#import-data').value),list=Array.isArray(data)?data:data.opportunities;if(!Array.isArray(list)||!list.length)throw Error('Empty catalog');const valid=list.map(normalize);state.imported=merge(state.imported,valid);catalog=merge(catalog,valid);persist();render();notify('Imported '+valid.length+' records')}catch(err){notify('Import failed: '+err.message)}}});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset.filter){filters[t.dataset.filter]=t.value;results()}if(t.id==='app-status'){updateApp({status:t.value});renderDetail()}if(t.dataset.check!==undefined){const o=catalog.find(x=>x.id===selected),c=o.checklist[Number(t.dataset.check)],a=getApp(selected),checks=t.checked?[...new Set([...a.checks,c])]:a.checks.filter(x=>x!==c);updateApp({checks});renderDetail()}});
document.addEventListener('input',e=>{if(e.target.id==='search'){filters.query=e.target.value;results()}if(e.target.id==='app-notes'){state.applications[selected]={...getApp(selected),notes:e.target.value};persist()}});
$('#details').addEventListener('close',()=>selected=null);
$('#details').addEventListener('click',e=>{if(e.target===$('#details'))$('#details').close()});
window.addEventListener('hashchange',()=>{const v=location.hash.slice(1);if(headings[v]){view=v;render()}});
if(headings[location.hash.slice(1)])view=location.hash.slice(1);
load().catch(()=>{$('#workspace').innerHTML=empty('Catalog unavailable','Please reload this page. Your saved data is preserved.')});
