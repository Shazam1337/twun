const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1050}}),errors=[],posts=[];
  await page.addInitScript(()=>localStorage.setItem('twun-welcome-v1','seen'));page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
  // Real data only in screenshots.
  await page.goto('http://127.0.0.1:3000/trade',{waitUntil:'networkidle'});await page.getByRole('button',{name:'Components',exact:true}).click();await page.waitForTimeout(600);await page.screenshot({path:'artifacts/twun-components-1440.png'});await page.getByRole('button',{name:'Ratio',exact:true}).click();
  // All responses below are isolated test fixtures; never screenshot them.
  let stamp=Date.UTC(2026,9,19,18),nvda=100,bad='';
  const prices=()=>({NVDA:nvda,TSLA:200,AAPL:150,MSFT:300,JPM:200,BAC:40,XOM:100,CVX:150});
  await page.route('**/api/market?**',r=>{const u=new URL(r.request().url()),pair={base:u.searchParams.get('base'),quote:u.searchParams.get('quote')},p=prices(),symbols=[...new Set([pair.base,pair.quote,...(u.searchParams.get('watch')||'').split(',').filter(Boolean)])],failed=symbols.includes(bad);
   const quotes=Object.fromEntries(symbols.map(symbol=>[symbol,{status:symbol===bad?'unavailable':'ready',checkedAt:stamp,nextAt:stamp+120000,value:{symbol,currency:'USD',price:p[symbol]||100,timestamp:stamp,marketOpen:true}}]));
   const points=[12,13,14,15,16,19].flatMap((day,di)=>Array.from({length:390},(_,i)=>{const timestamp=Date.UTC(2026,9,day,13,30)+i*60000,baseClose=(p[pair.base]||100)*(1+di*.005+Math.sin(i/6)*.01),quoteClose=(p[pair.quote]||100)*(1+di*.002+Math.cos(i/7)*.004);return {timestamp,baseClose,quoteClose,value:baseClose/quoteClose,label:''};})).filter(p=>p.timestamp+60000<=stamp);
   const h={interval:'1min',points,status:failed?'unavailable':'ready',fetchedAt:stamp,unmatched:0};const base=quotes[pair.base].value,quote=quotes[pair.quote].value;
   return r.fulfill({json:{quotes,catalog:{},budget:{used:0,limit:750},serverTime:stamp,market:{pair,status:failed?'unavailable':'ready',message:failed?'Fixture unavailable':'Fixture',snapshot:failed?null:{id:pair.base+stamp+nvda,pair,base,quote,ratio:base.price/quote.price,timestamp:stamp,fetchedAt:stamp,source:'Twelve Data / US equities'},session:{state:'open',date:'2026-10-19',closesAt:Date.UTC(2026,9,19,20),label:'Market open'},canTrade:!failed,serverTime:stamp,retryAt:0,histories:{'1min':h,'1day':{...h,interval:'1day'}}}}});
  });
  await page.route('**/api/news?**',r=>{const u=new URL(r.request().url()),symbols=(u.searchParams.get('symbols')||u.searchParams.get('symbol')).split(',');return r.fulfill({json:{feeds:Object.fromEntries(symbols.map(scope=>[scope,{scope,status:'ready',provider:'Finnhub',fetchedAt:stamp,retryAt:0,stale:false,articles:[{id:'test-news',headline:'Test publisher event',summary:'Isolated browser fixture',source:'Test publisher',url:'https://example.test/story',publishedAt:Date.UTC(2026,9,16,14,10),symbols:[scope]}]}]))}});});
  await page.evaluate(()=>{localStorage.removeItem('twun-chart-v2');localStorage.removeItem('odado-perps-v4');localStorage.setItem('odado-selected-pair',JSON.stringify({base:'NVDA',quote:'TSLA'}));});
  await page.reload();await page.getByRole('button',{name:'Review Long',exact:true}).waitFor();
  await page.getByRole('button',{name:'Set margin to 250 USDC'}).click();assert.equal(await page.getByLabel('Isolated margin').inputValue(),'250');await page.getByRole('button',{name:'Set margin to 100 USDC'}).click();
  await page.getByRole('button',{name:'Review Long',exact:true}).click();await page.getByRole('button',{name:'Confirm Long',exact:true}).click();
  const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('odado-perps-v4')));await page.waitForFunction(()=>JSON.parse(localStorage.getItem('odado-perps-v4')).positions.length===1);const id=(await state()).positions[0].id;
  stamp=Date.UTC(2026,9,19,19);nvda=110;await page.getByRole('button',{name:'Refresh market data',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-testid="chart-current-index"]').textContent==='0.55000');
  await page.getByRole('combobox',{name:'Chart position',exact:true}).waitFor();assert.match(await page.locator('.twun-chart-position').innerText(),/Unrealized PnL/);
  assert.match(await page.locator('.twun-chart-position').innerText(),/50\.00 USDC/);
  await page.getByRole('button',{name:'Components',exact:true}).click();await page.getByTestId('components-baseline').waitFor();assert.match(await page.locator('.twun-chart-readout .mono').innerText(),/NVDA.*TSLA/);
  const position=structuredClone((await state()).positions[0]);await page.getByRole('button',{name:'Ratio',exact:true}).click();assert.deepEqual((await state()).positions[0],position);
  await page.getByRole('button',{name:'Chart settings',exact:true}).click();await page.getByRole('button',{name:'News events',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.twun-chart-events summary')?.textContent.includes('Chart events · 2'));await page.locator('.twun-chart-events summary').click();await page.getByText('Test publisher event',{exact:true}).first().waitFor();assert.ok(await page.getByText(/Demo Open/).count()>0);
  await page.getByTestId('position-row').getByRole('button',{name:'Close',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Close position'});await dialog.getByRole('button',{name:'25%',exact:true}).click();await dialog.getByRole('button',{name:'Confirm close',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('odado-perps-v4')).positions[0].margin===75);let account=await state();near(account.positions[0].notional,375);near(account.freeUsdc,9937.1875);assert.equal(account.positions[0].id,id);assert.equal(account.history[0].closedFraction,.25);
  await page.getByRole('button',{name:'Show 2×2 comparison'}).click();const grid=page.getByRole('region',{name:'Four pair comparison'});await page.getByRole('combobox',{name:'Comparison pair 2'}).waitFor();const before=structuredClone((await state()).positions[0]);
  await page.getByRole('combobox',{name:'Comparison pair 2'}).selectOption('AAPL/MSFT');await page.locator('[aria-label="Comparison 2"]').getByRole('button',{name:'Trade this pair'}).click();await page.waitForFunction(()=>document.querySelector('[data-testid="order-market"]').textContent.includes('AAPL / MSFT'));assert.deepEqual((await state()).positions.find(p=>p.id===id),before);
  await page.reload();await page.getByTestId('position-row').waitFor();assert.equal((await state()).positions[0].margin,75);assert.match(await page.getByTestId('order-market').innerText(),/AAPL \/ MSFT/);
  await page.getByTestId('position-row').getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('dialog',{name:'Close position'}).getByRole('button',{name:'Confirm close',exact:true}).click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('odado-perps-v4')).positions.length===0);near((await state()).freeUsdc,10049.5);
  assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);console.log('PASS: actual Components screenshot; normalized components, trade/news events, presets, partial close accounting/reload, 2x2 active market and independent positions, zero transaction POSTs.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
