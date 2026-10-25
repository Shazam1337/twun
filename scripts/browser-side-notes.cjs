const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}}),errors=[],used=new Set();
  await page.addInitScript(()=>{localStorage.setItem('twun-welcome-v1','seen');sessionStorage.setItem('twun-side-notes-dismissed','1');});page.on('pageerror',e=>errors.push(e.message));
  const check=async()=>{
   const notes=page.locator('.twun-side-note');await notes.first().waitFor();assert.equal(await notes.count(),6);
   assert.equal(await page.locator('.twun-side-notes a,.twun-side-notes img,.twun-side-notes svg,.twun-side-notes button').count(),0);
   const main=await page.locator('.twun-news-page,.odado-workspace,.twun-hero-grid').first().boundingBox(),boxes=[];
   for(let i=0;i<6;i++){
    const note=notes.nth(i),box=await note.boundingBox(),left=(await note.getAttribute('class')).includes('is-left');
    assert.ok(box.x>=0&&box.x+box.width<=page.viewportSize().width);
    assert.ok(left?box.x+box.width<=main.x-12:box.x>=main.x+main.width+12);
    assert.ok(box.height<150,'No large poster panels');assert.ok(box.width<240);
    const text=await note.innerText();assert.ok(!used.has(text),'Each page uses unique copy');used.add(text);boxes.push(box);
   }
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.x+a.width<=b.x||b.x+b.width<=a.x||a.y+a.height<=b.y||b.y+b.height<=a.y,'Stickers must not overlap');}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),page.viewportSize().width);
  };
  await page.goto('http://127.0.0.1:3000/news',{waitUntil:'networkidle'});await check();await page.screenshot({path:'artifacts/twun-news-text-stickers-1920.png'});
  await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});await check();await page.screenshot({path:'artifacts/twun-home-text-stickers-1920.png'});
  const hero=await page.locator('.odado-home-hero').boundingBox();for(const note of await page.locator('.twun-side-note').all()){const b=await note.boundingBox();assert.ok(b.y+b.height<hero.y+hero.height-16);}
  await page.locator('.twun-stock-ticker').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));for(const note of await page.locator('.twun-side-note').all()){const b=await note.boundingBox();assert.ok(b.y+b.height<0);}
  for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert.equal(await page.locator('.twun-side-note').first().isVisible(),false);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);}
  await page.setViewportSize({width:1920,height:1080});await page.goto('http://127.0.0.1:3000/trade',{waitUntil:'networkidle'});assert.equal(await page.locator('.twun-side-note').first().isVisible(),false);
  await page.setViewportSize({width:2560,height:1080});await check();await page.screenshot({path:'artifacts/twun-trade-text-stickers-2560.png'});
  await page.getByRole('button',{name:'Expand chart',exact:true}).click();assert.ok(await page.locator('.twun-trading-chart.is-expanded').isVisible());await page.keyboard.press('Escape');
  await page.goto('http://127.0.0.1:3000/portfolio',{waitUntil:'networkidle'});await check();assert.equal(used.size,24);
  await page.setViewportSize({width:2200,height:700});for(const note of await page.locator('.twun-side-note').all()){const b=await note.boundingBox();assert.ok(b.x>=0&&b.x+b.width<=2200&&b.y+b.height<=700);}
  assert.deepEqual(errors,[]);console.log('PASS: 24 unique text-only stickers on four pages, varied placement, no links/images/controls, no overlap or overflow, responsive hiding, hero-only overview, chart expansion.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
