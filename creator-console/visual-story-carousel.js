(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const download=(href,name)=>{const a=document.createElement('a');a.href=href;a.download=name;document.body.appendChild(a);a.click();a.remove();};
  function persisted(){return window.VisualStoryPersistence?.getCurrent?.()||null;}
  async function compile(){
    const studio=window.VisualStoryStudio;
    const spec=studio?.getSpec?.();
    if(!spec)throw new Error('Generate a visual story first.');
    const saved=persisted();
    const payload=saved?.storyId&&!saved?.dirty?{storyId:saved.storyId,itemsPerSlide:2}:{spec,itemsPerSlide:2};
    const response=await fetch('/api/visual-story-carousel',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const body=await response.json();
    if(!response.ok)throw new Error(body.error||`Carousel compilation failed (${response.status})`);
    return body;
  }
  async function capture(slide){
    const studio=window.VisualStoryStudio,canvas=$('artboard');
    studio.setSpec(slide.spec,slide.qa);
    await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);await sleep(25);
    return canvas.toDataURL('image/png');
  }
  function openPreview(compiled,images,original,originalQa){
    let dialog=$('carouselPreview');
    if(dialog)dialog.remove();
    dialog=document.createElement('dialog');dialog.id='carouselPreview';dialog.style.cssText='width:min(1100px,94vw);max-height:90vh;border:0;border-radius:20px;padding:0;background:#111827;color:white;box-shadow:0 30px 80px rgba(0,0,0,.45)';
    const header=document.createElement('div');header.style.cssText='display:flex;justify-content:space-between;align-items:center;padding:18px 22px;border-bottom:1px solid rgba(255,255,255,.12);position:sticky;top:0;background:#111827;z-index:2';
    const title=document.createElement('div');title.innerHTML=`<b>Carousel preview</b><div style="opacity:.65;font-size:13px;margin-top:4px">${compiled.data.slideCount} QA-certified artboards${compiled.source?.version?` · source v${compiled.source.version}`:''}</div>`;
    const controls=document.createElement('div');controls.style.cssText='display:flex;gap:8px';
    const receipt=document.createElement('button');receipt.textContent='Receipt JSON';receipt.onclick=()=>{const blob=new Blob([JSON.stringify(compiled,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);download(url,'visual-story-carousel.json');setTimeout(()=>URL.revokeObjectURL(url),1000)};
    const close=document.createElement('button');close.textContent='Close';close.onclick=()=>dialog.close();controls.append(receipt,close);header.append(title,controls);
    const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;padding:22px;overflow:auto';
    compiled.data.slides.forEach((slide,index)=>{const card=document.createElement('div');card.style.cssText='background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:12px';const img=document.createElement('img');img.src=images[index];img.alt=`Carousel slide ${index+1}`;img.style.cssText='display:block;width:100%;border-radius:10px;background:#0b1020';const meta=document.createElement('div');meta.style.cssText='display:flex;justify-content:space-between;gap:8px;align-items:center;margin-top:10px;font-size:13px';const label=document.createElement('span');label.textContent=`Slide ${index+1} · QA ${slide.qa.status} ${slide.qa.score}`;const save=document.createElement('button');save.textContent='PNG';save.onclick=()=>download(images[index],`visual-story-carousel-${String(index+1).padStart(2,'0')}.png`);meta.append(label,save);card.append(img,meta);grid.append(card)});
    dialog.append(header,grid);document.body.append(dialog);dialog.addEventListener('close',()=>{window.VisualStoryStudio?.setSpec?.(original,originalQa);dialog.remove()},{once:true});dialog.showModal();
  }
  async function previewCarousel(){
    const btn=$('carousel');if(!btn)return;const studio=window.VisualStoryStudio,original=structuredClone(studio?.getSpec?.()),originalQa=studio?.getQa?.();if(!original)return;
    btn.disabled=true;btn.textContent='Compiling…';
    try{const compiled=await compile();const images=[];for(const slide of compiled.data.slides){images.push(await capture(slide));}studio.setSpec(original,originalQa);openPreview(compiled,images,original,originalQa);}catch(error){studio?.setSpec?.(original,originalQa);const host=$('error');if(host){host.textContent=error.message||'Carousel preview failed';host.hidden=false}}finally{btn.disabled=false;btn.textContent='Carousel'}
  }
  window.addEventListener('DOMContentLoaded',()=>{$('carousel')?.addEventListener('click',previewCarousel)});
})();
