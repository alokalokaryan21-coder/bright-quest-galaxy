(()=>{
const toggle=document.querySelector('.menu-toggle');const menu=document.querySelector('.nav-links');
if(toggle&&menu){toggle.addEventListener('click',()=>{const now=menu.classList.toggle('open');toggle.setAttribute('aria-expanded',now?'true':'false');toggle.textContent=now?'Close ✕':'Menu ☰'});}
const year=document.querySelector('#year');if(year)year.textContent=new Date().getFullYear();
})();
