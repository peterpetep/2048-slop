<script>
  // Point & Shoot: classic 2048 where the tiles are pieces of a camera picture.
  // A new tile copies the piece of the live frame at its cell; a merged tile grabs a fresh,
  // wider view centred where it lands (see logic.js), so a 2048 tile is the whole picture.
  // Freeze or upload a photo to use one fixed picture instead of the live feed.
  import GameHeader from "../../lib/GameHeader.svelte";
  import Board from "../../lib/Board.svelte";
  import Overlay from "../../lib/Overlay.svelte";
  import { slide, spawn, canMove, newId } from "../../lib/engine.js";
  import { load, save } from "../../lib/storage.js";
  import { viewRect, centerSquare } from "./logic.js";

  const SIZE = 4, MAX = 11, KEY = "point-shoot-v1";
  const FRAME = 640, TILE = 160;

  let tiles = $state([]);
  let score = $state(0);
  let best = $state(load(KEY + ":best", 0));
  let won = $state(false);
  let keepGoing = $state(false);
  let over = $state(false);

  let camera = $state("off"); // off | loading | on | denied | error
  let errorText = $state("");
  let facing = $state(load(KEY + ":facing", "environment"));
  let frozen = $state(false);
  let stillUrl = $state(null);
  let video = $state();
  let fileInput = $state();
  let stream = null;

  // Off-screen canvases: the square picture, the frozen/uploaded picture, and one tile crop.
  const frame = document.createElement("canvas");
  frame.width = frame.height = FRAME;
  const still = document.createElement("canvas");
  still.width = still.height = FRAME;
  const crop = document.createElement("canvas");
  crop.width = crop.height = TILE;
  let hasStill = false;

  const live = () => camera === "on" && video?.readyState >= 2 && video.videoWidth > 0;
  const mirrored = $derived(facing === "user");

  // Draw the current picture into `frame`. Returns false when there is no picture yet.
  function grabFrame() {
    const ctx = frame.getContext("2d");
    if (!frozen && live()) {
      const { sx, sy, s } = centerSquare(video.videoWidth, video.videoHeight);
      ctx.save();
      if (mirrored) { ctx.translate(FRAME, 0); ctx.scale(-1, 1); }
      ctx.drawImage(video, sx, sy, s, s, 0, 0, FRAME, FRAME);
      ctx.restore();
      return true;
    }
    if (hasStill) { ctx.drawImage(still, 0, 0); return true; }
    return false;
  }

  function pieceFor(t) {
    const v = viewRect(t.lvl, t.r, t.c, SIZE, MAX);
    const ctx = crop.getContext("2d");
    ctx.drawImage(frame, v.x * FRAME, v.y * FRAME, v.w * FRAME, v.w * FRAME, 0, 0, TILE, TILE);
    return crop.toDataURL("image/jpeg", 0.8);
  }

  // Give a picture to every tile that matches `needs`, using one frame for all of them.
  function paint(list, needs) {
    if (!list.some(needs) || !grabFrame()) return list;
    return list.map(t => (needs(t) ? { ...t, img: pieceFor(t) } : t));
  }

  function newGame() {
    tiles = [];
    const first = spawn([], SIZE);
    tiles = paint([{ ...first, isNew: true }, { ...spawn([first], SIZE), isNew: true }], () => true);
    score = 0; won = false; keepGoing = false; over = false;
    persist();
  }

  function move(dir) {
    if (over || (won && !keepGoing)) return;
    const current = tiles.filter(t => !t.gone).map(({ id, lvl, r, c, img }) => ({ id, lvl, r, c, img }));
    const res = slide(current, SIZE, dir, MAX);
    if (!res.moved) return;
    let next = res.tiles;
    const extra = spawn(next, SIZE);
    if (extra) next.push({ ...extra, isNew: true });
    next = paint(next, t => t.merged || t.isNew || !t.img);
    tiles = [...next, ...res.consumed.map(t => ({ ...t, gone: true }))];
    setTimeout(() => (tiles = tiles.filter(t => !t.gone)), 120);
    score += res.gained;
    if (score > best) { best = score; save(KEY + ":best", best); }
    if (res.topLvl === MAX && !won) won = true;
    if (!canMove(next, SIZE, MAX)) over = true;
    persist();
  }

  function persist() {
    save(KEY, {
      tiles: tiles.filter(t => !t.gone).map(({ lvl, r, c, img }) => ({ lvl, r, c, img })),
      score, won, keepGoing, over,
    });
  }

  // Tiles from before the camera was on get their picture as soon as there is one.
  function fillBlanks() {
    tiles = paint(tiles, t => !t.gone && !t.img);
    persist();
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      camera = "error";
      errorText = "This browser can't use a camera here. Point & Shoot needs a secure (https) page.";
      return;
    }
    stopCamera();
    camera = "loading";
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (e) {
      camera = e?.name === "NotAllowedError" || e?.name === "SecurityError" ? "denied" : "error";
      errorText = e?.name === "NotFoundError" ? "No camera was found." : "The camera couldn't be started.";
      return;
    }
    video.srcObject = stream;
    await video.play().catch(() => {});
    camera = "on";
    if (video.readyState >= 2) fillBlanks();
    else video.addEventListener("loadeddata", fillBlanks, { once: true });
  }

  function stopCamera() {
    stream?.getTracks().forEach(t => t.stop());
    stream = null;
    if (video) video.srcObject = null;
    camera = "off";
  }

  function flip() {
    facing = facing === "user" ? "environment" : "user";
    save(KEY + ":facing", facing);
    if (camera === "on") startCamera();
  }

  function toggleFreeze() {
    if (frozen) { frozen = false; return; }
    if (!grabFrame()) return;
    still.getContext("2d").drawImage(frame, 0, 0);
    hasStill = true;
    stillUrl = still.toDataURL("image/jpeg", 0.85);
    frozen = true;
  }

  function upload(e) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const { sx, sy, s } = centerSquare(img.naturalWidth, img.naturalHeight);
      still.getContext("2d").drawImage(img, sx, sy, s, s, 0, 0, FRAME, FRAME);
      URL.revokeObjectURL(url);
      hasStill = true;
      stillUrl = still.toDataURL("image/jpeg", 0.85);
      frozen = true;
      fillBlanks();
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  }

  $effect(() => () => stopCamera());

  const saved = load(KEY);
  if (saved?.tiles?.length) {
    tiles = saved.tiles.map(t => ({ ...t, id: newId() }));
    ({ score, won, keepGoing, over } = saved);
  } else {
    newGame();
  }

  const value = lvl => 2 ** lvl;
</script>

<GameHeader title="Point & Shoot" {score} {best} onnew={newGame}>
  {#snippet goal()}Point your camera at someone and merge up to <strong>the whole picture!</strong>{/snippet}
</GameHeader>

<section class="cam" aria-live="polite">
  <div class="preview" class:hidden={camera !== "on" && !frozen}>
    <!-- svelte-ignore a11y_media_has_caption -->
    <video bind:this={video} playsinline muted class:mirrored class:hidden={frozen}></video>
    {#if frozen && stillUrl}<img src={stillUrl} alt="Frozen picture" />{/if}
    <div class="grid" aria-hidden="true"></div>
    {#if frozen}<span class="tag">Frozen</span>{/if}
  </div>

  <div class="info">
    {#if camera === "loading"}
      <p>Starting the camera…</p>
    {:else if camera === "denied" && !frozen}
      <p><strong>Camera access was blocked.</strong> Allow it in your browser's site settings, or upload a photo instead.</p>
    {:else if camera === "error" && !frozen}
      <p><strong>{errorText}</strong> You can upload a photo instead.</p>
    {:else if camera === "on" && !frozen}
      <p>Live. Every new tile is the piece of the picture in its spot. Keep your subject in the frame.</p>
    {:else if frozen}
      <p>Using one fixed picture.{#if camera === "on"} Unfreeze to go back to the live feed.{/if}</p>
    {:else}
      <p>Point your phone at someone and tiles become pieces of what the camera sees. Nothing is uploaded or saved
        except the tile pictures on this device.</p>
    {/if}
    <div class="controls">
      {#if camera === "on"}
        <button onclick={toggleFreeze}>{frozen ? "Unfreeze" : "Freeze"}</button>
        <button onclick={flip}>Flip camera</button>
        <button onclick={stopCamera}>Camera off</button>
      {:else if camera !== "loading"}
        <button onclick={startCamera}>{camera === "off" ? "Turn on camera" : "Try again"}</button>
      {/if}
      <button onclick={() => fileInput.click()}>Upload photo</button>
      <input bind:this={fileInput} type="file" accept="image/*" onchange={upload} hidden />
    </div>
  </div>
</section>

<Board size={SIZE} {tiles} onmove={move}>
  {#snippet tile(t)}
    <div class="face" class:dark={t.lvl <= 2} style="background: var(--t{Math.min(t.lvl, 11)})">
      {#if t.img}
        <img src={t.img} alt="" draggable="false" />
        <span class="badge" class:top={t.lvl >= MAX}>{value(t.lvl)}</span>
      {:else}
        <span class="num" class:d3={value(t.lvl) >= 100} class:d4={value(t.lvl) >= 1000}>{value(t.lvl)}</span>
      {/if}
    </div>
  {/snippet}
  {#snippet overlay()}
    {#if won && !keepGoing}
      <Overlay title="You got the whole picture!" won>
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
  <strong>How to play:</strong> Turn on the camera and aim it at someone. Swipe or use the arrow keys to slide.
  Each new tile copies the piece of the live picture at its spot, and keeps it as it slides around. When two
  matching tiles merge, the new tile snaps a wider view centred where it lands: a 64 shows about half the frame,
  and a 2048 shows the whole picture. Freeze the frame, or upload a photo, to play with one fixed picture.
</p>

<style>
  .cam {
    display: flex; gap: 12px; align-items: center; margin: 0 auto 16px; max-width: 500px;
    background: var(--cell); border-radius: 6px; padding: 10px;
  }
  .preview {
    position: relative; width: 120px; flex-shrink: 0; aspect-ratio: 1; border-radius: 4px; overflow: hidden;
    background: #000;
  }
  .preview.hidden { display: none; }
  .preview video, .preview img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  video.mirrored { transform: scaleX(-1); }
  video.hidden { visibility: hidden; }
  .grid {
    position: absolute; inset: 0; pointer-events: none;
    background-image:
      linear-gradient(to right, rgba(255, 255, 255, 0.45) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.45) 1px, transparent 1px);
    background-size: 25% 25%;
  }
  .tag {
    position: absolute; left: 4px; top: 4px; background: rgba(0, 0, 0, 0.55); color: #fff;
    border-radius: 3px; padding: 1px 5px; font-size: 11px; font-weight: bold;
  }
  .info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .info p { margin: 0; font-size: 15px; line-height: 1.4; }
  .controls { display: flex; flex-wrap: wrap; gap: 6px; }
  .cam button {
    background: var(--button); color: var(--light-text); border: 0; border-radius: 3px;
    padding: 0 12px; height: 32px; font-size: 14px; font-weight: bold; cursor: pointer;
  }
  .face {
    position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
    color: var(--light-text); font-weight: bold; text-align: center;
  }
  .face.dark { color: var(--text); }
  .num { font-size: 11cqw; line-height: 1; }
  .num.d3 { font-size: 9cqw; }
  .num.d4 { font-size: 7cqw; }
  .face img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
  .badge {
    position: absolute; left: 4px; bottom: 4px; background: rgba(0, 0, 0, 0.5); color: #fff;
    border-radius: 3px; padding: 1px 5px; font-size: 2.8cqw; line-height: 1.3;
  }
  .badge.top { background: var(--t11); color: var(--light-text); }
  .how { margin-top: 28px; line-height: 1.5; }
  @media (max-width: 420px) {
    .preview { width: 96px; }
    .info p { font-size: 14px; }
  }
</style>
