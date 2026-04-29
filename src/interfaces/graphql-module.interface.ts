import type { ExecutionContext } from '@nestjs/common';
import type { GraphqlExecutionContextAdapter } from './graphql-execution-context-adapter.interface';

export interface GraphqlModule {
  GqlExecutionContext: {
    create(context: ExecutionContext): GraphqlExecutionContextAdapter;
  };
}
