/* Node standard library only: exercise actual bound controls; substitute browser/media boundaries. */
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const file=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const script=file.match(/<script>([\s\S]*?)<\/script>/)[1];
const ids=[...file.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
function receiver(initial,{throws=false,legacy,cases}={}){
 const events={}, elements={},store=new Map(),d={documentElement:{}};
 const node=(id,ds={})=>({id,dataset:ds,isConnected:true,attrs:{},textContent:'',innerHTML:'',value:'',paused:true,seeking:false,currentTime:0,readyState:4,duration:9,hidden:false,open:false,addEventListener(ev,fn){events[id+'.'+ev]=fn},focus(){d.activeElement=this},showModal(){this.open=true},close(){this.open=false},pause(){this.paused=true},scrollIntoView(){},setAttribute(k,v){this.attrs[k]=v},querySelector(sel){return sel[0]==='#'?elements[sel.slice(1)]||node(sel):node(sel)},closest(q){return q==='[data-do]'||q==='button'?this:null}});
 ids.forEach(i=>elements[i]=node(i));
 Object.assign(d,{getElementById:id=>elements[id],querySelector:()=>node('control'),querySelectorAll:()=>[],contains:el=>el.isConnected,addEventListener:(ev,fn)=>events[ev]=fn,activeElement:node('body')});
 if(initial!==undefined)store.set('merewick.teletext.v2',initial);
 if(legacy!==undefined)store.set('merewick.teletext.v1',legacy);
 if(cases!==undefined)store.set('merewick.teletext.cases.v1',cases);
 const context=vm.createContext({document:d,window:{},matchMedia:()=>({matches:false}),localStorage:{getItem:k=>{if(throws)throw Error('denied');return store.get(k)},setItem:(k,v)=>{if(throws)throw Error('denied');store.set(k,v)}}});
 vm.runInContext(script,context);
 const click=(action,value='',inside=false)=>{const el=node('control',{do:action,val:value});el.closest=q=>q==='dialog'?(inside?elements.modal:null):el;events.click({target:el})};
 const key=(k,tagName)=>events.keydown({key:k,target:{...node('body'),tagName},preventDefault(){}});
 const emit=(id,name)=>events[id+'.'+name]({target:elements[id]});
 const seek=t=>{elements.tapeSeek.value=t;emit('tapeSeek','input');if(elements.film.readyState>0)emit('film','seeked')};
 return {el:elements,click,key,seek,emit,type:keys=>[...keys].forEach(k=>key(k)),memory:()=>store.get('merewick.teletext.v2'),cases:()=>store.get('merewick.teletext.cases.v1'),get page(){return elements.pg.textContent},get markup(){return elements.page.innerHTML},get text(){return elements.notice.textContent},get progress(){return elements.progress.innerHTML},get lang(){return d.documentElement.lang},cancel:()=>events['modal.cancel']({preventDefault(){}}),run:src=>vm.runInContext(src,context)};
}
let t=receiver();
assert.equal(t.page,'P100');assert.match(t.markup,/Night service/);assert.match(t.markup,/Start investigation/);
t.type('793');assert.equal(t.page,'P100');assert.match(t.text,/No stable signal/);
t.type('2');assert.equal(t.el.digits.textContent,'2··');t.key('Backspace');assert.equal(t.el.digits.textContent,'100');
t.click('begin');assert.equal(t.page,'P214');t.click('physicalMode','tape');assert.match(t.markup,/Five residents waiting/);
t.click('mode','diff');t.click('isolate','0');assert.match(t.text,/No residue/);assert.match(t.progress,/0\/3/);
t.click('isolate','1');assert.match(t.text,/Hidden mark/);assert.doesNotMatch(t.text,/No residue/);t.click('isolate','1');assert.match(t.progress,/1\/3/);
const archiveMarkup=(()=>{t.click('mode','tape');return t.markup.match(/<div class="clueRows">[\s\S]*?<\/div>/)[0]})();
t.click('journal');t.type('326');assert.equal(t.page,'P214');assert.match(t.el.modalBody.innerHTML,/23:38/);t.cancel();assert.equal(t.el.modal.open,false);
t=receiver(t.memory());assert.match(t.progress,/1\/3/);assert.equal(t.page,'P214');assert.match(t.markup,/LIVE REPEAT/);
t.click('lang','cs');t.click('reset');t.click('close','',true);assert.equal(t.lang,'cs');assert.match(t.progress,/1\/3/);
t.click('go','100');assert.match(t.markup,/Pokračovat v pátrání/);t.click('begin');assert.equal(t.page,'P326');
assert.match(t.markup,/assets\/harbour-1979.mp4/);assert.doesNotMatch(t.markup,/<video[^>]+autoplay/);
t.key('2','INPUT');assert.equal(t.el.digits.textContent,'326');
t.click('capture','1');assert.match(t.text,/Záběr není použitelný/);
t.seek(6.2);t.el.film.paused=false;
t.click('capture','1');assert.match(t.progress,/1\/3/);t.click('freeze');
t.el.film.seeking=true;t.click('capture','1');assert.match(t.progress,/1\/3/);t.el.film.seeking=false;
t.seek(7.2);t.click('capture','1');assert.match(t.progress,/1\/3/);
t.seek(6.2);t.click('capture','0');assert.match(t.progress,/1\/3/);
t.el.film.seeking=true;t.click('capture','1');assert.match(t.text,/Načítám vybraný záběr/);assert.match(t.progress,/1\/3/);
t.el.film.seeking=false;t.emit('film','seeked');assert.match(t.progress,/2\/3/);t.click('capture','1');assert.match(t.progress,/2\/3/);
const queued=receiver();queued.type('326');queued.seek(6.2);queued.el.film.seeking=true;queued.click('capture','1');assert.match(queued.text,/Loading the selected frame/);
queued.el.film.seeking=false;queued.seek(7.5);queued.emit('film','canplay');assert.match(queued.progress,/0\/3/);
t.type('418');t.click('align');assert.match(t.text,/Bez signálu/);assert.match(t.progress,/2\/3/);
t.key('r');t.click('mapMove','left');t.key('ArrowDown');
assert.match(t.markup,/Lights|Světla/);assert.match(t.markup,/90° \/ X-1 \/ Y\+1/);
t=receiver(t.memory());assert.match(t.markup,/90° \/ X-1 \/ Y\+1/);t.click('align');assert.match(t.progress,/3\/3/);
const combinations=t.run("JSON.stringify(Array.from({length:4},(_,turn)=>[-2,-1,0,1,2].flatMap(x=>[-2,-1,0,1,2].filter(y=>aligned({turn,x,y})).map(y=>[turn,x,y]))).flat())");
assert.equal(combinations,'[[1,-1,1]]');
t.type('500');assert.deepEqual([...t.markup.matchAll(/<time>([^<]+)<\/time>/g)].map(m=>m[1]),['23:38','23:42','23:46']);t.click('journal');assert.deepEqual([...t.el.modalBody.innerHTML.matchAll(/<time>([^<]+)<\/time>/g)].map(m=>m[1]),['23:38','23:46','23:42']);t.cancel();assert.equal((t.markup.match(/class="glyphBox"/g)||[]).length,10);
t.type('739');assert.equal(t.page,'P500');t.type('793');assert.equal(t.page,'P793');t.click('report','0');assert.match(t.text,/Text odmítnut/);assert.match(t.markup,/Která oprava/);
t.click('report','1');assert.match(t.markup,/Cross-check the packet|Ověřte paket/);assert.doesNotMatch(t.markup,/Všichni na palubě/);
t=receiver(t.memory());assert.match(t.markup,/Cross-check the packet|Ověřte paket/);
t.click('redraft');assert.match(t.markup,/Která oprava/);t.click('report','1');
// verify: publish before verification must not advance
t.click('publish');assert.doesNotMatch(t.markup,/Všichni na palubě/);
// complete verification then publish
t.click('pickSlot','B');t.click('pickSlot','C');t.click('pickChannel','EO-7');
t.click('publish');assert.match(t.markup,/Všichni na palubě/);
t=receiver(t.memory());assert.match(t.markup,/Všichni na palubě/);t.type('214');assert.match(t.markup,/OPRAVA:/);
t.click('lang','en');assert.match(t.markup,/CORRECTION: Ferry returned/);t.click('mode','tape');assert.equal(t.markup.match(/<div class="clueRows">[\s\S]*?<\/div>/)[0],archiveMarkup);
t.click('reset');t.click('confirmReset','',true);assert.equal(t.page,'P100');assert.match(t.progress,/0\/3/);assert.equal(t.lang,'en');t.type('793');assert.equal(t.page,'P100');
for(const raw of ['{','null','123','{"lang":"xx","page":"793","won":true,"found":["214","214","bogus"]}']){let r=receiver(raw);assert.equal(r.page,'P100');assert.equal(r.lang,'en');assert.doesNotMatch(r.markup,/All aboard/)}
let r=receiver(undefined,{throws:true});r.type('326');r.el.film.readyState=0;r.emit('film','error');r.seek(6.2);r.click('capture','1');assert.match(r.progress,/1\/3/);
let legacy=receiver(undefined,{legacy:'{"lang":"cs","found":["214","326","418"],"won":true}'});assert.equal(legacy.lang,'cs');assert.match(legacy.progress,/0\/3/);assert.equal(legacy.page,'P100');
assert(!/\b(?:fetch\s*\(|new XMLHttpRequest|WebSocket\s*\(|@import\s+)/.test(script));
console.log('PASS: fresh start/continue, changed row, actual frame gating and transcript fallback, unique map solution, dual controls, browser storage, newsroom draft and publication, unchanged archive, EN/CS, early guess, modal, reset.');


// v0.3: Three distinct station puzzles use actual controls and cannot affect each other's saves.
let a=receiver();
assert.match(a.markup,/Case library \/ four transmissions/);
for(const name of ['Harbour Blackout','The last train','The ghost forecast','The lighthouse signal'])assert(a.markup.includes(name));
a.click('begin');a.click('mode','diff');a.click('isolate','1');assert.match(a.progress,/1\/3/);
a.type('611');assert.equal(a.page,'P611');assert.match(a.markup,/Identify the survivor service/);
a.click('editionPublish');assert.doesNotMatch(a.markup,/CORRECTION \/ R8/);
for(const train of ['r2','r6','r9']){a.click('trainPick',train);assert.match(a.progress,/0\/2/)}
a.click('hint');assert.match(a.el.modalBody.innerHTML,/arrival cutoff/);a.click('moreHint','',true);assert.match(a.el.modalBody.innerHTML,/R8/);a.cancel();
a.click('physicalMode','tape');
const railArchive=a.markup.match(/<div class="stationLine original">.*?<\/div>/)[0];
a.click('trainPick','r8');assert.match(a.progress,/1\/2/);
for(const stop of ['depot','shelter','cut'])a.click('trainRoute',stop);
a.click('trainLock');assert.match(a.progress,/1\/2/);
a.click('trainClear');a.click('trainRoute','cut');
a=receiver(a.memory(),{cases:a.cases()});assert.equal(a.page,'P611');assert.match(a.markup,/Selected route">East cutting/);
for(const stop of ['depot','shelter'])a.click('trainRoute',stop);
a.click('trainLock');assert.match(a.progress,/2\/2/);assert.match(a.markup,/Verified draft/);
a.click('mode','live');assert.match(a.markup,/R2 departed empty/);assert.doesNotMatch(a.markup,/stationLine corrected/);
a.click('editionPublish');assert.match(a.markup,/stationLine corrected[^]*R8 diverted east/);assert.match(a.markup,/seventh ticket/);
a.click('physicalMode','tape');assert.equal(a.markup.match(/<div class="stationLine original">.*?<\/div>/)[0],railArchive);

a.type('672');assert.match(a.progress,/0\/2/);a.click('vaneLock');assert.match(a.progress,/0\/2/);a.key('ArrowLeft');a.click('vane','-1');a.click('vaneLock');
assert.match(a.progress,/1\/2/);a.click('safety','site-west');a.click('safety','until-0020');a.click('safetyLock');assert.match(a.progress,/1\/2/);
a.click('safety','site-east');a.click('safety','until-0010');a.click('safetyLock');assert.match(a.progress,/1\/2/);
a.click('safety','until-0020');a.click('safetyLock');assert.match(a.markup,/Verified draft/);
a.type('747');a.click('flashDecode','L');assert.match(a.progress,/0\/2/);assert.match(a.text,/Review all four/);
a.key('ArrowRight');a.click('frame','1');a.click('frame','1');a.click('flashDecode','F');assert.match(a.progress,/0\/2/);
a.click('lang','cs');assert.match(a.markup,/Signál z majáku/);a.click('flashDecode','L');assert.match(a.progress,/1\/2/);
for(const x of 'SLS')a.click('flashPulse',x);
a.click('flashLock');assert.match(a.progress,/1\/2/);a.click('flashClear');
for(const x of 'LSL')a.click('flashPulse',x);a.click('flashLock');assert.match(a.progress,/2\/2/);a.click('editionPublish');
assert.match(a.markup,/Prsten vrácen/);
a.click('reset');a.click('close','',true);assert.match(a.markup,/Prsten vrácen/);
a.click('reset');a.click('confirmReset','',true);assert.equal(a.page,'P747');assert.match(a.progress,/0\/2/);
a.type('672');assert.match(a.markup,/Ověřený koncept/);a.click('editionPublish');assert.match(a.markup,/Dvacet lidí v autobuse/);
a.type('611');assert.match(a.markup,/sedmou jízdenku/);
a.type('214');assert.match(a.progress,/1\/3/);a.click('reset');a.click('confirmReset','',true);assert.equal(a.page,'P100');assert.match(a.progress,/0\/3/);
a.type('611');assert.match(a.markup,/sedmou jízdenku/);a.type('672');assert.match(a.markup,/Dvacet lidí v autobuse/);
a.type('747');assert.match(a.progress,/0\/2/);
a=receiver(a.memory(),{cases:'{"611":{"stage":3,"published":true,"route":["constructor"]},"672":{"stage":0,"vane":99},"747":{"frame":99,"seen":[0,0,5]}}'});
a.type('611');assert.match(a.progress,/0\/2/);a.type('672');assert.match(a.markup,/Směr: J/);a.type('747');assert.match(a.markup,/SNÍMEK 1\/4/);
console.log('PASS: v0.3 train/forecast/light puzzles, invalid routes and false edits, frame gating, draft isolation, each archive, bilingual hints, case switching/storage/replay, preservation of v0.2 harbour.');

// === v0.4 Task 1: Pure packet-logic property tests ===

// Property 4 (Task 1.1): Exactly one ordered pair from {A,B,C} passes verifySlots
{
  const pairResults = t.run(
    "JSON.stringify(['A','B','C'].flatMap(a=>['A','B','C'].filter(b=>b!==a).map(b=>[a,b,verifySlots(a,b).valid])))"
  );
  const pairs = JSON.parse(pairResults);
  const passing = pairs.filter(([,,ok])=>ok);
  assert.equal(passing.length,1,'Exactly one ordered pair must pass verifySlots');
  assert.deepEqual(passing[0].slice(0,2),['B','C'],'The passing pair must be B then C');
}

// Property 5 (Task 1.2): packetChecksum is deterministic (same inputs → same output, twice)
{
  const r1 = t.run("packetChecksum('Departure time: 23:28','Departure quay: West Quay','Passenger count: 12')");
  const r2 = t.run("packetChecksum('Departure time: 23:28','Departure quay: West Quay','Passenger count: 12')");
  assert.equal(typeof r1,'number','packetChecksum must return a number');
  assert.equal(r1,r2,'packetChecksum must return the same value on repeated calls');
  // Also verify archive and receiver produce different combined checksums (tamper is detectable)
  const archiveSum = t.run("packetChecksum('Departure time: 23:28','Departure quay: East Steps','Passenger count: 5')");
  assert.notEqual(r1,archiveSum,'Archive and receiver combined checksums must differ');
}

// identifyTamperedFields: must return ['B','C'] for the fixed game content
{
  const result = t.run(
    "JSON.stringify(identifyTamperedFields({A:'Departure time: 23:28',B:'Departure quay: West Quay',C:'Passenger count: 12'},{A:'Departure time: 23:28',B:'Departure quay: East Steps',C:'Passenger count: 5'}))"
  );
  assert.deepEqual(JSON.parse(result),['B','C'],'identifyTamperedFields must return [B,C] for the game content');
}

// verifyChannel: EO-7 passes, SR-2 fails
{
  const eo7 = t.run("verifyChannel('EO-7')");
  const sr2 = t.run("verifyChannel('SR-2')");
  assert.equal(eo7,true,'EO-7 must pass verifyChannel');
  assert.equal(sr2,false,'SR-2 must fail verifyChannel');
}

console.log('PASS: v0.4 Task 1 — pure packet-logic functions: verifySlots uniqueness (Property 4), packetChecksum determinism (Property 5), identifyTamperedFields correctness, verifyChannel.');

// === v0.4 Tasks 2–10: Full verification workflow tests ===

// Helper: advance a fresh receiver to draft state (all 3 evidence marks + report)
function toDraft(){
  const v=receiver();
  v.click('begin');
  v.click('mode','diff');v.click('isolate','1');       // P214 mark
  v.type('326');
  v.seek(6.2);v.el.film.seeking=true;v.click('capture','1');  // queue pending capture on P326
  v.el.film.seeking=false;v.emit('film','seeked');     // P326 mark logged
  v.type('418');v.key('r');v.click('mapMove','left');v.key('ArrowDown');v.click('align'); // P418 mark
  v.type('793');v.click('report','1');
  return v;
}

// Test 1: publish before verification does not advance
{
  const v=toDraft();
  assert.match(v.markup,/Cross-check the packet|Ověřte paket/,'Should show verification page after report');
  v.click('publish');
  assert.doesNotMatch(v.markup,/All aboard|Všichni na palubě/,'Publish before verification must not win');
  assert.ok(!JSON.parse(v.memory()||'{}').won,'State must not record won before verification');
}

// Test 2: swapped-field pair rejected with reason about order
{
  const v=toDraft();
  v.click('pickSlot','C');v.click('pickSlot','B');
  assert.match(v.text,/order|pořadí/i,'Swapped pair should mention order');
  assert.doesNotMatch(v.markup,/EO-7/,'Channel selection must not appear after swap rejection');
  // slots should be cleared — no button with pickSlot and aria-pressed=true
  assert.doesNotMatch(v.markup,/data-do="pickSlot"[^>]*aria-pressed="true"/,'No slot button should be pressed after rejection');
}

// Test 3: wrong-field pair (A + something) rejected
{
  const v=toDraft();
  v.click('pickSlot','A');v.click('pickSlot','C');
  assert.match(v.text,/field|pole/i,'Wrong-field pair should mention field');
  assert.doesNotMatch(v.markup,/EO-7/,'Channel selection must not appear after field rejection');
}

// Test 4: full correct flow → Verified draft → publish → All aboard
{
  const v=toDraft();
  v.click('pickSlot','B');v.click('pickSlot','C');
  assert.match(v.markup,/EO-7/,'Channel selection must appear after correct slots');
  v.click('pickChannel','SR-2');
  assert.doesNotMatch(v.markup,/Verified draft|Ověřený koncept/,'Wrong channel must not complete verification');
  v.click('pickChannel','EO-7');
  assert.match(v.markup,/Verified draft|Ověřený koncept/,'Correct channel should complete verification');
  v.click('publish');
  assert.match(v.markup,/All aboard|Všichni na palubě/,'Publish after verification should show ending');
}

// Test 5: partial slot progress survives reload
{
  const v=toDraft();
  v.click('pickSlot','B');
  const mem=v.memory();
  assert.ok(mem&&mem.includes('"B"'),'Slot B must be in persisted memory');
  const v2=receiver(mem);
  v2.type('793');
  assert.match(v2.markup,/Slot 1.*B|>B</,'Slot 1 B must survive reload');
}

// Test 6: old completed save (won:true) → shows All aboard without re-verification
{
  const oldSave=JSON.stringify({lang:'en',page:'793',found:['214','326','418'],won:true,draft:false,started:true});
  const v=receiver(oldSave);
  v.type('793');
  assert.match(v.markup,/All aboard/,'Old won:true save must show All aboard without verification');
}

// Test 7: Cases_State unchanged after full Harbour verification+publish
{
  const v=toDraft();
  v.click('pickSlot','B');v.click('pickSlot','C');v.click('pickChannel','EO-7');v.click('publish');
  assert.equal(v.cases(),undefined,'Cases_State must be untouched after Harbour verification+publish');
}

// Test 8: uniqueness proof — exactly one ordered pair passes verifySlots
{
  const v=toDraft();
  const pairResults=v.run(
    "JSON.stringify(['A','B','C'].flatMap(a=>['A','B','C'].filter(b=>b!==a).map(b=>[a,b,verifySlots(a,b).valid])))"
  );
  const pairs=JSON.parse(pairResults);
  const passing=pairs.filter(([,,ok])=>ok);
  assert.equal(passing.length,1,'Exactly one ordered pair must pass verifySlots');
  assert.deepEqual(passing[0].slice(0,2),['B','C'],'The passing pair must be B then C');
}

// Test: language switch preserves slots (Property 8)
{
  const v=toDraft();
  v.click('pickSlot','B');
  v.click('lang','cs');
  assert.match(v.markup,/Ověřte paket/,'CS language must show Czech title');
  assert.match(v.markup,/Slot 1.*B|>B</,'Slot B must survive language switch');
}

// Test: verifyReset clears slots and channel
{
  const v=toDraft();
  v.click('pickSlot','B');v.click('pickSlot','C');
  assert.match(v.markup,/EO-7/,'Channel must appear after valid slots');
  v.click('verifyReset');
  assert.doesNotMatch(v.markup,/EO-7/,'Channel must disappear after verifyReset');
  assert.match(v.text,/Slots cleared|Sloty vymazány/i,'Should confirm slots cleared');
}

// Test: archive P214 feed is unmodified after publication (Property 6)
{
  const v=toDraft();
  v.click('pickSlot','B');v.click('pickSlot','C');v.click('pickChannel','EO-7');v.click('publish');
  v.type('214');v.click('mode','tape');
  const archiveAfter=v.markup.match(/<div class="clueRows">[\s\S]*?<\/div>/)?.[0]||'';
  assert.ok(archiveAfter.includes('Five residents waiting'),'Archive must still contain original tape text after publication');
}

console.log('PASS: v0.4 emergency-broadcast-verification — publish gate, verification workflow, B→C ordering, channel selection, slot persistence, legacy save compat, cases isolation, pair uniqueness, language switch, reset, archive immutability.');

// v0.4.1: regressions at the shipped controls. Returning to review is not a
// publishing shortcut, and an early/remembered seek works without autoplay.
{
  const v=toDraft();
  for(const k of ['B','C'])v.click('pickSlot',k);
  v.click('pickChannel','EO-7');
  v.click('redraft');
  v.click('report','1');
  assert.match(v.markup,/Cross-check the packet/,'Returning to review clears the old verification');
  assert.doesNotMatch(v.markup,/data-do="publish"/);
}
{
  let v=receiver();
  v.type('326');v.el.film.readyState=0;v.seek(6.2);v.click('capture','1');
  assert.match(v.text,/Loading the selected frame/,'Do not discard a scrub chosen before metadata loads');
  assert.match(v.progress,/0\/3/);
  v.el.film.readyState=1;v.emit('film','loadedmetadata');assert.equal(v.el.film.currentTime,6.2);
  v.el.film.readyState=4;v.emit('film','seeked');assert.match(v.progress,/1\/3/);
}
{
  let v=receiver();
  v.type('326');v.click('transcript');v.seek(6.2);
  v=receiver(v.memory());assert.equal(v.page,'P326');assert.match(v.markup,/id="tapeSeek" value="6\.2"/);
  assert.doesNotMatch(v.markup,/<div id="staticTranscript" class="timedText" hidden/);
  assert.match(v.progress,/0\/3/);v.click('capture','1');assert.match(v.progress,/1\/3/);
}
{
  const v=toDraft();
  const stamps=x=>[...x.matchAll(/class="parityCode"[^>]*>(0x[0-9A-F]{2})</g)].map(m=>m[1]);
  const codes=stamps(v.markup);
  assert.equal(codes.length,6,'Both feeds need a readable parity code');
  assert.equal(codes[0],codes[3]);assert.notEqual(codes[1],codes[4]);assert.notEqual(codes[2],codes[5]);
  v.click('lang','cs');assert.deepEqual(stamps(v.markup),codes,'Packet identity is independent of UI language');
}
console.log('PASS: v0.4.1 review reset, pre-metadata seek, persisted tape position/transcript, matching parity strips in both languages.');
