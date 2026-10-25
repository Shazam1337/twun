import {stock,STOCKS} from "./catalog";
export type NewsStatus="ready"|"refreshing"|"not_configured"|"access_denied"|"quota_exhausted"|"unavailable"|"storage_unavailable";
export type NewsArticle={id:string;headline:string;summary:string;source:string;url:string;publishedAt:number;symbols:string[]};
export type NewsFeed={scope:string;provider:"Finnhub";articles:NewsArticle[];status:NewsStatus;message:string;fetchedAt:number|null;retryAt:number;stale:boolean;coverage?:{checked:number;total:number}};
export function mergeCompanyNews(groups:NewsArticle[][],now:number):NewsArticle[]{
 const unique=new Map<string,NewsArticle>();
 for(const group of groups)for(const article of group){
  if(article.publishedAt<now-7*86400000||article.publishedAt>now+300000)continue;
  const previous=unique.get(article.url);
  const symbols=[...new Set([...(previous?.symbols??[]),...article.symbols])].filter(s=>!!stock(s));
  unique.set(article.url,{...(previous??article),symbols});
 }
 return [...unique.values()].sort((a,b)=>b.publishedAt-a.publishedAt);
}
export const NEWS_MESSAGES:Record<NewsStatus,string>={ready:"Latest publisher coverage",refreshing:"News is refreshing",not_configured:"News feed is not connected",access_denied:"News access is unavailable",quota_exhausted:"News updates are paused",unavailable:"News service is temporarily unavailable",storage_unavailable:"News service is temporarily unavailable"};
export function emptyNews(scope:string,status:NewsStatus):NewsFeed{return {scope,provider:"Finnhub",articles:[],status,message:NEWS_MESSAGES[status],fetchedAt:null,retryAt:0,stale:false};}
const text=(value:unknown,max:number)=>typeof value==="string"?value.replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim().slice(0,max):"";
const COMPANY_ALIASES:Record<string,string[]>={AMD:["AMD"],CSCO:["Cisco"],GOOGL:["Google"],META:["Facebook"],BRK_B:["Berkshire"],XOM:["Exxon","ExxonMobil"],JNJ:["Johnson and Johnson"],PG:["P&G","Procter and Gamble"],NEE:["NextEra"]};
const AMBIGUOUS_TICKERS=new Set(["T","V","MA","MS","GE","HD","KO","PG","CAT","COST","COP","LIN","DIS"]);
const escapePattern=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
export type NewsCompany={symbol:string;basis:"source"|"mention"};
export type NewsFilters={search:string;relatedOnly:boolean;source:string;period:"all"|"24h"|"7d"};
/** Filters only the loaded publisher feed; never makes extra provider requests. */
export function filterNews(articles:NewsArticle[],filters:NewsFilters,now:number):NewsArticle[]{
 const query=filters.search.trim().toLowerCase(),age=filters.period==="24h"?86400000:filters.period==="7d"?7*86400000:Infinity;
 return articles.filter(article=>{
  if(filters.source&&article.source!==filters.source)return false;
  if(now-article.publishedAt>age)return false;
  if(!query)return !filters.relatedOnly||article.symbols.some(s=>!!stock(s))||newsCompanies(article).length>0;
  const companies=newsCompanies(article);
  if(filters.relatedOnly&&!companies.length)return false;
  return !query||[article.headline,article.summary,article.source,...companies.map(c=>c.symbol),...companies.map(c=>stock(c.symbol)?.name??"")].join(" ").toLowerCase().includes(query);
 });
}
/** Explicit name/ticker mentions only; never infer market impact or sentiment. */
export function newsCompanies(article:Pick<NewsArticle,"symbols"|"headline"|"summary">):NewsCompany[]{
 const companies=new Map<string,NewsCompany>();
 for(const symbol of article.symbols)if(stock(symbol)&&!companies.has(symbol))companies.set(symbol,{symbol,basis:"source"});
 const content=article.headline+" "+article.summary;
 for(const company of STOCKS){
  if(companies.has(company.symbol))continue;
  const aliases=[company.name,...(COMPANY_ALIASES[company.symbol.replace(".","_")]??[])];
  // Visa is also an ordinary travel-document word. Require company context.
  const named=company.symbol==="V"?/\bVisa\s+(?:Inc\.?|shares?|stock|earnings|payments?|cards?|revenue)\b|\b(?:payments?|cards?)\s+(?:giant\s+)?Visa\b/i.test(content):aliases.some(name=>new RegExp("\\b"+escapePattern(name)+"\\b","i").test(content));
  const ticker=escapePattern(company.symbol);
  const explicitTicker=new RegExp("(?:\\$"+ticker+"\\b|\\("+ticker+"\\)|\\b(?:NASDAQ|NYSE)\\s*:\\s*"+ticker+"\\b)","i").test(content);
  const clearTicker=!AMBIGUOUS_TICKERS.has(company.symbol)&&new RegExp("\\b"+ticker+"\\b").test(content);
  const meta=company.symbol==="META"&&/\bMeta\b/.test(content);
  if(named||explicitTicker||clearTicker||meta)companies.set(company.symbol,{symbol:company.symbol,basis:"mention"});
 }
 return [...companies.values()];
}
export function normalizeNews(raw:unknown,scope:string,now:number):NewsArticle[]{
 if(!Array.isArray(raw))throw Error("Invalid news response");
 const unique=new Map<string,NewsArticle>();
 for(const item of raw){
  if(!item||typeof item!=="object")continue;
  const headline=text(item.headline,240),source=text(item.source,80),publishedAt=Number(item.datetime)*1000;
  if(!headline||!source||!Number.isFinite(publishedAt)||publishedAt<now-7*86400000||publishedAt>now+300000)continue;
  let url:URL;try{url=new URL(item.url);if(url.protocol!=="https:"||url.username||url.password||!url.hostname.includes("."))continue;}catch{continue;}
  url.hash="";for(const name of [...url.searchParams.keys()])if(/^utm_|^(fbclid|gclid)$/i.test(name))url.searchParams.delete(name);
  const related=typeof item.related==="string"?item.related.split(",").map((s:string)=>s.trim().toUpperCase()).filter((s:string)=>!!stock(s)):[];
  if(scope!=="market"&&related.length&&!related.includes(scope))continue;
  const symbols=scope==="market"?related:[...new Set([scope,...related])];
  const article={id:url.href,headline,source,url:url.href,publishedAt,summary:text(item.summary,240),symbols};
  if(!unique.has(article.url))unique.set(article.url,article);
 }
 if(raw.length&&!unique.size)throw Error("Invalid or expired news response");
 return [...unique.values()].sort((a,b)=>b.publishedAt-a.publishedAt);
}
