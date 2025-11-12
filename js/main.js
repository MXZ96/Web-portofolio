// main.js - extracted from original HTML
(function(){
  // --- Basic data & helpers ---
  const YEAR = document.getElementById('year'); if(YEAR) YEAR.textContent = new Date().getFullYear();
  const DEFAULT_ADMIN = {username:'MXZ9696', password:'Popo094343_'}; // Change this after first login
  const LS_PROJECTS = 'portfolio_projects_v1';
  const LS_ABOUT = 'portfolio_about_v1';
  const LS_SKILLS = 'portfolio_skills_v1';
  const LS_EXPERIENCE = 'portfolio_experience_v1';
  const LS_ADMIN = 'portfolio_admin_v1';
  // Store original profile src for restore on logout
  const ORIGINAL_PROFILE_SRC = document.getElementById('profilePhoto')?.src || '';

  // Initialize admin (always update to ensure fresh credentials)
  localStorage.setItem(LS_ADMIN, JSON.stringify(DEFAULT_ADMIN));

  // Optional Supabase integration (use meta tags or window vars to configure)
  const SUPABASE_URL = document.querySelector('meta[name="supabase-url"]')?.content || window.SUPABASE_URL || '';
  const SUPABASE_KEY = document.querySelector('meta[name="supabase-key"]')?.content || window.SUPABASE_KEY || '';
  let useSupabase = false;
  let supabaseClient = null;
  if(SUPABASE_URL && SUPABASE_KEY && window.supabase && typeof window.supabase.createClient === 'function'){
    try{
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      useSupabase = true;
      // On init, pull data from Supabase and seed localStorage so existing UI works unchanged
      (async function(){
        try{
          const {data: about} = await supabaseClient.from('about').select('content').limit(1).single();
          if(about && about.content) localStorage.setItem(LS_ABOUT, about.content);
        }catch(e){/* ignore about fetch */}
        try{
          const {data: skills} = await supabaseClient.from('skills').select('name');
          if(skills) localStorage.setItem(LS_SKILLS, JSON.stringify(skills.map(s=>s.name)));
        }catch(e){/* ignore skills fetch */}
        try{
          const {data: exps} = await supabaseClient.from('experiences').select('*').order('created_at',{ascending:false});
          if(exps) localStorage.setItem(LS_EXPERIENCE, JSON.stringify(exps));
        }catch(e){/* ignore exps fetch */}
        try{
          const {data: projects} = await supabaseClient.from('projects').select('*').order('created_at',{ascending:false});
          if(projects) localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
        }catch(e){/* ignore projects fetch */}
      })();
    }catch(e){ console.warn('Supabase init failed', e); }
  }

  // --- Auth system (client-side prototype) ---
  let isLoggedIn = false;
  function setLoggedIn(u){
    isLoggedIn = !!u;
    const addBtn = document.getElementById('btnAddProject'); if(addBtn) addBtn.disabled = !isLoggedIn;
    const manageBtn = document.getElementById('btnManage'); if(manageBtn) manageBtn.disabled = !isLoggedIn;
    const loginBtn = document.getElementById('btnLogin'); if(loginBtn) loginBtn.textContent = isLoggedIn ? 'Logout' : 'Admin Login';

    // Show/hide admin-only buttons
    document.querySelectorAll('.admin-only').forEach(btn => {
      if(isLoggedIn) btn.classList.remove('d-none');
      else btn.classList.add('d-none');
    });

    // Update About, Skills, Experience buttons
    const btnEditAbout = document.getElementById('btnEditAbout'); if(btnEditAbout) btnEditAbout.disabled = !isLoggedIn;
    const btnAddSkill = document.getElementById('btnAddSkill'); if(btnAddSkill) btnAddSkill.disabled = !isLoggedIn;
    const btnAddExpEl = document.getElementById('btnAddExp'); if(btnAddExpEl) btnAddExpEl.disabled = !isLoggedIn;

    // Re-render project grid so admin controls (Edit/Hapus) appear/disappear
    try { if (typeof renderProjects === 'function') renderProjects(); } catch (e) { /* ignore if not ready */ }
    // Re-render skills and experiences to show/hide edit/delete buttons
    try { if (typeof renderSkills === 'function') renderSkills(); } catch (e) { /* ignore if not ready */ }
    try { if (typeof renderExperiences === 'function') renderExperiences(); } catch (e) { /* ignore if not ready */ }

    // If logging out, restore UI to pre-login state
    if (!isLoggedIn) {
      // restore profile photo if it was changed during session
      const pp = document.getElementById('profilePhoto'); if (pp && ORIGINAL_PROFILE_SRC) pp.src = ORIGINAL_PROFILE_SRC;

      // close any open modals (safely)
      document.querySelectorAll('.modal.show').forEach(m => {
        try {
          const inst = bootstrap.Modal.getOrCreateInstance(m);
          inst.hide();
        } catch (e) { /* ignore */ }
      });
    }
  }

  // Login button behavior
  const loginBtnEl = document.getElementById('btnLogin');
  if(loginBtnEl){
    loginBtnEl.addEventListener('click', ()=>{
      if(isLoggedIn){
        if(confirm('Logout?')){ setLoggedIn(false); sessionStorage.removeItem('portfolio_session'); }
      } else {
        const modal = new bootstrap.Modal(document.getElementById('loginModal')); modal.show();
      }
    });
  }

  // Handle login form
  const loginForm = document.getElementById('loginForm');
  if(loginForm){
    loginForm.addEventListener('submit', e=>{
      e.preventDefault();
      const u = document.getElementById('loginUser').value.trim();
      const p = document.getElementById('loginPass').value;
      const admin = JSON.parse(localStorage.getItem(LS_ADMIN));
      if(u === admin.username && p === admin.password){
        sessionStorage.setItem('portfolio_session', JSON.stringify({user:u,ts:Date.now()}));
        setLoggedIn(u);
        bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
        alert('Login berhasil. Gunakan tombol Admin Panel untuk menambah atau mengatur proyek.');
      } else alert('Username atau password salah.');
    });
  }

  // On page load, check session
  const sess = sessionStorage.getItem('portfolio_session'); if(sess) setLoggedIn(JSON.parse(sess).user);

  // Admin Panel button
  const btnManage = document.getElementById('btnManage');
  if(btnManage){
    btnManage.addEventListener('click', ()=>{
      if(!isLoggedIn) return alert('Please login first');
      // Open project modal for quick add
      document.getElementById('projId').value=''; document.getElementById('projTitle').value='';
      document.getElementById('projImage').value=''; document.getElementById('projLink').value=''; document.getElementById('projDesc').value='';
      const modal = new bootstrap.Modal(document.getElementById('projectModal')); modal.show();
    });
  }

  // --- Projects CRUD in localStorage ---
  function getProjects(){
    try{ return JSON.parse(localStorage.getItem(LS_PROJECTS)) || [] }catch(e){return []}
  }
  function saveProjects(arr){
    localStorage.setItem(LS_PROJECTS, JSON.stringify(arr));
    renderProjects();
    if(useSupabase && supabaseClient){
      // Upsert projects remotely (non-blocking)
      (async ()=>{
        try{
          // Ensure each project has id
          const payload = arr.map(p=>({ id: p.id || Date.now().toString(), title:p.title, description:p.desc, image_url:p.image, link:p.link, created_at:p.created_at || new Date().toISOString() }));
          await supabaseClient.from('projects').upsert(payload, {onConflict:'id'});
        }catch(e){ console.warn('Supabase projects upsert failed', e); }
      })();
    }
  }

  const projectForm = document.getElementById('projectForm');
  if(projectForm){
    projectForm.addEventListener('submit', e=>{
      e.preventDefault();
      if(!isLoggedIn) return alert('Hanya admin yang bisa menambah proyek.');
      const id = document.getElementById('projId').value || Date.now().toString();
      const proj = {id, title:document.getElementById('projTitle').value, image:document.getElementById('projImage').value, link:document.getElementById('projLink').value, desc:document.getElementById('projDesc').value };
      const arr = getProjects();
      const idx = arr.findIndex(p=>p.id===id);
      if(idx>=0) arr[idx]=proj; else arr.unshift(proj);
      saveProjects(arr);
      bootstrap.Modal.getInstance(document.getElementById('projectModal')).hide();
    });
  }

  function renderProjects(){
    const grid = document.getElementById('projectsGrid'); if(!grid) return;
    grid.innerHTML='';
    const arr = getProjects();
    if(arr.length===0) grid.innerHTML = '<div class="col-12 text-center text-muted">Belum ada proyek. Login sebagai admin untuk menambah.</div>';
    arr.forEach(p=>{
      const col = document.createElement('div'); col.className='col-md-6 col-lg-4';
      col.innerHTML = `
        <div class="card card-dark h-100">
          ${p.image?`<img src="${p.image}" class="card-img-top" style="height:180px;object-fit:cover">`:''}
          <div class="card-body d-flex flex-column">
            <h5 class="card-title">${escapeHtml(p.title)}</h5>
            <p class="card-text flex-grow-1">${escapeHtml(p.desc||'—')}</p>
            <div class="mt-3 d-flex justify-content-between align-items-center">
              <div>
                ${p.link?`<a class="btn btn-sm btn-outline-light" href="${p.link}" target="_blank">Lihat</a>`:''}
              </div>
              <div>
                ${isLoggedIn?`<button class="btn btn-sm btn-light me-1" data-action="edit" data-id="${p.id}">Edit</button><button class="btn btn-sm btn-danger" data-action="del" data-id="${p.id}">Hapus</button>`:''}
              </div>
            </div>
          </div>
        </div>
      `;
      grid.appendChild(col);
    });
  }

  // Escape helper
  function escapeHtml(s){ if(!s) return ''; return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

  // Delegate edit/delete
  const projectsGrid = document.getElementById('projectsGrid');
  if(projectsGrid){
    projectsGrid.addEventListener('click', e=>{
      const btn = e.target.closest('button'); if(!btn) return;
      const id = btn.dataset.id; const action = btn.dataset.action;
      if(action==='edit'){
        const proj = getProjects().find(x=>x.id===id); if(!proj) return;
        document.getElementById('projId').value = proj.id; document.getElementById('projTitle').value = proj.title;
        document.getElementById('projImage').value = proj.image; document.getElementById('projLink').value = proj.link; document.getElementById('projDesc').value = proj.desc;
        const modal = new bootstrap.Modal(document.getElementById('projectModal')); modal.show();
      } else if(action==='del'){
        if(!confirm('Hapus proyek ini?')) return; const arr = getProjects().filter(x=>x.id!==id); saveProjects(arr);
      }
    });
  }

  // Contact form -> opens mailto
  const contactForm = document.getElementById('contactForm');
  if(contactForm){
    contactForm.addEventListener('submit', e=>{
      e.preventDefault();
      const name = encodeURIComponent(document.getElementById('contactName').value);
      const email = encodeURIComponent(document.getElementById('contactEmail').value);
      const msg = encodeURIComponent(document.getElementById('contactMessage').value);
      const to = document.getElementById('emailLink').textContent || 'your.email@example.com';
      window.location.href = `mailto:${to}?subject=${encodeURIComponent('Pesan dari '+decodeURIComponent(name))}&body=${msg}%0A%0A--%0A${email}`;
    });
  }

  // Load some sample projects if empty (only once)
  if(getProjects().length===0){
    const sample = [
      {id:'p1', title:'Todo App', image:'https://picsum.photos/seed/todo/800/600', link:'#', desc:'Aplikasi todo dengan localStorage.'},
      {id:'p2', title:'Portfolio Website', image:'https://picsum.photos/seed/port/800/600', link:'#', desc:'Website pribadi yang menampilkan proyek dan kontak.'}
    ]; localStorage.setItem(LS_PROJECTS, JSON.stringify(sample));
  }
  renderProjects();

  // Small UX: allow clicking profile photo to change (when logged in)
  const profilePhoto = document.getElementById('profilePhoto');
  if(profilePhoto){
    profilePhoto.addEventListener('click', ()=>{
      if(!isLoggedIn) return; const url = prompt('Masukkan URL foto profil:'); if(url) profilePhoto.src = url;
    });
  }

  // Keyboard shortcut: Ctrl+L opens login modal
  document.addEventListener('keydown', e=>{ if(e.ctrlKey && e.key.toLowerCase()==='l'){ if(!isLoggedIn) new bootstrap.Modal(document.getElementById('loginModal')).show(); else alert('Sudah login'); }});

  // -------------------------------
  // Decorative starfield + shimmer
  // -------------------------------
  (function starfield(){
    const canvas = document.getElementById('starfield');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    let w=0,h=0,stars=[];

    function resize(){
      w = canvas.width = innerWidth * devicePixelRatio;
      h = canvas.height = innerHeight * devicePixelRatio;
      canvas.style.width = innerWidth+'px';
      canvas.style.height = innerHeight+'px';
      ctx.scale(devicePixelRatio, devicePixelRatio);
    }

    function rand(min,max){return Math.random()*(max-min)+min}

    function createStars(count){
      stars = [];
      for(let i=0;i<count;i++){
        stars.push({
          x:Math.random()*innerWidth,
          y:Math.random()*innerHeight,
          r:Math.random()*1.2 + 0.2,
          alpha:Math.random()*0.9 + 0.1,
          tw:Math.random()*0.02 + 0.003
        });
      }
    }

    function draw(){
      ctx.clearRect(0,0,innerWidth,innerHeight);
      for(const s of stars){
        s.alpha += Math.sin(Date.now()*s.tw)/250;
        s.alpha = Math.max(0.05, Math.min(1, s.alpha));
        ctx.beginPath();
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r*8);
        grad.addColorStop(0, `rgba(255,255,255,${s.alpha})`);
        grad.addColorStop(0.6, `rgba(140,140,255,${s.alpha*0.12})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.arc(s.x, s.y, s.r*2, 0, Math.PI*2);
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }

    // Parallax on mouse for subtle movement
    let mx=0,my=0;
    window.addEventListener('mousemove', e=>{mx = (e.clientX-innerWidth/2)/40; my = (e.clientY-innerHeight/2)/40; for(const s of stars){ s.x += mx*0.01; s.y += my*0.01; }});

    // shimmer on title periodically
    const title = document.querySelector('.shimmer-title');
    function triggerShimmer(){
      if(!title) return;
      title.classList.add('shimmer-active');
      setTimeout(()=>title.classList.remove('shimmer-active'), 2200);
    }
    setInterval(triggerShimmer, 4200);

    // Init (debounced resize and capped star count)
    let resizeTimer;
    window.addEventListener('resize', ()=>{
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(()=>{ resize(); createStars(Math.max(80, Math.min(180, Math.floor(innerWidth/10)))) }, 150);
    }, {passive:true});
    resize(); createStars(Math.max(80, Math.min(180, Math.floor(innerWidth/10)))); draw();

    // small aesthetic twinkle on project images when projects render (use MutationObserver but lightweight)
    const observer = new MutationObserver(mutations=>{
      for(const m of mutations){
        if(m.addedNodes && m.addedNodes.length){
          m.addedNodes.forEach(n=>{ if(n.querySelectorAll) n.querySelectorAll('img').forEach(img=>{ img.classList.add('twinkle'); setTimeout(()=>img.classList.remove('twinkle'), 700); }); });
        }
      }
    });
    const grid = document.getElementById('projectsGrid'); if(grid) observer.observe(grid, {childList:true,subtree:true});

  })();

  // ================================
  // ABOUT SECTION MANAGEMENT
  // ================================
  const btnEditAbout = document.getElementById('btnEditAbout');
  const aboutFormEl = document.getElementById('aboutForm');
  const aboutTextEl = document.getElementById('aboutText');
  const aboutInputEl = document.getElementById('aboutInput');

  function loadAbout(){
    const saved = localStorage.getItem(LS_ABOUT);
    if(saved && aboutTextEl){
      // escape all HTML then convert newlines and literal <br> into real <br> tags
      const safe = escapeHtml(saved).replaceAll('\n','<br>').replaceAll('&lt;br&gt;','<br>');
      aboutTextEl.innerHTML = safe;
    }
  }

  if(btnEditAbout) btnEditAbout.addEventListener('click', ()=>{
    if(aboutInputEl){
      const raw = localStorage.getItem(LS_ABOUT);
      aboutInputEl.value = raw !== null ? raw : (aboutTextEl ? aboutTextEl.textContent : '');
    }
  });

  if(aboutFormEl){
    aboutFormEl.addEventListener('submit', e=>{
      e.preventDefault();
      if(!isLoggedIn) return alert('Hanya admin yang bisa edit');
      const text = aboutInputEl.value;
      if(text && text.trim().length>0){
        // store the raw text (with newlines or literal <br>)
        localStorage.setItem(LS_ABOUT, text);
        if(useSupabase && supabaseClient){
          (async ()=>{
            try{
              // attempt to upsert a singleton about row; using id=1 as conventional single-row anchor
              await supabaseClient.from('about').upsert({id:1, content:text});
            }catch(err){ console.warn('Supabase about upsert failed', err); }
          })();
        }
        if(aboutTextEl){
          const safe = escapeHtml(text).replaceAll('\n','<br>').replaceAll('&lt;br&gt;','<br>');
          aboutTextEl.innerHTML = safe;
        }
        bootstrap.Modal.getInstance(document.getElementById('aboutModal')).hide();
      }
    });
  }

  loadAbout();

  // ================================
  // SKILLS SECTION MANAGEMENT
  // ================================
  const btnAddSkill = document.getElementById('btnAddSkill');
  const skillFormEl = document.getElementById('skillForm');
  const skillInputEl = document.getElementById('skillInput');
  const skillsListEl = document.getElementById('skillsList');

  function getSkills(){
    try{ return JSON.parse(localStorage.getItem(LS_SKILLS)) || ['HTML','CSS','JavaScript','Bootstrap','Python'] }catch(e){return ['HTML','CSS','JavaScript','Bootstrap','Python']}
  }

  function renderSkills(){
    if(!skillsListEl) return;
    skillsListEl.innerHTML = '';
    const skills = getSkills();
    skills.forEach(skill=>{
      const span = document.createElement('span');
      span.className = 'badge skill-badge p-2 position-relative';
      span.textContent = skill;
      if(isLoggedIn){
        span.style.cursor = 'pointer';
        span.title = 'Klik untuk hapus';
        span.addEventListener('click', ()=>{
          if(confirm(`Hapus skill \"${skill}\"?`)){
            const updated = getSkills().filter(s=>s!==skill);
            localStorage.setItem(LS_SKILLS, JSON.stringify(updated));
            renderSkills();
            if(useSupabase && supabaseClient){
              (async ()=>{
                try{ await supabaseClient.from('skills').delete().eq('name', skill); }catch(e){ console.warn('Supabase delete skill failed', e); }
              })();
            }
          }
        });
      }
      skillsListEl.appendChild(span);
    });
  }

  if(btnAddSkill) btnAddSkill.addEventListener('click', ()=>{ if(skillInputEl) skillInputEl.value = ''; });

  if(skillFormEl){
    skillFormEl.addEventListener('submit', e=>{
      e.preventDefault();
      if(!isLoggedIn) return alert('Hanya admin yang bisa tambah skill');
      const skill = skillInputEl.value.trim();
      if(skill){
        const skills = getSkills();
        if(!skills.includes(skill)){
          skills.push(skill);
          localStorage.setItem(LS_SKILLS, JSON.stringify(skills));
          if(useSupabase && supabaseClient){
            (async ()=>{
              try{ await supabaseClient.from('skills').insert({name:skill}); }catch(e){ console.warn('Supabase insert skill failed', e); }
            })();
          }
          renderSkills();
          skillInputEl.value = '';
          bootstrap.Modal.getInstance(document.getElementById('skillModal')).hide();
        } else alert('Skill sudah ada');
      }
    });
  }

  renderSkills();

  // ================================
  // EXPERIENCE SECTION MANAGEMENT
  // ================================
  const btnAddExpEl = document.getElementById('btnAddExp');
  const expFormEl = document.getElementById('expForm');
  const expListEl = document.getElementById('expList');

  function getExperiences(){
    try{ return JSON.parse(localStorage.getItem(LS_EXPERIENCE)) || [{id:'exp1',title:'Intern Web Developer',company:'Perusahaan X, 2024',desc:'Deskripsi singkat pengalaman kerja atau tugas yang dilakukan.'}] }catch(e){return []}
  }

  function renderExperiences(){
    if(!expListEl) return;
    expListEl.innerHTML = '';
    const exps = getExperiences();
    if(exps.length === 0) expListEl.innerHTML = '<div class="text-muted">Belum ada pengalaman. Login sebagai admin untuk menambah.</div>';
    exps.forEach(exp=>{
      const li = document.createElement('li');
      li.className = 'mb-3 card card-dark p-3';
      li.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
          <div class="flex-grow-1">
            <strong>${escapeHtml(exp.title)}</strong> <small class="text-muted">— ${escapeHtml(exp.company)}</small>
            <div>${escapeHtml(exp.desc)}</div>
          </div>
          ${isLoggedIn?`<div class="ms-2">
            <button class="btn btn-sm btn-light me-1" data-action="edit-exp" data-id="${exp.id}">Edit</button>
            <button class="btn btn-sm btn-danger" data-action="del-exp" data-id="${exp.id}">Hapus</button>
          </div>`:''}
        </div>
      `;
      expListEl.appendChild(li);
    });
  }

  if(btnAddExpEl) btnAddExpEl.addEventListener('click', ()=>{
    document.getElementById('expId').value = '';
    document.getElementById('expTitle').value = '';
    document.getElementById('expCompany').value = '';
    document.getElementById('expDesc').value = '';
  });

  if(expFormEl){
    expFormEl.addEventListener('submit', e=>{
      e.preventDefault();
      if(!isLoggedIn) return alert('Hanya admin yang bisa tambah pengalaman');
      const id = document.getElementById('expId').value || Date.now().toString();
      const exp = {id, title:document.getElementById('expTitle').value, company:document.getElementById('expCompany').value, desc:document.getElementById('expDesc').value};
      const exps = getExperiences();
      const idx = exps.findIndex(x=>x.id===id);
      if(idx>=0) exps[idx]=exp; else exps.unshift(exp);
      localStorage.setItem(LS_EXPERIENCE, JSON.stringify(exps));
      renderExperiences();
      if(useSupabase && supabaseClient){
        (async ()=>{
          try{
            // upsert with id
            await supabaseClient.from('experiences').upsert({id: exp.id, title: exp.title, company: exp.company, description: exp.desc, created_at: new Date().toISOString() }, {onConflict:'id'});
          }catch(e){ console.warn('Supabase experiences upsert failed', e); }
        })();
      }
      bootstrap.Modal.getInstance(document.getElementById('expModal')).hide();
    });
  }

  if(expListEl){
    expListEl.addEventListener('click', e=>{
      const btn = e.target.closest('button'); if(!btn) return;
      const id = btn.dataset.id; const action = btn.dataset.action;
      if(action==='edit-exp'){
        const exp = getExperiences().find(x=>x.id===id); if(!exp) return;
        document.getElementById('expId').value = exp.id;
        document.getElementById('expTitle').value = exp.title;
        document.getElementById('expCompany').value = exp.company;
        document.getElementById('expDesc').value = exp.desc;
        const modal = new bootstrap.Modal(document.getElementById('expModal')); modal.show();
      } else if(action==='del-exp'){
        if(!confirm('Hapus pengalaman ini?')) return;
        const exps = getExperiences().filter(x=>x.id!==id);
        localStorage.setItem(LS_EXPERIENCE, JSON.stringify(exps));
        renderExperiences();
        if(useSupabase && supabaseClient){
          (async ()=>{
            try{ await supabaseClient.from('experiences').delete().eq('id', id); }catch(e){ console.warn('Supabase delete experience failed', e); }
          })();
        }
      }
    });
  }

  renderExperiences();

})();


// === UI Enhancements: reveal on scroll, hero typing, and card tilt ===
(function uiEnhance(){
  // Reveal on scroll for selected elements
  try{
    // Only observe elements already marked for reveal to avoid large queries
    const nodes = Array.from(document.querySelectorAll('.reveal'));
    const obs = new IntersectionObserver((entries, o)=>{
      entries.forEach(en=>{
        if(en.isIntersecting){ en.target.classList.add('visible'); o.unobserve(en.target); }
      });
    },{threshold:0.12});
    nodes.forEach(n=>obs.observe(n));
  }catch(e){/* ignore */}

  // Hero typing effect (cycles words in data-words)
  try{
    const hero = document.querySelector('.hero-typed');
    if(hero){
      const rawWords = (hero.dataset.words || '').split('|').filter(Boolean);
      const words = rawWords.length ? rawWords : ['Full-Stack Developer','Web Developer','AI Enthusiast'];
      let wIndex = 0, chIndex = 0, forward = true;
      // ensure first node is a text node
      if(!hero.childNodes[0] || hero.childNodes[0].nodeType !== Node.TEXT_NODE) hero.insertBefore(document.createTextNode(''), hero.firstChild);
      const textNode = hero.childNodes[0];
      function tick(){
        const w = words[wIndex];
        if(forward){
          chIndex++;
          textNode.nodeValue = w.slice(0,chIndex);
          if(chIndex>=w.length){ forward=false; setTimeout(tick,1200); return; }
        } else {
          chIndex--;
          textNode.nodeValue = w.slice(0,chIndex);
          if(chIndex<=0){ forward=true; wIndex = (wIndex+1)%words.length; setTimeout(tick,300); return; }
        }
        setTimeout(tick, forward?70:30);
      }
      tick();
    }
  }catch(e){/* ignore */}

  // Card tilt effect for .card elements (throttled via RAF)
  try{
      const cards = document.querySelectorAll('.card');
      cards.forEach(card=>{
        card.classList.add('card-tilt');
        let ticking = false; let lastEvent = null;
        card.addEventListener('mousemove', e=>{ lastEvent = e; if(!ticking){ ticking=true; requestAnimationFrame(()=>{
          const rect = card.getBoundingClientRect();
          const cx = rect.left + rect.width/2; const cy = rect.top + rect.height/2;
          const dx = lastEvent.clientX - cx; const dy = lastEvent.clientY - cy;
          const rx = (dy / rect.height) * -4; // smaller rotateX
          const ry = (dx / rect.width) * 6; // smaller rotateY
          card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg)`;
          ticking=false;
        }); } }, {passive:true});
        card.addEventListener('mouseleave', ()=>{ card.style.transform = ''; });
      });
    }catch(e){/* ignore */}

})();
// main.js - extracted from original HTML
(function(){
  // --- Basic data & helpers ---
  const YEAR = document.getElementById('year'); if(YEAR) YEAR.textContent = new Date().getFullYear();
  const DEFAULT_ADMIN = {username:'MXZ9696', password:'Popo094343_'}; // Change this after first login
  const LS_PROJECTS = 'portfolio_projects_v1';
  const LS_ABOUT = 'portfolio_about_v1';
  const LS_SKILLS = 'portfolio_skills_v1';
  const LS_EXPERIENCE = 'portfolio_experience_v1';
  const LS_ADMIN = 'portfolio_admin_v1';
  // Store original profile src for restore on logout
  const ORIGINAL_PROFILE_SRC = document.getElementById('profilePhoto')?.src || '';

  // Initialize admin (always update to ensure fresh credentials)
  localStorage.setItem(LS_ADMIN, JSON.stringify(DEFAULT_ADMIN));

  // Optional Supabase integration (use meta tags or window vars to configure)
  const SUPABASE_URL = document.querySelector('meta[name="supabase-url"]')?.content || window.SUPABASE_URL || '';
  const SUPABASE_KEY = document.querySelector('meta[name="supabase-key"]')?.content || window.SUPABASE_KEY || '';
  let useSupabase = false;
  let supabaseClient = null;
  if(SUPABASE_URL && SUPABASE_KEY && window.supabase && typeof window.supabase.createClient === 'function'){
    try{
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      useSupabase = true;
      // On init, pull data from Supabase and seed localStorage so existing UI works unchanged
      (async function(){
        try{
          const {data: about} = await supabaseClient.from('about').select('content').limit(1).single();
          if(about && about.content) localStorage.setItem(LS_ABOUT, about.content);
        }catch(e){/* ignore about fetch */}
        try{
          const {data: skills} = await supabaseClient.from('skills').select('name');
          if(skills) localStorage.setItem(LS_SKILLS, JSON.stringify(skills.map(s=>s.name)));
        }catch(e){/* ignore skills fetch */}
        try{
          const {data: exps} = await supabaseClient.from('experiences').select('*').order('created_at',{ascending:false});
          if(exps) localStorage.setItem(LS_EXPERIENCE, JSON.stringify(exps));
        }catch(e){/* ignore exps fetch */}
        try{
          const {data: projects} = await supabaseClient.from('projects').select('*').order('created_at',{ascending:false});
          if(projects) localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
        }catch(e){/* ignore projects fetch */}
      })();
    }catch(e){ console.warn('Supabase init failed', e); }
  }

  // --- Auth system (client-side prototype) ---
  let isLoggedIn = false;
  function setLoggedIn(u){
    isLoggedIn = !!u;
    const addBtn = document.getElementById('btnAddProject'); if(addBtn) addBtn.disabled = !isLoggedIn;
    const manageBtn = document.getElementById('btnManage'); if(manageBtn) manageBtn.disabled = !isLoggedIn;
    const loginBtn = document.getElementById('btnLogin'); if(loginBtn) loginBtn.textContent = isLoggedIn ? 'Logout' : 'Admin Login';

    // Show/hide admin-only buttons
    document.querySelectorAll('.admin-only').forEach(btn => {
      if(isLoggedIn) btn.classList.remove('d-none');
      else btn.classList.add('d-none');
    });

    // Update About, Skills, Experience buttons
    const btnEditAbout = document.getElementById('btnEditAbout'); if(btnEditAbout) btnEditAbout.disabled = !isLoggedIn;
    const btnAddSkill = document.getElementById('btnAddSkill'); if(btnAddSkill) btnAddSkill.disabled = !isLoggedIn;
    const btnAddExpEl = document.getElementById('btnAddExp'); if(btnAddExpEl) btnAddExpEl.disabled = !isLoggedIn;

    // Re-render project grid so admin controls (Edit/Hapus) appear/disappear
    try { if (typeof renderProjects === 'function') renderProjects(); } catch (e) { /* ignore if not ready */ }
    // Re-render skills and experiences to show/hide edit/delete buttons
    try { if (typeof renderSkills === 'function') renderSkills(); } catch (e) { /* ignore if not ready */ }
    try { if (typeof renderExperiences === 'function') renderExperiences(); } catch (e) { /* ignore if not ready */ }

    // If logging out, restore UI to pre-login state
    if (!isLoggedIn) {
      // restore profile photo if it was changed during session
      const pp = document.getElementById('profilePhoto'); if (pp && ORIGINAL_PROFILE_SRC) pp.src = ORIGINAL_PROFILE_SRC;

      // close any open modals (safely)
      document.querySelectorAll('.modal.show').forEach(m => {
        try {
          const inst = bootstrap.Modal.getOrCreateInstance(m);
          inst.hide();
        } catch (e) { /* ignore */ }
      });
    }
  }

  // Login button behavior
  const loginBtnEl = document.getElementById('btnLogin');
  if(loginBtnEl){
    loginBtnEl.addEventListener('click', ()=>{
      if(isLoggedIn){
        if(confirm('Logout?')){ setLoggedIn(false); sessionStorage.removeItem('portfolio_session'); }
      } else {
        const modal = new bootstrap.Modal(document.getElementById('loginModal')); modal.show();
      }
    });
  }

  // Handle login form
  const loginForm = document.getElementById('loginForm');
  if(loginForm){
    loginForm.addEventListener('submit', e=>{
      e.preventDefault();
      const u = document.getElementById('loginUser').value.trim();
      const p = document.getElementById('loginPass').value;
      const admin = JSON.parse(localStorage.getItem(LS_ADMIN));
      if(u === admin.username && p === admin.password){
        sessionStorage.setItem('portfolio_session', JSON.stringify({user:u,ts:Date.now()}));
        setLoggedIn(u);
        bootstrap.Modal.getInstance(document.getElementById('loginModal')).hide();
        alert('Login berhasil. Gunakan tombol Admin Panel untuk menambah atau mengatur proyek.');
      } else alert('Username atau password salah.');
    });
  }

  // On page load, check session
  const sess = sessionStorage.getItem('portfolio_session'); if(sess) setLoggedIn(JSON.parse(sess).user);

  // Admin Panel button
  const btnManage = document.getElementById('btnManage');
  if(btnManage){
    btnManage.addEventListener('click', ()=>{
      if(!isLoggedIn) return alert('Please login first');
      // Open project modal for quick add
      document.getElementById('projId').value=''; document.getElementById('projTitle').value='';
      document.getElementById('projImage').value=''; document.getElementById('projLink').value=''; document.getElementById('projDesc').value='';
      const modal = new bootstrap.Modal(document.getElementById('projectModal')); modal.show();
    });
  }

  // --- Projects CRUD in localStorage ---
  function getProjects(){
    try{ return JSON.parse(localStorage.getItem(LS_PROJECTS)) || [] }catch(e){return []}
  }
  function saveProjects(arr){
    localStorage.setItem(LS_PROJECTS, JSON.stringify(arr));
    renderProjects();
    if(useSupabase && supabaseClient){
      // Upsert projects remotely (non-blocking)
      (async ()=>{
        try{
          // Ensure each project has id
          const payload = arr.map(p=>({ id: p.id || Date.now().toString(), title:p.title, description:p.desc, image_url:p.image, link:p.link, created_at:p.created_at || new Date().toISOString() }));
          await supabaseClient.from('projects').upsert(payload, {onConflict:'id'});
        }catch(e){ console.warn('Supabase projects upsert failed', e); }
      })();
    }
  }

  const projectForm = document.getElementById('projectForm');
  if(projectForm){
    projectForm.addEventListener('submit', e=>{
      e.preventDefault();
      if(!isLoggedIn) return alert('Hanya admin yang bisa menambah proyek.');
      const id = document.getElementById('projId').value || Date.now().toString();
      const proj = {id, title:document.getElementById('projTitle').value, image:document.getElementById('projImage').value, link:document.getElementById('projLink').value, desc:document.getElementById('projDesc').value };
      const arr = getProjects();
      const idx = arr.findIndex(p=>p.id===id);
      if(idx>=0) arr[idx]=proj; else arr.unshift(proj);
      saveProjects(arr);
      bootstrap.Modal.getInstance(document.getElementById('projectModal')).hide();
    });
  }

  function renderProjects(){
    const grid = document.getElementById('projectsGrid'); if(!grid) return;
    grid.innerHTML='';
    const arr = getProjects();
    if(arr.length===0) grid.innerHTML = '<div class="col-12 text-center text-muted">Belum ada proyek. Login sebagai admin untuk menambah.</div>';
    arr.forEach(p=>{
      const col = document.createElement('div'); col.className='col-md-6 col-lg-4';
      col.innerHTML = `
        <div class="card card-dark h-100">
          ${p.image?`<img src="${p.image}" class="card-img-top" style="height:180px;object-fit:cover">`:''}
          <div class="card-body d-flex flex-column">
            <h5 class="card-title">${escapeHtml(p.title)}</h5>
            <p class="card-text flex-grow-1">${escapeHtml(p.desc||'—')}</p>
            <div class="mt-3 d-flex justify-content-between align-items-center">
              <div>
                ${p.link?`<a class="btn btn-sm btn-outline-light" href="${p.link}" target="_blank">Lihat</a>`:''}
              </div>
              <div>
                ${isLoggedIn?`<button class="btn btn-sm btn-light me-1" data-action="edit" data-id="${p.id}">Edit</button><button class="btn btn-sm btn-danger" data-action="del" data-id="${p.id}">Hapus</button>`:''}
              </div>
            </div>
          </div>
        </div>
      `;
      grid.appendChild(col);
    });
  }

  // Escape helper
  function escapeHtml(s){ if(!s) return ''; return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }

  // Delegate edit/delete
  const projectsGrid = document.getElementById('projectsGrid');
  if(projectsGrid){
    projectsGrid.addEventListener('click', e=>{
      const btn = e.target.closest('button'); if(!btn) return;
      const id = btn.dataset.id; const action = btn.dataset.action;
      if(action==='edit'){
        const proj = getProjects().find(x=>x.id===id); if(!proj) return;
        document.getElementById('projId').value = proj.id; document.getElementById('projTitle').value = proj.title;
        document.getElementById('projImage').value = proj.image; document.getElementById('projLink').value = proj.link; document.getElementById('projDesc').value = proj.desc;
        const modal = new bootstrap.Modal(document.getElementById('projectModal')); modal.show();
      } else if(action==='del'){
        if(!confirm('Hapus proyek ini?')) return; const arr = getProjects().filter(x=>x.id!==id); saveProjects(arr);
      }
    });
  }

  // Contact form -> opens mailto
  const contactForm = document.getElementById('contactForm');
  if(contactForm){
    contactForm.addEventListener('submit', e=>{
      e.preventDefault();
      const name = encodeURIComponent(document.getElementById('contactName').value);
      const email = encodeURIComponent(document.getElementById('contactEmail').value);
      const msg = encodeURIComponent(document.getElementById('contactMessage').value);
      const to = document.getElementById('emailLink').textContent || 'your.email@example.com';
      window.location.href = `mailto:${to}?subject=${encodeURIComponent('Pesan dari '+decodeURIComponent(name))}&body=${msg}%0A%0A--%0A${email}`;
    });
  }

  // Load some sample projects if empty (only once)
  if(getProjects().length===0){
    const sample = [
      {id:'p1', title:'Todo App', image:'https://picsum.photos/seed/todo/800/600', link:'#', desc:'Aplikasi todo dengan localStorage.'},
      {id:'p2', title:'Portfolio Website', image:'https://picsum.photos/seed/port/800/600', link:'#', desc:'Website pribadi yang menampilkan proyek dan kontak.'}
    ]; localStorage.setItem(LS_PROJECTS, JSON.stringify(sample));
  }
  renderProjects();

  // Small UX: allow clicking profile photo to change (when logged in)
  const profilePhoto = document.getElementById('profilePhoto');
  if(profilePhoto){
    profilePhoto.addEventListener('click', ()=>{
      if(!isLoggedIn) return; const url = prompt('Masukkan URL foto profil:'); if(url) profilePhoto.src = url;
    });
  }

  // Keyboard shortcut: Ctrl+L opens login modal
  document.addEventListener('keydown', e=>{ if(e.ctrlKey && e.key.toLowerCase()==='l'){ if(!isLoggedIn) new bootstrap.Modal(document.getElementById('loginModal')).show(); else alert('Sudah login'); }});

  // -------------------------------
  // Decorative starfield + shimmer
  // -------------------------------
  (function starfield(){
    const canvas = document.getElementById('starfield');
    if(!canvas) return;
    const ctx = canvas.getContext('2d');
    let w=0,h=0,stars=[];

    function resize(){
      w = canvas.width = innerWidth * devicePixelRatio;
      h = canvas.height = innerHeight * devicePixelRatio;
      canvas.style.width = innerWidth+'px';
      canvas.style.height = innerHeight+'px';
      ctx.scale(devicePixelRatio, devicePixelRatio);
    }

    function rand(min,max){return Math.random()*(max-min)+min}

    function createStars(count){
      stars = [];
      for(let i=0;i<count;i++){
        stars.push({
          x:Math.random()*innerWidth,
          y:Math.random()*innerHeight,
          r:Math.random()*1.2 + 0.2,
          alpha:Math.random()*0.9 + 0.1,
          tw:Math.random()*0.02 + 0.003
        });
      }
    }

    function draw(){
      ctx.clearRect(0,0,innerWidth,innerHeight);
      for(const s of stars){
        s.alpha += Math.sin(Date.now()*s.tw)/250;
        s.alpha = Math.max(0.05, Math.min(1, s.alpha));
        ctx.beginPath();
        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r*8);
        grad.addColorStop(0, `rgba(255,255,255,${s.alpha})`);
        grad.addColorStop(0.6, `rgba(140,140,255,${s.alpha*0.12})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.arc(s.x, s.y, s.r*2, 0, Math.PI*2);
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }

    // Parallax on mouse for subtle movement
    let mx=0,my=0;
    window.addEventListener('mousemove', e=>{mx = (e.clientX-innerWidth/2)/40; my = (e.clientY-innerHeight/2)/40; for(const s of stars){ s.x += mx*0.01; s.y += my*0.01; }});

    // shimmer on title periodically
    const title = document.querySelector('.shimmer-title');
    function triggerShimmer(){
      if(!title) return;
      title.classList.add('shimmer-active');
      setTimeout(()=>title.classList.remove('shimmer-active'), 2200);
    }
    setInterval(triggerShimmer, 4200);

    // Init (debounced resize and capped star count)
    let resizeTimer;
    window.addEventListener('resize', ()=>{
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(()=>{ resize(); createStars(Math.max(80, Math.min(180, Math.floor(innerWidth/10)))) }, 150);
    }, {passive:true});
    resize(); createStars(Math.max(80, Math.min(180, Math.floor(innerWidth/10)))); draw();

    // small aesthetic twinkle on project images when projects render (use MutationObserver but lightweight)
    const observer = new MutationObserver(mutations=>{
      for(const m of mutations){
        if(m.addedNodes && m.addedNodes.length){
          m.addedNodes.forEach(n=>{ if(n.querySelectorAll) n.querySelectorAll('img').forEach(img=>{ img.classList.add('twinkle'); setTimeout(()=>img.classList.remove('twinkle'), 700); }); });
        }
      }
    });
    const grid = document.getElementById('projectsGrid'); if(grid) observer.observe(grid, {childList:true,subtree:true});

  })();

  // ================================
  // ABOUT SECTION MANAGEMENT
  // ================================
  const btnEditAbout = document.getElementById('btnEditAbout');
  const aboutFormEl = document.getElementById('aboutForm');
  const aboutTextEl = document.getElementById('aboutText');
  const aboutInputEl = document.getElementById('aboutInput');

  function loadAbout(){
    const saved = localStorage.getItem(LS_ABOUT);
    if(saved && aboutTextEl){
      // escape all HTML then convert newlines and literal <br> into real <br> tags
      const safe = escapeHtml(saved).replaceAll('\n','<br>').replaceAll('&lt;br&gt;','<br>');
      aboutTextEl.innerHTML = safe;
    }
  }

  if(btnEditAbout) btnEditAbout.addEventListener('click', ()=>{
    if(aboutInputEl){
      const raw = localStorage.getItem(LS_ABOUT);
      aboutInputEl.value = raw !== null ? raw : (aboutTextEl ? aboutTextEl.textContent : '');
    }
  });

  if(aboutFormEl){
    aboutFormEl.addEventListener('submit', e=>{
      e.preventDefault();
      if(!isLoggedIn) return alert('Hanya admin yang bisa edit');
      const text = aboutInputEl.value;
      if(text && text.trim().length>0){
        // store the raw text (with newlines or literal <br>)
        localStorage.setItem(LS_ABOUT, text);
        if(useSupabase && supabaseClient){
          (async ()=>{
            try{
              // attempt to upsert a singleton about row; using id=1 as conventional single-row anchor
              await supabaseClient.from('about').upsert({id:1, content:text});
            }catch(err){ console.warn('Supabase about upsert failed', err); }
          })();
        }
        if(aboutTextEl){
          const safe = escapeHtml(text).replaceAll('\n','<br>').replaceAll('&lt;br&gt;','<br>');
          aboutTextEl.innerHTML = safe;
        }
        bootstrap.Modal.getInstance(document.getElementById('aboutModal')).hide();
      }
    });
  }

  loadAbout();

  // ================================
  // SKILLS SECTION MANAGEMENT
  // ================================
  const btnAddSkill = document.getElementById('btnAddSkill');
  const skillFormEl = document.getElementById('skillForm');
  const skillInputEl = document.getElementById('skillInput');
  const skillsListEl = document.getElementById('skillsList');

  function getSkills(){
    try{ return JSON.parse(localStorage.getItem(LS_SKILLS)) || ['HTML','CSS','JavaScript','Bootstrap','Python'] }catch(e){return ['HTML','CSS','JavaScript','Bootstrap','Python']}
  }

  function renderSkills(){
    if(!skillsListEl) return;
    skillsListEl.innerHTML = '';
    const skills = getSkills();
    skills.forEach(skill=>{
      const span = document.createElement('span');
      span.className = 'badge skill-badge p-2 position-relative';
      span.textContent = skill;
      if(isLoggedIn){
        span.style.cursor = 'pointer';
        span.title = 'Klik untuk hapus';
        span.addEventListener('click', ()=>{
          if(confirm(`Hapus skill "${skill}"?`)){
            const updated = getSkills().filter(s=>s!==skill);
            localStorage.setItem(LS_SKILLS, JSON.stringify(updated));
            renderSkills();
            if(useSupabase && supabaseClient){
              (async ()=>{
                try{ await supabaseClient.from('skills').delete().eq('name', skill); }catch(e){ console.warn('Supabase delete skill failed', e); }
              })();
            }
          }
        });
      }
      skillsListEl.appendChild(span);
    });
  }

  if(btnAddSkill) btnAddSkill.addEventListener('click', ()=>{ if(skillInputEl) skillInputEl.value = ''; });

  if(skillFormEl){
    skillFormEl.addEventListener('submit', e=>{
      e.preventDefault();
      if(!isLoggedIn) return alert('Hanya admin yang bisa tambah skill');
      const skill = skillInputEl.value.trim();
      if(skill){
        const skills = getSkills();
        if(!skills.includes(skill)){
          skills.push(skill);
          localStorage.setItem(LS_SKILLS, JSON.stringify(skills));
          if(useSupabase && supabaseClient){
            (async ()=>{
              try{ await supabaseClient.from('skills').insert({name:skill}); }catch(e){ console.warn('Supabase insert skill failed', e); }
            })();
          }
          renderSkills();
          skillInputEl.value = '';
          bootstrap.Modal.getInstance(document.getElementById('skillModal')).hide();
        } else alert('Skill sudah ada');
      }
    });
  }

  renderSkills();

  // ================================
  // EXPERIENCE SECTION MANAGEMENT
  // ================================
  const btnAddExpEl = document.getElementById('btnAddExp');
  const expFormEl = document.getElementById('expForm');
  const expListEl = document.getElementById('expList');

  function getExperiences(){
    try{ return JSON.parse(localStorage.getItem(LS_EXPERIENCE)) || [{id:'exp1',title:'Intern Web Developer',company:'Perusahaan X, 2024',desc:'Deskripsi singkat pengalaman kerja atau tugas yang dilakukan.'}] }catch(e){return []}
  }

  function renderExperiences(){
    if(!expListEl) return;
    expListEl.innerHTML = '';
    const exps = getExperiences();
    if(exps.length === 0) expListEl.innerHTML = '<div class="text-muted">Belum ada pengalaman. Login sebagai admin untuk menambah.</div>';
    exps.forEach(exp=>{
      const li = document.createElement('li');
      li.className = 'mb-3 card card-dark p-3';
      li.innerHTML = `
        <div class="d-flex justify-content-between align-items-start">
          <div class="flex-grow-1">
            <strong>${escapeHtml(exp.title)}</strong> <small class="text-muted">— ${escapeHtml(exp.company)}</small>
            <div>${escapeHtml(exp.desc)}</div>
          </div>
          ${isLoggedIn?`<div class="ms-2">
            <button class="btn btn-sm btn-light me-1" data-action="edit-exp" data-id="${exp.id}">Edit</button>
            <button class="btn btn-sm btn-danger" data-action="del-exp" data-id="${exp.id}">Hapus</button>
          </div>`:''}
        </div>
      `;
      expListEl.appendChild(li);
    });
  }

  if(btnAddExpEl) btnAddExpEl.addEventListener('click', ()=>{
    document.getElementById('expId').value = '';
    document.getElementById('expTitle').value = '';
    document.getElementById('expCompany').value = '';
    document.getElementById('expDesc').value = '';
  });

  if(expFormEl){
    expFormEl.addEventListener('submit', e=>{
      e.preventDefault();
      if(!isLoggedIn) return alert('Hanya admin yang bisa tambah pengalaman');
      const id = document.getElementById('expId').value || Date.now().toString();
      const exp = {id, title:document.getElementById('expTitle').value, company:document.getElementById('expCompany').value, desc:document.getElementById('expDesc').value};
      const exps = getExperiences();
      const idx = exps.findIndex(x=>x.id===id);
      if(idx>=0) exps[idx]=exp; else exps.unshift(exp);
      localStorage.setItem(LS_EXPERIENCE, JSON.stringify(exps));
      renderExperiences();
      if(useSupabase && supabaseClient){
        (async ()=>{
          try{
            // upsert with id
            await supabaseClient.from('experiences').upsert({id: exp.id, title: exp.title, company: exp.company, description: exp.desc, created_at: new Date().toISOString() }, {onConflict:'id'});
          }catch(e){ console.warn('Supabase experiences upsert failed', e); }
        })();
      }
      bootstrap.Modal.getInstance(document.getElementById('expModal')).hide();
    });
  }

  if(expListEl){
    expListEl.addEventListener('click', e=>{
      const btn = e.target.closest('button'); if(!btn) return;
      const id = btn.dataset.id; const action = btn.dataset.action;
      if(action==='edit-exp'){
        const exp = getExperiences().find(x=>x.id===id); if(!exp) return;
        document.getElementById('expId').value = exp.id;
        document.getElementById('expTitle').value = exp.title;
        document.getElementById('expCompany').value = exp.company;
        document.getElementById('expDesc').value = exp.desc;
        const modal = new bootstrap.Modal(document.getElementById('expModal')); modal.show();
      } else if(action==='del-exp'){
        if(!confirm('Hapus pengalaman ini?')) return;
        const exps = getExperiences().filter(x=>x.id!==id);
        localStorage.setItem(LS_EXPERIENCE, JSON.stringify(exps));
        renderExperiences();
        if(useSupabase && supabaseClient){
          (async ()=>{
            try{ await supabaseClient.from('experiences').delete().eq('id', id); }catch(e){ console.warn('Supabase delete experience failed', e); }
          })();
        }
      }
    });
  }

  renderExperiences();

})();


// === UI Enhancements: reveal on scroll, hero typing, and card tilt ===
(function uiEnhance(){
  // Reveal on scroll for selected elements
  try{
    // Only observe elements already marked for reveal to avoid large queries
    const nodes = Array.from(document.querySelectorAll('.reveal'));
    const obs = new IntersectionObserver((entries, o)=>{
      entries.forEach(en=>{
        if(en.isIntersecting){ en.target.classList.add('visible'); o.unobserve(en.target); }
      });
    },{threshold:0.12});
    nodes.forEach(n=>obs.observe(n));
  }catch(e){/* ignore */}

  // Hero typing effect (cycles words in data-words)
  try{
    const hero = document.querySelector('.hero-typed');
    if(hero){
      const rawWords = (hero.dataset.words || '').split('|').filter(Boolean);
      const words = rawWords.length ? rawWords : ['Full-Stack Developer','Web Developer','AI Enthusiast'];
      let wIndex = 0, chIndex = 0, forward = true;
      // ensure first node is a text node
      if(!hero.childNodes[0] || hero.childNodes[0].nodeType !== Node.TEXT_NODE) hero.insertBefore(document.createTextNode(''), hero.firstChild);
      const textNode = hero.childNodes[0];
      function tick(){
        const w = words[wIndex];
        if(forward){
          chIndex++;
          textNode.nodeValue = w.slice(0,chIndex);
          if(chIndex>=w.length){ forward=false; setTimeout(tick,1200); return; }
        } else {
          chIndex--;
          textNode.nodeValue = w.slice(0,chIndex);
          if(chIndex<=0){ forward=true; wIndex = (wIndex+1)%words.length; setTimeout(tick,300); return; }
        }
        setTimeout(tick, forward?70:30);
      }
      tick();
    }
  }catch(e){/* ignore */}

  // Card tilt effect for .card elements (throttled via RAF)
  try{
      const cards = document.querySelectorAll('.card');
      cards.forEach(card=>{
        card.classList.add('card-tilt');
        let ticking = false; let lastEvent = null;
        card.addEventListener('mousemove', e=>{ lastEvent = e; if(!ticking){ ticking=true; requestAnimationFrame(()=>{
          const rect = card.getBoundingClientRect();
          const cx = rect.left + rect.width/2; const cy = rect.top + rect.height/2;
          const dx = lastEvent.clientX - cx; const dy = lastEvent.clientY - cy;
          const rx = (dy / rect.height) * -4; // smaller rotateX
          const ry = (dx / rect.width) * 6; // smaller rotateY
          card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg)`;
          ticking=false;
        }); } }, {passive:true});
        card.addEventListener('mouseleave', ()=>{ card.style.transform = ''; });
      });
    }catch(e){/* ignore */}

})();