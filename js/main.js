var AC = new AudioContext();

const resumeAC = () => {
	AC.resume();
}

var audio_source_element = document.getElementById("audio_source");
var source = AC.createMediaElementSource(audio_source_element);
var inputNodeForR128 = AC.createGain();
source.connect(inputNodeForR128);

var analyserWaveForm = AC.createAnalyser();

var canvas_waveform = document.getElementById("canvas_waveform");
var canvas_loudness = document.getElementById("canvas_loudness");
var rms_display = document.getElementById("rms_display");
var psr_display = document.getElementById("psr_display");
var short_term_loudness_display = document.getElementById("short_term_loudness_display");
var canvas_waveform_width = canvas_waveform.width;
var canvas_waveform_height = canvas_waveform.height;
var canvas_vertical_middle = canvas_waveform_height / 2;
var canvasCtx_waveform = canvas_waveform.getContext("2d");
var canvasCtx_loudness = canvas_loudness.getContext("2d");
var peakHistory = new Array(canvas_waveform_width);
var rmsHistory_L = new Array(canvas_waveform_width);
var rmsHistory_R = new Array(canvas_waveform_width);
var psrHistory = new Array(canvas_waveform_width);

var r128 = new R128(inputNodeForR128);

for(var i=0; i<canvas_waveform_width; i++){
	peakHistory[i] = 0;
	rmsHistory_L[i] = 0;
	rmsHistory_R[i] = 0;
	psrHistory[i] = 0;
}


source.connect(analyserWaveForm);
source.connect(AC.destination);

var bufferLength = analyserWaveForm.frequencyBinCount;
var dataArrayPeak = new Float32Array(bufferLength);


function draw() {
	analyserWaveForm.getFloatTimeDomainData(dataArrayPeak);

	var ebu_s = r128.getShortTermLoudness();
	var ebu_s_rounded = roundTo1Decimal(ebu_s);
	short_term_loudness_display.innerHTML = ebu_s_rounded + " LUFS";

	//PEAK Calculation
	peakHistory.splice(0, 1);
	var max = dataArrayPeak.maxAbs();
	peakHistory.push(max);




	var rms = r128.getRMS();
	rmsHistory_L.splice(0, 1);
	rmsHistory_R.splice(0, 1);
	rmsHistory_L.push(rms[0]);
	rmsHistory_R.push(rms[1]);
	rms_display.innerHTML = "L " + roundTo1Decimal(rms[0]) + " dbFS<br>R " + roundTo1Decimal(rms[1]) + " dbFS";

	//Compute Peak to short-term loudness ratio PSR
	var psr_lu = r128.getPSR();

	if (!isNaN(psr_lu)){
		psr_display.innerHTML = roundTo1Decimal(psr_lu) + " LU";
	}
	else {
		psr_display.innerHTML = "No signal";
	}

	emoji_display.innerHTML = ASSESS.getPSREmoji(psr_lu);

	psrHistory.splice(0, 1);
	psrHistory.push(psr_lu);

	canvasCtx_waveform.fillStyle = 'rgb(255, 255, 255)';
	canvasCtx_waveform.fillRect(0, 0, canvas_waveform_width, canvas_waveform_width);
	canvasCtx_waveform.lineWidth = 1;

	//PEAK
	canvasCtx_waveform.strokeStyle = 'rgb(0, 0, 255)';
	canvasCtx_waveform.beginPath();

	for (var x = 0; x < peakHistory.length; x++) {

		var y_down = canvas_vertical_middle - (peakHistory[x] * canvas_waveform_height);
		var y_up = canvas_vertical_middle + (peakHistory[x] * canvas_waveform_height);

		canvasCtx_waveform.moveTo(x, y_down);
		canvasCtx_waveform.lineTo(x, y_up);
	}

	canvasCtx_waveform.stroke();

	//RMS
	canvasCtx_waveform.strokeStyle = 'rgb(255, 0, 0)';
	canvasCtx_waveform.lineWidth = 2;
	canvasCtx_waveform.beginPath();
	canvasCtx_waveform.moveTo(0, canvas_waveform_height);
	for (var x = 0; x < rmsHistory_L.length; x++) {
		var y = canvas_waveform_height - (rmsHistory_L[x] * 1.7 * canvas_waveform_height);
		canvasCtx_waveform.lineTo(x, y);
	}

	canvasCtx_waveform.stroke();


	//PSR

	canvasCtx_loudness.fillStyle = 'rgb(255, 255, 255)';
	canvasCtx_loudness.fillRect(0, 0, canvas_waveform_width, canvas_waveform_width);
	canvasCtx_loudness.lineWidth = 1;


	for (var x = 0; x < psrHistory.length; x++) {

		canvasCtx_loudness.beginPath();
		var psr_value = psrHistory[x];
		canvasCtx_loudness.strokeStyle = ASSESS.getPSRColor(psr_value);
		var y = canvas_waveform_height - ((psr_value / 17) * canvas_waveform_height);
		//console.log(lineHeight);
		canvasCtx_loudness.moveTo(x, canvas_waveform_height);
		canvasCtx_loudness.lineTo(x, y);
		canvasCtx_loudness.stroke();
	}

	requestAnimationFrame(draw);
};
draw();


var file_input = document.getElementById("file_input");
file_input.addEventListener("change", function(e){
	resumeAC();

	var file = e.target.files[0];
	var fileURL = URL.createObjectURL(file);
	audio_source_element.src = fileURL;

})

document.getElementById("button_live_input").addEventListener("click", function(){
	resumeAC();

	if (navigator.mediaDevices) {
	    console.log('getUserMedia supported.');
	    navigator.mediaDevices.getUserMedia ({audio: true})
	    .then(function(stream) {
	        var liveSource = AC.createMediaStreamSource(stream);
			liveSource.connect(analyserWaveForm);
			liveSource.connect(inputNodeForR128);
	    })
	    .catch(function(err) {
	        console.log('The following gUM error occured: ' + err);
	    });
	} else {
	   console.log('getUserMedia not supported on your browser!');
	}

});
