# Tally Arbiter — Code Review (2026-07-13)

Full-codebase review covering the server (`src/`), the Angular client (`UI/src/`), and their integration points. Scope: `src/index.ts`, `src/_helpers/`, `src/_modules/`, `src/_globals/`, `src/_decorators/`, `src/_types/`, `src/_models/`, `src/sources/`, `src/actions/`, and `UI/src/app/`.

Findings are split into **Bugs** (things that are objectively wrong, insecure, or crash-prone) and **Improvements** (valid but non-critical cleanup). Every item cites file:line. Nothing has been fixed yet — this is a read-only audit to plan work from.

---

## 1. Critical security issues (fix first)

These allow privilege escalation, data exposure, or auth bypass.

1. [ ] **Login rate limiters are keyed backwards, weakening brute-force protection.**
   `src/index.ts:322-325` (limiters defined `:91-102`). `limiterConsecutiveFailsByUsernameAndIP` is consumed with only `ipAddr`, and `limiterSlowBruteByIP` is consumed with `` `${username}_${ipAddr}` `` — exactly swapped from what their names/config intend. An attacker can bypass the per-IP daily limiter by cycling usernames from one IP.

2. [ ] **Substring-match role check allows privilege escalation to full settings data.**
   `src/index.ts:299` uses `user.roles.includes(role)`. Since roles are stored as a delimited string and checked with `String.includes`, any user holding a narrow `settings:testing`-style sub-role also satisfies a `requireRole('settings')` check, because `"settings"` is a substring of every `settings:xxx` token. This gates the `socket.on('settings', ...)` handler (`:475-508`) which emits the entire `initialdata` payload — all sources/devices, TSL clients, `cloud_destinations` (including the cloud auth `key` field), `cloud_keys`, `cloud_clients`, and the live log stream — to a user who should see only one settings tab.
   The same fragile pattern exists client-side: `UI/src/app/_services/auth.service.ts:79-84` and `UI/src/app/_guards/authorize.guard.ts:45` both do plain `.includes()` on the roles string, and the `/settings` route guard's `requiredRole = 'settings'` isn't even a real role — it only "works" by accident of substring matching. **Fix everywhere:** split roles into an array and check for an exact match (or use `.split(';').includes(role)`, as `settings.component.ts:678` already does correctly).

3. [ ] **`companion` socket handler has no authorization check at all.**
   `src/index.ts:526-536`. Unlike the near-identical `settings`/`producer` handlers, `companion` never calls `requireRole(...)`. Any client that connects and emits `'companion'` immediately gets `sources`, `devices`, `bus_options`, `device_sources`, `device_states`, `listener_clients`, `tsl_clients`, and `cloud_destinations` (including the cloud `key`) with zero authentication.

4. [ ] **Several control-plane socket events have no role/auth guard.**
   `flash` (`:538-540`), `messaging_client` (`:542-555`), `reassign` (`:557-559`), `listener_reassign` (`:561-580`), `listener_reassign_relay` (`:582-616`), `listener_reassign_gpo` (`:618-651`), `listener_reassign_object` (`:653-672`) — all reachable by any anonymous socket connection, while sibling handlers (`listener_delete`, `testmode`) correctly require a role.

5. [ ] **`cloud_data` lets any cloud-key holder spoof tally state for sources they don't own.**
   `src/index.ts:921-928` only checks `cloud_keys.includes(key)` before calling `processSourceTallyData(sourceId, tallyObj)` — no check that `sourceId` belongs to the calling `cloudClientId`.

6. [ ] **Deleting a cloud key doesn't disconnect the connected client — dead Socket.IO v2 API usage.**
   `src/index.ts:2825-2836` (`DeleteCloudClients`), `:2475-2499`, `:2705-2709`, `:2732-2736` all guard on `(io.sockets as any).connected`, a **Socket.IO v2** API that doesn't exist in v4.8.0 (used here — `package.json:171`). The `if` never runs, so revoked cloud keys leave their client connected indefinitely, `cloud_clients` bookkeeping never gets cleaned up, and flash/message delivery to cloud-connected listeners silently never fires. Remove the `any` cast and use `io.sockets.sockets` (a `Map`) — the cast is exactly what hid this from the type checker.

7. [x] **`editUser` never hashes the password — `addUser` does.**
   `src/_helpers/auth.ts:98-111` stores `user` verbatim (`currentConfig.users[index] = user`), while `addUser` (`:76-96`) calls `hashPassword()` first. Reachable via `TallyArbiter_Edit_User` (`src/index.ts:2510-2517`) → the Settings UI's shared add/edit save path (`UI/src/app/_components/settings/settings.component.ts:681-697`). Editing a user's password writes it to `config.json` **in plaintext**, and future logins break (`bcrypt.compare` against a non-bcrypt string always fails).
   **Status:** Fixed in PR #1019.

8. [x] **`getUsersList()` defaults to leaking bcrypt hashes to the client.**
   `src/_helpers/auth.ts:66-74` — `removePassword` defaults to `false`. `src/index.ts:1040` calls it with no argument, so `socket.emit('users', ...)` ships every user's password hash to any client with `settings:users`. Flip the default, or always strip.
   **Status:** Fixed in PR #1019.

9. [x] **Username enumeration + unhandled rejection in `authenticate()`.**
   `src/_helpers/auth.ts:25-53` returns distinguishable errors (`'Password is incorrect'` vs `'User not found'`), and the `checkPassword(...).then(...)` chain has no `.catch()` — a `bcrypt.compare` rejection hangs the login request forever with no response.
   **Status:** Fixed in PR #1019.

---

## 2. Server core (`src/index.ts`) — correctness bugs

10. [x] **`validateAccessToken` missing `return` after `reject(err)`.**
    `src/_helpers/auth.ts:55-64`. On any invalid/expired JWT, execution falls through to `resolve(decoded.user)` where `decoded` is `undefined` — throws inside an async callback, i.e. an **uncaught exception that can crash the whole process**, not just a rejected promise. This fires on essentially every authenticated socket event (`requireRole`, `TallyArbiter_Manage`), so any expired token can take the server down.
   **Status:** Fixed in PR #1019.

11. [ ] **`typeof x === undefined` typo — dead guard.**
    `src/index.ts:291`: `typeof tmpSocketAccessTokens[socket.id] === undefined` can never be true (`typeof` returns the string `"undefined"`). The intended "Access token required" error path never runs.

12. [ ] **Unvalidated `listenerclient_connect` payload throws uncaught exceptions.**
    `src/index.ts:412-417`. `obj !== null` is dead code (`typeof null === 'object'`), so a literal `null` payload skips the reparse and then `obj.deviceId` throws on `null`. A non-object, non-JSON payload throws a `SyntaxError` from `JSON.parse` with no surrounding try/catch — both triggerable purely by client-supplied socket data.

13. [ ] **`cloud_devices` handler copies fields from the wrong array index.**
    `src/index.ts:775-786`. Matches on `data[i].id === devices[j].id` but then reads `data[j].name/description/tslAddress/enabled` instead of `data[i]` — corrupts a matched device with fields from an unrelated array element (or throws if array lengths differ). The adjacent `cloud_sources` handler (`:715-765`) does this correctly with `data[i]`.

14. [ ] **`TallyArbiter_Add_User` treats a Promise as a synchronous boolean.**
    `src/index.ts:2501-2508`. `addUser()` returns a `Promise` (always truthy), so `if (addUser(obj.user))` always takes the success branch — the "user already exists" error is unreachable, and the rejected promise on failure goes unhandled.

15. [ ] **`CheckListenerClients` guard is always false.**
    `src/index.ts:2899-2912`. `GetDeviceByDeviceId` (`:2538-2553`) always falls back to a synthetic `{id: 'unassigned', ...}` object rather than returning falsy, so `!GetDeviceByDeviceId(...)` never fires and stale listener clients are never reassigned.

16. [ ] **Off-by-one splice bug repeated across several cleanup loops.**
    `removeTestDeviceSource()` (`:1341-1356`, duplicated twice), and the cloud-sync stale-entry cleanups for `cloud_sources` (`:742-758`), `cloud_devices` (`:795-811`), `cloud_device_sources` (`:842-858`), `cloud_listeners` (`:896-912`) all do `arr.splice(i, 1)` inside a forward `for` loop without `i--` — consecutive stale entries aren't fully removed in one pass. `ToggleTestMode` (`:1326-1330`) shows the correct pattern for comparison.

17. [ ] **`SourceClients` map entries leak forever.**
    Set at `src/index.ts:1571`, never deleted. `TallyArbiter_Delete_Source` only calls `.exit()` on the client (`:2028-2072`, via `:1742-1746`) but leaves the map entry (and its RxJS subscriptions/timers) referenced indefinitely — unbounded growth on servers that add/remove sources repeatedly.

18. [ ] **`tmpSocketAccessTokens` never cleaned up on disconnect.**
    Declared as `string[]` (`:285`) but used as a `socket.id`-keyed map; the `disconnect` handler (`:1077-1081`) never deletes the entry — unbounded memory leak over a long-running server's life.

19. [ ] **Hardcoded default bus UUIDs break camera tally after bus edits.**
    `src/index.ts:2780-2781` compares `bus.busId` against hardcoded default Program/Preview UUIDs from `ConfigDefaults.bus_options`. Since bus options are user-editable/deletable, a user who recreates their Program/Preview buses silently breaks `UpdateCamera`. Prefer `bus_options.find(b => b.type === 'program')`.

### Improvements
- Misleading comment: `:2698` says "runs every 5 minutes" for a `setTimeout(..., 5 * 1000)` (5 seconds).
- Many `.catch((err) => console.error(err))` blocks (`:505,522,972,984,1002,1013,1023,1033,1043,1053,1073`) bypass the app's own `logger()`, so these errors never reach the persisted log/UI log stream.
- `index.ts` is a ~2,927-line god-object mixing HTTP setup, Socket.IO registration, the in-memory data store, tally computation, cloud relay, and CRUD for 9+ entity types. The `TallyArbiter_Add/Edit/Delete_X` functions (`:1981-2526`) share an almost-identical shape that could be a generic helper.
- Password shown in a plain `<input type="text">` bound to the raw hash when editing a user (`UI/.../settings.component.html:1403`) — compounds bug #7/#8.
- `getConfigRedacted()` does a synchronous `fs.readFileSync` on every call (`src/_helpers/config.ts:147-160`) instead of redacting the in-memory config.
- Leftover TODOs acknowledging known duplication (`:1172`, `:1375`).

---

## 3. Server infrastructure (`_helpers`, `_modules`, `_globals`, `_decorators`, `_types`, `_models`)

20. [x] **`_helpers/config.ts:121-144` — `readConfig()` dereferences `loadedConfig.security` without a guard.** A corrupted/hand-edited `config.json` missing the `security` key throws; the caller's `catch` swallows it and the server keeps running with `jwt_private_key === ''`, i.e. JWTs signed/verified with an empty secret.
   **Status:** Fixed in PR #1020.

21. [ ] **`configSchema.ts` has drifted from the TS models it validates**, so `validateConfig()` (used by `set_config`) both over- and under-validates:
    - `sources` schema omits required `reconnect_interval`/`max_reconnects` (present in `_models/Source.ts`).
    - `device_actions` schema wrongly requires `outputTypeIdx` (optional in the model) and wrongly omits required `data`.
    - `bus_options` schema omits required `visible`.
    - `cloud_destinations` schema omits required `connected`.
    - Root schema has no property for required `Config.remoteErrorReporting`.
    - `users` schema requires `password`, but the model marks it optional (used for redacted user lists).
    Recommend generating the schema from the TS interfaces so they can't drift independently.

22. [x] **`_decorators/UsesPort.decorator.ts:27-33` — `FreePort` corrupts the port registry when no match is found.** `findIndex` returns `-1` on no match; `splice(-1, 1)` doesn't no-op, it deletes the **last** entry in `PortsInUse`, silently dropping an unrelated port/source's bookkeeping. Confirmed triggerable: `src/sources/IncomingWebhook.ts` calls `FreePort` with the un-fallback-adjusted `source.data.port` while `UsePort`/`listen()` used the fallback `8080` — a mismatch that hits this exact bug (see #33 below). Guard with `if (idx !== -1)`.
   **Status:** Fixed in PR #1021.

23. [ ] **`_modules/TSL.ts:203-248` — `createTSL31Packet` is missing null guards its siblings have.** No `?? []` on `currentTallyData[device.id]` and no `?.` on `GetBusByBusId(busId).type` — throws if a device has no tally state yet, or a bus ID doesn't resolve.

24. [ ] **`_modules/TSL.ts:98-121` — `stopTSLClientConnection` dereferences a possibly-undefined client.** Confirmed race: editing the same TSL client twice within the 5-second re-add window in `TallyArbiter_Edit_TSL_Client` (`src/index.ts:2310-2330`) calls this while the entry is absent from `this.tsl_clients`, throwing on `.transport`.

25. [ ] **`_helpers/uuid.ts:3-6` — the app's general-purpose ID generator truncates a v4 UUID to 32 bits** (`uuid().split('-')[0]`), discarding ~90 bits of entropy. Used for sources, devices, listener clients, error reports, cloud clients — birthday-paradox collisions become plausible after tens of thousands of IDs and silently alias unrelated records.

26. [ ] **`_helpers/logger.ts` — the rotating `tallyLogger` (with `maxsize`/`maxFiles`) is dead code; the file actually used has no size cap.** Tally data is appended via a raw `fs.openSync` fd (`:51`, used at `src/index.ts:1448`) with no rotation — grows unbounded for the process lifetime.

27. [ ] **`_helpers/networkInterfaces.ts:12` — interface name truncated on first space** (`networkInterface.split(' ')[0]`), which can collapse distinct Windows adapters (`"Ethernet"`, `"Ethernet 2"`) to the same reported name.

28. [ ] **`_types/TallyInputConfigField` vs `SourceTypeDataFields`/`OutputTypeDataFields` — duplicated field-type unions have drifted.** Both independently re-declared unions omit `'bool'`, forcing `as SourceTypeDataFields`/`as OutputTypeDataFields` casts in `src/index.ts:1228,1238` that silently defeat the type checker even though `actions/Ember.ts` and `actions/TSL.ts` use `fieldType: 'bool'`.

### Improvements
- `_helpers/clone.ts` — homegrown deep-clone via `obj.constructor()` + mutate-then-restore marker; breaks on non-plain objects, doesn't truly handle circular refs, throws on frozen input. Prefer `structuredClone()` (Node ≥ 17).
- App-data-folder path resolution (`APPDATA`/`darwin`/`~/.local/share`) is copy-pasted across `config.ts`, `logger.ts` (twice), and `errorReports.ts` (seven times) — extract one helper.
- `_helpers/errorReports.ts:88-100` — `getErrorReportPath(id)` has no input validation of its own (only safe because its one caller passes a fresh UUID); the sibling `getErrorReport` does validate. Move the regex check down into the path builder.
- `_helpers/authRoles.ts`'s canonical role list is never validated against server-side on `addUser`/`editUser` — a typo'd role string silently grants no permissions.
- `_modules/MQTT.ts:29` — `reconnectTimer` field is declared/cleared but never assigned (dead field); `publishAllDeviceStates()` is an empty stub invoked on every connect.
- `_helpers/time.ts:4` — `Number(d)` has no `NaN` guard; malformed input silently produces `"NaN hours, NaN minutes..."`.
- Heavy `any` typing throughout `_models/` (`cloudClientId: any`, `data: Record<string, any>`, etc.) weakens type safety on config-validated, wire-protocol data.

---

## 4. Source integrations (`src/sources/`)

Two systemic issues affect multiple files:
- **Calling `this.exit()` from an error/close handler breaks reconnection.** `_Source.ts`'s reconnect state machine treats a `connected.next(false)` after `exit()` as a fresh "startup" event and schedules no reconnect timer. Hits `DataVideoIP.ts` (#31) and `OBS.ts` v5 (#37).
- **Several raw `dgram`/`net` sockets have no `'error'` listener**, relying on the global `uncaughtException` handler as a catch-all instead of degrading gracefully.

29. [ ] **`AnalogWayLivecore.ts:163,169`** — references `.addresses` (typo; the field is `.address`, set at `:145/152`). Every tally update is added under key `undefined` — per-input preview/program state never works for this source.

30. [ ] **`AnalogWayLivecore.ts:59-68,121-123`** — heartbeat interval isn't cleared in the `'close'` handler, only in one timeout branch — a network-reset close leaves a stale interval writing to a dead socket, and reconnect creates a second overlapping one.

31. [ ] **`BlackmagicATEM.ts:138-147`** — duplicated `case RecordingStatus.Stopping:` where the second case was meant to be `RecordingStatus.Recording` — active recording is never surfaced on the program bus.

32. [ ] **`BlackmagicVideoHub.ts:39,41-48`** — `receiveBuffer += chunk` grows unbounded if a peer never sends a trailing delimiter — memory-growth DoS vector.

33. [ ] **`BlackmagicVideoHub.ts:157,160,178,181`** — `destinations_pvw`/`destinations_pgm` are plain-text fields checked with `.includes(numericDestination)`; a string `"12,13"` matching destination `1` via substring match (`"1"` ⊂ `"12"`) gives a false positive. Needs `.split(',').map(Number)` first.

34. [ ] **`DataVideoIP.ts:98-100`** — the control-port `'error'` handler only logs, never sets `connected.next(false)` or reconnects — an initial `ECONNREFUSED` hangs forever with zero retries.

35. [ ] **`DataVideoIP.ts:171-174`** — `reconnect()` calls `this.exit()`, which sets `tryReconnecting = false`; the next failed connection attempt is treated as "startup" and auto-reconnect silently stops after one cycle (see systemic issue above).

36. [ ] **`DataVideoIP.ts:120,123` and `:203,221-238`** — a separate uncapped 500ms retry loop bypassing `connected`/backoff entirely, plus `processBuffer()` calling `buffer.readInt32LE(4)` / reading 8-byte blocks with no length check — throws `RangeError` on a short TCP segment.

37. [ ] **`IncomingWebhook.ts:17,20,61` vs `:74`** — the listen port falls back to `8080` if unset, but `exit()`'s `FreePort` call uses the raw un-fallback-adjusted value — triggers the `FreePort` `-1` bug (#22) directly, corrupting the global port registry.

38. [ ] **`IncomingWebhook.ts:24-27`** — request body accumulated with no size cap — memory-exhaustion DoS via large POST body.

39. [ ] **`OSC.ts:29-34`** — `oscMsg.args[0].value` dereferenced with no length check — any zero-argument OSC packet throws uncaught in the `'message'` handler.

40. [ ] **`NewtekTricaster.ts:26-70`** — each TCP chunk is parsed standalone (unlike `BlackmagicVideoHub.ts`, which buffers partial lines); an XML response split across two segments fails to parse and is silently swallowed by an empty `catch {}` with no logging.

41. [ ] **`RossCarbonite.ts:230,255,285,315`** — `'au10'` typo (missing "x") in the Aux 10 bus registration for 4 switcher models, while the address tables use `'aux10'` — Aux 10 tally silently never fires for those models.

42. [ ] **`RossCarbonite.ts:459-465`** — `updateRossCarboniteTallyData()` loops over the entire global `device_sources` array with no filter by `sourceId`, unlike `ContributionTally.ts`'s equivalent — a device source on a different configured source with a matching address string can bleed state across sources.

43. [ ] **`RolandSmartTally.ts:14,50-52`** — `connected.next(true)` set once in the constructor and never reset to `false` on poll failure — UI reports "Connected" forever even when the device is unreachable.

44. [ ] **`OBS.ts:262-269`** — `this.tally.getValue()[data['scene-name']]` used with `.includes()` with no null check — throws if `SceneItemVisibilityChanged` fires before initial sync completes.

45. [ ] **`OBS.ts:356-393`** — for OBS v5, close codes 4009/4010/4011 and the default case call `this.exit()` before `connected.next(false)`, breaking reconnection the same way as `DataVideoIP` (#35) — auth failures/version mismatches/kicks stop auto-reconnect entirely. Also, `case 1000` (normal closure) never calls `connected.next(false)` at all — the UI shows "Connected" even after OBS quits normally.

46. [ ] **`OBS.ts:176,181`** — `currentTransitionToScene['name']`/`currentTransitionFromScene['name']` dereferenced with no null check on out-of-order transition events.

47. [ ] **`ContributionTally.ts:162,180 → 572-574`** — `parseStillStoreContribution()` throws on truncated input with no try/catch anywhere in its call chain (UDP/TCP `'message'`/`'data'` handlers) — uncaught exception from malformed wire data.

48. [ ] **No `'error'` listener on raw `dgram` sockets** in `SimplyLive.ts:20-21`, `TSL.ts:23-24` (TSL3) and `:240-241` (TSL5), `ContributionTally.ts:160-171` — plus `connected.next(true)` is set immediately after `bind()` without waiting for the `'listening'` event, so status can be falsely reported as connected even when binding actually failed.

49. [ ] **`VMix.ts:93-96` / `PanasonicAVHS410.ts:210-224`** — `exit()` writes a final command but never calls `.end()`/`.destroy()` on the socket (unlike `RolandVR`/`NewtekTricaster`/`AnalogWayLivecore`) — leaked open sockets on teardown.

50. [ ] **`VMix.ts:57,65`** — `data.indexOf(...)` called on `data` (an array of lines) instead of `data[0]` as done two lines above — works by accident via `Array.prototype.indexOf` exact-match semantics, fragile.

### Improvements
- `InternalTestMode.ts:2` — unused `import { timeStamp } from 'console'`.
- `InternalTestMode.ts:61-66` — off-by-one: `<=` should be `<` for zero-indexed addresses.
- `RolandVR.ts:32` — relies on `substring`'s implicit argument-swap behavior for a "second-to-last character" extraction; fragile, prefer `charAt`.
- `PanasonicAVHS410.ts:126-132` — stale/copy-pasted comments describing the wrong bus.
- `PanasonicAVHS410.ts:96` — unbounded `receivebuffer +=` with no size cap.
- Raw `console.error`/`console.log` instead of the app's `logger()` in `BlackmagicATEM.ts:103`, `OBS.ts:129`, `ContributionTally.ts:168`.
- `net.createServer(...).close()` (in `ContributionTally.ts:865`, `RossCarbonite.ts:502`, `TSL.ts:131,284`, `IncomingWebhook.ts:73`) only stops new connections — already-open client sockets aren't force-destroyed on `exit()`.
- Duplicated connect/reconnect boilerplate across `AnalogWayLivecore`, `BlackmagicVideoHub`, `NewtekTricaster`, `PanasonicAVHS410`, `RolandVR`, `VMix` — a shared "TCP client source" helper in `_Source.ts` would reduce drift.
- Widespread `any` typing for socket/client fields where concrete `net.Socket`/`dgram.Socket` types would work (as correctly done in `DataVideoIP.ts`/`BlackmagicVideoHub.ts`).

---

## 5. Action integrations (`src/actions/`)

51. [ ] **`Ember.ts:81`** — `if (!this.isConnected)` references the method itself, not its return value (missing `()`) — always truthy, so the "not connected" guard never fires.

52. [ ] **`Ember.ts:51-55`** — the `DISCONNECTED` handler's `await this.getConnection().connectAsync()` has no try/catch. There is **no `process.on('unhandledRejection')` anywhere in `src/`**, so a failed reconnect attempt is an unhandled rejection that **terminates the whole server process** on modern Node whenever an Ember+ device drops. The initial `connect()` (`:71-78`) correctly wraps the same call in try/catch — this path is inconsistent with it.

53. [ ] **`UDP.ts:39-49`** — no `.on('error', ...)` on the dgram client (throws uncaught on send failure), and the `client.send()` callback is a plain `function`, not an arrow function — `this` is `undefined` inside it in strict-mode ESM, so the success-path logging throws `TypeError` on **every successful send**.

54. [ ] **`TSL.ts:121-131`** — the raw TCP socket for "TSL 3.1 TCP" has no `.on('error', ...)` handler, unlike the equivalent sockets in `TCP.ts:37` and `RossTalk.ts:24`.

55. [ ] **`TSL.ts:163`** — typo `data.sequnece` instead of `sequence` — the "OFF" DLE/STX sequence option can never take effect.

56. [ ] **`TSL.ts:146-151`** — missing `return` after logging "IP and Port must be given" — falls through and sends to invalid destination data anyway.

57. [ ] **`TSL.ts:152-158,167-173`** — `!this.action.data.index` treats a legitimate `index: 0` as "not given," and a later unconditional `Object.entries` copy overwrites the "default to 1" logic anyway whenever the key exists at all.

58. [ ] **`TSL.ts:90-92`** — `bufUMD[0] = 0x80 + parseInt(address)` has no bounds check; an out-of-range address silently truncates into the byte (Buffer index masking) instead of erroring, corrupting the packet.

59. [ ] **`OSC.ts:36` vs `:46-47`** — help text claims quoted args with spaces are supported, but `args.split(' ')` splits before quote-stripping, so `"hello world"` becomes two malformed tokens instead of one string argument.

60. [ ] **`TCP.ts:31-33` / `RossTalk.ts:18-20`** — `write()` immediately followed by `end()`/`destroy()` in the same tick; `destroy()` can discard data not yet flushed to the OS buffer, risking truncated outgoing commands on slower links.

### Improvements
- No lifecycle/dispose hook exists on the `Action` base class (`_Action.ts`) — fine for the stateless actions, but `Ember.ts`'s `static` connection dictionaries (`:28-29`) are never evicted, so editing/deleting an Ember action leaves its old connection (and reconnect loop from #52) running forever, keyed by the stale `ip:port`.
- `Ember.ts:111-116,120-124` — wrapping calls to un-awaited `async` methods in synchronous `try/catch` is dead code (async functions never throw synchronously); gives a false impression of error handling.
- Duplicated `Buffer.from(unescape(...) + end, 'latin1')` expression verbatim in `TCP.ts:30` and `UDP.ts:36`; shared connect/write/error/destroy boilerplate across `TCP.ts`/`RossTalk.ts`/`TSL.ts` could be centralized on the base class.
- `OutgoingWebhook.ts:52-56` — port always defaults to `'80'` regardless of chosen protocol (wrong for a bare HTTPS endpoint with blank port).
- `OutgoingWebhook.ts` — no `timeout`/`maxRedirects`/`maxContentLength` on the axios call; a hung endpoint can accumulate unbounded in-flight requests as tally toggles.
- `TSL.ts:121-131` — no idle timeout on the TCP client; an accepted-but-silent destination leaks the socket for the process lifetime.
- Heavy `any` typing in action `data` payloads (`OSC.ts:48`, `OutgoingWebhook.ts:61`, `TSL.ts:143`).

---

## 6. Angular client (`UI/src/app/`)

61. [ ] **Duplicate `'listener_clients'` socket handler — the second silently discards the first's work.** `UI/src/app/_services/socket.service.ts:126-138` and `:274-279` both register the same event. The second (registered later) overwrites `this.listenerClients` with a version lacking the `.device` reference and active/inactive sort, on every single update. The first handler's `l.device.listenerCount += 1` also has no null-guard — throws if a listener's `deviceId` no longer matches any device (e.g. device deleted while listener still connected).

62. [ ] **Wake-lock click handler is never removed — calls a nonexistent DOM API.** `UI/src/app/_services/wake-lock.service.ts:11-17` calls `document.removeAllListeners?.('click')` — that's a Node.js `EventEmitter` method, not a DOM API; it's `undefined` in a browser and the optional-chaining silently no-ops. The `'click'` listener from `init()` is never removed, so `noSleep.enable()` fires on every click for the app's entire lifetime.

63. [ ] **Cancelling the "listeners connected, delete anyway?" dialog does not stop deletion.** `UI/src/app/_components/settings/settings.component.ts:358-380` checks `if (!result) { return }`, but `Swal.fire()` always resolves to an object (even on cancel/dismiss) — `!result` is always `false`. Compare with the correctly implemented `_decorators/confirmable.decorator.ts:16`, which checks `res.isConfirmed`. **Clicking Cancel still deletes the device.**

64. [ ] **Unbounded recursion risk generating bug-report URLs with a large stack trace.** `UI/src/app/_components/error-report/error-report.component.ts:78-110` truncates title/logs/config when the encoded URL is too long, but never truncates `stacktrace`. If the URL stays oversized purely due to a large stack trace, the recursive retry computes an identically-sized URL forever → `RangeError: Maximum call stack size exceeded`.

65. [ ] **Missing `return` + no rejection handling in `checkIfIssuesEnabled`.** `error-report.component.ts:48-76` — falls through after `resolve(false)` into code that throws on a non-GitHub URL (only "works" because a settled promise ignores the second resolution); `reject` is never invoked and no `.catch()` exists up the chain, so a malformed configured URL leaves `bugReportUrlLoaded` silently stuck `false`.

66. [ ] **Un-correlated request/response socket calls can resolve with the wrong data under concurrency.** `UI/src/app/_services/auth.service.ts:58-68` (`login`) and `socket.service.ts:432-443` (`getErrorReportById`) use bare `.once(eventName, cb)` with no correlation ID — a double-submit or fast navigation stacks multiple listeners, and the first response resolves *all* pending calls with the same payload. Use socket.io ack callbacks or a request ID instead.

67. [ ] **Widespread missing `ngOnDestroy` → socket-listener/RxJS leaks on every re-navigation**, compounding across:
    - `error-reports-list.component.ts:22-35` — registers `'unread_error_reports'` in the constructor, never removed; array never cleared before pushing (duplicates on repeat events).
    - `tally.component.ts:115-117` — `ngOnDestroy` only removes `'flash'`, leaving the `'reassign'` listener and a `deviceStateChanged` subscription registered every time the component is recreated (extra `navigator.vibrate()` calls pile up).
    - `chat.component.ts:18-22` — subscribes to a shared Subject with no `ngOnDestroy` at all; since it's nested in routed components, every visit leaks a closure referencing a destroyed component's DOM ref.
    - `producer.component.ts:16-27` and `settings.component.ts:139-207` — neither implements `OnDestroy`; `SettingsComponent` alone leaks up to seven long-lived registrations per visit.

68. [ ] **Role checks use fragile substring matching on both client and server** (already covered as a critical security issue in §1.2 — listed here too because the client-side instances are: `auth.service.ts:79-84`, `authorize.guard.ts:45`).

### Improvements
- `AuthService.loadProfile()` calls `jwtDecode()` with no try/catch (`auth.service.ts:45-56`) — a corrupted stored token throws from the constructor, breaking app bootstrap.
- JWT stored in `localStorage` — readable by any injected script; consider httpOnly cookies or in-memory token + refresh if hardening is warranted.
- `socket.service.ts:385,391` — duplicate `get_error_reports` emit (copy-paste).
- `socket.service.ts:169-177` — `interfaces` handler `.push()`es without clearing first; would duplicate entries if the server ever re-emits.
- `darkmode.service.ts:43-54` — "auto" mode skips wiring the live `prefers-color-scheme` listener on a brand-new session; only takes effect next load.
- `locationBack.service.ts:8-30` — tracked history excludes `login/*` but the native browser stack doesn't, so `goBack()` can diverge after an auth redirect.
- Several unguarded non-null assertions in `settings.component.ts` (`:274,327,570,600`) throw if a dropdown is left unselected.
- Config-editor validation relies on magic-number `setTimeout(..., 100|200|300)` races to wait for the JSON editor (`settings.component.ts:181-201,924-946,1435-1464`), none cancelled on destroy.
- `SettingsComponent` is ~1,480 lines mixing six+ CRUD flows and a hand-rolled config-diff/warnings engine — worth splitting into a service + per-tab components.
- Magic socket event-name string literals duplicated across `socket.service.ts` and every component with no shared constant/enum.
- `ChatComponent`'s `@Input() type: 'producer' | any` collapses to `any` (union with `any` absorbs the literal type).
- `*requireRole` directive and `AuthorizeGuard` evaluate `profile` once, non-reactively — gated content won't update if roles change while the view is alive.

---

## Suggested prioritization

1. [ ] **Security** (§1): items 1–9 — especially the role-substring bug (#2), the unauthenticated `companion`/control-plane handlers (#3, #4), and the plaintext-password-on-edit bug (#7). These are exploitable today by any client with network access to the server.
2. [ ] **Process-crash bugs**: #10 (JWT verify), #52 (Ember unhandled rejection) — either can bring down the whole server from a single bad token or a flaky device.
3. [ ] **Silent data-corruption bugs**: #13 (`cloud_devices` wrong index), #6 (dead cloud-client disconnect logic), #63 (cancel-doesn't-cancel delete UI bug) — low effort, high value fixes.
4. [ ] **Source/action reliability**: the reconnect-state-machine interaction (#35, #45) and the missing-`error`-listener pattern (#48, #53, #54) recur across many files and would benefit from a single shared fix in `_Source.ts`/`_Action.ts` rather than per-file patches.
5. [ ] **Everything else** — the remaining "Improvements" lists are worth working through opportunistically (e.g. next time a given file is touched) rather than as a dedicated pass.
