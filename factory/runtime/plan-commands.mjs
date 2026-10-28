import { digest, uid, stamp, event } from './storage.mjs';
import { isStreamlined, planHash, executionJobHash, revisionOf, rememberPlan, archiveDraft, revisionImpact, generatedDesign, validateDesign, migrationPreview, approvePlanVersion } from './plans.mjs';
import { validatePlan, publishLifecycle, hasActiveWorkers, hasActiveTools, refreshLifecycleOffer, stage } from './lifecycle.mjs';

const fail=message=>{throw new Error(message);};
const busy=state=>state.commands.some(c=>['pending','running','uncertain'].includes(c.status));
const idle=(state,job)=>{
  if(state.commands.some(c=>c.job_id===job.id&&['pending','running','uncertain'].includes(c.status))||hasActiveWorkers(job)||hasActiveTools(state,job)||(job.plan_artifacts||[]).some(a=>a.status==='generating'))fail('Wait for document rendering, or cancel/pause current work and reconcile its actual outcome first.');
  if(!['awaiting-stage','ready-feature','ready-acceptance','blocked','paused','merged','cancelled'].includes(job.status))fail('Wait for the current checkpoint first.');
};
const executable=(state,job)=>{idle(state,job);if(['merged','cancelled'].includes(job.status))fail('Completed or cancelled plans are read-only. Start a new request for new work.');if(state.jobs.some(other=>other.id!==job.id&&!other.trashed_at&&!['merged','cancelled'].includes(other.status)))fail('Finish or archive the other active plan before changing this delivery.');};
const validateDraft=(job,plan)=>{
  const copy=structuredClone(plan);
  // Workspace selection cannot be expanded by editing a plan document.
  if(JSON.stringify(copy.repositories)!==JSON.stringify(job.plan.repositories)||copy.target_branch!==job.plan.target_branch||copy.base_commit!==job.plan.base_commit)fail('Repository and baseline changes need an explicit workspace reconciliation.');
  validatePlan(copy,job.mode==='product'?{...job,phase:'product',active_feature:null}:job);
  return copy;
};
export const PLAN_OPERATIONS=['save-draft','submit-revision','discard-draft','trash','restore','regenerate','design-feedback','select-design','migrate','rollback-migration'];
export function applyPlanCommand(state,input,{enqueue,sourceSnapshot}={}){
  if(!input||Object.keys(input).some(k=>!['id','operation','job_id','revision','version','plan','note','variant'].includes(k))||
     typeof input.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(input.id)||!PLAN_OPERATIONS.includes(input.operation))fail('Invalid plan command.');
  state.plan_commands ||= [];
  const hash=digest(JSON.stringify(input)),prior=state.plan_commands.find(c=>c.id===input.id);
  if(prior){if(prior.hash!==hash)fail('Plan command id conflict.');return prior.result;}
  if(input.revision!==state.revision)fail('State changed. Refresh the plan and try again.');
  const job=state.jobs.find(j=>j.id===input.job_id);
  if(!job||job.lifecycle!==2)fail('Select a current Factory plan.');
  if(job.trashed_at&&!['restore'].includes(input.operation))fail('Restore the plan before editing or executing it.');
  const version=revisionOf(job);
  if(input.version&&![version?.id,job.plan_draft?.id].includes(input.version))fail('The plan version changed. Review the latest version.');
  let result={operation:input.operation,job_id:job.id};
  if(input.operation==='save-draft'){
    if(!job.plan)fail('Let the owner finish the first complete plan before editing.');
    const plan=validateDraft(job,input.plan);
    rememberPlan(job,job.plan,job.approved_plan_hash===planHash(job.plan)?'approved':'draft');
    archiveDraft(job);
    job.plan_draft={id:uid(),number:(job.plan_versions?.length||0)+1,status:'draft',hash:planHash(plan),plan,time:stamp(),based_on:version.id};
    result={...result,draft:job.plan_draft.id,impact:revisionImpact(job.plan,plan)};
  }else if(input.operation==='discard-draft'){
    archiveDraft(job);
    job.plan_draft=null;
  }else if(input.operation==='submit-revision'){
    executable(state,job);
    if(!job.plan_draft)fail('Save a draft first.');
    if(!isStreamlined(job))fail('This plan uses Strict workflow. Review the workflow migration before submitting a consolidated revision. Your draft is saved.');
    const draft=job.plan_draft,plan=validateDraft(job,draft.plan);
    if(planHash(plan)===planHash(job.plan)&&!job.configuration_changed)fail('The draft matches the current plan. No new approval is needed.');
    archiveDraft(job);
    job.plan_history ||= [];job.plan_history.push({time:stamp(),phase:job.phase,active_feature:job.active_feature,stages:structuredClone(job.stages),offer:job.offer,merge_receipt:job.merge_receipt,integration_pending:job.integration_pending,configuration_changed:job.configuration_changed});
    if(job.mode==='feature'&&(planHash(plan)!==planHash(job.plan)||job.configuration_changed)) {
      job.evidence_history ||= [];job.evidence_history.push({time:stamp(),reason:'Standalone scope revision',commit:job.commit,checks:job.checks,reviews:job.reviews,documentation:job.documentation,mobile_runs:job.mobile_runs,approver:job.approver});
      job.checks=[];job.reviews=[];job.documentation=[];job.mobile_runs=[];job.approver=null;job.commit=null;delete job.workspace.reviewed;
    }
    if(!plan.design)plan.design=generatedDesign(plan,job.design);
    job.configuration_changed=false;job.merge_receipt=null;job.integration_pending=null;job.rework_rounds=0;
    job.phase=job.mode==='product'?'product':'feature';job.active_feature=job.mode==='product'?null:'standalone';job.cursor=0;job.stages=[];job.status='planning';job.offer=null;
    publishLifecycle(state,{command_id:input.id,job_id:job.id,status:'awaiting-stage',plan,deliverable:{summary:'Revised master plan ready for review',content:planDocumentText(plan),limitations:['This revised plan grants no implementation or integration consent.']}},{id:input.id,action:'revise-product'},job);
    job.plan_draft=null;result={...result,offer:job.offer.id};
  }else if(input.operation==='trash'){
    idle(state,job);
    job.trash_previous_status=job.status;job.trash_previous_offer=job.offer;job.trash_authorization_epoch=state.authorization_epoch||0;job.trashed_at=stamp();job.offer=null;
    result={...result,reversible:true,codeDeleted:false};
  }else if(input.operation==='restore'){
    if(!job.trashed_at)fail('This plan is not in Plan trash.');
    if(!['merged','cancelled'].includes(job.trash_previous_status)&&state.jobs.some(j=>j.id!==job.id&&!j.trashed_at&&!['merged','cancelled'].includes(j.status)))fail('Finish or remove the other active plan before restoring this one.');
    const revoked=job.configuration_changed||job.trash_authorization_epoch!==(state.authorization_epoch||0);
    job.status=revoked?'blocked':job.trash_previous_status;delete job.trashed_at;
    if(!revoked&&job.trash_previous_offer)refreshLifecycleOffer(job,job.trash_previous_offer.kind);
    else job.offer=null;
    delete job.trash_previous_offer;delete job.trash_previous_status;
  }else if(input.operation==='regenerate'){
    executable(state,job);
    if(!isStreamlined(job))fail('Use the reviewed Streamlined switch before regeneration. Strict Request changes retains its legacy stage behavior.');
    if(!enqueue)fail('Owner queue is unavailable.');
    job.regeneration_request={id:input.id,time:stamp(),source_snapshot:sourceSnapshot||[],preserve_code:true,status:'queued'};
    const command=enqueue(state,{id:uid(),action:job.mode==='product'?'revise-product':'revise',job_id:job.id,revision:state.revision,
      input:{stage:'specification',note:'Regenerate a new draft from the actual current code. Preserve application code, accepted history and original builder. Inspect the recorded source snapshot, map existing/partial/unverified/missing features, reuse the approved requirements unless the user explicitly changed them, and publish a new master plan for review. No implementation or automatic acceptance. '+(input.note||'')}});
    job.regeneration_request.command_id=command.id;
    // The queued revision binds to the final request metadata.
    command.job_binding=command.binding_version===2?executionJobHash(job):digest(JSON.stringify(job));
    result={...result,queued:true,command_id:command.id};
  }else if(input.operation==='design-feedback'){
    if(typeof input.note!=='string'||!input.note.trim()||input.note.length>10000)fail('Describe the design feedback.');
    job.design_feedback ||= [];job.design_feedback.push({id:uid(),version:input.version||version?.id,note:input.note,time:stamp()});
  }else if(input.operation==='select-design'){
    if(!['comfortable','compact'].includes(input.variant)||!job.plan)fail('Choose an available design layout.');
    const plan=structuredClone(job.plan_draft?.plan||job.plan);
    plan.design=validateDesign({...plan.design||generatedDesign(plan,job.design),variant:input.variant});
    rememberPlan(job,job.plan,job.approved_plan_hash===planHash(job.plan)?'approved':'draft');
    archiveDraft(job);
    job.plan_draft={id:uid(),number:(job.plan_versions?.length||0)+1,status:'draft',hash:planHash(plan),plan,time:stamp(),based_on:version.id};
    result={...result,draft:job.plan_draft.id,requiresApproval:true};
  }else if(input.operation==='migrate'){
    executable(state,job);const preview=migrationPreview(job);
    if(!preview.eligible||isStreamlined(job))fail('This plan cannot switch workflow here.');
    const backup=structuredClone(job);delete backup.workflow_backup;
    job.workflow_backup={time:stamp(),authorization_epoch:state.authorization_epoch||0,job:backup};job.workflow_profile='streamlined';job.workflow_version=3;
    if(preview.masterApproved&&preview.designCovered){
      approvePlanVersion(job);
      job.phase='product';job.active_feature=null;job.cursor=0;
      for(const feature of job.features)if(feature.status!=='accepted'){
        feature.status='planned';
        if(feature.workspace.policy==='current-branches')feature.workspace={...feature.workspace,prepared:false,base_commit:null};
        delete feature.workspace.reviewed;
      }
      job.status=job.features.some(f=>f.status!=='accepted')?'ready-feature':'ready-acceptance';
      refreshLifecycleOffer(job,job.status==='ready-feature'?'start-feature':'start-acceptance');
    }else{
      job.phase='product';job.active_feature=null;job.cursor=0;job.status='planning';job.offer=null;
      job.message='Workflow switched. Complete the master plan and design; no prior approval was invented.';
    }
    result={...result,profile:'streamlined',started:false,rollbackAvailable:true};
  }else if(input.operation==='rollback-migration'){
    executable(state,job);
    const backup=job.workflow_backup;
    if(!backup||backup.authorization_epoch!==(state.authorization_epoch||0)||(job.execution_epoch||0)!==(backup.job.execution_epoch||0)||job.configuration_changed||job.approved_plan_hash!==backup.job.approved_plan_hash||planHash(job.plan)!==planHash(backup.job.plan)||job.decisions.length!==backup.job.decisions.length||job.features.some(f=>f.status==='running')||busy(state))fail('Rollback is available only before new execution, approvals or security configuration changes.');
    const retained=Object.fromEntries(['plan_artifacts','plan_draft','plan_versions','design_feedback'].filter(key=>Object.hasOwn(job,key)).map(key=>[key,structuredClone(job[key])]));
    for(const key of Object.keys(job))delete job[key];Object.assign(job,structuredClone(backup.job));
    Object.assign(job,retained);
    if(job.offer)refreshLifecycleOffer(job,job.offer.kind);
    result={...result,profile:job.workflow_profile||'strict'};
  }
  state.plan_commands.push({id:input.id,hash,operation:input.operation,job_id:job.id,time:stamp(),result});
  event(state,'Plan '+input.operation+' completed. Application source was not deleted.');return result;
}
export function planDocumentText(plan){
  let text='# '+plan.summary+'\n\n## Scope\n'+plan.scope.map(s=>'- '+s).join('\n')+'\n\n## Acceptance\n'+plan.acceptance.map((s,i)=>(i+1)+'. '+s).join('\n')+'\n\n## Permissions\n'+plan.permissions.map(s=>'- '+s).join('\n')+'\n\n## Budget\n'+plan.budget;
  if(plan.features?.length)text+='\n\n## Feature roadmap\n'+plan.features.map(f=>'### '+f.id+' '+f.title+'\nDepends on: '+(f.depends_on.join(', ')||'None')+'\n'+(f.brief||'')+'\n'+f.acceptance.map(a=>'- '+a).join('\n')).join('\n\n');
  if(plan.design)text+='\n\n## Design\n'+plan.design.summary+'\n'+plan.design.screens.map(s=>'- '+s.title+': '+s.description).join('\n');
  return text.slice(0,50000);
}
