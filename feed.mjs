export const FEED_URL='https://devpost.com/api/hackathons?status%5B%5D=open&challenge_type%5B%5D=online';
const clean=v=>String(v??'').replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim().slice(0,500);
const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export function deadlineFromRange(range){
 const m=String(range??'').match(/([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{4})\s*$/);
 if(!m)return null;const month=monthNames.indexOf(m[1]);if(month<0)return null;
 const day=Number(m[2]),year=Number(m[3]),d=new Date(Date.UTC(year,month,day));
 return d.getUTCMonth()===month&&d.getUTCDate()===day?d.toISOString().slice(0,10):null;
}
const keywords={
 'AI':/\bai\b|machine learning|artificial intelligence|llm|gemini|agentic|generative|deep learning/,
 'Cloud':/cloud|aws|azure|firebase|infrastructure|serverless|devops/,
 'Kubernetes':/kubernetes|cloud.native|cncf|k8s/,
 'Open Source':/open.source|opensource/,
 'Software Engineering':/developer|software|coding|programming|web|mobile|api|productivity|hackathon/,
 'Space Tech':/\bspace\b|nasa|aerospace|satellite/,
 'Startup':/startup|entrepreneur|founder|business/,
 'Systems':/iot|robot|embedded|systems|cybersecurity|hardware|realtime/
};
export function normalizeDevpost(h,now=new Date()){
 if(!h||h.open_state!=='open'||h.invite_only||!h.id||!h.title)return null;
 let source;try{const u=new URL(h.url);if(u.protocol!=='https:'||!(u.hostname==='devpost.com'||u.hostname.endsWith('.devpost.com')))return null;source=u.origin+u.pathname.replace(/\/$/,'')+'/'}catch{return null}
 const original=(Array.isArray(h.themes)?h.themes:[]).map(t=>clean(t?.name)).filter(Boolean);
 const matchText=[h.title,h.organization_name,...original].join(' ').toLowerCase();
 const themes=Object.entries(keywords).filter(([,re])=>re.test(matchText)).map(([name])=>name);
 if(!themes.length||themes.every(t=>t==='Software Engineering')&&original.some(t=>/gaming|game jam|low\/no code/i.test(t)))return null;
 if(!themes.includes('Software Engineering'))themes.push('Software Engineering');
 const deadline=deadlineFromRange(h.submission_period_dates);
 const prize=clean(h.prize_amount)||'Not disclosed';
 const valueType=Number(h.prizes_counts?.cash)>0?'Cash prize':Number(h.prizes_counts?.other)>0?'Non-cash':'Unverified';
 return {id:'devpost-'+String(h.id).replace(/[^0-9]/g,''),name:clean(h.title),organizer:clean(h.organization_name)||'Devpost organizer',kind:'Hackathon',themes,region:'Global / online',student:'Unverified',eligibility:'Unverified',eligibilityNote:'Discovered through the public online listing. Country exclusions, age, student requirements and exact deadline time must be checked against the official rules. Online does not establish global eligibility.',deadline,deadlineType:'Submission (listing date)',prize,valueType,source,rules:source+'rules',fit:Math.min(92,55+themes.length*7),description:'Open Devpost listing'+(original.length?' · '+original.join(', '):'')+'. Review project requirements before committing.',checklist:['Confirm Sri Lanka residency, age and student eligibility','Read official rules and exact submission time','Register and select a track','Build and test an eligible project','Prepare required repository, demo and submission materials'],sourceType:'Live listing',checkedAt:now.toISOString()};
}
export async function fetchLive(fetcher=fetch){
 const now=new Date(),pages=[1,2];
 const results=await Promise.allSettled(pages.map(async page=>{
  const response=await fetcher(FEED_URL+'&page='+page,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  const body=await response.json();if(!Array.isArray(body.hackathons))throw Error('Unexpected listing format');
  return body.hackathons.map(h=>normalizeDevpost(h,now)).filter(Boolean);
 }));
 const items=results.flatMap(r=>r.status==='fulfilled'?r.value:[]),ok=results.filter(r=>r.status==='fulfilled').length;
 return {checkedAt:now.toISOString(),opportunities:[...new Map(items.map(i=>[i.id,i])).values()],sources:[{name:'Devpost',status:ok===pages.length?'success':ok?'partial':'error',message:ok?ok+' of '+pages.length+' listing pages fetched': 'Source unavailable; retain existing catalog.'}]};
}
