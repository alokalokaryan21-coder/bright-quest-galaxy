(()=>{if(!document.querySelector('#maze'))return;
const levels=[[
'#########','#S..#...#','#.#.#.#.#','#.#...#.#','#.#####.#','#.......#','###.###.#','#.....G.#','#########'],[
'#########','#S......#','#####.#.#','#.....#.#','#.#####.#','#.#.....#','#.#.###.#','#...#..G#','#########'],[
'###########','#S..#.....#','###.#####.#','#.#.......#','#.#######.#','#.#.....#.#','#.#.#.###.#','#.#.#.....#','#.#.#######','#........G#','###########'],[
'#############','#S..#.......#','###.#####.###','#.#.#...#...#','#.#.#.#.###.#','#.#.#.#...#.#','#.#.#.###.#.#','#...#...#...#','#.#####.###.#','#.#...#...#.#','#.#.#.###.#.#','#...#.....#G#','#############']];
let level=0,pos=[1,1],moves=0,finished=false;
const nextLevel=document.querySelector('#next-level');
const maze=document.querySelector('#maze'),status=document.querySelector('#game-status'),stats=document.querySelector('#stats');
function paint(){const grid=levels[level];maze.dataset.size=grid.length;maze.style.gridTemplateColumns=`repeat(${grid[0].length},minmax(0,1fr))`;maze.innerHTML='';grid.forEach((row,r)=>[...row].forEach((ch,c)=>{const cell=document.createElement('div');cell.className='maze-cell';const here=pos[0]===r&&pos[1]===c;if(ch==='#')cell.classList.add('wall');if(ch==='G')cell.classList.add('goal');if(here)cell.classList.add('robot');cell.textContent=here?'🤖':ch==='G'?'🏁':'';maze.append(cell)}));stats.textContent=`Moves: ${moves} · Maze ${level+1} of ${levels.length}`}
function start(l=level){level=l;const grid=levels[level];let row=grid.findIndex(x=>x.includes('S'));pos=[row,grid[row].indexOf('S')];moves=0;finished=false;nextLevel.hidden=true;[...document.querySelectorAll('[data-maze]')].forEach(b=>{const selected=Number(b.dataset.maze)===level;b.classList.toggle('is-active',selected);b.setAttribute('aria-pressed',String(selected))});status.textContent='Guide the robot to the finish flag. Use arrow keys or the buttons.';paint()}
function move(dx,dy){if(finished)return;const[r,c]=pos,nr=r+dx,nc=c+dy;const ch=levels[level][nr]?.[nc];if(!ch||ch==='#'){status.textContent='Oops! That is a wall. Try another way.';return}pos=[nr,nc];moves++;if(ch==='G'){finished=true;nextLevel.hidden=level===levels.length-1;status.textContent=`Rescue complete in ${moves} moves! ${nextLevel.hidden?'Maze Champion! ':''}🎉`;(nextLevel.hidden?document.querySelector('#restart'):nextLevel).focus()}else status.textContent='Keep going. You are doing great!';paint()}
const map={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1],w:[-1,0],s:[1,0],a:[0,-1],d:[0,1]};
document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select'))return;const d=map[e.key];if(d){e.preventDefault();move(...d)}});
[...document.querySelectorAll('[data-direction]')].forEach(b=>b.addEventListener('click',()=>move(...map[b.dataset.direction])));
[...document.querySelectorAll('[data-maze]')].forEach(b=>b.addEventListener('click',()=>start(Number(b.dataset.maze))));document.querySelector('#restart').addEventListener('click',()=>start());nextLevel.addEventListener('click',()=>{if(finished&&level<levels.length-1){start(level+1);maze.focus()}});start();
})();
