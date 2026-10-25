const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  await fs.mkdir('artifacts',{recursive:true});
  const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage(),errors=[],posts=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
  const dialog=page.getByRole('dialog',{name:'YOUR TAKE. YOUR PAIR.'});
  await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});
  await dialog.waitFor();assert.equal(await page.evaluate(()=>document.activeElement.id),'twun-welcome-title');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.body).overflow),'hidden');
  await page.screenshot({path:'artifacts/twun-welcome-1440.png',animations:'disabled'});
  await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>localStorage.getItem('twun-welcome-v1')),'seen');
  await page.getByRole('link',{name:'Trade',exact:true}).click();await page.reload({waitUntil:'networkidle'});
  assert.equal(await dialog.count(),0);
  await page.getByRole('link',{name:'Portfolio',exact:true}).click();assert.equal(await dialog.count(),0);
  // A second tab's dismissal closes a concurrently open introduction as well.
  await page.evaluate(()=>localStorage.removeItem('twun-welcome-v1'));await page.reload({waitUntil:'networkidle'});await dialog.waitFor();
  const other=await context.newPage();await other.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});
  await other.getByRole('button',{name:'Look around first',exact:true}).click();await dialog.waitFor({state:'hidden'});await other.close();
  await page.goto('http://127.0.0.1:3000/');await page.evaluate(()=>localStorage.removeItem('twun-welcome-v1'));await page.reload({waitUntil:'networkidle'});await dialog.waitFor();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('odado-perps-v4')).positions);
  await page.getByRole('button',{name:'Explore the terminal',exact:true}).click();await page.waitForURL('**/trade');
  assert.equal(await dialog.count(),0);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('odado-perps-v4')).positions),before);
  const mobile=await browser.newPage({viewport:{width:390,height:844}});
  await mobile.goto('http://127.0.0.1:3000/trade',{waitUntil:'networkidle'});await mobile.getByRole('dialog').waitFor();
  const box=await mobile.locator('.twun-welcome').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390&&box.y>=0&&box.y+box.height<=844);
  await mobile.screenshot({path:'artifacts/twun-welcome-390.png',animations:'disabled'});
  await mobile.getByRole('button',{name:'Close introduction',exact:true}).click();assert.equal(new URL(mobile.url()).pathname,'/trade');
  assert.deepEqual(errors,[]);assert.deepEqual(posts,[]);
  console.log('PASS: first visit, desktop/mobile, Escape/close/browse/demo CTA, navigation/reload persistence, cross-tab dismissal, unchanged positions, no POST transactions.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
