import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import type { User } from "@db/schema";
import { getUserFromRequest } from "./lib/request-auth";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const user = await getUserFromRequest(opts.req);
  return {
    req: opts.req,
    resHeaders: opts.resHeaders,
    user: user ?? undefined,
  };
}
