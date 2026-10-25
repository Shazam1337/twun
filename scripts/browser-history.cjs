const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[];
  await page.addInitScript(()=>{localStorage.setItem('twun-welcome-v1','seen');localStorage.setItem('twun-chart-v2',JSON.stringify({mode:'line',frame:'1h',view:'ratio'}));});page.on('pageerror',e=>errors.push(e.message));
  const stamp=Date.UTC(2026,9,20,15);
  const points=days=>days.flatMap((day,di)=>Array.from({length:390},(_,i)=>({timestamp:Date.UTC(2026,9,day,13,30)+i*60000,value:.45+di*.005+i*.00001,baseClose:90+di+i*.01,quoteClose:200,label:''})));
  const latest=points([12,13,14,15,16,19]),earlier=points([5,6,7,8,9]);let pageCalls=0;
  await page.route('**/api/market?**',r=>{const u=new URL(r.request().url()),pair={base:u.searchParams.get('base'),quote:u.searchParams.get('quote')},reverse=pair.base==='TSLA';const h={interval:'1min',points:latest.map(p=>reverse?{...p,value:1/p.value,baseClose:p.quoteClose,quoteClose:p.baseClose}:p),status:'ready',fetchedAt:stamp,unmatched:0};const quotes=Object.fromEntries(['NVDA','TSLA'].map(symbol=>[symbol,{status:'ready',checkedAt:stamp,nextAt:stamp+120000,value:{symbol,currency:'USD',price:symbol==='NVDA'?100:200,timestamp:stamp,marketOpen:true}}]));const base=quotes[pair.base].value,quote=quotes[pair.quote].value;
   return r.fulfill({json:{quotes,catalog:{},serverTime:stamp,market:{pair,status:'ready',message:'Fixture',snapshot:{id:pair.base+stamp,pair,base,quote,ratio:base.price/quote.price,timestamp:stamp,fetchedAt:stamp,source:'Twelve Data / US equities'},session:{state:'open',date:'2026-10-20',closesAt:stamp+18000000,label:'Market open'},canTrade:true,serverTime:stamp,retryAt:0,histories:{'1min':h,'1day':null}}}});});
  await page.route('**/api/history?**',async r=>{pageCalls++;const u=new URL(r.request().url()),before=Number(u.searchParams.get('before')),pair={base:u.searchParams.get('base'),quote:u.searchParams.get('quote')};await new Promise(resolve=>setTimeout(resolve,800));return r.fulfill({json:pageCalls===1?{pair,before,status:'ready',hasMore:true,retryAt:0,history:{interval:'1min',points:earlier,status:'ready',unmatched:0,fetchedAt:stamp}}:{pair,before,status:'quota_exhausted',hasMore:false,retryAt:Date.now()+60000,history:null}});});
  await page.goto('http://127.0.0.1:3000/trade');await page.waitForFunction(()=>document.querySelector('.twun-chart-coverage')?.textContent.includes('42 complete candles'));
  assert.equal(await page.locator('[aria-label="Chart period"]').count(),0);assert.equal(await page.getByRole('button',{name:'Line',exact:true}).count(),0);assert.equal(pageCalls,0);
  const account=await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('odado-perps-v4'));return {positions:s.positions,history:s.history,freeUsdc:s.freeUsdc};});
  const box=await page.locator('.twun-chart-canvas').boundingBox();await page.mouse.move(box.x+100,box.y+220);await page.mouse.down();await page.mouse.move(box.x+500,box.y+220,{steps:20});await page.mouse.up();
  await page.waitForFunction(()=>document.querySelector('.twun-chart-history-loader')?.textContent.includes('Loading earlier'));
  await page.waitForFunction(()=>document.querySelector('.twun-chart-coverage')?.textContent.includes('77 complete candles'));
  assert.equal(pageCalls,1);assert.match(await page.locator('.twun-chart-coverage').innerText(),/05\/10\/2026/);
  await page.getByRole('button',{name:'Load earlier chart history'}).click();await page.waitForFunction(()=>document.querySelector('.twun-chart-history-loader')?.textContent.includes('quota exhausted'));assert.equal(pageCalls,2);assert.match(await page.locator('.twun-chart-coverage').innerText(),/77 complete candles/);
  assert.deepEqual(await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('odado-perps-v4'));return {positions:s.positions,history:s.history,freeUsdc:s.freeUsdc};}),account);
  await page.getByRole('button',{name:'Reverse pair',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.twun-chart-coverage')?.textContent.includes('42 complete candles'));assert.match(await page.locator('.twun-chart-coverage').innerText(),/12\/10\/2026/);
  assert.deepEqual(errors,[]);console.log('PASS: no lookback or Line switch, drag-left pagination, historical prepend, single request, quota protection, pair isolation and unchanged demo account.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
