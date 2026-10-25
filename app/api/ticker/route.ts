import { marketProvider } from "@/lib/market-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=20;
export async function GET(){
 try{return Response.json(await marketProvider().ticker(),{headers:{"Cache-Control":"no-store"}});}
 catch{return Response.json({error:"Market data unavailable"},{status:503});}
}
