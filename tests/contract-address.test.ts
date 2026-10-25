import test from "node:test";
import assert from "node:assert/strict";
import {contractAddress,shortContract} from "../lib/contract-address";
test("public contract display rejects absent, incomplete, zero or non-EVM addresses",()=>{
 for(const value of [undefined,"","  ","0x1234","<script>alert(1)</script>","0x"+"0".repeat(40),"0x"+"g".repeat(40)])assert.equal(contractAddress(value),null);
 const valid="0x1234567890abcdef1234567890abcdef1234aBcD";
 assert.equal(contractAddress("  "+valid+"  "),valid);assert.equal(shortContract(valid),"0x1234…aBcD");
});
