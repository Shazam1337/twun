const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const url=process.env.ODADO_URL||'http://127.0.0.1:3000',key='odado-perps-v4',at=Date.UTC(2026,8,25,16);
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,a+' != '+b);
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,locale:'en-US',reducedMotion:'reduce'}),page=await context.newPage(),errors=[],posts=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
 const state=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
 const capture=async name=>{await fs.mkdir('artifacts',{recursive:true});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.resolve('artifacts/'+name+'.png'),animations:'disabled'});};
 const choose=async (a,b)=>{await page.getByRole('button',{name:'Choose market',exact:true}).click();await page.locator('.odado-preset-main').filter({hasText:a+' / '+b}).first().click();await page.waitForFunction(([a,b])=>document.querySelector('.odado-pair-name')?.textContent===a+' / '+b,[a,b]);};
 try{
 if(process.argv.includes('--capture')){
  await context.addInitScript(()=>localStorage.setItem('odado-selected-pair',JSON.stringify({base:'AAPL',quote:'MSFT'})));
  await page.goto(url+'/trade');await page.getByTestId('free-balance').filter({hasText:'10,000.00'}).waitFor();
  await page.waitForFunction(()=>document.querySelector('[data-testid=current-ratio]')?.textContent!=='—',null,{timeout:180000});await page.locator('.recharts-line-curve').first().waitFor({timeout:180000});
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('.odado-pair-logos img')).every(i=>i.complete));
  await capture('odado-aapl-msft-1440x900');
  await page.getByRole('button',{name:'Choose market',exact:true}).click();await capture('odado-selector-1440x900');
  await page.getByRole('button',{name:'Create pair',exact:true}).click();await capture('odado-create-pair-1440x900');
  console.log('Actual API screenshots captured; no fixture prices or positions.');
 }else{
  // Isolated test-only responses. Never source data or screenshot content for the final handoff.
  let prices={NVDA:100,TSLA:200,AAPL:200,MSFT:400,JPM:250,BAC:50},bad='',closed=false,stamp=at;
  await context.route('**/api/market*',async route=>{
   const q=new URL(route.request().url()).searchParams,base=q.get('base')||'NVDA',quote=q.get('quote')||'TSLA',symbols=[...new Set([base,quote,...(q.get('watch')||'').split(',').filter(Boolean)])];
   const quotes=Object.fromEntries(symbols.map(symbol=>[symbol,{status:symbol===bad?'unavailable':'ready',checkedAt:stamp,nextAt:stamp+120000,value:{symbol,price:prices[symbol],currency:'USD',timestamp:stamp,marketOpen:!closed}}]));
   const pair={base,quote},failed=[base,quote].includes(bad),ratio=prices[base]/prices[quote];
   const history={interval:'1day',status:'ready',fetchedAt:stamp,unmatched:0,points:Array.from({length:20},(_,i)=>({timestamp:at-(20-i)*86400000,value:ratio*(.95+i*.003),label:''}))};
   const market={pair,status:failed?'unavailable':'ready',message:failed?'Market data service unavailable':'Test fixture',snapshot:failed?null:{pair,id:base+'/'+quote+':'+stamp+':'+ratio,source:'Twelve Data / US equities',base:quotes[base].value,quote:quotes[quote].value,ratio,timestamp:stamp,fetchedAt:stamp},session:{state:closed?'closed':'open',date:'2026-09-25',closesAt:at+14400000,label:closed?'Market closed':'Market open'},serverTime:stamp,canTrade:!failed&&!closed,retryAt:stamp+120000,histories:{'1day':history,'5min':{...history,interval:'5min'}}};
   await route.fulfill({json:{market,quotes,catalog:{},budget:{used:0,limit:750,minuteUsed:0,minuteLimit:8,retryAt:0,day:'2026-09-25'},serverTime:stamp}});
  });
  await page.goto(url+'/trade');
  await page.getByRole('button',{name:'Review Long',exact:true}).waitFor();
  await choose('NVDA','TSLA');assert.equal(await page.getByText('Loading market data…',{exact:true}).count(),0);
  await page.getByLabel('Isolated margin').fill('0');assert.ok(await page.getByRole('button',{name:'Minimum margin 1 USDC'}).isDisabled());
  await page.getByLabel('Isolated margin').fill('100000');assert.ok(await page.getByRole('button',{name:'Insufficient demo USDC'}).isDisabled());
  await page.getByLabel('Isolated margin').fill('100');await page.getByRole('button',{name:'Review Long',exact:true}).click();await page.getByRole('button',{name:'Confirm Long',exact:true}).click();
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).positions.length===1,key);
  const first=(await state()).positions[0];near(first.entryRatio,.5);
  await choose('AAPL','MSFT');await page.getByRole('button',{name:'Review Long',exact:true}).click();await page.getByRole('button',{name:'Confirm Long',exact:true}).click();
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).positions.length===2,key);
  const second=(await state()).positions.find(p=>p.pair.base==='AAPL');assert.deepEqual((await state()).positions.find(p=>p.id===first.id),first);
  await page.getByRole('button',{name:'Reverse pair',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.odado-pair-name').textContent==='MSFT / AAPL');near(Number(await page.getByTestId('current-ratio').innerText()),2);
  assert.deepEqual((await state()).positions.find(p=>p.id===second.id),second);
  await page.getByRole('button',{name:'Choose market',exact:true}).click();await page.getByRole('button',{name:'Add AAPL/MSFT to favorites',exact:true}).click();await page.getByRole('button',{name:'Favorites',exact:true}).click();assert.equal(await page.locator('.odado-preset-main').count(),1);
  await page.getByRole('button',{name:'Create pair',exact:true}).click();await page.getByRole('button',{name:'Choose first stock',exact:true}).click();await page.getByLabel('Search stocks and pairs').fill('JPMorgan');await page.locator('.odado-stock-list>button').filter({hasText:'JPMorgan'}).click();
  await page.getByLabel('Search stocks and pairs').fill('Bank of America');await page.locator('.odado-stock-list>button').filter({hasText:'Bank of America'}).click();await page.getByRole('button',{name:'Trade this pair',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-testid=current-ratio]').textContent==='5.0000');
  await page.getByRole('button',{name:'Short',exact:false}).filter({hasText:'Short'}).first().click();await page.getByRole('button',{name:'Review Short',exact:true}).click();await page.getByRole('button',{name:'Confirm Short',exact:true}).click();
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).positions.length===3,key);
  const before=await state();await page.reload();await page.getByTestId('position-row').first().waitFor();assert.equal((await state()).positions.length,3);near((await state()).freeUsdc,before.freeUsdc);assert.equal(await page.locator('.odado-pair-name').innerText(),'JPM / BAC');
  await page.getByRole('button',{name:'Choose market',exact:true}).click();await page.getByRole('button',{name:'Favorites',exact:true}).click();assert.equal(await page.locator('.odado-preset-main').count(),1);await page.getByRole('button',{name:'Close market selector',exact:true}).click();
  prices.NVDA=110;bad='AAPL';stamp+=1000;
  await page.getByRole('button',{name:'Refresh market data',exact:true}).click();await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).positions.find(p=>p.pair.base==='NVDA').mark===.55,key);
  assert.deepEqual((await state()).positions.find(p=>p.id===second.id),second);
  await choose('AAPL','MSFT');await page.getByRole('button',{name:'Market data unavailable',exact:true}).waitFor();assert.ok(await page.getByRole('button',{name:'Market data unavailable',exact:true}).isDisabled());
  const nvrow=page.getByTestId('position-row').filter({hasText:'NVDA/TSLA'});assert.ok(await nvrow.getByRole('button',{name:'Close',exact:true}).isEnabled());
  await nvrow.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Confirm close',exact:true}).click();await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).positions.length===2,key);near((await state()).history[0].pnl,50);
  bad='';prices.AAPL=220;stamp+=1000;await page.getByRole('button',{name:'Refresh market data',exact:true}).click();await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).positions.find(p=>p.pair.base==='AAPL').mark===.55,key);
  closed=true;stamp+=1000;await page.getByRole('button',{name:'Refresh market data',exact:true}).click();await page.getByRole('button',{name:'Market data unavailable',exact:true}).waitFor();
  await page.getByRole('link',{name:'Portfolio',exact:true}).click();await page.getByTestId('portfolio-free').waitFor();assert.equal(await page.getByTestId('position-row').count(),2);near(parseFloat((await page.getByTestId('portfolio-free').innerText()).replaceAll(',','')),(await state()).freeUsdc);
  assert.equal(await page.locator('header').count(),1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),1440);
  await page.getByRole('button',{name:'Connect wallet',exact:true}).click();await page.getByRole('status').filter({hasText:'No EVM wallet detected'}).waitFor();await page.getByRole('button',{name:'Close wallet menu',exact:true}).click();
  await page.getByRole('link',{name:'Overview',exact:true}).click();await page.getByRole('heading',{name:'Trade stock performance. No tokenization required.',exact:true}).waitFor();assert.equal(await page.locator('header').count(),1);
  const {pair:ignoredPair,mark:ignoredMark,...oldPosition}=first;
  const legacy={version:3,freeUsdc:9899.75,mark:.5,clock:at,startedAt:at,positions:[oldPosition],history:before.history.filter(e=>e.positionId===first.id).map(({pair,...e})=>e),marks:[{timestamp:at,value:.5}],acceptedIndex:{id:first.entryIndexId,timestamp:first.entryIndexTime,source:first.dataSource}};
  const raw=JSON.stringify(legacy);
  await page.evaluate(({raw,key})=>{localStorage.removeItem(key);localStorage.setItem('pair-perps-twelve-v3',raw);localStorage.setItem('pair-perps-demo-v2','{"version":2,"test":"preserve"}');},{raw,key});
  await page.goto(url+'/trade');await page.getByTestId('position-row').waitFor();const migrated=await state();
  assert.equal(migrated.positions[0].id,first.id);near(migrated.positions[0].entryRatio,.5);near(migrated.positions[0].mark,.5);near(migrated.freeUsdc,9899.75);
  assert.equal(await page.evaluate(()=>localStorage.getItem('pair-perps-twelve-v3')),raw);assert.equal(await page.evaluate(()=>localStorage.getItem('pair-perps-demo-v2')),'{"version":2,"test":"preserve"}');
  assert.equal(posts.length,0);assert.deepEqual(errors,[]);
  console.log('PASS: any-pair selector, search, favorites, reversal, 3 simultaneous positions, independent marks, isolated quote failure/recovery, closing inactive pair, fees, reload, portfolio, shared headers, wallet missing-extension states, zero POST transactions.');
 }
 if(errors.length)throw Error(errors.join('\n'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
