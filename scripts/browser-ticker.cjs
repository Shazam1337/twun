const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});
 const tape=page.getByRole('complementary',{name:'Stock quotes and 24-hour changes'});
 await tape.waitFor();
 assert.equal(await page.locator('.twun-stock-group').first().locator('.twun-stock-item').count(),50);
 const hero=await page.locator('.odado-home-hero').boundingBox(),box=await tape.boundingBox();
 assert.ok(box.y>=hero.y+hero.height-1);
 assert.equal(await page.getByRole('button',{name:'Pause stock ticker',exact:true}).count(),0);
 await page.locator('.twun-stock-viewport').hover();
 assert.equal(await page.locator('.twun-stock-track').evaluate(el=>getComputedStyle(el).animationPlayState),'running');
 await page.screenshot({path:'artifacts/twun-stock-tape-1440.png'});
 await page.mouse.move(1,1);
 await page.locator('h1').click();
 assert.equal(await page.locator('.twun-stock-track').evaluate(el=>getComputedStyle(el).animationPlayState),'running');
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.twun-stock-track').evaluate(el=>getComputedStyle(el).animationName),'twun-stock-scroll');
 await page.setViewportSize({width:1440,height:1000});
 const cards=page.locator('.twun-market-cards');
 assert.equal(await cards.evaluate(el=>getComputedStyle(el).borderTopWidth),'0px');
 assert.equal(await cards.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
 const a=await cards.locator(':scope > *').nth(0).boundingBox(),b=await cards.locator(':scope > *').nth(1).boundingBox();
 assert.ok(b.x-a.x-a.width>=15);
 await cards.locator('..').screenshot({path:'artifacts/twun-separated-cards.png'});
 // Click the moving item directly (Playwright's stability wait otherwise waits forever).
 for(const [symbol,quote] of [['AAPL','TSLA'],['TSLA','NVDA'],['NVDA','TSLA']]){
  await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});
  await page.locator('.twun-stock-group').first().getByRole('button',{name:`Trade ${symbol}/${quote}`,exact:true}).evaluate(el=>el.click());
  await page.waitForURL('**/trade');
  assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('odado-selected-pair'))),{base:symbol,quote});
  assert.match(await page.getByRole('button',{name:'Choose market',exact:true}).innerText(),new RegExp(symbol+'\\s*/\\s*'+quote));
 }
 await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});
 await page.route('**/api/ticker',r=>r.fulfill({json:{configured:false,items:[],serverTime:Date.now(),session:'open'}}));
 await page.reload({waitUntil:'networkidle'});
 assert.ok(await tape.getByText('Market data not configured',{exact:true}).isVisible());
 await page.unroute('**/api/ticker');
 await page.route('**/api/ticker',r=>r.fulfill({status:503,json:{error:'unavailable'}}));
 await page.reload({waitUntil:'networkidle'});
 assert.ok(await tape.getByText('Market data connection unavailable',{exact:true}).isVisible());
 assert.deepEqual(errors,[]);
 console.log('PASS: continuous ticker, three stock-to-Trade mappings, separate cards, mobile, missing key and failed API states.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
