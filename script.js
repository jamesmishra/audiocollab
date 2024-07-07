// This JavaScript file contains the bulk of the logic for
// the project.
// Note that this is BARE JavaScript. We did not use either
// TypeScript or React.

// We put our entire script inside of a window.onload function
// so that we are certain that the webpage has completely loaded
// before we try maniipulating the HTML tags, the canvas,
// or the Web Audio API.
window.onload = function() {
    // Audio variables
    // Set to true when we are playing audio.
    let isPlaying = false;
    // The number of audio channels to have in our buffer.
    // 2 channels = stereo audio
    let numAudioChannels = 2;
    // The sample rate of the audio we are generating.
    // 44100hz is the industry standard for music audio.
    let sampleRateHz = 44100;
    // The ratio of our sample rate relative to the width
    // of the canvas. Our canvas is going to be 100 times smaller.
    let downsampleRatio = 100;
    // The length of our audio buffer in seconds.
    let durationSeconds = 1;
    // The length of our audio buffer in samples per channel.
    let durationSamplesPerChannel = sampleRateHz * durationSeconds;
    // The main object for interacting with the Web Audio API.
    let audioCtx = new AudioContext();
    // The audio buffer that we will be filling with audio data.
    let audioBuffer = null;
    // The Web Audio API node used for reading from our audio buffer.
    let audioSource = null;

    // Canvas variables
    // Set to true when we are drawing points on the screen.
    let isDrawing = false;
    // A reference to the <canvas> tag in the HTML file.
    let canvasTag = document.getElementById('myCanvas');
    // The width and height of our canvas tag. The width is determined
    // by the downsampleRatio above.
    canvasTag.width = Math.floor(sampleRateHz / downsampleRatio);
    canvasTag.height = 400;
    // The Y-offset value that indicates the canvas's X midpoint.
    let horizontalAxisOffset = Math.floor(canvasTag.height / 2);
    // The radius of the start and end circles that we will be rendering.
    let circleRadius = 5;
    // A reference to the canvas's context object.
    // This is how we will be interacting with the Canvas API.
    let canvasCtx = canvasTag.getContext("2d");
    // This is the data structure where we store all of the X and Y points
    // that we paint on the screen.
    let canvasDrawing = new Array();
    // This is the maximum X value in the drawing.
    let maxX = -1;
    
    // Control variables
    // This is the Reset Drawing button.
    let clearButton = document.getElementById('clearButton');
    // This is the Play Audio / Stop Audio button.
    // It is disabld until we have audio to play.
    let playStopButton = document.getElementById('playStopButton');
    playStopButton.disabled = true;
    // This is the part of the screen that displays the X and Y position
    // of the cursor over the canvas.
    let positionDisplay = document.getElementById('positionDisplay');

    // This scales Y from [0, canvasTag.height] to [-1, 1].
    function normalizeAmplitude(y) {
        return -2 * (y / canvasTag.height) - 1
    }
    
    // Updates the screen with the X and Y position of the cursor
    // relative to the canvas.
    function updatePosition(x, y) {
        positionDisplay.innerHTML = "x: " + x + ", y: " + y;
    }

    // This convers the canvasDrawing data structure into
    // an AudioBuffer object that can be accepted by the Web Audio API.
    function newAudioBufferFromCanvasDrawing() {
        // We create a new AudioBuffer object.
        const buf = audioCtx.createBuffer(
            numAudioChannels,
            durationSamplesPerChannel,
            sampleRateHz,
        );
        // We insert the same audio samples for every channel.
        // We assume that we are producing a stereo AudioBuffer.
        for (let channel = 0; channel < numAudioChannels; channel++) {
            // Get the buffer for the current channel.
            const channelBuf = buf.getChannelData(channel);

            // Iterate over the canvasDrawing array, converting its entries
            // into audio samples.
            // Audio samples (Y) must be floating point values between -1 and 1 inclusive.
            // Their location in the buffer (X) must be scaled so that we have
            // `durationSamplesPerChannel` samples from a drawing that only had
            // `canvasDrawing.length` samples.
            for(let i = 1; i < canvasDrawing.length; i++) {
                // We get the X and Y of the previous point in the drawing.
                // We scale the X up by the downsample ratio.
                // We scale the Y from [0, canvasTag.height] to [-1, 1].
                let x0 = canvasDrawing[i - 1].x * downsampleRatio;
                let y0 = normalizeAmplitude(canvasDrawing[i - 1].y);
                // We do the same scaling for the X and Y of the "current" point
                // in the drawing.
                let x1 = canvasDrawing[i].x * downsampleRatio;
                let y1 = normalizeAmplitude(canvasDrawing[i].y);
                // We calculate the slope of the line that contains these
                // two points.
                let slope = (y1 - y0) / (x1 - x0);
                // We calculate the Y value of the line at the X value of the
                // current audio sample, which is a value interpolated from
                // [x0, x1].
                for (let j = 1; j < downsampleRatio; j++) {
                    const xj = (i - 1) * downsampleRatio + j;
                    const yj = y0 + slope * (xj - x0);
                    channelBuf[xj] = yj
                }
            }
        }
        return buf;
    }

    // Stop the audio and delete references to the audio buffer and source.
    function stopAudio() {
        // Stop playing the audio if the audio source exists.
        if (audioSource !== null && audioSource !== undefined) {
            audioSource.stop();
        }
        audioSource = null;
        audioBuffer = null;
        isPlaying = false;
        playStopButton.value = "Play Audio";
    }

    // Convert the drawing into an AudioBuffer and play it.
    function playAudio() {
        isPlaying = true;
        playStopButton.value = "Stop Audio";
        audioBuffer = newAudioBufferFromCanvasDrawing();
        audioSource = audioCtx.createBufferSource();
        audioSource.onended = stopAudio;
        audioSource.buffer = audioBuffer;
        audioSource.connect(audioCtx.destination);
        audioSource.start();
    }

    // Stop if we are playing audio. Play audio if we are stopped.
    function togglePlayStop() {
        if (isPlaying) {
            stopAudio();
        } else {
            playAudio();
        }
    }
    
    // Clear the canvas, draw the background, and then draw the line.
    function renderCanvas() {
        // Clear everything for a new redraw.
        canvasCtx.fillStyle = 'rgba(0,0,0)';
        canvasCtx.clearRect(0, 0, canvasTag.width, canvasTag.height);
        
        // Draw the rectangle that shows the part of the waveform
        // that has been written.
        canvasCtx.fillStyle = 'rgba(225,225,225)';
        canvasCtx.fillRect(0, 0, maxX, canvasTag.height);
        canvasCtx.fillStyle = 'rgba(0,0,0)';

        // Draw the vertical line that shows where the max X should be.
        canvasCtx.lineWidth = 1;
        canvasCtx.lineCap = "round";
        canvasCtx.strokeStyle = "black";
        canvasCtx.beginPath();
        canvasCtx.moveTo(maxX, 0);
        canvasCtx.lineTo(maxX, canvasTag.height);
        canvasCtx.closePath();
        canvasCtx.stroke();

        // Draw left circle
        canvasCtx.beginPath();
        canvasCtx.arc(0, horizontalAxisOffset, circleRadius, 0, 2 * Math.PI);
        canvasCtx.fill();
        canvasCtx.closePath();

        // Draw right circle
        canvasCtx.beginPath();
        canvasCtx.arc(canvasTag.width, horizontalAxisOffset, circleRadius, 0, 2 * Math.PI);
        canvasCtx.fill();
        canvasCtx.closePath();

        // Draw the line connecting the circles.
        canvasCtx.beginPath();
        canvasCtx.moveTo(0, horizontalAxisOffset);
        canvasCtx.lineTo(canvasTag.width, horizontalAxisOffset);
        canvasCtx.closePath();
        canvasCtx.stroke();

        // Draw the text labels
        canvasCtx.font = "12px Arial";
        canvasCtx.fillText("START", 0, horizontalAxisOffset - circleRadius);
        canvasCtx.fillText("END", canvasTag.width - 30, horizontalAxisOffset - circleRadius);
        canvasCtx.fillText("0s", 0, horizontalAxisOffset + circleRadius * 3);
        canvasCtx.fillText(`${durationSeconds}s`, canvasTag.width - 15, horizontalAxisOffset + circleRadius * 3);
        
        // Draw the waveform.
        canvasCtx.lineWidth = 5;
        canvasCtx.lineCap = "round";
        canvasCtx.strokeStyle = "green";
        for(let i = 1; i < canvasDrawing.length; i++) {
            // When the user moves the mouse very quickly,
            // the points drawn on the screen can be very far apart.
            // To fix this, instead of drawing single points,
            // we draw lines from the cursor's previous location to
            // the current location.
            let prevPoint = canvasDrawing[i - 1];
            let curPoint = canvasDrawing[i];
            canvasCtx.beginPath();
            canvasCtx.moveTo(prevPoint.x, prevPoint.y);
            canvasCtx.lineTo(curPoint.x, curPoint.y);
            canvasCtx.closePath();
            canvasCtx.stroke();
        }
    }

    // Clears our internal data structures that describe the drawing
    // and the audio. Then, we render a new canvas.
    function clearEverything() {
        canvasDrawing = new Array();
        maxX = -1;
        playStopButton.disabled = true;
        stopAudio();
        renderCanvas();
    }
    
    // Change the mouse cursor to be a crosshair when we are hovering
    // over the canvas.
    function canvasOnMouseOver() {
        canvasTag.style.cursor = "crosshair";
    }

    // When the user presses the mouse button down, we enter
    // drawing mode.
    function canvasOnMouseDown() {
        isDrawing = true;
        playStopButton.disabled = false;
    }

    // When the user releases the mouse button, we leave
    // drawing mode.
    function canvasOnMouseUp() {
        isDrawing = false;
    }

    // When the mouse cursor is no longer hovering over
    // the canvas, we disable drawing mode (whether it was on or not)
    // and change the mouse cursor back to the default.
    function canvasOnMouseLeave() {
        isDrawing = false;
        canvasTag.style.cursor = "default";
    }

    // When the mouse is moving, we always update the
    // screen with the X and Y coordinates.
    // When draw mode is on, we add a point to the canvasDrawing
    // and rerender the whole line.
    function canvasOnMouseMove(event) {
        //let newX = event.offsetX > mouseX ? event.offsetX : mouseX;
        updatePosition(event.offsetX, event.offsetY);
        if (isDrawing && event.offsetX > maxX && maxX < event.offsetX) {
            maxX = event.offsetX;
            canvasDrawing.push({x: event.offsetX, y: event.offsetY});
            renderCanvas();
        }
    }

    // We hook up the above functions to the event listeners on 
    // the canvas and the control buttons.
    playStopButton.addEventListener("click", togglePlayStop);
    clearButton.addEventListener("click", clearEverything);
    canvasTag.addEventListener("mouseover", canvasOnMouseOver, false);
    canvasTag.addEventListener("mousedown", canvasOnMouseDown, false);
    canvasTag.addEventListener("mouseup", canvasOnMouseUp, false);
    canvasTag.addEventListener("mouseleave", canvasOnMouseLeave, false);
    canvasTag.addEventListener("mousemove", canvasOnMouseMove, false);

    // We render the canvas for the first time.
    renderCanvas();
}