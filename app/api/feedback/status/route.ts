import {NextResponse} from "next/server";
import {feedbackConfiguration} from "@/lib/feedback-server";
export const dynamic="force-dynamic";
export function GET(){const c=feedbackConfiguration();return NextResponse.json({available:c.available,storage:c.shared?"shared":"local"},{headers:{"Cache-Control":"no-store"}});}
