import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {validateFeedback} from "../lib/feedback";
import {LocalFeedbackStorage,RedisFeedbackStorage} from "../lib/feedback-storage";
const input=()=>({id:randomUUID(),category:"Bug",area:"Trade",title:"Chart interaction",description:"Steps: choose a pair and move the chart to the left.",contact:""});
test("feedback validates bounded allowlisted fields; drops private/unknown context",()=>{const v=validateFeedback({...input(),wallet:"secret",positions:[1],context:{apiKey:"secret"}});assert.deepEqual(Object.keys(v).sort(),["area","category","contact","description","id","title"]);assert.throws(()=>validateFeedback({...input(),description:"short"}));assert.throws(()=>validateFeedback({...input(),website:"spam"}));assert.throws(()=>validateFeedback({...input(),category:"invalid"}));assert.throws(()=>validateFeedback({...input(),title:"x".repeat(101)}));});
test("local inbox persists, retries are idempotent, conflicting retries fail and rate limit survives restart",async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),"twun-feedback-test-"));try{const file=path.join(dir,"inbox.json"),store=new LocalFeedbackStorage(file),v=validateFeedback(input());const receipt=await store.save(v,"client");assert.equal(receipt.status,"Received");assert.deepEqual(await store.save(v,"client"),receipt);await assert.rejects(()=>store.save({...v,title:"Different ticket"},"client"),/already used/);
  await Promise.all(Array.from({length:4},()=>store.save(validateFeedback(input()),"client")));const restart=new LocalFeedbackStorage(file);assert.equal((await restart.list()).length,5);await assert.rejects(()=>restart.save(validateFeedback(input()),"client"),/limit/);await restart.save(validateFeedback(input()),"another-client");assert.equal((await restart.list()).length,6);
  await writeFile(file,"invalid journal");await assert.rejects(()=>restart.save(validateFeedback(input()),"new"));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test("Redis inbox uses atomic save with a separate hash slot, handles limits and provider errors",async()=>{
 let command:any[]=[];const fake:typeof fetch=async(_url,init)=>{command=JSON.parse(init?.body as string);return new Response(JSON.stringify({result:command[0]==="EVAL"?command[7]:[]}));};const store=new RedisFeedbackStorage("https://example.com","private-token","test-feedback",fake),v=validateFeedback(input());assert.equal((await store.save(v,"hash")).id,v.id);assert.equal(command[0],"EVAL");assert.equal(command[2],4);assert.equal(command[3],`{test-feedback}:ticket:${v.id}`);assert.deepEqual(await store.list(),[]);
 const limited=new RedisFeedbackStorage("https://example.com","token","test",async()=>new Response(JSON.stringify({result:"rate"})));await assert.rejects(()=>limited.save(v,"hash"),/limit/);
 const failure=new RedisFeedbackStorage("https://example.com","token","test",async()=>new Response("",{status:503}));await assert.rejects(()=>failure.save(v,"hash"),/unavailable/);assert.throws(()=>new RedisFeedbackStorage("http://example.com","token","test"));
});
