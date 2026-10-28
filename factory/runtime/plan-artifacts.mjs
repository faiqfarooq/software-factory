import { readFile, writeFile, access, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { safePath, atomic, digest, stamp, uid } from './storage.mjs';
import { createPlanWord } from './plan-word.mjs';
import { generatedDesign, revisionOf, planHash } from './plans.mjs';
import { inspectWord } from './documents.mjs';

const exec=promisify(execFile),PNG=Buffer.from([137,80,78,71,13,10,26,10]);
const id=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(value);
const exists=async file=>access(file).then(()=>true,()=>false);
export function exportBinding(job,revision,feature){return digest(JSON.stringify({revision:revision.hash,status:revision.status,approved_at:revision.approved_at,workflow:job.workflow_profile||'strict',decisions:job.decisions,versions:job.plan_versions?.map(v=>[v.id,v.status,v.approved_at]),feature:feature||null,progress:job.features.map(f=>[f.id,f.status,f.integrated_commit||null]),design:revision.plan.design||generatedDesign(revision.plan,job.design),export_schema:3}));}
export function reservePlanExport(state,input){
  if(!input||Object.keys(input).some(k=>!['id','job_id','version','feature'].includes(k))||!id(input.id))throw new Error('Invalid export request.');
  const job=state.jobs.find(j=>j.id===input.job_id);if(!job||!job.plan||job.trashed_at)throw new Error('Select an active plan version.');
  const revision=revisionOf(job,input.version);if(!revision)throw new Error('No plan to export.');
  if(input.feature&&!(revision.plan.features||[]).some(f=>f.id===input.feature))throw new Error('Feature is absent from this plan version.');
  job.plan_artifacts ||= [];
  const requestHash=digest(JSON.stringify(input)),prior=job.plan_artifacts.find(a=>a.request_id===input.id);
  if(prior){if(prior.request_hash!==requestHash)throw new Error('Export request id conflict.');return {artifact:prior,duplicate:true};}
  const binding=exportBinding(job,revision,input.feature),existing=job.plan_artifacts.find(a=>a.binding===binding&&['generating','rendered','ready'].includes(a.status));
  if(existing)return {artifact:existing,duplicate:true};
  const artifact={id:uid(),request_id:input.id,request_hash:requestHash,kind:'plan-word',version:revision.id,version_number:revision.number,feature:input.feature||null,
    plan_status:revision.status,plan_hash:revision.hash,
    binding,status:'generating',time:stamp(),title:input.feature?'Feature brief':'Master plan',layout_review:'pending',preview_images:[],review:null};
  job.plan_artifacts.push(artifact);return {artifact,duplicate:false,revision:structuredClone(revision),job:structuredClone(job)};
}
async function browserExecutable(){
  const candidates=process.platform==='win32'?['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe']:['/usr/bin/chromium','/usr/bin/google-chrome','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  for(const candidate of candidates)if(await exists(candidate))return candidate;return null;
}
export async function buildPlanExport(root,origin,job,revision,artifact,{capture=true,render=true}={}){
  if(!id(artifact.id))throw new Error('Invalid artifact id.');
  const relative='factory/.local/plan-artifacts/'+artifact.id,folder=await safePath(root,relative);await mkdir(folder,{recursive:true});
  const design=revision.plan.design||generatedDesign(revision.plan,job.design),images=[],imageMetadata=[];
  const chrome=capture?await browserExecutable():null;
  if(chrome){
    for(const screen of design.screens.slice(0,4)){
      const file='screen-'+screen.id+'.png',target=await safePath(root,relative+'/'+file);
      const profile=await safePath(root,relative+'/browser-'+screen.id);
      const query=new URLSearchParams({job:job.id,version:revision.id,screen:screen.id});
      try{
        const preview=await fetch(origin+'/api/plans/preview?'+query,{signal:AbortSignal.timeout(5000)});
        if(!preview.ok||!preview.headers.get('content-type')?.startsWith('text/html'))throw new Error('The registered design preview did not render.');
        await preview.body.cancel();
        await exec(chrome,['--headless=new','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--hide-scrollbars','--force-device-scale-factor=1','--window-size=500,1150','--user-data-dir='+profile,'--screenshot='+target,origin+'/api/plans/preview?'+query],{timeout:45000,windowsHide:true,maxBuffer:1024*1024});
        const bytes=await readFile(target);if(!bytes.subarray(0,8).equals(PNG)||bytes.length>10*1024*1024)throw new Error('Invalid screenshot.');
        const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
        images.push({bytes,title:screen.title,width,height});imageMetadata.push({screen:screen.id,title:screen.title,file,width,height,sha256:digest(bytes)});
      }catch(error){await writeFile(path.join(folder,'screen-'+screen.id+'-failure.log'),String(error.stderr||error.message));}
    }
  }
  const documentRevision={...revision,plan:{...revision.plan,design}};
  const {bytes,title}=createPlanWord(job,documentRevision,{feature:artifact.feature,images});
  await atomic(await safePath(root,relative+'/plan.docx'),bytes);
  const result={status:'generated',title,sha256:digest(bytes),bytes:bytes.length,file:relative+'/plan.docx',preview_images:imageMetadata,
    capture:chrome?imageMetadata.length===design.screens.slice(0,4).length?'complete':'partial':'unavailable',layout_review:'pending'};
  if(render){
    if(process.platform!=='win32')return {...result,status:'needs-action',message:'Word page rendering needs a supported local renderer.'};
    try{
      await exec('powershell.exe',['-NoProfile','-NonInteractive','-WindowStyle','Hidden','-File',await safePath(root,'factory/runtime/render-plan.ps1'),'-ArtifactId',artifact.id],{cwd:root,timeout:120000,windowsHide:true,maxBuffer:1024*1024});
      const report=JSON.parse((await readFile(await safePath(root,relative+'/render.json'),'utf8')).replace(/^\uFEFF/,''));
      if(report.sha256!==result.sha256||!Array.isArray(report.pages)||!report.pages.length)throw new Error('Render binding mismatch.');
      return {...result,status:'rendered',render:report,pages:report.pages.length,message:'All pages rendered. Waiting for the owner to inspect each page before the Word download is marked ready.'};
    }catch(error){await writeFile(path.join(folder,'render-failure.log'),String(error.stderr||error.message));return {...result,status:'needs-action',message:'Word rendering did not complete. The owner must inspect the private renderer receipt; no layout pass is claimed.'};}
  }
  return result;
}
export async function reviewPlanExport(root,job,input){
  if(!input||Object.keys(input).some(k=>!['artifact_id','sha256','inspected_pages','note','status'].includes(k))||!id(input.artifact_id)||!['passed','needs-action'].includes(input.status||'passed'))throw new Error('Invalid artifact review.');
  const artifact=job.plan_artifacts?.find(a=>a.id===input.artifact_id);
  const passed=(input.status||'passed')==='passed';
  if(!artifact||artifact.status!=='rendered'||artifact.sha256!==input.sha256||!Array.isArray(input.inspected_pages)||
      !input.inspected_pages.length||input.inspected_pages.some((page,index)=>!Number.isSafeInteger(page)||page<1||page>artifact.pages||(index>0&&page<=input.inspected_pages[index-1]))||
      (passed&&(input.inspected_pages.length!==artifact.pages||input.inspected_pages.some((page,index)=>page!==index+1)))||typeof input.note!=='string'||input.note.trim().length<10||input.note.length>2000)throw new Error('Inspect every rendered page and bind the review to the exact Word bytes.');
  const base='factory/.local/plan-artifacts/'+artifact.id;
  const bytes=await readFile(await safePath(root,base+'/plan.docx'));inspectWord(bytes);if(digest(bytes)!==artifact.sha256)throw new Error('Word bytes changed after rendering.');
  const report=JSON.parse((await readFile(await safePath(root,base+'/render.json'),'utf8')).replace(/^\uFEFF/,''));
  if(report.sha256!==artifact.sha256||report.pages.length!==artifact.pages)throw new Error('The render receipt changed.');
  for(let page=1;page<=artifact.pages;page++){
    const image=await readFile(await safePath(root,base+'/page-'+page+'.png'));if(!image.subarray(0,8).equals(PNG))throw new Error('Missing rendered page.');
  }
  if(!passed){
    artifact.status='needs-action';artifact.layout_review='needs-action';artifact.review={method:'rendered-pages',sha256:artifact.sha256,pages:artifact.pages,inspected_pages:[...input.inspected_pages],time:stamp(),note:input.note};
    artifact.message='Word layout needs correction: '+input.note+' Prepare Word download again after the exporter is fixed.';
    return {id:artifact.id,status:artifact.status,pages:artifact.pages};
  }
  artifact.status='ready';artifact.layout_review='passed';artifact.review={method:'rendered-pages',sha256:artifact.sha256,pages:artifact.pages,time:stamp(),note:input.note};
  artifact.message='Word plan ready. Every rendered page was inspected by the owner.';return {id:artifact.id,status:'ready',pages:artifact.pages};
}
export async function readPlanArtifact(root,job,artifactId,{image,page}={}){
  if(!id(artifactId))throw new Error('Invalid artifact id.');
  const artifact=job.plan_artifacts?.find(a=>a.id===artifactId);if(!artifact)throw new Error('Unknown plan artifact.');
  const base='factory/.local/plan-artifacts/'+artifact.id;
  if(image){const entry=artifact.preview_images?.find(i=>i.screen===image);if(!entry)throw new Error('Unknown preview image.');const bytes=await readFile(await safePath(root,base+'/'+entry.file));if(digest(bytes)!==entry.sha256)throw new Error('Preview image changed.');return {bytes,type:'image/png'};}
  if(page!==undefined){if(!Number.isSafeInteger(page)||page<1||page>artifact.pages)throw new Error('Unknown page.');return {bytes:await readFile(await safePath(root,base+'/page-'+page+'.png')),type:'image/png'};}
  if(artifact.status!=='ready'||artifact.review?.sha256!==artifact.sha256)throw new Error('Word layout review is pending.');
  const bytes=await readFile(await safePath(root,base+'/plan.docx'));if(digest(bytes)!==artifact.sha256)throw new Error('Word file changed.');inspectWord(bytes);
  return {bytes,type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',filename:'plan-v'+artifact.version_number+(artifact.feature?'-'+artifact.feature:'')+'.docx'};
}
