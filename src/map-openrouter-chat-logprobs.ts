
type LanguageModelV2LogProbs = Array<{
  token: string;
  logprob: number;
  topLogprobs: Array<{
    token: string;
    logprob: number;
  }>;
}>;

type OpenRouterChatLogProbs = {
  content:
    | {
        token: string;
        logprob: number;
        top_logprobs:
          | {
              token: string;
              logprob: number;
            }[]
          | null;
      }[]
    | null;
};

export function mapOpenRouterChatLogProbsOutput(
  logprobs: OpenRouterChatLogProbs | null | undefined,
): LanguageModelV2LogProbs | undefined {
  return (
    logprobs?.content?.map(({ token, logprob, top_logprobs }) => ({
      token,
      logprob,
      topLogprobs: top_logprobs
        ? top_logprobs.map(({ token, logprob }) => ({
            token,
            logprob,
          }))
        : [],
    })) ?? undefined
  );
}
