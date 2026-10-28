// OOXML structure follows Microsoft Learn's WordprocessingML/package docs.
// https://learn.microsoft.com/en-us/office/open-xml/word/structure-of-a-wordprocessingml-document
import { deflateRawSync } from 'node:zlib';
import { inspectWord } from './documents.mjs';

const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function crc(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let bit=0;bit<8;bit++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
export function docxZip(parts){
  const files=[],central=[];let offset=0;
  for(const[name,value]of Object.entries(parts)){
    const raw=Buffer.isBuffer(value)?value:Buffer.from(value),data=deflateRawSync(raw),file=Buffer.from(name),checksum=crc(raw),local=Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);local.writeUInt16LE(20,4);local.writeUInt16LE(8,8);local.writeUInt32LE(checksum,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(raw.length,22);local.writeUInt16LE(file.length,26);
    files.push(local,file,data);const entry=Buffer.alloc(46);entry.writeUInt32LE(0x02014b50);entry.writeUInt16LE(20,4);entry.writeUInt16LE(20,6);entry.writeUInt16LE(8,10);entry.writeUInt32LE(checksum,16);entry.writeUInt32LE(data.length,20);entry.writeUInt32LE(raw.length,24);entry.writeUInt16LE(file.length,28);entry.writeUInt32LE(offset,42);central.push(entry,file);offset+=local.length+file.length+data.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22),count=Object.keys(parts).length;end.writeUInt32LE(0x06054b50);end.writeUInt16LE(count,8);end.writeUInt16LE(count,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...files,directory,end]);
}
const run=(text,{bold=false,code=false}={})=>`<w:r>${bold||code?`<w:rPr>${bold?'<w:b/>':''}${code?'<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/>':''}</w:rPr>`:''}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
const inline=text=>{
  const tokens=String(text).split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map(t=>t.startsWith('**')&&t.endsWith('**')?run(t.slice(2,-2),{bold:true}):t.startsWith('`')&&t.endsWith('`')?run(t.slice(1,-1),{code:true}):run(t)).join('');
};
const p=(text,style='Normal')=>`<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${inline(text)}</w:p>`;
const paragraphs=text=>String(text||'').split(/\n+/).filter(Boolean).map(line=>{
  const h=/^(#{1,3})\s+(.+)$/.exec(line);return p(h?h[2]:line,h?'Heading'+Math.min(h[1].length,2):'Normal');
}).join('');
const table=(headers,rows,widths)=>{
  const row=(cells,header=false)=>`<w:tr><w:trPr>${header?'<w:tblHeader/>':''}<w:cantSplit/></w:trPr>${cells.map((cell,i)=>`<w:tc><w:tcPr><w:tcW w:w="${widths[i]}" w:type="dxa"/><w:vAlign w:val="center"/>${header?'<w:shd w:fill="E8EFF7"/>':''}</w:tcPr><w:p><w:pPr><w:spacing w:after="60"/></w:pPr>${header?run(cell,{bold:true}):inline(cell)}</w:p></w:tc>`).join('')}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a,b)=>a+b,0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(side=>`<w:${side} w:val="single" w:sz="4" w:color="D9D9D9"/>`).join('')}</w:tblBorders><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${row(headers,true)}${rows.map(r=>row(r)).join('')}</w:tbl>`;
};
export function createPlanWord(job,revision,{feature,images=[]}={}){
  const plan=revision.plan,selected=feature?(plan.features||[]).find(f=>f.id===feature):null;
  if(feature&&!selected)throw new Error('Unknown feature in this plan version.');
  const title=(selected?selected.title+' feature brief':job.title+' master plan').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
  let body=p(title,'Title')+p('Version '+revision.number+'   '+revision.status.toUpperCase(),'Subtitle')+p('This document records the scope and design of the selected plan version. Review its acceptance criteria before authorizing work. A plan is not proof that its features have been implemented or tested.')+
    p('Plan summary','Heading1')+paragraphs(selected?selected.brief||plan.summary:plan.summary)+
    p('Source and workflow','Heading1')+p('Plan version '+revision.id)+p('Content hash '+revision.hash)+p('Workflow '+(job.workflow_profile||'strict'))+p('Baseline '+plan.base_commit)+
    (plan.repositories?.length?table(['Repository','Branch','Baseline'],plan.repositories.map(r=>[r.path,r.branch,r.base_commit]),[3300,1300,4400]):p('Target branch '+plan.target_branch));
  if(!selected&&plan.features?.length){body+=p('Feature roadmap','Heading1')+table(['Feature','Dependencies','Delivery status'],plan.features.map(f=>[f.id+' '+f.title,f.depends_on.join(', ')||'None',job.features?.find(j=>j.id===f.id)?.status||'planned']),[5100,1800,2100]);}
  body+=p('Scope','Heading1')+(selected?paragraphs(selected.brief||'Inherits the approved master scope.'):plan.scope.map(s=>p('- '+s)).join(''))+
    p('Acceptance criteria','Heading1')+(selected?.acceptance||plan.acceptance).map((s,i)=>p((i+1)+'. '+s)).join('')+
    p('Permissions and budget','Heading1')+plan.permissions.map(s=>p('- '+s)).join('')+p('Budget '+plan.budget)+p('Planning and approval do not authorize deployment or production changes.');
  for(const feature of selected?[selected]:plan.features||[]) {
    body+=p(feature.id+' '+feature.title,'Heading1')+paragraphs(feature.brief||'Inherits the master scope and design.')+p('Depends on '+(feature.depends_on.join(', ')||'None'))+feature.acceptance.map((value,index)=>p((index+1)+'. '+value)).join('');
    if(feature.design)body+=p('Feature design '+feature.design);
    if(feature.readiness)body+=p('Readiness '+feature.readiness);
  }
  if(plan.mobile){const mobile=plan.mobile;body+=p('Web to mobile architecture and contracts','Heading1')+p('Source '+mobile.source_commit)+p('Approach '+mobile.strategy)+p('Existing API '+mobile.api_base_url)+p('Authentication '+mobile.auth)+p('Storage '+mobile.storage)+p('Offline '+mobile.offline)+
    table(['Web screen','Mobile screen','Acceptance'],mobile.screens.map(s=>[s.web,s.mobile,s.acceptance]),[2400,2400,4200])+
    table(['Method','API path','Contract check'],mobile.api_contracts.map(a=>[a.method,a.path,a.check]),[1000,3000,5000])+
    table(['Platform','Required device check'],mobile.device_checks.map(d=>[d.platform,d.check]),[1800,7200]);}
  if(plan.integrations?.length)body+=p('Authorized integrations','Heading1')+table(['Tool','Operations','Limits'],plan.integrations.map(i=>[i.tool,i.operations.join(', '),i.max_calls+' calls'+(i.max_usd?' / $'+i.max_usd:'')]),[1800,4000,3200]);
  const design=plan.design;
  if(design){body+=p('Design for review','Heading1')+paragraphs(design.summary)+p('Layout '+design.variant)+p('These screen concepts use sample data. They are not application or native QA screenshots.');
    if(design.reference)body+=p('Supplied design reference '+design.reference);
    body+=design.screens.map(s=>p(s.title,'Heading2')+p(s.description)+p('Fields '+(s.fields.join(', ')||'None'))+p('Sections '+s.sections.join(', '))).join('');
  }
  const imageParts={},relations=[];let imageBody='';
  for(let i=0;i<Math.min(images.length,12);i++){
    const image=images[i];if(!Buffer.isBuffer(image.bytes)||!image.bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw new Error('Design image must be a PNG.');
    const id='image'+(i+1),name='media/'+id+'.png';imageParts['word/'+name]=image.bytes;relations.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${name}"/>`);
    const width=2743200,height=Math.round(width*(image.height||900)/(image.width||430));
    imageBody+=`<w:p><w:pPr><w:pStyle w:val="Heading2"/><w:pageBreakBefore/></w:pPr>${run(image.title||'Design screen')}</w:p>`+`<w:p><w:r><w:drawing><wp:inline><wp:extent cx="${width}" cy="${height}"/><wp:docPr id="${i+1}" name="${id}" descr="${xml(image.title||'Sample design screen')}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${i+1}" name="${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  }
  body+=p('Verification and review','Heading1')+p('Code presence, test evidence and acceptance are tracked separately. Each feature requires the actual checks, document review and independent verdicts for its reviewed source. Changed scope requires a reviewed plan revision.');
  if(job.plan_versions?.length)body+=p('Plan version history','Heading2')+table(['Version','Status','Content hash'],job.plan_versions.map(v=>['v'+v.number,v.status,v.hash]),[1100,1500,6400]);
  if(job.decisions?.length)body+=p('Recorded review decisions','Heading2')+table(['Unit / stage','Decision','Time'],job.decisions.map(d=>[(d.unit||'')+' / '+(d.stage||''),d.action,d.time]),[3400,2600,3000]);
  if(plan.code_analysis?.length)body+=table(['Feature','Code status','Evidence'],plan.code_analysis.map(r=>[r.feature_id,r.status,r.detail+' Commit '+r.commit]),[1500,2100,5400]);
  body+=imageBody+'<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr><w:r><w:rPr><w:sz w:val="2"/></w:rPr><w:t> </w:t></w:r></w:p>';
  // Word merges adjacent tables, including their repeating header rows.
  body=body.replace(/<\/w:tbl>(?=<w:tbl>)/g,'</w:tbl><w:p/>');
  const ns='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const styles=`<?xml version="1.0" encoding="UTF-8"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="000000"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>${[['Normal',22],['Title',44],['Subtitle',24],['Heading1',32],['Heading2',25]].map(([id,size])=>`<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${id}"/>${id!=='Normal'?'<w:basedOn w:val="Normal"/>':''}<w:pPr>${id!=='Normal'?'<w:keepNext/><w:spacing w:before="220" w:after="140"/>':''}${id.startsWith('Heading')?`<w:outlineLvl w:val="${Number(id.slice(-1))-1}"/>`:''}</w:pPr><w:rPr><w:color w:val="000000"/><w:sz w:val="${size}"/>${id.startsWith('Heading')||id==='Title'?'<w:b/>':''}</w:rPr></w:style>`).join('')}</w:styles>`;
  const parts={
    '[Content_Types].xml':'<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="main" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    'word/document.xml':`<?xml version="1.0" encoding="UTF-8"?><w:document ${ns}><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1620" w:bottom="1080" w:left="1620"/></w:sectPr></w:body></w:document>`,
    'word/styles.xml':styles,
    'word/_rels/document.xml.rels':`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${relations.join('')}</Relationships>`,...imageParts
  };
  const bytes=docxZip(parts);inspectWord(bytes);return {bytes,title};
}
