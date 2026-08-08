// The gallery. A "collection wall" slowly cycles one hero print per location;
// tapping a print enters that location's room of photographs, which cycles and
// then returns to the wall on its own. Tapping inside a room "sits" (holds the
// light). Everything is deliberately slow. Light rises from and falls to true black.
(function(){
  const G = window.GALLERY || {rooms:[]};
  const rooms = G.rooms || [];
  const $ = id => document.getElementById(id);
  const photo=$('photo'), plate=$('plate'), capTitle=$('capTitle'), capPlace=$('capPlace'),
        capCue=$('capCue'), reveal=$('reveal'), entry=$('entry'), back=$('back'), sitEl=$('sit'), locLink=$('locLink');
  const cv=$('cv'), cx = cv && cv.getContext('2d',{willReadFrequently:true});
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!rooms.length || !reveal){ return; }

  let maxR=1600;
  function setMax(){ maxR = 1.85*Math.hypot(innerWidth,innerHeight); }
  addEventListener('resize', setMax); setMax();

  // ---- dominant colour + bounded preloading (keyed by src) ----
  const cache={}, dom={};
  function dominant(img){
    if(!cx) return '#caa46a';
    cx.clearRect(0,0,36,36); cx.drawImage(img,0,0,36,36);
    let d; try{ d=cx.getImageData(0,0,36,36).data; }catch(e){ return '#caa46a'; }
    let r=0,g=0,b=0,n=0;
    for(let p=0;p<d.length;p+=4){
      const R=d[p],Gc=d[p+1],B=d[p+2],l=0.2126*R+0.7152*Gc+0.0722*B;
      if(l<26||l>232) continue;
      const s=Math.max(R,Gc,B)-Math.min(R,Gc,B), w=1+s/128;
      r+=R*w; g+=Gc*w; b+=B*w; n+=w;
    }
    if(!n) return '#caa46a';
    r/=n; g/=n; b/=n; const a=(r+g+b)/3, K=1.3;
    r=Math.min(255,a+(r-a)*K); g=Math.min(255,a+(g-a)*K); b=Math.min(255,a+(b-a)*K);
    return 'rgb('+(r|0)+','+(g|0)+','+(b|0)+')';
  }
  function preloadSrc(src){
    if(!src || cache[src]) return cache[src];
    const img = new Image();
    img.onload = () => { if(!dom[src]) dom[src] = dominant(img); };
    img.src = src; cache[src] = img; return img;
  }

  // ---- state ----
  let mode='entry', wallIdx=0, roomIdx=0, currentRoom=null;
  let phase='rise', t0=0, pending=null, sitting=false, started=false, navToken=0;
  const RISE=reduce?900:4000, HOLD=reduce?2500:7000, FALL=reduce?900:4000, BLACK=reduce?300:1100;
  const ease = x => x<.5 ? 4*x*x*x : 1-Math.pow(-2*x+2,3)/2;

  function heroOf(room){ return room.photos[room.heroIdx] || room.photos[0]; }
  function current(){
    if(mode==='wall'){
      const rm=rooms[wallIdx], p=heroOf(rm);
      return { src:p.src, title:p.title, place:p.place,
               cue: rm.title + ' · ' + rm.count + ' photograph' + (rm.count>1?'s':'') };
    }
    const p=currentRoom.photos[roomIdx];
    return { src:p.src, title:p.title, place:p.place, cue:'' };
  }

  function applyStep(){
    const act = pending || 'next'; pending = null;
    if(act==='enter'){ mode='room'; currentRoom=rooms[wallIdx]; roomIdx=0; }
    else if(act==='back'){ mode='wall'; }
    else if(act==='next'){
      if(mode==='wall'){ wallIdx=(wallIdx+1)%rooms.length; }
      else { roomIdx++; if(roomIdx>=currentRoom.photos.length){ mode='wall'; roomIdx=0; } }
    } else if(act==='prev'){
      if(mode==='wall'){ wallIdx=(wallIdx-1+rooms.length)%rooms.length; }
      else { roomIdx--; if(roomIdx<0){ mode='wall'; roomIdx=0; } }
    }
  }

  function preloadNext(){
    if(mode==='wall'){
      preloadSrc(heroOf(rooms[(wallIdx+1)%rooms.length]).src);
      preloadSrc(rooms[wallIdx].photos[0].src);          // so entering is instant
    } else {
      const ni=roomIdx+1;
      if(ni<currentRoom.photos.length) preloadSrc(currentRoom.photos[ni].src);
      else preloadSrc(heroOf(rooms[wallIdx]).src);
    }
  }

  function swapToCurrent(){
    const c = current();
    photo.src = c.src;
    document.documentElement.style.setProperty('--dom', dom[c.src] || '#caa46a');
    if(mode==='wall'){
      // the collection wall shows no title — just the location, as a link that
      // fades in on cursor movement and clicks into the room.
      document.body.classList.add('wall');
      locLink.textContent = rooms[wallIdx].title;
    } else {
      document.body.classList.remove('wall');
      capTitle.textContent = c.title || '';
      capCue.style.display = 'none';
      capPlace.textContent = c.place || ''; capPlace.style.display = c.place ? '' : 'none';
    }
    back.classList.toggle('avail', mode==='room');
    preloadNext();
  }

  function setReveal(light){
    if(light<=0.02){ reveal.style.background='#000'; return; }
    const r=light*maxR, rx=(r*1.35).toFixed(1), ry=(r*0.78).toFixed(1);
    const a0=1-light, s1=a0.toFixed(3), s2=(a0+(1-a0)*0.30).toFixed(3), s3=(a0+(1-a0)*0.65).toFixed(3);
    reveal.style.background='radial-gradient(ellipse '+rx+'px '+ry+'px at 50% 46%, rgba(0,0,0,'+s1+') 0%, rgba(0,0,0,'+s1+') 14%, rgba(0,0,0,'+s2+') 42%, rgba(0,0,0,'+s3+') 70%, #000 100%)';
  }

  function loop(now){
    requestAnimationFrame(loop);
    if(!started){ return; }
    const el = now - t0; let light;
    if(phase==='rise'){ light=ease(Math.min(1,el/RISE)); if(el>=RISE){ phase='hold'; t0=now; if(mode==='room') plate.classList.add('show'); } }
    else if(phase==='hold'){ light=1; if(!sitting && el>=HOLD){ phase='fall'; t0=now; plate.classList.remove('show'); } }
    else if(phase==='fall'){ light=1-ease(Math.min(1,el/FALL)); if(el>=FALL){ phase='black'; t0=now; } }
    else { light=0; if(el>=BLACK){ applyStep(); swapToCurrent(); phase='rise'; t0=now; } }
    setReveal(light);
  }

  function goFall(){
    if(phase==='rise'||phase==='hold'){ phase='fall'; t0=performance.now(); plate.classList.remove('show'); setSit(false); }
  }
  function setSit(on){
    sitting = on;
    sitEl.classList.toggle('show', on && mode==='room' && phase==='hold');
    if(!on){ t0 = performance.now(); }   // release: give it a fresh hold, then it fades
  }

  // ---- entry ----
  let autoEnter=null;
  function startGallery(){
    if(started) return;
    clearTimeout(autoEnter);
    entry.classList.add('gone');
    mode='wall'; wallIdx=0; roomIdx=0; started=true;
    const c=current(); const first=preloadSrc(c.src);
    const go=()=>{ swapToCurrent(); phase='rise'; t0=performance.now(); requestAnimationFrame(loop); };
    if(first.complete && first.naturalWidth){ if(!dom[c.src]) dom[c.src]=dominant(first); go(); }
    else { first.addEventListener('load', ()=>{ if(!dom[c.src]) dom[c.src]=dominant(first); go(); }, {once:true});
           first.addEventListener('error', go, {once:true}); }
  }

  // ---- interaction ----
  function primaryTap(e){
    if(e.target && e.target.closest && e.target.closest('#back')) return;   // handled below
    if(!started){ startGallery(); return; }
    if(phase!=='hold') return;
    if(mode==='wall'){ pending='enter'; goFall(); }
    else { setSit(!sitting); }
  }
  addEventListener('pointerdown', primaryTap);
  back.addEventListener('click', e => { e.stopPropagation(); if(started && mode==='room'){ pending='back'; goFall(); } });
  addEventListener('keydown', e => {
    if(!started){ startGallery(); return; }
    if(e.key==='ArrowRight'||e.key===' '){ e.preventDefault(); pending='next'; goFall(); }
    else if(e.key==='ArrowLeft'){ e.preventDefault(); pending='prev'; goFall(); }
    else if(e.key==='Escape'){ if(mode==='room'){ pending='back'; goFall(); } }
  });

  // idle: fade the quiet chrome (wordmark, back, cursor) after stillness
  let idle;
  function wake(){ document.body.classList.remove('ui-hidden'); clearTimeout(idle); idle=setTimeout(()=>document.body.classList.add('ui-hidden'), 3800); }
  ['mousemove','pointerdown','wheel','keydown','touchstart'].forEach(ev=>addEventListener(ev,wake,{passive:true}));
  wake();

  // auto-enter after a beat if the visitor doesn't tap. The reveal is #000 by
  // default (CSS), so the entry sits on true black without the loop running yet.
  autoEnter = setTimeout(startGallery, reduce?2000:5000);
})();
