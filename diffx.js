// --- Global Variables ---
let playerName = '';
let userScore = 0;
let wrongCounter = 0;
let puzzleData = {};
let finished = true;
let justStarted = true;
let timerInterval = null;

const db = firebase.firestore();
const collectionName = 'diffGame';
let gameId = null;
let gameDocRef = null;

// --- DOM Elements ---
const passDiv = document.getElementById('passDiv');
const savedDiv = document.getElementById('savedDiv');
const gameDiv = document.getElementById('gameDiv');
const waitMsg = document.getElementById('waitMsg');
const wholeDiv = document.getElementById('wholeDiv');
const scoreTable = document.getElementById('scoreTable');
const puzzImage = document.getElementById('puzzImage');
const circleDiv = document.getElementById('circleDiv');
const timerEl = document.getElementById('timer');
const userScoreEl = document.getElementById('userScoreTD');
const diffNumEl = document.getElementById('diffNum');
const playerNameInput = document.getElementById('playerNameInput');
const savedPlayerNameEl = document.getElementById('savedPlayerName');
const playerNEl = document.getElementById('playerN');


// --- Main Functions ---

document.addEventListener('DOMContentLoaded', () => {
    getDocName();
    if (!gameId) {
        passDiv.innerHTML = '<p class="passText">رابط اللعبة غير صحيح</p>';
        passDiv.style.display = 'block';
        return;
    }
    gameDocRef = db.collection(collectionName).doc(gameId);
    getSavedData();
    listenToGame();
});

function getDocName() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        gameId = urlParams.get('id');
    } catch (e) {
        console.error("Could not get game ID from URL", e);
        gameId = null;
    }
}

function getSavedData() {
    const savedName = localStorage.getItem('diff_playerName');
    if (savedName) {
        playerName = savedName;
        savedPlayerNameEl.innerText = playerName;
        savedDiv.style.display = 'block';
    } else {
        passDiv.style.display = 'block';
    }
}

function saveData() {
    localStorage.setItem('diff_playerName', playerName);
}

function removeData() {
    localStorage.removeItem('diff_playerName');
}

window.changeUser = function() {
    removeData();
    playerName = '';
    savedDiv.style.display = 'none';
    passDiv.style.display = 'block';
};

window.goPlay = function() {
    if (!playerName) {
        const inputName = playerNameInput.value.trim();
        if (!inputName) {
            document.getElementById('wrongPass').style.display = 'block';
            return;
        }
        playerName = inputName;
        saveData();
    }
    passDiv.style.display = 'none';
    savedDiv.style.display = 'none';
    gameDiv.style.display = 'block';
    waitMsg.style.display = 'block';
    playerNEl.innerText = playerName;
};

function listenToGame() {
    if (!gameDocRef) return;

    gameDocRef.onSnapshot((doc) => {
        if (!doc.exists) {
            waitMsg.innerHTML = '<p class="wait2">انتهت هذه اللعبة أو تم حذفها</p>';
            if(timerInterval) clearInterval(timerInterval);
            wholeDiv.style.display = 'none';
            scoreTable.style.display = 'none';
            waitMsg.style.display = 'block';
            return;
        }

        const data = doc.data();

        if (justStarted) {
             waitMsg.style.display = 'block';
             wholeDiv.style.display = 'none';
             scoreTable.style.display = 'none';
        }

        if (data.gameStarted && data.mySentArray && data.mySentArray.length > 1 && finished) {
            justStarted = false;
            waitMsg.style.display = 'none';
            scoreTable.style.display = 'none';
            wholeDiv.style.display = 'block';
            startGame(data.mySentArray);
        } else if (data.myEndGame && !finished) {
            endGame(true); // Ended by host
        } else if (data.showAnswer && !finished) {
            solve();
        } else if (data.showScore) {
            justStarted = false;
            waitMsg.style.display = 'none';
            wholeDiv.style.display = 'none';
            createScoreTable(data.myUserArray, data.myScoreArray, data.myLastScoreArray);
            scoreTable.style.display = 'table';
        }
    }, (error) => {
        console.error("Error listening to game doc: ", error);
        waitMsg.innerHTML = '<p class="wait2">فُقد الاتصال باللعبة</p>';
    });
}

function startGame(sentArray) {
    // Reset state for new round
    userScore = 0;
    wrongCounter = 0;
    finished = false;
    userScoreEl.innerText = userScore;
    puzzImage.classList.remove('puzzImgGrey');

    // Unpack data from host
    const [, timerValue, puzzName, puzzleSize, maxWrong, imageLink, isPhoto, isPhoto2] = sentArray;
    puzzleData = { puzzName, puzzleSize, maxWrong, imageLink, isPhoto, isPhoto2 };
    
    diffNumEl.innerText = puzzleSize;
    puzzImage.src = imageLink;

    prepareCircles();
    startTimer(timerValue, timerEl);
}

function prepareCircles() {
    circleDiv.innerHTML = '';
    const diffs = puzzleData.puzzName.split('y');
    const imageShift = puzzleData.isPhoto ? 67.5 : (puzzleData.isPhoto2 ? 68.5 : 53.5);

    for (let i = 0; i < diffs.length; i++) {
        const top = diffs[i].split('x')[0].replace('z', '.');
        const left = diffs[i].split('x')[1].replace('z', '.');

        // Create circle for the left image
        const circle1 = document.createElement('img');
        circle1.id = `diff_${i}`;
        circle1.className = 'circleImage';
        circle1.style.top = `${top}vmin`;
        circle1.style.left = `${left}vmin`;
        circle1.src = 'about:blank'; // Use transparent image to be clickable
        circle1.setAttribute('onclick', `puzzClick(${i})`);
        circle1.style.display = 'block';
        
        // Create circle for the right image
        const circle2 = document.createElement('img');
        circle2.id = `diff_${i}_2`;
        circle2.className = 'circleImage';
        circle2.style.top = `${parseFloat(top) + imageShift}vmin`;
        circle2.style.left = `${left}vmin`;
        circle2.src = 'about:blank';
        circle2.setAttribute('onclick', `puzzClick(${i})`);
        circle2.style.display = 'block';

        circleDiv.appendChild(circle1);
        circleDiv.appendChild(circle2);
    }
}

window.puzzClick = function(index) {
    if (finished) return;

    const c1 = document.getElementById(`diff_${index}`);
    if (c1.style.opacity === '1') return; // Already found

    // Mark as found
    c1.src = 'https://pixflex.github.io/Diffrent/img/diff/makerD/found_green.png';
    c1.style.opacity = '1';
    const c2 = document.getElementById(`diff_${index}_2`);
    c2.src = 'https://pixflex.github.io/Diffrent/img/diff/makerD/found_green.png';
    c2.style.opacity = '1';

    // Update score
    userScore++;
    userScoreEl.innerText = userScore;

    // Check for win
    if (userScore >= puzzleData.puzzleSize) {
        endGame(false); // Player finished
    }
};

window.wrongClick = function() {
    if (finished) return;
    
    wrongCounter++;
    
    if (wrongCounter < puzzleData.maxWrong) {
        puzzImage.classList.add('puzzImgGrey');
        setTimeout(() => puzzImage.classList.remove('puzzImgGrey'), 500);
    } else {
        puzzImage.classList.add('puzzImgGrey');
        endGame(false); // Player lost by too many wrong clicks
    }
};

function endGame(wasHost) {
    if (finished) return;
    finished = true;
    if (timerInterval) clearInterval(timerInterval);

    if (wasHost) {
        timerEl.innerText = 'انتهى الوقت';
        timerEl.style.color = '#ff0000';
    }
    
    sendScore();
    solve(); // Show missed answers

    // Show waiting message for next round
    setTimeout(() => {
        wholeDiv.style.display = 'none';
        waitMsg.style.display = 'block';
    }, 2000);
}

function sendScore() {
    const scoreData = `${playerName}@@${userScore}@@${Math.random().toString(36).substring(2, 10)}`;
    gameDocRef.update({
        myUserSentArray: firebase.firestore.FieldValue.arrayUnion(scoreData)
    }).catch(err => console.error("Failed to send score:", err));
}

function solve() {
    if (!puzzleData.puzzName) return;
    const diffs = puzzleData.puzzName.split('y');
    for (let i = 0; i < diffs.length; i++) {
        const c1 = document.getElementById(`diff_${i}`);
        if (c1 && c1.style.opacity !== '1') { // If not found by player
            c1.src = 'https://pixflex.github.io/Diffrent/img/diff/makerD/found_red.png';
            c1.style.opacity = '1';
            const c2 = document.getElementById(`diff_${i}_2`);
            c2.src = 'https://pixflex.github.io/Diffrent/img/diff/makerD/found_red.png';
            c2.style.opacity = '1';
        }
    }
}

function createScoreTable(userArray = [], scoreArray = [], lastScoreArray = []) {
    while (scoreTable.rows.length > 0) {
        scoreTable.deleteRow(0);
    }

    // Use a proper table head element for semantics and styling
    const thead = scoreTable.createTHead();
    const headerRow = thead.insertRow();
    // Add Rank column to header
    headerRow.innerHTML = '<th>الترتيب</th><th>اسم اللاعب</th><th>النقاط</th><th>آخر جولة</th>';

    const tbody = scoreTable.createTBody();

    for (let i = 0; i < userArray.length; i++) {
        const row = tbody.insertRow();
        if (i % 2 === 1) { // for zebra striping
            row.className = 'even-row';
        }

        const rankCell = row.insertCell(0);
        const nameCell = row.insertCell(1);
        const scoreCell = row.insertCell(2);
        const lastScoreCell = row.insertCell(3);

        // Add medal icons for top 3, numbers for the rest
        if (i === 0) {
            rankCell.innerHTML = '🥇';
        } else if (i === 1) {
            rankCell.innerHTML = '🥈';
        } else if (i === 2) {
            rankCell.innerHTML = '🥉';
        } else {
            rankCell.innerText = i + 1;
        }

        nameCell.innerText = userArray[i] || 'لاعب';
        scoreCell.innerText = scoreArray[i] || '0';
        lastScoreCell.innerText = lastScoreArray[i] || '0';

        // Add classes for styling from CSS
        rankCell.className = 'rank-cell';
        nameCell.className = 'name-cell';
        scoreCell.className = 'score-cell';
        lastScoreCell.className = 'last-score-cell';

        // Highlight positive scores in the last round
        if (lastScoreArray[i] && Number(lastScoreArray[i]) > 0) {
            lastScoreCell.classList.add('positive-score');
        }
    }
}

function startTimer(duration, display) {
    let timer = duration;
    timerEl.style.color = '#ffffff';

    const updateDisplay = () => {
        if (finished) return;
        const minutes = Math.floor(timer / 60);
        let seconds = timer % 60;
        seconds = seconds < 10 ? '0' + seconds : seconds;
        display.textContent = `${minutes}:${seconds}`;
        if (timer <= 10) display.style.color = '#ff0000';
        else if (timer <= 20) display.style.color = '#ffdd00';

    };
    
    updateDisplay(); // Initial display

    timerInterval = setInterval(() => {
        if (--timer < 0) {
            endGame(false); // Time's up
        } else {
            updateDisplay();
        }
    }, 1000);
}