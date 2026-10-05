const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});
 const p=await b.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await fs.mkdir('artifacts',{recursive:true});
 for(const [route,name] of [['/','home'],['/trade','trade'],['/portfolio','portfolio']]){
  await p.goto('http://127.0.0.1:3000'+route,{waitUntil:'networkidle'});
  await p.evaluate(()=>document.fonts.ready);
  assert.match(await p.title(),/TWUN/);
  assert.equal(await p.getByRole('link',{name:'TWUN home',exact:true}).count(),1);
  assert.equal(await p.locator('header').count(),1);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),1440);
  assert.ok(!/\bOdado\b/.test(await p.locator('body').innerText()));
  await p.screenshot({path:'artifacts/twun-'+name+'-1440.png',animations:'disabled'});
 }
 await p.goto('http://127.0.0.1:3000/trade',{waitUntil:'networkidle'});
 await p.getByRole('button',{name:'Choose market',exact:true}).click();
 await p.screenshot({path:'artifacts/twun-selector-1440.png',animations:'disabled'});
 await p.getByRole('button',{name:'Close market selector',exact:true}).click();
 await p.setViewportSize({width:390,height:844});
 for(const route of ['/','/trade','/portfolio']){
  await p.goto('http://127.0.0.1:3000'+route,{waitUntil:'networkidle'});
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),390,'Mobile overflow on '+route);
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: TWUN brand, all 3 pages, selector, 1440px desktop and 390px mobile; no browser errors.');
 await b.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
