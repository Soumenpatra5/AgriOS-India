# My Farm Space Not Opening

## 1. Network/Backend Hang -> Infinite Spinner
`farmSpaceApi.js` relies on `authFetch`, which simply executes `fetch(url)` without a timeout. If the backend Vercel server or network hangs and never resolves, `fetch` hangs indefinitely. `farmSpaceService.spaces()` awaits this, leaving `FarmSpaceHub` permanently stuck in the `"loading"` state rendering the `<Spinner />`.
* **Fix**: Added an `AbortController` with a 10000ms timeout in `src/services/firebase/authFetch.js` to ensure the request rejects with an `AbortError`. In `farmSpaceApi.js`, the `catch` block correctly traps network failures and returns `FARM_ERROR.OFFLINE`, displaying an appropriate offline message instead of an infinite spinner.

## 2. Backend/Configuration Error -> "Not a member"
`farmSpaceApi.js` mistakenly treats ANY 404 response as `FARM_ERROR.NOT_FOUND` (which renders "You're no longer a member of this Farm Space"). If the Vercel API routing is broken, or a function crashes returning a generic 404 HTML, the frontend mistakenly tells the user they lost their membership.
* **Fix**: Updated `reasonFor(status, body)` in `src/services/farmSpace/farmSpaceApi.js` to only return `FARM_ERROR.NOT_FOUND` when the explicit JSON message `body?.error?.message === "Farm Space not found"` is provided (which is exactly what `api/_lib/farm/gate.js` emits for real membership issues). For all other generic 404s, it now falls back to `FARM_ERROR.FAILED` which renders "Could not load Farm Space. Please try again."

These two fixes ensure that users will see explicit feedback regardless of whether the network hangs or Vercel acts up.
