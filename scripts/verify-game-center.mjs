import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const dir = 'public/game-center/';
const raw = Array.from({length:8},(_,i)=>readFileSync(dir+'data/bank-part-'+String(i+1).padStart(2,'0')+'.txt','utf8')).join('\n');
const data=JSON.parse(raw);
assert.equal(data.questions.length,1091);
assert.equal(new Set(data.questions.map(q=>q.id)).size,1091);
assert.equal(new Set(data.questions.map(q=>q.subject)).size,7);
assert.equal(new Set(data.questions.map(q=>q.subject+'/'+q.chapter)).size,49);
for (const q of data.questions){
 assert.ok(q.question?.trim(),q.id+' empty question');
 assert.ok(q.subject,q.id+' missing subject');
 if(q.type==='family100'){assert.ok(q.answers?.length>=3,q.id+' insufficient answers');assert.equal(q.answers.reduce((s,a)=>s+a.points,0),100,q.id+' score weights');}
}
const html=readFileSync(dir+'index.html','utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'game script missing');
new Function(script);
