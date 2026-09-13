const API={
  post:async(url,data)=>{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return r.json();},
  upload:async(url,fd)=>{const r=await fetch(url,{method:'POST',body:fd});return r.json();}
};
function fmt(text){return text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\*(.*?)\*/g,'<em>$1</em>').replace(/\n/g,'<br>');}
function showLoader(id){const e=document.getElementById(id);if(e)e.classList.add('show');}
function hideLoader(id){const e=document.getElementById(id);if(e)e.classList.remove('show');}
let selFiles=[];
function openModal(){document.getElementById('overlay').classList.add('show');}
function closeModal(){document.getElementById('overlay').classList.remove('show');resetModal();}
function resetModal(){
  selFiles=[];
  const ids={  'dz-text':'Click or drag & drop PDFs here', 'file-list':'list','file-names':'html','uploadBtn':'disabled','pbar':'hide','pfill':'0','upload-status':'hide','pdfInput':'reset'};
  const dt=document.getElementById('dz-text');if(dt)dt.textContent='Click or drag & drop PDFs here';
  const fl=document.getElementById('file-list');if(fl)fl.style.display='none';
  const fn=document.getElementById('file-names');if(fn)fn.innerHTML='';
  const ub=document.getElementById('uploadBtn');if(ub){ub.disabled=true;ub.textContent='Upload & Index';}
  const pb=document.getElementById('pbar');if(pb)pb.style.display='none';
  const pf=document.getElementById('pfill');if(pf)pf.style.width='0';
  const us=document.getElementById('upload-status');if(us)us.style.display='none';
  const pi=document.getElementById('pdfInput');if(pi)pi.value='';
}
function handleFileSelect(input){const f=Array.from(input.files);if(f.length)setFiles(f);}
function handleDrop(e){
  e.preventDefault();document.getElementById('dropzone').classList.remove('drag');
  const f=Array.from(e.dataTransfer.files).filter(f=>f.type==='application/pdf');
  if(!f.length){alert('PDF files only.');return;}setFiles(f);
}
function setFiles(files){
  selFiles=files;
  const fn=document.getElementById('file-names');
  if(fn)fn.innerHTML=files.map(f=>`<li><span>📄 ${f.name}</span><span class="fsize">${(f.size/1024).toFixed(0)} KB</span></li>`).join('');
  const fl=document.getElementById('file-list');if(fl)fl.style.display='block';
  const dt=document.getElementById('dz-text');if(dt)dt.textContent=`${files.length} file${files.length>1?'s':''} selected`;
  const ub=document.getElementById('uploadBtn');if(ub){ub.disabled=false;ub.textContent=`Upload ${files.length} File${files.length>1?'s':''} & Index`;}
}
async function doUpload(){
  if(!selFiles.length)return;
  const pbar=document.getElementById('pbar'),pfill=document.getElementById('pfill'),
        status=document.getElementById('upload-status'),btn=document.getElementById('uploadBtn');
  pbar.style.display='block';if(status)status.style.display='block';
  pfill.style.width='20%';btn.disabled=true;btn.textContent='Uploading...';
  const fd=new FormData();selFiles.forEach(f=>fd.append('pdf',f));
  pfill.style.width='60%';
  try{
    const data=await API.upload('/upload_pdf',fd);pfill.style.width='100%';
    if(data.error){alert('Error: '+data.error);pbar.style.display='none';if(status)status.style.display='none';btn.disabled=false;btn.textContent='Upload & Index';return;}
    if(status){status.textContent=`✓ ${data.units.length} unit${data.units.length>1?'s':''} indexed!`;status.style.color='var(--green)';}
    setTimeout(()=>location.reload(),800);
  }catch(err){alert('Upload failed: '+err.message);pbar.style.display='none';btn.disabled=false;}
}
document.addEventListener('DOMContentLoaded',()=>{
  const ov=document.getElementById('overlay');
  if(ov)ov.addEventListener('click',e=>{if(e.target===ov)closeModal();});
});
