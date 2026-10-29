<script>
  // Face Steer: classic Eddy Merge, but the webcam watches your head. Tilt left or right to slide
  // sideways, nod down or tip back to slide down or up. Video is processed in the browser with
  // MediaPipe's face landmarker and never leaves the device. Arrow keys and swipes always work.
  import { onDestroy } from "svelte";
  import GameHeader from "../../lib/GameHeader.svelte";
  import Board from "../../lib/Board.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { slide, spawn, canMove, newId } from "../../lib/engine.js";
  import { load, save } from "../../lib/storage.js";
  import { headPose, createSteer, SENSITIVITY } from "./steer.js";

  const SIZE = 4, MAX = 11, KEY = "face-steer-v1";
  // Only the library code and the model are downloaded; camera frames stay in this tab.
  const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.0/wasm";
  const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
  const ARROWS = ["↑", "→", "↓", "←"];

  let tiles = $state([]);
  let score = $state(0);
  let best = $state(load(KEY + ":best", 0));
  let won = $state(false);
  let keepGoing = $state(false);
  let over = $state(false);
  let photos = $state({});

  // off | loading | on | denied | error
  let camera = $state("off");
  let errorText = $state("");
  let sensitivity = $state(load(KEY + ":sens", "medium"));
  let faceSeen = $state(false);
  let calibrated = $state(false);
  let dot = $state({ x: 0, y: 0 });
  let lastDir = $state(null);
  let video = $state();

  const steer = createSteer(SENSITIVITY[sensitivity] ?? SENSITIVITY.medium);
  let stream = null, landmarker = null, raf = 0, lastFrame = -1, flashTimer = 0;

  function newGame() {
    tiles = [];
    const first = spawn([], SIZE);
    tiles = [{ ...first, isNew: true }, { ...spawn([first], SIZE), isNew: true }];
    score = 0; won = false; keepGoing = false; over = false;
    persist();
  }

  function move(dir) {
    if (over || (won && !keepGoing)) return;
    const live = tiles.filter(t => !t.gone).map(({ id, lvl, r, c }) => ({ id, lvl, r, c }));
    const res = slide(live, SIZE, dir, MAX);
    if (!res.moved) return;
    const next = res.tiles;
    const extra = spawn(next, SIZE);
    if (extra) next.push({ ...extra, isNew: true });
    tiles = [...next, ...res.consumed.map(t => ({ ...t, gone: true }))];
    setTimeout(() => (tiles = tiles.filter(t => !t.gone)), 120);
    score += res.gained;
    if (score > best) { best = score; save(KEY + ":best", best); }
    if (res.topLvl === MAX && !won) won = true;
    if (!canMove(next, SIZE, MAX)) over = true;
    persist();
  }

  function persist() {
    save(KEY, { tiles: tiles.filter(t => !t.gone).map(({ lvl, r, c }) => ({ lvl, r, c })), score, won, keepGoing, over });
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      camera = "error";
      errorText = "This browser can't use a camera here. Face Steer needs a secure (https) page.";
      return;
    }
    camera = "loading";
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 320, height: 240 }, audio: false });
    } catch (e) {
      camera = e?.name === "NotAllowedError" || e?.name === "SecurityError" ? "denied" : "error";
      errorText = e?.name === "NotFoundError" ? "No camera was found." : "The camera couldn't be started.";
      return;
    }
    try {
      const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks(WASM);
      landmarker = await FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numFaces: 1,
      });
    } catch {
      stopCamera();
      camera = "error";
      errorText = "The face tracker couldn't load. Check your connection and try again.";
      return;
    }
    if (!stream) return; // stopped while loading
    video.srcObject = stream;
    await video.play().catch(() => {});
    steer.recenter();
    calibrated = false;
    camera = "on";
    raf = requestAnimationFrame(tick);
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!landmarker || video.readyState < 2 || video.currentTime === lastFrame) return;
    lastFrame = video.currentTime;
    const result = landmarker.detectForVideo(video, now);
    const pose = headPose(result.faceLandmarks?.[0]);
    faceSeen = !!pose;
    const out = steer.update(pose, now);
    calibrated = steer.calibrated;
    dot = { x: out.x, y: out.y };
    if (out.dir !== null) {
      move(out.dir);
      lastDir = out.dir;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => (lastDir = null), 400);
    }
  }

  function stopCamera() {
    cancelAnimationFrame(raf);
    stream?.getTracks().forEach(t => t.stop());
    stream = null;
    landmarker?.close();
    landmarker = null;
    if (video) video.srcObject = null;
    camera = "off";
    faceSeen = false;
  }

  function recenter() {
    steer.recenter();
    calibrated = false;
  }

  function setSensitivity(s) {
    sensitivity = s;
    save(KEY + ":sens", s);
    steer.setLimits(SENSITIVITY[s]);
  }

  onDestroy(() => { stopCamera(); clearTimeout(flashTimer); });

  const saved = load(KEY);
  if (saved?.tiles?.length) {
    tiles = saved.tiles.map(t => ({ ...t, id: newId() }));
    ({ score, won, keepGoing, over } = saved);
  } else {
    newGame();
  }

  for (let lvl = 1; lvl <= MAX; lvl++) {
    const exts = ["jpg", "png", "webp"];
    const tryNext = () => {
      if (!exts.length) return;
      const src = `${import.meta.env.BASE_URL}photos/eddy-${lvl}.${exts.shift()}`;
      const img = new Image();
      img.onload = () => (photos[lvl] = src);
      img.onerror = tryNext;
      img.src = src;
    };
    tryNext();
  }

  const value = lvl => 2 ** lvl;
  const clamp = v => Math.max(-1.3, Math.min(1.3, v));
</script>

<GameHeader title="Face Steer" {score} {best} onnew={newGame}>
  {#snippet goal()}Steer with your head and reach <strong>Eddy Li (MIT)!</strong>{/snippet}
</GameHeader>

<section class="cam" aria-live="polite">
  <div class="preview" class:hidden={camera !== "on"}>
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={video} playsinline muted></video>
    {#if camera === "on" && lastDir !== null}<span class="flash">{ARROWS[lastDir]}</span>{/if}
  </div>

  {#if camera === "on"}
    <div class="pad" aria-hidden="true">
      <span class="ring"></span>
      <span class="dot" class:fired={lastDir !== null} style="--x: {clamp(dot.x)}; --y: {clamp(dot.y)}"></span>
    </div>
    <div class="info">
      <p>
        {#if !faceSeen}Can't see your face. Move into the light and face the camera.
        {:else if !calibrated}Hold still, finding your neutral position…
        {:else}Tilt left or right, nod down, or tip your head back. Return to center between moves.{/if}
      </p>
      <div class="controls">
        <label>
          Sensitivity
          <select value={sensitivity} onchange={e => setSensitivity(e.currentTarget.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </label>
        <button onclick={recenter}>Recenter</button>
        <button onclick={stopCamera}>Camera off</button>
      </div>
    </div>
  {:else}
    <div class="info">
      {#if camera === "loading"}
        <p>Starting the camera and face tracker…</p>
      {:else if camera === "denied"}
        <p><strong>Camera access was blocked.</strong> You can still play with the arrow keys or by swiping.
          To steer with your head, allow the camera in your browser's site settings and try again.</p>
        <button onclick={startCamera}>Try again</button>
      {:else if camera === "error"}
        <p><strong>{errorText}</strong> The arrow keys and swipes still work.</p>
        <button onclick={startCamera}>Try again</button>
      {:else}
        <p>Face Steer uses your webcam to follow your head. The video is processed only on this device
          and is never uploaded or saved. Your browser will ask for permission.</p>
        <button onclick={startCamera}>Turn on camera</button>
      {/if}
    </div>
  {/if}
</section>

<Board size={SIZE} {tiles} onmove={move}>
  {#snippet tile(t)}
    <div class="face" class:dark={t.lvl <= 2} style="background: var(--t{t.lvl})">
      {#if photos[t.lvl]}
        <img src={photos[t.lvl]} alt={t.lvl === MAX ? "Eddy Li (MIT)" : `Eddy level ${t.lvl}`} draggable="false" />
        <span class="badge">{t.lvl === MAX ? "Eddy Li (MIT)" : value(t.lvl)}</span>
      {:else if t.lvl === MAX}
        <span class="final">Eddy Li<small>MIT</small></span>
      {:else}
        <span class="num" class:d3={value(t.lvl) >= 100} class:d4={value(t.lvl) >= 1000}>{value(t.lvl)}</span>
      {/if}
    </div>
  {/snippet}
  {#snippet overlay()}
    {#if won && !keepGoing}
      <Overlay title="You made Eddy Li (MIT)!" won>
        <button onclick={() => { keepGoing = true; persist(); }}>Keep going</button>
        <button onclick={newGame}>Try again</button>
      </Overlay>
    {:else if over}
      <Overlay title="Game over!">
        <button onclick={newGame}>Try again</button>
      </Overlay>
    {/if}
  {/snippet}
</Board>

<p class="how">
  <strong>How to play:</strong> Turn on the camera and hold still for a second so it learns your neutral pose.
  Tilt your head toward a shoulder to slide left or right, nod down to slide down, and tip your head back to
  slide up. Come back to center before the next move. Arrow keys and swipes work too.
</p>

<style>
  .cam {
    display: flex; gap: 12px; align-items: center; margin: 0 auto 16px; max-width: 500px;
    background: var(--cell); border-radius: 6px; padding: 10px;
  }
  .preview { position: relative; width: 120px; flex-shrink: 0; aspect-ratio: 4 / 3; border-radius: 4px; overflow: hidden; background: #000; }
  .preview.hidden { display: none; }
  video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
  .flash {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font-size: 48px; font-weight: bold; color: #fff; text-shadow: 0 0 8px rgba(0, 0, 0, 0.6);
    animation: flash 400ms ease-out forwards;
  }
  @keyframes flash { from { opacity: 1; transform: scale(1.2); } to { opacity: 0; transform: scale(1); } }
  .pad { position: relative; width: 64px; height: 64px; flex-shrink: 0; border-radius: 4px; background: var(--board); }
  .ring {
    position: absolute; left: 50%; top: 50%; width: 38px; height: 38px; margin: -19px 0 0 -19px;
    border: 2px dashed rgba(255, 255, 255, 0.6); border-radius: 50%;
  }
  .dot {
    position: absolute; left: calc(50% + var(--x) * 19px - 6px); top: calc(50% + var(--y) * 19px - 6px);
    width: 12px; height: 12px; border-radius: 50%; background: var(--t3); transition: background 100ms;
  }
  .dot.fired { background: var(--t9); }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .info p { margin: 0; font-size: 15px; line-height: 1.4; }
  .controls { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; font-size: 14px; }
  label { display: flex; gap: 4px; align-items: center; }
  select { font: inherit; }
  .cam button {
    background: var(--button); color: var(--light-text); border: 0; border-radius: 3px; align-self: flex-start;
    padding: 0 14px; height: 32px; font-size: 15px; font-weight: bold; cursor: pointer;
  }
  .face {
    position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    color: var(--light-text); font-weight: bold; text-align: center;
  }
  .face.dark { color: var(--text); }
  .num { font-size: 11cqw; line-height: 1; }
  .num.d3 { font-size: 9cqw; }
  .num.d4 { font-size: 7cqw; }
  .final { font-size: 5.4cqw; line-height: 1.05; display: flex; flex-direction: column; }
  .final small { font-size: 3.6cqw; opacity: 0.9; }
  img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
  .badge {
    position: absolute; left: 4px; bottom: 4px; background: rgba(0, 0, 0, 0.45); color: #fff;
    border-radius: 3px; padding: 1px 5px; font-size: 2.6cqw;
  }
  .how { margin-top: 28px; line-height: 1.5; }
  @media (max-width: 520px) {
    .cam { flex-wrap: wrap; }
    .preview { width: 96px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .flash { animation: none; opacity: 0; }
    .dot { transition: none; }
  }
</style>
