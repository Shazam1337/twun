export type CapTile={symbol:string;value:number;x:number;y:number;width:number;height:number};
/** Balanced binary treemap, true area proportional to supplied positive market capitalization. */
export function capitalizationMap(items:{symbol:string;value:number}[],width=1000,height=360):CapTile[]{
 const tiles:CapTile[]=[];const sorted=items.filter(v=>Number.isFinite(v.value)&&v.value>0).sort((a,b)=>b.value-a.value);
 function place(rows:typeof sorted,x:number,y:number,w:number,h:number){if(!rows.length)return;if(rows.length===1){tiles.push({...rows[0],x,y,width:w,height:h});return;}const sum=rows.reduce((s,r)=>s+r.value,0);let n=1,first=rows[0].value;while(n<rows.length-1&&Math.abs(first+rows[n].value-sum/2)<Math.abs(first-sum/2)){first+=rows[n++].value;}const fraction=first/sum;if(w>=h){place(rows.slice(0,n),x,y,w*fraction,h);place(rows.slice(n),x+w*fraction,y,w*(1-fraction),h);}else{place(rows.slice(0,n),x,y,w,h*fraction);place(rows.slice(n),x,y+h*fraction,w,h*(1-fraction));}}
 place(sorted,0,0,width,height);return tiles;
}
