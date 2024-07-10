const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold'); // Hold用キャンバス
const holdContext = holdCanvas.getContext('2d'); // Hold用コンテキスト

const scale = 20;
canvas.width = 10 * scale;
canvas.height = 20 * scale;
nextCanvas.width = 4 * scale;
nextCanvas.height = 4 * scale;
holdCanvas.width = 4 * scale; // Holdキャンバスの幅
holdCanvas.height = 4 * scale; // Holdキャンバスの高さ

context.scale(scale, scale);
nextContext.scale(scale, scale);
holdContext.scale(scale, scale); // Holdキャンバスのスケーリング

const arena = createMatrix(10, 20);
const nextPiece = {
  matrix: null,
};
const holdPiece = {
  matrix: null,
  used: false, // Holdを一度使ったかどうか
};
const player = {
  pos: {x: 0, y: 0},
  matrix: null,
  score: 0,
  lines: 0,
  ren: 0,
  tSpins: 0,
  level: 1,
  backToBack: 0,
  isRenActive: false,
};

let language = 'ja';
let gameover = false;
let requestId = null;
let gameStarted = false;

function createMatrix(w, h) {
  const matrix = [];
  while (h--) {
    matrix.push(new Array(w).fill(0));
  }
  return matrix;
}

function createPiece(type) {
  switch (type) {
    case 'I':
      return [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];
    case 'J':
      return [
        [2, 0, 0],
        [2, 2, 2],
        [0, 0, 0],
      ];
    case 'L':
      return [
        [0, 0, 3],
        [3, 3, 3],
        [0, 0, 0],
      ];
    case 'O':
      return [
        [4, 4],
        [4, 4],
      ];
    case 'S':
      return [
        [0, 5, 5],
        [5, 5, 0],
        [0, 0, 0],
      ];
    case 'T':
      return [
        [0, 6, 0],
        [6, 6, 6],
        [0, 0, 0],
      ];
    case 'Z':
      return [
        [7, 7, 0],
        [0, 7, 7],
        [0, 0, 0],
      ];
  }
}

function drawMatrix(matrix, offset, ctx = context, faded = false) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value !== 0) {
        ctx.fillStyle = getColor(value, faded);
        ctx.fillRect(x + offset.x, y + offset.y, 1, 1);
      }
    });
  });
}

function getColor(value, faded) {
  const colors = ['#000000', '#00F0F0', '#0000F0', '#F0A000', '#F0F000', '#00F000', '#A000F0', '#F00000'];
  if (faded) {
    return colors[value] + '99';
  }
  return colors[value];
}

function draw() {
  context.fillStyle = '#000000';
  context.fillRect(0, 0, canvas.width, canvas.height);

  drawMatrix(arena, {x: 0, y: 0}, context, true);
  if (player.matrix) {
    drawMatrix(player.matrix, player.pos);
  }
  drawNext();
  drawHold(); // Holdピースを描画
  drawStats(); // ステータスを描画
}

function drawNext() {
  nextContext.fillStyle = '#000000';
  nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  drawMatrix(nextPiece.matrix, {x: 1, y: 1}, nextContext);
}

function drawHold() {
  holdContext.fillStyle = '#000000';
  holdContext.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (holdPiece.matrix) {
    drawMatrix(holdPiece.matrix, {x: 1, y: 1}, holdContext);
  }
}

function drawStats() {
  const statsElement = document.getElementById('stats');
  if (statsElement) {
    statsElement.innerHTML = `
      <div>${language === 'ja' ? 'REN' : 'REN'}: ${player.ren}</div>
      <div>${language === 'ja' ? 'Lines' : 'Lines'}: ${player.lines}</div>
      <div>${language === 'ja' ? 'T-Spins' : 'T-Spins'}: ${player.tSpins}</div>
      <div>${language === 'ja' ? 'Level' : 'Level'}: ${player.level}</div>
    `;
  }
}

function merge(arena, player) {
  if (player.matrix) {
    player.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          arena[y + player.pos.y][x + player.pos.x] = value;
        }
      });
    });
  }
}

function playerDrop() {
  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--;
    merge(arena, player);
    resetRenAndTSpin();
    playerReset();
    arenaSweep();
    updateScore();
    checkGameOver();
  }
  dropCounter = 0;
}

function playerMove(dir) {
  player.pos.x += dir;
  if (collide(arena, player)) {
    player.pos.x -= dir;
  }
}

function playerReset() {
  if (bag.length === 0) {
    refillBag();
  }
  player.matrix = nextPiece.matrix || createPiece(bag.pop());
  nextPiece.matrix = createPiece(bag.pop());
  player.pos.y = 0;
  player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
  if (collide(arena, player)) {
    gameover = true;
    document.getElementById('tweet-button').classList.remove('hidden');
    document.getElementById('replay-button').classList.remove('hidden');
    cancelAnimationFrame(requestId); // アニメーションフレームをキャンセルしてゲームオーバー時にピースが落ち続けるのを防ぐ
    requestId = null; // requestIdをリセット
  }
  holdPiece.used = false; // 新しいピースが登場するとHoldが再度使用可能になる
}

function playerRotate(dir) {
  const pos = player.pos.x;
  let offset = 1;
  rotate(player.matrix, dir);
  while (collide(arena, player)) {
    player.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > player.matrix[0].length) {
      rotate(player.matrix, -dir);
      player.pos.x = pos;
      return;
    }
  }
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [
        matrix[x][y],
        matrix[y][x],
      ] = [
        matrix[y][x],
        matrix[x][y],
      ];
    }
  }
  if (dir > 0) {
    matrix.forEach(row => row.reverse());
  } else {
    matrix.reverse();
  }
}

function holdPieceFunc() {
  if (!holdPiece.used) {
    if (!holdPiece.matrix) {
      holdPiece.matrix = player.matrix;
      playerReset();
    } else {
      [player.matrix, holdPiece.matrix] = [holdPiece.matrix, player.matrix];
      player.pos.y = 0;
      player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
    }
    holdPiece.used = true;
  }
}

function resetRenAndTSpin() {
  player.ren = 0;
  player.tSpins = 0;
}

let dropCounter = 0;
let dropInterval = 1000;
let level = 1;

let lastTime = 0;
function update(time = 0) {
  const deltaTime = time - lastTime;
  lastTime = time;

  dropCounter += deltaTime;
  if (dropCounter > dropInterval) {
    playerDrop();
  }

  draw();
  if (!gameover) {
    requestId = requestAnimationFrame(update);
  }
}

function startGame() {
  arena.forEach(row => row.fill(0));
  player.score = 0;
  player.lines = 0;
  player.ren = 0;
  player.tSpins = 0;
  player.level = 1;
  gameStarted = true;

  document.getElementById('start-button').classList.add('hidden');
  document.getElementById('replay-button').classList.add('hidden');
  document.getElementById('tweet-button').classList.add('hidden');
  gameover = false;
  playerReset();
  update();
}

function arenaSweep() {
  outer: for (let y = arena.length - 1; y >= 0; --y) {
    for (let x = 0; x < arena[y].length; ++x) {
      if (arena[y][x] === 0) {
        continue outer;
      }
    }

    const row = arena.splice(y, 1)[0].fill(0);
    arena.unshift(row);
    ++y;

    player.score += 100;
    player.lines++;
    if (player.lines % 10 === 0) {
      player.level++;
      dropInterval *= 0.8; // レベルが上がると落下間隔が短くなる
    }
    calculateRen();
    calculateTSpin();
    updateScore();
  }
}

function calculateRen() {
  if (player.ren >= 2) {
    player.backToBack++;
  } else {
    player.backToBack = 0;
  }

  if (player.lines === 0) {
    player.isRenActive = false;
  } else if (player.lines <= 1) {
    player.ren++;
    player.isRenActive = true;
  } else {
    player.ren++;
    player.isRenActive = true;
  }
}

function calculateTSpin() {
  if (player.matrix === 'T' && player.lines) {
    player.tSpins++;
  }
}

function collide(arena, player) {
  const [m, o] = [player.matrix, player.pos];
  for (let y = 0; y < m.length; ++y) {
    for (let x = 0; x < m[y].length; ++x) {
      if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
        return true;
      }
    }
  }
  return false;
}

const bag = [];
refillBag();
playerReset();
updateScore();
updateLanguage();
document.getElementById('language-select').addEventListener('change', (event) => {
  language = event.target.value;
  updateLanguage();
});

document.getElementById('start-button').addEventListener('click', startGame);
document.getElementById('replay-button').addEventListener('click', startGame);
document.getElementById('tweet-button').addEventListener('click', () => {
  const tweetText = language === 'ja' 
    ? `B-Tetrisで${player.score}ポイントを獲得しました！`
    : `I scored ${player.score} points in B-Tetris!`;
  const official_account = language === 'ja'
    ? `BTetris_Japan`
    : `Browser_Tetris`
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}&hashtags=BTetris%20%0avia%20@${official_account}`;
  window.open(url, '_blank');
});

document.getElementById('info-button').addEventListener('click', () => {
  const infoText = language === 'ja'
    ? "操作方法:\n- 左右キー/A/D: 左右移動\n- 下キー/S: ソフトドロップ\n- Q: 左回転\n- E: 右回転\n- F: ホールド\n\n開発者: https://github.com/shiro-shihi"
    : "Controls:\n- Left/Right Arrow/A/D: Move\n- Down Arrow/S: Soft Drop\n- Q: Rotate Left\n- E: Rotate Right\n- F: Hold\n\nDeveloper: https://github.com/shiro-shihi";
  alert(infoText);
});

function updateLanguage() {
  document.getElementById('tweet-button').innerText = language === 'ja' ? 'スコアをツイート' : 'Tweet Score';
  document.getElementById('info-button').innerText = language === 'ja' ? '操作説明' : 'Instructions';
  document.getElementById('start-button').innerText = language === 'ja' ? 'プレイ開始' : 'Start';
  document.getElementById('replay-button').innerText = language === 'ja' ? '再プレイ' : 'Replay';
  // document,getElementById('score').innerText = language === 'ja' ? 'スコア' : 'Score';
  drawStats();
}

function checkGameOver() {
  if (gameover) {
    alert(language === 'ja' ? 'ゲームオーバー！' : 'Game Over!');
    cancelAnimationFrame(requestId);
    requestId = null;
    gameStarted = false; // ゲームオーバー時にフラグをリセット
    document.removeEventListener('keydown', handleKeyPress);
  }
}

function handleKeyPress(event) {
  if (!gameover) {
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
      playerMove(-1);
    } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
      playerMove(1);
    } else if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
      playerDrop();
    } else if (event.key === 'q' || event.key === 'Q') {
      playerRotate(-1);
    } else if (event.key === 'e' || event.key === 'E') {
      playerRotate(1);
    } else if (event.key === 'f' || event.key === 'F') {
      holdPieceFunc();
    }
  }
  if (event.key === ' ' && !gameStarted) {
    startGame();
  }
}

document.getElementById('replay-button').classList.add('hidden');
document.getElementById('start-button').classList.remove('hidden');
document.addEventListener('keydown', handleKeyPress); // 初期ロード時にスペースキーでゲーム開始

function refillBag() {
  const pieces = 'IJLOSTZ';
  pieces.split('').forEach(type => {
    bag.push(type);
  });
  shuffle(bag);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function updateScore() {
  document.getElementById('score').innerText = `${language === 'ja' ? 'スコア' : 'Score'}: ${player.score}`;
}
