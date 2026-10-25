import "server-only";
import path from "node:path";
import {FeedbackStorage,LocalFeedbackStorage,RedisFeedbackStorage} from "./feedback-storage";
const root=globalThis as typeof globalThis&{twunFeedback?:FeedbackStorage};
export function feedbackConfiguration(){const url=process.env.UPSTASH_REDIS_REST_URL?.trim()||process.env.KV_REST_API_URL?.trim()||"",token=process.env.UPSTASH_REDIS_REST_TOKEN?.trim()||process.env.KV_REST_API_TOKEN?.trim()||"";const shared=!!(process.env.VERCEL||url||token);return {url,token,shared,available:!shared||!!(url&&token)};}
export function feedbackStorage(){if(root.twunFeedback)return root.twunFeedback;const c=feedbackConfiguration();if(!c.available)throw Error("Feedback storage not configured");return root.twunFeedback=c.shared?new RedisFeedbackStorage(c.url,c.token,process.env.FEEDBACK_REDIS_NAMESPACE?.trim()||"twun-feedback-v1"):new LocalFeedbackStorage(path.join(process.cwd(),".cache","twun-feedback-v1.json"));}
