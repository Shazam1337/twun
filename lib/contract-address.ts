/** Public display only: syntactic EVM validation is not on-chain verification. */
export function contractAddress(value:string|undefined){
 const address=value?.trim();
 return address&&/^0x[0-9a-fA-F]{40}$/.test(address)&&!/^0x0{40}$/i.test(address)?address:null;
}
export function shortContract(address:string){return `${address.slice(0,6)}…${address.slice(-4)}`;}
