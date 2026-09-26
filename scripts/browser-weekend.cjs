const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const url=process.env.ODADO_URL||'http://127.0.0.1:3000',key='odado-perps-v4';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,a+' != '+b);
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1440,height:900},locale:'en-US'}),page=await context.newPage(),errors=[],posts=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
 const state=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 try{
  await context.addInitScript(()=>localStorage.setItem('odado-selected-pair',JSON.stringify({base:'AAPL',quote:'MSFT'})));
  // Real application API, isolated local demo account. No intercepted/fabricated market prices.
  const api=await(await page.request.get(url+'/api/market?base=AAPL&quote=MSFT&interval=1day')).json();
  assert.equal(api.market.session.state,'closed','Run this actual-data scenario outside the regular session');
  assert.equal(api.market.canTrade,true);
  await page.goto(url+'/trade');await page.getByRole('button',{name:'Review Long',exact:true}).waitFor();
  await page.getByText('Market closed · Demo trading at last available prices',{exact:false}).waitFor();
  await page.getByLabel('Isolated margin').fill('100');await page.getByRole('button',{name:'Set leverage to 5x',exact:true}).click();
  await page.getByRole('button',{name:'Review Long',exact:true}).click();await page.getByRole('button',{name:'Confirm Long',exact:true}).click();
  await page.getByTestId('position-row').waitFor();
  const opened=await state();near(opened.freeUsdc,9899.75);near(opened.positions[0].entryRatio,api.market.snapshot.ratio);near(opened.positions[0].funding,0);
  await page.reload();await page.getByTestId('position-row').waitFor();assert.deepEqual((await state()).positions,opened.positions);
  await page.getByText('Demo controls',{exact:true}).click();assert.ok(await page.getByRole('button',{name:'Advance 8h',exact:true}).isDisabled());
  await page.getByTestId('position-row').getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Confirm close',exact:true}).click();
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).positions.length===0,key);
  const closed=await state();near(closed.freeUsdc,9999.5);near(closed.history[0].pnl,0);near(closed.history[0].net,-.5);
  await page.reload();await page.getByRole('button',{name:'Review Long',exact:true}).waitFor();near((await state()).freeUsdc,9999.5);
  await page.getByRole('button',{name:'Short',exact:false}).filter({hasText:'Short'}).first().click();
  await page.getByRole('button',{name:'Review Short',exact:true}).click();await page.getByRole('button',{name:'Confirm Short',exact:true}).click();await page.getByTestId('position-row').waitFor();
  assert.equal((await state()).positions[0].side,'Short');
  await page.getByTestId('position-row').getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Confirm close',exact:true}).click();
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).positions.length===0,key);near((await state()).freeUsdc,9999);
  await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:'artifacts/odado-weekend-1440x900.png',animations:'disabled'});
  assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);
  console.log('PASS actual closed-session API: Long/Short open + close, 0 gross PnL, 0.25 entry/exit fees per position, reload, funding paused, no POST/signatures.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
