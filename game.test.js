const test=require('node:test');const assert=require('node:assert/strict');
const {buildDeck,legalCards,winningPlay,winnerFor,deal}=require('./game');
const c=(rank,suit)=>({id:rank+suit,rank,suit});
test('deck sizes and no 2s for larger tables',()=>{assert.equal(buildDeck(4).length,52);for(const n of [6,8]){const d=buildDeck(n);assert.equal(d.length,48);assert.equal(d.some(x=>x.rank==='2'),false)}});
test('deals unique cards evenly',()=>{for(const n of [4,6,8]){const hands=deal(n);assert.equal(hands.length,n);assert.ok(hands.every(h=>h.length===52/n||(n!==4&&h.length===48/n)));assert.equal(new Set(hands.flat().map(x=>x.id)).size,n*hands[0].length)}});
test('following suit is mandatory',()=>{const hand=[c('3','♣'),c('A','♥'),c('K','♦')];assert.deepEqual(legalCards(hand,'♣').map(x=>x.id),['3♣']);assert.equal(legalCards(hand,'♠').length,3)});
test('off-suit ace cannot win without trump',()=>{const plays=[{seat:0,card:c('2','♣')},{seat:1,card:c('A','♥')}];assert.equal(winningPlay(plays,'♠').seat,0)});
test('lower trump beats led suit and higher trump beats lower trump',()=>{const plays=[{seat:0,card:c('K','♣')},{seat:1,card:c('3','♥')},{seat:2,card:c('A','♥')}];assert.equal(winningPlay(plays,'♥').seat,2)});
test('tens decide winner, then tricks',()=>{assert.equal(winnerFor({tens:[3,1],tricks:[1,9]}),0);assert.equal(winnerFor({tens:[2,2],tricks:[3,4]}),1);assert.equal(winnerFor({tens:[2,2],tricks:[3,3]}),null)});
