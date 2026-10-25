import {createHash,randomUUID,timingSafeEqual} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
import {FeedbackError,validateFeedback} from "@/lib/feedback";
import {feedbackStorage} from "@/lib/feedback-server";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store"};
export async function GET(request:NextRequest){
 const token=process.env.FEEDBACK_ADMIN_TOKEN?.trim();if(!token||token.length<32)return NextResponse.json({error:"Team inbox needs FEEDBACK_ADMIN_TOKEN (at least 32 characters) on the server."},{status:503,headers});
 const supplied=request.headers.get("authorization")||"";const hash=(s:string)=>createHash("sha256").update(s).digest();if(!timingSafeEqual(hash(supplied),hash(`Bearer ${token}`)))return NextResponse.json({error:"Access denied."},{status:401,headers});
 try{return NextResponse.json({tickets:await feedbackStorage().list()},{headers});}catch{return NextResponse.json({error:"Inbox temporarily unavailable."},{status:503,headers});}
}
export async function POST(request:NextRequest){
 try{
  // Next can use an internal localhost URL even when the public Host is 127.0.0.1 or a custom domain.
  let sameOrigin=false;try{const origin=new URL(request.headers.get("origin")||"");sameOrigin=origin.host===request.headers.get("host")&&origin.protocol===request.nextUrl.protocol;}catch{}
  if(!sameOrigin)throw new FeedbackError("Submit feedback from this website.",403);
  if(!request.headers.get("content-type")?.startsWith("application/json"))throw new FeedbackError("JSON required.",415);
  const reader=request.body?.getReader();if(!reader)throw new FeedbackError("Empty submission.");let bytes=0;const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>32768){await reader.cancel();throw new FeedbackError("Submission too large.",413);}chunks.push(value);}
  let body:unknown;try{body=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new FeedbackError("Invalid JSON.");}const input=validateFeedback(body);
  const old=request.cookies.get("twun-feedback-client")?.value,client=old&&/^[a-f0-9-]{36}$/.test(old)?old:randomUUID();
  const ticket=await feedbackStorage().save(input,createHash("sha256").update(client).digest("hex"));
  const response=NextResponse.json({receipt:{reference:ticket.reference,id:ticket.id,createdAt:ticket.createdAt,status:ticket.status}},{status:201,headers});response.cookies.set("twun-feedback-client",client,{httpOnly:true,sameSite:"strict",secure:process.env.NODE_ENV==="production"&&request.nextUrl.protocol==="https:",maxAge:31536000,path:"/api/feedback"});return response;
 }catch(e){return NextResponse.json({error:e instanceof FeedbackError?e.message:"Feedback could not be confirmed. Keep your text and retry; retries with the same submission ID are safe."},{status:e instanceof FeedbackError?e.status:503,headers});}
}
