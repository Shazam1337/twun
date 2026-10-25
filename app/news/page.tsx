import {Suspense} from "react";
import type {Metadata} from "next";
import {NewsRoom} from "@/components/news-room";
export const metadata:Metadata={title:"TWUN News — The market, in context.",description:"Market headlines and company news for the stocks behind your TWUN pairs."};
export default function NewsPage(){return <Suspense fallback={<main className="twun-news-page">Loading the newsroom…</main>}><NewsRoom/></Suspense>;}
