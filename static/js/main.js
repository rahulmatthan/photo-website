// The gallery. Default view is a dark, continuously-scrolling editorial INDEX of places
// (giant serif names + hero prints). Choosing a place dissolves into the spotlight ROOM —
// the lit framed print for that location, cycling its photographs. "Back" returns to the index.
(function(){
  const G = window.GALLERY || {rooms:[]};
  const rooms = G.rooms || [];
  const $ = id => document.getElementById(id);
  const photo=$('photo'), plate=$('plate'), capTitle=$('capTitle'), capPlace=$('capPlace'), capCue=$('capCue'),
        reveal=$('reveal'), back=$('back'), sitEl=$('sit'), locLink=$('locLink');
  const indexView=$('indexView'), ixScroll=$('ixScroll'), ixCluster=$('ixCluster'), ixMenu=$('ixMenu');
  const hero=$('hero'), heroImg=$('heroImg'), heroCv=$('heroCv'), hcx = heroCv && heroCv.getContext('2d');
  const enterMsg=$('enterMsg'), enterH=$('enterH');
  const cv=$('cv'), cx = cv && cv.getContext('2d',{willReadFrequently:true});
  const pcv=$('ixCanvas'), pcx = pcv && pcv.getContext('2d');
  const scv=document.createElement('canvas'), sxx=scv.getContext('2d',{willReadFrequently:true});
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!rooms.length){ return; }

  let maxR=1600;
  function setMax(){ maxR = 1.85*Math.hypot(innerWidth,innerHeight); }

  // ---------- dominant colour + bounded preloading ----------
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
  function heroOf(room){ return room.photos[room.heroIdx] || room.photos[0]; }
  const ease = x => x<.5 ? 4*x*x*x : 1-Math.pow(-2*x+2,3)/2;
  const clampC = v => Math.max(0, Math.min(rooms.length-1, v));

  let mode='entry';   // entry | strip (the index) | room
  function setMode(m){ mode=m; document.body.classList.toggle('strip', m==='strip'); document.body.classList.toggle('room', m==='room'); }

  // ================= INDEX (overview) =================
  const esc = s => String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let entering=false, activeIdx=0, clusterIdx=-1, ixRaf=0;
  function clusterSrcs(rm){ return rm.photos.slice(0,9).map(p=>p.card||p.src); }

  // ---- the particle field (Surendar-style). The sharp DOM grid dematerialises into tiny particles
  //      that are then drawn TOWARD the grid's centre into a soft, central, constantly-buzzing cloud
  //      (its resting state — image-agnostic, uniform warm-white). As you scroll toward the next
  //      place the cloud flows back out, each particle regaining that place's photo colour + grid
  //      position, reforming the grid. Because the resting cloud is identical for every place, the
  //      composite swap at mid-transition is invisible. `amt` (0 = settled grid, 1 = central cloud);
  //      a time clock drives the buzz so the cloud stays alive independent of scroll.
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const DOT = 1.3;                                   // base particle size (px) — fine, à la Surendar
  const sstep = x => { x = x<0?0:(x>1?1:x); return x*x*(3-2*x); };
  // a soft warm-white sprite — drawn scaled per particle for the depth-of-field bokeh: scaled up = a
  // big blurry "near" particle, scaled tiny = a sharp far speck (the look surendarselvaraj.com has).
  const sprite = document.createElement('canvas'); sprite.width = sprite.height = 64;
  (function(){ const s=sprite.getContext('2d'); const g=s.createRadialGradient(32,32,0,32,32,32);
    g.addColorStop(0,'rgba(255,251,242,1)'); g.addColorStop(.4,'rgba(255,249,238,0.45)'); g.addColorStop(1,'rgba(255,249,238,0)');
    s.fillStyle=g; s.fillRect(0,0,64,64); })();
  let P = null;
  function sizeCanvas(){
    if(!pcv) return;
    pcv.width = Math.round(innerWidth*DPR); pcv.height = Math.round(innerHeight*DPR);
    pcv.style.width = innerWidth+'px'; pcv.style.height = innerHeight+'px';
    pcx.setTransform(DPR,0,0,DPR,0,0);
  }
  function sampleParticles(){
    if(!pcx) return;
    const tiles=[...ixCluster.children];
    if(!tiles.length){ P=null; return; }
    const cb=ixCluster.getBoundingClientRect();
    const ox=Math.floor(cb.left), oy=Math.floor(cb.top), W=Math.ceil(cb.width), H=Math.ceil(cb.height);
    if(W<2||H<2){ P=null; return; }
    scv.width=W; scv.height=H; sxx.clearRect(0,0,W,H);
    let drew=0;
    for(const t of tiles){
      const im=t.querySelector('img'); if(!im) continue;
      const src=im.getAttribute('src'), dec=cache[src];
      const img=(dec&&dec.complete&&dec.naturalWidth)?dec:(im.complete&&im.naturalWidth?im:null);
      if(!img) continue;
      const r=t.getBoundingClientRect();
      sxx.drawImage(img, r.left-ox, r.top-oy, r.width, r.height); drew++;
    }
    if(!drew){ P=null; return; }
    let data; try{ data=sxx.getImageData(0,0,W,H).data; }catch(e){ P=null; return; }
    buildParticlesFrom(data, ox, oy, W, H);
  }
  // The hero (opening) image sampled into the SAME cloud — so the panther dissolves in the identical
  // starfield that then reforms into the first grid. Homes span the whole screen (cover-fit).
  function sampleHero(){
    if(!pcx || !heroImg || !heroImg.complete || !heroImg.naturalWidth) return;
    const W=innerWidth, H=innerHeight;
    scv.width=W; scv.height=H; sxx.clearRect(0,0,W,H);
    const iw=heroImg.naturalWidth, ih=heroImg.naturalHeight, s=Math.max(W/iw,H/ih), dw=iw*s, dh=ih*s;
    sxx.drawImage(heroImg,(W-dw)/2,(H-dh)*0.14,dw,dh);       // cover, framed (matches CSS object-position 50% 14%)
    let data; try{ data=sxx.getImageData(0,0,W,H).data; }catch(e){ return; }
    buildParticlesFrom(data, 0, 0, W, H);
  }
  // Build the particle set from a source bitmap: opaque cells give the reform colour+shape (homes at
  // sox+cell), while the CLOUD is FIXED (same size/shape/density for the hero AND every grid — a Gaussian
  // scatter centred on the stable grid centre, dense core + sparse screen-filling halo).
  function buildParticlesFrom(data, sox, soy, W, H){
    const cstep=4, ch=cstep>>1, clx=[], cly=[], cr=[], cg=[], cbl=[];
    for(let y=0;y<H;y+=cstep){ for(let x=0;x<W;x+=cstep){
      const sx=Math.min(W-1,x+ch), sy=Math.min(H-1,y+ch), idx=(sy*W+sx)*4;
      if(data[idx+3]<40) continue;                           // skip transparent gaps only
      clx.push(x+ch); cly.push(y+ch); cr.push(data[idx]&0xF8); cg.push(data[idx+1]&0xF8); cbl.push(data[idx+2]&0xF8);
    }}
    const M=clx.length; if(!M){ P=null; return; }
    const n=Math.max(5000, Math.min(13000, Math.round(innerWidth*innerHeight/125)));
    const cb=ixCluster.getBoundingClientRect();              // cloud centre = the (stable) grid centre — shared by hero + grids
    const gx=cb.left+cb.width/2, gy=cb.top+cb.height/2, gw=Math.min(innerWidth*0.43,660);
    const coreX=gw*0.34, coreY=innerHeight*0.22, haloX=innerWidth*0.52, haloY=innerHeight*0.46, refX=innerWidth*0.30, refY=innerHeight*0.32;
    const parts=new Array(n);
    for(let i=0;i<n;i++){
      const m=(fr(i*1.37+0.7)*M)|0, r=cr[m], g=cg[m], b=cbl[m];
      const u1=Math.max(1e-4, fr(i*12.9898)), u2=fr(i*0.723+7.13);
      const mag=Math.sqrt(-2*Math.log(u1)), aa=6.2832*u2;
      let g1=mag*Math.cos(aa), g2=mag*Math.sin(aa);
      if(g1>3.2)g1=3.2; else if(g1<-3.2)g1=-3.2;
      if(g2>3.2)g2=3.2; else if(g2<-3.2)g2=-3.2;
      const halo=fr(i*5.11+2.9)>0.74, dxp=g1*(halo?haloX:coreX), dyp=g2*(halo?haloY:coreY);
      const big=fr(i*2.37+8.8)>0.998, rr=fr(i*3.71+5.9);
      parts[i]={
        fx:sox+clx[m]+(fr(i*7.1+3.3)-0.5)*cstep, fy:soy+cly[m]+(fr(i*5.7+9.1)-0.5)*cstep,   // home (in the source image)
        cx:gx+dxp, cy:gy+dyp,                                                                // fixed cloud target
        sa:fr(i*39.42+4.1)*6.283, sb:fr(i*93.71+2.3)*6.283,
        cf:Math.exp(-0.5*((dxp/refX)*(dxp/refX)+(dyp/refY)*(dyp/refY))),
        sz: big ? (3.0+4.5*fr(i*6.13+1.1)) : (0.75+0.7*rr*rr),
        br: big ? (0.8+1.2*fr(i*9.7+2.2)) : 0.16,
        bright: big ? (0.55+0.32*fr(i*4.4+3.3)) : (0.45+0.35*rr),
        zp:fr(i*8.17+0.5)*6.283,
        col:'rgb('+r+','+g+','+b+')', key:(r<<16|g<<8|b)
      };
    }
    parts.sort((p,q)=>p.key-q.key);
    P={n, gx, gy, fx:new Float32Array(n), fy:new Float32Array(n), cx:new Float32Array(n), cy:new Float32Array(n),
       sa:new Float32Array(n), sb:new Float32Array(n), cf:new Float32Array(n),
       sz:new Float32Array(n), br:new Float32Array(n), bright:new Float32Array(n), zp:new Float32Array(n),
       px:new Float32Array(n), py:new Float32Array(n), col:new Array(n)};
    for(let i=0;i<n;i++){ const p=parts[i];
      P.fx[i]=p.fx; P.fy[i]=p.fy; P.cx[i]=p.cx; P.cy[i]=p.cy; P.sa[i]=p.sa; P.sb[i]=p.sb;
      P.cf[i]=p.cf; P.sz[i]=p.sz; P.br[i]=p.br; P.bright[i]=p.bright; P.zp[i]=p.zp; P.col[i]=p.col;
    }
  }
  const fr = x => { const s=Math.sin(x)*43758.5453; return s-Math.floor(s); };   // deterministic 0..1
  function drawParticles(amt, now){
    if(!pcx) return;
    pcx.clearRect(0,0,innerWidth,innerHeight);
    if(!P || amt<=0.002) return;
    const vis = Math.min(1, amt*5);                // slower particle↔DOM hand-off (complements ixCluster opacity)
    if(vis<=0.003) return;
    // the reform is stretched over the approach: cloud rises slowly as you leave a place and lingers low
    // for a long time as you arrive — so the coalescing into the grid gets much more scroll to play out.
    const cloud=Math.pow(amt,1.6), form=1-cloud;
    const amp=0.4 + cloud*6.6, bC=(now||0)*0.0045, zC=(now||0)*0.0011;
    // positions (shared by both layers): cloud target ⇄ grid home, plus a gentle buzz
    const px=P.px, py=P.py;
    for(let i=0;i<P.n;i++){
      const sa=P.sa[i], sb=P.sb[i];
      const nx=Math.sin(sa+bC)+0.5*Math.sin(sa*1.7+bC*1.6);
      const ny=Math.cos(sb+bC*0.9)+0.5*Math.cos(sb*1.9+bC*1.4);
      px[i]=P.cx[i]+(P.fx[i]-P.cx[i])*form + amp*nx*0.66;
      py[i]=P.cy[i]+(P.fy[i]-P.cy[i])*form + amp*ny*0.66;
    }
    // colour ⇄ white is one complementary crossfade at the SAME positions, so each dot smoothly
    // desaturates from its photo colour into the white cloud (and back) — no hand-off seam.
    const t = sstep(cloud);                                // 0 = grid colour, 1 = white cloud — colour emerges early in the reform and is held across the whole approach
    // LAYER A — sharp coloured dots that reform the photos (near the grid)
    if(t<0.985){
      pcx.globalAlpha = vis*(1-t);
      let last='';
      for(let i=0;i<P.n;i++){ const c=P.col[i]; if(c!==last){ pcx.fillStyle=c; last=c; }
        pcx.fillRect(px[i]-DOT*0.5, py[i]-DOT*0.5, DOT, DOT); }
    }
    // LAYER B — the white cloud: a starfield of crisp small specks, with a rare few (~1 in 500) blooming
    // into big soft depth-of-field bokeh that breathes toward/away over time.
    if(t>0.015){
      const base=vis*t;
      pcx.fillStyle='rgb(232,228,219)';                    // warm white for the crisp specks
      for(let i=0;i<P.n;i++){
        let a=base*P.cf[i]*P.bright[i]; if(a>1)a=1; if(a<=0.004) continue;
        pcx.globalAlpha=a;
        let s=P.sz[i]+Math.sin(P.zp[i]+zC)*P.br[i]; if(s<0.35)s=0.35;
        const size=DOT*s;
        if(P.sz[i]<2.2) pcx.fillRect(px[i]-size*0.5, py[i]-size*0.5, size, size);          // crisp small speck
        else pcx.drawImage(sprite, px[i]-size*0.5, py[i]-size*0.5, size, size);            // soft big bokeh
      }
    }
    pcx.globalAlpha=1;
  }
  function buildIndex(){
    const N=rooms.length, tot=String(N).padStart(2,'0');
    ixScroll.innerHTML = rooms.map((rm,i)=>
      '<a class="ix-item" data-i="'+i+'"><span class="ix-num">'+String(i+1).padStart(2,'0')+' / '+tot+'</span>'
      +'<span class="ix-loc">'+esc(rm.title)+'</span>'
      +'<span class="ix-sub">'+rm.count+' photograph'+(rm.count>1?'s':'')+'</span></a>'
    ).join('');
    buildMenu();
    rooms.forEach(rm=>preloadSrc(heroOf(rm).src));
    setTimeout(()=>rooms.forEach(rm=>clusterSrcs(rm).forEach(preloadSrc)), 500);   // warm every grid
    [...ixScroll.children].forEach(el=>el.addEventListener('click',()=>choosePlace(+el.dataset.i, 0)));
    ixScroll.addEventListener('scroll', onScroll, {passive:true});
    ixScroll.addEventListener('wheel', onWheel, {passive:false});           // one gesture → step to the next place
    ixScroll.addEventListener('touchstart', e=>{ if(mode==='strip') touchY=e.touches[0].clientY; }, {passive:true});
    ixScroll.addEventListener('touchmove', e=>{ if(mode==='strip'&&!entering) e.preventDefault(); }, {passive:false});
    ixScroll.addEventListener('touchend', onTouchEnd, {passive:true});
    // click a photograph in the grid → enter that place, starting the slideshow from that photo
    ixScroll.addEventListener('click', e=>{ if(mode!=='strip'||entering) return; if(e.target.closest&&e.target.closest('.ix-item')) return; const k=hitTile(e); if(k>=0) choosePlace(activeIdx, k); });
    ixScroll.addEventListener('mousemove', e=>{ if(mode==='strip') ixScroll.style.cursor = hitTile(e)>=0 ? 'pointer' : ''; });
    sizeCanvas();
    const start=Math.max(0, locFromHash());                          // a shared link (#location) lands centred there
    setCluster(start); activeIdx=start; markActive(); ixScroll.scrollTop=centerTop(start); syncHash();
    requestAnimationFrame(()=>{ sampleParticles(); applyCluster(); });
    addEventListener('hashchange', ()=>{ if(mode==='strip' && !entering){ const i=locFromHash(); if(i>=0 && i!==activeIdx) scrollToPlace(i); } });
    addEventListener('click', e=>{ if(!(e.target.closest && e.target.closest('.ix-mgroup'))) closeMenus(); });   // dismiss an open dropdown
  }
  // ---- grouped menu (India / World …) + shareable #location links ----
  function buildMenu(){
    const order=['India','World'], groups={};
    rooms.forEach((rm,i)=>{ const g=rm.group||'World'; (groups[g]=groups[g]||[]).push({i,title:rm.title}); });
    const keys=order.filter(g=>groups[g]).concat(Object.keys(groups).filter(g=>order.indexOf(g)<0).sort());
    ixMenu.innerHTML = keys.map(g=>
      '<div class="ix-mgroup"><button type="button" class="ix-mlabel">'+esc(g)+'</button>'
      +'<div class="ix-msub">'+groups[g].map(o=>'<a data-i="'+o.i+'">'+esc(o.title)+'</a>').join('')+'</div></div>'
    ).join('');
    ixMenu.querySelectorAll('a[data-i]').forEach(a=>a.addEventListener('click',()=>{ closeMenus(); scrollToPlace(+a.dataset.i); }));
    ixMenu.querySelectorAll('.ix-mlabel').forEach(b=>b.addEventListener('click',e=>{   // tap-to-open on touch
      const g=b.parentNode, was=g.classList.contains('open'); closeMenus(); if(!was) g.classList.add('open'); e.stopPropagation(); }));
  }
  function closeMenus(){ ixMenu.querySelectorAll('.ix-mgroup.open').forEach(g=>g.classList.remove('open')); }
  function locFromHash(){ const h=decodeURIComponent(location.hash.replace(/^#/,'')); return rooms.findIndex(r=>r.key===h); }
  function syncHash(){ if(heroUp) return; const k=rooms[activeIdx]&&rooms[activeIdx].key; if(k && location.hash.slice(1)!==k) history.replaceState(null,'','#'+k); }
  function hitTile(e){
    const t=ixCluster.children;
    for(let i=0;i<t.length;i++){ const r=t[i].getBoundingClientRect();
      if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom) return i; }
    return -1;
  }
  function itemH(){ return (ixScroll.children[0]&&ixScroll.children[0].offsetHeight)||innerHeight; }
  // place i is centred at this scrollTop; posQ() is the fractional place position (integer == centred):
  function centerTop(i){ return i*itemH() + itemH()/2 - innerHeight/2; }
  function posQ(){ return (ixScroll.scrollTop + innerHeight/2 - itemH()/2) / itemH(); }

  // Paged navigation (aircenter-style): one scroll gesture — ANY force — advances exactly one place; the
  // page tweens itself so that place lands perfectly centred, and the particle dematerialise→reform plays
  // out over that fixed tween (driven in ixTick). It can never rest between places. Native scroll is off.
  const PAGE_DUR = reduce ? 800 : 2400;                    // transition length (ms) — slow + patient
  // Option B easing (softened): a 50/50 blend of a cloud-dwell curve and a plain ease-in-out. It slows
  // right down THROUGH the cloud (you see the particles drifting) but never fully holds, and still eases
  // gently out of / into the grids. Velocity: 0 at the ends, ~0.75 through the cloud, faster on the flanks.
  const easeB = e => { const d=e-Math.sin(12.5664*e)/12.5664, s=e*e*(3-2*e); return 0.5*d+0.5*s; };
  // single-step landing curve: easeB dwell through the cloud (first half), then an ACCELERATING glide into
  // centre (no ease-out, no ripple) so the name never slows before it arrives — the magnet spring does the
  // stopping. Velocity is continuous at the seam (easeB'(0.5)=0.75) and keeps rising to 1.25 at e=1.
  const landPos = e => { if(e<=0.5) return easeB(e); const t=e-0.5; return 0.5 + 0.75*t + 0.5*t*t; };
  const landVel = e => 0.75 + (e-0.5);                         // landPos'(e) in the glide region (e>0.5)
  let pageAnim=null, jumpAnim=null, jumpAmt=0, jumpSwapped=false, heroAnim=null, heroUp=false, pageArmed=true, wheelStamp=0, touchY=0;
  // ==== bespoke ONE-TIME hero cloudburst (never repeated) ====
  // A slow, imperceptible dematerialisation that GATHERS momentum into a massive dense full-screen
  // swirling storm, agitates violently, then a WIND blows it away to reveal the collection behind.
  // Its own physics sim (velocity + a churning curl field + a final gust), distinct from the grid transition.
  let heroBurst=null, HB=null;
  const HB_DUR = reduce ? 3000 : 9500;
  function sampleHeroBurst(){
    if(!pcx || !heroImg || !heroImg.complete || !heroImg.naturalWidth) return;
    const W=innerWidth, H=innerHeight;
    scv.width=W; scv.height=H; sxx.clearRect(0,0,W,H);
    const iw=heroImg.naturalWidth, ih=heroImg.naturalHeight, s=Math.max(W/iw,H/ih), dw=iw*s, dh=ih*s;
    sxx.drawImage(heroImg,(W-dw)/2,(H-dh)*0.14,dw,dh);       // same framing as the CSS
    let data; try{ data=sxx.getImageData(0,0,W,H).data; }catch(e){ return; }
    const step=6, ch=step>>1, parts=[];                         // dense; particles keep the image's OWN (mostly black) colour
    for(let y=0;y<H;y+=step){ for(let x=0;x<W;x+=step){
      const sx=Math.min(W-1,x+ch), sy=Math.min(H-1,y+ch), idx=(sy*W+sx)*4;
      const r=data[idx]&0xF8, g=data[idx+1]&0xF8, b=data[idx+2]&0xF8;
      if(r+g+b<26) continue;                                    // skip pure-black → those particles are invisible anyway
      const j=parts.length;
      parts.push({ hx:x+ch, hy:y+ch, r, g, b, key:(r<<16|g<<8|b), ph:fr(j*1.73)*6.283,
        sz: fr(j*3.11)>0.99 ? (2.5+2.5*fr(j*4.41)) : (1.2+1.5*fr(j*2.23)) });
    }}
    parts.sort((a,b)=>a.key-b.key);                             // group by colour → fillStyle rarely changes
    const n=parts.length;
    HB={ n, px:new Float32Array(n), py:new Float32Array(n), vx:new Float32Array(n), vy:new Float32Array(n),
         ph:new Float32Array(n), sz:new Float32Array(n), col:new Array(n) };
    for(let i=0;i<n;i++){ const p=parts[i]; HB.px[i]=p.hx; HB.py[i]=p.hy; HB.ph[i]=p.ph; HB.sz[i]=p.sz;
      // lift toward visible so the buzz reads, but keep the image's tones (darks stay grey, lit bits pop); slight warm
      const R=Math.min(255,32+p.r*1.7|0), G=Math.min(255,28+p.g*1.62|0), B=Math.min(255,22+p.b*1.42|0);
      HB.col[i]='rgb('+R+','+G+','+B+')'; }
  }
  function sizeHeroCv(){
    if(!hcx) return;
    heroCv.width=Math.round(innerWidth*DPR); heroCv.height=Math.round(innerHeight*DPR);
    heroCv.style.width=innerWidth+'px'; heroCv.style.height=innerHeight+'px';
    hcx.setTransform(DPR,0,0,DPR,0,0);
  }
  function dissolveHero(){
    if(!heroUp || !hero) return;
    heroUp=false;
    sampleHeroBurst();
    hero.classList.add('dissolving');                       // fade the title + hint
    if(!HB || !hcx){ finishHeroBurst(); return; }           // image not ready → just fall through to the index
    sizeHeroCv();
    heroBurst={ start:performance.now(), last:0 };
    requestAnimationFrame(heroBurstTick);
  }
  const hbStep = x => { x=x<0?0:(x>1?1:x); return x*x*(3-2*x); };
  function heroBurstTick(now){
    if(!heroBurst || !HB || !hcx){ return; }
    if(!heroBurst.last) heroBurst.last=now-16;
    const e=Math.min(1,(now-heroBurst.start)/HB_DUR), dt=Math.min(0.05,(now-heroBurst.last)/1000); heroBurst.last=now;
    const turb=Math.pow(hbStep(e/0.5),1.6);                 // ~0 at first (imperceptible), then violent
    const cx=innerWidth*0.5, cy=innerHeight*0.5, GUST=innerWidth*1.2; // a puff at the centre scatters everything out
    const T=now*0.0021, SPD=185;                            // brownian jitter magnitude (not a coherent field)
    const pAlpha=hbStep(e/0.22)*(1-hbStep((e-0.70)/0.30));  // fade in as it particalises, out as it blows away
    if(heroImg) heroImg.style.opacity=(1-hbStep((e-0.05)/0.32)).toFixed(2);   // the portrait fades early + slow
    if(hero) hero.style.opacity=(1-hbStep((e-0.60)/0.34)).toFixed(2);         // reveal the collection behind
    hcx.clearRect(0,0,innerWidth,innerHeight);
    hcx.globalCompositeOperation='source-over';             // keep the image's own (mostly black) tones — no glow
    hcx.globalAlpha=pAlpha;
    const px=HB.px, py=HB.py, vx=HB.vx, vy=HB.vy, k=Math.min(1,dt*7);
    let last='';
    for(let i=0;i<HB.n;i++){
      const p=HB.ph[i];
      // force depends only on the particle's OWN seed (p) + time — no spatial coupling, so no organised swirls.
      // fast, high-frequency jitter (not a slow-rotating vector) so motes keep twitching erratically to the very
      // end instead of settling into tidy circles once the crowd has thinned
      const fx=Math.sin(p*12.9+T*6.3)+0.7*Math.sin(p*31.7+T*11.1)+0.55*Math.sin(p*61.3+T*18.7);
      const fy=Math.cos(p*9.3+T*5.7)+0.7*Math.cos(p*27.1+T*10.3)+0.55*Math.cos(p*53.7+T*17.1);
      // radial scatter from centre — but each mote on its own terms: staggered onset, its own speed, a wide
      // angular kick (some fly clean outward, some career off sideways), and its own chaos on the buzz
      const ang=Math.atan2(py[i]-cy,px[i]-cx) + 1.4*Math.sin(p*23.7) + 0.6*Math.sin(p*57.3);
      const onset=0.52+0.14*(p*0.159154), sp=0.5+1.2*Math.sin(p*11.3)*Math.sin(p*11.3);
      const wm=hbStep((e-onset)/0.24)*GUST*sp, chaos=0.6+1.8*Math.abs(Math.sin(p*41.7));
      vx[i]+=((fx*SPD*turb*chaos + Math.cos(ang)*wm)-vx[i])*k; // ease toward chaotic buzz + outward gust
      vy[i]+=((fy*SPD*turb*chaos + Math.sin(ang)*wm)-vy[i])*k;
      px[i]+=vx[i]*dt; py[i]+=vy[i]*dt;
      const c=HB.col[i]; if(c!==last){ hcx.fillStyle=c; last=c; }
      const z=HB.sz[i];
      hcx.fillRect(px[i], py[i], z, z);
    }
    hcx.globalAlpha=1;
    if(e>=1){ finishHeroBurst(); return; }
    requestAnimationFrame(heroBurstTick);
  }
  function finishHeroBurst(){
    heroBurst=null; HB=null;
    if(hcx){ hcx.globalCompositeOperation='source-over'; hcx.clearRect(0,0,innerWidth,innerHeight); }
    if(hero){ hero.style.display='none'; hero.style.opacity=''; }
    activeIdx=0; setCluster(0); markActive(); ixScroll.scrollTop=centerTop(0); syncHash();
    applyCluster();                                         // hand off to the index (grid at rest, ready to scroll)
  }
  function startPage(target){                              // adjacent step: the name scrolls one place over
    target=clampC(target);
    pageAnim={ from:ixScroll.scrollTop, to:centerTop(target), start:performance.now(), dur:PAGE_DUR };
    ixIdle=0; if(!ixAnim && mode==='strip' && !entering) ixAnim=requestAnimationFrame(ixTick);
  }
  // JUMP (menu / link to any place, near or far): dematerialise the CURRENT grid here, and at the cloud
  // peak swap straight to the TARGET grid + jump the scroll — so it reforms directly into the destination
  // WITHOUT scrolling through (and re-playing) every place in between. One dematerialise→reform, always.
  function startJump(target){
    target=clampC(target);
    if(target===activeIdx || pageAnim || jumpAnim) return;
    jumpAnim={ from:activeIdx, to:target, start:performance.now(), dur:PAGE_DUR }; jumpSwapped=false;
    ixIdle=0; if(!ixAnim && mode==='strip' && !entering) ixAnim=requestAnimationFrame(ixTick);
  }
  function goStep(dir){
    if(pageAnim || jumpAnim || mode!=='strip' || entering) return;
    closeMenus();
    const target=clampC(activeIdx+dir);
    if(target!==activeIdx) startPage(target);              // (no-op at the ends)
  }
  function onWheel(e){
    if(mode!=='strip'||entering) return;
    e.preventDefault();                                     // fully take over scrolling
    if(heroUp){ dissolveHero(); return; }                   // first scroll leaves the opening hero
    const now=performance.now();
    if(!pageAnim && !jumpAnim && !pageArmed && now-wheelStamp>140) pageArmed=true;   // re-arm once the inertia tail goes quiet
    wheelStamp=now;
    if(pageAnim || jumpAnim || !pageArmed || Math.abs(e.deltaY)<3) return;           // busy / mid-inertia / too small → absorb
    pageArmed=false;
    goStep(e.deltaY>0?1:-1);
  }
  function onTouchEnd(e){
    if(mode!=='strip'||entering||pageAnim||jumpAnim) return;
    const dy=touchY-(e.changedTouches[0]?e.changedTouches[0].clientY:touchY);
    if(Math.abs(dy)>30) goStep(dy>0?1:-1);                 // swipe up → next place
  }
  function onScroll(){ applyCluster(); }
  function markActive(){
    [...ixScroll.children].forEach((el,i)=>el.classList.toggle('active', i===activeIdx));
    ixMenu.querySelectorAll('a[data-i]').forEach(a=>a.classList.toggle('on', +a.dataset.i===activeIdx));
    ixMenu.querySelectorAll('.ix-mgroup').forEach(g=>g.classList.toggle('on', !!g.querySelector('a.on')));
  }
  function scrollToPlace(i){ startJump(clampC(i)); }   // menu / hash → jump straight there (skip the in-between transitions)

  // The grid is scroll-driven: at a place's centre the sharp DOM masonry shows; as you scroll away
  // it dissolves into the particle field (which scatters + fades); at the midpoint the composite
  // swaps to the next place, whose particles gather back into its sharp grid as it reaches centre.
  function altOf(p){ const t=p.title||'', pl=p.place||''; return t && pl ? t+', '+pl : (t||pl); }
  function setCluster(i){
    clusterIdx=i;
    ixCluster.innerHTML = rooms[i].photos.slice(0,9).map(p=>'<div class="ix-thumb"><img src="'+(p.card||p.src)+'" alt="'+esc(altOf(p))+'"></div>').join('');
    [...ixCluster.querySelectorAll('img')].forEach(im=>{ if(!im.complete) im.addEventListener('load',sampleParticles,{once:true}); });
  }
  // scroll-driven dissolve: a dead zone holds the sharp grid near a place's centre (a magnetic hold),
  // then it dematerialises into the central cloud as you push past. A continuous rAF tick keeps the
  // cloud buzzing (time-driven) while it's on screen; it idles out when the grid is fully settled.
  let curAmt=0, ixAnim=0, ixIdle=0, ixLast=0, sp=null;
  // A subtle settle: when the page lands, the heavy name springs into place with a small overshoot,
  // and the two subtext lines get their own springier, slightly-independent bounce (a satisfying click).
  function kickSettle(dir){
    const item=ixScroll.children[activeIdx]; if(!item) return;
    sp={ loc:{y:0,v:-dir*210}, num:{y:0,v:-dir*168}, sub:{y:0,v:-dir*150},   // heavy name overshoots most (inertia)
         elLoc:item.querySelector('.ix-loc'), elNum:item.querySelector('.ix-num'), elSub:item.querySelector('.ix-sub') };
  }
  // continuous landing: the name is `offset` px short of centre, still closing at `vel` px/s — start the spring
  // there so it flows past centre into a slight overshoot and rocks back (no dead-stop-then-kick).
  function settleGlide(offset, vel){
    const item=ixScroll.children[activeIdx]; if(!item) return;
    const v0=-vel;                                                // carry the glide's (already high) momentum through centre
    sp={ loc:{y:offset,v:v0*1.00}, num:{y:offset,v:v0*0.90}, sub:{y:offset,v:v0*0.84},   // heavy name carries most → overshoots most
         elLoc:item.querySelector('.ix-loc'), elNum:item.querySelector('.ix-num'), elSub:item.querySelector('.ix-sub') };
  }
  function stepSettle(dt){
    if(!sp) return false;
    const upd=(s,k,c)=>{ s.v += (-k*s.y - c*s.v)*dt; s.y += s.v*dt; return Math.abs(s.y)+Math.abs(s.v); };
    const e = upd(sp.loc,340,26) + upd(sp.num,340,26) + upd(sp.sub,340,26);   // stiff, well-damped magnet: grabs at centre, one slight rock
    if(sp.elLoc) sp.elLoc.style.transform='translateY('+sp.loc.y.toFixed(2)+'px)';
    if(sp.elNum) sp.elNum.style.transform='translateY('+sp.num.y.toFixed(2)+'px)';
    if(sp.elSub) sp.elSub.style.transform='translateY('+sp.sub.y.toFixed(2)+'px)';
    if(e<0.4){ clearSettle(); return false; }   // snap the sub-pixel tail to rest and clear the transforms
    return true;
  }
  function clearSettle(){ if(sp){ [sp.elLoc,sp.elNum,sp.elSub].forEach(el=>{ if(el) el.style.transform=''; }); sp=null; } }
  function updateIndex(){
    if(entering || mode!=='strip') return curAmt;
    if(jumpAnim||heroAnim){                                        // a jump / hero-dissolve drives amt directly (swap handled in ixTick)
      curAmt=jumpAmt;
      ixCluster.style.opacity=Math.max(0,1-curAmt*5).toFixed(3);
      ixScroll.style.opacity=(1-sstep((curAmt-0.06)/0.56)).toFixed(3);
      return curAmt;
    }
    const N=rooms.length, p=posQ();
    const active=Math.max(0,Math.min(N-1,Math.round(p)));
    if(active!==clusterIdx){ setCluster(active); sampleParticles(); }
    if(active!==activeIdx){ activeIdx=active; markActive(); }
    let a=Math.max(0,Math.min(1,(Math.abs(p-active)-0.12)/0.36));   // flat dead zone near centre, then ramp
    curAmt=a*a*(3-2*a);                                             // smoothstep
    ixCluster.style.opacity=Math.max(0,1-curAmt*5).toFixed(3);     // sharp grid ↔ particles hand off (matches vis in drawParticles)
    // the LOCATION text (names + subtext) fades fully OUT before the cloud peak, back IN as it reforms
    // (the masthead + hint stay — Rahul: "leave the brand and menu… I meant no location text")
    ixScroll.style.opacity=(1-sstep((curAmt-0.06)/0.56)).toFixed(3);
    return curAmt;
  }
  function ixTick(now){
    if(entering || mode!=='strip'){ ixAnim=0; return; }
    const dt = ixLast ? Math.min(0.05,(now-ixLast)/1000) : 0.016; ixLast=now;
    let justLanded=0;
    if(heroAnim){                                                 // opening: the panther dissolves → cloud → first grid reforms
      const e=Math.min(1,(now-heroAnim.start)/heroAnim.dur), eb=easeB(e);
      if(!heroAnim.swapped && eb>=0.5){                           // at the full cloud: swap the panther for the first grid
        heroAnim.swapped=true; activeIdx=0; setCluster(0); sampleParticles(); markActive(); ixScroll.scrollTop=centerTop(0);
        if(hero) hero.classList.add('gone'); syncHash();
      }
      if(!heroAnim.swapped && heroImg) heroImg.style.opacity=Math.max(0,1-eb*1.9).toFixed(2);   // the portrait fades as it particalises
      const d=0.5-Math.abs(eb-0.5), a=Math.max(0,Math.min(1,(d-0.12)/0.36));
      jumpAmt=a*a*(3-2*a);
      if(e>=1){ heroAnim=null; if(hero) hero.style.display='none'; if(pcv) pcv.style.zIndex=''; justLanded=1; }
    } else if(jumpAnim){                                          // dematerialise here → swap at the peak → reform at the target
      const e=Math.min(1,(now-jumpAnim.start)/jumpAnim.dur), eb=easeB(e);
      if(!jumpSwapped && eb>=0.5){                                // at the full cloud: swap the composite + jump the scroll (invisible)
        jumpSwapped=true; activeIdx=jumpAnim.to; setCluster(activeIdx); sampleParticles(); markActive(); ixScroll.scrollTop=centerTop(activeIdx);
      }
      const d=0.5-Math.abs(eb-0.5), a=Math.max(0,Math.min(1,(d-0.12)/0.36));   // same amt profile as a single step
      jumpAmt=a*a*(3-2*a);
      if(e>=1){ justLanded=Math.sign(jumpAnim.to-jumpAnim.from)||1; jumpAnim=null; }
    } else if(pageAnim){                                          // adjacent step: the name scrolls one place over (Option B dwell)
      const durS=pageAnim.dur/1000, span=pageAnim.to-pageAnim.from, e=Math.min(1,(now-pageAnim.start)/pageAnim.dur);
      if(e<0.95){
        ixScroll.scrollTop = pageAnim.from + span*landPos(e);     // accelerating glide, no slowdown before centre
      } else {
        // the name arrives at centre still moving fast; hand its momentum to the magnet spring so the CENTRE
        // is what decelerates + stops it (slight overshoot → click), never the approach
        const cur=pageAnim.from + span*landPos(e);
        ixScroll.scrollTop = pageAnim.to;
        settleGlide(pageAnim.to-cur, span*landVel(e)/durS);       // remaining offset + its (high, still-rising) closing velocity
        pageAnim=null; syncHash();
      }
    }
    const amt=updateIndex();
    if(justLanded){ kickSettle(justLanded); syncHash(); }         // the click into place + shareable #hash
    drawParticles(amt, now);
    const springing=stepSettle(dt);
    if(!pageAnim && !jumpAnim && !heroAnim && !springing && amt<=0.003){ if(++ixIdle>44){ ixAnim=0; return; } } else ixIdle=0;   // idle out once fully settled
    ixAnim=requestAnimationFrame(ixTick);
  }
  function applyCluster(){ ixIdle=0; if(!ixAnim && !entering && mode==='strip'){ ixLast=0; ixAnim=requestAnimationFrame(ixTick); } }
  // choose a place (optionally starting the slideshow at photo `startAt`) → the grid bursts into
  // particles that scatter and dissipate as the index dissolves into the room.
  function choosePlace(i, startAt){
    if(mode!=='strip'||entering) return;
    entering=true; pageAnim=null; jumpAnim=null; clearSettle();
    if(P && pcx){                                                  // a quick particle burst on select
      const t0=performance.now(), DUR=reduce?400:820;
      (function step(now){
        const e=Math.min(1,(now-t0)/DUR);
        ixCluster.style.opacity=Math.max(0,1-e*5).toFixed(3);
        drawParticles(0.14+e*0.85, now);
        if(e<1 && entering) requestAnimationFrame(step);
      })(t0);
    }
    goFullscreen(); enterRoom(i, startAt||0);
  }
  function resetIndex(scrollToI){
    pageAnim=null; jumpAnim=null; pageArmed=true; clearSettle();
    if(scrollToI!=null && ixScroll.children[scrollToI]){ ixScroll.scrollTop=centerTop(scrollToI); activeIdx=scrollToI; }
    markActive(); clusterIdx=-1; setCluster(activeIdx);
    ixCluster.style.opacity='1';
    if(pcx) pcx.clearRect(0,0,innerWidth,innerHeight);
    requestAnimationFrame(()=>{ sampleParticles(); applyCluster(); });
  }
  function chooseCentred(){ choosePlace(activeIdx, 0); }

  // ================= SPOTLIGHT ROOM =================
  let currentRoom=null, roomIdx=0, roomFrom=0, phase='rise', t0=0, sitting=false, roomPending=1, pendingExit=false, roomRunning=false;
  const RISE=reduce?900:4000, HOLD=reduce?2500:7000, FALL=reduce?900:4000, BLACK=reduce?300:1100;

  function swapRoom(){
    const p=currentRoom.photos[roomIdx];
    photo.src=p.src; photo.alt=altOf(p);
    document.documentElement.style.setProperty('--dom', dom[p.src] || '#caa46a');
    capTitle.textContent=p.title||'';
    capCue.style.display='none';
    capPlace.textContent=p.place||''; capPlace.style.display=p.place?'':'none';
    back.classList.add('avail');
    const ni=(roomIdx+1)%currentRoom.photos.length;
    preloadSrc(currentRoom.photos[ni].src);
  }
  function setReveal(light){
    if(light<=0.02){ reveal.style.background='#000'; return; }
    const r=light*maxR, rx=(r*1.35).toFixed(1), ry=(r*0.78).toFixed(1);
    const a0=1-light, s1=a0.toFixed(3), s2=(a0+(1-a0)*0.30).toFixed(3), s3=(a0+(1-a0)*0.65).toFixed(3);
    reveal.style.background='radial-gradient(ellipse '+rx+'px '+ry+'px at 50% 46%, rgba(0,0,0,'+s1+') 0%, rgba(0,0,0,'+s1+') 14%, rgba(0,0,0,'+s2+') 42%, rgba(0,0,0,'+s3+') 70%, #000 100%)';
  }
  function roomLoop(now){
    if(mode!=='room'){ roomRunning=false; return; }
    requestAnimationFrame(roomLoop);
    const el=now-t0; let light;
    if(phase==='rise'){ light=ease(Math.min(1,el/RISE)); if(el>=RISE){ phase='hold'; t0=now; plate.classList.add('show'); } }
    else if(phase==='hold'){ light=1; if(!sitting && el>=HOLD){ phase='fall'; t0=now; plate.classList.remove('show'); } }
    else if(phase==='fall'){ light=1-ease(Math.min(1,el/FALL)); if(el>=FALL){ phase='black'; t0=now; } }
    else {
      light=0;
      if(el>=BLACK){
        if(pendingExit){ finishExit(); return; }
        roomIdx=(roomIdx+roomPending+currentRoom.photos.length)%currentRoom.photos.length; roomPending=1;
        swapRoom(); phase='rise'; t0=now;
      }
    }
    setReveal(light);
  }
  function goFall(){ if(phase==='rise'||phase==='hold'){ phase='fall'; t0=performance.now(); plate.classList.remove('show'); setSit(false); } }
  function setSit(on){ sitting=on; sitEl.classList.toggle('show', on && mode==='room' && phase==='hold'); if(!on) t0=performance.now(); }

  let enterTimers=[];
  function clearEnterTimers(){ enterTimers.forEach(clearTimeout); enterTimers=[]; }
  function startRoom(i, startAt){
    setMode('room'); currentRoom=rooms[i]; roomFrom=i;
    roomIdx=Math.max(0, Math.min(currentRoom.photos.length-1, startAt||0));   // slideshow begins here
    pendingExit=false; sitting=false;
    preloadSrc(currentRoom.photos[roomIdx].src);   // dominant colour resolves on load; glow uses a fallback until then
    swapRoom(); phase='rise'; t0=performance.now();
    if(!roomRunning){ roomRunning=true; requestAnimationFrame(roomLoop); }
  }
  // A slow, deliberate entry: the index dissolves to black, the title fades in, then the
  // subtitle, both breathe, fade to black, wait in darkness, then the print rises.
  const FADE_TXT = 2000;   // matches the CSS opacity transition on .h / .p
  function enterRoom(i, startAt){
    entering=true;
    clearEnterTimers();
    enterH.textContent='Now entering the '+rooms[i].title+' Gallery';
    enterMsg.classList.remove('h-in','p-in');
    indexView.classList.add('gone');                       // 1. index dissolves to black
    const T = reduce
      ? { pre:500,  subDelay:400,  hold:500,  black:400 }
      : { pre:1800, subDelay:1600, hold:1600, black:1300 };
    let t = T.pre;                                          // black settled before any text
    enterTimers.push(setTimeout(()=>enterMsg.classList.add('h-in'), t));           // 2. title fades in
    t += T.subDelay;
    enterTimers.push(setTimeout(()=>enterMsg.classList.add('p-in'), t));           // 3. subtitle fades in, after the title
    t += FADE_TXT + T.hold;                                 // wait for subtitle to arrive, then breathe
    enterTimers.push(setTimeout(()=>enterMsg.classList.remove('h-in','p-in'), t)); // 4. message fades to black
    t += FADE_TXT + T.black;                                // wait for it to fade out, then a beat of pure black
    enterTimers.push(setTimeout(()=>startRoom(i, startAt||0), t));   // 5. the chosen print rises
  }
  function exitToStrip(){ if(mode!=='room') return; pendingExit=true; goFall(); }
  function finishExit(){
    roomRunning=false; back.classList.remove('avail'); plate.classList.remove('show');
    clearEnterTimers(); enterMsg.classList.remove('h-in','p-in');
    setMode('strip'); entering=false;
    resetIndex(roomFrom);                                  // reopen the index at the place we left
    indexView.classList.remove('gone');
  }

  back.addEventListener('click', e => { e.stopPropagation(); exitToStrip(); });

  // ================= ENTRY + GLOBAL INPUT =================
  function goFullscreen(){
    try{ const el=document.documentElement, rq=el.requestFullscreen||el.webkitRequestFullscreen;
      if(rq && !document.fullscreenElement && !document.webkitFullscreenElement){ const r=rq.call(el); if(r&&r.catch) r.catch(()=>{}); } }catch(e){}
  }
  addEventListener('pointerdown', e => {
    if(mode==='room' && phase==='hold'){
      if(e.target && e.target.closest && e.target.closest('#back')) return;
      setSit(!sitting);
    }
  });
  addEventListener('keydown', e => {
    if(heroUp && mode==='strip'){ if(['Tab','Shift','Control','Alt','Meta'].indexOf(e.key)<0){ e.preventDefault(); dissolveHero(); } return; }
    if(mode==='strip'){
      if(e.key==='ArrowDown'||e.key==='PageDown'||e.key===' '){ e.preventDefault(); goStep(1); }
      else if(e.key==='ArrowUp'||e.key==='PageUp'){ e.preventDefault(); goStep(-1); }
      else if(e.key==='Home'){ e.preventDefault(); scrollToPlace(0); }
      else if(e.key==='Enter'){ e.preventDefault(); chooseCentred(); }
    } else if(mode==='room'){
      if(e.key==='ArrowRight'||e.key===' '){ e.preventDefault(); roomPending=1; goFall(); }
      else if(e.key==='ArrowLeft'){ e.preventDefault(); roomPending=-1; goFall(); }
      else if(e.key==='Escape'){ exitToStrip(); }
    }
  });

  // idle: fade chrome + cursor after stillness
  let idle;
  function wake(){ document.body.classList.remove('ui-hidden'); clearTimeout(idle); idle=setTimeout(()=>document.body.classList.add('ui-hidden'), 3800); }
  ['mousemove','pointerdown','wheel','keydown','touchstart'].forEach(ev=>addEventListener(ev,wake,{passive:true}));
  wake();

  addEventListener('resize', () => { setMax(); sizeCanvas(); if(mode==='strip'){ sampleParticles(); applyCluster(); } });
  setMax();

  // land on the index — but open on the HERO first, unless a shared #location link was used.
  // (decide heroUp BEFORE buildIndex, whose syncHash would otherwise stamp a hash and skip the hero)
  heroUp = !!(hero && locFromHash()<0);
  setMode('strip'); buildIndex();
  if(heroUp){
    hero.addEventListener('wheel', e=>{ e.preventDefault(); dissolveHero(); }, {passive:false});
    hero.addEventListener('click', dissolveHero);
    hero.addEventListener('touchstart', ()=>dissolveHero(), {passive:true});
  } else if(hero){ hero.style.display='none'; }
})();
