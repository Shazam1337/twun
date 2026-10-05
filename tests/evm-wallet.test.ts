import test from "node:test";
import assert from "node:assert/strict";
import {evmAddress,evmChain,ROBINHOOD_CHAIN,switchRobinhood,walletError} from "../lib/evm-wallet";
test("Robinhood mainnet parameters and EVM response validation",()=>{
 assert.equal(Number(ROBINHOOD_CHAIN.chainId),4663);
 assert.equal(evmChain("0x01237"),ROBINHOOD_CHAIN.chainId);
 assert.equal(evmChain("4663"),null);assert.equal(evmAddress(["not-an-address"]),null);
 assert.equal(evmAddress(["0x"+"a".repeat(40)]),"0x"+"a".repeat(40));
});
test("unknown Robinhood chain adds then switches and verifies, never signs or transacts",async()=>{
 const calls:string[]=[];let switches=0;
 const result=await switchRobinhood({request:async({method,params})=>{calls.push(method);if(method==="wallet_switchEthereumChain"&&switches++===0)throw {code:4902};if(method==="wallet_addEthereumChain")assert.deepEqual(params,[ROBINHOOD_CHAIN]);return method==="eth_chainId"?"0x1237":null;}});
 assert.equal(result,"0x1237");assert.deepEqual(calls,["wallet_switchEthereumChain","wallet_addEthereumChain","wallet_switchEthereumChain","eth_chainId"]);
});
test("rejected network change does not add chain; lying switch response is rejected",async()=>{
 const calls:string[]=[];await assert.rejects(switchRobinhood({request:async({method})=>{calls.push(method);throw {code:4001};}}));
 assert.deepEqual(calls,["wallet_switchEthereumChain"]);assert.match(walletError({code:4001}),/declined/);
 await assert.rejects(switchRobinhood({request:async({method})=>method==="eth_chainId"?"0x1":null}));
});
