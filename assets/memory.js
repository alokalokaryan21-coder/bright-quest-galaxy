(()=>{const board=document.querySelector('#memory-board');if(!board)return;
const icons=['🚀','🌙','🪐','⭐','👽','☄️','🛰️','🌎','🌈','🔭','🌌','🛸'];
let pairs=4, flipped=[],matched=0,moves=0,start=null,timer=null,locked=false,epoch=0;
const status=document.querySelector('#game-status'),stats=document.querySelector('#stats'),levelButtons=[...document.querySelectorAll('[data-pairs]')];
const nextLevel=document.querySelector('#next-level');
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const clock=()=>{let s=start?Math.floor((Date.now()-start)/1000):0;return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};
const update=()=>{stats.textContent=`${matched}/${pairs} pairs · ${moves} turns · ${clock()}`};
function newGame(p=pairs){epoch++;pairs=p;flipped=[];matched=0;moves=0;start=null;locked=false;clearInterval(timer);timer=null;board.innerHTML='';
board.dataset.pairs=pairs;
board.style.gridTemplateColumns=pairs===8?'repeat(4,minmax(0,1fr))':'';
nextLevel.hidden=true;
shuffle([...icons.slice(0,pairs),...icons.slice(0,pairs)]).forEach((symbol,i)=>{const b=document.createElement('button');b.className='memory-card';b.type='button';b.dataset.symbol=symbol;b.dataset.position=i+1;b.setAttribute('aria-label',`Card ${i+1}, hidden`);b.setAttribute('aria-pressed','false');b.textContent='✦';b.addEventListener('click',()=>flip(b));board.append(b)});
status.textContent='Choose two cards to find a matching pair.';update();levelButtons.forEach(b=>{const selected=Number(b.dataset.pairs)===pairs;b.classList.toggle('is-active',selected);b.setAttribute('aria-pressed',String(selected))});}
function flip(b){if(locked||b.disabled||b.getAttribute('aria-pressed')==='true')return;if(!start){start=Date.now();timer=setInterval(update,1000)}
b.textContent=b.dataset.symbol;b.setAttribute('aria-pressed','true');b.setAttribute('aria-label',`Card ${b.dataset.position}, revealed ${b.dataset.symbol}`);flipped.push(b);
if(flipped.length!==2)return;moves++;update();const [a,c]=flipped;
if(a.dataset.symbol===c.dataset.symbol){a.disabled=c.disabled=true;a.classList.add('is-matched');c.classList.add('is-matched');matched++;flipped=[];update();if(matched===pairs){clearInterval(timer);nextLevel.hidden=pairs===icons.length;status.textContent=`Amazing! You matched all ${pairs} pairs in ${moves} turns. ${nextLevel.hidden?'Memory Champion! ':''}🌟`;(nextLevel.hidden?document.querySelector('#restart'):nextLevel).focus()}else{status.textContent='Great match! Keep going.';board.querySelector('button:not(:disabled)')?.focus()}}
else{locked=true;status.textContent='Not a match. Remember their places!';const current=epoch;setTimeout(()=>{if(epoch!==current)return;[a,c].forEach(x=>{x.textContent='✦';x.setAttribute('aria-pressed','false');x.setAttribute('aria-label',`Card ${x.dataset.position}, hidden`)});flipped=[];locked=false},850)}
}
levelButtons.forEach(b=>b.addEventListener('click',()=>newGame(Number(b.dataset.pairs))));document.querySelector('#restart').addEventListener('click',()=>newGame());
nextLevel.addEventListener('click',()=>{const next=levelButtons.find(b=>Number(b.dataset.pairs)>pairs);if(next){newGame(Number(next.dataset.pairs));board.firstElementChild.focus()}});
newGame();
})();
