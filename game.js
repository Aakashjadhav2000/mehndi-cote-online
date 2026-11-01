const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
const MAX_PLAYERS = [4, 6, 8];
const buildDeck = count => SUITS.flatMap(suit => RANKS.filter(rank => count === 4 || rank !== '2').map(rank => ({id:`${rank}${suit}`,rank,suit})));
const shuffled = cards => {
  const deck = [...cards];
  for(let i=deck.length-1;i>0;i--){const j=require('node:crypto').randomInt(i+1);[deck[i],deck[j]]=[deck[j],deck[i]];}
  return deck;
};
function legalCards(hand, leadSuit){
  if(!leadSuit) return hand;
  const following = hand.filter(c=>c.suit===leadSuit);
  return following.length ? following : hand;
}
function winningPlay(plays, trump){
  if(!plays.length) return null;
  const lead = plays[0].card.suit;
  const strength = card => (card.suit === trump ? 100 : card.suit === lead ? 50 : 0) + RANKS.indexOf(card.rank);
  return plays.reduce((best, next) => strength(next.card) > strength(best.card) ? next : best);
}
function winnerFor(score){
  if(score.tens[0]!==score.tens[1]) return score.tens[0]>score.tens[1]?0:1;
  if(score.tricks[0]!==score.tricks[1]) return score.tricks[0]>score.tricks[1]?0:1;
  return null; // rare exact tie; displayed as draw
}
function deal(count){
  if(!MAX_PLAYERS.includes(count)) throw Error('Player count must be 4, 6, or 8');
  const deck=shuffled(buildDeck(count));
  const hands=Array.from({length:count},()=>[]);
  const perPlayer = count === 4 ? 13 : count === 6 ? 8 : 6;
  for(let round=0;round<perPlayer;round++){
    for(let seat=0;seat<count;seat++) hands[seat].push(deck.pop());
  }
  return hands;
}
module.exports={SUITS,RANKS,MAX_PLAYERS,buildDeck,legalCards,winningPlay,winnerFor,deal};
