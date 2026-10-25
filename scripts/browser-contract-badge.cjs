const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:'http://127.0.0.1:3000'});
  await page.addInitScript(()=>localStorage.setItem('twun-welcome-v1','seen'));
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:3000/',{waitUntil:'networkidle'});
  const badge=page.locator('.twun-contract-badge');await badge.waitFor();
  assert.equal(await page.locator('.twun-contract-badge img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
  const demo=await page.locator('.odado-demo-label').boundingBox(),contract=await badge.boundingBox(),wallet=await page.getByRole('button',{name:'Connect wallet',exact:true}).boundingBox();
  assert.ok(contract.x>demo.x+demo.width);assert.ok(wallet.x>contract.x+contract.width);
  assert.equal(await badge.isEnabled(),true);
  await badge.hover();await page.getByRole('tooltip').waitFor({state:'visible'});assert.match(await page.getByRole('tooltip').innerText(),/copy/i);
  const placeholder=(await badge.getAttribute('aria-label')).includes('placeholder');
  if(placeholder){assert.match(await badge.innerText(),/CA:\s*0x000\.\.\.000/);assert.equal(await page.getByRole('tooltip').innerText(),'Click to copy');}
  await badge.click();await page.getByRole('tooltip').filter({hasText:'Copied'}).waitFor();
  const copied=await page.evaluate(()=>navigator.clipboard.readText());assert.equal(copied,placeholder?'0x000...000':(await badge.getAttribute('aria-label')).split(' ').at(-1));
  await page.locator('.odado-header').screenshot({path:'artifacts/twun-header-contract-1440.png'});
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);assert.ok(await badge.isVisible());
  assert.deepEqual(errors,[]);
  console.log('PASS: icon, badge order, placeholder disclosure, hover tooltip, actual clipboard copy and success feedback, desktop and mobile layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
