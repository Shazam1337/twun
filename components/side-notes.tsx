"use client";
import type {CSSProperties} from "react";
import {usePathname} from "next/navigation";
type Note={text:string;side:"left"|"right";at:number;tilt:number;tone:"blue"|"orange"|"yellow"|"outline"|"ink";width:number;size:number;bias:number};
const NOTES:Record<string,Note[]>={
 "/analytics":[
  {text:"Ask better questions.",side:"left",at:.06,tilt:-5,tone:"blue",width:185,size:24,bias:.4},
  {text:"Size isn’t the story.",side:"right",at:.13,tilt:6,tone:"yellow",width:180,size:24,bias:.5},
  {text:"Compare. Don’t guess.",side:"left",at:.47,tilt:5,tone:"ink",width:185,size:25,bias:.3},
  {text:"Context over conviction.",side:"right",at:.5,tilt:-4,tone:"outline",width:185,size:23,bias:.5},
  {text:"Read the numbers.",side:"left",at:.87,tilt:-6,tone:"orange",width:170,size:24,bias:.5},
  {text:"Attention isn’t alpha.",side:"right",at:.87,tilt:5,tone:"ink",width:185,size:25,bias:.3},
 ],
 "/feedback":[
  {text:"Found a bug?",side:"left",at:.08,tilt:-6,tone:"yellow",width:170,size:26,bias:.4},
  {text:"Make it better.",side:"right",at:.13,tilt:5,tone:"blue",width:180,size:25,bias:.5},
  {text:"Your feedback. Our next move.",side:"left",at:.48,tilt:6,tone:"ink",width:190,size:25,bias:.3},
  {text:"Less friction. More clarity.",side:"right",at:.5,tilt:-5,tone:"outline",width:190,size:23,bias:.5},
  {text:"Test the idea.",side:"left",at:.87,tilt:-4,tone:"orange",width:170,size:25,bias:.5},
  {text:"Good products listen.",side:"right",at:.88,tilt:6,tone:"ink",width:180,size:25,bias:.3},
 ],
 "/":[
  {text:"Think relative.",side:"left",at:.05,tilt:-7,tone:"blue",width:170,size:25,bias:.3},
  {text:"Pick a side.",side:"right",at:.13,tilt:6,tone:"orange",width:152,size:24,bias:.65},
  {text:"Not just up. Against what?",side:"left",at:.43,tilt:4,tone:"ink",width:188,size:26,bias:.55},
  {text:"Two stocks. One view.",side:"right",at:.48,tilt:-6,tone:"yellow",width:190,size:25,bias:.3},
  {text:"Bring your conviction.",side:"left",at:.84,tilt:-4,tone:"outline",width:176,size:22,bias:.45},
  {text:"Which stock wins your vote?",side:"right",at:.88,tilt:8,tone:"ink",width:190,size:25,bias:.6},
 ],
 "/news":[
  {text:"Read. Then react.",side:"left",at:.12,tilt:-5,tone:"yellow",width:169,size:25,bias:.6},
  {text:"Context beats noise.",side:"right",at:.04,tilt:7,tone:"blue",width:196,size:24,bias:.3},
  {text:"Question the hype.",side:"left",at:.51,tilt:-8,tone:"ink",width:180,size:27,bias:.25},
  {text:"Headlines ≠ the whole story.",side:"right",at:.45,tilt:-3,tone:"outline",width:194,size:22,bias:.55},
  {text:"Less noise. More signal.",side:"left",at:.88,tilt:4,tone:"orange",width:183,size:23,bias:.5},
  {text:"Form your own view.",side:"right",at:.82,tilt:-7,tone:"ink",width:183,size:26,bias:.25},
 ],
 "/trade":[
  {text:"Long or short?",side:"left",at:.04,tilt:5,tone:"blue",width:185,size:27,bias:.35},
  {text:"Against what?",side:"right",at:.15,tilt:-6,tone:"yellow",width:178,size:27,bias:.55},
  {text:"A thesis. Not a hunch.",side:"left",at:.44,tilt:-8,tone:"ink",width:185,size:25,bias:.6},
  {text:"Two stocks. Your call.",side:"right",at:.53,tilt:6,tone:"orange",width:185,size:24,bias:.3},
  {text:"Mind the margin.",side:"left",at:.86,tilt:-4,tone:"outline",width:170,size:23,bias:.3},
  {text:"Price the perspective.",side:"right",at:.88,tilt:4,tone:"ink",width:195,size:25,bias:.55},
 ],
 "/portfolio":[
  {text:"Own the outcome.",side:"left",at:.14,tilt:-6,tone:"yellow",width:184,size:25,bias:.55},
  {text:"Beyond the green.",side:"right",at:.03,tilt:5,tone:"ink",width:195,size:26,bias:.3},
  {text:"Track the thesis.",side:"left",at:.48,tilt:7,tone:"blue",width:180,size:24,bias:.25},
  {text:"Conviction meets numbers.",side:"right",at:.5,tilt:-5,tone:"outline",width:190,size:23,bias:.55},
  {text:"Know your exposure.",side:"left",at:.87,tilt:-4,tone:"ink",width:190,size:25,bias:.55},
  {text:"The whole picture.",side:"right",at:.85,tilt:8,tone:"orange",width:180,size:24,bias:.3},
 ],
};
export function SideNotes(){
 const pathname=usePathname(),notes=NOTES[pathname];
 if(!notes)return null;
 const workspace=pathname==="/trade"||pathname==="/portfolio";
 return <div className={"twun-side-notes"+(workspace?" is-workspace":"")+(pathname==="/"?" is-overview":"")} aria-hidden="true" data-page={pathname}>
  {notes.map(note=><p key={note.text} className={"twun-side-note is-"+note.side+" tone-"+note.tone} style={{"--note-at":note.at,"--note-tilt":note.tilt+"deg","--note-width":note.width+"px","--note-size":note.size+"px","--note-bias":note.bias} as CSSProperties}>{note.text}</p>)}
 </div>;
}
