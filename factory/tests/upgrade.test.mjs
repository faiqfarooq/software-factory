import test from 'node:test';
import assert from 'node:assert/strict';
import { newLifecycle, publishLifecycle, stage, refreshLifecycleOffer, currentOfferHash, sequence, claimLifecycle, currentUnit, recordIntegration, validateLifecycleCommand, recordWorker } from '../runtime/lifecycle.mjs';
import { generatedDesign, planHash, revisionImpact, revisionOf } from '../runtime/plans.mjs';
import { applyPlanCommand } from '../runtime/plan-commands.mjs';
import { enqueue,claim,recoverCommand } from '../runtime/workflow.mjs';
import { createPlanWord } from '../runtime/plan-word.mjs';
import { inspectWord } from '../runtime/documents.mjs';
import { designPreview } from '../runtime/design-previews.mjs';
import { reservePlanExport,exportBinding } from '../runtime/plan-artifacts.mjs';
import { REVIEWERS } from '../runtime/profiles.mjs';

export function fixture(profile='streamlined'){
 const job=newLifecycle({input:{mode:'product',title:'Learning app',requirements:'Learner and parent portals',target_branch:'main',workflow_profile:profile}});
 job.workspace={...job.workspace,prepared:true,base_commit:'a'.repeat(40)};
 const plan={summary:'Learner and parent mobile app',scope:['Learner and parent journeys'],acceptance:['Sign in','Open course'],permissions:['Read existing API'],budget:'Existing subscription only',target_branch:job.workspace.target,base_commit:'a'.repeat(40),documentation:['developer','user'],features:[{id:'F01',title:'Sign in',depends_on:[],acceptance:['Sign in'],brief:'Reuse authentication API'},{id:'F02',title:'Courses',depends_on:['F01'],acceptance:['Open course'],brief:'Open assigned courses'}]};
 plan.code_analysis=plan.features.map(f=>({feature_id:f.id,status:'needs-verification',files:[],commit:'a'.repeat(40),detail:'Synthetic test fixture, not actual application analysis.'}));
 plan.design=generatedDesign(plan);job.cursor=sequence(job).indexOf('specification');
 const state={revision:1,jobs:[job],commands:[],activity:[],owner:{id:'owner',generation:'g',connected:true,expires_at:new Date(Date.now()+90000).toISOString()}};
 publishLifecycle(state,{status:'awaiting-stage',plan,deliverable:{summary:'Master requirements and design',content:'Complete scope, contracts and sample screens for review.'}},{id:'planning',action:'request'},job);
 return {state,job,plan:job.plan};
}
test('streamlined master approval inherits scope; explicit Start feature goes to implementation',()=>{
 const {state,job}=fixture();assert.equal(stage(job),'specification');
 claimLifecycle(state,{id:'approved',action:'approve-stage'},job);assert.equal(job.status,'ready-feature');assert.equal(job.offer.kind,'start-feature');
 claimLifecycle(state,{id:'start',action:'start-feature'},job);assert.equal(stage(job),'implementation');assert.equal(job.status,'running');assert.deepEqual(job.features[0].plan.acceptance,['Sign in']);assert.ok(job.features[0].inherited_approval);assert.equal(job.features[1].status,'planned');
 assert.throws(()=>publishLifecycle(state,{status:'reviewing',advance:'qa'},{id:'start'},job),/Commit source/);
});
test('strict profile retains original stages and hash ignores new library metadata',()=>{
 const {job}=fixture('strict');const before=currentOfferHash(job);job.plan_draft={id:'draft'};job.plan_artifacts=[{id:'export'}];assert.equal(currentOfferHash(job),before);assert.equal(sequence(job).length,4);
});
test('durable queued consent survives elapsed lease time and harmless plan artifacts, never changed offer',()=>{
 const {state,job}=fixture();enqueue(state,{id:'approval',action:'approve-stage',job_id:job.id,offer_id:job.offer.id,revision:1});
 job.plan_artifacts=[{id:'export'}];assert.equal(claim(state,Date.now()+3600000).id,'approval');assert.equal(job.status,'ready-feature');
 const other=fixture();enqueue(other.state,{id:'stale',action:'approve-stage',job_id:other.job.id,offer_id:other.job.offer.id,revision:1});other.job.plan.summary+=' changed';assert.equal(claim(other.state),null);assert.equal(other.state.commands[0].status,'expired');
});
test('draft editing is immutable, idempotent and impact includes downstream dependants',()=>{
 const {state,job,plan}=fixture();const snapshot=JSON.stringify(plan),next=structuredClone(plan);next.features[0].brief='Changed auth';
 const input={id:'save',operation:'save-draft',job_id:job.id,revision:1,plan:next};const result=applyPlanCommand(state,input);assert.equal(JSON.stringify(job.plan),snapshot);assert.deepEqual(result.impact.affected,['F01','F02']);assert.deepEqual(applyPlanCommand(state,input),result);
 const other=structuredClone(plan);other.features[1].brief='New course UX';assert.deepEqual(revisionImpact(plan,other).affected,['F02']);
 applyPlanCommand(state,{id:'submit',operation:'submit-revision',job_id:job.id,revision:1});assert.equal(job.status,'awaiting-stage');assert.equal(job.plan.features[0].brief,'Changed auth');assert.equal(job.plan_versions[0].plan.features[0].brief,'Reuse authentication API');
});
test('trash and restore preserve source metadata and reject uncertain work',()=>{
 const {state,job}=fixture();const original=structuredClone(job.workspace);
 applyPlanCommand(state,{id:'trash',operation:'trash',job_id:job.id,revision:1});assert.ok(job.trashed_at);assert.deepEqual(job.workspace,original);
 applyPlanCommand(state,{id:'restore',operation:'restore',job_id:job.id,revision:1});assert.equal(job.trashed_at,undefined);assert.equal(job.offer.hash,currentOfferHash(job));
 state.commands.push({id:'uncertain',job_id:job.id,status:'uncertain'});assert.throws(()=>applyPlanCommand(state,{id:'no',operation:'trash',job_id:job.id,revision:1}),/reconcile/);
});
test('migration is reversible before execution and does not start a feature',()=>{
 const {state,job}=fixture('strict');job.approved_plan_hash=planHash(job.plan);job.features[0].builder_session='original-builder';
 applyPlanCommand(state,{id:'migrate',operation:'migrate',job_id:job.id,revision:1});assert.equal(job.status,'ready-feature');assert.equal(job.features[0].builder_session,'original-builder');assert.equal(job.features[0].workspace.prepared,false);
 applyPlanCommand(state,{id:'rollback',operation:'rollback-migration',job_id:job.id,revision:1});assert.equal(job.workflow_profile,'strict');assert.equal(stage(job),'specification');
});
test('publication recovery retains command identity and refuses uncertain side effects',()=>{
 const {state,job}=fixture();state.commands.push({id:'interrupted',action:'request',job_id:job.id,status:'uncertain',owner_id:'owner',owner_generation:'g'});
 assert.equal(recoverCommand(state,{owner_id:'owner',command_id:'interrupted',note:'Actual terminal worker receipts inspected; only the saved result needs publication.'}).replay,false);
 state.commands[0].status='uncertain';state.commands[0].action='approve-merge';assert.throws(()=>recoverCommand(state,{owner_id:'owner',command_id:'interrupted',note:'Inspect actual git side effects first.'}),/side effects/);
});
test('Word export is genuine OOXML and design escapes hostile text with no network capability',()=>{
 const {state,job}=fixture();const revision=revisionOf(job),doc=createPlanWord(job,revision);assert.ok(inspectWord(doc.bytes));assert.equal(doc.bytes.readUInt32LE(0),0x04034b50);
 job.plan.design.screens[0].title='<img src=x onerror=alert(1)>';const preview=designPreview(job.plan);assert.ok(!preview.html.includes('<img src=x'));assert.match(preview.html,/&lt;img/);assert.match(preview.csp,/connect-src 'none'/);assert.match(preview.csp,/nonce-/);
 const first=reservePlanExport(state,{id:'word',job_id:job.id,version:revision.id});assert.equal(first.artifact.status,'generating');assert.equal(reservePlanExport(state,{id:'word',job_id:job.id,version:revision.id}).duplicate,true);assert.throws(()=>reservePlanExport(state,{id:'word',job_id:job.id,version:revision.id,feature:'F01'}),/conflict/);
});
test('complete streamlined lifecycle verifies QA and explicit integration, waits between features and uses fresh aggregate reviews',()=>{
 const {state,job}=fixture();claimLifecycle(state,{id:'master',action:'approve-stage'},job);
 const proof=(aggregate=false)=>{
   const unit=currentUnit(job),commit='b'.repeat(40);unit.commit=commit;
   unit.documentation=['developer','user'].map(kind=>({kind,entry:kind+'.docx',format:'docx',status:'complete',commit,verification:{method:'rendered-pages',status:'passed',sha256:'c'.repeat(64),pages:1}}));
   if(!aggregate){publishLifecycle(state,{status:'reviewing',advance:'qa'},{id:'feature'},job);assert.equal(stage(job),'qa');}
   unit.checks=unit.plan.acceptance.map(label=>({label,status:'passed',commit}));
   unit.reviews=REVIEWERS.map(role=>({role,verdict:'PASS',commit,reviewer_id:(aggregate?'aggregate':job.active_feature)+'-'+role,summary:'Synthetic unit-test verdict'}));
   unit.approver={verdict:'APPROVE',commit};
   for(const review of unit.reviews)job.workers.push({role:review.role,session:review.reviewer_id,status:'completed',commit,feature:job.active_feature,stage:stage(job)});
   job.workers.push({role:'approver',session:'technical-'+(job.active_feature||'aggregate'),status:'completed',commit,feature:job.active_feature,stage:stage(job)});
   publishLifecycle(state,{status:'awaiting-stage',deliverable:{summary:'Verified result',content:'Synthetic lifecycle test evidence; not live QA.',coverage:unit.plan.acceptance.map(requirement=>({requirement,check:requirement}))}},{id:'feature'},job);
   assert.equal(job.offer.kind,'approve-merge');assert.equal(job.status,'awaiting-stage');
   validateLifecycleCommand(state,{action:'approve-merge',offer_id:job.offer.id},job);claimLifecycle(state,{id:'integrate',action:'approve-merge'},job);assert.equal(job.status,'merging');recordIntegration(job,commit);
 };
 for(const feature of ['F01','F02']){assert.equal(job.status,'ready-feature');claimLifecycle(state,{id:'start-'+feature,action:'start-feature'},job);assert.equal(job.active_feature,feature);proof();}
 assert.equal(job.status,'ready-acceptance');assert.equal(job.offer.kind,'start-acceptance');claimLifecycle(state,{id:'aggregate',action:'start-acceptance'},job);assert.equal(stage(job),'acceptance');proof(true);assert.equal(job.status,'merged');
});
test('regeneration retains unchanged acceptance; removed feature evidence survives and all-accepted revision offers final acceptance',()=>{
 const {state,job}=fixture();job.features.forEach(f=>{f.status='accepted';f.checks=[{label:'retained'}];});
 claimLifecycle(state,{id:'regenerate',action:'revise-product',input:{stage:'specification',note:'Reanalyse current code'}},job);assert.equal(job.features[0].status,'accepted');
 publishLifecycle(state,{status:'awaiting-stage',plan:structuredClone(job.plan),deliverable:{summary:'Unchanged roadmap',content:'Reconciled actual code without changing accepted scope.'}},{id:'regenerate'},job);
 claimLifecycle(state,{id:'approve',action:'approve-stage'},job);assert.equal(job.status,'ready-acceptance');
 const next=structuredClone(job.plan);next.features=next.features.slice(0,1);next.acceptance=['Sign in'];
 applyPlanCommand(state,{id:'draft',operation:'save-draft',job_id:job.id,revision:1,plan:next});applyPlanCommand(state,{id:'revision',operation:'submit-revision',job_id:job.id,revision:1});assert.equal(job.removed_features[0].feature.checks[0].label,'retained');
});
test('readiness and revocation checks cannot be bypassed by trash restoration or migration rollback',()=>{
 const {state,job}=fixture();job.features[0].readiness=['API reachable'];claimLifecycle(state,{id:'approve',action:'approve-stage'},job);
 assert.throws(()=>validateLifecycleCommand(state,{action:'start-feature',offer_id:job.offer.id},job),/readiness/);
 applyPlanCommand(state,{id:'trash',operation:'trash',job_id:job.id,revision:1});state.authorization_epoch=1;job.configuration_changed=true;applyPlanCommand(state,{id:'restore',operation:'restore',job_id:job.id,revision:1});assert.equal(job.status,'blocked');assert.equal(job.offer,null);
 const other=fixture('strict');other.job.approved_plan_hash=planHash(other.job.plan);applyPlanCommand(other.state,{id:'switch',operation:'migrate',job_id:other.job.id,revision:1});other.state.authorization_epoch=1;assert.throws(()=>applyPlanCommand(other.state,{id:'undo',operation:'rollback-migration',job_id:other.job.id,revision:1}),/security/);
});
test('approved Word exports have different bindings and publication-only recovery cannot dispatch a worker',()=>{
 const {state,job}=fixture(),draft=structuredClone(revisionOf(job));const before=exportBinding(job,draft);claimLifecycle(state,{id:'approve',action:'approve-stage'},job);assert.notEqual(exportBinding(job,revisionOf(job)),before);
 claimLifecycle(state,{id:'start',action:'start-feature'},job);const command={id:'interrupted',action:'start-feature',job_id:job.id,status:'uncertain',owner_id:'owner'};state.commands.push(command);recoverCommand(state,{owner_id:'owner',command_id:command.id,note:'Inspected terminal receipts, publication only.'});
 assert.throws(()=>recordWorker(state,{roles:{builder:'claude'},models:{builder:'configured'}},{owner_id:'owner',job_id:job.id,command_id:command.id,id:'new',role:'builder',model:'configured',session:'new-session',status:'running',task:'Relaunch implementation'}),/Publication recovery/);
});
test('legacy version links remain readable and migration preserves an already prepared feature branch',()=>{
 const {state,job}=fixture('strict');job.plan_versions=[];const legacy=revisionOf(job);assert.equal(revisionOf(job,legacy.id).hash,legacy.hash);
 job.approved_plan_hash=planHash(job.plan);job.features[0].workspace.prepared=true;job.features[0].workspace.base_commit='a'.repeat(40);
 applyPlanCommand(state,{id:'switch',operation:'migrate',job_id:job.id,revision:1});assert.equal(job.features[0].workspace.prepared,true);assert.equal(job.features[0].workspace.base_commit,'a'.repeat(40));
});
test('claim blocks a queued Start if readiness was revoked; streamlined parent revisions reject absent stages',()=>{
 const {state,job}=fixture();job.features[0].readiness=['API reachable'];claimLifecycle(state,{id:'approved',action:'approve-stage'},job);job.feature_readiness={F01:{plan_hash:job.approved_plan_hash,checks:[{label:'API reachable',status:'passed'}]}};
 enqueue(state,{id:'start',action:'start-feature',job_id:job.id,offer_id:job.offer.id,revision:1});job.feature_readiness.F01.checks[0].status='failed';assert.equal(claim(state),null);assert.equal(state.commands[0].status,'blocked');assert.equal(job.status,'ready-feature');
 assert.throws(()=>validateLifecycleCommand(state,{action:'revise-product',input:{stage:'design',note:'Revise consolidated design'}},job),/stage/);
});
test('standalone material revision archives and clears old quality evidence while preserving its builder',()=>{
 const base=fixture(),job=newLifecycle({input:{mode:'feature',workflow_profile:'streamlined',title:'One feature',requirements:'Sign in',target_branch:'main'}});job.workspace={...job.workspace,prepared:true,base_commit:'a'.repeat(40)};const plan=structuredClone(base.plan);delete plan.features;const state={...base.state,jobs:[job]};
 publishLifecycle(state,{status:'awaiting-stage',plan,deliverable:{summary:'Standalone plan',content:'Complete standalone scope and design.'}},{id:'plan'},job);
 job.checks=[{label:'old'}];job.reviews=[{verdict:'PASS'}];job.approver={verdict:'APPROVE'};job.commit='b'.repeat(40);job.builder_session='same-builder';const revision=structuredClone(job.plan);revision.scope.push('A changed requirement');
 applyPlanCommand(state,{id:'save',operation:'save-draft',job_id:job.id,revision:1,plan:revision});applyPlanCommand(state,{id:'submit',operation:'submit-revision',job_id:job.id,revision:1});assert.deepEqual(job.checks,[]);assert.deepEqual(job.reviews,[]);assert.equal(job.approver,null);assert.equal(job.commit,null);assert.equal(job.builder_session,'same-builder');assert.equal(job.evidence_history[0].checks[0].label,'old');
});
test('terminal jobs cannot revive through plan revision or migration, and another active delivery blocks execution changes',()=>{
 for(const status of ['merged','cancelled']){const {state,job}=fixture();job.status=status;const next=structuredClone(job.plan);next.summary+=' Revised';applyPlanCommand(state,{id:'save',operation:'save-draft',job_id:job.id,revision:1,plan:next});assert.throws(()=>applyPlanCommand(state,{id:'submit',operation:'submit-revision',job_id:job.id,revision:1}),/read-only/);const strict=fixture('strict');strict.job.status=status;assert.throws(()=>applyPlanCommand(strict.state,{id:'switch',operation:'migrate',job_id:strict.job.id,revision:1}),/read-only/);}
 const {state,job}=fixture();state.jobs.push({...structuredClone(job),id:'other'});const next=structuredClone(job.plan);next.summary+=' Revised';applyPlanCommand(state,{id:'save',operation:'save-draft',job_id:job.id,revision:1,plan:next});assert.throws(()=>applyPlanCommand(state,{id:'submit',operation:'submit-revision',job_id:job.id,revision:1}),/other active/);
});
test('superseded drafts retain exact revision identifiers and content in history',()=>{
 const {state,job}=fixture(),first=structuredClone(job.plan);first.summary+=' First edit';applyPlanCommand(state,{id:'first',operation:'save-draft',job_id:job.id,revision:1,plan:first});const old=structuredClone(job.plan_draft),second=structuredClone(first);second.summary+=' Second edit';applyPlanCommand(state,{id:'second',operation:'save-draft',job_id:job.id,revision:1,plan:second});assert.deepEqual(revisionOf(job,old.id).plan,old.plan);assert.ok(job.plan_draft.number>old.number);
});
test('numeric Streamlined master budget caps cumulative known feature usage',()=>{
 const {state,job}=fixture();job.plan.budget=10;refreshLifecycleOffer(job);claimLifecycle(state,{id:'master',action:'approve-stage'},job);claimLifecycle(state,{id:'start',action:'start-feature'},job);
 publishLifecycle(state,{status:'running',usage:{tokens:null,usd:6,completeness:'partial'}},{id:'start'},job);assert.equal(job.status,'running');
 job.features[0].status='accepted';job.features[1].plan=structuredClone(job.features[0].plan);job.active_feature='F02';job.features[1].status='running';
 publishLifecycle(state,{status:'running',usage:{tokens:null,usd:6,completeness:'partial'}},{id:'second'},job);assert.equal(job.status,'blocked');assert.match(job.message,/Cumulative/);
});
test('local plan artifacts do not expire stop requests and a late pause preserves a completed checkpoint',()=>{
 const {state,job}=fixture();claimLifecycle(state,{id:'master',action:'approve-stage'},job);claimLifecycle(state,{id:'start',action:'start-feature'},job);
 enqueue(state,{id:'pause',action:'pause',job_id:job.id,revision:1});job.plan_artifacts=[{id:'render',status:'ready'}];job.features[0].checks=[{label:'Implementation progressed'}];assert.equal(claim(state).id,'pause');
 const other=fixture();other.job.status='planning';other.job.offer=null;enqueue(other.state,{id:'late-pause',action:'pause',job_id:other.job.id,revision:1});other.job.status='awaiting-stage';refreshLifecycleOffer(other.job);const offer=other.job.offer.id;assert.equal(claim(other.state),null);assert.equal(other.state.commands[0].status,'completed');assert.equal(other.job.offer.id,offer);
});
test('neutral app concepts do not infer education from parent categories or mobile wording, and gallery is keyboard-inert',()=>{
 const plan={summary:'Inventory mobile app with parent categories, of course',features:[{title:'Stock overview'}]};plan.design=generatedDesign(plan);assert.deepEqual(plan.design.screens.map(s=>s.kind),['auth','dashboard','detail']);const gallery=designPreview(plan);assert.match(gallery.html,/<body inert>/);assert.match(gallery.html,/<div class="logo">i<span>/);assert.ok(!gallery.html.includes('GCSE'));assert.ok(!gallery.html.includes('Sample child'));assert.match(gallery.html,/Sample workspace/);assert.ok(!designPreview(plan,{prototype:true}).html.includes('<body inert>'));
});
test('migration rollback cannot erase fresh product-acceptance execution receipts',()=>{
 const {state,job}=fixture('strict');job.approved_plan_hash=planHash(job.plan);job.features.forEach(feature=>feature.status='accepted');applyPlanCommand(state,{id:'switch',operation:'migrate',job_id:job.id,revision:1});assert.equal(job.status,'ready-acceptance');claimLifecycle(state,{id:'start-final',action:'start-acceptance'},job);job.status='blocked';job.workers.push({id:'fresh-review',status:'completed'});job.usage={usd:1};
 assert.throws(()=>applyPlanCommand(state,{id:'undo',operation:'rollback-migration',job_id:job.id,revision:1}),/new execution/);assert.equal(job.workers.at(-1).id,'fresh-review');assert.equal(job.usage.usd,1);
});
test('an exact stage decision remains valid when only the owner heartbeat changed the global revision',()=>{
 const {state,job}=fixture(),reviewed=state.revision;state.revision++;const decision=enqueue(state,{id:'decision',action:'approve-stage',job_id:job.id,offer_id:job.offer.id,revision:reviewed});assert.equal(decision.status,'pending');assert.equal(claim(state).id,'decision');assert.equal(job.status,'ready-feature');
});
