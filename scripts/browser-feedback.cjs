const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>localStorage.setItem('twun-welcome-v1','seen'));
 await page.goto('http://127.0.0.1:3000/feedback',{waitUntil:'networkidle'});
 await page.waitForFunction(()=>!document.querySelector('button[type="submit"]').disabled);
 assert.equal(await page.getByRole('link',{name:'Feedback',exact:true}).getAttribute('aria-current'),'page');
 const snapshot=await page.evaluate(()=>localStorage.getItem('odado-perps-v4'));
 await page.screenshot({path:'artifacts/twun-feedback-1440.png',fullPage:true});
 for(const width of [1200,1000,768,390]){await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`overflow at ${width}`);}
 await page.screenshot({path:'artifacts/twun-feedback-mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:1000});
 await page.getByLabel('Give it a short title').fill('[QA] Feedback persistence check');await page.getByLabel('What happened?').fill('Automated QA ticket: verifying that the local feedback form saves a real server receipt. No user issue reported.');
 const response=page.waitForResponse(r=>r.url().endsWith('/api/feedback')&&r.request().method()==='POST');await page.getByRole('button',{name:'Send feedback',exact:true}).click();const r=await response;assert.equal(r.status(),201);const receipt=(await r.json()).receipt;await page.getByText('Received. Thank you.').waitFor();assert.ok(receipt.reference.startsWith('TWUN-'));
 const sent=r.request().postDataJSON(),retry=await page.evaluate(async data=>{const r=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:r.status,data:await r.json()};},sent);assert.equal(retry.status,201);assert.equal(retry.data.receipt.id,receipt.id);
 await page.reload({waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>localStorage.getItem('odado-perps-v4')),snapshot);
 const denied=await page.request.get('http://127.0.0.1:3000/api/feedback');assert.ok([401,503].includes(denied.status()));
 const cross=await page.request.post('http://127.0.0.1:3000/api/feedback',{headers:{Origin:'https://other.example'},data:sent});assert.equal(cross.status(),403);
 const huge=await page.request.post('http://127.0.0.1:3000/api/feedback',{headers:{Origin:'http://127.0.0.1:3000'},data:{...sent,description:'x'.repeat(40000)}});assert.equal(huge.status(),413);
 await page.route('**/api/feedback',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'QA: storage unavailable'})}));await page.getByLabel('Give it a short title').fill('Retain input after failure');await page.getByLabel('What happened?').fill('This text should remain available if the server cannot save this ticket.');await page.getByRole('button',{name:'Send feedback',exact:true}).click();await page.getByRole('alert').filter({hasText:'storage unavailable'}).waitFor();assert.equal(await page.getByLabel('Give it a short title').inputValue(),'Retain input after failure');assert.equal(errors.length,0);
 console.log('Feedback browser checks passed: desktop/mobile, real local save, idempotent retry, private inbox, origin/body protections, retained text on failure, demo state unchanged. QA ticket reference: '+receipt.reference);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
