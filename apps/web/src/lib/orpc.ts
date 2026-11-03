import { createORPCClient, onError } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { router } from "@tagapp/api";

const link = new RPCLink({
  url: `${location.origin}/rpc`,
  interceptors: [
    onError((error) => {
      console.error(error);
    }),
  ],
});

const client: RouterClient<router> = createORPCClient(link);

export const orpc = createTanstackQueryUtils(client);
