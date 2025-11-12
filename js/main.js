// main.js  single clean IIFE (admin seed, login, deduped toast, modal cleanup)
(function(){
  'use strict';

  const YEAR = document.getElementById('year'); if(YEAR) YEAR.textContent = new Date().getFullYear();

  const DEFAULT_ADMIN = { username: 'MXZ9696', password: 'Popo094343_' };
  const LS_ADMIN = 'portfolio_admin_v1';
  try{ localStorage.setItem(LS_ADMIN, JSON.stringify(DEFAULT_ADMIN)); }catch(e){}

  let _lastToast = { msg: '', ts: 0 };
  function showToast(msg, timeout = 1400){
    try{
      const now = Date.now(); if(msg === _lastToast.msg && now - _lastToast.ts < 1000) return;
      _lastToast = { msg, ts: now };
      let c = document.getElementById('mxz-toast-container');
      if(!c){ c = document.createElement('div'); c.id = 'mxz-toast-container'; Object.assign(c.style, { position:'fixed', right:'18px', bottom:'18px', zIndex:'10800' }); document.body.appendChild(c); }
      const el = document.createElement('div'); el.className = 'mxz-toast card p-2 mb-2'; Object.assign(el.style, { minWidth:'200px', background:'rgba(20,20,20,0.95)', color:'#fff' }); el.textContent = msg; c.appendChild(el);
      setTimeout(()=>{ el.style.transition='opacity .35s ease, transform .35s ease'; el.style.opacity='0'; el.style.transform='translateY(8px)'; setTimeout(()=>el.remove(),360); }, timeout);
    }catch(e){ console.warn('showToast', e); }
  }
  try{ window.alert = showToast; }catch(e){}

  function cleanupModalArtifacts(){ try{ document.querySelectorAll('.modal-backdrop').forEach(n=>n.remove()); document.documentElement.style.overflow=''; document.body.style.overflow=''; document.body.classList.remove('modal-open'); }catch(e){} }
  document.addEventListener('hidden.bs.modal', cleanupModalArtifacts);

  let isLoggedIn = false;
  function setLoggedIn(u){ isLoggedIn = !!u; document.querySelectorAll('.admin-only').forEach(el=>el.classList.toggle('d-none', !isLoggedIn)); const lb = document.getElementById('btnLogin'); if(lb) lb.textContent = isLoggedIn ? 'Logout' : 'Admin Login'; if(!isLoggedIn) cleanupModalArtifacts(); }

  const loginBtn = document.getElementById('btnLogin');
  if(loginBtn) loginBtn.addEventListener('click', ()=>{
    if(isLoggedIn){ if(confirm('Logout?')){ setLoggedIn(false); sessionStorage.removeItem('portfolio_session'); showToast('Logout berhasil'); } }
    else { try{ new bootstrap.Modal(document.getElementById('loginModal')).show(); }catch(e){} }
  });

  const loginForm = document.getElementById('loginForm');
  if(loginForm) loginForm.addEventListener('submit', e=>{
    e.preventDefault();
    const u = (document.getElementById('loginUser')?.value||'').trim();
    const p = (document.getElementById('loginPass')?.value||'');
    let admin = null; try{ admin = JSON.parse(localStorage.getItem(LS_ADMIN)); }catch(e){}
    if(admin && u === admin.username && p === admin.password){ sessionStorage.setItem('portfolio_session', JSON.stringify({ user:u, ts:Date.now() })); setLoggedIn(u); try{ bootstrap.Modal.getInstance(document.getElementById('loginModal'))?.hide(); }catch(e){ cleanupModalArtifacts(); } showToast('Login berhasil'); }
    else showToast('Username atau password salah');
  });

  try{ const s = sessionStorage.getItem('portfolio_session'); if(s) setLoggedIn(JSON.parse(s).user); }catch(e){}

})();
