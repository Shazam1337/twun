// https://docs.robinhood.com/chain/add-network-to-wallet/
export const ROBINHOOD_CHAIN={chainId:"0x1237",chainName:"Robinhood Chain",nativeCurrency:{name:"Ether",symbol:"ETH",decimals:18},rpcUrls:["https://rpc.mainnet.chain.robinhood.com/"],blockExplorerUrls:["https://robinhoodchain.blockscout.com"]};
export type EvmProvider={request:(args:{method:string;params?:unknown[]})=>Promise<unknown>;on?:(event:string,listener:(v:unknown)=>void)=>void;removeListener?:(event:string,listener:(v:unknown)=>void)=>void};
export type EvmWallet={id:string;name:string;provider:EvmProvider};
export function evmAddress(v:unknown):string|null{return Array.isArray(v)&&typeof v[0]==="string"&&/^0x[0-9a-f]{40}$/i.test(v[0])?v[0]:null;}
export function evmChain(v:unknown):string|null{if(typeof v!=="string"||!/^0x[0-9a-f]+$/i.test(v))return null;try{return "0x"+BigInt(v).toString(16);}catch{return null;}}
export function walletError(e:unknown){const code=Number((e as {code?:unknown})?.code);return code===4001?"Request declined. You can continue the demo without connecting.":code===-32002?"A request is already pending. Open your wallet to complete it.":"Wallet request failed. Unlock your wallet and try again. Demo trading remains available.";}
export async function switchRobinhood(p:EvmProvider){
 try{await p.request({method:"wallet_switchEthereumChain",params:[{chainId:ROBINHOOD_CHAIN.chainId}]});}
 catch(e){if(Number((e as {code?:unknown})?.code)!==4902)throw e;await p.request({method:"wallet_addEthereumChain",params:[ROBINHOOD_CHAIN]});await p.request({method:"wallet_switchEthereumChain",params:[{chainId:ROBINHOOD_CHAIN.chainId}]});}
 const chain=evmChain(await p.request({method:"eth_chainId"}));if(chain!==ROBINHOOD_CHAIN.chainId)throw Error("Network not switched");return chain;
}
