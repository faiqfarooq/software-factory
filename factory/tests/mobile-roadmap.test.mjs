import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import vm from'node:vm';
const source=await readFile(new URL('../dashboard/app.js',import.meta.url),'utf8'),handlers=source.slice(0,source.indexOf("for (const e of document.querySelectorAll('[data-page]')) e.addEventListener"));
class Element{children=[];classList={toggle(){}};constructor(tag){this.tag=tag;}append(...v){this.children.push(...v);}replaceChildren(...v){this.children=v;}addEventListener(){}setAttribute(){}}
function dashboard(){const elements=new Map(),context=vm.createContext({location:{hash:'',pathname:'/'},sessionStorage:{getItem:()=>''},history:{},Node:Element,mobileFields(){},document:{createElement:tag=>new Element(tag),querySelectorAll:()=>[],getElementById:id=>{if(!elements.has(id))elements.set(id,new Element('div'));return elements.get(id);}}});vm.runInContext(handlers,context);return context;}
const plan=()=>({kind:'mobile-product-proposal',version:1,status:'proposed',title:'Learner and parent release',source_repo:'D:/web',source_commit:'a'.repeat(40),output_repo:'D:/mobile',platforms:['android'],strategy:'expo-native',scope:['Learner','Parent'],excluded:['Admin','Tutor portal'],prerequisites:['Accept the foundation'],release_checks:['Test both roles'],execution:'One feature at a time; no feature has started.',screen_count:2,features:[{id:'F01',title:'Authentication',portal:'shared',status:'proposed',depends_on:[],web_screens:['/login'],acceptance:['Both roles can sign in.']},{id:'F02',title:'Parent dashboard',portal:'parent',status:'proposed',depends_on:['F01'],web_screens:['/parent'],acceptance:['Only linked children are visible.']}]});
const content=p=>'Foundation acceptance remains separate.\n```factory-roadmap\n'+JSON.stringify(p)+'\n```';
const current=p=>({purpose:'software',features:[],deliverables:[{stage:'qa',content:'Completed QA, already approved.'},{stage:'integration',content:content(p)}]});
const texts=e=>[e.textContent||'',...(e.children||[]).flatMap(texts)].join('\n');

test('a published proposal is available even while the active job is the software foundation',()=>{const d=dashboard(),job=current(plan()),before=JSON.stringify(job),p=d.mobileRoadmapProposal(job);assert.equal(p.features.length,2);assert.equal(p.features[1].depends_on[0],'F01');assert.equal(JSON.stringify(job),before);});
test('the roadmap shows ordered features, acceptance, source and prerequisites without an execution button',()=>{const d=dashboard(),p=d.mobileRoadmapProposal(current(plan())),card=d.mobileRoadmapCard(p),text=texts(card);for(const expected of['F01','F02','Authentication','Parent dashboard','Only linked children are visible.','Accept the foundation','D:/mobile','No conversion feature has started'])assert(text.includes(expected),expected);const tags=e=>[e.tag,...(e.children||[]).flatMap(tags)];assert(!tags(card).includes('button'));});
test('unknown/forward dependencies, duplicate routes and false approved statuses are rejected',()=>{const d=dashboard();for(const mutate of[p=>p.features[0].depends_on.push('F02'),p=>p.features[1].web_screens=['/login'],p=>p.status='approved',p=>p.features[0].status='completed']){const p=plan();mutate(p);assert.equal(d.mobileRoadmapProposal(current(p)),null);}});
test('malformed attachments cannot break the page or hide a valid earlier proposal',()=>{const d=dashboard(),job=current(plan());job.deliverables.push({content:'```factory-roadmap\n{broken}\n```'});assert.equal(d.mobileRoadmapProposal(job).title,'Learner and parent release');assert.equal(d.mobileRoadmapProposal({deliverables:[job.deliverables.at(-1)]}),null);});
test('normal stage text remains readable and serialized proposal data is omitted from the stage prose',()=>{const d=dashboard();assert.equal(d.deliverableText(content(plan())),'Foundation acceptance remains separate.');assert.equal(d.deliverableText('Ordinary stage deliverable.'),'Ordinary stage deliverable.');});

test('roadmaps support application-specific portals and SHA-256 source commits without Halo labels', () => {
  const d = dashboard(), p = plan();
  p.title = 'Field service release'; p.source_commit = 'b'.repeat(64);
  p.features[0].portal = 'technician'; p.features[1].portal = 'dispatcher';
  const proposal = d.mobileRoadmapProposal(current(p));
  assert(proposal);
  const text = texts(d.mobileRoadmapCard(proposal));
  assert(text.includes('Portals: technician, dispatcher'));
  assert(!text.includes('Portals: learner and parent'));
  assert(text.includes(p.source_commit));
});

test('invalid portal labels and duplicate platform selections do not become roadmap proposals', () => {
  const d = dashboard();
  for (const change of [p => p.features[0].portal = '', p => p.features[0].portal = {}, p => p.platforms = ['android', 'android']]) {
    const p = plan(); change(p);
    assert.equal(d.mobileRoadmapProposal(current(p)), null);
  }
});
test('the actual Web to mobile page displays a software-product proposal and its current stage without an empty new-request prompt',()=>{const d=dashboard(),p=plan(),job={...current(p),id:'product',title:p.title,lifecycle:2,mode:'product',phase:'product',status:'awaiting-stage',stage:'feasibility',requirements:'Learner and parent product',offer:{id:'offer',kind:'approve-stage'},timeline:[{id:'feasibility',label:'Feasibility',status:'awaiting-stage'}]};job.deliverables=[{stage:'feasibility',summary:'Conversion feasibility',content:content(p),limitations:[],coverage:[]}];d.fixture={purpose:'software',project:'Example',edition:'codex-claude',version:'2.4',owner:{connected:true,listening:false},jobs:[job],commands:[],integrations:[],activity:[]};vm.runInContext('state=fixture;page="mobile";render();',d);const text=texts(d.document.getElementById('main'));for(const expected of[p.title,'F01','F02','Current conversion planning stage','Conversion feasibility','Approve & continue'])assert(text.includes(expected),expected);assert(!text.includes('Create a mobile request'));assert(!text.includes('```factory-roadmap'));});

test('Web to mobile shows the formal dependency queue and its real statuses while specification is prepared',()=>{const d=dashboard(),p=plan(),job={...current(p),id:'product',title:p.title,lifecycle:2,mode:'product',phase:'product',status:'planning',stage:'specification',requirements:'Learner and parent product',offer:null,timeline:[{id:'specification',label:'Specification & plan',status:'planning'}],features:p.features.map(f=>({...f,status:'planned',workspace:{branch:'Existing branches'}})),message:'Waiting for backend and test-account readiness.'};job.deliverables=[{stage:'requirements',summary:'Approved requirements',content:content(p),limitations:[],coverage:[]}];d.fixture={purpose:'software',project:'Example',edition:'codex-claude',version:'2.4',owner:{connected:true,listening:false},jobs:[job],commands:[],integrations:[],activity:[]};vm.runInContext('state=fixture;page="mobile";render();',d);const text=texts(d.document.getElementById('main'));for(const expected of['Feature delivery queue','F01','F02','planned','Existing branches','Waiting for backend and test-account readiness.'])assert(text.includes(expected),expected);assert(!text.includes('Approve & continue'));assert(!text.includes('Create a mobile request'));});

