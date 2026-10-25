const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  await page.addInitScript(()=>localStorage.setItem('twun-welcome-v1','seen'));
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});
  assert.equal(await page.getByText('Put the ratio to work',{exact:true}).count(),0);
  assert.equal(await page.locator('.odado-home-preview').count(),0);
  assert.equal(await page.getByRole('heading',{name:'A ratio is the market.',exact:true}).count(),1);
  const track=page.locator('.twun-ticker-track');
  const before=await track.evaluate(el=>getComputedStyle(el).transform);
  await page.waitForTimeout(500);
  assert.notEqual(before,await track.evaluate(el=>getComputedStyle(el).transform));
  // A moving track intentionally never stabilizes for locator.hover().
  const tickerBox=await page.locator('.twun-ticker').boundingBox(),headerBox=await page.locator('.odado-header').boundingBox();
  assert.ok(tickerBox.y>=headerBox.y+headerBox.height-1);
  await page.mouse.move(720,tickerBox.y+12);
  assert.equal(await track.evaluate(el=>getComputedStyle(el).animationPlayState),'running');
  const widths=await page.locator('.twun-ticker-group').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().width));
  assert.ok(Math.abs(widths[0]-widths[1])<0.01);
  await page.screenshot({path:'artifacts/twun-home-updated-1440.png'});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await track.evaluate(el=>getComputedStyle(el).animationName),'none');
  assert.deepEqual(errors,[]);
  console.log('PASS: removed example, mechanics preserved, continuous ticker movement including hover, seamless duplicate widths, reduced-motion accessibility.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
