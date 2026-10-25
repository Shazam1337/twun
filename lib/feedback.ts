export const FEEDBACK_TYPES = ["Bug", "Idea", "Experience", "Market data"] as const;
export const FEEDBACK_AREAS = ["Overview", "Trade", "Portfolio", "News", "Other"] as const;
export type FeedbackInput = {id:string;category:typeof FEEDBACK_TYPES[number];area:typeof FEEDBACK_AREAS[number];title:string;description:string;contact:string};
export type FeedbackTicket = FeedbackInput & {reference:string;createdAt:string;status:"Received"};
export class FeedbackError extends Error {constructor(message:string,public status=400){super(message);}}
export function validateFeedback(value:unknown):FeedbackInput {
 if(!value||typeof value!=="object")throw new FeedbackError("Invalid submission.");
 const v=value as Record<string,unknown>;
 const field=(name:string,min:number,max:number)=>{const s=v[name];if(typeof s!=="string"||s.trim().length<min||s.trim().length>max)throw new FeedbackError(`${name}: please use ${min}–${max} characters.`);return s.trim();};
 const id=field("id",36,36);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))throw new FeedbackError("Invalid submission ID.");
 if(v.website)throw new FeedbackError("Submission rejected.");
 if(!FEEDBACK_TYPES.includes(v.category as FeedbackInput["category"])||!FEEDBACK_AREAS.includes(v.area as FeedbackInput["area"]))throw new FeedbackError("Choose a feedback type and app area.");
 return {id,category:v.category as FeedbackInput["category"],area:v.area as FeedbackInput["area"],title:field("title",5,100),description:field("description",20,5000),contact:field("contact",0,160)};
}
