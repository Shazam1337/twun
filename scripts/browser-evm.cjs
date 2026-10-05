const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await b.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.walletCalls=[];window.rejectWallet=true;window.fakeChain='0x1';window.knownChain=false;
  const listeners={};
  const p={on:(e,f)=>(listeners[e]??=[]).push(f),removeListener:(e,f)=>{listeners[e]=(listeners[e]??[]).filter(x=>x!==f);},request:async({method,params})=>{
   window.walletCalls.push({method,params});
   if(method==='eth_requestAccounts'){if(window.rejectWallet)throw {code:4001};return ['0x'+'a'.repeat(40)];}
   if(method==='eth_chainId')return window.fakeChain;
   if(method==='wallet_switchEthereumChain'){if(!window.knownChain)throw {code:4902};window.fakeChain=params[0].chainId;window.emitWallet('chainChanged',window.fakeChain);return null;}
   if(method==='wallet_addEthereumChain'){window.knownChain=true;return null;}
   throw Error('Unexpected wallet method '+method);
  }};
  window.emitWallet=(event,value)=>(listeners[event]??[]).forEach(fn=>fn(value));
  const announce=()=>['MetaMask','Rabby'].forEach((name,i)=>window.dispatchEvent(new CustomEvent('eip6963:announceProvider',{detail:{info:{uuid:'00000000-0000-4000-8000-00000000000'+i,name,rdns:i?'io.rabby':'io.metamask',icon:''},provider:i?{...p}:p}})));
  window.addEventListener('eip6963:requestProvider',announce);
 });
 await page.goto('http://127.0.0.1:3000/trade',{waitUntil:'networkidle'});
 assert.deepEqual(await page.evaluate(()=>window.walletCalls),[]);
 await page.getByRole('button',{name:'Connect wallet',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'MetaMask',exact:true}).count(),1);
 assert.equal(await page.getByRole('button',{name:'Rabby',exact:true}).count(),1);
 await page.getByRole('button',{name:'MetaMask',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Request declined'}).waitFor();
 await page.evaluate(()=>window.rejectWallet=false);
 await page.getByRole('button',{name:'MetaMask',exact:true}).click();
 await page.getByText('Different network · Chain ID 1',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Switch to Robinhood Chain',exact:true}).click();
 await page.getByText('Robinhood Chain · 4663',{exact:true}).waitFor();
 await page.evaluate(()=>window.emitWallet('accountsChanged',['0x'+'b'.repeat(40)]));
 await page.getByText('0x'+'b'.repeat(40),{exact:true}).waitFor();
 await page.getByRole('link',{name:'Portfolio',exact:true}).click();
 assert.ok(await page.getByRole('button',{name:/0xbbbb/}).isVisible());
 await page.evaluate(()=>window.emitWallet('chainChanged','0x1'));
 await page.getByRole('button',{name:'Switch to Robinhood Chain',exact:true}).waitFor();
 await page.getByRole('button',{name:'Disconnect',exact:true}).click();
 await page.evaluate(()=>window.emitWallet('accountsChanged',['0x'+'a'.repeat(40)]));
 assert.ok(await page.getByRole('button',{name:'Connect wallet',exact:true}).isVisible());
 const calls=await page.evaluate(()=>window.walletCalls);
 assert.ok(calls.some(c=>c.method==='wallet_addEthereumChain'&&c.params[0].chainId==='0x1237'));
 assert.ok(calls.every(c=>['eth_requestAccounts','eth_chainId','wallet_switchEthereumChain','wallet_addEthereumChain'].includes(c.method)));
 await page.getByRole('button',{name:'Connect wallet',exact:true}).click();
 await page.getByRole('button',{name:'Rabby',exact:true}).click();
 await page.getByRole('button',{name:/0xaaaa/}).waitFor();
 if(!await page.getByRole('dialog',{name:'EVM wallet account'}).isVisible())await page.getByRole('button',{name:/0xaaaa/}).click();
 await page.getByRole('dialog',{name:'EVM wallet account'}).waitFor();
 await page.evaluate(()=>window.emitWallet('disconnect',{}));
 assert.ok(await page.getByRole('button',{name:'Connect wallet',exact:true}).isVisible());
 await page.reload({waitUntil:'networkidle'});assert.deepEqual(await page.evaluate(()=>window.walletCalls),[]);
 assert.deepEqual(errors,[]);
 await page.getByRole('button',{name:'Connect wallet',exact:true}).click();
 await page.screenshot({path:'artifacts/twun-evm-wallet-test.png'});
 console.log('PASS: mocked EIP-6963 multi-wallet discovery, refusal, connect, 4902 add/switch, account/network/disconnect events, navigation, manual reconnect, no signatures or transactions.');
 }finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
