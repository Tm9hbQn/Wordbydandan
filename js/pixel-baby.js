/* =============================================
   Pixel Art Baby Character - Wordbydandan
   ============================================= */
(function() {
  'use strict';

  var PX = 4;

  // Color palette
  var C = {
    '.': null,
    'H': '#DAA54A', // hair golden blonde
    'h': '#C09038', // hair darker
    'S': '#FDDCB5', // skin
    's': '#EDB78E', // skin shadow
    'E': '#2D1B69', // eye
    'e': '#FFFFFF', // eye highlight
    'M': '#FF8FA0', // blush
    'L': '#E85A7A', // lips / mouth
    'P': '#FFB0C8', // dress pink
    'p': '#FF8FAF', // dress pink darker
    'W': '#FFFFFF', // white dots on dress
    'R': '#FF8FAF', // shoes
  };

  // ==========================================
  // SPRITE DATA  (all rows 12 chars wide)
  // Eyes closer, small ponytail, visible smile
  // ==========================================

  var IDLE = [
    '.....HH.....',  // 0  ponytail (small, close to scalp)
    '....hHHh....',  // 1  ponytail base
    '...HHHHHH...',  // 2  hair top
    '..HHHHHHHH..',  // 3  hair full
    '..HhSSSSHh..',  // 4  forehead
    '..HSSSSSSH..',  // 5  face
    '..SSEeSeES..',  // 6  eyes (close together)
    '..SSSSSSSS..',  // 7  nose
    '..SMSSSSMS..',  // 8  blush cheeks
    '....SLLS....',  // 9  smile
    '....SSSS....',  // 10 chin
    '...pPPPPp...',  // 11 dress top
    '..SpPWPWpS..',  // 12 dress+arms+dots
    '..SpPPPPpS..',  // 13 dress+arms
    '...pPPPPp...',  // 14 dress bottom
    '....SS.SS...',  // 15 legs
    '....RR.RR...',  // 16 shoes
  ];

  var WAVE1 = [
    '.....HH.....',
    '....hHHh....',
    '...HHHHHH...',
    '..HHHHHHHH..',
    '..HhSSSSHh..',
    '..HSSSSSSH..',
    '..SSEeSeES..',
    '..SSSSSSSS..',
    '..SMSSSSMS..',
    '....SLLS....',
    '....SSSS.S..',  // 10 hand at col 9
    '...pPPPPpS..',  // 11 arm at col 9
    '..SpPWPWp...',  // 12 left arm only
    '..SpPPPPp...',  // 13
    '...pPPPPp...',  // 14
    '....SS.SS...',
    '....RR.RR...',
  ];

  var WAVE2 = [
    '.....HH.....',
    '....hHHh....',
    '...HHHHHH...',
    '..HHHHHHHH..',
    '..HhSSSSHh..',
    '..HSSSSSSH..',
    '..SSEeSeES..',
    '..SSSSSSSS..',
    '..SMSSSSMS..',
    '....SLLS..S.',  // 9  hand higher at col 10
    '....SSSS.S..',  // 10 arm at col 9
    '...pPPPPpS..',  // 11 arm connects
    '..SpPWPWp...',  // 12
    '..SpPPPPp...',  // 13
    '...pPPPPp...',  // 14
    '....SS.SS...',
    '....RR.RR...',
  ];

  var SIT = [
    '.....HH.....',
    '....hHHh....',
    '...HHHHHH...',
    '..HHHHHHHH..',
    '..HhSSSSHh..',
    '..HSSSSSSH..',
    '..SSEeSeES..',
    '..SSSSSSSS..',
    '..SMSSSSMS..',
    '....SLLS....',
    '....SSSS....',
    '...pPPPPp...',
    '..SpPWPWpS..',
    '..SSSSSSSS..',  // legs forward (sitting)
    '..RR....RR..',  // shoes
  ];

  var JUMP = [
    '.....HH.....',
    '....hHHh....',
    '...HHHHHH...',
    '..HHHHHHHH..',
    '..HhSSSSHh..',
    '..HSSSSSSH..',
    '..SSEeSeES..',
    '..SSSSSSSS..',
    '..SMSSSSMS..',
    '....SLLS....',
    'S...SSSS...S',  // arms spread
    '.S.pPPPPp.S.',
    '..pPPWPWp...',
    '..pPPPPPp...',
    '...pPPPp....',
    '....S..S....',
    '...RR..RR...',
  ];

  var SPRITES = { idle: IDLE, wave1: WAVE1, wave2: WAVE2, sit: SIT, jump: JUMP };

  // ==========================================
  // RENDERING
  // ==========================================

  function renderToCanvas(canvas, sprite, scale) {
    var cols = sprite[0].length;
    var rows = sprite.length;
    canvas.width = cols * scale;
    canvas.height = rows * scale;
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var color = C[sprite[y][x]];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      }
    }
  }

  function createSprite(name, scale) {
    var canvas = document.createElement('canvas');
    canvas.style.imageRendering = 'pixelated';
    canvas.style.display = 'block';
    renderToCanvas(canvas, SPRITES[name], scale || PX);
    return canvas;
  }

  function setSprite(canvas, name, scale) {
    renderToCanvas(canvas, SPRITES[name], scale || PX);
  }

  // ==========================================
  // BUBBLE
  // ==========================================

  function createBubble(text, extraClass) {
    var el = document.createElement('div');
    el.className = 'pbaby-bubble' + (extraClass ? ' ' + extraClass : '');
    var span = document.createElement('span');
    span.className = 'pbaby-bubble-text';
    span.textContent = text;
    el.appendChild(span);
    var tail = document.createElement('div');
    tail.className = 'pbaby-bubble-tail';
    el.appendChild(tail);
    return el;
  }

  // ==========================================
  // HELPERS
  // ==========================================

  function wait(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

  function inView(el) {
    var r = el.getBoundingClientRect();
    return r.top < window.innerHeight && r.bottom > 0;
  }

  // ==========================================
  // 1. PEEK-A-BOO  (input card left side)
  //    Baby peeks from behind the left edge
  //    of the input card diagonally
  // ==========================================

  function initPeekaboo() {
    var inputContainer = document.querySelector('.input-container');
    if (!inputContainer) return;

    var container = document.createElement('div');
    container.className = 'pbaby-peek';

    var canvas = createSprite('idle', PX);
    container.appendChild(canvas);

    var bubble = createBubble('היי!', 'pbaby-peek-bubble');
    container.appendChild(bubble);

    inputContainer.appendChild(container);

    (async function loop() {
      while (true) {
        await wait(3500);
        if (!inView(inputContainer)) { await wait(2000); continue; }

        // slide out from behind card
        container.classList.add('in');
        await wait(800);

        // wave
        for (var i = 0; i < 6; i++) {
          setSprite(canvas, i % 2 === 0 ? 'wave1' : 'wave2', PX);
          await wait(280);
        }
        setSprite(canvas, 'idle', PX);

        // show bubble
        bubble.classList.add('show');
        await wait(2500);

        // hide bubble
        bubble.classList.remove('show');
        await wait(500);

        // slide back behind card
        container.classList.remove('in');
        await wait(5000);
      }
    })();
  }

  // ==========================================
  // 2. SITTING ON HEADER BLOCK
  // ==========================================

  function initSittingBaby() {
    var block = document.querySelector('.block-b');
    if (!block) return;

    var wrap = document.createElement('div');
    wrap.className = 'pbaby-sit';
    var canvas = createSprite('sit', 2);
    wrap.appendChild(canvas);

    block.style.position = 'relative';
    block.style.overflow = 'visible';
    block.appendChild(wrap);
  }

  // ==========================================
  // 3. CLICKABLE BABY BUTTON
  // ==========================================

  function initClickBaby() {
    var wrapper = document.createElement('div');
    wrapper.className = 'pbaby-click-wrap';

    // popup
    var popup = document.createElement('div');
    popup.className = 'pbaby-click-popup';

    var popupCanvas = createSprite('idle', PX);
    popup.appendChild(popupCanvas);

    var popupBubble = createBubble('אני דניאלה!', 'pbaby-click-bubble');
    popup.appendChild(popupBubble);

    wrapper.appendChild(popup);

    // button
    var btn = document.createElement('button');
    btn.className = 'pbaby-click-btn';
    btn.setAttribute('aria-label', 'לחצו לפגוש את דניאלה');

    var faceCanvas = document.createElement('canvas');
    faceCanvas.style.imageRendering = 'pixelated';
    faceCanvas.style.display = 'block';
    renderToCanvas(faceCanvas, IDLE.slice(0, 11), 3);
    btn.appendChild(faceCanvas);

    wrapper.appendChild(btn);
    document.body.appendChild(wrapper);

    var busy = false;
    btn.addEventListener('click', async function() {
      if (busy) return;
      busy = true;

      popup.classList.add('show');
      await wait(350);

      // jump
      setSprite(popupCanvas, 'jump', PX);
      popup.classList.add('bounce');
      await wait(500);
      popup.classList.remove('bounce');

      // wave
      for (var i = 0; i < 4; i++) {
        setSprite(popupCanvas, i % 2 === 0 ? 'wave1' : 'wave2', PX);
        await wait(280);
      }
      setSprite(popupCanvas, 'idle', PX);

      // bubble
      popupBubble.classList.add('show');
      await wait(2500);

      popupBubble.classList.remove('show');
      await wait(350);
      popup.classList.remove('show');
      busy = false;
    });
  }

  // ==========================================
  // 4. WORDS TITLE - sitting on title
  // ==========================================

  function initWordsTitleBaby() {
    var title = document.querySelector('.words-title');
    if (!title) return;

    title.style.position = 'relative';

    var container = document.createElement('div');
    container.className = 'pbaby-words-title';

    var canvas = createSprite('sit', 2);
    container.appendChild(canvas);

    title.appendChild(container);
  }

  // ==========================================
  // INIT
  // ==========================================

  function init() {
    initPeekaboo();
    initSittingBaby();
    initClickBaby();
    initWordsTitleBaby();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 200);
  }
})();
