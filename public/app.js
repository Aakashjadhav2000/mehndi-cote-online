const socket=io({reconnection:true});
const $=id=>document.getElementById(id);let state=null;let toastHandle;
const SUITS={'♠':'Spades','♥':'Hearts','♦':'Diamonds','♣':'Clubs'};
const suitOrder={'♠':0,'♥':1,'♦':2,'♣':3};
function toast(msg){const el=$('toast');el.textContent=msg;el.hidden=false;clearTimeout(toastHandle);toastHandle=setTimeout(()=>el.hidden=true,3800)}
function labelSeat(s){return `Seat ${s+1} · Team ${s%2?'B':'A'}`}
function nameOf(s){return state?.players.find(p=>p.seat===s)?.name||`Seat ${s+1}`}
function text(id,value){$(id).textContent=value}
function show(id,yes){$(id).hidden=!yes}
function saveSession(code,token){localStorage.setItem('mehndi-session',JSON.stringify({code,token}));}
function restore(){try{return JSON.parse(localStorage.getItem('mehndi-session')||'null')}catch{return null}}
function clearSession(){localStorage.removeItem('mehndi-session')}
function cardEl(card,enabled=false,click=null){
 const b=document.createElement('button');b.className=`playing-card ${card.suit==='♥'||card.suit==='♦'?'red':''} ${enabled?'legal':''}`;
 const rank=document.createElement('span');rank.className='rank';rank.textContent=card.rank;
 const suit=document.createElement('span');suit.className='suit';suit.textContent=card.suit;
 b.append(rank,suit);b.title=`${card.rank} of ${SUITS[card.suit]}`;
 b.disabled=!enabled;if(enabled&&click)b.addEventListener('click',click);return b;
}
function render(){if(!state)return;
 show('welcome',false);show('game',true);
 text('roomCode',state.code);
 // score includes static / 4 tens in markup; update through dedicated text children
 for(const [id,i] of [['scoreA',0],['scoreB',1]]){$(id).replaceChildren(document.createTextNode(`${state.score.tens[i]} `));const em=document.createElement('i');em.textContent='/ 4 tens';$(id).appendChild(em)}
 text('tricksA',`${state.score.tricks[0]} tricks`);text('tricksB',`${state.score.tricks[1]} tricks`);
 text('phaseText',state.phase==='trump'?'PICK HUKUM':state.phase==='playing'?'IN PLAY':state.phase==='finished'?'FINISHED':'LOBBY');text('roundText',`Round ${state.round+1}`);
 show('lobby',state.phase==='lobby');show('playing',state.phase==='trump'||state.phase==='playing');show('finished',state.phase==='finished');
 if(state.phase==='lobby')renderLobby();else if(state.phase==='trump'||state.phase==='playing')renderGame();else if(state.phase==='finished')renderFinished();
}
function renderLobby(){const seats=$('seats');seats.replaceChildren();const used=new Map(state.players.map(p=>[p.seat,p]));
 for(let i=0;i<state.capacity;i++){
  const p=used.get(i),b=document.createElement('button');b.className=`seat ${i%2?'b':'a'} ${p?'occupied':''} ${i===state.me?'mine':''}`;
  const s=document.createElement('span');s.className='seat-label';s.textContent=labelSeat(i);
  const n=document.createElement('strong');n.textContent=p?`${p.name}${i===state.me?' (you)':''}`:'＋ Take seat';
  b.append(s,n);if(p&&!p.connected){const off=document.createElement('div');off.className='offline';off.textContent='Disconnected';b.append(off)}
  b.disabled=!!p;if(!p)b.addEventListener('click',()=>socket.emit('chooseSeat',i));seats.appendChild(b);
 }
 text('lobbyCount',`${state.players.length} / ${state.capacity} joined`);
 const isHost=state.me===state.host;const full=state.players.length===state.capacity;const connected=state.players.every(p=>p.connected);
 $('startBtn').disabled=!isHost||!full||!connected;
 text('lobbyHelp',isHost?full?'Everyone is here. Start when ready!':'Invite friends with the room link, then start when everyone has joined.':`Waiting for ${nameOf(state.host)} (host) to start.`);
 text('notice',`You are on Team ${state.me%2?'B':'A'} · ${labelSeat(state.me)}. Opposing teams alternate around the table.`);
}
function renderGame(){const picking=state.phase==='trump';const mine=state.selector===state.me;const myturn=state.phase==='playing'&&state.turn===state.me;
 text('hukumDisplay',state.trump?`${state.trump} ${SUITS[state.trump]}`:'Waiting…');text('turnDisplay',picking?`${nameOf(state.selector)} chooses`:`${nameOf(state.turn)}${myturn?' (you)':''}`);
 text('notice',picking?(mine?'Your turn: choose Hukum from your first five cards.':`${nameOf(state.selector)} is choosing Hukum. You can see your first five cards.`):myturn?'Your turn! Play any highlighted card. You must follow suit if possible.':`Waiting for ${nameOf(state.turn)} to play.`);
 const players=$('players');players.replaceChildren();for(let i=0;i<state.capacity;i++){
 const p=state.players.find(p=>p.seat===i);const div=document.createElement('div');div.className=`player-chip ${state.turn===i?'turn':''} ${state.me===i?'me':''} ${!p?.connected?'offline':''}`;div.textContent=`${i%2?'🟢':'🟡'} ${p?.name||'?'}${i===state.me?' (you)':''} · ${state.phase==='playing'&&state.turn===i?'● TURN':`${state.capacity===4?13:state.capacity===6?8:6}`}`;players.appendChild(div);
 }
 const cards=$('tableCards');cards.replaceChildren();for(const play of state.plays){const holder=document.createElement('div');holder.style.textAlign='center';holder.appendChild(cardEl(play.card));const label=document.createElement('div');label.style.fontSize='10px';label.style.marginTop='5px';label.textContent=nameOf(play.seat);holder.append(label);cards.append(holder)}
 text('tableMessage',state.plays.length?`Trick in progress · ${state.plays.length} / ${state.capacity} cards`:'Waiting for the next lead card');
 const hand=$('hand');hand.replaceChildren();const ordered=[...state.hand].sort((a,b)=>suitOrder[a.suit]-suitOrder[b.suit]||['2','3','4','5','6','7','8','9','10','J','Q','K','A'].indexOf(b.rank)-['2','3','4','5','6','7','8','9','10','J','Q','K','A'].indexOf(a.rank));
 for(const c of ordered){const allowed=myturn&&state.legal.includes(c.id);hand.appendChild(cardEl(c,allowed,()=>socket.emit('playCard',c.id)))}
 text('handTitle',`${state.hand.length} cards in hand`);text('handHint',picking?'First 5 cards · choose Hukum to continue':myturn?'Gold outlines = legal plays':'Cards become playable on your turn');
 show('trumpPicker',picking&&mine);if(state.lastTrick){const t=state.lastTrick;text('lastTrick',`Previous trick: ${nameOf(t.seat)} won for Team ${t.team?'B':'A'}${t.tens?` · collected ${t.tens} ten${t.tens>1?'s':''}`:''}`)}else text('lastTrick','');
}
function renderFinished(){const winner=state.winner;text('winnerTitle',winner===null?'It’s a draw!':`Team ${winner?'B':'A'} wins!`);
 text('winnerDetails',`Tens: Team A ${state.score.tens[0]} – Team B ${state.score.tens[1]} · Tricks: ${state.score.tricks[0]} – ${state.score.tricks[1]}. ${state.score.tens[0]===state.score.tens[1]?'Trick count was used to break the tie.':'The team with more 10s wins.'}`);
 const host=state.me===state.host;$('nextBtn').hidden=!host;text('notice',host?'Start another round when everyone is ready.':`Waiting for ${nameOf(state.host)} to start a new round.`);
}
function join(args){socket.emit('joinRoom',args)}
socket.on('connect',()=>{text('connection','● Connected');const saved=restore();if(saved)join(saved)});
socket.on('disconnect',()=>text('connection','● Reconnecting…'));
socket.on('joined',({code,token})=>{saveSession(code,token);const url=new URL(window.location.href);url.searchParams.set('room',code);history.replaceState(null,'',url);});
socket.on('state',s=>{state=s;render()});socket.on('errorMessage',msg=>{toast(msg);if(!state&&restore())clearSession()});
socket.on('left',()=>{clearSession();state=null;show('game',false);show('welcome',true);history.replaceState(null,'',location.pathname);});
$('createBtn').addEventListener('click',()=>socket.emit('createRoom',{name:$('createName').value,capacity:Number($('capacity').value)}));
$('joinBtn').addEventListener('click',()=>join({name:$('joinName').value,code:$('joinCode').value}));
$('startBtn').addEventListener('click',()=>socket.emit('startGame'));
$('nextBtn').addEventListener('click',()=>socket.emit('nextRound'));
$('leaveBtn').addEventListener('click',()=>{if(state?.phase==='lobby')socket.emit('leaveRoom');else toast('Close this tab to disconnect. Open the same link in this browser to reconnect.')});
$('copyBtn').addEventListener('click',async()=>{const url=new URL(location.href);url.searchParams.set('room',state.code);try{await navigator.clipboard.writeText(url.toString());toast('Invitation link copied!')}catch{toast(`Share room code: ${state.code}`)}});
document.querySelectorAll('[data-suit]').forEach(b=>b.addEventListener('click',()=>socket.emit('selectTrump',b.dataset.suit)));
const incoming=new URL(location.href).searchParams.get('room');if(incoming){$('joinCode').value=incoming.toUpperCase()}
