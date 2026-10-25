import {getProfiles} from "@/lib/news-server";
import {stock} from "@/lib/catalog";
export const runtime="nodejs";export const dynamic="force-dynamic";export const maxDuration=60;
export async function GET(request:Request){const priority=[...new Set((new URL(request.url).searchParams.get("priority")??"").split(",").filter(Boolean))];if(priority.length>50||priority.some(s=>!stock(s)))return Response.json({error:"Priority must contain catalog symbols only."},{status:400});try{return Response.json(await getProfiles(priority),{headers:{"Cache-Control":"no-store"}});}catch{return Response.json({error:"Company profiles unavailable."},{status:503});}}
