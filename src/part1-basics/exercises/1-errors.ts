import { Array, Effect, Either, Option, Schedule } from "effect";
import * as T from "../../testDriver.ts";

/**
 * # Exercise 1:
 *
 * Come up with a way to run this effect until it succeeds, no matter how many times it fails!
 */

let i = 0;
const eventuallySucceeds = Effect.suspend(() =>
  i++ < 100 ? Effect.fail("error") : Effect.succeed(5),
);

// This fails.
// const testOne = eventuallySucceeds;

// One solution is recursive. You can use matchEffect, which allows you to specify an Effect to run for both
// onSuccess and onFailure cases. In this case, we want to match onSuccess to just returning the result, and
// onFailure to re-running the eventually succeeding Effect.
// const testOne: Effect.Effect<number> = Effect.suspend(() =>
//   Effect.matchEffect(eventuallySucceeds, {
//     onSuccess: (_) => Effect.succeed(_),
//     onFailure: () => testOne,
//   }),
// );

// Another solution is to retry it forever.
// const testOne = Effect.retry(eventuallySucceeds, {times: Infinity});
// or
// const testOne = Effect.retry(eventuallySucceeds, Schedule.forever);

// But I think this makes the most sense:
const testOne = Effect.eventually(eventuallySucceeds);

await T.testRunAssert(1, testOne, { success: 5 });

/**
 * # Exercise 2
 *
 * Instead of short-circuiting on the first error, collect all errors, and fail with an array of them
 */

const maybeFail = (j: number) =>
  j % 2 !== 0 ? Effect.fail(`odd ${j}`) : Effect.succeed(j);
const maybeFailArr = Array.allocate<number>(10)
  .fill(0)
  .map((_, index) => index + 1)
  .map((number) => maybeFail(number));

// Fails:
// const testTwo = Effect.all(maybeFailArr);

// I didn't know about this: https://effect-ts.github.io/effect/effect/Effect.ts.html#all
// Default mode is to short-circuit on the first failure. You can change it to accumulate things
// wither "either" (uses Either<Right, Left>) or "validate" (uses Option<None, Some>). So here
// we use "validate" and then filter out the Errors that come back as "None", leaving an array
// of all the accumulated Errors.
const testTwo = Effect.all(maybeFailArr, {
  mode: "validate",
}).pipe(
  Effect.mapError((errors) => errors.filter(Option.isSome).map((_) => _.value)),
);

await T.testRunAssert(2, testTwo, {
  failure: ["odd 1", "odd 3", "odd 5", "odd 7", "odd 9"],
});

/**
 * # Exercise 3:
 *
 * Now `succeed` with both an array of success values and an array of errors
 */

// Here just use the "either" mode. Then, remember that "andThen" encapsulates
// all the things you'd want to compose for the most part. Initial thought was to use
// flatMap, but then remembered that andThen covers all cases for that.
const testThree = Effect.all(maybeFailArr, {
  mode: "either",
}).pipe(
  Effect.andThen((result) => ({
    success: result.filter(Either.isRight).map((_) => _.right),
    failure: result.filter(Either.isLeft).map((_) => _.left),
  })),
);

await T.testRunAssert(3, testThree, {
  success: {
    success: [2, 4, 6, 8, 10],
    failure: ["odd 1", "odd 3", "odd 5", "odd 7", "odd 9"],
  },
});
