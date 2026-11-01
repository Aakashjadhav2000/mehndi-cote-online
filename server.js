const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const crypto = require('node:crypto');
const path = require('node:path');
const {SUITS,MAX_PLAYERS,legalCards,winningPlay,winnerFor,deal} = require('./game');
const app = express(); const server=http.createServer(app); const io=new Server(server,{maxHttpBufferSize:15000});
app.use(express.static(path.join(__dirname,'public')));
app.get('/health',(_req,res)=>res.json({ok:true}));
const rooms=new Map();
const getCode=()=>{let c;do{c=crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase()}while(rooms.has(c));return c};
const err=(socket,message)=>socket.emit('errorMessage',message);
const cleanName=name=>String(name||'').trim().replace(/\s+/g,' ').slice(0,22);
function session(socket){const info=socket.data;const room=rooms.get(info.code);if(!room)return null;const player=room.players.find(p=>p.token===info.token);return player?{room,player}:null}
function publicState(room,player){
  const seat=player.seat;
  const hand=room.hands?.[seat]||[];
  const phase=room.phase;
  const visible=phase==='trump' ? hand.slice(0,5) : hand;
  const lead=room.plays[0]?.card.suit;
  const legal=phase==='playing' && room.turn===seat?legalCards(hand,lead).map(c=>c.id):[];
  return {code:room.code,capacity:room.capacity,phase,host:room.host,me:seat,
    players:room.players.map(p=>({name:p.name,seat:p.seat,connected:p.connected})),
    hand:visible,legal,turn:room.turn,selector:room.selector,dealer:room.dealer,
    trump:room.trump,plays:room.plays,score:room.score,lastTrick:room.lastTrick,
    round:room.round,winner:room.winner,finishedReason:room.finishedReason};
}
function publish(room){for(const p of room.players){if(p.socketId)io.to(p.socketId).emit('state',publicState(room,p))}}
function resetRound(room){
  room.dealer = room.round===0?crypto.randomInt(room.capacity):(room.dealer+1)%room.capacity;
  room.selector=(room.dealer+1)%room.capacity;
  room.hands=deal(room.capacity);
  room.plays=[];room.lastTrick=null;room.score={tens:[0,0],tricks:[0,0]};room.trump=null;
  room.turn=room.selector;room.winner=null;room.finishedReason=null;room.phase='trump';
}
function attach(socket,room,player){
  if(player.socketId && player.socketId!==socket.id){const old=io.sockets.sockets.get(player.socketId);if(old){old.data={};old.disconnect(true)}}
  socket.data={code:room.code,token:player.token};player.socketId=socket.id;player.connected=true;
  socket.join(room.code);socket.emit('joined',{code:room.code,token:player.token});publish(room);
}
io.on('connection',socket=>{
  socket.on('createRoom',(args={},ack)=>{
    if(session(socket))return err(socket,'You are already in a room. Leave first.');
    const name=cleanName(args.name),capacity=Number(args.capacity);
    if(!name||!MAX_PLAYERS.includes(capacity))return err(socket,'Choose your name and 4, 6 or 8 players.');
    const code=getCode(),token=crypto.randomBytes(18).toString('hex');
    const room={code,capacity,host:0,players:[],phase:'lobby',round:0,plays:[],hands:null,score:{tens:[0,0],tricks:[0,0]},lastTrick:null,turn:null,selector:null,dealer:null,trump:null,winner:null,finishedReason:null,createdAt:Date.now()};
    const player={name,seat:0,token,connected:true,socketId:socket.id};room.players.push(player);rooms.set(code,room);attach(socket,room,player);if(typeof ack==='function')ack({ok:true,code,token});
  });
  socket.on('joinRoom',(args={},ack)=>{
    if(session(socket))return err(socket,'Leave your existing room first.');
    const code=String(args.code||'').trim().toUpperCase(),room=rooms.get(code),name=cleanName(args.name),token=String(args.token||'');
    if(!room)return err(socket,'Room not found. Check your code.');
    const returning=room.players.find(p=>p.token===token);
    if(returning){attach(socket,room,returning);if(typeof ack==='function')ack({ok:true,code,token});return}
    if(room.phase!=='lobby')return err(socket,'This game has started. Only existing players can reconnect.');
    if(!name)return err(socket,'Enter a display name.');
    if(room.players.length>=room.capacity)return err(socket,'Room is full.');
    const occupied=new Set(room.players.map(p=>p.seat));const seat=Array.from({length:room.capacity},(_,i)=>i).find(i=>!occupied.has(i));
    const newToken=crypto.randomBytes(18).toString('hex');const p={name,seat,token:newToken,connected:true,socketId:socket.id};room.players.push(p);attach(socket,room,p);if(typeof ack==='function')ack({ok:true,code,token:newToken});
  });
  socket.on('chooseSeat',seat=>{const s=session(socket);if(!s)return;const {room,player}=s;
    if(room.phase!=='lobby')return err(socket,'Seats cannot change after the game starts.');
    seat=Number(seat);if(!Number.isInteger(seat)||seat<0||seat>=room.capacity)return;
    if(room.players.some(p=>p.seat===seat))return err(socket,'That seat is occupied.');
    const wasHost=room.host===player.seat;player.seat=seat;if(wasHost)room.host=seat;publish(room);
  });
  socket.on('startGame',()=>{const s=session(socket);if(!s)return;const {room,player}=s;
    if(room.phase!=='lobby')return err(socket,'Game already started.');
    if(room.host!==player.seat)return err(socket,'Only the host can start.');
    if(room.players.length!==room.capacity)return err(socket,`Wait for all ${room.capacity} players.`);
    if(room.players.some(p=>!p.connected))return err(socket,'All players must be connected.');
    resetRound(room);publish(room);
  });
  socket.on('selectTrump',suit=>{const s=session(socket);if(!s)return;const {room,player}=s;
    if(room.phase!=='trump'||room.selector!==player.seat)return err(socket,'Not your turn to select Hukum.');
    if(!SUITS.includes(suit))return err(socket,'Invalid suit.');
    room.trump=suit;room.phase='playing';room.turn=room.selector;publish(room);
  });
  socket.on('playCard',cardId=>{const s=session(socket);if(!s)return;const {room,player}=s;
    if(room.phase!=='playing'||room.turn!==player.seat)return err(socket,'Wait for your turn.');
    const hand=room.hands[player.seat];const card=hand.find(c=>c.id===cardId);
    if(!card)return err(socket,'That card is not in your hand.');
    const allowed=legalCards(hand,room.plays[0]?.card.suit);
    if(!allowed.some(c=>c.id===card.id))return err(socket,'You must follow the leading suit.');
    hand.splice(hand.indexOf(card),1);room.plays.push({seat:player.seat,card});
    if(room.plays.length===room.capacity){
      const winning=winningPlay(room.plays,room.trump),team=winning.seat%2;
      const tens=room.plays.filter(p=>p.card.rank==='10').length;
      room.score.tens[team]+=tens;room.score.tricks[team]++;
      room.lastTrick={plays:room.plays.map(p=>({...p})),seat:winning.seat,team,tens};
      room.plays=[];room.turn=winning.seat;
      if(room.score.tens[0]+room.score.tens[1]===4||room.hands.every(h=>h.length===0)){
        room.phase='finished';room.winner=winnerFor(room.score);room.finishedReason='All four 10s have been captured.';
      }
    }else room.turn=(room.turn+1)%room.capacity;
    publish(room);
  });
  socket.on('nextRound',()=>{const s=session(socket);if(!s)return;const {room,player}=s;
    if(room.phase!=='finished')return err(socket,'This round is not finished.');
    if(room.host!==player.seat)return err(socket,'Only the host can start another round.');
    room.round++;resetRound(room);publish(room);
  });
  socket.on('leaveRoom',()=>{
    const s=session(socket);if(!s)return;const {room,player}=s;
    if(room.phase!=='lobby')return err(socket,'During a game, close this tab to disconnect and reconnect using your link.');
    room.players=room.players.filter(p=>p.token!==player.token);
    socket.leave(room.code);socket.data={};socket.emit('left');
    if(!room.players.length)rooms.delete(room.code);else{if(room.host===player.seat)room.host=room.players[0].seat;publish(room)}
  });
  socket.on('disconnect',()=>{const s=session(socket);if(!s)return;const {room,player}=s;
    if(player.socketId!==socket.id)return;
    player.connected=false;player.socketId=null;publish(room);
  });
});
setInterval(()=>{for(const [code,room] of rooms){if(room.players.every(p=>!p.connected)&&Date.now()-room.createdAt>24*60*60*1000)rooms.delete(code)}},60*60*1000).unref();
const port=process.env.PORT||3000;
if(require.main===module)server.listen(port,()=>console.log(`Mehndi Cote running on http://localhost:${port}`));
module.exports={app,server,rooms};
