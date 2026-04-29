import type { GraphqlContext } from './graphql-context.interface';

export interface GraphqlExecutionContextAdapter {
  getContext<TContext extends GraphqlContext = GraphqlContext>(): TContext;
}
